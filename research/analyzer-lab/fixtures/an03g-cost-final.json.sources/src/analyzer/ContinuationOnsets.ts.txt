import {extractDifferenceOnsets} from './DifferenceOnsets';
import type {DifferenceCandidate} from '../types/differenceOnsets';
import type {ContinuationOnsetAnalysis, ContinuationRejection} from '../types/continuationOnsets';

/** Research-only continuation gate. Does not publish accepted musical events. */
export function extractContinuationOnsets(samples: Float32Array, sampleRate: number): ContinuationOnsetAnalysis {
    const base = extractDifferenceOnsets(samples, sampleRate);
    const value = (i: number) => i >= 0 ? samples[i] : 0;
    const residual = (i: number) => (value(i) - 4 * value(i - 1) + 6 * value(i - 2)
        - 4 * value(i - 3) + value(i - 4)) / 16;
    const directionalWindowSamples = Math.max(1, Math.round(.012 * sampleRate));
    const candidates: DifferenceCandidate[] = [], rejected: ContinuationRejection[] = [];
    for (const p of base.candidates) {
        const start = Math.max(0, p.proposalSample - base.historySamples);
        let raw = 0, continuation = 0;
        for (let i = start; i < p.proposalSample; i++) raw += samples[i] ** 2;
        raw = p.proposalSample > start ? raw / (p.proposalSample - start) : 0;
        const end = Math.min(samples.length, p.sampleIndex + 5 + base.contrastSamples);
        for (let i = p.sampleIndex + 5; i < end; i++) continuation += residual(i) ** 2;
        const count = Math.max(0, end - p.sampleIndex - 5);
        const floor = Math.max(1e-20, raw * 1e-5 * (8000 / sampleRate) ** 2);
        const directionalWindow = directionalWindowSamples;
        const second = (i: number) => (value(i) - 2 * value(i - 1) + value(i - 2)) / 4;
        let beforeSecond = 0, afterSecond = 0;
        const beforeStart = Math.max(0, p.sampleIndex - directionalWindow);
        const afterStart = p.sampleIndex + 5;
        const afterEnd = Math.min(samples.length, afterStart + directionalWindow);
        for (let i = beforeStart; i < p.sampleIndex; i++) beforeSecond += second(i) ** 2;
        for (let i = afterStart; i < afterEnd; i++) afterSecond += second(i) ** 2;
        beforeSecond /= Math.max(1, p.sampleIndex - beforeStart);
        afterSecond /= Math.max(1, afterEnd - afterStart);
        const complete = p.sampleIndex >= directionalWindow && afterEnd - afterStart === directionalWindow;
        const assessed = {...p, supportStartSample: Math.min(p.supportStartSample, Math.max(0, beforeStart - 2)),
            supportEndSample: Math.max(p.supportEndSample, afterEnd),
            endpointAmbiguous: p.endpointAmbiguous || !complete};
        if (p.evidenceSource === 'residual-v4-confirmed' && complete && count > 0 && continuation / count < floor
            && raw > 1e-18 && afterSecond < beforeSecond) {
            rejected.push({candidate: assessed, reason: 'weak-continuation-with-falling-curvature-power',
                continuationPower: continuation / count, continuationFloor: floor, beforeSecondPower: beforeSecond,
                afterSecondPower: afterSecond});
        } else candidates.push(assessed);
    }
    return {...base, algorithm: 'experimental-continuation-v6' as const,
        lookaheadSamples: Math.max(base.lookaheadSamples, base.refinementSamples + 5 + directionalWindowSamples),
        directionalWindowSamples, directionalFilterCoefficients: [.25, -.5, .25], candidates, rejected};
}
