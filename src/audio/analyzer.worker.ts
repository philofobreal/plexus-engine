import { analyzeAudio } from '../analyzer';
import type { AnalysisRequest } from '../types';
import { ANALYZER_BACKENDS } from '../types/AnalyzerBackend';
import { runAnalysisWithBackend } from './AnalyzerBackendRunner';

let generation = 0;

self.onmessage = function(e: MessageEvent<AnalysisRequest>) {
    const token = ++generation;
    const fail = (error: unknown) => {
        if (token !== generation) return;
        self.postMessage({ type: 'analysis_error', requestId: e.data.requestId, errorCode: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Unknown error' });
    };
    try {
        const { requestId, algorithmVersion, sampleRate, samples, phraseSize, eventTiming, rhythmOnsets } = e.data;
        const input = {
            samples: new Float32Array(samples),
            sampleRate,
            options: { requestId, algorithmVersion, phraseSize, eventTiming, rhythmOnsets },
            onProgress: (progress: number, stage: string) => {
                if (token === generation) self.postMessage({ type: 'analysis_progress', requestId, progress, stage });
            }
        };
        const requested = e.data.analysisBackend;
        // Legacy/headless messages stay synchronous and retain their exact packet shape.
        if (requested === undefined) {
            const result = analyzeAudio(input);
            self.postMessage({ type: 'analysis_done', ...result });
        } else {
            if (!ANALYZER_BACKENDS.includes(requested)) throw new Error('Unsupported analysis backend');
            self.postMessage({ type: 'analysis_progress', requestId, progress: 0, stage: 'Preparing audio analysis backend...' });
            void runAnalysisWithBackend(input, requested, async () =>
                (await import('./WasmAnalysisBackend')).loadWasmFftKernel(), typeof WebAssembly !== 'undefined', () => token === generation)
                .then(({ result, backend }) => {
                    if (token === generation) self.postMessage({ type: 'analysis_done', ...result, backend });
                }).catch(fail);
        }
    } catch (error) {
        fail(error);
    }
};

