import { validateAnalysisSamples } from './signalContract';
import type { ResidualCandidate, ResidualOnsetAnalysis } from '../types/residualOnsets';

/** Offline v4: clean short-block model with v3 fallback; model-quality-dependent contrast and observed source-removal guard. */
export function extractResidualOnsets(samples: Float32Array, sampleRate: number): ResidualOnsetAnalysis {
    if (!Number.isSafeInteger(sampleRate) || sampleRate < 1000 || sampleRate > 384000)
        throw new Error('Residual onset sample rate must be an integer between 1000 and 384000');
    validateAnalysisSamples(samples);
    const historySamples = Math.max(1, Math.round(.030 * sampleRate));
    const lookaheadSamples = Math.max(1, Math.round(.004 * sampleRate));
    const hopSize = Math.max(1, Math.round(.002 * sampleRate));
    const contrastSamples = Math.max(1, Math.round(.002 * sampleRate));
    const minimumSeparationSamples = Math.max(1, Math.round(.003 * sampleRate));
    const frameCount = Math.ceil(samples.length / hopSize);
    const strengths = new Float64Array(frameCount);
    const proposals: (ResidualCandidate | undefined)[] = new Array(frameCount);
    const blockStats: {pp: number; pz: number; zz: number; power: number}[] = [];
    const value = (i: number) => i >= 0 ? samples[i] : 0;
    let pp = 0, pz = 0, zz = 0, power = 0, cursor = 0, active = 0;
    const update = (i: number, sign: number) => {
        const p = value(i - 1), z = value(i) + value(i - 2);
        pp += sign * p * p; pz += sign * p * z; zz += sign * z * z;
        power += sign * value(i) * value(i);
        if (p !== 0 || z !== 0 || value(i) !== 0) active += sign;
    };
    for (let frame = 0; frame < frameCount; frame++) {
        const anchor = frame * hopSize;
        while (cursor < anchor) {
            update(cursor, 1);
            if (cursor >= historySamples) update(cursor - historySamples, -1);
            cursor++;
        }
        // Bound accumulated rolling roundoff; exact observed silence must not
        // produce a fictitious background coefficient from cancellation residue.
        if (frame % 1024 === 0 && frame > 0) {
            pp = 0; pz = 0; zz = 0; power = 0; active = 0;
            for (let i = Math.max(0, anchor - historySamples); i < anchor; i++) update(i, 1);
        }
        if (active === 0) { pp = 0; pz = 0; zz = 0; power = 0; }
        const count = Math.min(anchor, historySamples);
        if (frame > 0) {
            let bpp = 0, bpz = 0, bzz = 0, bpower = 0;
            for (let i = anchor - hopSize; i < anchor; i++) {
                const p = value(i - 1), z = value(i) + value(i - 2);
                bpp += p * p; bpz += p * z; bzz += z * z; bpower += value(i) ** 2;
            }
            blockStats.push({pp: bpp, pz: bpz, zz: bzz, power: bpower});
            if (blockStats.length > Math.floor(historySamples / hopSize)) blockStats.shift();
        }
        let a = pp > 1e-30 ? Math.max(-2, Math.min(2, pz / pp)) : 2;
        const rollingA = a;
        let clean = false, cleanScore = Infinity;
        const cleanCoefficients: number[] = [];
        let selectedBlockEnd = 0;
        for (const [blockIndex, b] of blockStats.entries()) {
            if (b.pp <= 1e-30 || b.power <= 1e-30) continue;
            const ba = Math.max(-2, Math.min(2, b.pz / b.pp));
            const score = Math.max(0, b.zz - 2 * ba * b.pz + ba * ba * b.pp) / b.power;
            if (score <= 1e-5 * (8000 / sampleRate) ** 4) {
                cleanCoefficients.push(ba);
                if (score <= cleanScore) {
                    cleanScore = score; a = ba;
                    selectedBlockEnd = anchor - (blockStats.length - blockIndex - 1) * hopSize;
                }
            }
        }
        // A short polyphonic slice can look predictable by coincidence. Require
        // several independently placed blocks to agree on the recurrence.
        clean = cleanCoefficients.length >= 3
            && Math.max(...cleanCoefficients) - Math.min(...cleanCoefficients) <= 1e-6 * (8000 / sampleRate) ** 2;
        if (!clean) a = rollingA;
        const contrastStart = Math.max(0, anchor - contrastSamples);
        let before = 0;
        for (let i = contrastStart; i < anchor; i++) {
            const e = value(i) - a * value(i - 1) + value(i - 2);
            before += e * e;
        }
        before = anchor > contrastStart ? before / (anchor - contrastStart) : 0;
        const background = count ? Math.max(0, power) / count : 0;
        const modelError = count ? Math.max(0, zz - 2 * a * pz + a * a * pp) / count : 0;
        // Keep the long background guard for predictable material. On broadband
        // histories, earlier attacks otherwise mask the next short rise.
        if (!clean && modelError <= .1 * background) before = Math.max(before, modelError);
        const end = Math.min(samples.length, anchor + lookaheadSamples);
        const residual = (i: number) => value(i) - a * value(i - 1) + value(i - 2);
        let after = 0, previous = anchor ? residual(anchor - 1) ** 2 : 0;
        let maximumRise = 0, index = anchor;
        for (let i = anchor; i < end; i++) {
            const current = residual(i) ** 2;
            after += current;
            if (current - previous > maximumRise) { maximumRise = current - previous; index = i; }
            previous = current;
        }
        after /= end - anchor;
        const floor = Math.max(1e-20, background * 1e-5 * (8000 / sampleRate) ** 2);
        if (maximumRise <= 0 || after < 8 * Math.max(before, 1e-20) || after < floor) continue;
        // A model discontinuity at a cutoff is not an added attack. Require real
        // continuation when the observed past was active; never treat missing tail as silence.
        let continuationPower = 0;
        for (let i = index + 2; i < end; i++) continuationPower += samples[i] * samples[i];
        if (background > 1e-18 && end - index > 3 && continuationPower / (end - index - 2) <= 1e-20) continue;
        // Removal of a source can make a large innovation spike while the
        // continuing signal becomes easier to predict. Compare only observed
        // innovation beyond the two-sample model memory, using the same model.
        let continuationInnovation = 0;
        for (let i = index + 3; i < end; i++) continuationInnovation += residual(i) ** 2;
        if (end - index > 3 && before > 1e-20
            && continuationInnovation / (end - index - 3) < before / 8) continue;
        const strength = after - 8 * before;
        if (strength <= 0) continue;
        strengths[frame] = strength;
        proposals[frame] = {time: index / sampleRate, sampleIndex: index, proposalSample: anchor, strength,
            innovationRatio: after / Math.max(before, 1e-20), predictorCoefficient: a,
            supportStartSample: Math.max(0, anchor - historySamples - 2), supportEndSample: end,
            endpointAmbiguous: anchor < historySamples + 2 || end - anchor < lookaheadSamples,
            backgroundModel: clean ? 'clean-block' : 'rolling', modelBlockCount: cleanCoefficients.length,
            predictorSupportStartSample: clean ? Math.max(0, selectedBlockEnd - hopSize - 2) : Math.max(0, anchor - historySamples - 2),
            predictorSupportEndSample: clean ? selectedBlockEnd : anchor};
    }
    const peaks: ResidualCandidate[] = [];
    for (let frame = 0; frame < frameCount; frame++) {
        if (proposals[frame] && strengths[frame] >= (strengths[frame - 1] ?? 0)
            && strengths[frame] > (strengths[frame + 1] ?? 0)) peaks.push(proposals[frame]!);
    }
    const separation = minimumSeparationSamples;
    peaks.sort((a, b) => b.strength - a.strength || a.sampleIndex - b.sampleIndex);
    const cells = new Map<number, ResidualCandidate>();
    for (const p of peaks) {
        const cell = Math.floor(p.sampleIndex / separation);
        if ([-1, 0, 1].some(offset => {
            const neighbor = cells.get(cell + offset);
            return neighbor && Math.abs(neighbor.sampleIndex - p.sampleIndex) < separation;
        })) continue;
        cells.set(cell, p);
    }
    const candidates = Array.from(cells.values()).sort((a, b) => a.sampleIndex - b.sampleIndex);
    return {algorithm: 'residual-innovation-v4', sampleRate, sampleCount: samples.length,
        historySamples, lookaheadSamples, hopSize, contrastSamples, minimumSeparationSamples, backgroundEstimator: 'clean-block-or-rolling', timestamp: 'refined-sample',
        localization: 'maximum-positive-innovation-power-step', selection: 'candidate-only', candidates};
}
