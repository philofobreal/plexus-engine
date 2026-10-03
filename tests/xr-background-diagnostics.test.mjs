// Opt-in background profiling for headset runs (`?xrDiagnostics=1`): the worker's stage times reach
// the host, are averaged over two seconds of play and shown in the game menu.
import test from 'node:test';
import assert from 'node:assert/strict';
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
        constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.stageTimes = { background: 2, grains: 9, weave: 0, resolve: 4, composite: 3 }; }
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
