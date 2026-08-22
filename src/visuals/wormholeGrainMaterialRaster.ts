/**
 * Pure, deterministic foreground material raster for the Cosmic Wormhole grain carriers.
 *
 * The caller supplies only already-resolved screen-space segments and renderer-owned float
 * buffers. This module never reads State, route/lens geometry, audio, p5, canvas, or the DOM, and
 * never reprojects a grain. L0 is used first as an accumulation buffer and then resolved in place;
 * L1/L2 are derived exclusively from the resolved L0 emission.
 *
 * Two properties separate this from a blurred copy of the legacy grain lines:
 *
 * - A carrier is evaluated as a continuous capsule field, once per covered raster pixel, in
 *   carrier-local along/across coordinates. It is not a chain of overlapping splats, so the body
 *   reads as one filament instead of a bead chain, and the cost is the covered area rather than
 *   samples times kernel area.
 * - Every material law is stratified by the carrier's `depth`. A mote at the far end of the tunnel
 *   is a crisp, halo-free point under strong extinction; a streak passing the camera is a broad,
 *   soft, banded body. Without that, perspective alone makes the throat the brightest thing on
 *   screen and puts the same aura on everything.
 */

const MIN_NORMAL_RASTER_PIXELS = 320 * 180;
const MAX_NORMAL_RASTER_PIXELS = 480 * 270;
const MIN_EXPORT_RASTER_PIXELS = 480 * 270;

export const MAX_GRAIN_MATERIAL_RASTER_PIXELS = 640 * 360;
export const MAX_GRAIN_MATERIAL_RASTER_DIMENSION = 640;
/** Hard bound on how far material may live from its carrier segment, in raster pixels. */
export const MAX_GRAIN_MATERIAL_DILATION_PX = 6;
/** Hard bound on the evaluated capsule area of one carrier, in raster pixels. */
export const MAX_GRAIN_MATERIAL_PIXELS_PER_CARRIER = 1024;

/**
 * Optical depth of the tunnel. Perspective concentrates every far stratum onto a handful of pixels
 * around the vanishing point, so without a transmittance law the throat always outshines the arms.
 */
const TUNNEL_EXTINCTION = 2.5;
/** Depth at which the deepest stratum starts being damped beyond plain extinction. */
const THROAT_DAMP_START = 0.55;
const THROAT_DAMP_STRENGTH = 0.6;

export interface ResolvedWormholeGrainCarrier {
    headX: number;
    headY: number;
    tailX: number;
    tailY: number;
    alpha: number;
    strokeWeight: number;
    colorR: number;
    colorG: number;
    colorB: number;
    seed: number;
    generation: number;
    materialPhase: number;
    energy: number;
    /** Normalized tunnel depth of the carrier: 0 at the near plane, 1 at the far plane. */
    depth: number;
    /** 0 for a grain carrier, 1 for a connective weave carrier. */
    weave?: number;
}

export interface WormholeGrainMaterialRasterSize {
    cols: number;
    rows: number;
}

/**
 * Resolves a viewport-shaped L0 size without allocating. Detail changes the bounded pixel budget;
 * export may use the larger measured ceiling, while performance mode is expected to bypass this
 * module entirely at the caller.
 */
export function resolveWormholeGrainMaterialRasterSize(
    viewportWidth: number,
    viewportHeight: number,
    detail: number,
    highTier: boolean,
    out: WormholeGrainMaterialRasterSize
): WormholeGrainMaterialRasterSize {
    const width = Math.max(1, finiteOr(viewportWidth, 1));
    const height = Math.max(1, finiteOr(viewportHeight, 1));
    const safeDetail = clamp01(detail);
    const minPixels = highTier ? MIN_EXPORT_RASTER_PIXELS : MIN_NORMAL_RASTER_PIXELS;
    const maxPixels = highTier ? MAX_GRAIN_MATERIAL_RASTER_PIXELS : MAX_NORMAL_RASTER_PIXELS;
    const targetPixels = minPixels + (maxPixels - minPixels) * safeDetail;
    const aspect = width / height;

    let cols = Math.max(1, Math.round(Math.sqrt(targetPixels * aspect)));
    let rows = Math.max(1, Math.round(cols / aspect));
    if (Math.max(cols, rows) > MAX_GRAIN_MATERIAL_RASTER_DIMENSION) {
        const scale = MAX_GRAIN_MATERIAL_RASTER_DIMENSION / Math.max(cols, rows);
        cols = Math.max(1, Math.floor(cols * scale));
        rows = Math.max(1, Math.floor(rows * scale));
    }
    if (cols * rows > MAX_GRAIN_MATERIAL_RASTER_PIXELS) {
        const scale = Math.sqrt(MAX_GRAIN_MATERIAL_RASTER_PIXELS / (cols * rows));
        cols = Math.max(1, Math.floor(cols * scale));
        rows = Math.max(1, Math.floor(rows * scale));
    }

    out.cols = cols;
    out.rows = rows;
    return out;
}

/** Clears reused accumulation/output buffers at the start of one accepted material frame. */
export function clearWormholeGrainMaterialBuffers(
    l0: Float32Array,
    l1: Float32Array,
    l2: Float32Array
): void {
    l0.fill(0);
    l1.fill(0);
    l2.fill(0);
}

/**
 * Deposits one already-corrected carrier into L0. Every write stays within the exported maximum
 * dilation of the exact tail-to-head segment in raster space, and the evaluated area is capped per
 * carrier. The deposited body is a depth-stratified capsule: a tight core, a flux-scaled haze halo,
 * a head-weighted taper, multi-octave along-carrier filament breakup, and carrier-local fibre and
 * micro-detail. All modulation lives inside the carrier support; none of it moves the carrier.
 */
export function accumulateWormholeGrainCarrier(
    l0: Float32Array,
    cols: number,
    rows: number,
    viewportWidth: number,
    viewportHeight: number,
    carrier: ResolvedWormholeGrainCarrier,
    detail: number
): void {
    const safeCols = Math.max(1, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    if (l0.length < safeCols * safeRows * 4) return;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;

    const alpha01 = clamp01(finiteOr(carrier.alpha, 0) / 255);
    if (alpha01 <= 0) return;

    const tailX = finiteOr(carrier.tailX, 0) * safeCols / viewportWidth;
    const tailY = finiteOr(carrier.tailY, 0) * safeRows / viewportHeight;
    const headX = finiteOr(carrier.headX, 0) * safeCols / viewportWidth;
    const headY = finiteOr(carrier.headY, 0) * safeRows / viewportHeight;
    const dx = headX - tailX;
    const dy = headY - tailY;
    const length = Math.sqrt(dx * dx + dy * dy);

    const safeDetail = clamp01(detail);
    const depth = clamp01(carrier.depth);
    const near = 1 - depth;
    const isWeave = finiteOr(carrier.weave ?? 0, 0) > 0;
    const energy = clamp01(carrier.energy);
    const strokeWeight = Math.max(0, finiteOr(carrier.strokeWeight, 0));
    const rasterScale = 0.5 * (safeCols / viewportWidth + safeRows / viewportHeight);
    const weightRaster = Math.max(0.25, strokeWeight * rasterScale);

    // Depth attenuation: exponential transmittance along the tunnel, plus an extra smoothstep on the
    // deepest stratum so the throat stays a hole and the light lives in the arms.
    const throatT = clamp01((depth - THROAT_DAMP_START) / (1 - THROAT_DAMP_START));
    const throatDamp = 1 - THROAT_DAMP_STRENGTH * throatT * throatT * (3 - 2 * throatT);
    const flux = alpha01 * (0.42 + 0.58 * energy) * throatDamp * Math.exp(-TUNNEL_EXTINCTION * depth);
    if (flux <= 1e-5) return;

    // A weave link is gas between two grains, so its haze scales with the gap it spans rather than
    // with nearness; scaling it by nearness would erase it exactly where the arms are.
    const coreRadius = Math.min(2.6, (0.3 + 1.5 * near * near) * (0.55 + 0.75 * weightRaster));
    const haloReach = isWeave
        ? 2.4 * (0.4 + 0.05 * length)
        : 0.1 + 2.3 * Math.pow(near, 2.2);
    const haloExtent = (0.5 + 3.4 * safeDetail) * (0.3 + 0.7 * Math.sqrt(flux)) * haloReach;
    let radius = Math.min(MAX_GRAIN_MATERIAL_DILATION_PX, coreRadius + haloExtent);

    // Bounded work: shrink the haze (never the core) until the capsule bounding area fits the cap.
    for (let guard = 0; guard < 6; guard++) {
        const span = (length + 2 * radius + 1) * (2 * radius + 1);
        if (span <= MAX_GRAIN_MATERIAL_PIXELS_PER_CARRIER || radius <= coreRadius) break;
        radius = Math.max(coreRadius, radius * 0.72);
    }

    const identity = carrierIdentity(finiteOr(carrier.seed, 0), finiteOr(carrier.generation, 0));
    const phase = finiteOr(carrier.materialPhase, 0);
    // A degenerate (head-on) carrier still needs a stable local frame so its mote is fibrous rather
    // than a smooth disc. The frame comes from immutable grain identity, never from motion.
    const invLength = length > 1e-6 ? 1 / length : 0;
    const fallbackAngle = hashUnit(identity, 3, 17) * Math.PI * 2;
    const tangentX = invLength > 0 ? dx * invLength : Math.cos(fallbackAngle);
    const tangentY = invLength > 0 ? dy * invLength : Math.sin(fallbackAngle);
    const normalX = -tangentY;
    const normalY = tangentX;

    // Atmospheric perspective: far strata cool toward the tunnel's own blue, near strata warm
    // toward its complement, so depth is readable as colour and not only as size.
    const colorR = clamp01(finiteOr(carrier.colorR, 0) / 255 * (0.72 + 0.62 * near));
    const colorG = clamp01(finiteOr(carrier.colorG, 0) / 255 * (0.94 - 0.06 * near));
    const colorB = clamp01(finiteOr(carrier.colorB, 0) / 255 * (1.22 - 0.16 * near));

    const radiusSq = radius * radius;
    const invRadiusSq = 1 / Math.max(1e-6, radiusSq);
    const invCoreSq = 1 / Math.max(1e-6, coreRadius * coreRadius);
    const haloGain = (0.1 + 0.4 * safeDetail) * (0.15 + 0.85 * near);
    const filamentPhase = hashUnit(identity, 11, 5) * 37;
    const fibrePhase = hashUnit(identity, 23, 9) * 53;
    // Far strata are fine-grained; near strata carry broad structure.
    const filamentFrequency = (1.6 + 4.4 * safeDetail) * (0.7 + 1.6 * depth);
    const fibreAcross = (0.45 + 0.85 * safeDetail) * (0.6 + 1.3 * depth);
    const fibreAlong = (0.12 + 0.18 * safeDetail) * (0.7 + 0.8 * depth);
    const filamentBias = 0.28 + 0.22 * safeDetail;
    // Breakup thins and brightens a strand; it must not chop it into a bead chain, so the
    // modulation keeps a floor. Weave gas is allowed to break up much further than a grain.
    const filamentFloor = isWeave ? 0.3 : 0.6 - 0.3 * safeDetail;
    // Deposited energy is spread over the covered area, so a wide haze must not also be as intense
    // per pixel as a tight core.
    const depositGain = (isWeave ? 1.6 : 1.7) / (0.5 + radius * 0.34);
    const filamented = length > 1.4;
    // Cost control. The faint outer skirt of a capsule is most of its area and none of its image:
    // below this pre-noise shape value the final contribution cannot reach a quarter of an 8-bit
    // code even after the resolve gain, so the noise evaluations are skipped there entirely.
    const negligible = 6e-5 / Math.max(1e-6, flux * depositGain);

    const minX = Math.max(0, Math.floor(Math.min(tailX, headX) - radius));
    const maxX = Math.min(safeCols - 1, Math.ceil(Math.max(tailX, headX) + radius));
    const minY = Math.max(0, Math.floor(Math.min(tailY, headY) - radius));
    const maxY = Math.min(safeRows - 1, Math.ceil(Math.max(tailY, headY) + radius));

    for (let y = minY; y <= maxY; y++) {
        const relY = y + 0.5 - tailY;
        for (let x = minX; x <= maxX; x++) {
            const relX = x + 0.5 - tailX;
            const along = relX * tangentX + relY * tangentY;
            const across = relX * normalX + relY * normalY;
            const beyond = along < 0 ? -along : (along > length ? along - length : 0);
            const distanceSq = across * across + beyond * beyond;
            if (distanceSq > radiusSq) continue;

            const coreFalloff = 1 - distanceSq * invCoreSq;
            const core = coreFalloff > 0 ? coreFalloff * coreFalloff : 0;
            const haloFalloff = 1 - distanceSq * invRadiusSq;
            const halo = haloFalloff * haloFalloff * haloFalloff * haloGain;
            const shape = core + halo;
            if (shape <= negligible) continue;

            // A grain's projected head is its emitting front and the trail dissipates behind it; a
            // weave link has two equal ends, so it swells in the middle instead.
            const alongUnit = invLength > 0 ? clamp01(along * invLength) : 1;
            const taper = filamented
                ? (isWeave
                    ? 0.55 + 0.45 * Math.sin(Math.PI * alongUnit)
                    : 0.24 + 0.76 * alongUnit * (0.42 + 0.58 * alongUnit))
                : 1;

            let filament = 1;
            if (filamented && !isWeave) {
                const coarse = valueNoise1(alongUnit * filamentFrequency + filamentPhase + phase * 0.31, identity);
                const fine = valueNoise1(alongUnit * filamentFrequency * 2.6 + filamentPhase * 1.7 + phase * 0.57, identity ^ 0x5bf03635);
                const mixed = coarse * 0.63 + fine * 0.37;
                const shaped = clamp01((mixed - filamentBias) * (0.9 + 1.15 * safeDetail) + 0.5);
                filament = filamentFloor + (1 - filamentFloor) * shaped * shaped * (3 - 2 * shaped);
            }

            // Grains carry the readable structure and get the full two-octave fibre plus micro
            // detail. Weave gas is broad, dim, and far more numerous, so it runs one octave and no
            // micro pass: the same read at a fraction of the per-pixel cost.
            const fibreA = valueNoise2(along * fibreAlong + fibrePhase + phase * 0.44, across * fibreAcross, identity ^ 0x1b873593);
            let texture: number;
            if (isWeave) {
                texture = 0.62 + 0.76 * fibreA;
            } else {
                const fibreB = valueNoise2(along * fibreAlong * 2.7 + fibrePhase * 1.3 + phase * 0.79, across * fibreAcross * 2.7, identity ^ 0x27d4eb2d);
                const micro = 0.86 + 0.28 * valueNoise2(along * 0.9 + phase * 1.13, across * 1.6, identity ^ 0x165667b1);
                texture = (0.5 + 0.72 * (fibreA * 0.64 + fibreB * 0.36)) * micro;
            }

            const contribution = flux * shape * taper * filament * texture * depositGain;
            if (contribution <= 1e-6) continue;

            const index = (y * safeCols + x) * 4;
            l0[index] += colorR * contribution;
            l0[index + 1] += colorG * contribution;
            l0[index + 2] += colorB * contribution;
            l0[index + 3] += contribution;
        }
    }
}

/**
 * Resolves accumulated L0 in place, then derives medium and broad bloom only from that resolved
 * carrier emission. With zero amount, or with no L0 emission above threshold, every output stays
 * zero. No previous-frame pixels are sampled.
 */
export function resolveWormholeGrainMaterial(
    l0: Float32Array,
    l0Cols: number,
    l0Rows: number,
    l1: Float32Array,
    l1Cols: number,
    l1Rows: number,
    l2: Float32Array,
    l2Cols: number,
    l2Rows: number,
    amount: number,
    bloom: number
): void {
    const safeAmount = clamp01(amount);
    const safeBloom = clamp01(bloom);
    const l0PixelCount = Math.min(Math.floor(l0.length / 4), Math.max(0, Math.floor(l0Cols) * Math.floor(l0Rows)));

    for (let pixel = 0; pixel < l0PixelCount; pixel++) {
        const index = pixel * 4;
        const density = Math.max(0, finiteOr(l0[index + 3], 0));
        if (density <= 1e-8 || safeAmount <= 0) {
            l0[index] = 0;
            l0[index + 1] = 0;
            l0[index + 2] = 0;
            l0[index + 3] = 0;
            continue;
        }

        const invDensity = 1 / density;
        // Saturating emission keeps dense crossings from clipping while the low end stays linear, so
        // single faint motes survive instead of collapsing into the floor.
        const emission = clamp01(1 - Math.exp(-density * 1.75));
        // Dense cores burn toward the peak of their own colour; thin haze keeps the carrier hue.
        // Deliberately weak: strong whitening turns the busiest region into a flat blob.
        const heat = emission * emission * emission;
        const gain = 0.78 + 0.5 * emission;
        const red = l0[index] * invDensity * gain;
        const green = l0[index + 1] * invDensity * gain;
        const blue = l0[index + 2] * invDensity * gain;
        const peak = Math.max(red, Math.max(green, blue));
        const whiten = heat * 0.12;
        const lift = peak > 1e-6 ? (1 - whiten) + whiten * (1 / peak) : 1;
        l0[index] = clamp01(red * lift);
        l0[index + 1] = clamp01(green * lift);
        l0[index + 2] = clamp01(blue * lift);
        l0[index + 3] = clamp01(emission * safeAmount);
    }

    l1.fill(0);
    l2.fill(0);
    if (safeAmount <= 0 || safeBloom <= 0) return;

    // L1 is gathered from resolved carrier emission and smoothed; L2 is then gathered from that
    // already-smooth L1 rather than from the sparse L0 directly. Both remain pure carrier
    // provenance, but the coarse L2 grid no longer samples a sparse field, which is what made its
    // cells read as visible rectangles after the bilinear upscale to the viewport.
    gatherBloomLayer(l0, l0Cols, l0Rows, l1, l1Cols, l1Rows, safeBloom * 2.6, 0.004);
    smoothBloomLayerInPlace(l1, l1Cols, l1Rows, 3, 0.5);
    gatherBloomLayer(l1, l1Cols, l1Rows, l2, l2Cols, l2Rows, 1.5, 0);
    smoothBloomLayerInPlace(l2, l2Cols, l2Rows, 5, 0.4);
}

/**
 * Area-averages one emissive layer into a coarser one. The gather is an emission-weighted mean,
 * never a block maximum: a maximum makes a coarse grid read as visible rectangles once it is
 * bilinearly upscaled. `gain` carries the downsample factor, so a sparse bright filament inside a
 * coarse cell still blooms instead of being averaged below the threshold.
 */
function gatherBloomLayer(
    source: Float32Array,
    sourceCols: number,
    sourceRows: number,
    target: Float32Array,
    targetCols: number,
    targetRows: number,
    gain: number,
    threshold: number
): void {
    const srcCols = Math.max(1, Math.floor(sourceCols));
    const srcRows = Math.max(1, Math.floor(sourceRows));
    const dstCols = Math.max(1, Math.floor(targetCols));
    const dstRows = Math.max(1, Math.floor(targetRows));
    if (source.length < srcCols * srcRows * 4 || target.length < dstCols * dstRows * 4) return;

    for (let y = 0; y < dstRows; y++) {
        const sourceY0 = Math.floor(y * srcRows / dstRows);
        const sourceY1 = Math.max(sourceY0 + 1, Math.ceil((y + 1) * srcRows / dstRows));
        for (let x = 0; x < dstCols; x++) {
            const sourceX0 = Math.floor(x * srcCols / dstCols);
            const sourceX1 = Math.max(sourceX0 + 1, Math.ceil((x + 1) * srcCols / dstCols));
            let weightedR = 0;
            let weightedG = 0;
            let weightedB = 0;
            let emissionSum = 0;
            let sourceSamples = 0;

            for (let sourceY = sourceY0; sourceY < sourceY1 && sourceY < srcRows; sourceY++) {
                for (let sourceX = sourceX0; sourceX < sourceX1 && sourceX < srcCols; sourceX++) {
                    const sourceIndex = (sourceY * srcCols + sourceX) * 4;
                    const emission = clamp01(source[sourceIndex + 3]);
                    sourceSamples++;
                    if (emission <= 0) continue;
                    weightedR += source[sourceIndex] * emission;
                    weightedG += source[sourceIndex + 1] * emission;
                    weightedB += source[sourceIndex + 2] * emission;
                    emissionSum += emission;
                }
            }

            if (emissionSum <= 0 || sourceSamples <= 0) continue;
            const averageEmission = emissionSum / sourceSamples;
            if (averageEmission <= threshold) continue;
            const bloomEmission = clamp01((averageEmission - threshold) * gain);
            if (bloomEmission <= 0) continue;
            const targetIndex = (y * dstCols + x) * 4;
            const invEmission = 1 / emissionSum;
            target[targetIndex] = clamp01(weightedR * invEmission);
            target[targetIndex + 1] = clamp01(weightedG * invEmission);
            target[targetIndex + 2] = clamp01(weightedB * invEmission);
            target[targetIndex + 3] = bloomEmission;
        }
    }
}

/**
 * Symmetric causal/reverse low-pass passes soften the small bloom rasters without an extra scratch
 * buffer or a global full-resolution blur. A lower `keep` widens the spread. Zero input remains
 * exactly zero, so provenance stays L0.
 */
function smoothBloomLayerInPlace(
    buffer: Float32Array,
    cols: number,
    rows: number,
    passes: number,
    keep: number
): void {
    const safeCols = Math.max(1, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    if (buffer.length < safeCols * safeRows * 4) return;
    const safeKeep = Math.min(0.99, Math.max(0.01, keep));
    const spread = 1 - safeKeep;

    for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < safeRows; y++) {
            const rowStart = y * safeCols * 4;
            for (let channel = 0; channel < 4; channel++) {
                let previous = buffer[rowStart + channel];
                for (let x = 1; x < safeCols; x++) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[rowStart + (safeCols - 1) * 4 + channel];
                for (let x = safeCols - 2; x >= 0; x--) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
            }
        }

        for (let x = 0; x < safeCols; x++) {
            const columnStart = x * 4;
            for (let channel = 0; channel < 4; channel++) {
                let previous = buffer[columnStart + channel];
                for (let y = 1; y < safeRows; y++) {
                    const index = (y * safeCols + x) * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[((safeRows - 1) * safeCols + x) * 4 + channel];
                for (let y = safeRows - 2; y >= 0; y--) {
                    const index = (y * safeCols + x) * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
            }
        }
    }
}

/**
 * Stable integer identity for one grain generation. Integer mixing is used instead of a
 * transcendental hash so the material is bit-identical across engines, not merely across runs.
 */
function carrierIdentity(seed: number, generation: number): number {
    const seedBits = Math.round(clampFinite(seed, -1e6, 1e6) * 1024) | 0;
    const generationBits = Math.floor(clampFinite(generation, -1e9, 1e9)) | 0;
    return (Math.imul(seedBits, 0x27d4eb2d) ^ Math.imul(generationBits, 0x9e3779b1)) | 0;
}

function hashUnit(a: number, b: number, c: number): number {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) | 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise on an integer lattice; used for along-carrier filament breakup. */
function valueNoise1(x: number, identity: number): number {
    const safeX = clampFinite(x, -1e6, 1e6);
    const cell = Math.floor(safeX);
    const fraction = safeX - cell;
    const smooth = fraction * fraction * (3 - 2 * fraction);
    const low = hashUnit(identity, cell, 0);
    const high = hashUnit(identity, cell + 1, 0);
    return low + (high - low) * smooth;
}

/** Smooth 2D value noise on an integer lattice; used for carrier-local fibre and micro-detail. */
function valueNoise2(x: number, y: number, identity: number): number {
    const safeX = clampFinite(x, -1e6, 1e6);
    const safeY = clampFinite(y, -1e6, 1e6);
    const cellX = Math.floor(safeX);
    const cellY = Math.floor(safeY);
    const fractionX = safeX - cellX;
    const fractionY = safeY - cellY;
    const smoothX = fractionX * fractionX * (3 - 2 * fractionX);
    const smoothY = fractionY * fractionY * (3 - 2 * fractionY);
    const lowLeft = hashUnit(identity, cellX, cellY);
    const lowRight = hashUnit(identity, cellX + 1, cellY);
    const highLeft = hashUnit(identity, cellX, cellY + 1);
    const highRight = hashUnit(identity, cellX + 1, cellY + 1);
    const low = lowLeft + (lowRight - lowLeft) * smoothX;
    const high = highLeft + (highRight - highLeft) * smoothX;
    return low + (high - low) * smoothY;
}

function clampFinite(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, finiteOr(value, 0)));
}

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, finiteOr(value, 0)));
}
