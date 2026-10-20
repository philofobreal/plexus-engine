// A value carried by the displayed background frame (its focal point, its travel), continued between
// background frames at headset rate. The background redraws at 24-36 Hz while the headset draws at
// 72-90 Hz: reading such a value raw moves everything that follows it (the runway bend, the spatial
// field) in visible steps. Here each frame's value is extrapolated along its slope (the frame's own
// rate, or the slope between the last two frames) to the canonical song time being drawn, and a new
// frame takes over with a short song-time crossfade from the previous trajectory, so neither a
// late nor an early frame makes the value jump.
//
// Pure in song time: no wall clock, no frame delta. Pause holds the value (same song time, same
// output). A seek (song time far from the frame, song time or frame time stepping back) shows the
// frame's value directly.

/** Extrapolation reach beyond a frame's time; a stale frame holds instead of running away. */
export const FRAME_SIGNAL_MAX_LEAD_SEC = 0.1;
/** Song-time crossfade from the previous trajectory to a new frame's. */
export const FRAME_SIGNAL_BLEND_SEC = 0.06;
/** A frame this far from the drawn song time (or a step back) is a seek: no extrapolation history. */
export const FRAME_SIGNAL_SEEK_SEC = 0.5;

function smoothstep(x: number): number {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
}

export class XrFrameSignal {
    private frameTime = Number.NaN;
    private value = 0;
    private slope = 0;
    private prevFrameTime = Number.NaN;
    private prevValue = 0;
    private prevSlope = 0;
    private blendStart = Number.NaN;
    private lastSongTime = Number.NaN;
    private readonly maxLeadSec: number;

    constructor(maxLeadSec: number = FRAME_SIGNAL_MAX_LEAD_SEC) {
        this.maxLeadSec = maxLeadSec;
    }

    /**
     * The value at `songTime`, from the displayed frame's `value` at `frameTime`. `rate` is the
     * frame's own slope (per second) when it carries one; otherwise the slope between the last two
     * frames is used. Non-finite inputs fall back to the raw value.
     */
    sample(songTime: number, frameTime: number, value: number, rate?: number): number {
        if (!Number.isFinite(songTime) || !Number.isFinite(frameTime) || !Number.isFinite(value)) { this.reset(); return Number.isFinite(value) ? value : 0; }
        // A frame older than the one shown (a restart's first frame after a stale one) starts over too.
        const seek = !(songTime >= this.lastSongTime - 1e-6) || Math.abs(songTime - frameTime) > FRAME_SIGNAL_SEEK_SEC
            || frameTime < this.frameTime - 1e-6;
        if (frameTime !== this.frameTime || seek) {
            const known = Number.isFinite(this.frameTime) && !seek;
            const gap = frameTime - this.frameTime;
            const slope = Number.isFinite(rate) ? rate as number : known && gap > 1e-4 ? (value - this.value) / gap : 0;
            if (known) {
                // The previous trajectory starts from the value shown right now (mid-crossfade too),
                // so a frame arriving before the last blend finished never jumps.
                const shown = this.output(songTime);
                this.prevFrameTime = songTime; this.prevValue = shown; this.prevSlope = this.slope;
                this.blendStart = songTime;
            } else {
                this.blendStart = Number.NaN;
            }
            this.frameTime = frameTime; this.value = value; this.slope = Number.isFinite(slope) ? slope : 0;
        }
        this.lastSongTime = songTime;
        const shownNow = this.output(songTime);
        if (Number.isFinite(this.blendStart) && songTime - this.blendStart >= FRAME_SIGNAL_BLEND_SEC) this.blendStart = Number.NaN;
        return shownNow;
    }

    /** The current trajectory, crossfaded from the previous one while a blend runs. */
    private output(songTime: number): number {
        const current = this.at(songTime, this.frameTime, this.value, this.slope);
        if (!Number.isFinite(this.blendStart)) return current;
        const w = smoothstep((songTime - this.blendStart) / FRAME_SIGNAL_BLEND_SEC);
        const previous = this.at(songTime, this.prevFrameTime, this.prevValue, this.prevSlope);
        return previous + (current - previous) * w;
    }

    /** Forget the history (the next frame is shown as is). */
    reset(): void {
        this.frameTime = Number.NaN; this.blendStart = Number.NaN; this.lastSongTime = Number.NaN;
    }

    private at(songTime: number, frameTime: number, value: number, slope: number): number {
        const lead = Math.min(this.maxLeadSec, Math.max(-this.maxLeadSec, songTime - frameTime));
        return value + slope * lead;
    }
}
