// Opt-in background profiling for headset runs (Settings > System > Diagnostics, or `?xrDiagnostics=1`): the worker's stage times reach
// the host, are averaged over two seconds of play and shown in the game menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { historicalXrSettings } from './helpers/xr-historical-settings.mjs';

const load = createLoader({ three: THREE });
const { BackgroundDiagnostics, BACKGROUND_DIAGNOSTICS_WINDOW_SEC } = load('xr/BackgroundDiagnostics.ts');

test('two seconds of play become one line: display rate, background frames shown and their average stage times', () => {
    const diagnostics = new BackgroundDiagnostics();
    let shown = 0, produced = false;
    const stages = { tune: 1, background: 3, grains: 14, weave: 2, resolve: 6, composite: 4, draw: 29, transfer: 0.5 };
    for (let i = 0; i < 144 && !produced; i++) {
        if (i % 3 === 0) shown++; // a new background frame every third display frame (24 of 72)
        produced = diagnostics.record(1 / 72, true, shown, 30, stages, 'ultra, 36 Hz');
    }
    assert.ok(produced, 'a summary after the window');
    assert.equal(BACKGROUND_DIAGNOSTICS_WINDOW_SEC, 2);
    const line = diagnostics.summary;
    assert.match(line, /^Display 72\.0 fps \| Background 2[34]\.\d fps, 30\.0 ms \(ultra, 36 Hz\) \| /);
    assert.match(line, /tune 1\.0 layers 3\.0 grains 14\.0 weave 2\.0 blur 6\.0 comp 4\.0 xfer 0\.5$/, 'pipeline order, readable names');
    assert.doesNotMatch(line, /draw/, 'the identity total is not repeated');
});

test('the main-thread cost per display frame is split between background frames and the others, with the share of late frames', () => {
    const diagnostics = new BackgroundDiagnostics();
    let produced = false, shown = 0;
    diagnostics.record(1 / 72, false, shown, 0, null); // paused: the window starts from the shown count
    for (let i = 0; i < 400 && !produced; i++) {
        // Every second frame shows a new background frame and costs 12 ms (one of them 20 ms), the others 5 ms;
        // every tenth frame is late (the headset waited a whole extra interval).
        const previousShowed = i > 0 && (i - 1) % 2 === 0;
        if (i % 2 === 0) shown++;
        const cost = { updateMs: previousShowed ? 4 : 2, renderMs: previousShowed ? (i === 41 ? 16 : 8) : 3, displayHz: 72 };
        produced = diagnostics.record(i % 10 === 9 ? 2 / 72 : 1 / 72, true, shown, 10, null, '', cost);
    }
    assert.ok(produced);
    assert.match(diagnostics.summary, /^Display \d+\.\d fps, late 10% \(bg 20%, other 0%\), max 27\.8 ms \| Main ms bg 12\.\d\/20\.0, other 5\.0\/5\.0 \| Background /, diagnostics.summary);
    // Without costs (older hosts) the line is unchanged.
    const plain = new BackgroundDiagnostics();
    for (let i = 0; i < 200; i++) plain.record(1 / 72, true, i, 10, null);
    assert.doesNotMatch(plain.summary, /Main ms/);
});

test('late frames are split by the kind of frame that ran long, and the GPU time of the render calls is shown (or why not)', () => {
    const run = (gpu) => {
        const diagnostics = new BackgroundDiagnostics();
        let produced = false, shown = 0;
        diagnostics.record(1 / 72, false, shown, 0, null);
        for (let i = 0; i < 400 && !produced; i++) {
            // Every third frame shows a background frame; only frames after one of them run late, every second time.
            const previousShowed = i > 0 && (i - 1) % 3 === 0;
            if (i % 3 === 0) shown++;
            const late = previousShowed && i % 2 === 0;
            const cost = { updateMs: 1, renderMs: 1, displayHz: 72, ...gpu(i) };
            produced = diagnostics.record(late ? 2 / 72 : 1 / 72, true, shown, 10, null, '', cost);
        }
        assert.ok(produced);
        return diagnostics.summary;
    };
    const timed = run(i => ({ gpuTimer: true, gpuSamples: i % 2 ? [6, i === 51 ? 15 : 8] : [] }));
    assert.match(timed, /^Display \d+\.\d fps, late \d+% \(bg (49|50)%, other 0%\), max 27\.8 ms \| Main ms bg 2\.0\/2\.0, other 2\.0\/2\.0 \| GPU ms 7\.\d\/15\.0 \| Background /, timed);
    const untimed = run(() => ({ gpuTimer: false, gpuSamples: [] }));
    assert.match(untimed, /\| GPU ms n\/a \(no timer\) \| Background /);
    // No late frame: no split; an older host without GPU fields: no GPU part.
    const smooth = new BackgroundDiagnostics();
    for (let i = 0; i < 200; i++) smooth.record(1 / 72, true, i, 10, null, '', { updateMs: 1, renderMs: 1, displayHz: 72 });
    assert.match(smooth.summary, /late 0%, max 13\.9 ms \| Main ms/); assert.doesNotMatch(smooth.summary, /GPU|ahead/);
});

test('the background work done ahead, between display frames, is shown with the main-thread cost; the longest display interval too (Addendum AE)', () => {
    const diagnostics = new BackgroundDiagnostics();
    let produced = false, shown = 0;
    diagnostics.record(1 / 72, false, shown, 0, null);
    for (let i = 0; i < 400 && !produced; i++) {
        if (i % 3 === 0) shown++;
        // A frame arrives every third display frame; its preparation ahead costs 1.5 ms (once 6 ms).
        const aheadSamples = i % 3 === 1 ? [i === 40 ? 6 : 1.5] : [];
        // One interval runs 1.3 frames long: under the late threshold, but the longest.
        produced = diagnostics.record(i === 50 ? 1.3 / 72 : 1 / 72, true, shown, 10, null, '', { updateMs: 1, renderMs: 1, displayHz: 72, aheadSamples });
    }
    assert.ok(produced);
    assert.match(diagnostics.summary, /late 0%, max 18\.1 ms \| Main ms bg 2\.0\/2\.0, other 2\.0\/2\.0, ahead 1\.\d\/6\.0 \|/, diagnostics.summary);
    // The controller reads the backdrop's samples once per frame and empties the list.
    const controller = readFileSync('src/xr/XrAppController.ts', 'utf8');
    assert.match(controller, /cost\.aheadSamples = ahead \?\? EMPTY_SAMPLES;[\s\S]*if \(ahead\) ahead\.length = 0;/);
});

test('the GPU frame timer polls finished queries without waiting, drops disjoint results and reports a missing extension', () => {
    const { GpuFrameTimer, GPU_TIMER_MAX_PENDING } = load('xr/runtime/GpuFrameTimer.ts');
    assert.equal(GpuFrameTimer.create(null), null);
    assert.equal(GpuFrameTimer.create({ createQuery() {}, getExtension: () => null }), null, 'no extension: no timer');
    let next = 0, disjoint = false;
    const queries = new Map(), deleted = [];
    const gl = {
        QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
        createQuery: () => { const q = { id: next++ }; queries.set(q, { ready: false, ns: 0 }); return q; },
        beginQuery: () => {}, endQuery: () => {}, deleteQuery: q => deleted.push(q),
        getExtension: () => ({ TIME_ELAPSED_EXT: 10, GPU_DISJOINT_EXT: 11 }),
        getParameter: () => disjoint,
        getQueryParameter: (q, p) => (p === 1 ? queries.get(q).ready : queries.get(q).ns)
    };
    const timer = GpuFrameTimer.create(gl), out = [];
    timer.begin(); timer.end(); timer.begin(); timer.end();
    timer.poll(out); assert.equal(out.length, 0, 'nothing ready: no wait');
    const [a, b] = [...queries.keys()];
    queries.get(a).ready = true; queries.get(a).ns = 7.5e6;
    timer.poll(out); assert.deepEqual([...out], [7.5]);
    queries.get(b).ready = true; queries.get(b).ns = 9e6; disjoint = true;
    timer.poll(out); assert.equal(out.length, 0, 'a disjoint period reports nothing');
    disjoint = false;
    timer.begin(); timer.end(); assert.equal(queries.size, 2, 'queries are reused');
    for (let i = 0; i < GPU_TIMER_MAX_PENDING + 3; i++) { timer.begin(); timer.end(); }
    assert.ok(queries.size <= GPU_TIMER_MAX_PENDING, 'a GPU far behind skips timing instead of piling up queries');
    timer.dispose(); assert.equal(deleted.length, queries.size);
});

test('pausing ends the window without a summary; no new background frames is said plainly', () => {
    const diagnostics = new BackgroundDiagnostics();
    for (let i = 0; i < 100; i++) diagnostics.record(1 / 72, true, 0, 0, null);
    assert.equal(diagnostics.record(1 / 72, false, 0, 0, null), false);
    assert.equal(diagnostics.summary, '', 'a paused window is dropped');
    let produced = false;
    for (let i = 0; i < 200 && !produced; i++) produced = diagnostics.record(1 / 72, true, 0, 0, null);
    assert.match(diagnostics.summary, /^Display 72\.0 fps \| Background: no new frames$/);
    assert.equal(diagnostics.record(Number.NaN, true, 5, 0, null), false, 'invalid steps are ignored');
});

test('clear() forgets the last line and the open window (diagnostics switched off or on again)', () => {
    const diagnostics = new BackgroundDiagnostics();
    for (let i = 0; i < 150; i++) diagnostics.record(1 / 72, true, i, 10, null);
    assert.notEqual(diagnostics.summary, '');
    for (let i = 0; i < 100; i++) diagnostics.record(1 / 72, true, 150 + i, 10, null);
    diagnostics.clear();
    assert.equal(diagnostics.summary, '');
    let produced = false, frames = 0;
    for (; !produced; frames++) produced = diagnostics.record(1 / 72, true, 400 + frames, 10, null);
    assert.ok(frames >= 144, 'a full new window, not the remainder of the old one');
    assert.match(diagnostics.summary, /^Display 72\.0 fps \| Background 7[12]\.\d fps/);
});

test('the main and pause screens show the line (headset readable); other screens and normal runs do not', () => {
    const { menuLayout, DEFAULT_MENU_STATE } = load('xr/XrMenuModel.ts');
    const base = { settings: historicalXrSettings(load), sessionState: 'paused', trackTitle: 'Song', busy: false, canStart: true,
        status: '', results: null, input: 'vr' };
    const line = 'Display 72.0 fps | Background 24.0 fps, 30.0 ms';
    const pause = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'pause' }, { ...base, diagnostics: line });
    const text = pause.texts.find(t => t.text === line);
    assert.ok(text, 'shown on pause');
    const lowest = Math.max(...pause.items.map(i => i.y + i.h));
    assert.ok(text.y - text.size >= lowest, 'below the buttons (Exit VR included)');
    const footer = pause.texts.find(t => t.text.startsWith('Point with a controller'));
    assert.ok(text.y + text.size * 1.2 + text.size < footer.y, 'above the footer hint');
    assert.ok(menuLayout({ ...DEFAULT_MENU_STATE, screen: 'main' }, { ...base, sessionState: 'ready', diagnostics: line }).texts.some(t => t.text === line));
    assert.ok(!menuLayout({ ...DEFAULT_MENU_STATE, screen: 'pause' }, base).texts.some(t => t.text === line), 'nothing without diagnostics');
});

test('a profiling in-thread source reports its stages; a normal one does not time anything', async () => {
    class Backend { constructor(width, height) { this.canvas = { width, height }; this.frameCount = 0; } background() {} }
    const clocks = [];
    class Identity {
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; this.stageTimes = { background: 2, grains: 9, weave: 0, resolve: 4, composite: 3 }; }
        setStageClock(clock) { clocks.push(clock); } syncPosition() {} setDepthCue() {} setDepthLayers() {} draw() {}
    }
    const sourceLoad = createLoader({
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }
    }, { fetch: async () => ({ ok: true, json: async () => ({}) }), performance });
    const { WormholeCanvasSource } = sourceLoad('visuals/WormholeCanvasSource.ts');
    const plain = new WormholeCanvasSource({ width: 64, height: 36 });
    await plain.prepare(null);
    plain.render(1, false);
    assert.equal(plain.stageTimes, null);
    assert.equal(clocks.length, 0, 'no clock reaches an identity unless profiling');
    const profiled = new WormholeCanvasSource({ width: 64, height: 36, profile: true });
    await profiled.prepare(null);
    profiled.render(1, false);
    const stages = profiled.stageTimes;
    assert.deepEqual(Object.keys(stages), ['tune', 'background', 'grains', 'weave', 'resolve', 'composite', 'draw']);
    assert.deepEqual([stages.grains, stages.resolve], [9, 4], "the identity's stages are passed on");
    assert.ok(stages.tune >= 0 && stages.draw >= 0);
    assert.ok(clocks.length >= 2 && clocks.every(c => typeof c.now === 'function'), 'every fresh identity gets the clock');
    plain.dispose(); profiled.dispose();
});
