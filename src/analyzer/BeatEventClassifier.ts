import { FeatureExtractor } from './FeatureExtractor';

export type InternalBeatKind = 'kickImpact' | 'denseImpact' | 'fxTransient' | 'genericImpact';

export function classifyBeat(frameIndex: number, features: FeatureExtractor): InternalBeatKind {
    const zcr = features.zcrT[frameIndex] || 0;
    const rolloff = features.spectralRolloffT[frameIndex] || 0;
    const bass = features.rawBassT[frameIndex] || 0;
    const high = features.rawHighT[frameIndex] || 0;
    const percussive = features.percussiveT[frameIndex] || 0;
    const lowFlux = features.fluxLowT[frameIndex] || 0;
    const midFlux = features.fluxMidT[frameIndex] || 0;
    const highFlux = features.fluxHighT[frameIndex] || 0;
    const totalFlux = lowFlux + midFlux + highFlux + 1e-6;
    const bassFluxShare = lowFlux / totalFlux;
    const highFluxShare = highFlux / totalFlux;
    const bassAttack = percussive * clampUnit(bassFluxShare * 2.5) * clampUnit(0.25 + bass * 0.9);
    const highTransient = percussive * clampUnit(highFluxShare * 2.2 + high * 0.45 + zcr * 0.8 + rolloff * 0.15);

    if (percussive > 0.55 && bassAttack > 0.35) return 'kickImpact';
    if (percussive > 0.65 && highTransient > 0.25) return 'fxTransient';
    if (percussive > 0.5) return 'denseImpact';
    return 'genericImpact';
}

export function mapToPublicType(internalKind: InternalBeatKind): 1 | 2 | 3 {
    if (internalKind === 'fxTransient') return 3;
    if (internalKind === 'denseImpact') return 2;
    return 1;
}

function clampUnit(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
