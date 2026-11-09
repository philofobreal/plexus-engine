import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { QUALITY_POLICY, ENCODED_QUALITY_POLICY, evaluateEncodedStats, compareOwnSource, SOURCE_REGRESSION_POLICY, BASELINE_CASES, compareRgba, compareTemporal, visibleDifferenceRgba } from '../research/export/wormhole-quality.mjs';
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


test('visible difference suppresses hidden RGB and retains opaque channel errors without mutation',()=>{
 const a=image(1,[255,0,0,0]),b=image(1,[0,255,255,0]),before=a.slice();
 assert.deepEqual(Array.from(visibleDifferenceRgba(a,b,1,1)),[0,0,0,255]);assert.deepEqual(a,before);
 assert.deepEqual(Array.from(visibleDifferenceRgba(image(1,[10,20,30,255]),image(1,[11,20,28,255]),1,1)),[8,0,16,255]);
});
test('visible difference respects low-alpha visibility but reveals alpha-only errors on white',()=>{
 assert.deepEqual(Array.from(visibleDifferenceRgba(image(1,[200,100,50,1]),image(1,[0,0,0,1]),1,1)),[6,3,2,255]);
 assert.deepEqual(Array.from(visibleDifferenceRgba(image(1,[0,0,0,0]),image(1,[0,0,0,255]),1,1)),[255,255,255,255]);
});
test('visible difference rejects malformed images and gains and has the same unamplified errors as the gate',()=>{
 const a=image(1,[70,30,5,128]),b=image(1,[75,28,9,128]);
 for(const gain of [0,-1,NaN,Infinity])assert.throws(()=>visibleDifferenceRgba(a,b,1,1,gain));
 assert.throws(()=>visibleDifferenceRgba(a.subarray(1),b,1,1));
 assert.throws(()=>visibleDifferenceRgba(a,b,2,1));
 const shown=visibleDifferenceRgba(a,b,1,1,1),mean=(shown[0]+shown[1]+shown[2])/3;
 assert.ok(Math.abs(mean-compareRgba(a,b,1,1).meanError)<=.5);
});


test('encoded cross-profile gates require every aligned frame and serialize perfect PSNR without a null score',()=>{
 const r=evaluateEncodedStats('n:1 R:1 G:1 B:1 All:1 (inf)\nn:2 All:1','n:1 mse_avg:0 psnr_avg:inf\nn:2 psnr_avg:inf',2);
 assert.equal(r.pass,true);assert.equal(r.minPsnrDb,'inf');assert.equal(JSON.parse(JSON.stringify(r)).minPsnrDb,'inf');assert.equal(r.frames.length,2);
 assert.equal(ENCODED_QUALITY_POLICY.minFrameSsim,.995);assert.equal(ENCODED_QUALITY_POLICY.minFramePsnrDb,40);assert.equal(QUALITY_POLICY.version,'wh-01-rgba-v1');
});

test('encoded cross-profile acceptance cannot hide a bad picture behind a good average',()=>{
 assert.equal(evaluateEncodedStats('n:1 All:0.995','n:1 psnr_avg:40',1).pass,true);
 for(const [ssim,psnr]of [[.994999,50],[1,39.99]]){
  const r=evaluateEncodedStats('n:1 All:1\nn:2 All:'+ssim,'n:1 psnr_avg:inf\nn:2 psnr_avg:'+psnr,2);assert.equal(r.pass,false);assert.equal(r.frames[1].pass,false);
 }
});

test('encoded score parsing rejects partial, duplicated, malformed and out-of-order evidence',()=>{
 for(const n of [0,64,1.5])assert.throws(()=>evaluateEncodedStats('', '',n),/count/);
 assert.throws(()=>evaluateEncodedStats('n:1 All:1','n:1 psnr_avg:40',2),/Incomplete/);
 for(const [ssim,psnr]of [['n:2 All:1','n:1 psnr_avg:40'],['n:1 All:NaN','n:1 psnr_avg:40'],['n:1 All:1.01','n:1 psnr_avg:40'],['n:1 All:1','n:1 psnr_avg:NaN'],['n:1 All:1','n:1 psnr_avg:-1']])assert.throws(()=>evaluateEncodedStats(ssim,psnr,1),/Malformed/);
});


test('own-source decisions compare reconstruction fidelity instead of requiring two lossy encodings to be identical',()=>{
 const before=[{frame:0,ssim:.98,psnrDb:42}],after=[{frame:0,ssim:.99,psnrDb:46}],snapshot=JSON.stringify([before,after]);
 assert.equal(compareOwnSource(before,after).pass,true);assert.equal(JSON.stringify([before,after]),snapshot);assert.equal(SOURCE_REGRESSION_POLICY.maxFrameSsimDrop,.0001);assert.equal(SOURCE_REGRESSION_POLICY.maxFramePsnrDropDb,.1);
 assert.equal(compareOwnSource([{frame:0,ssim:1,psnrDb:'inf'}],[{frame:0,ssim:1,psnrDb:'inf'}]).pass,true);
});

test('own-source regression limits apply to every picture and cannot lose a perfect reference behind an infinite score',()=>{
 const before=[{frame:0,ssim:.99,psnrDb:45}];
 for(const after of [{frame:0,ssim:.9898,psnrDb:46},{frame:0,ssim:1,psnrDb:44.89}])assert.equal(compareOwnSource(before,[after]).pass,false);
 assert.equal(compareOwnSource([{frame:0,ssim:1,psnrDb:'inf'}],[{frame:0,ssim:1,psnrDb:99}]).pass,false);
 assert.equal(compareOwnSource(before,[{frame:0,ssim:1,psnrDb:'inf'}]).pass,true);
});

test('own-source evidence rejects truncated, malformed or misindexed score records',()=>{
 const valid=[{frame:0,ssim:1,psnrDb:40}];
 assert.throws(()=>compareOwnSource([],[]),/Incomplete/);assert.throws(()=>compareOwnSource(valid,[]),/Incomplete/);
 for(const record of [{frame:1,ssim:1,psnrDb:40},{frame:0,ssim:NaN,psnrDb:40},{frame:0,ssim:1,psnrDb:null}])assert.throws(()=>compareOwnSource(valid,[record]),/Malformed/);
});
