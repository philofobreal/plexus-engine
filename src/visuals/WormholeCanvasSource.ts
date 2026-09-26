import type { CanvasVisualSource, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { MotifChoreographyFrame, PerformanceAutomationPlan, VisualChoreographyPlan } from '../types';
import { createEmptyTrackAnalysis } from '../analyzer/normalizeAnalysisResult';
import { cloneDefaultVisualTuning, applyTuningMorph, tuningMorphDeltaSec, writeModulationBus } from '../config/visualTuning';
import { resolveMetaTuning } from '../config/resolveMetaTuning';
import { XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS } from '../config/xrWormholeTuning';
import { featureFlags } from '../config/featureFlags';
import { applyMvpWormholePreset } from '../automation/applyMvpWormholePreset';
import { findActiveAutomationPoint } from '../automation/performanceAutomationRuntime';
import { buildNarrative, generateIntents, processChoreography, resolveSemanticState, SemanticResolver, SemanticRuntimeAdapter } from '../semantics';
import { motifTransitionId, semanticScoreTransitionId } from './VisualTransitionIdentity';
import { Canvas2DRendererBackend } from './Canvas2DRendererBackend';
import { CosmicWormholeIdentity, type WormholeRenderState } from './CosmicWormholeIdentity';
import { VisualDirectorFSM } from './VisualDirectorFSM';
import { BEAT_DECAY_PER_FRAME, CUE_DECAY_PER_FRAME, DENSE_IMPACT_DECAY_PER_FRAME, transientDecayAfter } from './transientDecay';

function emptyState(): WormholeRenderState {
    return {
        frames: [], events: [], sampleRate: 44100, hopSize: 1024, bpm: 0, trackAnalysis: createEmptyTrackAnalysis(),
        currentTime: 0, isExporting: false, exportTime: 0, playbackFade: 0,
        visualTuning: cloneDefaultVisualTuning(), targetTuning: cloneDefaultVisualTuning(), activeVisualTransitionId: null,
        currentFrame: { e: 0, densityProj: 0, melodyProj: 0, fxProj: 0, subEnergy: 0, bassEnergy: 0, subFlux: 0, bassFlux: 0,
            perceptualSpectrum: new Array(24).fill(0), state: 'IDLE', eRatio: 0 },
        currentFeatures: { melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 },
        modulation: { subEnergy: 0, bassEnergy: 0, subFlux: 0, bassFlux: 0, kineticTension: 0, densityDrive: 0, spectralChaos: 0, rhythmicImpulse: 0, macroMomentum: 0 },
        beatDecay: 0, denseImpactFlash: 0,
        directorOutput: { state: 'IDLE', centripetalOrbit: 0, glitchIntensity: 0, invertBackground: false }
    };
}

export interface WormholeCanvasSourceOptions {
    /** Opt-in debug surface (`?xrDiagnostics=1`), decided by the composition root. */
    readonly diagnostics?: boolean;
}

/** The actual MVP identity, with private state and the same preset/macro/semantic functions.
 * The caller owns cadence. There is no p5 loop, AudioEngine, global State write, or realtime DSP.
 * Embedded-host adapter with a documented import exception (ADR-009 addendum, architecture
 * contract): it consumes the supplied plan and fetches only that plan's preset assets.
 */
export class WormholeCanvasSource implements CanvasVisualSource {
    private readonly backend = new Canvas2DRendererBackend(960, 540);
    readonly canvas = this.backend.canvas;
    private state = emptyState();
    private identity = new CosmicWormholeIdentity(this.state);
    private director = new VisualDirectorFSM();
    private resolver = new SemanticResolver();
    private semanticBase = cloneDefaultVisualTuning();
    private semantic = new SemanticRuntimeAdapter(this.resolver, () => this.semanticBase);
    private choreography: VisualChoreographyPlan | null = null;
    private lastMotif: MotifChoreographyFrame | null = null;
    private plan: PerformanceAutomationPlan | null = null;
    private presets = new Map<string, unknown>();
    private lastPointId: string | null = null;
    private readonly boosted = cloneDefaultVisualTuning();
    private lastTime: number | null = null;
    private lastPlaying = false;
    private revision = 0;
    private disposed = false;
    private denseEvents: { time: number }[] = [];
    private readonly diagnostics: boolean;

    constructor(options: WormholeCanvasSourceOptions = {}) {
        this.diagnostics = options.diagnostics === true;
        if (this.diagnostics) {
            this.canvas.hidden = true;
            this.canvas.dataset.xrWormhole = 'true';
            document.body.appendChild(this.canvas);
        }
    }

    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision = ++this.revision;
        this.state = emptyState();
        if (analysis) Object.assign(this.state, analysis);
        this.identity = new CosmicWormholeIdentity(this.state);
        this.director = new VisualDirectorFSM();
        this.resolver = new SemanticResolver();
        this.resolver.setPlan(analysis?.trackAnalysis.externalVisualScorePlan ?? null);
        this.semanticBase = cloneDefaultVisualTuning();
        this.semantic = new SemanticRuntimeAdapter(this.resolver, () => this.semanticBase);
        this.plan = null; this.presets.clear(); this.lastPointId = null; this.lastMotif = null; this.lastTime = null;
        this.denseEvents = this.state.events.filter(event => event.type === 2);
        this.choreography = analysis && featureFlags.semanticResolver
            ? processChoreography(generateIntents(buildNarrative(analysis.trackAnalysis)), analysis.trackAnalysis) : null;
        resolveMetaTuning(this.state.targetTuning, XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS, this.state.visualTuning);
        if (!analysis) return;
        const baseUrl = import.meta.env.BASE_URL;
        // The facade prepares the shared plan offline; this source never regenerates it.
        const plan = analysis.performancePlan;
        const presets = new Map<string, unknown>();
        await Promise.all([...new Set(plan.points.map(point => point.preset))].map(async name => {
            const response = await fetch(`${baseUrl}visual-tuning-presets/${encodeURIComponent(name)}`);
            if (!response.ok) throw new Error(`Could not load Wormhole preset: ${name}`);
            presets.set(name, await response.json());
        }));
        if (this.disposed || revision !== this.revision) return;
        this.plan = plan; this.presets = presets; this.lastTime = null;
    }

    render(time: number, playing: boolean): boolean {
        if (this.disposed) return false;
        const previous = this.lastTime;
        const jump = previous !== null && (time < previous || time - previous > 0.25);
        // Texture work is capped to 30 Hz, independently of headset pose / gameplay cadence.
        if (previous !== null && playing === this.lastPlaying && !jump && time - previous < 1 / 30 - 0.001) return false;
        const dt = tuningMorphDeltaSec(time, previous);
        this.lastTime = time; this.lastPlaying = playing;
        const state = this.state;
        state.currentTime = time;
        state.playbackFade = playing ? Math.min(1, state.playbackFade + dt) : state.playbackFade;
        if (jump && time < (previous ?? 0)) {
            state.targetTuning = cloneDefaultVisualTuning(); this.lastPointId = null; this.lastMotif = null;
        }
        const point = findActiveAutomationPoint(this.plan, time);
        if (point && point.id !== this.lastPointId) {
            applyMvpWormholePreset(state.targetTuning, this.presets.get(point.preset), point);
            this.semanticBase = { ...state.targetTuning }; this.lastPointId = point.id; this.lastMotif = null;
        }
        let semanticId: string | null = null;
        if (featureFlags.semanticChoreography && this.resolver.hasPlan()) {
            semanticId = semanticScoreTransitionId(this.semantic.update(time, state.targetTuning));
        } else if (this.choreography) {
            const index = lastIndexAt(this.choreography.frames, time);
            const motif = this.choreography.frames[index] ?? null;
            if (motif !== this.lastMotif) {
                Object.assign(state.targetTuning, resolveSemanticState(motif, 'cosmic-wormhole', { 'cosmic-wormhole': this.semanticBase }));
                this.lastMotif = motif;
            }
            semanticId = motifTransitionId(motif);
        }
        const automationId = point ? `automation:${point.id}` : '';
        state.activeVisualTransitionId = automationId && semanticId ? `${automationId}|${semanticId}` : automationId || semanticId || null;
        resolveMetaTuning(state.targetTuning, XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS, this.boosted);
        if (previous === null || jump) Object.assign(state.visualTuning, this.boosted);
        else applyTuningMorph(state.visualTuning, this.boosted, this.boosted.transitionSpeed, dt);
        const index = Math.max(0, Math.floor(time * state.sampleRate / state.hopSize));
        // Copy before the director mutates its live frame; published analysis remains immutable.
        if (state.frames[index]) Object.assign(state.currentFrame, state.frames[index]);
        if (state.trackAnalysis.features[index]) Object.assign(state.currentFeatures, state.trackAnalysis.features[index]);
        const beat = state.events[lastIndexAt(state.events, time)];
        const dense = this.denseEvents[lastIndexAt(this.denseEvents, time)];
        const cue = state.trackAnalysis.cues[lastIndexAt(state.trackAnalysis.cues, time)];
        state.beatDecay = beat ? transientDecayAfter(BEAT_DECAY_PER_FRAME, time - beat.time) : 0;
        state.denseImpactFlash = dense ? transientDecayAfter(DENSE_IMPACT_DECAY_PER_FRAME, time - dense.time) : 0;
        const cueDecay = cue ? cue.intensity * transientDecayAfter(CUE_DECAY_PER_FRAME, time - cue.time) : 0;
        writeModulationBus(state.modulation, state.currentFrame, state.currentFeatures, state.beatDecay, cueDecay, state.visualTuning);
        const future = state.frames[Math.floor((time + state.visualTuning.dropAnticipation) * state.sampleRate / state.hopSize)];
        state.directorOutput = this.director.update(time, state.currentFrame, state.currentFeatures,
            state.trackAnalysis.buildupConfidence[index] ?? 0, state.trackAnalysis.spectralPivot[index] ?? 0,
            state.visualTuning, state.modulation, state.visualTuning.dropAnticipation > 0 ? future : undefined);
        if (jump) this.identity.syncPosition(time);
        this.backend.frameCount++;
        this.identity.draw(this.backend, [], []);
        if (this.diagnostics) {
            this.canvas.dataset.frames = String(this.backend.frameCount);
            this.canvas.dataset.tuning = JSON.stringify(state.visualTuning);
            this.canvas.dataset.point = point?.preset ?? '';
        }
        return true;
    }
    dispose(): void { this.disposed = true; ++this.revision; this.canvas.width = this.canvas.height = 1; if (this.diagnostics) this.canvas.remove(); }
}

function lastIndexAt(entries: readonly { time: number }[], time: number): number {
    let lo = 0, hi = entries.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (entries[mid].time <= time) lo = mid + 1; else hi = mid; }
    return lo - 1;
}
