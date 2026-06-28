import type {
    DramaturgyActivityLevel,
    PerformanceAutomationPlan,
    ResolvedStylePack,
    StylePacksFile,
    TrackAnalysis,
    VisualScenePlan
} from '../types';
import { buildNarrative, generateIntents, processChoreography } from '../semantics';
import { directScenes } from './choreographyDirector';
import { resolveStylePack, translateScenePlan } from './styleTranslator';
import { adaptScenePlanToPerformancePlan } from './scenePlanAdapter';

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
    return adaptScenePlanToPerformancePlan(scenePlan, pack, {
        duration: options.duration,
        activityLevel: options.activityLevel
    });
}
