import wasmUrl from '../analyzer/math/fft.scalar.wasm?url&no-inline';
import { createWasmFftKernelFactory } from '../analyzer/math/WasmFftKernel';
import type { FftKernelFactory } from '../analyzer/math/FFT';

let compiled: Promise<FftKernelFactory> | undefined;

/** Environment-owned lazy asset loading. One module per worker, private memory per FFT. */
export function loadWasmFftKernel(): Promise<FftKernelFactory> {
    if (compiled) return compiled;
    compiled = (async () => {
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { abort.abort(); reject(new Error('FFT asset load timed out')); }, 8000);
        });
        try {
            const load = async () => {
                const response = await fetch(wasmUrl, { signal: abort.signal });
                if (!response.ok) throw new Error('FFT asset unavailable');
                let module: WebAssembly.Module;
                if (typeof WebAssembly.compileStreaming === 'function' && response.headers.get('Content-Type')?.split(';')[0].trim() === 'application/wasm') {
                    try { module = await WebAssembly.compileStreaming(response.clone()); }
                    catch { module = await WebAssembly.compile(await response.arrayBuffer()); }
                } else module = await WebAssembly.compile(await response.arrayBuffer());
                return createWasmFftKernelFactory(module);
            };
            return await Promise.race([load(), timeout]);
        } finally { clearTimeout(timer); }
    })();
    // A failed load does not poison future requests in an embedded long-lived worker.
    compiled.catch(() => { compiled = undefined; });
    return compiled;
}
