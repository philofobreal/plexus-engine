import type { VisualMode } from '../types';
import { State } from './store';

const DEFAULT_DURATION_SEC = 0.75;
export const MIN_VISUAL_MODE_TRANSITION_SEC = 0.1;
export const MAX_VISUAL_MODE_TRANSITION_SEC = 4;
let generation = 0;

export interface VisualModeChangeOptions {
    durationSec?: number;
}

/** The only runtime writer for State.visualMode. */
export function requestVisualModeChange(nextMode: VisualMode, options: VisualModeChangeOptions = {}): boolean {
    const previousMode = State.visualMode;
    if (previousMode === nextMode) return false;

    State.visualMode = nextMode;
    const canAnimate = State.isPlaying || State.isExporting;
    if (!canAnimate) {
        State.visualModeTransition = null;
        return true;
    }

    const requestedDuration = options.durationSec ?? State.targetTuning.morphDurationSec ?? DEFAULT_DURATION_SEC;
    const finiteDuration = Number.isFinite(requestedDuration) ? requestedDuration : DEFAULT_DURATION_SEC;
    const durationSec = Math.max(MIN_VISUAL_MODE_TRANSITION_SEC, Math.min(MAX_VISUAL_MODE_TRANSITION_SEC, finiteDuration));

    State.visualModeTransition = {
        generation: ++generation,
        from: previousMode,
        to: nextMode,
        startTimeSec: State.isExporting ? State.exportTime : State.currentTime,
        durationSec
    };
    return true;
}

export function clearVisualModeTransition(): void {
    State.visualModeTransition = null;
}
