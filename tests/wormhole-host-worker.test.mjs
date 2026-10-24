import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness() {
    const messages = [], presented = [], timers = new Map(); let stopped = 0, invalidations = 0, id = 0;
    const port = { onmessage: null, onerror: null, onmessageerror: null,
        postMessage(message) { messages.push(structuredClone(message)); }, terminate() { stopped++; } };
    const load = createLoader({ './wormholeHostRender.worker.ts?worker': {} }, {
        setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); }
    });
    const { State } = load('state/store.ts');
    const { WormholeHostWorkerSource } = load('visuals/WormholeHostWorkerSource.ts');
    const source = new WormholeHostWorkerSource(() => invalidations++, () => port);
    const target = { width: 1920, height: 1080, rasterPixelRatio: 2, compactMaterialPreview: false, frameCount: 1,
        presentRaster(image) { presented.push(image); }, background() {} };
    const draw = (playing = false) => source.draw(State, target, .6, false, playing);
    const respond = message => port.onmessage({ data: message });
    const ready = () => respond({ type: 'ready', generation: messages.at(-1).generation });
    const image = () => ({ closed: 0, close() { this.closed++; } });
    const frame = (request = messages.at(-1), bitmap = image()) => {
        respond({ type: 'frame', generation: request.generation, serial: request.serial, bitmap, raster: 'webgl', renderMs: 7 }); return bitmap;
    };
    return { source, State, target, port, messages, presented, timers, draw, ready, frame, image, respond,
        get stopped() { return stopped; }, get invalidations() { return invalidations; } };
}

test('host worker copies immutable analysis once, sends resolved controls, bounds in-flight work and presents a bitmap', () => {
    const h = harness(); h.draw(); assert.equal(h.messages.length, 1); assert.equal(h.messages[0].type, 'prepare');
    h.ready(); h.draw(); const sent = h.messages.at(-1);
    assert.equal(sent.type, 'render'); assert.equal(sent.frame.depthCue, .6); assert.equal(sent.frame.width * sent.frame.density, 960);
    assert.equal(sent.frame.visualTuning.wormholeNebulaAmount, h.State.visualTuning.wormholeNebulaAmount);
    assert.equal(sent.frame.currentTime, h.State.currentTime); assert.equal(sent.frame.reset, true);
    assert.equal('analysis' in sent, false); assert.equal('frames' in sent.frame, false);
    for (let i = 0; i < 100; i++) { h.State.currentTime += .01; h.draw(true); }
    assert.equal(h.messages.length, 2, 'no queue behind a slow worker');
    const bitmap = h.frame(sent); h.draw();
    assert.equal(h.presented.at(-1), bitmap); assert.equal(h.source.rasterKind, 'offscreen-webgl');
    assert.equal(h.messages.filter(m => m.type === 'prepare').length, 1);
    assert.equal(h.messages.at(-1).frame.currentTime, h.State.currentTime, 'newest host clock, not old queued requests');
    h.source.dispose(); assert.equal(bitmap.closed, 1); assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0);
});

test('settled pause does not loop on frame-ready; playback requests at most 30 Hz and keeps exact host time', () => {
    const h = harness(); h.draw(); h.ready(); h.draw(); h.frame();
    const count = h.messages.length;
    for (let i = 0; i < 40; i++) { h.target.frameCount++; h.draw(); }
    assert.equal(h.messages.length, count, 'frame counter must not dirty a paused frame');
    h.State.currentTime = .01; h.draw(true); assert.equal(h.messages.length, count);
    h.State.currentTime = .04; h.draw(true); assert.equal(h.messages.at(-1).frame.currentTime, .04);
    h.source.dispose();
});

test('same-position seek, backwards time, resize and analysis replacement reject stale images and release ownership', () => {
    const h = harness(); h.draw(); h.ready(); h.draw(); const oldRequest = h.messages.at(-1);
    h.source.reset(); const stale = h.frame(oldRequest); assert.equal(stale.closed, 1);
    h.ready(); h.draw(); const shown = h.frame(); h.draw();
    h.target.compactMaterialPreview = true; h.draw(); assert.equal(shown.closed, 1); h.ready(); h.draw();
    assert.equal(h.messages.at(-1).frame.width * h.messages.at(-1).frame.density, 640);
    const before = h.messages.at(-1); h.State.currentTime = -1; h.draw();
    assert.equal(h.messages.at(-1).type, 'reset'); assert.equal(h.frame(before).closed, 1);
    h.State.frames = []; h.draw(); assert.equal(h.messages.at(-1).type, 'prepare');
    assert.equal(h.messages.filter(m => m.type === 'prepare').length, 2);
    h.source.dispose();
});

test('worker failure, messageerror, startup failure and bounded deadlines fall back without leaked resources', () => {
    for (const fail of [h => h.port.onerror({}), h => h.port.onmessageerror({}), h => [...h.timers.values()][0]()]) {
        const h = harness(); h.draw(); fail(h);
        assert.equal(h.source.rasterKind, 'fallback'); assert.equal(h.draw(), false);
        assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0); h.source.dispose();
    }
    const h = harness(); h.port.postMessage = () => { throw Error('unavailable'); };
    assert.equal(h.draw(), false); assert.equal(h.stopped, 1); assert.equal(h.timers.size, 0);
    h.source.dispose(); assert.equal(h.draw(), false);
});

test('offscreen renderer preference round-trips independently of quality', () => {
    const { PreviewQualityPreference } = createLoader()('config/previewQuality.ts');
    const p = new PreviewQualityPreference(false, 'auto', 'offscreen');
    assert.equal(p.wormholeRenderer, 'offscreen'); p.setMode('reduced'); assert.equal(p.wormholeRenderer, 'offscreen');
    p.setRendererMode('webgl'); p.setRendererMode('offscreen'); assert.equal(p.wormholeRenderer, 'offscreen');
});

test('worker draws the resolved state once without rerunning host automation; WebGL and Canvas2D obey quality/transparency', () => {
    for (const fallback of [false, true]) {
        const responses = [], draws = [], resizes = [], seeks = [];
        class Gpu {
            constructor() { if (fallback) throw Error('no WebGL'); }
            canvas = { transferToImageBitmap: () => ({ transferred: true }) };
            setSize(...args) { resizes.push(args); } finish() {} dispose() {}
        }
        class Cpu {
            canvas = { transferToImageBitmap: () => ({ transferred: true }) };
            setPreviewSize(...args) { resizes.push(args); }
        }
        class Identity {
            constructor(state) { this.state = state; }
            setDepthCue(v) { this.depth = v; } syncPosition(t) { seeks.push(t); }
            draw(backend) { draws.push({ state: structuredClone(this.state), depth: this.depth, compact: backend.compactMaterialPreview, transparent: backend.transparentBackground }); }
        }
        const scope = { postMessage(message, transfer) { responses.push({ message, transfer }); } };
        createLoader({ './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }, './Canvas2DRendererBackend': { Canvas2DRendererBackend: Cpu },
            './WebGLRendererBackend': { WebGLRendererBackend: Gpu } }, { self: scope, performance: { now: () => 0 } })('visuals/wormholeHostRender.worker.ts');
        const send = data => scope.onmessage({ data });
        const analysis = { frames: [], events: [], sampleRate: 48000, hopSize: 1024, bpm: 120, trackAnalysis: { features: [] } };
        send({ type: 'prepare', generation: 1, analysis });
        const frame = { currentTime: 2.5, visualTuning: { wormholeNebulaAmount: .8 }, currentFrame: { e: .7 }, depthCue: .6,
            width: 1920, height: 1080, density: .5, compact: true, transparent: true, frameCount: 4, reset: true };
        send({ type: 'render', generation: 1, serial: 1, frame });
        assert.equal(draws.length, 1); assert.equal(draws[0].state.visualTuning.wormholeNebulaAmount, .8);
        assert.equal(draws[0].state.currentTime, 2.5); assert.equal(draws[0].depth, .6); assert.deepEqual(seeks, [2.5]);
        assert.equal(responses.at(-1).message.raster, fallback ? 'canvas2d' : 'webgl');
        assert.equal(responses.at(-1).transfer.length, 1);
        assert.deepEqual(resizes[0], fallback ? [1920, 1080, .5, true, true] : [1920, 1080, .5]);
        send({ type: 'reset', generation: 2 }); send({ type: 'render', generation: 1, serial: 2, frame });
        assert.equal(draws.length, 1, 'old generation never rendered');
    }
});


test('MVP menu defaults to Offscreen on a fresh device and saves/copies/reloads an explicit choice', async () => {
    class Element {
        children=[];listeners={};style={};value='';textContent='';append(...nodes){this.children.push(...nodes);}
        setAttribute(){}addEventListener(key,fn){this.listeners[key]=fn;}select(){}remove(){}
    }
    const saved=new Map(),payloads=[];
    const load=createLoader({'./previewQualityControl.css':{}},{document:{createElement:()=>new Element()},
        window:{localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}},
        navigator:{clipboard:{writeText:async text=>payloads.push(JSON.parse(text))}}});
    const {createPreviewQualityControl}=load('ui/PreviewQualityControl.ts');
    const control=createPreviewQualityControl(false,true);
    assert.equal(control.preference.wormholeRenderer,'offscreen');
    const select=control.root.children[2].children[0];select.value='offscreen';select.listeners.change();
    await control.root.children[4].listeners.click();
    assert.equal(payloads[0].wormholeRenderer,'offscreen');assert.equal(saved.get('plexus.wormholeRenderer'),'offscreen');
    assert.equal(createPreviewQualityControl(false,true).preference.wormholeRenderer,'offscreen');
    assert.equal(createPreviewQualityControl(false,false).preference.wormholeRenderer,'compatible','Studio never silently selects unavailable worker');
});
