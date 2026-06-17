import { FeatureExtractor } from './FeatureExtractor';

export type InternalBeatKind = 'kickImpact' | 'denseImpact' | 'fxTransient' | 'genericImpact';

export function classifyBeat(frameIndex: number, features: FeatureExtractor): InternalBeatKind {
    const zcr = features.zcrT[frameIndex] || 0;
    const rolloff = features.spectralRolloffT[frameIndex] || 0;
    const bass = features.rawBassT[frameIndex] || 0;
    const high = features.rawHighT[frameIndex] || 0;
    const flux = features.typFlux > 0 ? features.fluxT[frameIndex] / features.typFlux : 0;

    if (zcr > 0.12 || (rolloff > 0.62 && high > 0.38)) return 'fxTransient';
    if (bass > 0.48 && flux > 0.25) return 'kickImpact';
    if (bass > 0.34 || flux > 0.7) return 'denseImpact';
    return 'genericImpact';
}

export function mapToPublicType(internalKind: InternalBeatKind): 1 | 2 | 3 {
    if (internalKind === 'fxTransient') return 3;
    if (internalKind === 'denseImpact') return 2;
    return 1;
}
