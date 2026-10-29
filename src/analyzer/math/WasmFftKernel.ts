import type { FftKernelFactory } from './FFT';

export const WASM_FFT_KERNEL_ID = 'fft-scalar-f64-v1';

/** Identifies kernel failure so the adapter can retry the complete untouched PCM in TS. */
export class WasmFftFailure extends Error {
    constructor() { super('WebAssembly FFT execution failed'); this.name = 'WasmFftFailure'; }
}

/** Pure numeric adapter: compiled code is supplied; no fetch, worker or global backend. */
export function createWasmFftKernelFactory(module: WebAssembly.Module): FftKernelFactory {
    return (size, cos, sin) => {
        try {
            if (!Number.isSafeInteger(size) || size < 2 || size > 65536 || !Number.isInteger(Math.log2(size))
                || cos.length !== size / 2 || sin.length !== size / 2) throw new WasmFftFailure();
            const pages = Math.ceil(12 * size / 65536);
            const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
            const instance = new WebAssembly.Instance(module, { env: { memory } });
            const transform = instance.exports.transform;
            if (typeof transform !== 'function') throw new WasmFftFailure();
            const re = new Float32Array(memory.buffer, 0, size);
            const im = new Float32Array(memory.buffer, 4 * size, size);
            new Float32Array(memory.buffer, 8 * size, size / 2).set(cos);
            new Float32Array(memory.buffer, 10 * size, size / 2).set(sin);
            return { re, im, transform() {
                try { transform(size); } catch { throw new WasmFftFailure(); }
            } };
        } catch { throw new WasmFftFailure(); }
    };
}
