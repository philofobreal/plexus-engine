// WH-01 engineering gates, fixed before the first shared GPU candidate. Units: 8-bit sRGB codes.
export const QUALITY_POLICY = Object.freeze({
    version: 'wh-01-rgba-v1', maxMeanError: 1.5, maxP99Error: 8,
    maxDarkTileMeanError: .75, darkLumaCeiling: 32, tileSize: 8,
    maxTemporalError: 1.5, maxAlphaMeanError: .5, maxSpatialError: 1.5,
});
export const BASELINE_CASES = Object.freeze([
    { id: 'dashboard-policy', depthCue: 0, mode: 'preview', time: 3 },
    { id: 'dashboard-policy-next', depthCue: 0, mode: 'preview', time: 3 + 1 / 60 },
    { id: 'mvp-policy', depthCue: .6, mode: 'preview', time: 3 },
    { id: 'mvp-policy-next', depthCue: .6, mode: 'preview', time: 3 + 1 / 60 },
    { id: 'dense-exact', depthCue: .6, mode: 'exact', time: 3,
        tuning: { wormholeGrainDensity: 1, wormholeNebulaDetail: 1, wormholeNebulaWeave: 1 } },
    { id: 'reverse-portrait', depthCue: .6, mode: 'exact', time: 3, width: 360, height: 640,
        tuning: { wormholeSpiralDirection: -1, wormholeGrainShape: 1 } },
    { id: 'transparent', depthCue: .6, mode: 'exact', time: 3, transparent: true },
    { id: 'material-off', depthCue: .6, mode: 'exact', time: 3, tuning: { wormholeNebulaAmount: 0 } },
]);

function check(image, width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
        || !(image instanceof Uint8Array || image instanceof Uint8ClampedArray)
        || image.length !== width * height * 4) throw Error('Invalid RGBA reference dimensions');
}
// Composite straight-alpha input against black and white; invisible RGB cannot inflate a score.
const rgb = (image, i, bg) => image[i] * image[i - i % 4 + 3] / 255 + bg * (1 - image[i - i % 4 + 3] / 255);
const luma = (image, i, bg = 0) => .2126 * rgb(image, i, bg) + .7152 * rgb(image, i + 1, bg) + .0722 * rgb(image, i + 2, bg);

/** Display the same worst black/white composite error used by the RGB gate.
 * Straight RGB alone can exaggerate invisible colour under low/zero alpha.
 * The output is opaque for inspection; neither input nor any quality gate changes.
 */
export function visibleDifferenceRgba(reference, candidate, width, height, gain = 8) {
    check(reference, width, height); check(candidate, width, height);
    if (!Number.isFinite(gain) || gain <= 0) throw Error('Invalid difference gain');
    const pixels = new Uint8ClampedArray(reference.length);
    for (let i = 0; i < pixels.length; i += 4) {
        for (let k = 0; k < 3; k++) pixels[i + k] = gain * Math.max(
            Math.abs(rgb(reference, i + k, 0) - rgb(candidate, i + k, 0)),
            Math.abs(rgb(reference, i + k, 255) - rgb(candidate, i + k, 255)));
        pixels[i + 3] = 255;
    }
    return pixels;
}

export function compareRgba(reference, candidate, width, height) {
    check(reference, width, height); check(candidate, width, height);
    const errors = new Uint32Array(256);
    let sum = 0, alpha = 0, darkTiles = 0, maxDarkTileMeanError = 0, spatial = 0, edges = 0;
    for (let i = 0; i < reference.length; i += 4) {
        alpha += Math.abs(reference[i + 3] - candidate[i + 3]);
        for (let k = 0; k < 3; k++) {
            const e = Math.max(Math.abs(rgb(reference, i + k, 0) - rgb(candidate, i + k, 0)),
                Math.abs(rgb(reference, i + k, 255) - rgb(candidate, i + k, 255)));
            sum += e; errors[Math.min(255, Math.ceil(e))]++;
        }
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, error = luma(candidate, i) - luma(reference, i);
        for (const j of [x ? i - 4 : -1, y ? i - width * 4 : -1]) if (j >= 0) {
            spatial += Math.abs(error - (luma(candidate, j) - luma(reference, j))); edges++;
        }
    }
    const { tileSize, darkLumaCeiling } = QUALITY_POLICY;
    for (let y = 0; y < height; y += tileSize) for (let x = 0; x < width; x += tileSize) {
        let error = 0, whiteError = 0, count = 0;
        for (let dy = y; dy < Math.min(y + tileSize, height); dy++) for (let dx = x; dx < Math.min(x + tileSize, width); dx++) {
            const i = (dy * width + dx) * 4, a = luma(reference, i);
            if (a <= darkLumaCeiling) {
                error += luma(candidate, i) - a;
                whiteError += luma(candidate, i, 255) - luma(reference, i, 255); count++;
            }
        }
        if (count) { darkTiles++; maxDarkTileMeanError = Math.max(maxDarkTileMeanError, Math.abs(error / count), Math.abs(whiteError / count)); }
    }
    let p99Error = 0, cumulative = 0;
    while (p99Error < 255) { cumulative += errors[p99Error]; if (cumulative >= width * height * 3 * .99) break; p99Error++; }
    const meanError = sum / (width * height * 3), alphaMeanError = alpha / (width * height);
    const spatialError = edges ? spatial / edges : 0;
    return { meanError, p99Error, alphaMeanError, darkTiles, maxDarkTileMeanError, spatialError,
        pass: meanError <= QUALITY_POLICY.maxMeanError && p99Error <= QUALITY_POLICY.maxP99Error
            && alphaMeanError <= QUALITY_POLICY.maxAlphaMeanError
            && maxDarkTileMeanError <= QUALITY_POLICY.maxDarkTileMeanError
            && spatialError <= QUALITY_POLICY.maxSpatialError };
}

/** Difference between signed consecutive-frame changes, not static image similarity. */
export function compareTemporal(referenceBefore, referenceAfter, candidateBefore, candidateAfter, width, height) {
    for (const image of [referenceBefore, referenceAfter, candidateBefore, candidateAfter]) check(image, width, height);
    let error = 0;
    for (let i = 0; i < referenceBefore.length; i += 4)
        error += Math.max(...[0, 255].map(bg => Math.abs((luma(candidateAfter, i, bg) - luma(candidateBefore, i, bg))
            - (luma(referenceAfter, i, bg) - luma(referenceBefore, i, bg)))));
    const meanError = error / (width * height);
    return { meanError, pass: meanError <= QUALITY_POLICY.maxTemporalError };
}
