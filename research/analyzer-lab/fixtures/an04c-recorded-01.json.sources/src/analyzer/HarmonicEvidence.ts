import type { PitchCandidateAnalysis } from '../types/pitchCandidates';
import type { HarmonicResidual, HarmonicEvidence } from '../types/harmonicEvidence';

/** Prefix-fitted stationary harmonic model; suffix is never used for fitting. */
export function fitHarmonicResidual(samples: Float32Array, sampleRate: number, frequencyHz: number): HarmonicResidual {
    if (!Number.isSafeInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000
        || !Number.isFinite(frequencyHz) || frequencyHz < 80 || frequencyHz > 1000
        || samples.length < 32 || samples.length > 16384) throw new Error('Invalid harmonic model input');
    for (const x of samples) if (!Number.isFinite(x)) throw new Error('Nonfinite harmonic PCM');
    let harmonics = 0;
    while (harmonics < 8 && (harmonics + 1) * frequencyHz < .4 * sampleRate) harmonics++;
    const trainingSamples = Math.floor(2 * samples.length / 3);
    let mean = 0;
    for (let i = 0; i < trainingSamples; i++) mean += samples[i];
    mean /= trainingSamples;
    let fitEnergy = 0, testEnergy = 0;
    for (let i = 0; i < samples.length; i++) {
        if (i < trainingSamples) fitEnergy += (samples[i] - mean) ** 2;
        else testEnergy += (samples[i] - mean) ** 2;
    }
    const result: HarmonicResidual = { harmonics, trainingSamples, fitResidualFraction: null,
        heldOutResidualFraction: null, independentColumnFitResidual: null, independentColumnHeldOutResidual: null,
        status: 'below-floor' };
    if (fitEnergy / trainingSamples <= 1e-12 || testEnergy / (samples.length - trainingSamples) <= 1e-12) return result;
    const model = new Float64Array(samples.length), independent = new Float64Array(samples.length);
    const basis: Float64Array[] = [];
    for (let column = 0; column <= 2 * harmonics; column++) {
        const vector = new Float64Array(samples.length);
        const harmonic = Math.ceil(column / 2), omega = 2 * Math.PI * frequencyHz * harmonic / sampleRate;
        for (let i = 0; i < samples.length; i++) vector[i] = column === 0 ? 1
            : column % 2 ? Math.cos(omega * i) : Math.sin(omega * i);
        let originalNormSquared = 0, independentDot = 0;
        for (let i = 0; i < trainingSamples; i++) {
            originalNormSquared += vector[i] ** 2; independentDot += vector[i] * (samples[i] - mean);
        }
        for (let i = 0; i < samples.length; i++) independent[i] += vector[i] * independentDot / originalNormSquared;
        // Two passes suppress loss of orthogonality. Prefix determines ALL coefficients.
        for (let pass = 0; pass < 2; pass++) for (const q of basis) {
            let dot = 0;
            for (let i = 0; i < trainingSamples; i++) dot += vector[i] * q[i];
            for (let i = 0; i < samples.length; i++) vector[i] -= dot * q[i];
        }
        let normSquared = 0;
        for (let i = 0; i < trainingSamples; i++) normSquared += vector[i] ** 2;
        if (Math.sqrt(normSquared / originalNormSquared) <= 1e-10) return { ...result, status: 'rank-deficient' };
        const norm = Math.sqrt(normSquared);
        let coefficient = 0;
        for (let i = 0; i < samples.length; i++) vector[i] /= norm;
        for (let i = 0; i < trainingSamples; i++) coefficient += vector[i] * (samples[i] - mean);
        for (let i = 0; i < samples.length; i++) model[i] += coefficient * vector[i];
        basis.push(vector);
    }
    let fitError = 0, testError = 0, independentFit = 0, independentTest = 0;
    for (let i = 0; i < samples.length; i++) {
        const error = (samples[i] - mean - model[i]) ** 2, naive = (samples[i] - mean - independent[i]) ** 2;
        if (i < trainingSamples) { fitError += error; independentFit += naive; }
        else { testError += error; independentTest += naive; }
    }
    return { ...result, status: 'available', fitResidualFraction: fitError / fitEnergy,
        heldOutResidualFraction: testError / testEnergy, independentColumnFitResidual: independentFit / fitEnergy,
        independentColumnHeldOutResidual: independentTest / testEnergy };
}

/** Additional model/stability evidence. Low residual NEVER certifies one physical source. */
export function assessHarmonicEvidence(samples: Float32Array, pitch: PitchCandidateAnalysis): HarmonicEvidence {
    if (pitch.algorithm !== 'experimental-pitch-periodicity-v1' || pitch.identity.sampleCount !== samples.length
        || pitch.confidence !== null || pitch.sourceIsolation !== 'unverified-mixture'
        || pitch.frames.length > 4096 || !/^[a-f0-9]{64}$/.test(pitch.identity.pcmSha256)
        || !Number.isSafeInteger(pitch.identity.sampleRate) || pitch.identity.sampleRate < 8000 || pitch.identity.sampleRate > 96000
        || !samples.length || !Number.isFinite(pitch.identity.timelineOffsetSeconds) || pitch.identity.timelineOffsetSeconds < 0
        || !Number.isSafeInteger(pitch.frameLength) || pitch.frameLength < 32 || pitch.frameLength > 16384
        || !Number.isSafeInteger(pitch.hopLength) || pitch.hopLength < 1 || pitch.hopLength > pitch.frameLength
        || pitch.frames.length !== Math.max(0, 1 + Math.floor((samples.length - pitch.frameLength) / pitch.hopLength)))
        throw new Error('Invalid harmonic pitch contract');
    for (const x of samples) if (!Number.isFinite(x)) throw new Error('Nonfinite harmonic PCM');
    const fs = pitch.identity.sampleRate;
    let work = 0;
    for (let i = 0; i < pitch.frames.length; i++) {
        const f = pitch.frames[i], n = f.supportEndSample - f.supportStartSample;
        if (f.frameIndex !== i || f.supportStartSample !== i * pitch.hopLength || n !== pitch.frameLength
            || f.supportStartSample < 0 || f.supportEndSample > samples.length) throw new Error('Invalid harmonic frame clock');
        if (f.primary) {
            const frequency = f.primary.frequencyHz;
            if (!Number.isFinite(frequency) || frequency < 80 || frequency > 1000) throw new Error('Invalid harmonic pitch');
            let h = 0; while (h < 8 && (h + 1) * frequency < .4 * fs) h++;
            work += n * (2 * h + 1) ** 2;
        }
    }
    if (work > 350000000) throw new Error('Harmonic work budget exceeded');
    const result: HarmonicEvidence = { algorithm: 'experimental-harmonic-evidence-v1', identity: { ...pitch.identity },
        confidence: null, groundTruthStatus: false, sourceIsolation: 'unverified-mixture', consumerUse: 'diagnostic-only',
        xrScoring: 'ineligible', frames: [] };
    let run = 0;
    for (let i = 0; i < pitch.frames.length; i++) {
        const f = pitch.frames[i], previous = pitch.frames[i - 1];
        const follows = f.primary && previous?.primary
            && Math.abs(1200 * Math.log2(f.primary.frequencyHz / previous.primary.frequencyHz)) <= 25;
        run = f.primary ? follows ? run + 1 : 1 : 0;
        const residual = f.primary ? fitHarmonicResidual(samples.slice(f.supportStartSample, f.supportEndSample), fs, f.primary.frequencyHz) : null;
        const status = !f.primary ? 'no-pitch' : residual!.status !== 'available' ? 'unavailable'
            : residual!.fitResidualFraction! > .1 || residual!.heldOutResidualFraction! > .1 ? 'large-residual'
            : run < 3 ? 'unstable' : 'steady-harmonic-compatible';
        result.frames.push({ frameIndex: i, fitSupportStartSample: f.supportStartSample,
            supportStartSample: run >= 3 ? pitch.frames[i - 2].supportStartSample : f.supportStartSample,
            supportEndSample: f.supportEndSample, consecutiveStableFrames: run, residual, status });
    }
    return result;
}
