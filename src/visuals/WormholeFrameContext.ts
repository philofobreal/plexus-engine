import type { CanvasVisualPresentation, GrainMaterialBoostKey, VisualAnalysisSnapshot } from '../types/CanvasVisualSource';
import type { WormholeContextSeed } from '../types/WormholeContext';
import type { PerformanceAutomationPoint, PerformanceAutomationPlan, VisualChoreographyPlan, VisualTuningConfig } from '../types';
import { createEmptyTrackAnalysis } from '../analyzer/normalizeAnalysisResult';
import { cloneDefaultVisualTuning, applyTuningMorph, writeModulationBus, normalizeVisualTuningConfig } from '../config/visualTuning';
import { resolveMetaTuning } from '../config/resolveMetaTuning';
import { defaultAdvancedBoosts, resolveAdvancedTuningValue } from '../config/metaTuningBoost';
import { DEFAULT_WORMHOLE_WALL, WORMHOLE_WALL_GAIN_FIELDS, type WormholeWallPresentation } from '../types/WormholeWallPresentation';
import { applyMvpWormholePreset } from '../automation/applyMvpWormholePreset';
import { findActiveAutomationPoint, isAutomaticCuePoint } from '../automation/performanceAutomationRuntime';
import { applyMorphScale } from '../automation/morphScale';
import { AutomationTuningTimeline } from '../automation/AutomationTuningTimeline';
import { WormholeSpiralAutomation } from '../automation/WormholeSpiralAutomation';
import { buildNarrative, generateIntents, processChoreography, MotifRuntimeAdapter, SemanticResolver, SemanticRuntimeAdapter } from '../semantics';
import { SemanticTuningProjection } from './SemanticTuningProjection';
import { motifTransitionId, semanticScoreTransitionId } from './VisualTransitionIdentity';
import { CosmicWormholeIdentity, type WormholeRenderState } from './CosmicWormholeIdentity';
import { VisualDirectorFSM } from './VisualDirectorFSM';
import { BEAT_DECAY_PER_FRAME, CUE_DECAY_PER_FRAME, DENSE_IMPACT_DECAY_PER_FRAME, transientDecayAfter } from './transientDecay';

function emptyState(): WormholeRenderState {
    return {
        frames: [], events: [], sampleRate: 44100, hopSize: 1024, bpm: 0, trackAnalysis: createEmptyTrackAnalysis(),
        currentTime: 0, isExporting: false, exportTime: 0, playbackFade: 0,
        visualTuning: cloneDefaultVisualTuning(), targetTuning: cloneDefaultVisualTuning(), activeVisualTransitionId: null, spiralTransitionAnchor: null,
        currentFrame: { e: 0, densityProj: 0, melodyProj: 0, fxProj: 0, subEnergy: 0, bassEnergy: 0, subFlux: 0, bassFlux: 0,
            perceptualSpectrum: new Array(24).fill(0), state: 'IDLE', eRatio: 0 },
        currentFeatures: { melody: 0, vocal: 0, fx: 0, density: 0, brightness: 0, tension: 0 },
        modulation: { subEnergy: 0, bassEnergy: 0, subFlux: 0, bassFlux: 0, kineticTension: 0, densityDrive: 0, spectralChaos: 0, rhythmicImpulse: 0, macroMomentum: 0 },
        beatDecay: 0, denseImpactFlash: 0,
        directorOutput: { state: 'IDLE', centripetalOrbit: 0, glitchIntensity: 0, invertBackground: false }
    };
}

/** The host may set exactly these Advanced boosts as Grain material presentation. */
const GRAIN_MATERIAL_BOOST_KEYS: readonly GrainMaterialBoostKey[] = ['wormholeNebulaAmount', 'wormholeNebulaDetail',
    'wormholeNebulaBloom', 'wormholeNebulaWeave', 'wormholeSpiral', 'wormholeSpiralArms', 'wormholeGrainDensity'];

/** One simulation owner, independent of canvas, cadence, asset IO and host globals.
 * The host passes unboosted controls, an explicit policy and already resolved preset assets.
 * This preserves preview history behavior; it is not yet an exact-frame sampler (T05c).
 */
export class WormholeFrameContext {
    state!: WormholeRenderState;
    identity!: CosmicWormholeIdentity;
    private readonly rawTuning: VisualTuningConfig;
    private readonly macros;
    private readonly boosts;
    private readonly policy: WormholeContextSeed['policy'];
    private spiralDirection: CanvasVisualPresentation['spiralDirection'] = 'auto';
    private cosmos: NonNullable<CanvasVisualPresentation['cosmos']> = {};
    private wall: WormholeWallPresentation | null = null;
    private readonly wallPresetGates=new Map<string,boolean>();
    private denseEvents: { time: number }[] = [];
    activePreset = '';
    private director = new VisualDirectorFSM();
    private resolver = new SemanticResolver();
    private semanticBase = cloneDefaultVisualTuning();
    private semantic = new SemanticRuntimeAdapter(this.resolver, () => this.semanticBase);
    private choreography: VisualChoreographyPlan | null = null;
    private motifRuntime = new MotifRuntimeAdapter();
    private semanticProjection = new SemanticTuningProjection();
    private plan: PerformanceAutomationPlan | null = null;
    private analysis: VisualAnalysisSnapshot | null = null;
    /** Borrowed immutable host publication; asset data is copied separately at preparation. */
    get performancePlan(): PerformanceAutomationPlan | null { return this.plan; }
    private presets = new Map<string, unknown>();
    private finiteRevisionApplied = -1;
    private lastPoint: PerformanceAutomationPoint | null = null;
    private readonly boosted = cloneDefaultVisualTuning();
    private readonly boostedBase = cloneDefaultVisualTuning();
    private readonly finiteAutomation = new AutomationTuningTimeline();
    private readonly spiralAutomation = new WormholeSpiralAutomation();
    private readonly spiralPreset = (name: string) => this.presets.get(name);
    private readonly resolveSpiralTuning = (raw: typeof this.boosted, out: typeof this.boosted) => this.resolveTuning(raw, out);

    constructor(seed: WormholeContextSeed) {
        if (seed.version !== 1) throw new Error('Unsupported Wormhole context seed');
        this.rawTuning = { ...seed.rawTuning };
        this.macros = { ...seed.macros };
        this.boosts = { ...defaultAdvancedBoosts(), ...seed.boosts };
        this.policy = { ...seed.policy };
        this.prepare(null);
    }

    /** Analysis is a borrowed immutable publication; live frame/features are copied before mutation. */
    prepare(analysis: VisualAnalysisSnapshot | null): void {
        this.analysis = analysis;
        this.spiralAutomation.invalidate(); this.finiteAutomation.invalidate();
        this.state = emptyState();
        if (analysis) Object.assign(this.state, analysis);
        this.identity = new CosmicWormholeIdentity(this.state);
        if(this.cosmos.sky!==undefined)this.identity.setSkyboxEnabled(this.cosmos.sky>0);
        this.director = new VisualDirectorFSM();
        this.resolver = new SemanticResolver();
        this.resolver.setPlan(analysis?.trackAnalysis.externalVisualScorePlan ?? null);
        this.semanticBase = { ...this.rawTuning };
        this.semantic = new SemanticRuntimeAdapter(this.resolver, () => this.semanticBase);
        this.plan = null; this.presets.clear(); this.wallPresetGates.clear(); this.lastPoint = null;
        this.motifRuntime = new MotifRuntimeAdapter(); this.semanticProjection = new SemanticTuningProjection();
        this.denseEvents = this.state.events.filter(event => event.type === 2);
        this.choreography = analysis && this.policy.semanticResolver
            ? processChoreography(generateIntents(buildNarrative(analysis.trackAnalysis)), analysis.trackAnalysis) : null;
        Object.assign(this.state.targetTuning, this.rawTuning);
        this.resolveTuning(this.state.targetTuning, this.state.visualTuning);
        this.activePreset = '';
    }

    /** Offline sampler rewind. Keep the immutable publication and already resolved assets;
     * never refetch or regenerate a plan while sampling. Presentation controls survive rewind.
     */
    rewind(): void {
        const plan = this.plan, assets = new Map(this.presets);
        this.prepare(this.analysis);
        if(plan)this.preparePlan(plan,assets);
        else this.presets=assets;
    }

    /** Publish all required assets together, only after the adapter's preparation revision check. */
    preparePlan(plan: PerformanceAutomationPlan, assets: ReadonlyMap<string, unknown>): void {
        const presets = new Map<string, unknown>();
        for (const name of new Set(plan.points.map(point => point.preset))) {
            const asset = assets.get(name);
            if (!asset || typeof asset !== 'object') throw new Error(`Missing Wormhole preset: ${name}`);
            presets.set(name, JSON.parse(JSON.stringify(asset)));
        }
        // Same default scale projection as dashboard/MVP; keep the borrowed publication untouched.
        // Untyped/protected plans retain their exact legacy path.
        this.plan = plan.points.length > 0 && plan.points.every(isAutomaticCuePoint) ? applyMorphScale(plan, 1, { durationSec: this.analysis?.duration }) : plan;
        this.presets = presets;
        this.wallPresetGates.clear();
        for(const [name,asset] of presets)this.wallPresetGates.set(name,normalizeVisualTuningConfig(asset,this.rawTuning).wormholeOpticsEnabled>=.5);
        this.spiralAutomation.invalidate(); this.finiteAutomation.invalidate();
        this.finiteAutomation.configure(this.plan, this.spiralPreset, 0, this.resolveSpiralTuning, this.rawTuning);
        this.spiralAutomation.configure(this.plan, this.spiralPreset, 0, this.resolveSpiralTuning, this.rawTuning);
    }

    private resolveTuning(raw: VisualTuningConfig, out: VisualTuningConfig): VisualTuningConfig {
        if(this.policy.gains === 'meta')resolveMetaTuning(raw, this.macros, this.boosts, out);else Object.assign(out,raw);
        if(this.cosmos.stars!==undefined)out.wormholeStarfield=this.cosmos.stars;
        if(this.cosmos.galaxies!==undefined)out.wormholeGalaxy=this.cosmos.galaxies;
        if(this.cosmos.sky!==undefined)out.wormholeSkybox=this.cosmos.sky;
        if(this.wall?.mode==='off'){
            // Off is a numeric bypass too: no authored wall sublayer may survive a preset,
            // morph or a change from Native to Hybrid. Keep the borrowed preset untouched.
            out.wormholeWall=0;
            out.wormholeWallRefraction=0;
            out.wormholeWallCaustics=0;
            out.wormholeWallWaves=0;
            out.wormholeWallCracks=0;
        }else if(this.wall){
            const keys={amount:'wormholeWall',fringe:'wormholeWallRefraction',caustics:'wormholeWallCaustics',waves:'wormholeWallWaves',cracks:'wormholeWallCracks'} as const;
            for(const field of WORMHOLE_WALL_GAIN_FIELDS){const key=keys[field];
                const base=field==='amount'&&this.wall.mode==='on'&&out[key]<=0?1:out[key];
                out[key]=resolveAdvancedTuningValue(key,this.wall[field],base);
            }
            if(this.wall.material!=='preset')out.wormholeWallMode=this.wall.material==='mosaic'?1:0;
        }
        return out;
    }

    /** Exactly one director/modulation update per accepted frame. Only the adapter chooses dt/seek. */
    step(time: number, playing: boolean, dt: number, previous: number | null, jump: boolean, snap: boolean): void {
        const state = this.state;
        state.currentTime = time;
        state.playbackFade = playing ? Math.min(1, state.playbackFade + dt) : state.playbackFade;
        if (jump && time < (previous ?? 0)) {
            state.targetTuning = { ...this.rawTuning }; this.semanticBase = { ...this.rawTuning }; this.lastPoint = null;
        }
        this.finiteAutomation.configure(this.plan, this.spiralPreset, 0, this.resolveSpiralTuning, this.rawTuning);
        const point = findActiveAutomationPoint(this.plan, time);
        if(this.wall)this.identity.setWallEnabled(this.wall.mode==='on'||(this.wall.mode==='preset'
            &&(point?this.wallPresetGates.get(point.preset)??false:this.rawTuning.wormholeOpticsEnabled>=.5)));
        if (point && (point !== this.lastPoint || this.finiteRevisionApplied !== this.finiteAutomation.revision)) {
            if (this.policy.semanticResolver || this.policy.semanticChoreography) Object.assign(state.targetTuning, this.semanticBase);
            applyMvpWormholePreset(state.targetTuning, this.presets.get(point.preset), point);
            this.finiteAutomation.applyCanonicalTarget(point, state.targetTuning);
            this.finiteRevisionApplied = this.finiteAutomation.revision;
            this.semanticBase = { ...state.targetTuning }; this.lastPoint = point;
        }
        let semanticId: string | null = null;
        this.semantic.restoreBaseTuning(state.targetTuning);
        if (this.policy.semanticChoreography && this.resolver.hasPlan()) {
            this.motifRuntime.clear(state.targetTuning, this.semanticBase);
            semanticId = semanticScoreTransitionId(this.semantic.update(time, state.targetTuning));
        } else if (this.choreography) {
            const motif = this.motifRuntime.update(this.choreography, time, this.semanticBase, state.targetTuning);
            semanticId = motifTransitionId(motif);
        } else this.motifRuntime.clear(state.targetTuning, this.semanticBase);
        const automationId = point ? `automation:${point.id}` : '';
        state.activeVisualTransitionId = automationId && semanticId ? `${automationId}|${semanticId}` : automationId || semanticId || null;
        this.resolveTuning(state.targetTuning, this.boosted);
        if (this.spiralDirection !== 'auto') this.boosted.wormholeSpiralDirection = this.spiralDirection === 'left' ? -1 : 1;
        const projectSemantic = this.policy.semanticChoreography && this.resolver.hasPlan() || !!this.choreography?.score;
        if (projectSemantic) {
            this.resolveTuning(this.semanticBase, this.boostedBase);
            if (this.spiralDirection !== 'auto') this.boostedBase.wormholeSpiralDirection = this.spiralDirection === 'left' ? -1 : 1;
        }
        const morphTarget = projectSemantic ? this.boostedBase : this.boosted;
        this.semanticProjection.restore(state.visualTuning);
        // A player's Line stroke / Visual character change is a direct control, not a musical morph.
        if (snap) Object.assign(state.visualTuning, morphTarget);
        else applyTuningMorph(state.visualTuning, morphTarget, morphTarget.transitionSpeed, dt);
        this.finiteAutomation.apply(time, state.visualTuning, morphTarget);
        if (this.spiralDirection === 'auto' || point?.cuePlacement) {
            this.spiralAutomation.configure(this.plan, this.spiralPreset, 0, this.resolveSpiralTuning, this.rawTuning);
            this.spiralAutomation.apply(time, state.visualTuning, morphTarget);
            state.spiralTransitionAnchor = this.spiralDirection === 'auto' ? this.spiralAutomation.transitionAnchor : null;
        } else state.spiralTransitionAnchor = null;
        if (this.spiralDirection !== 'auto' && point?.cuePlacement) state.visualTuning.wormholeSpiralDirection = this.spiralDirection === 'left' ? -1 : 1;
        if (projectSemantic) this.semanticProjection.apply(state.visualTuning, this.boostedBase, this.boosted);
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
        this.activePreset = point?.preset ?? '';
    }

    setPresentation(presentation: CanvasVisualPresentation): { tuningChanged: boolean; directionChanged: boolean } {
        let tuningChanged = false, directionChanged = false;
        if(presentation.wall){
            const next={...(this.wall??DEFAULT_WORMHOLE_WALL)},p=presentation.wall;
            if(p.mode==='off'||p.mode==='preset'||p.mode==='on')next.mode=p.mode;
            if(p.material==='preset'||p.material==='membrane'||p.material==='mosaic')next.material=p.material;
            for(const field of WORMHOLE_WALL_GAIN_FIELDS){const v=p[field];if(v!==undefined&&Number.isFinite(v))next[field]=Math.max(0,Math.min(1,v));}
            if(JSON.stringify(next)!==JSON.stringify(this.wall)){this.wall=next;tuningChanged=true;}
        }
        for(const key of ['stars','galaxies','sky'] as const){
            const v=presentation.cosmos?.[key];if(v===undefined||!Number.isFinite(v))continue;
            const value=Math.min(key==='sky'?1:2,Math.max(0,v));
            if(value!==this.cosmos[key]){this.cosmos={...this.cosmos,[key]:value};tuningChanged=true;}
        }
        if (presentation.spiralDirection !== undefined) {
            const direction = presentation.spiralDirection === 'left' || presentation.spiralDirection === 'right' ? presentation.spiralDirection : 'auto';
            if (direction !== this.spiralDirection) { this.spiralDirection = direction; directionChanged = true; }
        }
        for (const key of ['intensity', 'motion', 'depth', 'detail'] as const) {
            const value = presentation.macros?.[key];
            if (value === undefined || !Number.isFinite(value)) continue;
            const clamped = Math.min(1, Math.max(0, value));
            if (clamped !== this.macros[key]) { this.macros[key] = clamped; tuningChanged = true; }
        }
        // MVP Advanced "Grain material" sliders (ADR-009 Addendum V): direct controls on the same boosts.
        for (const [key, value] of Object.entries(presentation.grainMaterial ?? {}) as [GrainMaterialBoostKey, number][]) {
            if (!GRAIN_MATERIAL_BOOST_KEYS.includes(key) || value === undefined || !Number.isFinite(value)) continue;
            const clamped = Math.min(1, Math.max(0, value));
            if (clamped !== this.boosts[key]) { this.boosts[key] = clamped; tuningChanged = true; }
        }
        const stroke = presentation.lineStroke;
        if (stroke !== undefined && Number.isFinite(stroke)) {
            const value = Math.min(1, Math.max(0, stroke));
            if (value !== this.boosts.lineWeight) { this.boosts.lineWeight = value; tuningChanged = true; }
        }
        if (tuningChanged) { this.spiralAutomation.invalidate(); this.finiteAutomation.invalidate(); }
        if(this.cosmos.sky!==undefined)this.identity.setSkyboxEnabled(this.cosmos.sky>0);
        return { tuningChanged, directionChanged };
    }

    dispose(): void {
        this.plan = null;
        this.presets.clear();
        this.spiralAutomation.invalidate(); this.finiteAutomation.invalidate();
    }
}

function lastIndexAt(entries: readonly { time: number }[], time: number): number {
    let lo = 0, hi = entries.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (entries[mid].time <= time) lo = mid + 1; else hi = mid; }
    return lo - 1;
}
