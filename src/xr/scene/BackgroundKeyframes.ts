// Beat-locked background keyframes (ADR-009 Addendum U). Pure timing policy, no Three.js / DOM:
// the expensive Wormhole raster is rendered only at keyframe times on the analyzer's beat grid
// (subdivided as finely as the measured raster cost allows, never faster than the player's update
// rate), and the GPU blends neighbouring keyframes for every display frame in between. Beats always
// land on a keyframe, so beat accents stay crisp while the work drops to a few frames per beat.

import type { VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';

/**
 * Longest keyframe gap (one beat at 120 BPM). Stays below the source's continuity gap
 * (`CONTINUITY_GAP_SEC`, 0.6 s), beyond which it would treat the step as a seek.
 */
export const MAX_KEYFRAME_INTERVAL_SEC = 0.5;
/** Beat subdivisions a keyframe grid may use (1 = on the beat, 8 = every 32nd note at 4/4). */
export const KEYFRAME_SUBDIVISIONS: readonly number[] = [1, 2, 4, 8];
/** The worker may be busy this share of the time at most; the rest is headroom for the device. */
export const KEYFRAME_BUSY_SHARE = 0.6;
/** Raster cost assumed before the first measurement (seconds). */
export const INITIAL_KEYFRAME_COST_SEC = 0.03;
/**
 * Mild forward-flight compensation between two keyframes. The identity projects with
 * fov = 2.4 x half-height; image content flows radially from the focal point as r' = r / (1 - k r)
 * with k = travel / (2.4 x R). Measured on real frames (2026-10-03), a reference radius of 200
 * world units gave the closest in-between frames; the wall radius (50) over-zooms badly.
 */
export const FLOW_REFERENCE_RADIUS = 200;
const PROJECTION_FOV_PER_HALF_HEIGHT = 2.4;
/** Same reliability rule as the chart planner (RhythmScorePlanner). */
const RELIABLE_TIMING = 0.5;
/** Raises the keyframe density only with this much headroom (avoids flapping at a boundary). */
const REFINE_MARGIN = 1.2;
const EPSILON = 1e-6;

export interface KeyframeGrid {
    /** Increasing beat times; empty when the grid is not used. */
    readonly beats: readonly number[];
    readonly reliable: boolean;
}

export const NO_KEYFRAME_GRID: KeyframeGrid = Object.freeze({ beats: Object.freeze([]) as readonly number[], reliable: false });

/** The analyzer's beat grid when it is trustworthy (confidence and at least two increasing beats). */
export function keyframeGrid(analysis: VisualAnalysisSnapshot | null): KeyframeGrid {
    const beats = analysis?.trackAnalysis?.beats ?? [];
    const confidence = analysis?.trackAnalysis?.timingConfidence?.overall ?? 0;
    const valid = beats.length >= 2 && beats.every((beat, i) => Number.isFinite(beat) && (i === 0 || beat > beats[i - 1]));
    return valid && confidence >= RELIABLE_TIMING ? { beats: beats.slice(), reliable: true } : NO_KEYFRAME_GRID;
}

/**
 * The beat subdivision for a beat of `beatSec`: the finest one whose interval still covers
 * `minIntervalSec`, never longer than `MAX_KEYFRAME_INTERVAL_SEC`. Overloaded (no subdivision is
 * slow enough): the longest allowed one. `current` adds hysteresis when refining.
 */
export function chooseSubdivision(beatSec: number, minIntervalSec: number, current?: number): number {
    if (!(beatSec > 0)) return 1;
    const allowed = KEYFRAME_SUBDIVISIONS.filter(s => beatSec / s <= MAX_KEYFRAME_INTERVAL_SEC + EPSILON);
    if (!allowed.length) return Math.ceil(beatSec / MAX_KEYFRAME_INTERVAL_SEC);
    const fitting = allowed.filter(s => beatSec / s >= minIntervalSec - EPSILON);
    const best = fitting.length ? fitting[fitting.length - 1] : allowed[0];
    if (current !== undefined && allowed.includes(current) && best > current && beatSec / best < minIntervalSec * REFINE_MARGIN) return current;
    return best;
}

/** Interval of the fixed lattice used without a reliable grid. */
export function fixedKeyframeInterval(minIntervalSec: number): number {
    return Math.min(MAX_KEYFRAME_INTERVAL_SEC, Math.max(minIntervalSec, 1 / 120));
}

function lastIndexAtOrBefore(values: readonly number[], time: number): number {
    let lo = 0, hi = values.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (values[mid] <= time + EPSILON) lo = mid + 1; else hi = mid; }
    return lo - 1;
}

/**
 * Tracks the measured raster cost and turns it into keyframe times. One instance per background;
 * deterministic for a given cost history.
 */
export class KeyframeGovernor {
    private costSec = INITIAL_KEYFRAME_COST_SEC;
    private subdivision: number | undefined;
    private lastIntervalSec = 0;

    /** Exponential average of the raster cost of finished keyframes (milliseconds in). */
    sample(renderMs: number): void {
        if (!Number.isFinite(renderMs) || renderMs <= 0) return;
        this.costSec += (renderMs / 1000 - this.costSec) * 0.25;
    }

    get averageCostSec(): number { return this.costSec; }
    /** Gap between the last two scheduled keyframes (diagnostics). */
    get intervalSec(): number { return this.lastIntervalSec; }

    /** Shortest gap the device sustains, never below the player's update-rate cap. */
    minIntervalSec(maxRateHz: number): number {
        const cap = maxRateHz > 0 && Number.isFinite(maxRateHz) ? 1 / maxRateHz : 0;
        return Math.max(cap, this.costSec / KEYFRAME_BUSY_SHARE);
    }

    reset(): void { this.subdivision = undefined; }

    /** The first keyframe strictly after `after`: on a subdivided beat with a grid, else on a fixed lattice. */
    nextKeyframe(grid: KeyframeGrid, after: number, maxRateHz: number): number {
        const minInterval = this.minIntervalSec(maxRateHz);
        const beats = grid.beats;
        let time: number;
        if (grid.reliable && beats.length >= 2) {
            const i = lastIndexAtOrBefore(beats, after);
            // Inside the grid: the beat that starts the gap. Outside: extend the edge beat length.
            const [anchor, beatSec, end] = i < 0 ? [beats[0], beats[1] - beats[0], beats[0]]
                : i >= beats.length - 1 ? [beats[beats.length - 1], beats[beats.length - 1] - beats[beats.length - 2], Infinity]
                    : [beats[i], beats[i + 1] - beats[i], beats[i + 1]];
            this.subdivision = chooseSubdivision(beatSec, minInterval, this.subdivision);
            const step = beatSec / this.subdivision;
            time = anchor + (Math.floor((after - anchor) / step + EPSILON) + 1) * step;
            if (i >= 0 && time > end - EPSILON) time = end;
            this.lastIntervalSec = step;
        } else {
            const step = fixedKeyframeInterval(minInterval);
            time = (Math.floor(after / step + EPSILON) + 1) * step;
            this.lastIntervalSec = step;
        }
        return time > after + EPSILON ? time : after + this.lastIntervalSec;
    }
}

/** Radial flow coefficient between two keyframes from their camera travel (see `FLOW_REFERENCE_RADIUS`). */
export function flowCoefficient(travelA: number, travelB: number): number {
    const delta = travelB - travelA;
    return Number.isFinite(delta) && delta > 0 ? delta / (PROJECTION_FOV_PER_HALF_HEIGHT * FLOW_REFERENCE_RADIUS) : 0;
}

/**
 * Where a frame shifted by flow `s` is sampled for an output point (both relative to the focal
 * point, in half-height units): the CPU reference of the backdrop shader. s > 0 advances a past
 * frame, s < 0 rewinds a future one.
 */
export function flowSampleScale(radius: number, s: number): number {
    return 1 / Math.max(0.2, 1 + s * radius);
}

export interface KeyframeBlend {
    /** Weight and flow of the earlier (A) and later (B) keyframe. */
    readonly weightA: number;
    readonly weightB: number;
    readonly flowA: number;
    readonly flowB: number;
}

/** Linear blend (constant apparent speed) of two keyframes at `time`, with matching flow shifts. */
export function blendKeyframes(timeA: number, timeB: number, time: number, flow: number): KeyframeBlend {
    const span = timeB - timeA;
    const w = span > 0 ? Math.min(1, Math.max(0, (time - timeA) / span)) : 1;
    return { weightA: 1 - w, weightB: w, flowA: w * flow, flowB: -(1 - w) * flow };
}
