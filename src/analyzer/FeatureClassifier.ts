import { clampUnit } from './utils';
import type { SpectralCalibration } from './SpectralCalibration';

const SILENCE_RMS_THRESHOLD = 1e-4;

export interface FeatureClassifierInput {
    rms: Float32Array;
    rawRms?: Float32Array;
    flux: Float32Array;
    sub: Float32Array;
    bass: Float32Array;
    lowMid: Float32Array;
    mid: Float32Array;
    presence: Float32Array;
    brilliance: Float32Array;
    air: Float32Array;
    high: Float32Array;
    centroid: Float32Array;
    flatness: Float32Array;
    zcr: Float32Array;
    rolloff: Float32Array;
    crest: Float32Array;
    calibration?: SpectralCalibration;
}

export class FeatureClassifier {
    private input: FeatureClassifierInput;

    constructor(input: FeatureClassifierInput) {
        this.input = input;
    }

    public classifyFrames(): Record<string, Float32Array> {
        const count = this.input.rms.length;
        const melodyRaw = new Float32Array(count);
        const vocalRaw = new Float32Array(count);
        const fxRaw = new Float32Array(count);
        const densityRaw = new Float32Array(count);
        const brightnessRaw = new Float32Array(count);
        const tensionRaw = new Float32Array(count);
        const calibrationConfidence = clampUnit(this.input.calibration?.confidence ?? 0);
        const vocalPresenceWeight = 0.22 + calibrationConfidence * 0.03;
        const vocalAirPenalty = 0.10 + calibrationConfidence * 0.02;

        for (let i = 0; i < count; i++) {
            const rawRms = this.input.rawRms?.[i] ?? this.input.rms[i];
            const flux = this.input.flux[i];
            const sub = clampUnit(this.input.sub[i]);
            const bass = this.input.bass[i];
            const lowMid = clampUnit(this.input.lowMid[i]);
            const mid = this.input.mid[i];
            const presence = clampUnit(this.input.presence[i]);
            const brilliance = clampUnit(this.input.brilliance[i]);
            const air = clampUnit(this.input.air[i]);
            const high = this.input.high[i];
            const centroid = this.input.centroid[i];
            const flatness = clampUnit(this.input.flatness[i]);
            const tonal = 1 - flatness;
            const zcr = clampUnit(this.input.zcr[i] * 7);
            const rolloff = clampUnit(this.input.rolloff[i] * 1.25);
            const crest = clampUnit(this.input.crest[i] / 12);
            const highRatio = clampUnit(brilliance * 0.8 + air * 1.2 + high * 0.35);
            const melodicBand = clampUnit(mid * 0.42 + presence * 0.22 + lowMid * 0.16 + brilliance * 0.08 - bass * 0.10 - sub * 0.15);
            const silenceGate = rawRms > SILENCE_RMS_THRESHOLD ? 1 : 0;

            densityRaw[i] = clampUnit(flux) * silenceGate;
            brightnessRaw[i] = clampUnit(centroid * 2.15 + rolloff * 0.18 + brilliance * 0.22 + air * 0.30) * silenceGate;
            fxRaw[i] = clampUnit(highRatio * 0.42 + zcr * 0.26 + flatness * 0.24 + rolloff * 0.08 - tonal * 0.08) * silenceGate;
            melodyRaw[i] = clampUnit(melodicBand * 0.58 + tonal * 0.24 + crest * 0.18 - zcr * 0.14 - flatness * 0.08) * silenceGate;
            vocalRaw[i] = clampUnit(lowMid * 0.26 + mid * 0.34 + presence * vocalPresenceWeight + tonal * 0.22 - zcr * 0.20 - air * vocalAirPenalty - sub * 0.18) * silenceGate;
            tensionRaw[i] = clampUnit(densityRaw[i] * 0.5 + brightnessRaw[i] * 0.5);
        }

        return { melodyRaw, vocalRaw, fxRaw, densityRaw, brightnessRaw, tensionRaw };
    }
}
