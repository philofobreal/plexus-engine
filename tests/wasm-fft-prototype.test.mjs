import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareTree, root, sha } from '../research/analyzer-lab/candidates/wasm-fft/experiment.mjs';
import { makeWasmFFT } from '../research/analyzer-lab/candidates/wasm-fft/adapter.mjs';

const bytes = fs.readFileSync(root + '/research/analyzer-lab/candidates/wasm-fft/fft.scalar.wasm');
const module = new WebAssembly.Module(bytes);
const { FFT } = await import(prepareTree('reference', 'src/analyzer/math/FFT.ts').url);
const raw = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const compare = (a, b) => { assert.deepEqual(raw(a.re), raw(b.re)); assert.deepEqual(raw(a.im), raw(b.im)); };

for (const size of [2, 4, 32, 1024, 4096, 16384, 65536]) {
    test(`T17 scalar FFT exactly matches reference f32 stores at N=${size}`, () => {
        let seed = 1743;
        const samples = Float32Array.from({ length: size + 3 }, (_, i) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return i % 17 === 0 ? 1e-39 : (seed / 2 ** 32 - .5);
        });
        const original = sha(raw(samples));
        const ref = new FFT(size);
        for (const mode of ['resident', 'copy']) {
            const fft = new (makeWasmFFT(FFT, module, mode))(size);
            for (const start of [0, 3, samples.length - 1, samples.length]) {
                assert.equal(fft.setWindowedSamples(samples, start), ref.setWindowedSamples(samples, start));
                fft.transform(); ref.transform(); compare(fft, ref);
                assert.equal(fft.magnitude(1), ref.magnitude(1));
            }
        }
        assert.equal(sha(raw(samples)), original);
    });
}

test('T17 preserves complex input, signed zero, impulse and PCM headroom arithmetic', () => {
    for (const mode of ['resident', 'copy']) {
        const fft = new (makeWasmFFT(FFT, module, mode))(1024), ref = new FFT(1024);
        for (const pattern of ['zero', 'impulse', 'headroom', 'complex']) {
            for (let i = 0; i < 1024; i++) {
                const re = pattern === 'zero' ? -0 : pattern === 'impulse' ? (i === 17 ? 8 : 0) : pattern === 'headroom' ? (i % 2 ? -8 : 8) : Math.sin(i * .12) * 8;
                const im = pattern === 'complex' ? Math.cos(i * .032) * 8 : -0;
                fft.re[i] = ref.re[i] = re; fft.im[i] = ref.im[i] = im;
            }
            fft.transform(); ref.transform(); compare(fft, ref);
        }
    }
});

test('T17 preserves validation, private bounded memory and guard-before-write', () => {
    const WasmFFT = makeWasmFFT(FFT, module);
    for (const size of [0, 1, 3, -4, 65537, NaN, Infinity]) assert.throws(() => new WasmFFT(size), /power of two/);
    assert.throws(() => makeWasmFFT(FFT, module, 'unknown'), /mode/);
    const a = new WasmFFT(1024), b = new WasmFFT(1024);
    assert.notEqual(a.memory, b.memory);
    assert.equal(a.re.buffer, a.memory.buffer);
    assert.throws(() => a.memory.grow(1), RangeError);
    const before = Buffer.from(a.memory.buffer).toString('hex');
    for (const size of [0, 3, 65536, -1]) assert.throws(() => a.instance.exports.transform(size), WebAssembly.RuntimeError);
    assert.equal(Buffer.from(a.memory.buffer).toString('hex'), before);
    a.re[0] = 1; a.transform();
    assert.ok(b.re.every(v => v === 0));
});

test('T17 resident and copy backends preserve complete analyzer publication', async () => {
    const samples = Float32Array.from({ length: 44100 * 7 + 43 }, (_, i) => {
        const t = i / 44100, beat = t % .5;
        return .12 * Math.sin(2 * Math.PI * 330 * t) + .6 * Math.exp(-beat * 60) * Math.sin(2 * Math.PI * 65 * t);
    });
    const original = sha(raw(samples)), outputs = [];
    for (const mode of ['reference', 'resident', 'copy']) {
        const { analyzeAudio } = await import(prepareTree(mode).url);
        for (const rhythmOnsets of [false, true]) {
            const value = analyzeAudio({ samples, sampleRate: 44100, options: { requestId: 7, rhythmOnsets } });
            const hash = sha(JSON.stringify(value));
            const key = Number(rhythmOnsets);
            if (mode === 'reference') outputs[key] = hash;
            else assert.equal(hash, outputs[key]);
        }
    }
    assert.equal(sha(raw(samples)), original);
});
