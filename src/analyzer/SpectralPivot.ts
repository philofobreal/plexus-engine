import type { AudioFrame, VisualFeatureFrame } from '../types';

export function applySpectralPivot(
    featureFrames: VisualFeatureFrame[],
    outFrames: AudioFrame[],
    buildupConfidence: number[],
    totalFrames: number
): number[] {
    const spectralPivot = new Array<number>(totalFrames).fill(0);

    for (let i = 0; i < totalFrames; i++) {
        const eRatio = outFrames[i].eRatio;
        const buildup = buildupConfidence[i] || 0;
        const state = outFrames[i].state;
        const sE = outFrames[i].e;
        if (sE > 0.04 && eRatio < 0.55 && (buildup > 0.1 || state === 'LOW_DROP')) {
            const compensation = (1.0 - eRatio) * Math.max(buildup, 0.25);
            const melodyGate = Math.max(0, featureFrames[i].melody - 0.05) * 1.1;
            const vocalGate = Math.max(0, featureFrames[i].vocal - 0.05) * 1.1;
            const fxGate = Math.max(0, featureFrames[i].fx - 0.05) * 1.1;
            const maxCeiling = Math.min(1.0, 0.35 + eRatio * 0.65 + buildup * 0.40);
            if (melodyGate > 0) featureFrames[i].melody = Math.min(maxCeiling, featureFrames[i].melody * (1.0 + compensation * 1.5 * melodyGate));
            if (vocalGate > 0) featureFrames[i].vocal = Math.min(maxCeiling, featureFrames[i].vocal * (1.0 + compensation * 1.5 * vocalGate));
            if (fxGate > 0) featureFrames[i].fx = Math.min(maxCeiling, featureFrames[i].fx * (1.0 + compensation * 2.2 * fxGate));
            featureFrames[i].tension = Math.min(maxCeiling, featureFrames[i].tension * (1.0 + compensation * 1.2));
            outFrames[i].melodyProj = featureFrames[i].melody;
            spectralPivot[i] = Math.min(1.0, compensation * Math.max(melodyGate, vocalGate, fxGate, 0.25));
        } else if (sE <= 0.04) {
            featureFrames[i].melody = 0;
            featureFrames[i].vocal = 0;
            featureFrames[i].fx = 0;
            featureFrames[i].tension = 0;
            outFrames[i].melodyProj = 0;
            outFrames[i].fxProj = 0;
            spectralPivot[i] = 0;
        }
    }

    return spectralPivot;
}
