import HostWorker from '../../src/visuals/wormholeHostRender.worker.ts?worker';
import { projectRenderWorkerAnalysis } from '../../src/types/CanvasVisualSource';

/** An export-only lease over the production Wormhole worker protocol. */
export function createExactRaster(onPending) {
    const worker = new HostWorker();
    const frames = [];
    let pending, closed = false, serial = 0, setupMs = 0;
    function dispose(error = new Error('Exact raster cancelled')) {
        if (closed) return;
        closed = true;
        worker.terminate();
        pending?.reject(error);
        pending = undefined;
    }
    worker.onerror = worker.onmessageerror = () => dispose(new Error('Exact raster worker failed'));
    worker.onmessage = ({ data }) => {
        if (closed || !pending) {
            if (data.type === 'frame') data.bitmap.close();
            return;
        }
        if (data.type === 'failure') { dispose(new Error(data.message)); return; }
        if (data.generation !== 1 || data.type !== pending.type || (data.type === 'frame' && data.serial !== serial)) {
            if (data.type === 'frame') data.bitmap.close();
            dispose(new Error('Unexpected exact raster reply'));
            return;
        }
        const { resolve } = pending;
        pending = undefined;
        resolve(data);
    };
    async function send(message, type) {
        if (closed || pending) throw Error('Exact raster worker is unavailable');
        let timeout;
        try {
            return await new Promise((resolve, reject) => {
                pending = { type, resolve, reject };
                timeout = setTimeout(() => dispose(new Error('Exact raster worker timed out')), 15_000);
                try { worker.postMessage({ generation: 1, ...message }); } catch (error) { dispose(error); }
            });
        } finally { clearTimeout(timeout); }
    }
    return {
        frames,
        get setupMs() { return setupMs; },
        async draw(state, target, depthCue, musicDisplay, skybox) {
            if (state.visualMode !== 'cosmic-wormhole' || state.visualModeTransition || state.videoBackplateActive) {
                throw Error('Exact raster fixture requires a steady Wormhole identity without a backplate');
            }
            const { width, height, rasterPixelRatio: density, compactMaterialPreview: compact, frameCount } = target;
            if (density !== 1) throw Error('Unexpected export backing density');
            if (serial === 0) {
                const started = performance.now();
                const { frames, events, trackAnalysis, sampleRate, hopSize, bpm } = state;
                const analysis = projectRenderWorkerAnalysis({ frames, events, trackAnalysis, sampleRate, hopSize, bpm });
                await send({ type: 'prepare', analysis }, 'ready');
                setupMs = performance.now() - started;
            }
            const { currentTime, exportTime, visualTuning, targetTuning, currentFrame, currentFeatures, modulation,
                directorOutput, beatDecay, denseImpactFlash, activeVisualTransitionId, spiralTransitionAnchor, playbackFade } = state;
            const frame = { width, height, density, compact, frameCount, depthCue, musicDisplay, skybox, transparent: false,
                reset: false, isExporting: true, currentTime, exportTime, visualTuning, targetTuning, currentFrame,
                currentFeatures, modulation, directorOutput, beatDecay, denseImpactFlash, activeVisualTransitionId,
                spiralTransitionAnchor, playbackFade };
            const sent = performance.now();
            const reply = send({ type: 'render', serial: ++serial, frame }, 'frame');
            onPending?.(exportTime);
            const { bitmap, raster, renderMs } = await reply;
            const arrived = performance.now();
            try {
                if (bitmap.width !== width || bitmap.height !== height) throw Error('Worker changed export resolution');
                target.presentRaster(bitmap);
                frames.push({ time: exportTime, width, height, raster, renderMs,
                    roundTripMs: arrived - sent, presentMs: performance.now() - arrived });
            } finally { bitmap.close(); }
            return raster;
        },
        dispose,
    };
}
