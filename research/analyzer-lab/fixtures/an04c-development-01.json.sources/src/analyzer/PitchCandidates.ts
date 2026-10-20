import type { AcousticEvidenceIdentity } from '../types/acousticEvidence';
import type { PitchCandidateAnalysis, PitchPeriodCandidate } from '../types/pitchCandidates';
import type { MusicalPartObservation } from '../types/musicalEntities';

/** Raw periodicity hypotheses. No isolation, F0 input, note boundary or source identity is supplied. */
export function extractPitchCandidates(samples: Float32Array, identity: AcousticEvidenceIdentity): PitchCandidateAnalysis {
    const fs = identity.sampleRate;
    if (!/^[a-f0-9]{64}$/.test(identity.pcmSha256) || !Number.isSafeInteger(fs) || fs < 8000 || fs > 96000
        || identity.sampleCount !== samples.length || !samples.length
        || !Number.isFinite(identity.timelineOffsetSeconds) || identity.timelineOffsetSeconds < 0
        || !Number.isFinite(identity.timelineOffsetSeconds + samples.length / fs)) throw new Error('Invalid pitch PCM clock');
    for (const x of samples) if (!Number.isFinite(x)) throw new Error('Nonfinite pitch PCM');
    const frameLength = 2 ** Math.ceil(Math.log2(.08 * fs)), hopLength = Math.round(.02 * fs);
    const frameCount = Math.max(0, 1 + Math.floor((samples.length - frameLength) / hopLength));
    const minLag = Math.max(2, Math.ceil(fs / 1000)), maxLag = Math.floor(fs / 80);
    const width = frameLength - maxLag - 1;
    if (frameCount > 4096 || frameCount * (maxLag + 1) * width > 350000000) throw new Error('Pitch work budget exceeded');
    const result: PitchCandidateAnalysis = { algorithm: 'experimental-pitch-periodicity-v1', identity: { ...identity },
        frameLength, hopLength, rangeHz: [80, 1000], status: frameCount ? 'available' : 'insufficient-support',
        unobservedTailSamples: frameCount ? samples.length - ((frameCount - 1) * hopLength + frameLength) : samples.length,
        confidence: null, sourceIsolation: 'unverified-mixture', frames: [] };
    const normalized = new Float64Array(maxLag + 2);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        const start = frameIndex * hopLength;
        let mean = 0, energy = 0;
        for (let i = 0; i < frameLength; i++) mean += samples[start + i];
        mean /= frameLength;
        for (let i = 0; i < frameLength; i++) energy += (samples[start + i] - mean) ** 2;
        const rmsAmplitude = Math.sqrt(energy / frameLength), candidates: PitchPeriodCandidate[] = [];
        if (rmsAmplitude > 1e-6) {
            let cumulative = 0;
            normalized[0] = 1;
            for (let lag = 1; lag <= maxLag + 1; lag++) {
                let d = 0;
                for (let i = 0; i < width; i++) d += (samples[start + i] - samples[start + i + lag]) ** 2;
                cumulative += d;
                normalized[lag] = cumulative > 0 ? d * lag / cumulative : 1;
            }
            for (let lag = minLag; lag <= maxLag; lag++) {
                const left = normalized[lag - 1], value = normalized[lag], right = normalized[lag + 1];
                if (value > .15 || value > left || value >= right) continue;
                const denominator = left - 2 * value + right;
                const shift = denominator > 0 ? Math.max(-.5, Math.min(.5, .5 * (left - right) / denominator)) : 0;
                const frequencyHz = fs / (lag + shift);
                if (frequencyHz < 80 || frequencyHz > 1000) continue;
                candidates.push({ frequencyHz, integerLagFrequencyHz: fs / lag, normalizedDifference: value });
                if (candidates.length === 3) break;
            }
        }
        result.frames.push({ frameIndex, supportStartSample: start, supportEndSample: start + frameLength,
            rmsAmplitude, primary: candidates[0] ? { ...candidates[0] } : null,
            alternatives: candidates.slice(1).map(c => ({ ...c })),
            reason: rmsAmplitude <= 1e-6 ? 'below-floor' : candidates.length ? 'periodicity-proposal' : 'no-periodic-trough' });
    }
    return result;
}

/** A pitch proposal does not certify an isolated part, even after library agreement. */
export function pitchCandidatesToUnresolvedParts(analysis: PitchCandidateAnalysis): MusicalPartObservation[] {
    if (analysis.algorithm !== 'experimental-pitch-periodicity-v1' || analysis.sourceIsolation !== 'unverified-mixture'
        || analysis.confidence !== null || analysis.frames.length > 4096) throw new Error('Invalid pitch adapter contract');
    return analysis.frames.filter(f => f.primary !== null).map(f => ({ id: `pitch-window-${f.supportStartSample}`,
        startSample: f.supportStartSample, endSample: f.supportEndSample, kind: 'unresolved-mixture',
        timbre: null, notes: [], notesOrigin: 'unqualified-estimate' }));
}
