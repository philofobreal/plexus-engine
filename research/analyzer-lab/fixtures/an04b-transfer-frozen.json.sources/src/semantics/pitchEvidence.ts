import type { PitchCandidateAnalysis, PairedPitchReference } from '../types/pitchCandidates';

/** Same-window frequency agreement; never convert it into source/voice/note certainty. */
export function assessPitchCandidates(analysis: PitchCandidateAnalysis, references: readonly PairedPitchReference[]): {
    toleranceCents: 25; qualifiedFrameIndices: number[]; uncoveredReferenceCount: number;
    unqualifiedAreNegatives: false; confidence: null; consumerUse: 'diagnostic-only'; xrScoring: 'ineligible';
} {
    if (analysis.algorithm !== 'experimental-pitch-periodicity-v1' || analysis.confidence !== null
        || analysis.sourceIsolation !== 'unverified-mixture') throw new Error('Invalid pitch analysis contract');
    const qualifiedFrameIndices: number[] = [], used = new Set<number>();
    for (const r of references) {
        const frame = analysis.frames[r.frameIndex];
        if (!Number.isSafeInteger(r.frameIndex) || used.has(r.frameIndex) || !frame || frame.frameIndex !== r.frameIndex
            || r.supportStartSample !== frame.supportStartSample || r.supportEndSample !== frame.supportEndSample
            || !r.identity || Object.keys(analysis.identity).some(k => r.identity[k as keyof typeof r.identity] !== analysis.identity[k as keyof typeof analysis.identity])
            || r.evidenceType !== 'pseudo_label' || r.acceptance !== 'two-library-agreement' || r.confidence !== null
            || r.groundTruthStatus !== false || r.votes.length !== 2 || r.votes[0].provider === r.votes[1].provider
            || r.votes.some(v => !['librosa-yin', 'audioflux-ncf'].includes(v.provider) || !Number.isFinite(v.frequencyHz)
                || v.frequencyHz < analysis.rangeHz[0] || v.frequencyHz > analysis.rangeHz[1])
            || cents(r.votes[0].frequencyHz, r.votes[1].frequencyHz) > 25) throw new Error('Invalid paired pitch reference');
        used.add(r.frameIndex);
        if (frame.primary && r.votes.every(v => cents(v.frequencyHz, frame.primary!.frequencyHz) <= 25))
            qualifiedFrameIndices.push(r.frameIndex);
    }
    return { toleranceCents: 25, qualifiedFrameIndices: qualifiedFrameIndices.sort((a, b) => a - b),
        uncoveredReferenceCount: references.length - qualifiedFrameIndices.length, unqualifiedAreNegatives: false,
        confidence: null, consumerUse: 'diagnostic-only', xrScoring: 'ineligible' };
}

const cents = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));
