import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness(options = { loopPlayback: false, heroMetronome: false }) {
    const workers = [], sources = [], decodes = [];
    let stemCalls = 0;
    const state = { isPlaying: false, loopPlayback: true, duration: 0, currentTime: 0,
        targetTuning: { phraseSize: 4 }, visualTuning: {}, modulation: {} };
    const ctx = { currentTime: 0, outputLatency: 0.02, state: 'running', destination: {},
        decodeAudioData: bytes => new Promise((resolve, reject) => decodes.push({ bytes, resolve, reject })),
        createBufferSource: () => {
            const source = { onended: null, buffer: null, stopped: false, disconnected: false,
                connect() {}, start() {}, stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
            sources.push(source); return source;
        }
    };
    class Worker {
        constructor() { workers.push(this); }
        postMessage(data) { this.request = data; }
        terminate() { this.terminated = true; }
        complete(events = [{ time: 2, intensity: 0.8, type: 1 }]) {
            this.onmessage({ data: { type: 'analysis_done', requestId: this.request.requestId, bpm: 120,
                adaptiveThreshold: 0.1, frames: [], events, hopSize: 1024, trackAnalysis: { beats: [1, 2], bpm: 120 } } });
        }
    }
    const load = createLoader({
        './analyzer.worker.ts?worker': Worker,
        '../analyzer': { ANALYSIS_ALGORITHM_VERSION: 5, createEmptyTrackAnalysis: () => ({}), normalizeTrackAnalysis: a => a, normalizeAudioFrame: a => a },
        '../config/featureFlags': { featureFlags: { heroEffect: false } },
        '../state/store': { State: state }, '../state/visualTransitionState': { resetActiveVisualTransitions() {} },
        './HeroMetronome': { HeroMetronome: { generateStems() { stemCalls++; return []; } } }
    }, { window: { AudioContext: function () { return ctx; } } });
    const { AudioEngine } = load('audio/AudioEngine.ts');
    const engine = new AudioEngine(undefined, options);
    const { RhythmGameSession, buildRhythmChart, notePosition, CUT_VECTORS } = load('gameplay/index.ts');
    const game = new RhythmGameSession();
    const { XrPlaybackBinding } = load('xr/XrPlaybackBinding.ts');
    let resets = 0;
    const binding = new XrPlaybackBinding(engine, game, () => resets++);
    engine.onAnalysisComplete = () => game.loadChart(buildRhythmChart({ events: state.events, durationSec: state.duration, beats: [] }));
    const buffer = duration => ({ duration, sampleRate: 48000, getChannelData: () => new Float32Array(16) });
    async function ready() {
        const loading = engine.loadFile({ arrayBuffer: async () => new ArrayBuffer(8) });
        await new Promise(setImmediate); decodes.at(-1).resolve(buffer(5)); await loading;
        workers.at(-1).complete();
    }
    return { engine, game, binding, state, ctx, sources, workers, decodes, buffer, ready, notePosition, CUT_VECTORS,
        stemCalls: () => stemCalls, resets: () => resets };
}

test('real AudioEngine: load -> chart -> play -> hit -> pause/resume -> natural end -> restart -> second track', async () => {
    const h = harness(); await h.ready();
    assert.equal(h.game.getState(), 'ready');
    assert.equal(h.stemCalls(), 0);
    h.engine.play(0);
    h.ctx.currentTime = 2.03;
    const time = h.engine.getCurrentTime(), note = h.game.getActiveNotes(time)[0].note;
    const p = h.notePosition(note, time, {}), v = h.CUT_VECTORS[note.cutDirection] ?? [0, -1];
    const hit = h.game.attemptStrike({ hand: note.hand, songTime: time, previousSongTime: time - 0.02,
        previousPosition: { ...p, x: p.x - v[0] * 0.05, y: p.y - v[1] * 0.05 },
        position: { ...p, x: p.x + v[0] * 0.05, y: p.y + v[1] * 0.05 }, speed: 5 });
    assert.ok(hit);
    h.engine.stop(false); assert.equal(h.game.getState(), 'paused');
    const oldSource = h.sources[0];
    assert.equal(oldSource.onended, null); assert.ok(oldSource.stopped && oldSource.disconnected);
    h.engine.play(); assert.equal(h.game.getState(), 'playing');
    assert.equal(h.game.getSnapshot().score, 100);
    let endings = 0; h.engine.addPlaybackEndedListener(() => endings++);
    h.ctx.currentTime = 5.08; h.sources.at(-1).onended();
    assert.equal(endings, 1); assert.equal(h.game.getState(), 'finished');
    assert.equal(h.state.isPlaying, false); assert.equal(h.sources.length, 2);
    h.engine.play(0); assert.equal(h.game.getSnapshot().score, 0);
    await h.ready(); assert.equal(h.game.getState(), 'ready');
    assert.equal(h.game.getSnapshot().score, 0); assert.equal(h.stemCalls(), 0);
});

test('real seek ordering resets once and preserves playing/paused state without duplicate score', async () => {
    const h = harness(); await h.ready(); h.engine.play();
    const order = []; h.engine.addPlaybackStateListener(e => order.push(e));
    h.engine.addPositionChangedListener(() => order.push('position'));
    let seeks = 0; const seek = h.game.seek.bind(h.game); h.game.seek = t => { seeks++; seek(t); };
    h.ctx.currentTime = 2.03; h.engine.seek(2);
    assert.deepEqual(order, ['pause', 'position', 'seek', 'position', 'play']);
    assert.equal(seeks, 1); assert.equal(h.game.getState(), 'playing');
    h.engine.stop(false); h.engine.seek(0.5);
    assert.equal(h.game.getState(), 'paused'); assert.equal(seeks, 2);
    const resets = h.resets(); h.binding.dispose(); h.engine.play(); assert.equal(h.resets(), resets);
});

test('superseded arrayBuffer/decode/worker success and failure cannot publish or terminate latest worker', async () => {
    const h = harness();
    let resolveA;
    const a = h.engine.loadFile({ arrayBuffer: () => new Promise(resolve => { resolveA = resolve; }) });
    const b = h.engine.loadFile({ arrayBuffer: async () => new ArrayBuffer(8) });
    await new Promise(setImmediate); h.decodes[0].resolve(h.buffer(6)); await b;
    resolveA(new ArrayBuffer(8)); await a; assert.equal(h.decodes.length, 1);
    const oldWorker = h.workers[0];
    const c = h.engine.loadFile({ arrayBuffer: async () => new ArrayBuffer(8) }); await new Promise(setImmediate);
    const d = h.engine.loadFile({ arrayBuffer: async () => new ArrayBuffer(8) }); await new Promise(setImmediate);
    h.decodes[2].resolve(h.buffer(9)); await d;
    h.decodes[1].resolve(h.buffer(99)); await c;
    assert.equal(h.state.duration, 9); assert.equal(h.engine.getAudioBuffer().duration, 9);
    oldWorker.complete(); oldWorker.onerror({ message: 'stale' });
    assert.equal(h.workers.at(-1).terminated, undefined);
    h.workers.at(-1).complete(); assert.equal(h.game.getState(), 'ready');
});

test('default dashboard AudioEngine retains the loop preference and Hero generation', async () => {
    const h = harness({}); await h.ready(); assert.equal(h.stemCalls(), 1);
    h.engine.play(); h.ctx.currentTime = 5.03; h.sources.at(-1).onended();
    assert.equal(h.sources.length, 2); assert.equal(h.state.isPlaying, true);
});



test('natural end survives large output latency and ignores a captured stale onended callback', async () => {
    const h = harness(); await h.ready(); h.engine.play();
    const staleEnd = h.sources.at(-1).onended;
    h.engine.stop(false); h.engine.play();
    h.ctx.currentTime = 5; h.ctx.outputLatency = 0.3;
    staleEnd(); assert.equal(h.state.isPlaying, true);
    h.sources.at(-1).onended(); assert.equal(h.game.getState(), 'finished');
});

