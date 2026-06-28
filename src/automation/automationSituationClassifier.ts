import type { AutomationSituation, NarrativeType } from '../types';

// automationSituationClassifier - PURE, deterministic mapping from already-generated
// dramaturgical context to a choreographic AutomationSituation (ADR-005 extension).
//
// CRITICAL: this module NEVER derives new musical semantics from raw audio. It consumes
// ONLY the narrative/behaviour/duration that the ADR-003 semantic chain + ChoreographyDirector
// + StyleTranslator already produced. It is renderer-independent: it names no tuning key and
// no preset filename. Its single job is to classify a scene into one of a small set of
// recognizable performance situations so the variant-pair planner can pick a fitting pair.

// Scene-length thresholds (seconds). A scene shorter than SHORT_SEC reads as a hit/short
// event; LONG_SEC and VERY_LONG_SEC separate sustained sections from passing ones.
const SHORT_SEC = 12;
const LONG_SEC = 12;
const VERY_LONG_SEC = 18;

// Energy threshold separating a sustained high-energy peak from an ordinary section.
const HIGH_ENERGY = 0.62;

// What the classifier needs to know about one scene. All fields come from an existing
// VisualScene (narrative via its opaque handle, energy via behaviour, plus duration) and the
// previous scene's narrative for ordering-sensitive cases ("a drop right after a build").
export interface SituationInput {
    narrative: NarrativeType;
    energy: number;             // behaviour.energy, 0..1
    durationSec: number;
    previousNarrative?: NarrativeType | null;
}

function followsBuild(previous?: NarrativeType | null): boolean {
    return previous === 'build' || previous === 'tension';
}

// Deterministic, total function: every NarrativeType maps to a situation. The rules mirror the
// directive's examples (long high-energy drop -> drop-long, short drop -> drop-short, drop after
// a build -> drop-after-build, long low-energy section -> breakdown-long, rising build ->
// buildup-ramp, long stable groove -> groove-sustain, sustained peak -> peak-sustain).
export function classifyAutomationSituation(input: SituationInput): AutomationSituation {
    const duration = Number.isFinite(input.durationSec) ? input.durationSec : 0;
    const energy = clamp01(input.energy);

    switch (input.narrative) {
        case 'intro':
            return 'intro-establish';
        case 'outro':
            return 'outro-dissolve';
        case 'build':
        case 'tension':
            return 'buildup-ramp';
        case 'fake-drop':
            // A fake-drop is a brief lift that resolves back down: a transition, not a payoff.
            return 'transition-release';
        case 'breakdown':
            return duration >= LONG_SEC ? 'breakdown-long' : 'transition-release';
        case 'release':
            // 'release' is the dramaturgical drop. Order and length decide the flavour.
            if (followsBuild(input.previousNarrative)) return 'drop-after-build';
            return duration >= LONG_SEC ? 'drop-long' : 'drop-short';
        case 'peak':
            if (duration >= LONG_SEC && energy >= HIGH_ENERGY) return 'peak-sustain';
            if (followsBuild(input.previousNarrative)) return 'drop-after-build';
            return duration >= LONG_SEC ? 'drop-long' : 'drop-short';
        case 'groove':
        default:
            // A long, settled groove sustains; a shorter one reads as a passing verse.
            return duration >= VERY_LONG_SEC ? 'groove-sustain' : 'verse-long';
    }
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

export { SHORT_SEC, LONG_SEC, VERY_LONG_SEC };
