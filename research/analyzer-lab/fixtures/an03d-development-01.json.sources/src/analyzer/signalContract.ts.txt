/** Current offline PCM domain. Peak headroom agrees with the LF branch's existing domain. */
export const MAX_ANALYSIS_SAMPLE_AMPLITUDE = 8;
export const MAX_ANALYSIS_WINDOW_SIZE = 65536;

export function validateAnalysisClock(sampleRate: number, hopSize: number): void {
    if (!Number.isSafeInteger(sampleRate) || sampleRate < 1000 || sampleRate > 384000) {
        throw new Error('Analysis sample rate must be an integer between 1000 and 384000 Hz');
    }
    if (!Number.isSafeInteger(hopSize) || hopSize < 4 || hopSize > MAX_ANALYSIS_WINDOW_SIZE
        || !Number.isInteger(Math.log2(hopSize))) {
        throw new Error('Analysis hop/window must be a power of two between 4 and 65536 samples');
    }
}

export function validateAnalysisSamples(samples: Float32Array): void {
    // ArrayBuffer.isView also accepts buffers originating in a different JS realm.
    if (!ArrayBuffer.isView(samples) || Object.prototype.toString.call(samples) !== '[object Float32Array]'
        || samples.length === 0) throw new Error('Analysis requires nonempty Float32 PCM');
    for (let i = 0; i < samples.length; i++) {
        if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) > MAX_ANALYSIS_SAMPLE_AMPLITUDE) {
            throw new Error(`Analysis PCM sample ${i} must be finite and within [-8, 8]`);
        }
    }
}
