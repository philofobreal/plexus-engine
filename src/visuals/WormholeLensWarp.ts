/**
 * Pure, screen-space gravitational lens warp for the wormhole background layers (true-lens plan,
 * F1). This is a closed-form point-mass *forward* mapping (source position -> image position),
 * not a sink: a background point never falls into the lens center. As its true (unwarped) distance
 * from the lens center `beta` shrinks toward zero, its image is pushed *out* to the Einstein radius
 * (`radius`), never collapsed onto the center -- this is what lets the Einstein ring emerge from
 * real background light instead of needing to be hand-drawn as a separate layer. Every function
 * here is a deterministic function of its numeric arguments; none allocates, none reads
 * route/camera/State.
 */

/** theta+(beta) = 0.5 * (beta + sqrt(beta^2 + 4*thetaE^2)) -- the standard point-mass lens primary
 *  image position, in screen pixels. Always >= thetaE (the ring radius), and theta+(beta) -> beta
 *  as beta grows far past thetaE (weak lensing far from the throat looks unperturbed). */
function primaryImageRadius(beta: number, thetaE: number): number {
    return 0.5 * (beta + Math.sqrt(beta * beta + 4 * thetaE * thetaE));
}

/** |theta-(beta)| = 0.5 * (sqrt(beta^2 + 4*thetaE^2) - beta) -- the point-mass lens secondary
 *  image's *magnitude* (its true position sits on the opposite side of the axis from the source,
 *  a sign callers apply themselves, not this function). Always in `(0, thetaE]`: exactly `thetaE`
 *  at `beta=0` (mirroring theta+'s own value there) and shrinking toward 0 as `beta` grows -- the
 *  secondary image lives entirely inside the ring and vanishes far from the axis, the opposite of
 *  theta+, which never gets smaller than `thetaE`. */
function secondaryImageMagnitude(beta: number, thetaE: number): number {
    return 0.5 * (Math.sqrt(beta * beta + 4 * thetaE * thetaE) - beta);
}

/** Floor on `beta` (as a fraction of the lens radius) used only to keep the direction unit vector
 *  well-defined as a source approaches dead-center: since `beta=0` exactly means `dx=dy=0`, the
 *  output there is `0 * s` regardless of how large `s` gets, so this floor does not change *where*
 *  the point ends up (still exactly the lens center at `beta=0`) -- it only keeps `s` itself finite
 *  in that neighborhood so the transition into it is a smooth ramp rather than an unguarded 0/0. */
const LENS_BETA_FLOOR_RATIO = 1e-6;

/** Caps the swirl rotation angle's own falloff term, so a point sampled exactly at the lens
 *  center never spins through an excessive number of turns -- the radial mapping already sends
 *  such a point out to the ring regardless of the swirl angle applied to it, so this cap is a
 *  predictability/testability guard, not a visually load-bearing one. */
const LENS_SWIRL_FALLOFF_CAP = 6;

/** Upper bound on the magnification gain (added on top of the baseline `1` at call sites, i.e.
 *  `1 + gain`), reached whenever a source's true position sits at or very near the lens axis
 *  (`beta -> 0`), where the true point-mass magnification is unbounded (the caustic). */
const LENS_MAGNIFICATION_MAX_GAIN = 2.5;

/** Floor on the magnification denominator `1 - (thetaE/theta+)^4`, which is exactly 0 at beta=0.
 *  Without this floor the raw magnification would divide by zero there; `LENS_MAGNIFICATION_MAX_GAIN`
 *  clamps the result regardless, so this floor only needs to keep the intermediate value finite. */
const LENS_MAGNIFICATION_DENOMINATOR_FLOOR = 1e-3;

/** Upper bound on the secondary image's gain, used directly as its alpha multiplier (it has no
 *  unmagnified baseline to add on top of -- the secondary image does not exist without lensing).
 *  Deliberately lower than `LENS_MAGNIFICATION_MAX_GAIN`: a real secondary image is always fainter
 *  than the primary. */
const LENS_SECONDARY_MAX_GAIN = 1.2;

/** Default maximum angle (radians) a lens-warped streak's two endpoints may subtend at the lens
 *  center before the caller should split it into two segments through a warped midpoint --
 *  otherwise a streak whose source endpoints straddle the axis would draw as a straight chord
 *  cutting across the throat instead of following the ring's curvature. ~25 degrees. */
export const LENS_STREAK_CHORD_MAX_ANGLE = 25 * (Math.PI / 180);

/** Fraction of the lens radius within which `wormholeLensNearAxisVisibility` fades a point out.
 *  A point-mass forward mapping keeps a near-axis source's image magnitude close to the ring
 *  while its *direction* still comes straight from the (unwarped) source angle -- so a point
 *  passing close to the axis sweeps around the ring at an angular rate that blows up as beta
 *  shrinks, a real caustic-crossing effect a sparse discrete point/streak can only render as a
 *  frame-to-frame jump. Fading it out in this narrow band hides that single-sample discretization
 *  artifact instead of trying to smooth an angular rate that is genuinely unbounded at beta=0. */
const LENS_AXIS_FADE_RATIO = 0.15;

const TWO_PI = Math.PI * 2;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export interface WormholeLensWarpPoint {
    x: number;
    y: number;
}

/**
 * Warps a projected screen point `(px, py)` around lens center `(cx, cy)` with the given
 * `radius` (the Einstein radius `thetaE`), `strength` (0-1, clamped) and `swirl` (signed
 * rotation-angle scale). Writes into the caller-owned `out` object (zero allocation) and returns
 * it. `strength <= 0` or `radius <= 0` is an exact identity pass-through -- a disabled lens must
 * not perturb geometry at all, and this doubles as the fast path when the lens is off.
 *
 * The radial mapping is `mappedR = lerp(beta, theta+(beta), strength)`, where `beta` is the
 * point's true (unwarped) distance from the lens center and `theta+` is the point-mass lens's
 * primary-image radius. At `strength=1` every point images at its full lensed position
 * (`theta+ >= thetaE`, so nothing ever lands inside the ring); at `strength=0`, `mappedR == beta`
 * exactly, an identity. Direction is preserved via `dx/beta, dy/beta` (implemented as a shared
 * scale factor `mappedR/betaSafe` multiplying `dx, dy` directly, never trigonometry, so it stays
 * numerically exact when `swirl=0`); `betaSafe` floors `beta` only to avoid a literal 0/0 when
 * dividing, not to change the mapped position (`dx=dy=0` there anyway, so the output is the lens
 * center regardless of how the floored scale factor is computed).
 */
export function wormholeLensWarpPoint(
    px: number,
    py: number,
    cx: number,
    cy: number,
    radius: number,
    strength: number,
    swirl: number,
    out: WormholeLensWarpPoint
): WormholeLensWarpPoint {
    const safePx = Number.isFinite(px) ? px : 0;
    const safePy = Number.isFinite(py) ? py : 0;
    const safeCx = Number.isFinite(cx) ? cx : 0;
    const safeCy = Number.isFinite(cy) ? cy : 0;
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
    const safeStrength = clamp01(strength);

    if (safeRadius <= 0 || safeStrength <= 0) {
        out.x = safePx;
        out.y = safePy;
        return out;
    }

    const safeSwirl = Number.isFinite(swirl) ? swirl : 0;
    const dx = safePx - safeCx;
    const dy = safePy - safeCy;
    const beta = Math.sqrt(dx * dx + dy * dy);
    const betaSafe = Math.max(beta, safeRadius * LENS_BETA_FLOOR_RATIO);
    const thetaPlus = primaryImageRadius(betaSafe, safeRadius);
    const mappedR = betaSafe + (thetaPlus - betaSafe) * safeStrength;
    const s = mappedR / betaSafe;
    const rx = dx * s;
    const ry = dy * s;

    if (safeSwirl === 0) {
        out.x = safeCx + rx;
        out.y = safeCy + ry;
        return out;
    }

    const falloff = (safeRadius * safeRadius) / (betaSafe * betaSafe);
    const swirlAngle = safeSwirl * Math.min(falloff, LENS_SWIRL_FALLOFF_CAP);
    const cosA = Math.cos(swirlAngle);
    const sinA = Math.sin(swirlAngle);
    out.x = safeCx + rx * cosA - ry * sinA;
    out.y = safeCy + rx * sinA + ry * cosA;
    return out;
}

/**
 * Magnification gain for background material at true (unwarped) squared distance `d2` from the
 * lens center -- the exact point-mass lens magnification `mu+ = 1 / |1 - (thetaE/theta+)^4|`,
 * minus its unmagnified baseline of 1, clamped to `[0, LENS_MAGNIFICATION_MAX_GAIN]`. This is
 * largest for sources near the lens axis (`d2 -> 0`) and fades to 0 for sources far from it
 * (`theta+ -> beta`, so the ratio -> 0) -- call sites read this from each point's own *pre-warp*
 * position, so it is exactly the sources that get lensed to sit near the Einstein ring that also
 * carry the largest gain here: the two effects compound into a bright ring on screen even though
 * this function's own peak (in its `d2` argument) sits at the axis, not at `radius`.
 */
export function wormholeLensMagnificationGain(d2: number, radius: number, strength: number): number {
    const safeD2 = Number.isFinite(d2) && d2 > 0 ? d2 : 0;
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
    const safeStrength = clamp01(strength);
    if (safeRadius <= 0 || safeStrength <= 0) return 0;

    const beta = Math.sqrt(safeD2);
    const thetaPlus = primaryImageRadius(beta, safeRadius);
    const ratio = safeRadius / thetaPlus;
    const ratio4 = ratio * ratio * ratio * ratio;
    const denominator = Math.max(1 - ratio4, LENS_MAGNIFICATION_DENOMINATOR_FLOOR);
    const gain = (1 / denominator - 1) * safeStrength;
    return Math.min(LENS_MAGNIFICATION_MAX_GAIN, Math.max(0, gain));
}

/**
 * Warps a projected screen point into the point-mass lens's *secondary* image position -- the
 * fainter, inverted image that fills the throat's interior with the lensed background, sitting on
 * the opposite side of the lens center from the true (unwarped) source. Same signature and
 * zero-allocation caller-owned `out` contract as `wormholeLensWarpPoint`, but the mapping itself
 * differs in two ways beyond the sign flip: there is no "off" position equal to the raw source
 * (the secondary image simply does not exist without lensing, so `strength<=0`/`radius<=0` lands
 * exactly on the lens center, not on `(px, py)`), and its magnitude is `lerp(0, |theta-(beta)|,
 * strength)` rather than starting from `beta` itself. The swirl rotation is applied with the
 * opposite sign from the primary mapping -- an artistic choice (like all swirl in this module, it
 * is a stylistic azimuthal embellishment layered on top of the physically-derived radial term, not
 * part of the point-mass lens equations themselves), giving the secondary image's own faint arcs a
 * counter-rotating, "looking back through the throat" read distinct from the ring's swirl.
 */
export function wormholeLensSecondaryPoint(
    px: number,
    py: number,
    cx: number,
    cy: number,
    radius: number,
    strength: number,
    swirl: number,
    out: WormholeLensWarpPoint
): WormholeLensWarpPoint {
    const safePx = Number.isFinite(px) ? px : 0;
    const safePy = Number.isFinite(py) ? py : 0;
    const safeCx = Number.isFinite(cx) ? cx : 0;
    const safeCy = Number.isFinite(cy) ? cy : 0;
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
    const safeStrength = clamp01(strength);

    if (safeRadius <= 0 || safeStrength <= 0) {
        out.x = safeCx;
        out.y = safeCy;
        return out;
    }

    const safeSwirl = Number.isFinite(swirl) ? swirl : 0;
    const dx = safePx - safeCx;
    const dy = safePy - safeCy;
    const beta = Math.sqrt(dx * dx + dy * dy);
    const betaSafe = Math.max(beta, safeRadius * LENS_BETA_FLOOR_RATIO);
    const mappedMagnitude = secondaryImageMagnitude(betaSafe, safeRadius) * safeStrength;
    const s = -mappedMagnitude / betaSafe;
    const rx = dx * s;
    const ry = dy * s;

    if (safeSwirl === 0) {
        out.x = safeCx + rx;
        out.y = safeCy + ry;
        return out;
    }

    const falloff = (safeRadius * safeRadius) / (betaSafe * betaSafe);
    const swirlAngle = -safeSwirl * Math.min(falloff, LENS_SWIRL_FALLOFF_CAP);
    const cosA = Math.cos(swirlAngle);
    const sinA = Math.sin(swirlAngle);
    out.x = safeCx + rx * cosA - ry * sinA;
    out.y = safeCy + rx * sinA + ry * cosA;
    return out;
}

/**
 * Brightness gain for the secondary image at true (unwarped) squared distance `d2` from the lens
 * center, used directly as its alpha multiplier (unlike `wormholeLensMagnificationGain`, there is
 * no baseline `1` to add it to). Exact point-mass magnification `1 / |1 - (thetaE/theta-)^4|`,
 * clamped to `[0, LENS_SECONDARY_MAX_GAIN]`: largest near the axis (`d2 -> 0`, matching
 * `wormholeLensSecondaryPoint`'s own magnitude peaking at `thetaE` there) and fading to 0 far from
 * it, since `theta- -> 0` makes the ratio -- and with it the magnification -- diverge in the
 * opposite direction from the primary image's.
 */
export function wormholeLensSecondaryGain(d2: number, radius: number, strength: number): number {
    const safeD2 = Number.isFinite(d2) && d2 > 0 ? d2 : 0;
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
    const safeStrength = clamp01(strength);
    if (safeRadius <= 0 || safeStrength <= 0) return 0;

    const beta = Math.sqrt(safeD2);
    const thetaMinusMag = Math.max(
        secondaryImageMagnitude(beta, safeRadius), safeRadius * LENS_BETA_FLOOR_RATIO
    );
    const ratio = safeRadius / thetaMinusMag;
    const ratio4 = ratio * ratio * ratio * ratio;
    const denominator = Math.max(ratio4 - 1, LENS_MAGNIFICATION_DENOMINATOR_FLOOR);
    const gain = (1 / denominator) * safeStrength;
    return Math.min(LENS_SECONDARY_MAX_GAIN, Math.max(0, gain));
}

/**
 * Visibility fade in `[0, 1]` for a point at true (unwarped) distance `beta` from the lens
 * center: `0` at `beta=0`, ramping linearly to `1` by `LENS_AXIS_FADE_RATIO * radius`. Intended
 * to multiply a lens-warped point's own alpha, not to gate the warp itself -- `wormholeLensWarpPoint`
 * remains well-defined at `beta=0` regardless of whether a caller applies this fade.
 */
export function wormholeLensNearAxisVisibility(beta: number, radius: number): number {
    const safeBeta = Number.isFinite(beta) && beta > 0 ? beta : 0;
    const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
    if (safeRadius <= 0) return 1;
    return clamp01(safeBeta / (safeRadius * LENS_AXIS_FADE_RATIO));
}

/**
 * True if two already-warped screen points `(ax, ay)` and `(bx, by)` subtend an angle greater
 * than `maxAngle` as seen from the lens center `(cx, cy)` -- the signal a caller uses to decide
 * whether a streak between them needs a warped midpoint split, since drawing it as one straight
 * chord would visibly cut across the throat instead of following the ring's curvature. Pure
 * angle comparison, no allocation.
 */
export function wormholeLensChordExceedsAngle(
    cx: number,
    cy: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    maxAngle: number
): boolean {
    const angleA = Math.atan2(ay - cy, ax - cx);
    const angleB = Math.atan2(by - cy, bx - cx);
    let diff = angleB - angleA;
    if (diff > Math.PI) diff -= TWO_PI;
    else if (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) > maxAngle;
}
