import type { VisualTuningConfig } from '../types';
import type {
    ChoreographyAction,
    ChoreographyFrame
} from '../types/semantics';
import { NeutralSemanticStyleMapper, type SemanticStyleMapper } from './mapper';
import { normalizeVisualScorePlan } from './visualScoreValidation';

const SCORE_ACTIONS: readonly ChoreographyAction[] = [
    'PULSE', 'EXPAND', 'COLLAPSE', 'ORBIT', 'JITTER', 'FLOW', 'GRID_LOCK'
];

export interface SemanticResolveResult {
    current: ChoreographyFrame;
    next: ChoreographyFrame | null;
    progress: number;
    narrativeState: ChoreographyFrame['narrativeState'];
    primaryPattern: ChoreographyFrame['primaryPattern'];
    actions: Record<ChoreographyAction, number>;
    motion: ChoreographyFrame['motion'];
    confidence: number;
    tuningDeltas: Partial<VisualTuningConfig>;
}

/** Deterministic, side-effect-free output semantics; cursor mutation is an internal lookup cache only. */
export class SemanticResolver {
    private frames: ChoreographyFrame[] = [];
    private cursor = 0;
    private readonly mapper: SemanticStyleMapper;

    constructor(mapper: SemanticStyleMapper = new NeutralSemanticStyleMapper()) {
        this.mapper = mapper;
    }

    setPlan(plan: unknown): void {
        const normalized = normalizeVisualScorePlan(plan);
        this.frames = normalized ? normalized.frames.sort((a, b) => a.timeSec - b.timeSec) : [];
        this.cursor = 0;
    }

    hasPlan(): boolean {
        return this.frames.length > 0;
    }

    resolve(timeSec: number): SemanticResolveResult | null {
        if (!Number.isFinite(timeSec) || this.frames.length === 0) return null;

        this.cursor = this.findFrameIndex(timeSec);
        const current = this.frames[this.cursor];
        const next = this.frames[this.cursor + 1] ?? null;
        if (!isFrameActive(current, next, timeSec)) return null;

        const progress = next && current.transition?.type !== 'CUT'
            ? transitionProgress(timeSec, current)
            : 0;
        const resolvedFrame = next && progress >= 1 ? next : current;
        const actions = zeroDefaultActions(current.actions, next?.actions, progress);
        const motion = {
            speed: clamp01(interpolate(current.motion.speed, next?.motion.speed, progress)),
            complexity: clamp01(interpolate(current.motion.complexity, next?.motion.complexity, progress)),
            variation: current.motion.variation
        };
        const confidence = clamp01(interpolate(current.confidence, next?.confidence, progress));
        const tuningDeltas = this.mapper.map({
            narrativeState: resolvedFrame.narrativeState,
            primaryPattern: resolvedFrame.primaryPattern,
            actions,
            motion,
            confidence
        });

        return {
            current,
            next,
            progress,
            narrativeState: resolvedFrame.narrativeState,
            primaryPattern: resolvedFrame.primaryPattern,
            actions,
            motion,
            confidence,
            tuningDeltas
        };
    }

    private findFrameIndex(timeSec: number): number {
        const current = this.frames[this.cursor];
        const next = this.frames[this.cursor + 1];
        if (current && timeSec >= current.timeSec && (!next || timeSec < next.timeSec)) return this.cursor;
        if (next && timeSec >= next.timeSec) {
            const afterNext = this.frames[this.cursor + 2];
            if (!afterNext || timeSec < afterNext.timeSec) return this.cursor + 1;
        }

        let low = 0;
        let high = this.frames.length - 1;
        let found = 0;
        while (low <= high) {
            const middle = (low + high) >>> 1;
            if (this.frames[middle].timeSec <= timeSec) {
                found = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }
        return found;
    }
}

function zeroDefaultActions(
    current: ChoreographyFrame['actions'],
    next: ChoreographyFrame['actions'] | undefined,
    progress: number
): Record<ChoreographyAction, number> {
    const output = {} as Record<ChoreographyAction, number>;
    for (const action of SCORE_ACTIONS) {
        output[action] = clamp01(interpolate(current[action] ?? 0, next?.[action] ?? 0, progress));
    }
    return output;
}

function isFrameActive(current: ChoreographyFrame, next: ChoreographyFrame | null, timeSec: number): boolean {
    if (timeSec < current.timeSec) return false;
    const durationSec = finiteNonNegative(current.durationSec);
    const frameEnd = current.timeSec + durationSec;
    const activeUntil = next ? Math.min(frameEnd, next.timeSec) : frameEnd;
    return timeSec < activeUntil;
}

function transitionProgress(timeSec: number, current: ChoreographyFrame): number {
    const configuredDuration = current.transition?.durationSec;
    const durationSec = finiteNonNegative(configuredDuration ?? current.durationSec);
    if (durationSec === 0) return 1;
    return clamp01((timeSec - current.timeSec) / durationSec);
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function interpolate(current: number, next: number | undefined, progress: number): number {
    const from = Number.isFinite(current) ? current : 0;
    const to = typeof next === 'number' && Number.isFinite(next) ? next : from;
    return from + (to - from) * progress;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}
