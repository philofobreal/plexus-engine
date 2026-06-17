import { clampUnit } from './utils';

export interface FeatureClassifierInput {
    rms: Float32Array;
    flux: Float32Array;
    bass: Float32Array;
    mid: Float32Array;
    high: Float32Array;
    centroid: Float32Array;
    flatness: Float32Array;
    zcr: Float32Array;
    rolloff: Float32Array;
    crest: Float32Array;
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

        for (let i = 0; i < count; i++) {
            const flux = this.input.flux[i];
            const bass = this.input.bass[i];
            const mid = this.input.mid[i];
            const high = this.input.high[i];
            const centroid = this.input.centroid[i];
            const flatness = clampUnit(this.input.flatness[i]);
            const tonal = 1 - flatness;
            const zcr = clampUnit(this.input.zcr[i] * 7);
            const rolloff = clampUnit(this.input.rolloff[i] * 1.25);
            const crest = clampUnit(this.input.crest[i] / 12);
            const highRatio = clampUnit(high * 1.45);
            const midHighDominance = clampUnit((mid + high * 0.65 - bass * 0.35) * 1.15);

            densityRaw[i] = clampUnit(flux);
            brightnessRaw[i] = clampUnit(centroid * 3.0 + rolloff * 0.18);
            fxRaw[i] = clampUnit(highRatio * 0.55 + zcr * 0.24 + flatness * 0.16 + rolloff * 0.05);
            melodyRaw[i] = clampUnit(midHighDominance * 0.90 + crest * 0.20 + tonal * 0.15);
            vocalRaw[i] = clampUnit(mid * 1.30 + tonal * 0.30 + crest * 0.15 - zcr * 0.26 - high * 0.18);
            tensionRaw[i] = clampUnit(densityRaw[i] * 0.5 + brightnessRaw[i] * 0.5);
        }

        return { melodyRaw, vocalRaw, fxRaw, densityRaw, brightnessRaw, tensionRaw };
    }
}
