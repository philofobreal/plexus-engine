import { analyzeAudio } from '../analyzer/analyzeAudio';
import type { AnalyzeAudioInput } from '../analyzer/types';
import type { FftKernelFactory } from '../analyzer/math/FFT';
import { WasmFftFailure, WASM_FFT_KERNEL_ID } from '../analyzer/math/WasmFftKernel';
import type { AnalyzerBackend, AnalysisBackendInfo } from '../types/AnalyzerBackend';

/** Request-local selection/retry; the worker still owns request identity/publication. */
export async function runAnalysisWithBackend(input: AnalyzeAudioInput, requested: AnalyzerBackend,
    loadKernel: () => Promise<FftKernelFactory>, supported = typeof WebAssembly !== 'undefined', isCurrent = () => true) {
    let factory: FftKernelFactory | undefined;
    let fallback: AnalysisBackendInfo['fallback'];
    if (requested !== 'typescript') {
        if (!supported) fallback = 'unsupported';
        else try { factory = await loadKernel(); } catch { fallback = 'load-failed'; }
    }
    if (!isCurrent()) throw new Error('Analysis superseded');
    if (factory) {
        try {
            const result = analyzeAudio({ ...input, fftKernelFactory: factory,
                onProgress: (progress, stage) => input.onProgress?.(progress, `${stage} [WebAssembly FFT]`) });
            return { result, backend: { requested, used: 'wasm', kernel: WASM_FFT_KERNEL_ID } satisfies AnalysisBackendInfo };
        } catch (error) {
            if (!(error instanceof WasmFftFailure)) throw error;
            // The kernel may have partially changed its private scratch. Retry the whole pipeline,
            // never the partially transformed block. Original PCM was never transferred into WASM.
            fallback = 'execution-failed';
        }
    }
    const backend: AnalysisBackendInfo = { requested, used: 'typescript', ...(fallback ? { fallback } : {}) };
    if (!isCurrent()) throw new Error('Analysis superseded');
    const result = analyzeAudio({ ...input, fftKernelFactory: undefined,
        onProgress: (progress, stage) => input.onProgress?.(progress, `${stage} [TypeScript${fallback ? ' fallback' : ''}]`) });
    return { result, backend };
}
