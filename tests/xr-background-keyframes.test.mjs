// Beat blend (ADR-009 Addendum U): beat-locked background keyframes rendered ahead of playback and
// blended on the GPU. Pure timing policy plus the backdrop's keyframe ring with a fake source.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({ three: THREE });
const {
    keyframeGrid, chooseSubdivision, KeyframeGovernor, flowCoefficient, flowSampleScale, blendKeyframes, NO_KEYFRAME_GRID,
    MAX_KEYFRAME_INTERVAL_SEC, FLOW_REFERENCE_RADIUS
} = load('xr/scene/BackgroundKeyframes.ts');
const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
const { CONTINUITY_GAP_SEC } = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => null }) } })
    ('visuals/WormholeCanvasSource.ts');

const BEAT = 0.5; // 120 BPM
const beats = Array.from({ length: 41 }, (_, i) => i * BEAT);
const analysis = (overall = 0.9, grid = beats) => ({ trackAnalysis: { beats: grid, timingConfidence: { overall } } });
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the beat grid is used only when it is trustworthy', () => {
    assert.equal(keyframeGrid(analysis()).reliable, true);
    assert.equal(keyframeGrid(analysis(0.3)), NO_KEYFRAME_GRID, 'low timing confidence');
    assert.equal(keyframeGrid(analysis(0.9, [1, 1, 2])), NO_KEYFRAME_GRID, 'not increasing');
    assert.equal(keyframeGrid(analysis(0.9, [1])), NO_KEYFRAME_GRID);
    assert.equal(keyframeGrid(null), NO_KEYFRAME_GRID);
    assert.ok(MAX_KEYFRAME_INTERVAL_SEC < CONTINUITY_GAP_SEC, 'a keyframe gap is never mistaken for a seek by the source');
});

test('the subdivision is the finest the measured cost sustains, within the longest allowed gap, with hysteresis', () => {
    const beat = 60 / 128;
    assert.equal(chooseSubdivision(beat, 0.05), 8, '58.6 ms keyframes when 50 ms are needed');
    assert.equal(chooseSubdivision(beat, 0.07), 4);
    assert.equal(chooseSubdivision(beat, 0.15), 2);
    assert.equal(chooseSubdivision(beat, 0.3), 1);
    assert.equal(chooseSubdivision(beat, 0.9), 1, 'overloaded: the longest allowed gap');
    assert.equal(chooseSubdivision(1.2, 0.01), 8);
    assert.equal(chooseSubdivision(1.2, 0.9), 4, 'a slow tempo still keeps the gap within the maximum');
    assert.equal(chooseSubdivision(beat, 0.055, 4), 4, 'refining needs 20% headroom');
    assert.equal(chooseSubdivision(beat, 0.045, 4), 8);
});

test('keyframes land on every beat and subdivide it as the measured cost allows; the update rate caps them', () => {
    const governor = new KeyframeGovernor(), grid = keyframeGrid(analysis());
    const times = [];
    for (let t = -0.001; t < 4; ) { t = governor.nextKeyframe(grid, t, 36); times.push(t); }
    for (let b = 0; b <= 4; b += BEAT) assert.ok(times.some(t => close(t, b)), `beat ${b} is a keyframe`);
    assert.ok(close(governor.intervalSec, BEAT / 8), 'cheap frames (30 ms assumed): eighth-beats');
    for (let i = 0; i < 40; i++) governor.sample(90);
    assert.ok(close(governor.nextKeyframe(grid, 1, 36), 1.25), 'expensive frames: half beats');
    assert.ok(close(governor.nextKeyframe(grid, 1.3, 36), 1.5));
    const capped = new KeyframeGovernor();
    capped.nextKeyframe(grid, 0, 6);
    assert.ok(close(capped.intervalSec, BEAT / 2), 'a 6 Hz cap keeps keyframes at least 1/6 s apart');
    const free = new KeyframeGovernor();
    const t1 = free.nextKeyframe(NO_KEYFRAME_GRID, 0.2, 36);
    assert.ok(t1 > 0.2 && close(free.intervalSec, 0.05), 'no grid: a fixed lattice at the sustainable gap');
    assert.ok(new KeyframeGovernor().nextKeyframe(grid, 25, 36) > 25, 'beyond the grid the edge beat length continues');
});

test('blends are linear in time with matching flight shifts; the flow is mild and only forward', () => {
    const blend = blendKeyframes(1, 1.25, 1.0625, 0.4);
    assert.ok(close(blend.weightA, 0.75) && close(blend.weightB, 0.25));
    assert.ok(close(blend.flowA, 0.1) && close(blend.flowB, -0.3), 'A advanced by a quarter, B rewound by three quarters');
    assert.equal(blendKeyframes(1, 1.25, 2, 0.4).weightB, 1, 'clamped');
    assert.ok(close(flowCoefficient(100, 100 + 2.4 * FLOW_REFERENCE_RADIUS), 1));
    assert.equal(flowCoefficient(100, 90), 0, 'never a backward flow');
    assert.equal(flowSampleScale(0.8, 0), 1);
    assert.ok(flowSampleScale(0.8, 0.25) < 1 && flowSampleScale(0.8, -0.25) > 1);
    assert.equal(flowSampleScale(10, -1), 5, 'bounded near the singularity');
});

function keyframeSource({ costMs = 20, async = false } = {}) {
    const source = {
        canvas: { width: 640, height: 360 }, requests: [], renders: 0, pending: null, ready: null, prepared: 0,
        async prepare() { this.prepared++; this.ready = null; this.pending = null; },
        render() { this.renders++; return true; },
        setPresentation(p) { this.presentation = p; },
        requestFrame(time, playing) {
            if (this.pending) return false;
            this.requests.push([time, playing]);
            const frame = { time, focalX: 0.1, focalY: -0.05, travel: time * 240, renderMs: costMs };
            if (async) this.pending = frame; else this.ready = frame;
            return true;
        },
        finish() { this.ready = this.pending; this.pending = null; },
        takeFrame() { const f = this.ready; this.ready = null; return f; },
        dispose() { this.disposed = true; }
    };
    return source;
}

async function beatBackdrop(source, rate = 36) {
    const backdrop = new WormholeBackdrop(source);
    backdrop.configure({ lineStroke: 0.34 }, 2, { motion: 'beat', maxKeyframeRateHz: rate });
    await backdrop.prepare(analysis());
    return backdrop;
}
/** One display frame: the scene update, then the draw that uploads the slot textures. */
function frame(backdrop, t, playing = true) { backdrop.update(t, playing); backdrop.root.onBeforeRender(); }
function uniforms(backdrop) {
    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
    backdrop.root.material.onBeforeCompile(shader);
    return shader;
}

test('Beat blend renders a few keyframes per beat ahead of playback and blends every display frame', async () => {
    const source = keyframeSource();
    const backdrop = await beatBackdrop(source);
    const shader = uniforms(backdrop);
    assert.equal(backdrop.activeMotion, 'beat');
    for (let i = 0; i <= 144; i++) frame(backdrop, i / 72);
    const times = source.requests.map(([t]) => t);
    assert.equal(source.renders, 0, 'no per-frame redraws');
    assert.ok(times.length < 45, `${times.length} keyframes for 145 display frames`);
    assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]), 'keyframe times increase');
    for (const b of [0.5, 1, 1.5]) assert.ok(times.some(t => close(t, b)), `beat ${b} is rendered exactly`);
    assert.ok(Math.max(...times) > 2, 'rendered ahead of playback');
    const w = shader.uniforms.uWeights.value;
    assert.ok(close(w.x + w.y + w.z, 1), 'weights sum to one');
    assert.equal([w.x, w.y, w.z].filter(v => v > 0).length <= 2, true);
    const focus = backdrop.focalPoint;
    assert.ok(close(focus.x, 0.1) && close(focus.y, -0.05), 'the displayed focal point follows the blended keyframes');
    assert.ok(backdrop.keyframeIntervalSec > 0 && backdrop.keyframeIntervalSec <= BEAT);
    // Mid-way between two keyframes both contribute, the earlier one advanced, the later one rewound.
    let blended = false;
    for (let i = 145; i < 200 && !blended; i++) {
        frame(backdrop, i / 72);
        const f = shader.uniforms.uFlow.value, weights = shader.uniforms.uWeights.value;
        blended = [0, 1, 2].filter(k => weights.getComponent(k) > 0.05).length === 2
            && [0, 1, 2].some(k => f.getComponent(k) > 0) && [0, 1, 2].some(k => f.getComponent(k) < 0);
    }
    assert.ok(blended, 'two keyframes blend with opposite flight shifts');
    backdrop.dispose();
});

test('pausing freezes the blend without new keyframes; a presentation change or a seek renders the exact time', async () => {
    const source = keyframeSource();
    const backdrop = await beatBackdrop(source);
    for (let i = 0; i <= 100; i++) frame(backdrop, i / 72);
    const pausedAt = 100 / 72;
    // The configure() before play asked for one exact paused frame at the first pause.
    for (let i = 0; i < 30; i++) frame(backdrop, pausedAt, false);
    const afterPause = source.requests.length;
    assert.deepEqual(source.requests.at(-1), [pausedAt, false], 'one exact frame of the paused time');
    for (let i = 0; i < 30; i++) frame(backdrop, pausedAt, false);
    assert.equal(source.requests.length, afterPause, 'a steady pause renders nothing');
    backdrop.configure({ lineStroke: 0.9 }, 2, { motion: 'beat', maxKeyframeRateHz: 36 });
    for (let i = 0; i < 5; i++) frame(backdrop, pausedAt, false);
    assert.deepEqual(source.requests.at(-1), [pausedAt, false], 'a paused presentation change redraws the exact time');
    assert.equal(source.requests.length, afterPause + 1);
    frame(backdrop, 0.3, true);
    frame(backdrop, 0.3 + 1 / 72, true);
    assert.ok(close(source.requests.at(-1)[0], 0.3) || close(source.requests.at(-2)[0], 0.3), 'a backward seek starts again at the shown time');
    backdrop.dispose();
});

test('an asynchronous source keeps one request in flight; a stale answer after a seek is dropped', async () => {
    const source = keyframeSource({ async: true });
    const backdrop = await beatBackdrop(source);
    frame(backdrop, 5);
    assert.equal(source.requests.length, 1);
    frame(backdrop, 5 + 1 / 72);
    assert.equal(source.requests.length, 1, 'no second request while one is in flight');
    frame(backdrop, 1); // seek back while the 5 s keyframe renders
    source.finish();
    frame(backdrop, 1 + 1 / 72);
    assert.equal(backdrop.keyframeCount, 0, 'the superseded keyframe is not shown');
    assert.ok(close(source.requests.at(-1)[0], 1 + 1 / 72), 'the freed slot is reused at once for the new time');
    backdrop.dispose();
});

test('Every frame motion keeps the historical per-update redraws; sources without keyframes always do', async () => {
    const source = keyframeSource();
    const backdrop = new WormholeBackdrop(source);
    backdrop.configure({}, 2, { motion: 'direct', maxKeyframeRateHz: 36 });
    await backdrop.prepare(analysis());
    for (let i = 0; i < 12; i++) frame(backdrop, i / 72);
    assert.equal(source.renders, 6, 'every second display frame');
    assert.equal(source.requests.length, 0);
    assert.equal(backdrop.activeMotion, 'direct');
    assert.equal(JSON.stringify(uniforms(backdrop).uniforms.uWeights.value), JSON.stringify(new THREE.Vector3(1, 0, 0)), 'the plain single sample');
    backdrop.configure({}, 2, { motion: 'beat', maxKeyframeRateHz: 36 });
    assert.equal(backdrop.activeMotion, 'beat', 'switches live');
    const legacy = { canvas: { width: 64, height: 36 }, renders: 0, async prepare() {}, render() { this.renders++; return true; }, dispose() {} };
    const plain = new WormholeBackdrop(legacy);
    plain.configure({}, 1, { motion: 'beat', maxKeyframeRateHz: 36 });
    await plain.prepare(null);
    frame(plain, 0.5);
    assert.equal(plain.activeMotion, 'direct'); assert.equal(legacy.renders, 1);
    backdrop.dispose(); plain.dispose();
});
