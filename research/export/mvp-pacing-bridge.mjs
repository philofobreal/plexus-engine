import { WebCodecsBackend } from '../../src/export/WebCodecsBackend';
import { WebMExporter } from '../../src/export/WebMExporter';
import { clearFinishedExportCache } from '../../src/export/ExportStorageLease';
import Mp4Worker from '../../src/export/mp4-export.worker.ts?worker';
import { State } from '../../src/state/store';
import { TemporalFragmentationEffect } from '../../src/visuals/TemporalFragmentationEffect';
import { cosmicWormholeIdentity } from '../../src/visuals/CosmicWormholeIdentity';
import { P5RenderTargetCompositor } from '../../src/visuals/P5RenderTargetCompositor';
import { P5RendererBackend } from '../../src/visuals/P5RendererBackend';

function createRenderProbe() {
    const identity = cosmicWormholeIdentity;
    const frames = [];
    let frame;
    const restore = [];
    function wrap(owner, method, record) {
        const original = owner[method];
        owner[method] = function (...args) {
            if (!frame) return original.apply(this, args);
            const start = performance.now();
            const result = original.apply(this, args);
            record(performance.now() - start);
            return result;
        };
        restore.push(() => { owner[method] = original; });
    }
    identity.setStageClock(performance);
    wrap(identity, 'draw', elapsed => {
        frame.wormholeCalls++;
        frame.wormhole += elapsed;
        for (const [stage, ms] of Object.entries(identity.stageTimes)) frame.wormholeMs[stage] += ms;
    });
    wrap(P5RenderTargetCompositor.prototype, 'beginFrame', elapsed => { frame.transitionTargets += elapsed; });
    wrap(P5RenderTargetCompositor.prototype, 'composite', elapsed => { frame.transitionMix += elapsed; });
    wrap(P5RendererBackend.prototype, 'presentRaster', elapsed => { frame.rasterPresent += elapsed; });
    window.plexusRenderProbe = name => {
        if (frame) frame.marks[name] = performance.now();
    };
    return {
        frames,
        start(time) {
            frame = { time, started: performance.now(), marks: {}, wormholeCalls: 0, wormhole: 0,
                wormholeMs: { background: 0, grains: 0, weave: 0, resolve: 0, composite: 0 },
                transitionTargets: 0, transitionMix: 0, rasterPresent: 0 };
        },
        finish(raster) {
            const ended = performance.now();
            const { started, marks, ...detail } = frame;
            frame = undefined;
            const { identity, postFx, tail } = marks;
            if (!(started <= identity && identity <= postFx && postFx <= tail && tail <= ended)) {
                throw Error('Missing or unordered render timing marks');
            }
            frames.push({ ...detail, raster, drawMs: ended - started, hostPreparation: identity - started,
                identityPipeline: postFx - identity, postFx: tail - postFx, tail: ended - tail });
        },
        dispose() {
            for (const reset of restore) reset();
            identity.setStageClock(null);
            delete window.plexusRenderProbe;
        },
    };
}

// This bridge is injected only into the loopback build of the actual MVP entry point.
export function installPacingBridge(ui, engine) {
    const controller = ui.controller;
    const effect = TemporalFragmentationEffect.prototype;
    const isActive = effect.isActive, apply = effect.apply;
    const forcePostFx = () => State.isExporting && State.exportTime >= .7 && State.exportTime < 1.25;
    let postFrames = 0;
    effect.isActive = function (frame) {
        // Ensure this short excerpt exercises the real PostFX pass in both modes.
        return forcePostFx() || isActive.call(this, frame);
    };
    effect.apply = function (...args) {
        if (State.isExporting) postFrames++;
        if (!forcePostFx()) return apply.apply(this, args);
        const director = State.directorOutput, glitch = director.glitchIntensity;
        const tuning = State.visualTuning, amount = tuning.postFxFragmentAmount;
        try {
            tuning.postFxFragmentAmount = .7;
            director.glitchIntensity = .7;
            return apply.apply(this, args);
        } finally {
            director.glitchIntensity = glitch;
            tuning.postFxFragmentAmount = amount;
        }
    };
    window.plexusPacingFixture = {
        async load(file) {
            await controller.loadFile(file);
            const deadline = performance.now() + 60_000;
            while (controller.preparingTrack || !controller.canExport()) {
                if (performance.now() >= deadline) throw Error('MVP did not prepare the reference track');
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            if (!State.trackAnalysis || State.visualMode !== 'cosmic-wormhole') throw Error('Missing MVP analysis or Wormhole');
            return { duration: State.duration, analysisFrames: State.frames.length };
        },
        async run({ resolution, scheduling, command, fps, profileRender = false }) {
            const p5 = controller.exportP5Instance, canvas = controller.exportCanvas;
            const draw = p5.draw, createBitmap = window.createImageBitmap;
            const capturedTimes = [];
            let renderedTime, profile, commandAt;
            const probe = profileRender ? createRenderProbe() : undefined;
            p5.draw = function (...args) {
                const isExporting = State.isExporting;
                if (isExporting) probe?.start(State.exportTime);
                const result = draw.apply(this, args);
                if (isExporting) {
                    renderedTime = State.exportTime;
                    probe?.finish(canvas.dataset.wormholeRaster);
                }
                return result;
            };
            window.createImageBitmap = function (...args) {
                if (State.isExporting && args[0] instanceof HTMLCanvasElement) capturedTimes.push(renderedTime);
                return createBitmap.apply(window, args);
            };
            const exporter = new WebMExporter(p5, canvas, engine, null, {
                createMp4Backend: async name => new WebCodecsBackend(p5, canvas, engine, name, null, scheduling, Mp4Worker, result => { profile = result; }),
            });
            const initialPostFrames = postFrames;
            const started = performance.now();
            try {
                let blob;
                try {
                    blob = await exporter.startExport({ resolution, aspectRatio: '16:9', fps, format: 'mp4', watermark: false }, progress => {
                        if (!command || commandAt !== undefined || progress < .225) return;
                        commandAt = performance.now();
                        if (command === 'stop') exporter.stopAndSave();
                        else exporter.cancelExport();
                    });
                } catch (error) {
                    if (command !== 'cancel' || !/cancelled/i.test(String(error))) throw error;
                }
                const elapsed = performance.now() - started;
                if (State.isExporting || p5.__plexusExportTarget) throw Error('MVP export surface was not released');
                if (command === 'cancel' && (blob || profile?.outcome !== 'cancelled')) throw Error('Cancelled export published a result');
                return { blob, elapsed, profile, capturedTimes, postFrames: postFrames - initialPostFrames,
                    ...(probe ? { renderFrames: probe.frames } : {}),
                    controlSettlementMs: commandAt === undefined ? undefined : performance.now() - commandAt };
            } finally {
                probe?.dispose();
                p5.draw = draw;
                window.createImageBitmap = createBitmap;
            }
        },
        clear: clearFinishedExportCache,
    };
}
