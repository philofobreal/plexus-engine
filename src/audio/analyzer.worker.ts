import { analyzeAudio } from '../analyzer';
import type { AnalysisRequest } from '../types';

self.onmessage = function(e: MessageEvent<AnalysisRequest>) {
    try {
        const { requestId, algorithmVersion, sampleRate, samples, phraseSize, eventTiming, rhythmOnsets } = e.data;
        const result = analyzeAudio({
            samples: new Float32Array(samples),
            sampleRate,
            options: { requestId, algorithmVersion, phraseSize, eventTiming, rhythmOnsets },
            onProgress: (progress, stage) => {
                self.postMessage({ type: 'analysis_progress', requestId, progress, stage });
            }
        });

        self.postMessage({ type: 'analysis_done', ...result });
    } catch (error) {
        self.postMessage({ type: 'analysis_error', requestId: e.data.requestId, errorCode: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Unknown error' });
    }
};

