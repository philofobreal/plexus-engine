import { DEFAULT_FREQUENCY_BANDS_HZ, type FrequencyBand, type FrequencyBandKey, type FrequencyBands } from './FeatureExtractor';
import { FFT } from './math/FFT';

export interface SpectralCalibrationConfidence {
    overall: number;
    signalToNoise: number;
    spectralStability: number;
    dynamicRangeConfidence: number;
}

export interface SpectralCalibration {
    sampleRate: number;
    nyquist: number;
    fftSize: number;
    centersHz: Record<FrequencyBandKey, number>;
    bandsHz: FrequencyBands;
    confidence: SpectralCalibrationConfidence;
}

const BAND_KEYS: FrequencyBandKey[] = ['sub', 'bass', 'lowMid', 'mid', 'presence', 'brilliance', 'air'];

const SAFETY_RANGES_HZ: FrequencyBands = {
    sub: { min: 20, max: 70 },
    bass: { min: 50, max: 220 },
    lowMid: { min: 140, max: 650 },
    mid: { min: 400, max: 2600 },
    presence: { min: 1600, max: 6200 },
    brilliance: { min: 4200, max: 13000 },
    air: { min: 9000, max: 16000 }
};

const MIN_CONFIDENCE = 0.02;
const EPSILON = 1e-6;
const ZERO_CONFIDENCE: SpectralCalibrationConfidence = {
    overall: 0,
    signalToNoise: 0,
    spectralStability: 0,
    dynamicRangeConfidence: 0
};

interface CalibrationWindowCandidate {
    start: number;
    rms: number;
    flux: number;
    stability: number;
    score: number;
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function clampBand(band: FrequencyBand, nyquist: number): FrequencyBand {
    const min = clamp(band.min, 0, nyquist);
    const max = clamp(band.max, min, nyquist);
    return { min, max };
}

function createEvenBands(nyquist: number): FrequencyBands {
    const bands = {} as FrequencyBands;
    if (nyquist <= 0) {
        for (const key of BAND_KEYS) bands[key] = { min: 0, max: 0 };
        return bands;
    }

    const width = nyquist / BAND_KEYS.length;
    for (let i = 0; i < BAND_KEYS.length; i++) {
        bands[BAND_KEYS[i]] = {
            min: i * width,
            max: i === BAND_KEYS.length - 1 ? nyquist : (i + 1) * width
        };
    }
    return bands;
}

function bandsAreStrictlyOrdered(bands: FrequencyBands, nyquist: number): boolean {
    let previousMax = 0;
    for (const key of BAND_KEYS) {
        const band = bands[key];
        if (!Number.isFinite(band.min) || !Number.isFinite(band.max)) return false;
        if (band.min < 0 || band.max > nyquist) return false;
        if (band.min < previousMax) return false;
        if (band.max <= band.min) return false;
        previousMax = band.max;
    }
    return true;
}

function cloneDefaultBands(nyquist: number): FrequencyBands {
    const bands = {
        sub: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.sub, nyquist),
        bass: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.bass, nyquist),
        lowMid: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.lowMid, nyquist),
        mid: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.mid, nyquist),
        presence: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.presence, nyquist),
        brilliance: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.brilliance, nyquist),
        air: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.air, nyquist)
    };
    return bandsAreStrictlyOrdered(bands, nyquist) ? bands : createEvenBands(nyquist);
}

function createDefaultCalibration(sampleRate: number, fftSize: number, confidence: SpectralCalibrationConfidence): SpectralCalibration {
    const nyquist = sampleRate / 2;
    const bandsHz = cloneDefaultBands(nyquist);
    return {
        sampleRate,
        nyquist,
        fftSize,
        centersHz: {
            sub: (bandsHz.sub.min + bandsHz.sub.max) / 2,
            bass: (bandsHz.bass.min + bandsHz.bass.max) / 2,
            lowMid: (bandsHz.lowMid.min + bandsHz.lowMid.max) / 2,
            mid: (bandsHz.mid.min + bandsHz.mid.max) / 2,
            presence: (bandsHz.presence.min + bandsHz.presence.max) / 2,
            brilliance: (bandsHz.brilliance.min + bandsHz.brilliance.max) / 2,
            air: (bandsHz.air.min + bandsHz.air.max) / 2
        },
        bandsHz,
        confidence
    };
}

function addCandidateStart(starts: number[], seen: Set<number>, start: number, maxStart: number): void {
    const clampedStart = clamp(Math.floor(start), 0, maxStart);
    if (seen.has(clampedStart)) return;
    seen.add(clampedStart);
    starts.push(clampedStart);
}

function pickCandidateStarts(
    starts: number[],
    seen: Set<number>,
    candidates: CalibrationWindowCandidate[],
    maxStart: number,
    maxWindows: number,
    compare: (a: CalibrationWindowCandidate, b: CalibrationWindowCandidate) => number,
    limit: number
): void {
    if (starts.length >= maxWindows || limit <= 0) return;
    const sorted = candidates.slice().sort(compare);
    for (const candidate of sorted) {
        addCandidateStart(starts, seen, candidate.start, maxStart);
        if (starts.length >= maxWindows || starts.length >= limit) break;
    }
}

export function collectCalibrationWindowStarts(
    samples: Float32Array,
    sampleRate: number,
    fftSize: number,
    maxWindows: number = 100
): number[] {
    const windowLimit = Math.max(0, Math.floor(maxWindows));
    if (windowLimit <= 0 || samples.length < fftSize || sampleRate <= 0 || fftSize <= 0) return [];

    const maxStart = samples.length - fftSize;
    const stride = Math.max(1, Math.floor(sampleRate / 2));
    const scanHop = Math.max(1, Math.min(stride, Math.floor(fftSize / 2)));
    const candidates: CalibrationWindowCandidate[] = [];
    let previousRms = 0;
    let previousMeanAbsDelta = 0;

    for (let start = 0; start <= maxStart; start += scanHop) {
        let sumSquares = 0;
        let absDeltaSum = 0;
        let previousSample = samples[start] || 0;

        for (let i = 0; i < fftSize; i++) {
            const sample = samples[start + i] || 0;
            sumSquares += sample * sample;
            if (i > 0) absDeltaSum += Math.abs(sample - previousSample);
            previousSample = sample;
        }

        const rms = Math.sqrt(sumSquares / fftSize);
        const meanAbsDelta = absDeltaSum / Math.max(1, fftSize - 1);
        const flux = Math.max(0, rms - previousRms) + Math.max(0, meanAbsDelta - previousMeanAbsDelta);
        const stability = 1 / (1 + flux + meanAbsDelta);
        candidates.push({
            start,
            rms,
            flux,
            stability,
            score: flux * 1.8 + rms
        });
        previousRms = rms;
        previousMeanAbsDelta = meanAbsDelta;
    }

    if (candidates.length === 0) return [];
    const starts: number[] = [];
    const seen = new Set<number>();
    const transientLimit = Math.max(1, Math.ceil(windowLimit * 0.5));
    const energyLimit = Math.max(transientLimit, Math.ceil(windowLimit * 0.85));

    pickCandidateStarts(
        starts,
        seen,
        candidates,
        maxStart,
        windowLimit,
        (a, b) => b.score - a.score || b.flux - a.flux || a.start - b.start,
        transientLimit
    );
    pickCandidateStarts(
        starts,
        seen,
        candidates,
        maxStart,
        windowLimit,
        (a, b) => b.rms - a.rms || b.flux - a.flux || a.start - b.start,
        energyLimit
    );
    pickCandidateStarts(
        starts,
        seen,
        candidates,
        maxStart,
        windowLimit,
        (a, b) => b.stability - a.stability || a.rms - b.rms || a.start - b.start,
        windowLimit
    );

    return starts.sort((a, b) => a - b);
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculateSignalToNoise(envelope: Float32Array): number {
    let peak = 0;
    const positive: number[] = [];
    for (let k = 1; k < envelope.length; k++) {
        const magnitude = envelope[k];
        if (magnitude > peak) peak = magnitude;
        if (magnitude > EPSILON) positive.push(magnitude);
    }
    if (peak <= EPSILON || positive.length === 0) return 0;
    const noiseFloor = median(positive);
    return clamp((peak - noiseFloor) / Math.max(EPSILON, peak + noiseFloor * 3), 0, 1);
}

function calculateDynamicRangeConfidence(rmsValues: number[]): number {
    if (rmsValues.length === 0) return 0;
    let min = Infinity;
    let max = 0;
    for (const rms of rmsValues) {
        if (rms < min) min = rms;
        if (rms > max) max = rms;
    }
    if (max <= EPSILON) return 0;
    return clamp(((max - min) / max - 0.08) / 0.72, 0, 1);
}

function calculateSpectralStability(windowMagnitudes: Float32Array[], envelope: Float32Array): number {
    if (windowMagnitudes.length === 0) return 0;
    let envelopeNorm = 0;
    for (let k = 1; k < envelope.length; k++) envelopeNorm += envelope[k] * envelope[k];
    envelopeNorm = Math.sqrt(envelopeNorm);
    if (envelopeNorm <= EPSILON) return 0;

    let similaritySum = 0;
    let compared = 0;
    for (const magnitudes of windowMagnitudes) {
        let dot = 0;
        let norm = 0;
        for (let k = 1; k < magnitudes.length; k++) {
            dot += magnitudes[k] * envelope[k];
            norm += magnitudes[k] * magnitudes[k];
        }
        norm = Math.sqrt(norm);
        if (norm <= EPSILON) continue;
        similaritySum += dot / Math.max(EPSILON, norm * envelopeNorm);
        compared++;
    }

    return compared > 0 ? clamp(similaritySum / compared, 0, 1) : 0;
}

function buildConfidence(envelope: Float32Array, rmsValues: number[], windowMagnitudes: Float32Array[]): SpectralCalibrationConfidence {
    if (rmsValues.length === 0) return { ...ZERO_CONFIDENCE };
    let rmsSum = 0;
    for (const rms of rmsValues) rmsSum += rms;
    const meanRms = rmsSum / rmsValues.length;
    if (meanRms <= EPSILON) return { ...ZERO_CONFIDENCE };

    const signalLevel = clamp(meanRms * 4, 0, 1);
    const signalToNoise = calculateSignalToNoise(envelope);
    const spectralStability = calculateSpectralStability(windowMagnitudes, envelope);
    const dynamicRangeConfidence = calculateDynamicRangeConfidence(rmsValues);
    const overall = clamp(signalLevel * (0.35 + signalToNoise * 0.25 + spectralStability * 0.25 + dynamicRangeConfidence * 0.15), 0, 1);

    return {
        overall,
        signalToNoise,
        spectralStability,
        dynamicRangeConfidence
    };
}

function fftMagnitudeEnvelope(samples: Float32Array, sampleRate: number, fftSize: number): { envelope: Float32Array; confidence: SpectralCalibrationConfidence } {
    const binCount = Math.floor(fftSize / 2);
    const envelope = new Float32Array(binCount);
    const fft = new FFT(fftSize);
    const starts = collectCalibrationWindowStarts(samples, sampleRate, fftSize);
    let windows = 0;
    const rmsValues: number[] = [];
    const windowMagnitudes: Float32Array[] = [];

    for (const start of starts) {
        const energy = fft.setWindowedSamples(samples, start);
        rmsValues.push(Math.sqrt(energy / fftSize));
        fft.transform();
        const magnitudes = new Float32Array(binCount);
        for (let k = 1; k < binCount; k++) {
            const magnitude = fft.magnitude(k);
            magnitudes[k] = magnitude;
            envelope[k] += magnitude;
        }
        windowMagnitudes.push(magnitudes);
        windows++;
    }

    if (windows === 0) return { envelope, confidence: { ...ZERO_CONFIDENCE } };
    for (let k = 0; k < envelope.length; k++) envelope[k] /= windows;

    return { envelope, confidence: buildConfidence(envelope, rmsValues, windowMagnitudes) };
}

function findPeakCenter(envelope: Float32Array, sampleRate: number, range: FrequencyBand, fallback: FrequencyBand): number {
    const binHz = sampleRate / Math.max(1, envelope.length * 2);
    const startBin = Math.max(1, Math.ceil(range.min / binHz));
    const endBin = Math.min(envelope.length - 1, Math.floor(range.max / binHz));
    let peakBin = -1;
    let peakMag = -1;
    for (let k = startBin; k <= endBin; k++) {
        if (envelope[k] > peakMag) {
            peakMag = envelope[k];
            peakBin = k;
        }
    }
    if (peakBin < 0 || peakMag <= EPSILON) return (fallback.min + fallback.max) / 2;
    return peakBin * binHz;
}

function clampCenterToSafety(key: FrequencyBandKey, center: number, nyquist: number): number {
    const safety = clampBand(SAFETY_RANGES_HZ[key], nyquist);
    return clamp(center, safety.min, safety.max);
}

function buildAdaptiveBands(centersHz: Record<FrequencyBandKey, number>, nyquist: number): FrequencyBands {
    const fallback = cloneDefaultBands(nyquist);
    if (nyquist <= 0) return fallback;

    const clampedCenters = {} as Record<FrequencyBandKey, number>;
    for (const key of BAND_KEYS) clampedCenters[key] = clampCenterToSafety(key, centersHz[key], nyquist);

    const bands = {} as FrequencyBands;
    let previousMax = 0;
    for (let i = 0; i < BAND_KEYS.length; i++) {
        const key = BAND_KEYS[i];
        const prevKey = BAND_KEYS[i - 1];
        const nextKey = BAND_KEYS[i + 1];
        const safety = clampBand(SAFETY_RANGES_HZ[key], nyquist);
        if (safety.max <= safety.min) return fallback;

        const minBoundary = prevKey ? (clampedCenters[prevKey] + clampedCenters[key]) / 2 : fallback[key].min;
        const maxBoundary = nextKey ? (clampedCenters[key] + clampedCenters[nextKey]) / 2 : fallback[key].max;
        const min = Math.max(clamp(minBoundary, safety.min, safety.max), previousMax);
        const max = Math.min(clamp(maxBoundary, safety.min, safety.max), nyquist);

        if (max <= min) return fallback;
        bands[key] = {
            min,
            max
        };
        previousMax = bands[key].max;
    }

    return bandsAreStrictlyOrdered(bands, nyquist) ? bands : fallback;
}

export function estimateSpectralCalibration(samples: Float32Array, sampleRate: number, fftSize: number): SpectralCalibration {
    const nyquist = sampleRate / 2;
    const fallback = createDefaultCalibration(sampleRate, fftSize, { ...ZERO_CONFIDENCE });
    if (samples.length < fftSize || sampleRate <= 0 || fftSize <= 0) return fallback;

    const { envelope, confidence } = fftMagnitudeEnvelope(samples, sampleRate, fftSize);
    if (confidence.overall < MIN_CONFIDENCE) return createDefaultCalibration(sampleRate, fftSize, confidence);

    const centersHz = { ...fallback.centersHz };
    for (const key of BAND_KEYS) {
        centersHz[key] = clampCenterToSafety(
            key,
            findPeakCenter(envelope, sampleRate, clampBand(SAFETY_RANGES_HZ[key], nyquist), fallback.bandsHz[key]),
            nyquist
        );
    }

    return {
        sampleRate,
        nyquist,
        fftSize,
        centersHz,
        bandsHz: buildAdaptiveBands(centersHz, nyquist),
        confidence
    };
}
