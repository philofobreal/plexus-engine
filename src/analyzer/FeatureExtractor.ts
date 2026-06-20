import type { SpectralCalibration } from './SpectralCalibration';
import { FFT } from './math/FFT';

export interface FrequencyBand {
    min: number;
    max: number;
}

export type FrequencyBandKey = 'sub' | 'bass' | 'lowMid' | 'mid' | 'presence' | 'brilliance' | 'air';

export type FrequencyBands = Record<FrequencyBandKey, FrequencyBand>;

export const DEFAULT_FREQUENCY_BANDS_HZ: FrequencyBands = {
    sub: { min: 20, max: 60 },
    bass: { min: 60, max: 180 },
    lowMid: { min: 180, max: 500 },
    mid: { min: 500, max: 2000 },
    presence: { min: 2000, max: 5000 },
    brilliance: { min: 5000, max: 12000 },
    air: { min: 12000, max: 16000 }
};

const EPSILON = 1e-6;

function sanitizeBand(band: FrequencyBand, nyquist: number): FrequencyBand {
    const min = Math.min(Math.max(0, band.min), nyquist);
    const max = Math.min(Math.max(min, band.max), nyquist);
    return { min, max };
}

function cloneBandsForNyquist(bands: FrequencyBands, nyquist: number): FrequencyBands {
    return {
        sub: sanitizeBand(bands.sub, nyquist),
        bass: sanitizeBand(bands.bass, nyquist),
        lowMid: sanitizeBand(bands.lowMid, nyquist),
        mid: sanitizeBand(bands.mid, nyquist),
        presence: sanitizeBand(bands.presence, nyquist),
        brilliance: sanitizeBand(bands.brilliance, nyquist),
        air: sanitizeBand(bands.air, nyquist)
    };
}

export class FeatureExtractor {
    private channel: Float32Array;
    private sampleRate: number;
    private hopSize: number;
    private nyquist: number;
    private binHz: number;
    private bandsHz: FrequencyBands;
    public totalFrames: number;
    public rmsT: Float32Array;
    public fluxT: Float32Array;
    public subT: Float32Array;
    public bassT: Float32Array;
    public lowMidT: Float32Array;
    public midT: Float32Array;
    public presenceT: Float32Array;
    public brillianceT: Float32Array;
    public airT: Float32Array;
    public rawBassT: Float32Array;
    public rawMidT: Float32Array;
    public rawHighT: Float32Array;
    public centroidT: Float32Array;
    public flatnessT: Float32Array;
    public pitchConfidenceT: Float32Array;
    public zcrT: Float32Array;
    public spectralRolloffT: Float32Array;
    public spectralCrestT: Float32Array;
    // Multi-band half-wave-rectified spectral flux (raw, per band) plus a normalized
    // combined onset envelope. Additive outputs consumed by tempo/grid estimation;
    // the legacy single-band `fluxT` is left untouched for backward compatibility.
    public fluxLowT: Float32Array;
    public fluxMidT: Float32Array;
    public fluxHighT: Float32Array;
    public onsetEnvT: Float32Array;
    public typRms: number = 0;
    public typFlux: number = 0;
    public typOnset: number = 0;

    constructor(channel: Float32Array, sampleRate: number, hopSize: number, calibration?: SpectralCalibration) {
        this.channel = channel;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
        this.nyquist = this.sampleRate / 2;
        this.binHz = this.sampleRate / hopSize;
        this.bandsHz = cloneBandsForNyquist(calibration?.bandsHz ?? DEFAULT_FREQUENCY_BANDS_HZ, this.nyquist);
        this.totalFrames = Math.floor(channel.length / hopSize);
        this.rmsT = new Float32Array(this.totalFrames);
        this.fluxT = new Float32Array(this.totalFrames);
        this.subT = new Float32Array(this.totalFrames);
        this.bassT = new Float32Array(this.totalFrames);
        this.lowMidT = new Float32Array(this.totalFrames);
        this.midT = new Float32Array(this.totalFrames);
        this.presenceT = new Float32Array(this.totalFrames);
        this.brillianceT = new Float32Array(this.totalFrames);
        this.airT = new Float32Array(this.totalFrames);
        this.rawBassT = new Float32Array(this.totalFrames);
        this.rawMidT = new Float32Array(this.totalFrames);
        this.rawHighT = new Float32Array(this.totalFrames);
        this.centroidT = new Float32Array(this.totalFrames);
        this.flatnessT = new Float32Array(this.totalFrames);
        this.pitchConfidenceT = new Float32Array(this.totalFrames);
        this.zcrT = new Float32Array(this.totalFrames);
        this.spectralRolloffT = new Float32Array(this.totalFrames);
        this.spectralCrestT = new Float32Array(this.totalFrames);
        this.fluxLowT = new Float32Array(this.totalFrames);
        this.fluxMidT = new Float32Array(this.totalFrames);
        this.fluxHighT = new Float32Array(this.totalFrames);
        this.onsetEnvT = new Float32Array(this.totalFrames);
    }

    public process(onProgress?: (p: number) => void): void {
        const N = this.hopSize;
        const fft = new FFT(N);
        const re = fft.re;
        const im = fft.im;
        const prevMag = new Float32Array(N / 2);
        const mags = new Float32Array(N / 2);
        let lastReportedProgress = -1;

        for (let i = 0; i < this.totalFrames; i++) {
            let start = i * this.hopSize;
            let sumE = 0;
            let zeroCrossings = 0;
            let prevSample = this.channel[start] || 0;
            for (let j = 0; j < this.hopSize; j++) {
                let sample = this.channel[start + j] || 0;
                sumE += sample * sample;
                if (j > 0 && ((prevSample < 0 && sample >= 0) || (prevSample >= 0 && sample < 0))) zeroCrossings++;
                prevSample = sample;
                re[j] = sample * fft.window[j];
                im[j] = 0;
            }
            this.rmsT[i] = Math.sqrt(sumE / this.hopSize);
            this.zcrT[i] = zeroCrossings / Math.max(1, this.hopSize - 1);

            fft.transform();

            let sumMag = 0, sumFreqMag = 0, sumLogMag = 0;
            let currentFlux = 0, eSub = 0, eBass = 0, eLowMid = 0, eMid = 0, ePresence = 0, eBrilliance = 0, eAir = 0;
            let fluxLow = 0, fluxMid = 0, fluxHigh = 0;
            let maxMag = 0;
            let activeBins = 0;

            for (let k = 1; k < N / 2; k++) {
                let mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                mags[k] = mag;
                const hz = k * this.binHz;
                const fluxDiff = Math.max(0, mag - prevMag[k]);
                prevMag[k] = mag;
                if (hz > this.nyquist) continue;
                activeBins++;
                sumMag += mag;
                sumFreqMag += hz * mag;
                sumLogMag += Math.log(mag + EPSILON);
                if (mag > maxMag) maxMag = mag;

                currentFlux += fluxDiff;
                // Split half-wave-rectified flux into low/mid/high onset bands so that
                // kick transients and hi-hat transients are detected independently.
                if (hz < 200) fluxLow += fluxDiff;
                else if (hz < 2000) fluxMid += fluxDiff;
                else fluxHigh += fluxDiff;

                if (hz >= this.bandsHz.sub.min && hz < this.bandsHz.sub.max) eSub += mag;
                else if (hz >= this.bandsHz.bass.min && hz < this.bandsHz.bass.max) eBass += mag;
                else if (hz >= this.bandsHz.lowMid.min && hz < this.bandsHz.lowMid.max) eLowMid += mag;
                else if (hz >= this.bandsHz.mid.min && hz < this.bandsHz.mid.max) eMid += mag;
                else if (hz >= this.bandsHz.presence.min && hz < this.bandsHz.presence.max) ePresence += mag;
                else if (hz >= this.bandsHz.brilliance.min && hz < this.bandsHz.brilliance.max) eBrilliance += mag;
                else if (hz >= this.bandsHz.air.min && hz <= this.bandsHz.air.max) eAir += mag;
            }

            const rolloffTarget = sumMag * 0.85;
            let cumulativeMag = 0;
            let rolloffBin = 0;
            if (sumMag > 0) {
                for (let k = 1; k < N / 2; k++) {
                    cumulativeMag += mags[k];
                    if (cumulativeMag >= rolloffTarget) {
                        rolloffBin = k;
                        break;
                    }
                }
            }

            this.fluxT[i] = currentFlux;
            this.fluxLowT[i] = fluxLow;
            this.fluxMidT[i] = fluxMid;
            this.fluxHighT[i] = fluxHigh;
            let totalBand = eSub + eBass + eLowMid + eMid + ePresence + eBrilliance + eAir + EPSILON;
            this.subT[i] = eSub / totalBand;
            this.bassT[i] = eBass / totalBand;
            this.lowMidT[i] = eLowMid / totalBand;
            this.midT[i] = eMid / totalBand;
            this.presenceT[i] = ePresence / totalBand;
            this.brillianceT[i] = eBrilliance / totalBand;
            this.airT[i] = eAir / totalBand;
            const rawBass = eSub + eBass;
            const rawMid = eLowMid + eMid + ePresence * 0.5;
            const rawHigh = ePresence * 0.5 + eBrilliance + eAir;
            const totalCompat = rawBass + rawMid + rawHigh + EPSILON;
            this.rawBassT[i] = rawBass / totalCompat;
            this.rawMidT[i] = rawMid / totalCompat;
            this.rawHighT[i] = rawHigh / totalCompat;

            const meanMag = activeBins > 0 ? sumMag / activeBins : 0;
            this.centroidT[i] = sumMag > 0 && this.nyquist > 0 ? (sumFreqMag / sumMag) / this.nyquist : 0;
            this.flatnessT[i] = sumMag > 0 && meanMag > 0 ? Math.exp(sumLogMag / Math.max(1, activeBins)) / meanMag : 0;
            this.pitchConfidenceT[i] = Math.min(1, Math.max(0, 1 - this.flatnessT[i]));
            this.spectralRolloffT[i] = this.nyquist > 0 ? Math.min(1, (rolloffBin * this.binHz) / this.nyquist) : 0;
            this.spectralCrestT[i] = sumMag > 0 && meanMag > 0 ? maxMag / meanMag : 0;

            if (onProgress && this.totalFrames > 0) {
                const p = (i + 1) / this.totalFrames;
                if (p - lastReportedProgress >= 0.02) {
                    onProgress(p);
                    lastReportedProgress = p;
                }
            }
        }

        const getTypicalMax = (arr: Float32Array) => {
            let sorted = new Float32Array(arr).sort();
            return sorted[Math.floor(sorted.length * 0.98)] || 0.001;
        };
        this.typRms = getTypicalMax(this.rmsT);
        this.typFlux = getTypicalMax(this.fluxT);

        // Combined onset envelope: normalize each band by its own typical level so that a
        // quiet hi-hat transient and a loud kick transient contribute comparably, then sum.
        // This yields a band-balanced "transient strength over time" curve for tempo/grid
        // estimation that is robust to spectral tilt and per-track mix differences.
        const typLow = getTypicalMax(this.fluxLowT);
        const typMid = getTypicalMax(this.fluxMidT);
        const typHigh = getTypicalMax(this.fluxHighT);
        for (let i = 0; i < this.totalFrames; i++) {
            const low = this.fluxLowT[i] / typLow;
            const mid = this.fluxMidT[i] / typMid;
            const high = this.fluxHighT[i] / typHigh;
            // Low band weighted highest (kick is the primary metric anchor in EDM),
            // high band lowest (hats are dense and noisy).
            this.onsetEnvT[i] = low * 1.0 + mid * 0.7 + high * 0.4;
        }
        this.typOnset = getTypicalMax(this.onsetEnvT);
    }
}

