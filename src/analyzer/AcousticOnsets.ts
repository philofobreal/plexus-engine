import type { AcousticOnsetAnalysis, AcousticOnsetCandidate, AcousticOnsetOptions } from '../types/acousticOnsets';
import { FFT } from './math/FFT';
import type { FftKernelFactory } from './math/FFT';
import { magnitudeFlatness } from './math/SpectralFlatness';
import { validateAnalysisClock, validateAnalysisSamples } from './signalContract';
import { applyEMAInSeconds } from './TemporalSmoother';

/** Offline opt-in candidate evidence; never feeds the legacy beat/visual acceptance paths. */
export function extractAcousticOnsets(samples: Float32Array, sampleRate: number, options: AcousticOnsetOptions = {}, fftKernelFactory?: FftKernelFactory): AcousticOnsetAnalysis {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Acoustic onset options must be an object');
    const windowSize = options.windowSize ?? 512, hopSize = options.hopSize ?? 128;
    validateAnalysisClock(sampleRate, windowSize);
    validateAnalysisClock(sampleRate, hopSize);
    validateAnalysisSamples(samples);
    if (windowSize < 2 * hopSize || (windowSize !== 2 * hopSize && windowSize !== 4 * hopSize)) {
        throw new Error('Acoustic overlap must be 50% or 75%');
    }
    // One final context center beyond the last sample covers the 50%-overlap Hann
    // endpoint. Only actual observed sample positions can become candidates.
    const frameCount = Math.ceil(samples.length / hopSize) + 1, half = windowSize / 2;
    const fft = new FFT(windowSize, fftKernelFactory), previous = new Float32Array(half), magnitudes = new Float32Array(half);
    const flux = new Float32Array(frameCount), flatness = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame++) {
        fft.setWindowedSamples(samples, frame * hopSize - half);
        fft.transform();
        let change = 0;
        for (let bin = 1; bin < half; bin++) {
            const magnitude = Math.hypot(fft.re[bin], fft.im[bin]);
            change += Math.max(0, magnitude - previous[bin]);
            magnitudes[bin] = magnitude;
            previous[bin] = magnitude;
        }
        flux[frame] = change;
        flatness[frame] = magnitudeFlatness(magnitudes, 1, half);
    }
    const smoothed = applyEMAInSeconds(flux, sampleRate, hopSize, 0.002);
    const energySamples = Math.max(1, Math.round(sampleRate * 0.030));
    const meanPower = (start: number, end: number) => {
        let sum = 0;
        for (let i = start; i < end; i++) sum += samples[i] * samples[i];
        return end > start ? sum / (end - start) : 0;
    };
    const candidates: AcousticOnsetCandidate[] = [];
    for (let frame = 0; frame < frameCount; frame++) {
        if (!(smoothed[frame] > 0) || smoothed[frame] < (smoothed[frame - 1] ?? 0)
            || smoothed[frame] <= (smoothed[frame + 1] ?? -1)) continue;
        const center = frame * hopSize;
        const start = Math.max(0, center - half), end = Math.min(samples.length, center + half);
        let index = start, maximumRise = 0;
        for (let i = start; i < end; i++) {
            const current = samples[i] * samples[i], previousPower = i > 0 ? samples[i - 1] * samples[i - 1] : 0;
            const rise = current - previousPower;
            if (rise > maximumRise) { maximumRise = rise; index = i; }
        }
        if (maximumRise <= 0) continue;
        const preStart = Math.max(0, index - energySamples), postEnd = Math.min(samples.length, index + energySamples);
        const before = meanPower(preStart, index), after = meanPower(index, postEnd);
        const incomplete = index < energySamples || postEnd - index < energySamples;
        // An endpoint with too little continuation cannot establish an energy rise
        // over a continuing tone. Silence-to-signal evidence stays explicitly ambiguous.
        if (after < 1e-12 || after < 2 * Math.max(before, 1e-12) || (incomplete && before > 1e-12)) continue;
        candidates.push({ time: index / sampleRate, sampleIndex: index, strength: smoothed[frame],
            powerRatio: after / Math.max(before, 1e-12), spectralFlatness: flatness[frame],
            supportStartSample: start, supportEndSample: end, endpointAmbiguous: incomplete });
    }
    candidates.sort((a, b) => a.sampleIndex - b.sampleIndex || b.strength - a.strength);
    const selected: AcousticOnsetCandidate[] = [];
    const separation = Math.max(1, Math.round(sampleRate * 0.015));
    for (const candidate of candidates) {
        const last = selected[selected.length - 1];
        if (last && candidate.sampleIndex - last.sampleIndex < separation) {
            if (candidate.strength > last.strength) selected[selected.length - 1] = candidate;
        } else selected.push(candidate);
    }
    return { algorithm: 'overlap-energy-rise-v1', sampleRate, sampleCount: samples.length,
        windowSize, hopSize, timestamp: 'refined-sample', localization: 'maximum-positive-sample-power-step',
        selection: 'candidate-only', candidates: selected };
}
