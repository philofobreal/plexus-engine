import { FFT } from './math/FFT';

/** Fixed musical bands, independent of the adaptive classification bands. */
export const LOW_FREQUENCY_BANDS = { sub: [20, 60], bass: [60, 180] } as const;
const NOISE_FLOOR = 1e-4; // RMS amplitude, -80 dBFS; never normalize silence to full scale.
const STEP_SEC = 0.04;

export interface LowFrequencyFeatures {
    subEnergy: Float32Array;
    bassEnergy: Float32Array;
    subFlux: Float32Array;
    bassFlux: Float32Array;
}

/** Offline-only long-window analysis. Independent of beat detection and track duration.
 * 120..240 ms centered Hann windows resolve low notes; 25 Hz evaluation bounds FFT work.
 * Positive magnitude differences indicate spectral change, NOT kick/stem identification.
 */
export function extractLowFrequencies(samples: Float32Array, sampleRate: number, hopSize: number): LowFrequencyFeatures {
    if (!Number.isFinite(sampleRate) || sampleRate < 1000 || sampleRate > 384000
        || !Number.isSafeInteger(hopSize) || hopSize < 1) throw new Error('Invalid low-frequency analysis clock');
    const count = Math.floor(samples.length / hopSize);
    const result: LowFrequencyFeatures = {
        subEnergy: new Float32Array(count), bassEnergy: new Float32Array(count),
        subFlux: new Float32Array(count), bassFlux: new Float32Array(count)
    };
    if (!count) return result;
    const size = 2 ** Math.ceil(Math.log2(sampleRate * 0.12));
    const fft = new FFT(size);
    const step = Math.max(1, Math.round(sampleRate * STEP_SEC));
    const n = Math.ceil(samples.length / step) + 1;
    const sub = new Float32Array(n), bass = new Float32Array(n);
    const subFlux = new Float32Array(n), bassFlux = new Float32Array(n), broad = new Float32Array(n);
    const binHz = sampleRate / size;
    const bins = Math.min(size / 2, Math.ceil(180 / binHz + 0.5) + 1);
    const previous = new Float32Array(bins);
    const subWeights = new Float32Array(bins), bassWeights = new Float32Array(bins);
    for (let k = 1; k < bins; k++) {
        const lo = (k - 0.5) * binHz, hi = (k + 0.5) * binHz;
        subWeights[k] = Math.max(0, Math.min(hi, 60) - Math.max(lo, 20)) / binHz;
        bassWeights[k] = Math.max(0, Math.min(hi, 180) - Math.max(lo, 60)) / binHz;
    }
    let windowPower = 0;
    for (const w of fft.window) windowPower += w * w;
    const powerScale = 2 / (size * windowPower);
    const sample = (i: number) => {
        const value = samples[i];
        return Number.isFinite(value) ? Math.max(-8, Math.min(8, value)) : 0;
    };
    for (let i = 0; i < n; i++) {
        const start = i * step - size / 2;
        let mean = 0;
        // Remove DC before windowing (including constant-offset files).
        const first = Math.max(0, start), end = Math.min(samples.length, start + size);
        for (let j = first; j < end; j++) mean += sample(j);
        mean /= Math.max(1, end - first);
        let rms = 0;
        for (let j = 0; j < size; j++) {
            const index = start + j;
            const value = index < 0 || index >= samples.length ? 0 : sample(index) - mean;
            fft.re[j] = value * fft.window[j];
            fft.im[j] = 0;
            rms += fft.re[j] * fft.re[j];
        }
        broad[i] = Math.sqrt(rms / windowPower);
        fft.transform();
        let s = 0, b = 0, sf = 0, bf = 0;
        for (let k = 1; k < bins; k++) {
            const magnitude = fft.magnitude(k);
            // Small stationary-window ripple must not become a perpetual attack signal.
            const rise = i === 0 ? 0 : Math.max(0, magnitude - previous[k] * 1.005);
            previous[k] = magnitude;
            s += magnitude * magnitude * subWeights[k];
            b += magnitude * magnitude * bassWeights[k];
            sf += rise * rise * subWeights[k];
            bf += rise * rise * bassWeights[k];
        }
        sub[i] = Math.sqrt(s * powerScale); bass[i] = Math.sqrt(b * powerScale);
        subFlux[i] = Math.sqrt(sf * powerScale); bassFlux[i] = Math.sqrt(bf * powerScale);
    }
    // One shared reference preserves the relative sub/bass balance and level changes.
    // Ignore silent windows; appended silence must not inflate a short active passage.
    const typical = (values: Float32Array) => {
        const active = values.filter(v => v > NOISE_FLOOR).sort();
        return active[Math.floor((active.length - 1) * 0.95)] || 0;
    };
    const low = Float32Array.from(sub, (s, i) => Math.hypot(s, bass[i]));
    const reference = Math.max(0.005, typical(broad) * 0.25, typical(low));
    const energyRise = 1 - Math.exp(-STEP_SEC / 0.03), energyFall = 1 - Math.exp(-STEP_SEC / 0.10);
    const fluxFall = Math.exp(-STEP_SEC / 0.06);
    for (const [energy, flux] of [[sub, subFlux], [bass, bassFlux]]) {
        let body = 0, attack = 0;
        for (let i = 0; i < n; i++) {
            const level = Math.min(1, Math.max(0, energy[i] - NOISE_FLOOR) / reference);
            body += (level - body) * (level > body ? energyRise : energyFall);
            const change = energy[i] <= NOISE_FLOOR ? 0 : Math.min(1, Math.max(0, flux[i] / reference - 0.005) * 3);
            attack = Math.max(change, attack * fluxFall);
            energy[i] = body < 1e-4 ? 0 : body;
            flux[i] = attack < 1e-4 ? 0 : attack;
        }
    }
    for (let i = 0; i < count; i++) {
        const position = i * hopSize / step;
        const a = Math.floor(position), b = Math.min(n - 1, a + 1), mix = position - a;
        result.subEnergy[i] = sub[a] + (sub[b] - sub[a]) * mix;
        result.bassEnergy[i] = bass[a] + (bass[b] - bass[a]) * mix;
        result.subFlux[i] = subFlux[a] + (subFlux[b] - subFlux[a]) * mix;
        result.bassFlux[i] = bassFlux[a] + (bassFlux[b] - bassFlux[a]) * mix;
    }
    return result;
}
