import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const bitmap = () => ({ closes: 0, close() { this.closes++; } });
const id = (serial = 1, generation = 1) => ({ contextId: 'job', generation, requestSerial: serial, frameIndex: 24, fps: 24, songTime: 1 });
const frame = (identity, image = bitmap()) => ({ type: 'exact-frame', identity, frame: { type: 'frame', generation: identity.generation,
    time: identity.songTime, bitmap: image, focalX: .2, focalY: -.1, renderMs: 4, spatial: { time: identity.songTime },
    material: { count: 1, data: new Float32Array(24) }, lines: { count: 0, data: new Float32Array(0) } } });
function proxy(timing = {setTimeout, clearTimeout}) {
    const worker = { posted: [], onmessage: null, onerror: null, terminate() { this.terminated = true; }, postMessage(m, t) { this.posted.push({ m, t }); } };
    const load = createLoader({ './wormholeRender.worker.ts?worker': { __esModule: true, default: class {} } }, timing);
    const Source = load('visuals/WormholeExactWorkerSource.ts').WormholeExactWorkerSource;
    const source = new Source({ contextId: 'job', createWorker: () => worker });
    const send = m => worker.onmessage?.({ data: m });
    const ready = async () => { const p = source.prepare({ duration: 10 }); send({ type: 'capabilities', protocol: 2, contextId: 'job', sampler: 'fixed-song-60-v1' });
        send({ type: 'prepared', generation: 1 }); await p; };
    return { source, worker, send, ready };
}

test('exact worker negotiates capability, echoes an atomic identity and permits one released lease', async () => {
    const h = proxy(); await h.ready();
    assert.equal(h.worker.posted[0].m.protocol, 2);
    const p = h.source.requestFrame(24, 24), requested = h.worker.posted.at(-1).m.identity;
    assert.deepEqual(plain(requested), id());
    await assert.rejects(h.source.requestFrame(24, 24), /Release/);
    const response = frame(requested); h.send(response); const lease = await p;
    assert.deepEqual(plain(lease.identity), id()); assert.equal(lease.spatial.time, 1);
    assert.equal(lease.material, response.frame.material); assert.equal(lease.lines, response.frame.lines);
    await assert.rejects(h.source.requestFrame(24, 24), /Release/);
    lease.release(); lease.release(); assert.equal(response.frame.bitmap.closes, 1);
    assert.equal(h.worker.posted.filter(x => x.m.type === 'release-exact').length, 1);
    assert.equal(h.worker.posted.at(-1).t[0], response.frame.material.data.buffer);
    const repeat = h.source.requestFrame(24, 24); h.send(frame(id(2))); (await repeat).release();
    h.source.dispose(); assert.equal(h.worker.terminated, true);
});

test('wrong serial/time/context/generation never replaces or settles the requested image', async () => {
    const h = proxy(); await h.ready(); const p = h.source.requestFrame(24, 24);
    for (const patch of [{ requestSerial: 99 }, { contextId: 'old' }, { generation: 0 }, { songTime: 2 }, { fps: 60 }, { frameIndex: 99 }]) {
        const wrong = frame({ ...id(), ...patch }); h.send(wrong); assert.equal(wrong.frame.bitmap.closes, 1);
    }
    h.send(frame(id())); (await p).release(); h.source.dispose();
});

test('v1 preparation and unchanged preview responses are rejected instead of exported', async () => {
    const old = proxy(), p = old.source.prepare(null); old.send({ type: 'prepared', generation: 1 });
    await assert.rejects(p, /negotiate/); assert.equal(old.worker.terminated, true);
    const h = proxy(); await h.ready(); const requested = h.source.requestFrame(24, 24);
    h.send({ type: 'unchanged', generation: 1 }); await assert.rejects(requested, /Unchanged/); assert.equal(h.worker.terminated, true);
});

test('companion mismatch, worker failure, cancellation and dispose close resources and settle requests', async () => {
    for (const reason of ['mismatch', 'failure', 'abort', 'dispose']) {
        const h = proxy(); await h.ready(); const abort = new AbortController(), p = h.source.requestFrame(24, 24, abort.signal);
        if (reason === 'mismatch') { const bad = frame(id()); bad.frame.spatial.time = 2; h.send(bad); assert.equal(bad.frame.bitmap.closes, 1); }
        if (reason === 'failure') h.send({ type: 'failure', message: 'lost context' });
        if (reason === 'abort') abort.abort(); if (reason === 'dispose') h.source.dispose();
        await assert.rejects(p); assert.equal(h.worker.terminated, true, reason);
    }
});

test('superseded preparation rejects exact work and returns late image ownership', async () => {
    const h = proxy(); await h.ready(); const old = h.source.requestFrame(24, 24);
    const next = h.source.prepare({ duration: 3 }); await assert.rejects(old, /superseded/);
    const late = frame(id()); h.send(late); assert.equal(late.frame.bitmap.closes, 1);
    h.send({ type: 'prepared', generation: 1 }); h.send({ type: 'prepared', generation: 2 }); await next;
    const request = h.source.requestFrame(24, 24); h.send(frame(id(2, 2))); (await request).release(); h.source.dispose();
});

test('invalid frame clocks, pre-cancelled work and preparation errors fail explicitly', async () => {
    const h = proxy(); await h.ready();
    for (const [i, fps] of [[-1, 60], [1.2, 60], [1, 0], [1, Infinity], [1, 241], [1, Number.MIN_VALUE], [1000, 24]]) await assert.rejects(h.source.requestFrame(i, fps));
    const abort = new AbortController(); abort.abort(); await assert.rejects(h.source.requestFrame(1, 24, abort.signal), /cancelled/);
    h.source.dispose(); await assert.rejects(h.source.prepare(null), /disposed/);
});

function workerHarness() {
    const messages = [], instances = [];
    const scope = { onmessage: null, postMessage(m, transfer) { messages.push({ m, transfer }); }, close() {} };
    class Source {
        constructor() { instances.push(this); this.canvas = { transferToImageBitmap: bitmap }; this.focalPoint = { x: .1, y: .2 };
            this.materialFrame = { count: 1, data: new Float32Array(24).fill(.3) }; this.lineFrame = { count: 1, data: new Float32Array(9).fill(.5) }; }
        async prepare() {} setPresentation() {} dispose() {}
        renderExact(time) { this.spatialFrame = { time }; this.time = time; }
    }
    createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: Source } }, { self: scope, performance: { now: () => 0 } })('visuals/wormholeRender.worker.ts');
    return { messages, instances, send: m => scope.onmessage({ data: m }) };
}
test('real v2 worker adapter validates exact identity, holds a bounded shared carrier lease and returns it', async () => {
    const h = workerHarness(); h.send({ type: 'init', protocol: 2, contextId: 'job', width: 64, height: 36, depthCue: 0 });
    assert.equal(h.messages[0].m.type, 'capabilities');
    h.send({ type: 'render-exact', identity: id() }); assert.equal(h.messages.at(-1).m.type, 'exact-error');
    h.send({ type: 'prepare', generation: 1, analysis: null }); await Promise.resolve();
    h.send({ type: 'render-exact', identity: id() }); const a = h.messages.at(-1).m;
    assert.equal(a.type, 'exact-frame'); assert.equal(h.instances[0].time, 1);
    assert.equal(a.frame.material.data.buffer, a.frame.lines.data.buffer);
    assert.equal(a.frame.lines.data.byteOffset, 24 * 4);
    h.send({ type: 'render-exact', identity: id(2) }); assert.equal(h.messages.at(-1).m.type, 'exact-error');
    h.send({ type: 'release-exact', identity: id(99), buffer: a.frame.material.data.buffer });
    h.send({ type: 'render-exact', identity: id(2) }); assert.equal(h.messages.at(-1).m.type, 'exact-error');
    h.send({ type: 'release-exact', identity: id(), buffer: a.frame.material.data.buffer });
    h.send({ type: 'render-exact', identity: id(2) }); const b = h.messages.at(-1).m;
    assert.equal(b.type, 'exact-frame'); assert.equal(a.frame.material.data.buffer, b.frame.material.data.buffer, 'returned buffer reused');
    h.send({ type: 'release-exact', identity: id(2), buffer: b.frame.material.data.buffer });
    h.send({ type: 'render-exact', identity: { ...id(3), songTime: 2 } }); assert.equal(h.messages.at(-1).m.type, 'exact-error');
    h.send({ type: 'dispose' });
});

function sampler() {
    const traces = [];
    class Backend {
        constructor(w, h) { this.width = w; this.height = h; this.frameCount = 0; this.canvas = { width: w, height: h }; }
        background(...args) { traces.length = 0; traces.push(['background', ...args]); }
        beginFieldRaster() { return null; }
    }
    for (const method of ['noStroke', 'noFill', 'fill', 'stroke', 'strokeWeight', 'line', 'circle', 'triangle', 'beginShape', 'vertex', 'endShape', 'radialGlow', 'radialDim', 'compositeRingTint', 'drawFieldRaster'])
        Backend.prototype[method] = function (...args) { traces.push([method, ...args]); };
    const load = createLoader({ './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend } },
        { fetch: async () => ({ ok: true, json: async () => ({ visualTuning: { wormholeSpeed: .8, wormholePathBend: .8, wormholePathBendVertical: -.3,
            wormholeGrainDensity: .12, wormholeNebulaAmount: .3, wormholeSpiral: .8, transitionSpeed: .003 } }) }) });
    const raw = load('config/visualTuning.ts').cloneDefaultVisualTuning();
    Object.assign(raw, { wormholeGrainDensity: .12, wormholeNebulaAmount: .3, wormholeSpiral: .4, wormholePathBend: -.6, transitionSpeed: .003 });
    const source = new (load('visuals/WormholeCanvasSource.ts').WormholeCanvasSource)({ width: 100, height: 64,
        contextSeed: { version: 1, rawTuning: raw, macros: { intensity: .5, motion: .5, depth: .5, detail: .5 }, boosts: {},
            policy: { gains: 'raw', semanticResolver: false, semanticChoreography: false } }, externalMaterial: true, externalLines: true });
    const trackAnalysis = load('analyzer/normalizeAnalysisResult.ts').createEmptyTrackAnalysis();
    const frames = Array.from({ length: 80 }, (_, i) => ({ e: .3 + .2 * Math.sin(i), eRatio: 1, densityProj: .3, melodyProj: .2, fxProj: 0,
        subEnergy: .5, bassEnergy: .4, subFlux: .2, bassFlux: .1, state: i > 10 && i < 20 ? 'LOW_DROP' : 'DRIVE', perceptualSpectrum: Array(24).fill(.4) }));
    trackAnalysis.features = frames.map(() => ({ melody: .2, vocal: .1, fx: 0, density: .3, brightness: .4, tension: .2 }));
    const analysis = { frames, events: [{ time: .3, type: 1, intensity: .8 }, { time: .8, type: 2, intensity: .7 }], trackAnalysis,
        sampleRate: 20, hopSize: 1, bpm: 128, duration: 4, performancePlan: { version: 1, source: 'edited', points: [0, .5].map((time, i) =>
            ({ id: 'p' + i, time, preset: 'fixed.json', confidence: 1, intensity: 1, reason: 'build', morphDurationSec: 1, morphCurve: 'linear', spiralDirection: i ? -1 : 1 })) } };
    const digest = () => createHash('sha256').update(JSON.stringify({ traces, focal: source.focalPoint, spatial: source.spatialFrame,
        material: source.materialFrame ? { ...source.materialFrame, data: [...source.materialFrame.data] } : null,
        lines: source.lineFrame ? { ...source.lineFrame, data: [...source.lineFrame.data] } : null })).digest('hex');
    return { source, analysis, digest };
}
test('real identity exact replay agrees after 24/36/60 Hz histories, backward seeks and repeated fractional frames', async () => {
    const h = sampler(), before = plain(h.analysis); await h.source.prepare(h.analysis);
    h.source.renderExact(1.125); const expected = h.digest();
    assert.ok(h.source.materialFrame.count > 0, 'exercise real release/material geometry');
    for (const hz of [24, 36, 60]) {
        for (let i = 0; i <= hz; i++) h.source.render(i / hz, true, true);
        h.source.render(3, false); h.source.render(.2, false);
        h.source.renderExact(1.125); assert.equal(h.digest(), expected, `${hz} Hz history`);
    }
    h.source.renderExact(1.125); assert.equal(h.digest(), expected, 'repeated exact endpoint');
    h.source.renderExact(.125); h.source.renderExact(1.125); assert.equal(h.digest(), expected, 'backward exact seek');
    h.source.setPresentation({ maxFrameRateHz: 1 }); h.source.renderExact(1.125); assert.equal(h.digest(), expected, 'preview rate cap bypass');
    assert.deepEqual(plain(h.analysis), before, 'analysis/plan immutable');
    for (const t of [-1, NaN, Infinity, 5]) assert.throws(() => h.source.renderExact(t));
    h.source.dispose(); assert.throws(() => h.source.renderExact(0), /prepared/);
});

test('local exact fallback owns immutable companions and closes delayed or superseded bitmap results', async () => {
    let resolveBitmap;
    class Source { constructor() { this.canvas = {}; this.focalPoint = { x: .1, y: .2 }; this.spatialFrame = { time: 0 }; }
        async prepare() {} renderExact(t) { this.spatialFrame.time = t;
            this.materialFrame = { count: 1, data: new Float32Array(48).fill(.5) };
            this.lineFrame = { count: 1, data: new Float32Array(27).fill(.2) }; } setPresentation() {} dispose() {} }
    const load = createLoader({ './WormholeCanvasSource': { WormholeCanvasSource: Source } },
        { createImageBitmap: () => new Promise(resolve => { resolveBitmap = resolve; }) });
    const Local = load('visuals/WormholeExactFrameSource.ts').WormholeExactFrameSource;
    const source = new Local('local'); await source.prepare(null);
    const p = source.requestFrame(1, 24); await Promise.resolve();
    await assert.rejects(source.requestFrame(1, 24), /Release/);
    const image = bitmap(); resolveBitmap(image); const lease = await p;
    assert.equal(lease.spatial.time, 1 / 24); assert.equal(lease.material.data.length, 24); assert.equal(lease.lines.data.length, 9);
    lease.release(); lease.release(); assert.equal(image.closes, 1);
    const stale = source.requestFrame(2, 24); await Promise.resolve(); source.dispose();
    const late = bitmap(); resolveBitmap(late); await assert.rejects(stale, /superseded/); assert.equal(late.closes, 1);
});

test('exact preparation has a deadline after negotiation and clears timers on replacement, completion, error and disposal',async()=>{
 const timers=new Set(),timing={setTimeout(fn,ms){const token={fn,ms};timers.add(token);return token;},clearTimeout(token){timers.delete(token);}};
 const capabilities={type:'capabilities',protocol:2,contextId:'job',sampler:'fixed-song-60-v1'};
 const h=proxy(timing);h.send(capabilities);const p=h.source.prepare(null),rejected=assert.rejects(p,/preparation timed out/);
 assert.equal(timers.size,1);[...timers][0].fn();await rejected;assert.equal(timers.size,0);assert.equal(h.worker.terminated,true);
 const next=proxy(timing);next.send(capabilities);const old=next.source.prepare(null),oldRejected=assert.rejects(old,/superseded/);const oldTimer=[...timers][0];
 const active=next.source.prepare(null);await oldRejected;assert.equal(timers.size,1);oldTimer.fn();assert.equal(next.worker.terminated,undefined);
 next.send({type:'prepared',generation:2});await active;assert.equal(timers.size,0);next.source.dispose();
 for(const action of ['prepare-error','messageerror','dispose']){const q=proxy(timing);q.send(capabilities);const work=q.source.prepare(null),failed=assert.rejects(work);
  if(action==='prepare-error')q.send({type:'prepare-error',generation:1,message:'failed'});else if(action==='messageerror')q.worker.onmessageerror({});else q.source.dispose();
  await failed;assert.equal(timers.size,0,action);q.source.dispose();
 }
});
