import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { QUALITY_POLICY, BASELINE_CASES, compareRgba, compareTemporal } from '../research/export/wormhole-quality.mjs';
import { CARRIER_FIELDS } from '../research/export/parallel-material-data.mjs';
import { verifyPack } from '../research/export/wormhole-baseline.mjs';
import { createHash } from 'node:crypto';
const { assertWormholeRenderFrameStamp: validate, sameWormholeRenderFrame: same } = createLoader()('types/WormholeRenderFrame.ts');
const preview = { protocol: 1, mode: 'preview', contextId: 'dashboard', generation: 2,
    requestSerial: 3, presentationRevision: 4, songTime: 1.25 };
const exact = { ...preview, mode: 'exact', jobId: 'job-1', frameIndex: 75, fps: 60, timestampUs: 1250000 };

test('render stamps keep preview clocks separate from exact 30/60 fps clocks and round-trip as data', () => {
    for (const value of [preview, exact, { ...exact, frameIndex: 1, fps: 30, songTime: 1 / 30, timestampUs: 33333 }]) {
        validate(value); validate(JSON.parse(JSON.stringify(value))); assert.equal(same(value, structuredClone(value)), true);
    }
    assert.equal(same(preview, exact), false);
    for (const [key, value] of Object.entries({ contextId: 'mvp', generation: 3, requestSerial: 4, presentationRevision: 5, songTime: 2 }))
        assert.equal(same(preview, { ...preview, [key]: value }), false, key);
    assert.equal(same(exact, { ...exact, jobId: 'other' }), false);
});

test('frame boundary rejects stale schemas, malformed identities and approximate or unsafe clocks', () => {
    for (const bad of [null, [], {}, Object.create(preview), { ...preview, protocol: 2 }, { ...preview, contextId: ' ' },
        { ...preview, generation: -1 }, { ...preview, requestSerial: 0 }, { ...preview, presentationRevision: 1.5 },
        { ...preview, songTime: NaN }, { ...preview, lead: .03 }, { ...preview, frameIndex: 1 },
        { ...exact, songTime: 1.25000000001 }, { ...exact, timestampUs: 1250001 }, { ...exact, fps: 24 },
        { ...exact, jobId: '' }, { ...exact, frameIndex: Number.MAX_SAFE_INTEGER, songTime: Number.MAX_SAFE_INTEGER / 60, timestampUs: 1e20 }])
        assert.throws(() => validate(bad));
});
const image = (n, rgba) => Uint8Array.from({ length: n * 4 }, (_, i) => rgba[i % 4]);
test('quality gates accept identical input, include partial edge tiles and do not mutate input', () => {
    const a = image(9 * 7, [12, 13, 14, 255]), before = a.slice();
    const result = compareRgba(a, a, 9, 7);
    assert.equal(result.pass, true); assert.equal(result.darkTiles, 2); assert.equal(result.meanError, 0);
    assert.deepEqual(a, before); assert.equal(compareTemporal(a, a, a, a, 9, 7).pass, true);
    assert.equal(QUALITY_POLICY.version, 'wh-01-rgba-v1');
});
test('localized dark banding fails even when whole-image mean error is small', () => {
    const a = image(64 * 64, [5, 5, 5, 255]), b = a.slice();
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) b.set([8, 8, 8, 255], (y * 64 + x) * 4);
    const result = compareRgba(a, b, 64, 64);
    assert.ok(result.meanError < .1); assert.ok(result.maxDarkTileMeanError > 2.9); assert.equal(result.pass, false);
});
test('alpha changes are visible on white, while RGB under fully transparent pixels is ignored', () => {
    const a = image(64, [0, 0, 0, 0]), hidden = image(64, [255, 0, 200, 0]), opaque = image(64, [0, 0, 0, 255]);
    assert.equal(compareRgba(a, hidden, 8, 8).pass, true);
    assert.equal(compareRgba(a, opaque, 8, 8).pass, false);
    const field = image(64 * 64, [0, 0, 0, 0]), oneOpaquePixel = field.slice();
    oneOpaquePixel[3] = 255;
    const tiny = compareRgba(field, oneOpaquePixel, 64, 64);
    assert.ok(tiny.meanError < .1); assert.ok(tiny.maxDarkTileMeanError > 3); assert.equal(tiny.pass, false);
});
test('one-code checkerboard error fails the spatial gate despite cancelling inside every tile', () => {
    const a = image(64 * 64, [10, 10, 10, 255]), b = a.slice();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const value = 10 + ((x + y) % 2 ? 1 : -1); b.set([value, value, value, 255], (y * 64 + x) * 4);
    }
    const result = compareRgba(a, b, 64, 64);
    assert.ok(result.maxDarkTileMeanError < 1e-8); assert.ok(result.spatialError > 1.99); assert.equal(result.pass, false);
});
test('temporal gate rejects a reversed change and malformed pixel buffers', () => {
    const a = image(64, [10, 10, 10, 255]), b = image(64, [20, 20, 20, 255]);
    assert.equal(compareTemporal(a, b, b, a, 8, 8).pass, false);
    assert.throws(() => compareRgba(a.subarray(4), b, 8, 8));
    assert.throws(() => compareRgba(a, b, NaN, 8));
});

test('saved fixture validation rejects changed bytes, format, clocks, missing cases and nonfinite carrier input', () => {
    const block = (data, format, extra = {}) => ({ format, bytes: data.toString('base64'),
        sha256: createHash('sha256').update(data).digest('hex'), ...extra });
    const reference = block(Buffer.alloc(640 * 360 * 4, 255), 'rgba8-straight-srgb');
    const pack = { version: 1, pass: true, policy: QUALITY_POLICY, cases: BASELINE_CASES.map((spec, i) => {
        const count = spec.id === 'material-off' ? 0 : 1;
        const raw = block(Buffer.alloc(count * 15 * 8), 'float64-le', { count, stride: 15, fields: CARRIER_FIELDS });
        const material = block(Buffer.alloc(count * 24 * 4), 'float32-le', { count, stride: 24, cols: 1, rows: 1, amount: .3, bloom: .5, detail: .5 });
        const lines = block(Buffer.alloc(0), 'float32-le', { count: 0, stride: 9 });
        return { id: spec.id, stamp: { ...preview, contextId: spec.id, requestSerial: i + 1, mode: spec.mode, songTime: spec.time,
            ...(spec.mode === 'exact' ? { jobId: 'fixture', fps: 60, frameIndex: 180, timestampUs: 3000000 } : {}) },
            width: spec.width ?? 640, height: spec.height ?? 360, scalarReplayExact: true, repeatExact: true,
            reference, base: reference, raw, material, lines, repeatHashes: Object.fromEntries(
                Object.entries({ reference, base: reference, raw, material, lines }).map(([key, value]) => [key, value.sha256])) };
    }), temporalControls: [{ pass: true, meanError: 0 }, { pass: true, meanError: 0 }] };
    assert.equal(verifyPack(pack).cases, 8);
    const change = mutate => {
        const altered = structuredClone(pack); mutate(altered); assert.throws(() => verifyPack(altered));
    };
    change(p => { p.cases.pop(); });
    change(p => { p.cases[0].reference.bytes = 'AA=='; });
    change(p => { p.cases[0].raw.format = 'float64-be'; });
    change(p => { p.cases[0].stamp.songTime += .1; });
    change(p => { p.policy.maxMeanError = 9; });
    change(p => {
        const data = Buffer.alloc(120); data.writeDoubleLE(NaN);
        p.cases[0].raw = block(data, 'float64-le', { count: 1, stride: 15, fields: CARRIER_FIELDS });
        p.cases[0].repeatHashes.raw = p.cases[0].raw.sha256;
    });
});
