import { WormholeFrameContext } from '../../src/visuals/WormholeFrameContext';
import { Canvas2DRendererBackend } from '../../src/visuals/Canvas2DRendererBackend';
import { GrainCarrierCollector } from '../../src/visuals/GrainCarrierCollector';
import { GrainLineCollector } from '../../src/visuals/GrainLineCollector';
import { cloneDefaultVisualTuning } from '../../src/config/visualTuning';
import { defaultAdvancedBoosts } from '../../src/config/metaTuningBoost';
import { accumulateWormholeGrainCarrier, resolveWormholeGrainMaterial } from '../../src/visuals/wormholeGrainMaterialRaster';
import { assertWormholeRenderFrameStamp } from '../../src/types/WormholeRenderFrame';
import { QUALITY_POLICY, BASELINE_CASES, compareRgba, compareTemporal } from './wormhole-quality.mjs';
import { CARRIER_FIELDS } from './parallel-material-data.mjs';

// Kernel fixtures, not recordings of a dashboard/MVP session or musical ground truth.
const check = (value, message) => { if (!value) throw Error(message); };
export const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
function base64(bytes) {
    let value = '';
    for (let i = 0; i < bytes.length; i += 16384) value += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(value);
}
function floats(data, size) {
    const bytes = new Uint8Array(data.length * size), view = new DataView(bytes.buffer);
    for (let i = 0; i < data.length; i++) {
        if (size === 4) view.setFloat32(i * size, data[i], true); else view.setFloat64(i * size, data[i], true);
    }
    return bytes;
}
const bytes = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

export async function captureCase(spec, index) {
    const width = spec.width ?? 640, height = spec.height ?? 360;
    const rawTuning = { ...cloneDefaultVisualTuning(), wormholeNebulaAmount: .32, wormholeNebulaDetail: .6,
        wormholeNebulaBloom: .5, wormholeNebulaWeave: .6, wormholeGrainDensity: .25,
        wormholeSpiral: .4, wormholeWallMode: 0, wormholeWall: 0, performanceMode: 0, ...spec.tuning };
    const seed = { version: 1, rawTuning, macros: { intensity: .5, motion: .5, depth: .5, detail: .5 },
        boosts: defaultAdvancedBoosts(), policy: { gains: 'raw', semanticResolver: false, semanticChoreography: false } };
    const stamp = { protocol: 1, contextId: 'wh01-' + spec.id, generation: 1, requestSerial: index + 1,
        presentationRevision: 0, songTime: spec.time, mode: spec.mode,
        ...(spec.mode === 'exact' ? { jobId: 'wh01-kernel-capture', frameIndex: Math.round(spec.time * 60),
            fps: 60, timestampUs: Math.round(Math.round(spec.time * 60) * 1_000_000 / 60) } : {}) };
    assertWormholeRenderFrameStamp(stamp);
    const contexts = [], backends = [];
    function create() {
        const context = new WormholeFrameContext(seed); contexts.push(context);
        const backend = new Canvas2DRendererBackend(width, height); backends.push(backend);
        backend.setPreviewSize(width, height, 1, false, spec.transparent === true); backend.frameCount = 1;
        Object.assign(context.state, { currentTime: spec.time, exportTime: spec.time,
            isExporting: spec.mode === 'exact', playbackFade: 1 });
        // Authored signal, not detected music. It exercises bright carriers as well as dark skirts.
        const signal = { ...context.state.currentFrame, e: .7, eRatio: .8, densityProj: .65,
            subEnergy: .6, bassEnergy: .55, subFlux: .3, bassFlux: .2, state: 'HIGH',
            perceptualSpectrum: Object.freeze(Array.from({ length: 24 }, (_, band) => .5 + .25 * Math.sin(band * .71))) };
        const published = Object.freeze(signal);
        context.state.frames = Array.from({ length: 400 }, () => published);
        context.state.sampleRate = 48000; context.state.hopSize = 1024; context.state.bpm = 128;
        Object.assign(context.state.currentFrame, signal);
        Object.assign(context.state.currentFeatures, { density: .65, brightness: .5, tension: .5 });
        Object.assign(context.state.modulation, { subEnergy: .6, bassEnergy: .55, subFlux: .3, bassFlux: .2, rhythmicImpulse: .4 });
        context.state.beatDecay = .6; context.state.denseImpactFlash = .3;
        context.identity.setDepthCue(spec.depthCue); context.identity.syncPosition(spec.time);
        return { context, backend };
    }
    try {
        const reference = create(), rasters = new Map();
        const begin = reference.backend.beginFieldRaster.bind(reference.backend);
        reference.backend.beginFieldRaster = (layer, cols, rows) => {
            const data = begin(layer, cols, rows); rasters.set(layer, { data, cols, rows }); return data;
        };
        // The reference uses the ordinary scalar deposit, resolve and Canvas compositor unchanged.
        reference.context.identity.draw(reference.backend, [], []);
        const pixels = reference.backend.canvas.getContext('2d').getImageData(0, 0, width, height).data;
        const observed = create(), collector = new GrainCarrierCollector(), lines = new GrainLineCollector();
        const raw = [];
        lines.reset(width, height);
        observed.context.identity.setMaterialSink({
            begin: (...args) => collector.begin(...args),
            carrier: carrier => { raw.push(...CARRIER_FIELDS.map(key => carrier[key] ?? 0)); collector.carrier(carrier); },
        });
        observed.context.identity.setLineSink(lines);
        observed.context.identity.draw(observed.backend, [], []);
        const base = observed.backend.canvas.getContext('2d').getImageData(0, 0, width, height).data;
        const material = collector.frame;
        if (material) {
            const l0 = new Float32Array(material.cols * material.rows * 4);
            const carrier = {};
            for (let i = 0; i < raw.length; i += CARRIER_FIELDS.length) {
                CARRIER_FIELDS.forEach((key, k) => { carrier[key] = raw[i + k]; });
                accumulateWormholeGrainCarrier(l0, material.cols, material.rows, width, height, carrier, material.detail);
            }
            const r1 = rasters.get(1), r2 = rasters.get(2);
            const l1 = new Float32Array(r1.data.length), l2 = new Float32Array(r2.data.length);
            resolveWormholeGrainMaterial(l0, material.cols, material.rows, l1, r1.cols, r1.rows,
                l2, r2.cols, r2.rows, material.amount, material.bloom);
            for (const [layer, data] of [[0, l0], [1, l1], [2, l2]])
                check(equal(bytes(data), bytes(rasters.get(layer).data)), spec.id + ': observer changed scalar material');
        } else check(raw.length === 0 && !rasters.get(0), 'Material off produced carriers');
        const prepared = material ? floats(material.data.subarray(0, material.count * 24), 4) : new Uint8Array();
        const rawBytes = floats(raw, 8), line = lines.frame, lineBytes = floats(line.data.subarray(0, line.count * 9), 4);
        check([...raw, ...(material?.data.subarray(0, material.count * 24) ?? []), ...line.data.subarray(0, line.count * 9)]
            .every(Number.isFinite), 'Nonfinite fixture data');
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        canvas.getContext('2d').putImageData(new ImageData(pixels.slice(), width, height), 0, 0);
        return { canvas, pixels: pixels.slice(), record: { id: spec.id, stamp, width, height,
            depthCue: spec.depthCue, transparent: spec.transparent === true, seed,
            signal: { kind: 'authored-static-spectrum-v1', frame: reference.context.state.currentFrame,
                features: reference.context.state.currentFeatures, modulation: reference.context.state.modulation,
                bpm: 128, sampleRate: 48000, hopSize: 1024, frameCount: 400, beatDecay: .6, denseImpactFlash: .3 },
            scope: 'synthetic-private-identity-kernel; not a whole-host playback/export baseline',
            reference: { format: 'rgba8-straight-srgb', bytes: base64(pixels), sha256: await sha256(pixels) },
            base: { format: 'rgba8-straight-srgb', bytes: base64(base), sha256: await sha256(base) },
            raw: { format: 'float64-le', stride: CARRIER_FIELDS.length, fields: CARRIER_FIELDS,
                count: raw.length / CARRIER_FIELDS.length, bytes: base64(rawBytes), sha256: await sha256(rawBytes) },
            material: { format: 'float32-le', stride: 24, count: material?.count ?? 0, cols: material?.cols ?? 0,
                rows: material?.rows ?? 0, amount: material?.amount ?? 0, bloom: material?.bloom ?? 0,
                detail: material?.detail ?? 0, bytes: base64(prepared), sha256: await sha256(prepared) },
            lines: { format: 'float32-le', stride: 9, count: line.count, square: line.square,
                bytes: base64(lineBytes), sha256: await sha256(lineBytes) }, scalarReplayExact: true } };
    } finally {
        for (const context of contexts) context.dispose();
        for (const backend of backends) backend.canvas.width = backend.canvas.height = 1;
    }
}

export async function captureBaseline(onCase) {
    const cases = [], pixels = [];
    for (const [index, spec] of BASELINE_CASES.entries()) {
        const first = await captureCase(spec, index), repeat = await captureCase(spec, index);
        for (const key of ['reference', 'base', 'raw', 'material', 'lines'])
            check(first.record[key].sha256 === repeat.record[key].sha256, spec.id + ': nondeterministic ' + key);
        const control = compareRgba(first.pixels, repeat.pixels, first.record.width, first.record.height);
        check(control.pass && control.meanError === 0, 'Repeated source image differs');
        cases.push({ ...first.record, repeatExact: true, repeatHashes: Object.fromEntries(
            ['reference', 'base', 'raw', 'material', 'lines'].map(key => [key, repeat.record[key].sha256])), control }); pixels.push(first.pixels);
        onCase?.(first.canvas, first.record);
    }
    const temporalControls = [0, 2].map(i => ({ before: cases[i].id, after: cases[i + 1].id,
        ...compareTemporal(pixels[i], pixels[i + 1], pixels[i], pixels[i + 1], cases[i].width, cases[i].height) }));
    return { version: 1, policy: QUALITY_POLICY, userAgent: navigator.userAgent, cases, temporalControls,
        scope: 'kernel input/image baseline only; no whole-job speed or complete host-parity claim', pass: true };
}
