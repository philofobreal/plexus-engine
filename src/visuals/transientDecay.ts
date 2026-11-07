// Rates retain their 60 Hz reference meaning; rendering cadence never advances musical time.
import type { BeatEvent, VisualCueEvent } from '../types';

export const BEAT_DECAY_PER_FRAME = 0.88;
export const DENSE_IMPACT_DECAY_PER_FRAME = 0.85;
export const CUE_DECAY_PER_FRAME = 0.9;
const REFERENCE_FRAMES_PER_SEC = 60;

/** Closed-form decay of a transient triggered `elapsedSec` ago, at the 60 fps reference rate. */
export function transientDecayAfter(perFrame: number, elapsedSec: number): number {
    return Math.pow(perFrame, Math.max(0, elapsedSec) * REFERENCE_FRAMES_PER_SEC + 1);
}

/** Incremental decay (unlike a newly triggered transient, this adds no initial reference tick). */
export function decayOverSeconds(perFrame: number, deltaSec: number): number {
    return Math.pow(perFrame, Math.max(0, Number.isFinite(deltaSec) ? deltaSec : 0) * REFERENCE_FRAMES_PER_SEC);
}

/** Unit-per-second presentation envelope. Pause fading is a host presentation policy only. */
export function advancePlaybackFade(fade: number, active: boolean, deltaSec: number, fadeWhenPaused = false): number {
    const dt = Math.max(0, Number.isFinite(deltaSec) ? deltaSec : 0);
    return active ? Math.min(1, fade + dt) : fadeWhenPaused ? Math.max(0, fade - dt) : fade;
}

/** Exact integral of the linear fade, including its saturation, in legacy 60 Hz rotation units. */
export function integratedFadeFrames(fade: number, active: boolean, deltaSec: number): number {
    const dt = Math.max(0, Number.isFinite(deltaSec) ? deltaSec : 0);
    const ramp = Math.min(dt, active ? 1 - fade : fade);
    return 60 * (ramp * (fade + (active ? ramp : -ramp) / 2) + (active ? dt - ramp : 0));
}

function indexAt(entries: readonly { time: number }[], time: number): number {
    let lo = 0, hi = entries.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (entries[mid].time <= time) lo = mid + 1; else hi = mid; }
    return lo - 1;
}

/** Immutable publications in, one reused sample out. O(log n) seeks, no event replay or DSP.
 * Cue peaks preserve the host's max-envelope law, including overlapping weaker cues.
 * Rebuild only when publication identity changes; modifying a published array is unsupported.
 */
export class VisualTransientSampler {
    private events: readonly BeatEvent[] | null = null;
    private cues: readonly VisualCueEvent[] | null = null;
    private dense: readonly BeatEvent[] = [];
    private peaks: number[] = [];
    private readonly result = { beat: 0, dense: 0, cue: 0 };

    sample(events: readonly BeatEvent[], cues: readonly VisualCueEvent[], time: number) {
        if (events !== this.events) { this.events = events; this.dense = events.filter(e => e.type === 2); }
        if (cues !== this.cues) {
            this.cues = cues; this.peaks = new Array(cues.length);
            for (let i = 0; i < cues.length; i++) this.peaks[i] = Math.max(cues[i].intensity,
                i ? this.peaks[i - 1] * decayOverSeconds(CUE_DECAY_PER_FRAME, cues[i].time - cues[i - 1].time) : 0);
        }
        const beat = events[indexAt(events, time)], dense = this.dense[indexAt(this.dense, time)];
        const ci = indexAt(cues, time), cue = cues[ci];
        this.result.beat = beat ? transientDecayAfter(BEAT_DECAY_PER_FRAME, time - beat.time) : 0;
        this.result.dense = dense ? transientDecayAfter(DENSE_IMPACT_DECAY_PER_FRAME, time - dense.time) : 0;
        this.result.cue = cue ? this.peaks[ci] * transientDecayAfter(CUE_DECAY_PER_FRAME, time - cue.time) : 0;
        return this.result;
    }
}
