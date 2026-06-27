import type {
    ChoreographyAction,
    ChoreographyFrame,
    NarrativeState,
    PatternPrimitive,
    VisualScorePlan
} from '../types/semantics';

const NARRATIVE_STATES = new Set<NarrativeState>([
    'EXPOSITION', 'DEVELOPMENT', 'TENSION_PEAK', 'RELEASE_VALLEY', 'CODA'
]);
const PATTERN_PRIMITIVES = new Set<PatternPrimitive>([
    'CLUSTER', 'FLOW', 'EXPLOSION', 'ORBIT', 'GRID'
]);
const CHOREOGRAPHY_ACTIONS = new Set<ChoreographyAction>([
    'PULSE', 'EXPAND', 'COLLAPSE', 'ORBIT', 'JITTER', 'FLOW', 'GRID_LOCK'
]);
const RHYTHMIC_SOURCES = new Set(['KICK', 'SNARE', 'OFFBEAT', 'BAR', 'NONE'] as const);
const RHYTHMIC_REACTIONS = new Set(['IMPULSE', 'IMPULSE_REVERSE', 'ACCENT', 'SUPPRESS'] as const);
const TRANSITION_TYPES = new Set(['CUT', 'MORPH', 'DISSOLVE', 'INVERT'] as const);
export const VISUAL_SCORE_VERSION = '1.0' as const;
export const MAX_VISUAL_SCORE_FRAMES = 100_000;

/** Validates and snapshots an untrusted ADR-004 payload. Invalid plans are rejected atomically. */
export function normalizeVisualScorePlan(input: unknown): VisualScorePlan | null {
    if (!isRecord(input)
        || input.version !== VISUAL_SCORE_VERSION
        || typeof input.trackHash !== 'string'
        || !Array.isArray(input.frames)
        || input.frames.length > MAX_VISUAL_SCORE_FRAMES) return null;

    const frames: ChoreographyFrame[] = [];
    for (const candidate of input.frames) {
        const frame = normalizeFrame(candidate);
        if (!frame) return null;
        frames.push(frame);
    }

    return { version: input.version, trackHash: input.trackHash, frames };
}

function normalizeFrame(input: unknown): ChoreographyFrame | null {
    if (!isRecord(input)
        || !isNonNegativeFinite(input.timeSec)
        || !isNonNegativeFinite(input.durationSec)
        || !isMember(input.narrativeState, NARRATIVE_STATES)
        || !isMember(input.primaryPattern, PATTERN_PRIMITIVES)
        || !isRecord(input.actions)
        || !isRecord(input.motion)
        || !Number.isFinite(input.confidence)) return null;

    const actions: Partial<Record<ChoreographyAction, number>> = {};
    for (const [rawAction, rawValue] of Object.entries(input.actions)) {
        if (!isMember(rawAction, CHOREOGRAPHY_ACTIONS) || !Number.isFinite(rawValue)) return null;
        actions[rawAction] = rawValue as number;
    }

    const variation = input.motion.variation;
    if (!Number.isFinite(input.motion.speed)
        || !Number.isFinite(input.motion.complexity)
        || !isRecord(variation)
        || !Number.isFinite(variation.seed)
        || !isNonNegativeInteger(variation.phraseIndex)
        || !isNonNegativeInteger(variation.variationIndex)) return null;

    const frame: ChoreographyFrame = {
        timeSec: input.timeSec,
        durationSec: input.durationSec,
        narrativeState: input.narrativeState,
        primaryPattern: input.primaryPattern,
        actions,
        motion: {
            speed: input.motion.speed as number,
            complexity: input.motion.complexity as number,
            variation: {
                seed: variation.seed as number,
                phraseIndex: variation.phraseIndex,
                variationIndex: variation.variationIndex
            }
        },
        confidence: input.confidence as number
    };

    if (input.beatIndex !== undefined) {
        if (!isNonNegativeInteger(input.beatIndex)) return null;
        frame.beatIndex = input.beatIndex;
    }

    if (input.rhythmicLink !== undefined) {
        if (!isRecord(input.rhythmicLink)
            || !isMember(input.rhythmicLink.source, RHYTHMIC_SOURCES)
            || !isMember(input.rhythmicLink.reaction, RHYTHMIC_REACTIONS)
            || !Number.isFinite(input.rhythmicLink.strength)) return null;
        frame.rhythmicLink = {
            source: input.rhythmicLink.source,
            reaction: input.rhythmicLink.reaction,
            strength: input.rhythmicLink.strength as number
        };
    }

    if (input.transition !== undefined) {
        if (!isRecord(input.transition)
            || !isMember(input.transition.type, TRANSITION_TYPES)
            || !isNonNegativeFinite(input.transition.durationSec)) return null;
        frame.transition = {
            type: input.transition.type,
            durationSec: input.transition.durationSec
        };
    }

    return frame;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isMember<T extends string>(value: unknown, values: ReadonlySet<T>): value is T {
    return typeof value === 'string' && values.has(value as T);
}
