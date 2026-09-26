// Shared visual transient decay rates. PlexusRenderer applies them once per rendered frame;
// seek-safe hosts without per-frame event consumption (WormholeCanvasSource) evaluate the same
// rates in closed form against the 60 fps reference, so both hosts share one set of constants.

export const BEAT_DECAY_PER_FRAME = 0.88;
export const DENSE_IMPACT_DECAY_PER_FRAME = 0.85;
export const CUE_DECAY_PER_FRAME = 0.9;
const REFERENCE_FRAMES_PER_SEC = 60;

/** Closed-form decay of a transient triggered `elapsedSec` ago, at the 60 fps reference rate. */
export function transientDecayAfter(perFrame: number, elapsedSec: number): number {
    return Math.pow(perFrame, Math.max(0, elapsedSec) * REFERENCE_FRAMES_PER_SEC + 1);
}
