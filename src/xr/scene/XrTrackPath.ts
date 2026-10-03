// The single XR track-path projection authority (ADR-009). Canonical gameplay positions stay
// renderer-independent (`notePosition`); this XR-owned shear bends them toward the Wormhole's
// authoritative focal point. Rendering (notes, floor, rails) projects through it, and XR hit testing
// un-projects strike samples through it, so rendered and judged targets can never diverge.
//
// The shear is purely lateral/vertical and a function of forward distance only, so z extents (road
// length) are preserved and the inverse is exact. Near the player (closer than
// `trackBendStartMeters`) the offset is exactly zero: the hit plane, lanes and rows never move.
// Nothing here integrates over time; the path is a pure function of the current focal point.

import { DEFAULT_STAGE_LAYOUT, SCENE_CONFIG, type XrStageLayout } from './SceneConfig';

export interface MutableVector3Like { x: number; y: number; z: number }
export interface TrackPathOffset { x: number; y: number }

const BEND_START = SCENE_CONFIG.trackBendStartMeters;
/** Historical far end (the default stage); a longer runway moves it (Addendum I). */
const DEFAULT_BEND_END = -DEFAULT_STAGE_LAYOUT.runwayFrontZMeters;
/**
 * The curve offset(u) = A * u^2 has zero slope at the bend start and slope 2A/L at the far end.
 * Choosing A = F / (1 + 2 (D - end) / L) makes that far-end tangent aim exactly at the focal point
 * F on the backdrop at distance D, before saturation.
 */
function aimGain(bendEnd: number): number {
    return 1 / (1 + 2 * (SCENE_CONFIG.backdropDistanceMeters - bendEnd) / (bendEnd - BEND_START));
}

function finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

/** Far-end displacement for a normalized focal coordinate; smoothly saturates at `maxBend`. */
export function trackBendAmplitude(focus: number, backdropHalfExtentMeters: number, maxBendMeters: number,
    bendEndMeters: number = DEFAULT_BEND_END): number {
    const raw = finiteOrZero(focus) * backdropHalfExtentMeters * aimGain(bendEndMeters);
    return maxBendMeters > 0 ? maxBendMeters * Math.tanh(raw / maxBendMeters) : 0;
}

/** Bend weight in [0, 1] for a stage-root z: 0 near the player, u^2 toward the far end. */
export function trackBendWeight(rootZ: number, bendEndMeters: number = DEFAULT_BEND_END): number {
    const u = Math.min(1, Math.max(0, (-rootZ - BEND_START) / (bendEndMeters - BEND_START)));
    return u * u;
}

/** Pure offset of a stage-root point at `rootZ` for the given far-end amplitudes. */
export function trackPathOffset(rootZ: number, amplitudeX: number, amplitudeY: number, out: TrackPathOffset,
    bendEndMeters: number = DEFAULT_BEND_END): TrackPathOffset {
    const weight = trackBendWeight(rootZ, bendEndMeters);
    out.x = amplitudeX * weight;
    out.y = amplitudeY * weight;
    return out;
}

export class XrTrackPath {
    /** Increments whenever the projection changes, so dependents re-project only then. */
    revision = 0;
    private focusXValue = 0;
    private focusYValue = 0;
    private amplitudeXValue = 0;
    private amplitudeYValue = 0;
    private readonly scratch: TrackPathOffset = { x: 0, y: 0 };
    private layout: XrStageLayout = DEFAULT_STAGE_LAYOUT;
    private bendEnd = DEFAULT_BEND_END;

    get focusX(): number { return this.focusXValue; }
    get focusY(): number { return this.focusYValue; }
    get amplitudeX(): number { return this.amplitudeXValue; }
    get amplitudeY(): number { return this.amplitudeYValue; }

    /** Applies a normalized focal point (+x right, +y up). Returns true only when the path changed. */
    setFocus(x: number, y: number): boolean {
        const fx = finiteOrZero(x), fy = finiteOrZero(y);
        if (fx === this.focusXValue && fy === this.focusYValue) return false;
        this.focusXValue = fx; this.focusYValue = fy;
        this.recompute();
        return true;
    }

    /** New stage (hit-plane distance, runway length): the far tangent re-aims at the same focal point. */
    setLayout(layout: XrStageLayout): void {
        if (layout.playfieldForwardMeters === this.layout.playfieldForwardMeters
            && layout.runwayFrontZMeters === this.layout.runwayFrontZMeters) { this.layout = layout; return; }
        this.layout = layout;
        this.bendEnd = Math.max(BEND_START + 1, -layout.runwayFrontZMeters);
        this.recompute();
    }

    /** Offset for a stage-root z (floor/rails live in root space). */
    offsetAtRootZ(rootZ: number, out: TrackPathOffset): TrackPathOffset {
        return trackPathOffset(rootZ, this.amplitudeXValue, this.amplitudeYValue, out, this.bendEnd);
    }

    /** Canonical playfield point -> rendered playfield point, in place. */
    projectPlayfieldPoint<T extends MutableVector3Like>(point: T): T {
        this.offsetAtRootZ(point.z - this.layout.playfieldForwardMeters, this.scratch);
        point.x += this.scratch.x; point.y += this.scratch.y;
        return point;
    }

    /** Rendered playfield point -> canonical playfield point, in place (exact inverse). */
    unprojectPlayfieldPoint<T extends MutableVector3Like>(point: T): T {
        this.offsetAtRootZ(point.z - this.layout.playfieldForwardMeters, this.scratch);
        point.x -= this.scratch.x; point.y -= this.scratch.y;
        return point;
    }

    private recompute(): void {
        this.amplitudeXValue = trackBendAmplitude(this.focusXValue, SCENE_CONFIG.backdropWidthMeters / 2, SCENE_CONFIG.trackMaxLateralBendMeters, this.bendEnd);
        this.amplitudeYValue = trackBendAmplitude(this.focusYValue, SCENE_CONFIG.backdropHeightMeters / 2, SCENE_CONFIG.trackMaxVerticalBendMeters, this.bendEnd);
        this.revision++;
    }

    /** Maps every sampled blade point of an XR strike attempt into canonical judging space. */
    unprojectStrike(attempt: { position: MutableVector3Like; previousPosition?: MutableVector3Like;
        basePosition?: MutableVector3Like; previousBasePosition?: MutableVector3Like }): void {
        this.unprojectPlayfieldPoint(attempt.position);
        if (attempt.previousPosition) this.unprojectPlayfieldPoint(attempt.previousPosition);
        if (attempt.basePosition) this.unprojectPlayfieldPoint(attempt.basePosition);
        if (attempt.previousBasePosition) this.unprojectPlayfieldPoint(attempt.previousBasePosition);
    }
}
