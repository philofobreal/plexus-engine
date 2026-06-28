import type {
    DramaturgyActivityLevel,
    DramaturgyVariantMode,
    PerformanceAutomationPlan,
    ResolvedStylePack,
    StylePacksFile,
    TempoContext,
    TrackAnalysis,
    VisualScenePlan
} from '../types';
import { buildNarrative, generateIntents, processChoreography } from '../semantics';
import { directScenes } from './choreographyDirector';
import { resolveStylePack, translateScenePlan } from './styleTranslator';
import { adaptScenePlanToPerformancePlan } from './scenePlanAdapter';
import { planGlobalVisualNarrative } from './globalVisualNarrative';

// visualOsPlanner - PURE Visual OS V2 orchestration (ADR-005, Phase 4). It REUSES the
// ADR-003 semantic chain as the single source of musical semantics, then runs the Visual
// OS scene-selection + style-translation + adapter stages:
//
//   TrackAnalysis
//     -> buildNarrative -> generateIntents -> processChoreography   [existing ADR-003]
//     -> directScenes (select style-permitted realizations)         [ChoreographyDirector]
//     -> translateScenePlan (renderer-independent VisualScene)      [StyleTranslator]
//     -> adaptScenePlanToPerformancePlan                            [Renderer Adapter]
//
// This module is pure and has no IO. The IO orchestrator that loads style-packs.json and
// falls back to the legacy generator lives in `visualOsPlanLoader.ts`.

export const DEFAULT_STYLE_PACK_ID = 'base-temporal';

export interface VisualOsPlanOptions {
    stylePackId?: string;
    substyle?: string;
    historyWindow?: number;
    duration?: number;
    // Dramaturgy density level (user-facing control). Forwarded to the adapter to thin or
    // expand SceneEvolution waypoints. Defaults to 'balanced'.
    activityLevel?: DramaturgyActivityLevel;
    // Variant density mode (user-facing control). Forwarded to the adapter to decide whether
    // long scenes are split into visually-distinct variant pairs. Defaults to 'paired'.
    variantMode?: DramaturgyVariantMode;
    // Inject a parsed style-packs file (tests / preloaded asset) to skip the fetch.
    stylePacksFile?: StylePacksFile;
}

// Pure: semantic chain -> director -> translator. No IO.
export function buildVisualScenePlan(
    trackAnalysis: TrackAnalysis,
    pack: ResolvedStylePack,
    options: VisualOsPlanOptions = {}
): VisualScenePlan {
    const narrative = buildNarrative(trackAnalysis);
    const intent = generateIntents(narrative);
    const choreography = processChoreography(intent, trackAnalysis);
    const scenes = directScenes({ narrative, intent, choreography }, pack, {
        substyle: options.substyle,
        historyWindow: options.historyWindow
    });
    return translateScenePlan(scenes, pack, options.substyle);
}

// Pure: full pipeline from a parsed style-packs file. Returns null if the pack cannot be
// resolved (cycle, missing parent, unknown enum), so the caller falls back to legacy.
export function buildVisualOsPerformancePlan(
    trackAnalysis: TrackAnalysis,
    file: StylePacksFile,
    options: VisualOsPlanOptions = {}
): PerformanceAutomationPlan | null {
    const packId = options.stylePackId ?? DEFAULT_STYLE_PACK_ID;
    let pack: ResolvedStylePack;
    try {
        pack = resolveStylePack(file, packId);
    } catch {
        return null;
    }
    const scenePlan = buildVisualScenePlan(trackAnalysis, pack, options);
    const globalNarrative = planGlobalVisualNarrative(scenePlan);
    return adaptScenePlanToPerformancePlan(scenePlan, pack, {
        duration: options.duration,
        activityLevel: options.activityLevel,
        variantMode: options.variantMode,
        tempo: buildTempoContext(trackAnalysis),
        trackSeed: computeTrackSeed(trackAnalysis),
        globalNarrative
    });
}

// Derive the musical timing context the Micro-Choreography planner uses to bar-snap subdivision
// and envelope phases. Pure: reads only fields off TrackAnalysis. `reliable` mirrors the legacy
// shouldUseGridTiming threshold (trust the grid unless both tempo and grid evidence are critically
// low); `confidence` is the authoritative overall timing confidence when present.
export function buildTempoContext(trackAnalysis: TrackAnalysis): TempoContext {
    const bpm = finitePositive(trackAnalysis?.bpm) ? trackAnalysis.bpm : 0;
    const bars = Array.isArray(trackAnalysis?.bars)
        ? trackAnalysis.bars.map((bar) => bar?.start).filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
        : [];
    let secondsPerBar: number | null = null;
    if (bars.length >= 2) secondsPerBar = bars[1] - bars[0];
    else if (bpm > 0) secondsPerBar = (60 / bpm) * 4;
    if (secondsPerBar !== null && !(secondsPerBar > 0)) secondsPerBar = null;

    const gridConf = finiteOr(trackAnalysis?.gridConfidence, 1);
    const bpmConf = finiteOr(trackAnalysis?.bpmConfidence, 1);
    const reliable = gridConf >= 0.15 || bpmConf >= 0.20;
    const overall = trackAnalysis?.timingConfidence?.overall;
    const confidence = clamp01(typeof overall === 'number' && Number.isFinite(overall) ? overall : Math.min(gridConf, bpmConf));

    return { bpm, secondsPerBar, gridOffset: finiteOr(trackAnalysis?.gridOffset, 0), bars, reliable, confidence };
}

// Stable per-track seed (no runtime randomness): a small integer hash of tempo, duration and
// section count. Identical analysis -> identical seed -> identical plan.
export function computeTrackSeed(trackAnalysis: TrackAnalysis): number {
    const bpm = Math.round((finitePositive(trackAnalysis?.bpm) ? trackAnalysis.bpm : 0) * 100);
    const duration = Math.round((finitePositive(trackAnalysis?.duration) ? trackAnalysis.duration : 0) * 10);
    const sections = Array.isArray(trackAnalysis?.sections) ? trackAnalysis.sections.length : 0;
    let h = 2166136261 >>> 0; // FNV-1a-ish mix over the three integers
    for (const value of [bpm, duration, sections]) {
        h ^= value >>> 0;
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function finitePositive(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finiteOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
