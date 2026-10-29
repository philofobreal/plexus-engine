export const ANALYZER_BACKENDS = ['auto', 'typescript', 'wasm'] as const;
export type AnalyzerBackend = typeof ANALYZER_BACKENDS[number];
export interface AnalysisBackendInfo {
    readonly requested: AnalyzerBackend;
    readonly used: 'typescript' | 'wasm';
    readonly kernel?: 'fft-scalar-f64-v1';
    readonly fallback?: 'unsupported' | 'load-failed' | 'execution-failed';
}
export function normalizeAnalyzerBackend(value: unknown): AnalyzerBackend {
    return value === 'typescript' || value === 'wasm' ? value : 'auto';
}
