import { AudioEngine } from '../../audio/AudioEngine';
import { generatePerformancePlan } from '../../automation/performancePlanGenerator';
import { generateVisualOsPerformancePlan } from '../../automation/visualOsPlanLoader';
import { shouldUseVisualOs, stylePackForVisualMode } from '../../automation/generatorRouting';
import { wormholeMorphDurationFloor } from '../../automation/morphFloor';
import { clampMorphScale } from '../../automation/morphScale';
import { AutomationPlanViewCache } from '../../automation/automationPlanView';
import {
    constrainAutomationPointTime,
    constrainMorphDuration,
    createAutomationPointAtTime,
    nudgeAutomationPointTime,
    removeAutomationPointById,
    snapTimeToNearestGrid,
    updateAutomationPointById,
    type AutomationPointEdit
} from '../../automation/automationPlanEditing';
import { applyAutomationMorphAuthority, resolveAutomationTrigger } from '../performanceAutomationRuntime';
import { computeAndPublishSemanticPlan, snapshotSemanticBaseTuning } from '../semanticPlanRuntime';
import { setActiveVisualTransitionComponent } from '../../state/visualTransitionState';
import { featureFlags } from '../../config/featureFlags';
import { filterForeignIdentityTuningForAutomation } from '../../config/identityTuningRegistry';
import { cloneDefaultVisualTuning, mvpSurfaceTuningOverrides, normalizeVisualTuningConfig, type VisualTuningKey } from '../../config/visualTuning';
import { defaultMvpMacroTuning, mapMvpMacrosToTuning, type MvpMacroTuning } from './macroTuningMapper';
import { advancedBoostKeys, resolveAdvancedTuningValue, defaultAdvancedBoosts, type AdvancedBoosts } from './metaTuningBoost';
import { computeTrackFingerprint, loadMetaTuning, saveMetaTuning, type StoredMetaTuning } from './metaTuningStorage';
import { ExportCapabilityDetector } from '../../export/ExportCapabilityDetector';
import { WebMExporter, type ExportConfig } from '../../export/WebMExporter';
import { State } from '../../state/store';
import type { DramaturgyActivityLevel, DramaturgyVariantMode, PerformanceAutomationPlan, PerformanceAutomationPoint, VisualTuningConfig } from '../../types';

export interface MvpVisualControllerCallbacks {
    onLoadStart: (fileName: string) => void;
    onProgress: (progress: number, stage: string) => void;
    onAnalysisComplete: () => void;
    onAnalysisError: (message: string) => void;
    onPlaybackStateChange: (isPlaying: boolean) => void;
    onPositionChange: (currentTime: number) => void;
    onPlaybackEnded: () => void;
    onPlanChanged: () => void;
    /** Fired when a saved Visual character / Advanced tuning setting is restored for a
     *  newly-loaded track (see restoreMetaTuningForTrack), so the UI can refresh the two panels'
     *  slider positions to match. */
    onMetaTuningRestored: () => void;
}

/**
 * Thin engine/state adapter for the MVP surface, mirroring the shape of PlaybackController /
 * ExportController (constructor(deps, callbacks), no DOM of its own). Owns no data the advanced
 * DashboardUI doesn't already own: it reads/writes the same State.performancePlan /
 * State.editedPerformancePlan / State.targetTuning, so a track opened in both UIs stays consistent.
 */
export class MvpVisualController {
    private readonly engine: AudioEngine;
    private readonly hasTimeBasedSemanticPlan: () => boolean;
    private readonly callbacks: MvpVisualControllerCallbacks;
    private readonly presetCache = new Map<string, unknown>();
    private lastTriggeredAutomationPointId: string | null = null;
    private macros: MvpMacroTuning = { ...defaultMvpMacroTuning };
    private advancedBoosts: AdvancedBoosts = defaultAdvancedBoosts();
    // Reused output buffer for getBoostedTuning, mutated in place every frame instead of
    // allocating a fresh VisualTuningConfig each call.
    private readonly boostedScratch: VisualTuningConfig = cloneDefaultVisualTuning();
    // Content fingerprint of the currently loaded track (see metaTuningStorage.ts), cached once
    // computed so saveMetaTuningForTrack doesn't need to re-hash the analysis on every save.
    private trackFingerprint: string | null = null;
    // AudioEngine guards worker results; these revisions guard later UI-owned async work.
    private loadRevision = 0;
    private planRevision = 0;
    private preparingTrack = false;
    private scrubPreviewTime: number | null = null;
    private exportP5Instance: unknown = null;
    private exportCanvas: HTMLCanvasElement | null = null;
    private currentExporter: WebMExporter | null = null;
    private activityLevel: DramaturgyActivityLevel = 'balanced';
    private variantMode: DramaturgyVariantMode = 'paired';

    private readonly automationPlanView = new AutomationPlanViewCache();

    constructor(engine: AudioEngine, hasTimeBasedSemanticPlan: () => boolean, callbacks: MvpVisualControllerCallbacks) {
        this.engine = engine;
        this.hasTimeBasedSemanticPlan = hasTimeBasedSemanticPlan;
        this.callbacks = callbacks;

        engine.onProgress = (progress, stage) => this.callbacks.onProgress(progress, stage);
        engine.onAnalysisError = (message) => this.callbacks.onAnalysisError(message);
        engine.onPlaybackEnded = () => this.callbacks.onPlaybackEnded();
        engine.addPlaybackStateListener((event) => {
            if (event === 'play') this.callbacks.onPlaybackStateChange(true);
            else if (event === 'pause' || event === 'stop') this.callbacks.onPlaybackStateChange(false);
        });
        engine.addPositionChangedListener((time) => {
            this.lastTriggeredAutomationPointId = null;
            this.callbacks.onPositionChange(time);
        });

        void this.loadAvailablePresets();
    }

    // ─── File loading ─────────────────────────────────────────────────────────

    async loadFile(file: File): Promise<void> {
        const loadRevision = ++this.loadRevision;
        const planRevision = ++this.planRevision;
        this.preparingTrack = true;
        this.engine.stop(true);
        this.presetCache.clear();
        this.lastTriggeredAutomationPointId = null;
        State.performancePlan = null;
        State.editedPerformancePlan = null;
        State.automationMorphScale = 1;
        this.invalidateAutomationPlanView();
        this.trackFingerprint = null;
        this.callbacks.onLoadStart(file.name);

        this.engine.onAnalysisComplete = () => { void this.finishLoading(loadRevision, planRevision); };

        try {
            await this.engine.loadFile(file);
        } catch {
            if (this.isCurrentRequest(loadRevision, planRevision)) {
                this.callbacks.onAnalysisError('Could not load this file.');
            }
        }
    }

    private isCurrentRequest(loadRevision: number, planRevision: number): boolean {
        return loadRevision === this.loadRevision && planRevision === this.planRevision;
    }

    private async finishLoading(loadRevision: number, planRevision: number): Promise<void> {
        if (!this.isCurrentRequest(loadRevision, planRevision)) return;
        const analysis = State.trackAnalysis;
        try {
            const plan = await this.generatePlan();
            if (!this.isCurrentRequest(loadRevision, planRevision)) return;
            await this.restoreMetaTuningForTrack(loadRevision, analysis);
            if (!this.isCurrentRequest(loadRevision, planRevision)) return;
            State.performancePlan = plan;
            State.editedPerformancePlan = JSON.parse(JSON.stringify(plan));
            State.performancePlanEdited = false;
            setActiveVisualTransitionComponent('automation', null);
            void this.preloadPresetsForPlan(plan);
            this.computeSemanticPlan();
            this.snapshotSemanticBase();
            this.preparingTrack = false;
            this.callbacks.onPlanChanged();
            this.callbacks.onAnalysisComplete();
        } catch {
            if (this.isCurrentRequest(loadRevision, planRevision)) {
                this.callbacks.onAnalysisError('Could not prepare this track. Please load it again.');
            }
        }
    }

    private computeSemanticPlan(): void {
        computeAndPublishSemanticPlan();
    }

    private snapshotSemanticBase(): void {
        snapshotSemanticBaseTuning(this.hasTimeBasedSemanticPlan());
    }

    getActivityLevel(): DramaturgyActivityLevel { return this.activityLevel; }
    getVariantMode(): DramaturgyVariantMode { return this.variantMode; }

    /**
     * Regenerates the automation plan from scratch under new Activity/Variation settings,
     * discarding any manual moment edits (the caller — TimelineToolbar — confirms with the user
     * first). Re-runs the same semantic + preset preload sequence as the initial load so the
     * dramaturgy band and modulation layer stay in sync with the new plan.
     */
    async regeneratePlan(activityLevel: DramaturgyActivityLevel, variantMode: DramaturgyVariantMode): Promise<void> {
        if (this.preparingTrack) return;
        const loadRevision = this.loadRevision;
        const planRevision = ++this.planRevision;
        this.activityLevel = activityLevel;
        this.variantMode = variantMode;
        this.lastTriggeredAutomationPointId = null;
        let plan: PerformanceAutomationPlan;
        try {
            plan = await this.generatePlan();
        } catch {
            if (this.isCurrentRequest(loadRevision, planRevision)) {
                this.callbacks.onAnalysisError('Could not regenerate the journey.');
            }
            return;
        }
        if (!this.isCurrentRequest(loadRevision, planRevision)) return;
        // The previous plan may still have triggered presets while this plan was building.
        // Invalidate those requests even when regenerated points reuse the same ids.
        ++this.planRevision;
        this.lastTriggeredAutomationPointId = null;
        State.performancePlan = plan;
        State.editedPerformancePlan = JSON.parse(JSON.stringify(plan));
        State.performancePlanEdited = false;
        State.automationMorphScale = 1;
        this.invalidateAutomationPlanView();
        setActiveVisualTransitionComponent('automation', null);
        void this.preloadPresetsForPlan(plan);
        this.computeSemanticPlan();
        this.callbacks.onPlanChanged();
    }

    private async generatePlan(): Promise<PerformanceAutomationPlan> {
        // Capture the inputs before the Visual OS await, including its legacy fallback.
        const analysis = State.trackAnalysis;
        const duration = State.duration;
        const availablePresets = State.availablePresets;
        const presetMetadata = State.preloadedPresets as Record<string, unknown>;
        if (shouldUseVisualOs('dramaturgy', featureFlags.forceLegacyDramaturgy)) {
            const plan = await generateVisualOsPerformancePlan(analysis, {
                duration,
                stylePackId: stylePackForVisualMode('cosmic-wormhole'),
                activityLevel: this.activityLevel,
                variantMode: this.variantMode
            });
            if (plan && plan.points.length > 0) return plan;
        }
        return generatePerformancePlan(analysis, availablePresets, duration, {
            strategy: 'dramaturgy',
            presetMetadata,
            strictPresets: [],
            strictBars: 8,
            strictMorph: 1.0
        });
    }

    private async loadAvailablePresets(): Promise<void> {
        try {
            const response = await fetch(this.presetUrl('index.json'), { cache: 'no-store' });
            if (!response.ok) throw new Error(String(response.status));
            const manifest = await response.json() as { presets?: string[] };
            const presets = (manifest.presets || [])
                .filter((f) => /^[\w .-]+\.json$/i.test(f))
                .filter((f) => f.toLowerCase() !== 'index.json');
            State.availablePresets = presets;
        } catch {
            State.availablePresets = [];
        }
    }

    private presetUrl(fileName: string): string {
        return `${import.meta.env.BASE_URL}visual-tuning-presets/${encodeURIComponent(fileName)}`;
    }

    private async preloadPresetsForPlan(plan: PerformanceAutomationPlan | null): Promise<void> {
        if (!plan?.points.length) return;
        const loadRevision = this.loadRevision;
        const uniquePresets = [...new Set(plan.points.map((p) => p.preset))];
        await Promise.all(uniquePresets.map(async (preset) => {
            if (this.presetCache.has(preset)) return;
            try {
                const response = await fetch(this.presetUrl(preset), { cache: 'no-store' });
                if (!response.ok) throw new Error(String(response.status));
                const payload = await response.json();
                if (loadRevision === this.loadRevision) this.presetCache.set(preset, payload);
            } catch { /* opportunistic */ }
        }));
    }

    private async loadAndApplyPreset(fileName: string, point: PerformanceAutomationPoint): Promise<void> {
        const loadRevision = this.loadRevision;
        const planRevision = this.planRevision;
        try {
            let payload = this.presetCache.get(fileName);
            if (payload === undefined) {
                const response = await fetch(this.presetUrl(fileName), { cache: 'no-store' });
                if (!response.ok) throw new Error(String(response.status));
                payload = await response.json();
                if (!this.isCurrentRequest(loadRevision, planRevision)) return;
                this.presetCache.set(fileName, payload);
            }
            if (!this.isCurrentRequest(loadRevision, planRevision)) return;
            if (point.id !== this.lastTriggeredAutomationPointId) return; // superseded by a later trigger
            this.applyAutomationPreset(payload, point);
        } catch { /* preset unavailable; keep current tuning */ }
    }

    /**
     * Applies a preset payload as an automation-driven tuning change. A deliberately trimmed
     * mirror of DashboardUI.applyPerformancePreset: it skips preset-embedded visualMode switches
     * (the MVP never leaves cosmic-wormhole) and preset-embedded nested performancePlan overrides
     * (an advanced/rare preset feature), but keeps the tuning normalization, morph-authority
     * override, and the anti-jarring wormhole morph-duration floor so a track sounds/looks the
     * same whichever UI drives it.
     */
    private applyAutomationPreset(payload: unknown, point: PerformanceAutomationPoint): void {
        const previousSpeed = State.targetTuning.wormholeSpeed;
        const previousBend = State.targetTuning.wormholePathBend;
        const previousBendVertical = State.targetTuning.wormholePathBendVertical;

        const filtered = filterForeignIdentityTuningForAutomation(
            (payload && typeof payload === 'object' ? payload : {}) as { visualMode?: unknown; visualTuning?: unknown },
            State.visualMode
        );
        Object.assign(State.targetTuning, normalizeVisualTuningConfig(filtered, State.targetTuning));
        if (point.bendMirror) State.targetTuning.wormholePathBend = -State.targetTuning.wormholePathBend;

        // MVP surface policy (config-owned, see mvpSurfaceTuningOverrides): forced back to its
        // fixed value after every preset merge regardless of what the preset requested.
        Object.assign(State.targetTuning, mvpSurfaceTuningOverrides);

        const preset = filtered as { dramaturgyProfile?: Record<string, unknown> };
        const profile = preset.dramaturgyProfile;
        if (profile) {
            if (typeof profile.buildupIntensity === 'number') State.targetTuning.buildupIntensity = profile.buildupIntensity;
            if (typeof profile.dropDampening === 'number') State.targetTuning.dropDampening = profile.dropDampening;
            if (typeof profile.breakRestraint === 'number') State.targetTuning.breakRestraint = profile.breakRestraint;
            if (typeof profile.vocalHighlight === 'number') State.targetTuning.vocalHighlight = profile.vocalHighlight;
            if (typeof profile.fxChaos === 'number') State.targetTuning.fxChaos = profile.fxChaos;
        }

        applyAutomationMorphAuthority(State.targetTuning, point);
        const deltaSpeed = Math.abs(State.targetTuning.wormholeSpeed - previousSpeed);
        const deltaBend = Math.hypot(
            State.targetTuning.wormholePathBend - previousBend,
            State.targetTuning.wormholePathBendVertical - previousBendVertical
        );
        State.targetTuning.morphDurationSec = Math.max(point.morphDurationSec, wormholeMorphDurationFloor(deltaSpeed, deltaBend));

        // Re-base the ADR-003/004 semantic layer's anchor on this point's own fully-resolved
        // tuning, mirroring DashboardUI.loadVisualPreset's own re-snapshot after
        // applyPerformancePreset. Without this, the slow modulation channel keeps modulating
        // around whichever point last triggered the very first time this ran, and periodically
        // snaps every later point's look back to that stale anchor the next time its choreography
        // frame changes. One cheap object-spread per point trigger, not a per-frame cost.
        //
        // Note this is State.targetTuning itself -- the raw, un-boosted signal. Visual character /
        // Advanced tuning never touch targetTuning or semanticBaseTuning at all (see
        // getBoostedTuning): they're applied fresh every render frame, straight from whatever this
        // preset trigger (or the semantic layer) currently authors, so there is no anchor here for
        // them to go stale against in the first place.
        this.snapshotSemanticBase();
    }

    // ─── Playback ─────────────────────────────────────────────────────────────

    play(): void { this.engine.play(); }
    pause(): void { this.engine.stop(false); }
    isPlaying(): boolean { return State.isPlaying; }

    /** UI-only scrub preview; does not touch AudioEngine until commitScrub. */
    scrub(time: number): void {
        this.scrubPreviewTime = Math.max(0, Math.min(time, State.duration));
    }

    commitScrub(time: number): void {
        this.scrubPreviewTime = null;
        this.engine.seek(Math.max(0, Math.min(time, State.duration)));
    }

    seekRelative(deltaSec: number): void {
        this.engine.seek(this.getCurrentTime() + deltaSec);
    }

    getCurrentTime(): number {
        return this.scrubPreviewTime !== null ? this.scrubPreviewTime : this.engine.getCurrentTime();
    }

    getDuration(): number { return State.duration; }
    getAudioBuffer(): AudioBuffer | null { return this.engine.getAudioBuffer(); }
    isScrubbing(): boolean { return this.scrubPreviewTime !== null; }

    // ─── Meta tuning: Visual character (macros) + Advanced tuning (per-parameter boosts) ───────
    // Both panels are pure, stateless boost/cut settings -- see metaTuningBoost.ts. Neither one
    // ever writes State.targetTuning or State.semanticBaseTuning: a preset, an automation point,
    // and the ADR-003/004 semantic layer all still author targetTuning exactly as before, and the
    // boosts are layered on top fresh every render frame in getBoostedTuning, straight from
    // whatever that raw signal currently is. That is what makes them genuinely sit "on top of
    // everything" instead of only the moment/preset that happened to be active when a slider was
    // last touched: there is no anchor or snapshot here that a later preset/automation-point/
    // dramaturgy-frame change could silently go stale against.

    getMacros(): MvpMacroTuning { return { ...this.macros }; }

    setMacros(macros: MvpMacroTuning): void {
        this.macros = { ...macros };
    }

    getAdvancedBoosts(): AdvancedBoosts { return { ...this.advancedBoosts }; }

    setAdvancedBoost(key: VisualTuningKey, fraction: number): void {
        this.advancedBoosts[key] = fraction;
    }

    resetAdvancedBoosts(): void {
        this.advancedBoosts = defaultAdvancedBoosts();
    }

    /** State.targetTuning itself: the raw, un-boosted signal a preset/automation point/dramaturgy
     *  frame currently authors. Exposed for callers (e.g. a moment's own preview) that want that
     *  signal specifically, as opposed to what actually renders -- see getBoostedTuning. */
    getEffectiveTuning(): VisualTuningConfig { return State.targetTuning; }

    /**
     * The tuning actually fed to the render morph target: `raw` (State.targetTuning, read fresh
     * every call so this never carries a stale anchor) with the Visual character macros applied
     * first, then the Advanced tuning per-parameter boosts layered on top of that result --
     * a coarse gain stage followed by a fine per-key trim, the same layering a channel fader and
     * a per-band EQ trim would give you, not two competing absolute values. Mutates and returns a
     * single reused scratch object (no per-frame allocation); called once per render frame via
     * MvpUI's PlexusRendererHost.getTuningForMorph hook, immediately before applyTuningMorph reads
     * it -- so the whole pass costs a fixed ~30 multiply-and-clamp operations per frame, not a
     * standing background cost.
     * Discrete Advanced selectors override their key after the continuous gain stages.
     */
    getBoostedTuning(raw: VisualTuningConfig): VisualTuningConfig {
        Object.assign(this.boostedScratch, raw);
        mapMvpMacrosToTuning(this.macros, raw, this.boostedScratch);
        for (const key of advancedBoostKeys) {
            this.boostedScratch[key] = resolveAdvancedTuningValue(key, this.advancedBoosts[key], this.boostedScratch[key]);
        }
        return this.boostedScratch;
    }

    // ─── Meta tuning persistence (saved once per track, not per preset) ────────────────────────
    // The saved key fingerprints rounded analysis descriptors, independently of filename.
    // It does not guarantee audio-content identity or stability after re-encoding.

    private async restoreMetaTuningForTrack(loadRevision: number, analysis: typeof State.trackAnalysis): Promise<void> {
        const fingerprint = await computeTrackFingerprint(analysis);
        if (loadRevision !== this.loadRevision) return;
        this.trackFingerprint = fingerprint;
        const stored = loadMetaTuning(fingerprint);
        if (!stored) return;
        this.macros = { ...defaultMvpMacroTuning, ...stored.macros };
        this.advancedBoosts = { ...defaultAdvancedBoosts(), ...stored.advancedBoosts };
        this.callbacks.onMetaTuningRestored();
    }

    /** Persists the current Visual character + Advanced tuning boosts for the whole track under
     *  one combined entry (triggered from Advanced tuning's single Save button) so they come back
     *  automatically next time this same song loads. Returns false if the write itself failed
     *  (private browsing, storage quota, disabled storage) so the caller can tell the user. */
    async saveMetaTuningForTrack(): Promise<boolean> {
        if (this.preparingTrack) return false;
        const loadRevision = this.loadRevision;
        const payload: StoredMetaTuning = { version: 1, macros: this.getMacros(), advancedBoosts: this.getAdvancedBoosts() };
        const fingerprint = this.trackFingerprint ?? await computeTrackFingerprint(State.trackAnalysis);
        if (loadRevision !== this.loadRevision) return false;
        this.trackFingerprint = fingerprint;
        return saveMetaTuning(fingerprint, payload);
    }

    // ─── Journey / moment editing ─────────────────────────────────────────────

    getPlan(): PerformanceAutomationPlan | null {
        return State.editedPerformancePlan ?? State.performancePlan;
    }

    private ensureEditedPlan(): PerformanceAutomationPlan | null {
        if (State.editedPerformancePlan) return State.editedPerformancePlan;
        if (!State.performancePlan) return null;
        State.editedPerformancePlan = JSON.parse(JSON.stringify(State.performancePlan));
        return State.editedPerformancePlan;
    }

    addMomentAtCurrentTime(): PerformanceAutomationPoint | null {
        return this.addMomentAtTime(this.getCurrentTime());
    }

    addMomentAtTime(time: number): PerformanceAutomationPoint | null {
        const plan = this.ensureEditedPlan();
        if (!plan) return null;
        const defaultPreset = plan.points[0]?.preset ?? State.availablePresets[0] ?? 'default.json';
        const point = createAutomationPointAtTime(plan, time, State.duration, State.trackAnalysis.sections, {
            preset: defaultPreset,
            intensity: Math.min(4, Math.max(0.1, State.visualTuning.audioSensitivity)),
            morphCurve: 'easeInOut',
            defaultMorphDurationSec: 2
        });
        if (point) {
            State.performancePlanEdited = true;
            this.lastTriggeredAutomationPointId = null;
            this.invalidateAutomationPlanView();
            this.callbacks.onPlanChanged();
        }
        return point;
    }

    /**
     * Generic point edit used by MomentInspector for time (text field), strength, and transition
     * changes. Time and morph-duration edits are passed through the same non-overlap contract the
     * timeline drag path (moveMoment) enforces -- and re-sort the plan afterward -- so a typed-in
     * time can never land inside a neighbour's morph span or leave the plan's points array out of
     * time order (findActiveAutomationPoint's scan assumes ascending order and silently stops
     * triggering later points if it isn't).
     */
    updateMoment(id: string, edit: AutomationPointEdit): void {
        const plan = this.ensureEditedPlan();
        const point = plan?.points.find((p) => p.id === id);
        if (!plan || !point) return;

        const constrainedEdit: AutomationPointEdit = { ...edit };
        if (constrainedEdit.time !== undefined) {
            constrainedEdit.time = constrainAutomationPointTime(plan, id, point.morphDurationSec, constrainedEdit.time, State.duration);
        }
        if (constrainedEdit.morphDurationSec !== undefined) {
            const effectiveTime = constrainedEdit.time ?? point.time;
            constrainedEdit.morphDurationSec = constrainMorphDuration(plan, id, effectiveTime, constrainedEdit.morphDurationSec, State.duration);
        }

        if (updateAutomationPointById(plan, id, constrainedEdit)) {
            if (constrainedEdit.time !== undefined) plan.points.sort((a, b) => a.time - b.time);
            State.performancePlanEdited = true;
            this.lastTriggeredAutomationPointId = null;
            this.invalidateAutomationPlanView();
            this.callbacks.onPlanChanged();
        }
    }

    /** Snaps `proposedTime` to the nearest beat first when State.snapToGrid is on. */
    moveMoment(id: string, proposedTime: number): void {
        const plan = this.ensureEditedPlan();
        const point = plan?.points.find((p) => p.id === id);
        if (!plan || !point) return;
        const snapped = State.snapToGrid
            ? snapTimeToNearestGrid(proposedTime, State.trackAnalysis.bars, State.duration)
            : proposedTime;
        point.time = constrainAutomationPointTime(plan, id, point.morphDurationSec, snapped, State.duration);
        plan.points.sort((a, b) => a.time - b.time);
        State.performancePlanEdited = true;
        this.lastTriggeredAutomationPointId = null;
        this.invalidateAutomationPlanView();
        this.callbacks.onPlanChanged();
    }

    nudgeMoment(id: string, deltaBeats: number): void {
        const plan = this.ensureEditedPlan();
        if (!plan) return;
        if (nudgeAutomationPointTime(plan, id, deltaBeats, State.trackAnalysis.bars, State.duration)) {
            plan.points.sort((a, b) => a.time - b.time);
            State.performancePlanEdited = true;
            this.lastTriggeredAutomationPointId = null;
            this.invalidateAutomationPlanView();
            this.callbacks.onPlanChanged();
        }
    }

    removeMoment(id: string): void {
        const plan = this.ensureEditedPlan();
        if (!plan) return;
        if (removeAutomationPointById(plan, id)) {
            State.performancePlanEdited = true;
            this.lastTriggeredAutomationPointId = null;
            this.invalidateAutomationPlanView();
            this.callbacks.onPlanChanged();
        }
    }

    // ─── Morph scale (non-destructive; scales every point's morph duration for playback/display
    // only — the base plan's own morphDurationSec values are never overwritten) ─────────────────

    getMorphScale(): number { return State.automationMorphScale; }

    getMaxMorphScale(): number {
        return clampMorphScale(this.getPlan(), 4);
    }

    setMorphScale(scale: number): void {
        State.automationMorphScale = clampMorphScale(this.getPlan(), scale);
        this.lastTriggeredAutomationPointId = null;
        this.invalidateAutomationPlanView();
    }

    private invalidateAutomationPlanView(): void {
        this.automationPlanView.invalidate();
    }

    /** The plan the timeline should render and the tick loop should trigger from: base plan with
     *  State.automationMorphScale applied. Cached until the base plan or scale actually changes. */
    getAutomationPlanView(): PerformanceAutomationPlan | null {
        return this.automationPlanView.getView(
            this.getPlan(),
            State.automationMorphScale,
            State.duration,
            (clampedScale) => { State.automationMorphScale = clampedScale; this.lastTriggeredAutomationPointId = null; }
        );
    }

    // ─── Per-frame tick (called from the renderer host's updateDashboard hook) ─

    tick(): void {
        const plan = this.getAutomationPlanView();
        const result = resolveAutomationTrigger(plan, State.currentTime, this.lastTriggeredAutomationPointId);
        switch (result.kind) {
            case 'empty':
                setActiveVisualTransitionComponent('automation', null);
                return;
            case 'inactive':
                setActiveVisualTransitionComponent('automation', null);
                this.lastTriggeredAutomationPointId = null;
                return;
            case 'unchanged':
                return;
            case 'trigger':
                this.lastTriggeredAutomationPointId = result.point.id;
                // Marks this point as the live transition source so CosmicWormholeIdentity's
                // transition-disturbance envelope actually fires (it no-ops on a null id) --
                // without this, the wormhole still eases the raw numbers via applyTuningMorph, but
                // the perceptual "flourish" that makes a preset switch read as a smooth morph
                // instead of a sudden change never plays.
                setActiveVisualTransitionComponent('automation', `automation:${result.point.id}`);
                void this.loadAndApplyPreset(result.point.preset, result.point);
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    setExportTarget(p5Instance: unknown, canvas: HTMLCanvasElement): void {
        this.exportP5Instance = p5Instance;
        this.exportCanvas = canvas;
    }

    canExport(): boolean {
        return State.duration > 0 && Boolean(this.exportP5Instance && this.exportCanvas);
    }

    async startExport(config: ExportConfig, onProgress: (progress: number) => void): Promise<Blob> {
        if (!this.canExport() || this.currentExporter) throw new Error('Export is not available right now.');
        const wasPlaying = State.isPlaying;
        if (wasPlaying) this.engine.stop(false);

        const exporter = new WebMExporter(this.exportP5Instance, this.exportCanvas!, this.engine, null);
        this.currentExporter = exporter;
        try {
            return await exporter.startExport(config, onProgress);
        } finally {
            if (this.currentExporter === exporter) this.currentExporter = null;
        }
    }

    stopAndSaveExport(): void { this.currentExporter?.stopAndSave(); }
    cancelExport(): void { this.currentExporter?.cancelExport(); this.currentExporter = null; }

    static async detectExportCapabilities() {
        return ExportCapabilityDetector.detectCapabilities();
    }
}
