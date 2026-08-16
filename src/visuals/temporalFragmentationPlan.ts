/**
 * Pure, deterministic planner for the Temporal Fragmentation post effect (ADR-007).
 *
 * Everything here is a function of (song time, already-published render signals, tuning, surface
 * size). There is no cross-frame state and no runtime randomness, so seeking directly to a time
 * reproduces exactly what frame-by-frame playback produces, and an export frame at song time T
 * makes the same decisions the live renderer makes at song time T.
 *
 * Two deterministic time grids keep the accent burst-coherent instead of strobing:
 * - TOPOLOGY grid (`TOPOLOGY_SLOT_SEC`, longer than a whole burst): band boundaries and band
 *   spans. A burst therefore fragments the frame one way for its whole life.
 * - ACTIVATION grid (`ACTIVATION_STEP_SEC`, a few per burst): which bands jump and how far. The
 *   picture re-jumps a couple of times inside a burst without re-cutting itself.
 *
 * v1 displacement is X-only: source and destination rects are the same size and share the same Y
 * range, so no vertical alpha hole can appear in transparent/chroma output. Horizontal coverage is
 * closed by a wrap copy, which is why `|shiftX|` is clamped below the span width.
 */

/** Below this `glitchIntensity` the effect is fully bypassed, which bounds a burst to ~0.5 s. */
export const FRAGMENT_GATE = 0.12;
/** Band geometry lifetime. Longer than the gated burst so one burst keeps one topology. */
export const TOPOLOGY_SLOT_SEC = 0.75;
/** Re-selection rate of the moving bands inside a burst. */
export const ACTIVATION_STEP_SEC = 0.18;

export const MIN_BANDS = 3;
export const MAX_BANDS = 12;
/** Only a few fragments ever move; the rest of the frame stays a stable reference. */
export const MAX_MOVING_BANDS = 4;

/** Longest possible displacement before tuning, as a fraction of surface width. */
const MAX_SHIFT_WIDTH_FRACTION = 0.045;
const MAX_SHIFT_PX = 120;
const MIN_SHIFT_PX = 2;

const TOPOLOGY_SALT = 0x5f3a91;
const SPAN_SALT = 0x1b873d;
const ACTIVATION_SALT = 0x2c9f57;
const SHIFT_SALT = 0x7ad1e3;

/** One displaced fragment. All values are integer device pixels of the destination surface. */
export interface FragmentBand {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Signed horizontal displacement; `|shiftX| < width` so the wrap copy closes the span. */
    shiftX: number;
}

export interface TemporalFragmentationPlan {
    active: boolean;
    /** Number of populated entries in `bands`; never exceeds `MAX_MOVING_BANDS`. */
    bandCount: number;
    readonly bands: FragmentBand[];
}

export interface TemporalFragmentationInput {
    timeSec: number;
    widthPx: number;
    heightPx: number;
    /** `State.directorOutput.glitchIntensity`: the sole lifecycle owner (fast attack, fast decay). */
    glitchIntensity: number;
    /** `State.modulation.spectralChaos`: shapes fragmentation complexity only; never gates. */
    spectralChaos: number;
    /** `State.modulation.rhythmicImpulse`: bounded scale on the one-shot displacement. */
    rhythmicImpulse: number;
    amount: number;
    displacement: number;
    density: number;
}

export function createTemporalFragmentationPlan(): TemporalFragmentationPlan {
    const bands: FragmentBand[] = [];
    for (let i = 0; i < MAX_MOVING_BANDS; i++) bands.push({ x: 0, y: 0, width: 0, height: 0, shiftX: 0 });
    return { active: false, bandCount: 0, bands };
}

export function createTemporalFragmentationInput(): TemporalFragmentationInput {
    return {
        timeSec: 0,
        widthPx: 0,
        heightPx: 0,
        glitchIntensity: 0,
        spectralChaos: 0,
        rhythmicImpulse: 0,
        amount: 0,
        displacement: 0,
        density: 0
    };
}

/** Cheap gate shared by the effect's `isActive()` probe and the planner. */
export function isTemporalFragmentationActive(glitchIntensity: number, amount: number): boolean {
    return clamp01(amount) > 0 && clamp01(glitchIntensity) >= FRAGMENT_GATE;
}

/** Fills and returns `plan` in place; allocation-free after construction. */
export function planTemporalFragmentation(
    plan: TemporalFragmentationPlan,
    input: TemporalFragmentationInput
): TemporalFragmentationPlan {
    plan.active = false;
    plan.bandCount = 0;

    const width = Math.floor(input.widthPx);
    const height = Math.floor(input.heightPx);
    const amount = clamp01(input.amount);
    const strength = clamp01(input.glitchIntensity);
    if (width < 2 || height < MIN_BANDS || !isTemporalFragmentationActive(strength, amount)) return plan;
    if (!Number.isFinite(input.timeSec)) return plan;

    // 0 at the gate, 1 at the attack peak: the burst thins out as the envelope decays.
    const envelope = clamp01((strength - FRAGMENT_GATE) / (1 - FRAGMENT_GATE));
    if (envelope <= 0) return plan;

    // Topology inputs use coarse buckets so a continuously drifting signal cannot re-cut the frame
    // mid-burst; activation inputs use finer buckets but still quantize away per-frame float noise.
    const chaosTopology = quantize(input.spectralChaos, 4);
    const densityTopology = quantize(input.density, 4);
    const impulse = quantize(input.rhythmicImpulse, 16);

    const slot = Math.floor(input.timeSec / TOPOLOGY_SLOT_SEC);
    const step = Math.floor(input.timeSec / ACTIVATION_STEP_SEC);
    const topologySeed = hash32(slot, TOPOLOGY_SALT);

    const bandCount = resolveBandCount(topologySeed, densityTopology, chaosTopology);
    const movingTarget = resolveMovingCount(densityTopology, envelope, bandCount);
    const maxShift = resolveMaxShift(width, clamp01(input.displacement));

    let used = 0;
    for (let pick = 0; pick < movingTarget; pick++) {
        const index = selectUnusedBand(step, pick, bandCount, used);
        if (index < 0) break;
        used |= 1 << index;

        const top = bandTop(topologySeed, index, bandCount, height);
        const bottom = bandTop(topologySeed, index + 1, bandCount, height);
        const bandHeight = bottom - top;
        if (bandHeight <= 0) continue;

        const spanSeed = hash32(topologySeed ^ SPAN_SALT, index);
        const span = resolveSpan(spanSeed, chaosTopology, width);
        const shift = resolveShift(step, index, maxShift, amount, envelope, impulse, span.width);
        if (shift === 0) continue;

        const band = plan.bands[plan.bandCount++];
        band.x = span.x;
        band.width = span.width;
        band.y = top;
        band.height = bandHeight;
        band.shiftX = shift;
    }

    plan.active = plan.bandCount > 0;
    return plan;
}

function resolveBandCount(topologySeed: number, density: number, chaos: number): number {
    const spread = MAX_BANDS - MIN_BANDS;
    // Chaos widens the fragmentation complexity, density adds a little, the seed keeps it varied.
    const normalized = clamp01(0.15 + chaos * 0.55 + density * 0.2 + unit(hash32(topologySeed, 0x11)) * 0.2);
    return MIN_BANDS + Math.round(normalized * spread);
}

function resolveMovingCount(density: number, envelope: number, bandCount: number): number {
    const target = 1 + Math.round(density * (MAX_MOVING_BANDS - 1));
    const decayed = Math.max(1, Math.round(target * envelope));
    return Math.min(decayed, MAX_MOVING_BANDS, bandCount);
}

/** Deterministic pick with linear probing over a bitmask; no allocation, no retry loop blowup. */
function selectUnusedBand(step: number, pick: number, bandCount: number, used: number): number {
    const start = hash32(hash32(step, ACTIVATION_SALT), pick) % bandCount;
    for (let offset = 0; offset < bandCount; offset++) {
        const index = (start + offset) % bandCount;
        if ((used & (1 << index)) === 0) return index;
    }
    return -1;
}

/**
 * Cumulative, jittered band boundary. Evaluating boundary `i` and `i + 1` from the same seed keeps
 * neighbouring bands edge-exact without materializing the full partition.
 */
function bandTop(topologySeed: number, boundary: number, bandCount: number, height: number): number {
    if (boundary <= 0) return 0;
    if (boundary >= bandCount) return height;
    let total = 0;
    let cumulative = 0;
    for (let i = 0; i < bandCount; i++) {
        const weight = 0.6 + unit(hash32(topologySeed, i + 1)) * 0.8;
        total += weight;
        if (i < boundary) cumulative += weight;
    }
    return Math.min(height, Math.max(0, Math.round((cumulative / total) * height)));
}

/** Full-width band, or a rectangular horizontal fragment of it as chaos rises. */
function resolveSpan(spanSeed: number, chaos: number, width: number): { x: number; width: number } {
    const partialChance = 0.2 + chaos * 0.5;
    if (unit(hash32(spanSeed, 0x21)) >= partialChance) return { x: 0, width };

    const spanWidth = Math.max(8, Math.round(width * (0.35 + unit(hash32(spanSeed, 0x22)) * 0.5)));
    const maxX = Math.max(0, width - spanWidth);
    const x = maxX === 0 ? 0 : Math.round(unit(hash32(spanSeed, 0x23)) * maxX);
    return { x, width: Math.min(spanWidth, width - x) };
}

function resolveMaxShift(width: number, displacement: number): number {
    const ceiling = Math.min(width * MAX_SHIFT_WIDTH_FRACTION, MAX_SHIFT_PX);
    return Math.max(MIN_SHIFT_PX, ceiling * displacement);
}

function resolveShift(
    step: number,
    index: number,
    maxShift: number,
    amount: number,
    envelope: number,
    impulse: number,
    spanWidth: number
): number {
    const seed = hash32(hash32(step, SHIFT_SALT), index);
    const sign = (seed & 1) === 0 ? -1 : 1;
    const magnitude = 0.25 + unit(hash32(seed, 0x31)) * 0.75;
    const impulseScale = 0.75 + impulse * 0.5;
    const raw = MIN_SHIFT_PX + magnitude * Math.max(0, maxShift - MIN_SHIFT_PX);
    const scaled = Math.round(raw * amount * envelope * impulseScale);
    // The wrap copy can only close the span while the shift stays inside it.
    const limit = Math.max(0, spanWidth - 1);
    return sign * Math.min(scaled, limit);
}

function quantize(value: number, steps: number): number {
    return Math.round(clamp01(value) * steps) / steps;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Integer avalanche hash; the only entropy source in the post path. */
function hash32(a: number, b: number): number {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2545f491) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x27d4eb2d) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
}

function unit(hash: number): number {
    return (hash >>> 0) / 4294967296;
}
