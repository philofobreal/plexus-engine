import type { AcousticEvidenceIdentity } from '../types/acousticEvidence';
import type { HarmonicForecast, HarmonicForecastModel } from '../types/harmonicForecast';
import { extractPitchCandidates } from './PitchCandidates';

function row(index: number, length: number, fs: number, frequency: number, harmonics: number, linear: boolean): number[] {
    const columns = [1], u = index / (length - 1) - .5;
    for (let h = 1; h <= harmonics; h++) {
        const phase = 2 * Math.PI * h * frequency * index / fs, c = Math.cos(phase), s = Math.sin(phase);
        columns.push(c, s);
        if (linear) columns.push(u * c, u * s);
    }
    return columns;
}

/** Two-pass modified Gram-Schmidt; all dot products and model coefficients use prefix PCM only. */
function solve(columns: Float64Array[], target: Float64Array): number[] | null {
    const count = columns.length, q: Float64Array[] = [], r = Array.from({ length: count }, () => new Float64Array(count));
    const dot = (a: Float64Array, b: Float64Array) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    for (let j = 0; j < count; j++) {
        const v = columns[j].slice(), original = Math.sqrt(dot(v, v));
        for (let pass = 0; pass < 2; pass++) for (let k = 0; k < j; k++) {
            const projection = dot(q[k], v); r[k][j] += projection;
            for (let i = 0; i < v.length; i++) v[i] -= projection * q[k][i];
        }
        const norm = Math.sqrt(dot(v, v));
        if (norm <= original * 1e-10) return null;
        r[j][j] = norm;
        for (let i = 0; i < v.length; i++) v[i] /= norm;
        q.push(v);
    }
    const coefficients = q.map(vector => dot(vector, target));
    for (let j = count - 1; j >= 0; j--) {
        for (let k = j + 1; k < count; k++) coefficients[j] -= r[j][k] * coefficients[k];
        coefficients[j] /= r[j][j];
    }
    return coefficients.every(Number.isFinite) ? coefficients : null;
}

/** Fit two fixed hypotheses. No suffix, teacher frequency, source label, or best-model decision is accepted. */
export function fitHarmonicForecast(prefix: Float32Array, identity: AcousticEvidenceIdentity): HarmonicForecast {
    const length = 2 ** Math.ceil(Math.log2(.08 * identity.sampleRate));
    if (prefix.length !== length) throw new Error('Exactly one original-clock pitch prefix required');
    const pitch = extractPitchCandidates(prefix, identity), frequency = pitch.frames[0].primary?.frequencyHz ?? null;
    const mean = prefix.reduce((sum, value) => sum + value, 0) / prefix.length;
    const result: HarmonicForecast = { algorithm: 'experimental-prefix-harmonic-forecast-v1', identity: { ...identity },
        trainingSamples: length, evaluationSamples: length / 2, frequencyHz: frequency, harmonics: 0, trainingMean: mean,
        status: frequency === null ? 'no-pitch' : 'available', models: [], confidence: null,
        sourceIsolation: 'unverified-mixture', consumerUse: 'diagnostic-only', xrScoring: 'ineligible' };
    if (frequency === null) return result;
    let harmonics = 0;
    while (harmonics < 8 && (harmonics + 1) * frequency < .4 * identity.sampleRate) harmonics++;
    result.harmonics = harmonics;
    const y = Float64Array.from(prefix, value => value - mean), energy = y.reduce((sum, value) => sum + value * value, 0);
    for (const kind of ['stationary', 'linear-envelope'] as const) {
        const rows = Array.from({ length }, (_, i) => row(i, length, identity.sampleRate, frequency, harmonics, kind === 'linear-envelope'));
        const columns = rows[0].map((_, j) => Float64Array.from(rows, values => values[j]));
        const coefficients = solve(columns, y);
        if (!coefficients) { result.status = 'rank-deficient'; result.models = []; return result; }
        let error = 0;
        for (let i = 0; i < length; i++) error += (y[i] - rows[i].reduce((sum, value, j) => sum + value * coefficients[j], 0)) ** 2;
        result.models.push({ kind, coefficients, fitResidualFraction: error / energy });
    }
    return result;
}

/** Evaluate an immutable prefix fit on the immediate half-prefix suffix. Ratios may exceed one. */
export function evaluateHarmonicForecast(forecast: HarmonicForecast, suffix: Float32Array): {
    kind: HarmonicForecastModel['kind']; heldOutResidualFraction: number | null;
}[] {
    const fs = forecast.identity.sampleRate, length = forecast.trainingSamples;
    if (forecast.algorithm !== 'experimental-prefix-harmonic-forecast-v1' || forecast.confidence !== null
        || forecast.sourceIsolation !== 'unverified-mixture' || forecast.consumerUse !== 'diagnostic-only' || forecast.xrScoring !== 'ineligible'
        || !Number.isSafeInteger(fs) || fs < 8000 || fs > 96000 || length !== 2 ** Math.ceil(Math.log2(.08 * fs))
        || forecast.identity.sampleCount !== length || suffix.length !== length / 2 || forecast.evaluationSamples !== suffix.length
        || !Number.isFinite(forecast.trainingMean)) throw new Error('Invalid forecast clock or contract');
    for (const value of suffix) if (!Number.isFinite(value)) throw new Error('Nonfinite evaluation PCM');
    if (forecast.status !== 'available') {
        if (forecast.models.length) throw new Error('Unavailable forecast has models');
        return [];
    }
    const frequency = forecast.frequencyHz;
    if (frequency === null || !Number.isFinite(frequency) || frequency < 80 || frequency > 1000
        || !Number.isSafeInteger(forecast.harmonics) || forecast.harmonics < 1 || forecast.harmonics > 8
        || forecast.harmonics * frequency >= .4 * fs || forecast.models.length !== 2) throw new Error('Invalid forecast basis');
    const energy = suffix.reduce((sum, value) => sum + (value - forecast.trainingMean) ** 2, 0);
    return forecast.models.map((model, j) => {
        const linear = j === 1;
        if (model.kind !== (linear ? 'linear-envelope' : 'stationary') || model.coefficients.length !== 1 + (linear ? 4 : 2) * forecast.harmonics
            || !model.coefficients.every(Number.isFinite) || !Number.isFinite(model.fitResidualFraction) || model.fitResidualFraction < 0)
            throw new Error('Invalid forecast coefficients');
        let error = 0;
        for (let i = 0; i < suffix.length; i++) {
            const prediction = forecast.trainingMean + row(length + i, length, fs, frequency, forecast.harmonics, linear)
                .reduce((sum, value, k) => sum + value * model.coefficients[k], 0);
            error += (suffix[i] - prediction) ** 2;
        }
        return { kind: model.kind, heldOutResidualFraction: energy / suffix.length <= 1e-12 ? null : error / energy };
    });
}
