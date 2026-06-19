import { DEFAULT_FREQUENCY_BANDS_HZ, type FrequencyBand, type FrequencyBandKey, type FrequencyBands } from './FeatureExtractor';
import { FFT } from './math/FFT';

export interface SpectralCalibration {
    sampleRate: number;
    nyquist: number;
    fftSize: number;
    centersHz: Record<FrequencyBandKey, number>;
    bandsHz: FrequencyBands;
    confidence: number;
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

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function clampBand(band: FrequencyBand, nyquist: number): FrequencyBand {
    const min = clamp(band.min, 0, nyquist);
    const max = clamp(band.max, min, nyquist);
    return { min, max };
}

function cloneDefaultBands(nyquist: number): FrequencyBands {
    return {
        sub: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.sub, nyquist),
        bass: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.bass, nyquist),
        lowMid: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.lowMid, nyquist),
        mid: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.mid, nyquist),
        presence: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.presence, nyquist),
        brilliance: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.brilliance, nyquist),
        air: clampBand(DEFAULT_FREQUENCY_BANDS_HZ.air, nyquist)
    };
}

function createDefaultCalibration(sampleRate: number, fftSize: number, confidence: number): SpectralCalibration {
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

function fftMagnitudeEnvelope(samples: Float32Array, sampleRate: number, fftSize: number): { envelope: Float32Array; confidence: number } {
    const binCount = Math.floor(fftSize / 2);
    const envelope = new Float32Array(binCount);
    const fft = new FFT(fftSize);
    const stride = Math.max(1, Math.floor(sampleRate / 2));
    const maxStart = Math.max(0, samples.length - fftSize);
    let windows = 0;
    let rmsSum = 0;

    for (let start = 0; start <= maxStart; start += stride) {
        const energy = fft.setWindowedSamples(samples, start);
        rmsSum += Math.sqrt(energy / fftSize);
        fft.transform();
        for (let k = 1; k < binCount; k++) envelope[k] += fft.magnitude(k);
        windows++;
    }

    if (windows === 0) return { envelope, confidence: 0 };
    for (let k = 0; k < envelope.length; k++) envelope[k] /= windows;

    const meanRms = rmsSum / windows;
    const confidence = clamp(meanRms * 4, 0, 1);
    return { envelope, confidence };
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

function buildAdaptiveBands(centersHz: Record<FrequencyBandKey, number>, nyquist: number): FrequencyBands {
    const bands = cloneDefaultBands(nyquist);
    let previousMax = 0;
    for (let i = 0; i < BAND_KEYS.length; i++) {
        const key = BAND_KEYS[i];
        const prevKey = BAND_KEYS[i - 1];
        const nextKey = BAND_KEYS[i + 1];
        const fallback = bands[key];
        const safety = clampBand(SAFETY_RANGES_HZ[key], nyquist);
        const min = prevKey ? (centersHz[prevKey] + centersHz[key]) / 2 : fallback.min;
        const max = nextKey ? (centersHz[key] + centersHz[nextKey]) / 2 : fallback.max;
        bands[key] = {
            min: clamp(Math.max(min, safety.min, previousMax), fallback.min, nyquist),
            max: clamp(Math.min(max, safety.max), 0, nyquist)
        };
        if (bands[key].max <= bands[key].min) bands[key] = fallback;
        if (bands[key].min < previousMax) bands[key].min = previousMax;
        if (bands[key].max <= bands[key].min) bands[key].max = Math.min(nyquist, bands[key].min + 1);
        previousMax = bands[key].max;
    }
    return bands;
}

export function estimateSpectralCalibration(samples: Float32Array, sampleRate: number, fftSize: number): SpectralCalibration {
    const nyquist = sampleRate / 2;
    const fallback = createDefaultCalibration(sampleRate, fftSize, 0);
    if (samples.length < fftSize || sampleRate <= 0 || fftSize <= 0) return fallback;

    const { envelope, confidence } = fftMagnitudeEnvelope(samples, sampleRate, fftSize);
    if (confidence < MIN_CONFIDENCE) return createDefaultCalibration(sampleRate, fftSize, confidence);

    const centersHz = { ...fallback.centersHz };
    for (const key of BAND_KEYS) {
        centersHz[key] = clamp(
            findPeakCenter(envelope, sampleRate, clampBand(SAFETY_RANGES_HZ[key], nyquist), fallback.bandsHz[key]),
            0,
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
