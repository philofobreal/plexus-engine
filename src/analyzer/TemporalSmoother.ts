import { validateAnalysisClock } from './signalContract';

/** Same initialization as applyEMA, with a physical time constant in seconds. */
export function applyEMAInSeconds(input: Float32Array, sampleRate: number, hopSize: number, tauSeconds: number): Float32Array {
    validateAnalysisClock(sampleRate, hopSize);
    if (!Number.isFinite(tauSeconds) || tauSeconds <= 0) throw new Error('EMA time constant must be finite and positive');
    return applyEMA(input, -Math.expm1(-hopSize / sampleRate / tauSeconds));
}

export function applyEMA(input: Float32Array, alpha: number): Float32Array {
    const output = new Float32Array(input.length);
    let s = input.length > 0 ? input[0] : 0;

    for (let i = 0; i < input.length; i++) {
        s += (input[i] - s) * alpha;
        output[i] = s;
    }

    return output;
}
