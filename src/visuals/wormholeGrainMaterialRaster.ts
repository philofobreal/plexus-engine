/**
 * Pure, deterministic foreground material raster for the Cosmic Wormhole grain carriers.
 *
 * The caller supplies only already-resolved screen-space segments and renderer-owned float
 * buffers. This module never reads State, route/lens geometry, audio, p5, canvas, or the DOM, and
 * never reprojects a grain. L0 is used first as an accumulation buffer and then resolved in place;
 * L1/L2 are derived exclusively from the resolved L0 emission.
 */

const TWO_PI = Math.PI * 2;
const MIN_NORMAL_RASTER_PIXELS = 320 * 180;
const MAX_NORMAL_RASTER_PIXELS = 480 * 270;
const MIN_EXPORT_RASTER_PIXELS = 480 * 270;

export const MAX_GRAIN_MATERIAL_RASTER_PIXELS = 640 * 360;
export const MAX_GRAIN_MATERIAL_RASTER_DIMENSION = 640;
export const MAX_GRAIN_MATERIAL_DILATION_PX = 3;
export const MAX_GRAIN_MATERIAL_SAMPLES_PER_CARRIER = 48;

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
 * dilation of the exact tail-to-head segment in raster space. Sampling and kernel work are hard
 * capped per carrier and independent of viewport resolution after the screen-to-raster mapping.
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

    const tailX = finiteOr(carrier.tailX, 0) * safeCols / viewportWidth;
    const tailY = finiteOr(carrier.tailY, 0) * safeRows / viewportHeight;
    const headX = finiteOr(carrier.headX, 0) * safeCols / viewportWidth;
    const headY = finiteOr(carrier.headY, 0) * safeRows / viewportHeight;
    const dx = headX - tailX;
    const dy = headY - tailY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const sampleCount = Math.min(
        MAX_GRAIN_MATERIAL_SAMPLES_PER_CARRIER,
        Math.max(1, Math.ceil(length * 0.9))
    );
    const invLength = length > 1e-6 ? 1 / length : 0;
    const normalX = -dy * invLength;
    const normalY = dx * invLength;
    const safeDetail = clamp01(detail);
    const alpha01 = clamp01(finiteOr(carrier.alpha, 0) / 255);
    if (alpha01 <= 0) return;

    const energy = clamp01(carrier.energy);
    const strokeWeight = Math.max(0, finiteOr(carrier.strokeWeight, 0));
    const rasterScale = 0.5 * (safeCols / viewportWidth + safeRows / viewportHeight);
    const radius = Math.min(
        MAX_GRAIN_MATERIAL_DILATION_PX,
        0.7 + Math.sqrt(strokeWeight * rasterScale) * 0.7 + safeDetail * 1.1
    );
    const radiusSq = radius * radius;
    const seed = finiteOr(carrier.seed, 0);
    const generation = Math.floor(finiteOr(carrier.generation, 0));
    const phase = finiteOr(carrier.materialPhase, 0);
    const colorR = clamp01(finiteOr(carrier.colorR, 0) / 255);
    const colorG = clamp01(finiteOr(carrier.colorG, 0) / 255);
    const colorB = clamp01(finiteOr(carrier.colorB, 0) / 255);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
        const t = (sampleIndex + 0.5) / sampleCount;
        const centerX = tailX + dx * t;
        const centerY = tailY + dy * t;
        const fragmentHash = deterministicHash(seed, generation, sampleIndex, phase);
        const filamentWave = 0.5 + 0.5 * Math.sin(
            t * TWO_PI * (3 + safeDetail * 8) + phase * TWO_PI + fragmentHash * 1.7
        );
        let breakup = 0.32 + 0.68 * filamentWave * filamentWave;
        if (fragmentHash < safeDetail * 0.18) breakup *= 0.24;
        const sampleEmission = alpha01 * (0.35 + energy * 0.65) * breakup;
        if (sampleEmission <= 1e-6) continue;

        const minX = Math.max(0, Math.floor(centerX - radius));
        const maxX = Math.min(safeCols - 1, Math.ceil(centerX + radius));
        const minY = Math.max(0, Math.floor(centerY - radius));
        const maxY = Math.min(safeRows - 1, Math.ceil(centerY + radius));

        for (let y = minY; y <= maxY; y++) {
            const offsetY = y + 0.5 - centerY;
            for (let x = minX; x <= maxX; x++) {
                const offsetX = x + 0.5 - centerX;
                const distanceSq = offsetX * offsetX + offsetY * offsetY;
                if (distanceSq > radiusSq) continue;

                const falloff = 1 - distanceSq / Math.max(1e-6, radiusSq);
                const crossCarrier = (offsetX * normalX + offsetY * normalY) / Math.max(radius, 1e-6);
                const split = 0.68 + 0.32 * Math.cos(crossCarrier * Math.PI * (1 + safeDetail));
                const micro = 0.72 + deterministicHash(seed + x, generation + y, sampleIndex, phase + 17.3) * 0.56;
                const contribution = sampleEmission * falloff * falloff * split * micro;
                if (contribution <= 1e-7) continue;

                const index = (y * safeCols + x) * 4;
                l0[index] += colorR * contribution;
                l0[index + 1] += colorG * contribution;
                l0[index + 2] += colorB * contribution;
                l0[index + 3] += contribution;
            }
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
        const emission = clamp01((1 - Math.exp(-density * 0.72)) * safeAmount);
        l0[index] = clamp01(l0[index] * invDensity * (0.82 + emission * 0.36));
        l0[index + 1] = clamp01(l0[index + 1] * invDensity * (0.82 + emission * 0.36));
        l0[index + 2] = clamp01(l0[index + 2] * invDensity * (0.82 + emission * 0.36));
        l0[index + 3] = emission;
    }

    l1.fill(0);
    l2.fill(0);
    if (safeAmount <= 0 || safeBloom <= 0) return;

    deriveBloomFromL0(l0, l0Cols, l0Rows, l1, l1Cols, l1Rows, safeBloom, 0.04);
    deriveBloomFromL0(l0, l0Cols, l0Rows, l2, l2Cols, l2Rows, safeBloom * 0.78, 0.018);
    smoothBloomLayerInPlace(l1, l1Cols, l1Rows, 1);
    smoothBloomLayerInPlace(l2, l2Cols, l2Rows, 2);
}

function deriveBloomFromL0(
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
            let maxEmission = 0;
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
                    maxEmission = Math.max(maxEmission, emission);
                    weightedR += source[sourceIndex] * emission;
                    weightedG += source[sourceIndex + 1] * emission;
                    weightedB += source[sourceIndex + 2] * emission;
                    emissionSum += emission;
                }
            }

            if (maxEmission <= threshold || emissionSum <= 0 || sourceSamples <= 0) continue;
            const averageEmission = emissionSum / sourceSamples;
            const carrierEmission = maxEmission * 0.5 + averageEmission * 0.5;
            if (carrierEmission <= threshold) continue;
            const bloomEmission = clamp01((carrierEmission - threshold) / (1 - threshold) * gain);
            const targetIndex = (y * dstCols + x) * 4;
            const invEmission = 1 / emissionSum;
            target[targetIndex] = clamp01(weightedR * invEmission * (1 + bloomEmission * 0.35));
            target[targetIndex + 1] = clamp01(weightedG * invEmission * (1 + bloomEmission * 0.35));
            target[targetIndex + 2] = clamp01(weightedB * invEmission * (1 + bloomEmission * 0.35));
            target[targetIndex + 3] = bloomEmission;
        }
    }
}

/**
 * Symmetric causal/reverse low-pass passes soften the small bloom rasters without an extra scratch
 * buffer or a global full-resolution blur. Zero input remains exactly zero, so provenance stays L0.
 */
function smoothBloomLayerInPlace(
    buffer: Float32Array,
    cols: number,
    rows: number,
    passes: number
): void {
    const safeCols = Math.max(1, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    if (buffer.length < safeCols * safeRows * 4) return;
    const keep = 0.64;
    const spread = 1 - keep;

    for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < safeRows; y++) {
            const rowStart = y * safeCols * 4;
            for (let channel = 0; channel < 4; channel++) {
                let previous = buffer[rowStart + channel];
                for (let x = 1; x < safeCols; x++) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * keep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[rowStart + (safeCols - 1) * 4 + channel];
                for (let x = safeCols - 2; x >= 0; x--) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * keep + previous * spread;
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
                    previous = buffer[index] * keep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[((safeRows - 1) * safeCols + x) * 4 + channel];
                for (let y = safeRows - 2; y >= 0; y--) {
                    const index = (y * safeCols + x) * 4 + channel;
                    previous = buffer[index] * keep + previous * spread;
                    buffer[index] = previous;
                }
            }
        }
    }
}

function deterministicHash(a: number, b: number, c: number, d: number): number {
    const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + d * 19.913) * 43758.5453;
    return value - Math.floor(value);
}

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, finiteOr(value, 0)));
}
