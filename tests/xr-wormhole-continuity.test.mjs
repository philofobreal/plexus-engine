import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

// A slow background frame during playback is a longer step, not a seek (ADR-009 Addendum AB): the
// Wormhole keeps morphing and integrating its route through it instead of snapping both to the
// automation target in one frame.

const STRAIGHT = 'straight.json', CURVED = 'curved.json';
const PRESETS = {
    [STRAIGHT]: { visualMode: 'cosmic-wormhole', visualTuning: { wormholePathBend: 0 } },
    [CURVED]: { visualMode: 'cosmic-wormhole', visualTuning: { wormholePathBend: 0.8 } }
};
const point = (id, time, preset) => ({ id, time, sectionId: id, preset, confidence: 1, intensity: 1, reason: 'section',
    morphDurationSec: 1.5, morphCurve: 'easeInOut' });

/** Real `WormholeCanvasSource` over a recording identity (no raster), with an injectable wall clock. */
async function sourceHarness(clock = null) {
    const syncs = [], drawn = [];
    class FakeIdentity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.stageTimes = {}; }
        setStageClock() {} setMaterialSink() {} setLineSink() {} setDepthCue() {} setDepthLayers() {}
        syncPosition(time) { syncs.push(time); }
        draw() { drawn.push({ time: this.state.currentTime, bend: this.state.visualTuning.wormholePathBend }); }
    }
    class FakeBackend {
        constructor(width, height) { this.canvas = { width, height }; this.width = width; this.height = height; this.frameCount = 0; }
        background() {}
    }
    const load = createLoader({
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: FakeIdentity },
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: FakeBackend },
        '../config/featureFlags': { featureFlags: { semanticResolver: false, semanticChoreography: false } }
    }, {
        fetch: async url => ({ ok: true, json: async () => PRESETS[decodeURIComponent(url.split('/').at(-1))] }),
        ...(clock ? { performance: clock } : {})
    });
    const { createEmptyTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
    const { WormholeCanvasSource } = load('visuals/WormholeCanvasSource.ts');
    const source = new WormholeCanvasSource();
    await source.prepare({ frames: [], events: [], trackAnalysis: createEmptyTrackAnalysis(), sampleRate: 44100, hopSize: 1024, bpm: 120,
        duration: 10, performancePlan: { points: [point('a', 0, STRAIGHT), point('b', 2.15, CURVED)] } });
    return { source, syncs, drawn };
}

/** Plays 0 -> `end` at 30 Hz; `gap` = [from, to] replaces the frames in between by one step. */
function play(source, { end = 3, gap = null, flag = true, wall = null } = {}) {
    const times = [];
    for (let frame = 0; frame / 30 <= end + 1e-9; frame++) {
        const time = frame / 30;
        if (gap && time > gap[0] + 1e-9 && time < gap[1] - 1e-9) continue;
        times.push(time);
    }
    for (const time of times) {
        if (wall) wall.sec = time;
        source.render(time, true, flag);
    }
}

test('the shared rule: playback advances song time with the wall clock, by at most one second', async () => {
    const load = createLoader();
    const { isContinuousPlaybackStep, CONTINUOUS_PLAYBACK_MAX_STEP_SEC, CONTINUOUS_PLAYBACK_TOLERANCE_SEC } = load('types/CanvasVisualSource.ts');
    assert.equal(CONTINUOUS_PLAYBACK_MAX_STEP_SEC, 1);
    assert.equal(CONTINUOUS_PLAYBACK_TOLERANCE_SEC, 0.1);
    assert.equal(isContinuousPlaybackStep(1 / 72, 1 / 72), true);
    assert.equal(isContinuousPlaybackStep(0.3, 0.3), true, 'a slow frame');
    assert.equal(isContinuousPlaybackStep(0.3, 0.22), true, 'clock quantization within tolerance');
    assert.equal(isContinuousPlaybackStep(0, 0.02), true, 'a quantized audio clock may stand still for a frame');
    assert.equal(isContinuousPlaybackStep(1, 1), true);
    assert.equal(isContinuousPlaybackStep(1.01, 1.01), false, 'longer steps are re-synchronized');
    assert.equal(isContinuousPlaybackStep(0.3, 0.016), false, 'a seek moves song time without wall time');
    assert.equal(isContinuousPlaybackStep(-0.01, 0.016), false, 'song time never runs backward in playback');
    assert.equal(isContinuousPlaybackStep(0.016, 0.5), false, 'a stalled song clock is not playback');
    assert.equal(isContinuousPlaybackStep(Number.NaN, 0.1), false);
    assert.equal(isContinuousPlaybackStep(0.1, Number.NaN), false, 'no wall clock: unknown, not continuous');
});

test('a slow frame mid-transition morphs through: same bend as uniform playback, no route snap', async () => {
    const uniform = await sourceHarness();
    play(uniform.source);
    const slow = await sourceHarness();
    play(slow.source, { gap: [2.2, 2.5] });
    assert.deepEqual(uniform.syncs, []);
    assert.deepEqual(slow.syncs, [], 'a 0.3 s playback step must not re-synchronize the route');
    const at = (run, time) => run.drawn.find(frame => Math.abs(frame.time - time) < 1e-9).bend;
    // The XR Motion macro makes the tuning morph fast; the visible glide is the route integrating that
    // bend, which a resync would replace in one frame. The tuning itself composes exactly over the gap.
    assert.ok(Math.abs(at(slow, 2.5) - at(uniform, 2.5)) < 1e-12, 'one long step equals the uniform frames it replaced');
    assert.ok(Math.abs(slow.drawn.at(-1).bend - uniform.drawn.at(-1).bend) < 1e-9);
});

test('seeks, restarts and steps over one second still re-synchronize', async () => {
    const seek = await sourceHarness();
    play(seek.source, { end: 2.2 });
    seek.source.render(2.5, true, false);
    assert.deepEqual(seek.syncs, [2.5], 'a step the caller does not call continuous keeps the seek rule');
    assert.equal(seek.drawn.at(-1).bend, 0.8, 'a seek lands on the target tuning');

    const long = await sourceHarness();
    play(long.source, { end: 1 });
    long.source.render(2.5, true, true);
    assert.equal(long.drawn.at(-1).time, 2.5);
    assert.deepEqual(long.syncs, [], 'the caller decided: continuous');

    const restart = await sourceHarness();
    play(restart.source, { end: 2.2 });
    restart.source.render(2.2, false);
    restart.source.render(2.5, true, true);
    assert.deepEqual(restart.syncs, [2.5], 'the first playing frame after a pause is never continuous');

    const backward = await sourceHarness();
    play(backward.source, { end: 2.2 });
    backward.source.render(1, true, true);
    assert.deepEqual(backward.syncs, [1], 'song time going back is always a seek');
});

test('in-thread sources classify the step with their own wall clock', async () => {
    const wall = { sec: 0 };
    const clock = { now: () => wall.sec * 1000 };
    const played = await sourceHarness(clock);
    play(played.source, { gap: [2.2, 2.5], flag: undefined, wall });
    assert.deepEqual(played.syncs, [], 'the wall clock advanced with the song: playback');

    const seek = await sourceHarness(clock);
    play(seek.source, { end: 2.2, flag: undefined, wall });
    seek.source.render(2.5, true);
    assert.deepEqual(seek.syncs, [2.5], 'song time jumped while the wall clock stood still: a seek');

    const long = await sourceHarness(clock);
    play(long.source, { end: 1, flag: undefined, wall });
    wall.sec = 2.5;
    long.source.render(2.5, true);
    assert.deepEqual(long.syncs, [2.5], 'over one second is re-synchronized even in real time');

    const clockless = await sourceHarness();
    play(clockless.source, { end: 2.2, flag: undefined });
    clockless.source.render(2.5, true);
    assert.deepEqual(clockless.syncs, [2.5], 'without a wall clock the historical seek rule stands');
});

function bitmap() { return { close() {} }; }

function proxyHarness(clock) {
    const workers = [];
    class FakeWorker {
        constructor() { this.posted = []; this.onmessage = null; this.onerror = null; workers.push(this); }
        postMessage(message) { this.posted.push(message); }
        terminate() {}
        reply(data) { this.onmessage?.({ data }); }
    }
    const presenter = { transferFromImageBitmap() {} };
    const document = { body: { appendChild() {} },
        createElement: () => ({ width: 0, height: 0, dataset: {}, remove() {}, getContext: kind => (kind === 'bitmaprenderer' ? presenter : null) }) };
    const load = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: FakeWorker } },
        { document, performance: clock });
    const { WormholeWorkerSource } = load('visuals/WormholeWorkerSource.ts');
    return { source: new WormholeWorkerSource(), worker: workers[0] };
}

test('the proxy flags continuous requests and never asks for an earlier time while playing on', async () => {
    const wall = { sec: 0 };
    const { source, worker } = proxyHarness({ now: () => wall.sec * 1000 });
    const ready = source.prepare(null); worker.reply({ type: 'prepared', generation: 1 }); await ready;
    const renders = () => worker.posted.filter(message => message.type === 'render');
    const answer = (latencySec, shownAt) => {
        const request = renders().at(-1);
        wall.sec += latencySec;
        worker.reply({ type: 'frame', generation: 1, time: request.time, bitmap: bitmap(), focalX: 0, focalY: 0, renderMs: 1 });
        return shownAt;
    };
    let song = 10;
    source.render(song, true);
    assert.equal('continuous' in renders().at(-1), false, 'the first playing request is never continuous');
    // Steady 30 Hz frames, one 0.35 s stall, then a shrinking lead (fast frames shown at once).
    const steps = [...Array(20).fill(1 / 30), 0.35, ...Array(20).fill(1 / 30)];
    for (const [index, step] of steps.entries()) {
        answer(index > 20 ? 0.001 : step * 0.5);
        wall.sec += step - (index > 20 ? 0.001 : step * 0.5);
        song += step;
        source.render(song, true);
        assert.equal(renders().at(-1).continuous, true, `step ${index} (${step} s) is playback`);
    }
    const times = renders().map(message => message.time);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1], `request ${i} never goes back (${times[i - 1]} -> ${times[i]})`);

    // A seek: song time moves without wall time.
    answer(0);
    song += 30;
    source.render(song, true);
    assert.equal('continuous' in renders().at(-1), false, 'a seek is not continuous');
    // Pause and resume.
    answer(0.02);
    wall.sec += 0.013;
    source.render(song, false);
    assert.equal(renders().at(-1).time, song, 'paused requests ask for the exact time');
    assert.equal('continuous' in renders().at(-1), false);
    worker.reply({ type: 'unchanged', generation: 1 });
    wall.sec += 1 / 30;
    source.render(song + 1 / 30, true);
    assert.equal('continuous' in renders().at(-1), false, 'resuming is not continuous');
    source.dispose();
});

test('the worker forwards the continuity flag to its source as a boolean', async () => {
    const calls = [];
    class RecordingSource {
        constructor() { this.canvas = { transferToImageBitmap: () => bitmap() }; this.focalPoint = { x: 0, y: 0 }; this.stageTimes = null; }
        prepare() { return Promise.resolve(); }
        render(time, playing, continuous) { calls.push([time, playing, continuous]); return false; }
        setPresentation() {} dispose() {}
    }
    const posted = [];
    const scope = { onmessage: null, postMessage(message) { posted.push(message); }, close() {} };
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: RecordingSource } },
        { self: scope, performance: { now: () => 0 }, OffscreenCanvas: class {} })('visuals/wormholeRender.worker.ts');
    const send = data => scope.onmessage({ data });
    send({ type: 'init', protocol: 1, width: 64, height: 36, depthCue: 0 });
    send({ type: 'prepare', generation: 1, analysis: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    send({ type: 'render', generation: 1, time: 1, playing: true, continuous: true });
    send({ type: 'render', generation: 1, time: 5, playing: true });
    assert.deepEqual(calls, [[1, true, true], [5, true, false]]);
});
