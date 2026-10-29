import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function opusMuxer(streaming = false) {
    const load = createLoader({}, { TextEncoder, TextDecoder, Blob, Uint8Array, DataView }), chunks = [];
    const Muxer = load('export/WebMMuxer.ts').WebMMuxer;
    const muxer = new Muxer({ width: 64, height: 36, fps: 60, codecId: 'V_VP9', sampleRate: 48000,
        hasAudio: true, ...(streaming ? { onChunk: c => chunks.push(c) } : {}) });
    const head = new Uint8Array(19); head.set(new TextEncoder().encode('OpusHead')); head[8] = 1; head[9] = 2;
    new DataView(head.buffer).setUint16(10, 312, true); new DataView(head.buffer).setUint32(12, 48000, true);
    const chunk = (timestamp, type = 'key', bytes = 3) => ({ timestamp, duration: 20000, type, byteLength: bytes, copyTo() {} });
    const element = (bytes, a, b) => { const i = bytes.findIndex((v, i) => v === a && bytes[i + 1] === b);
        assert.ok(i >= 0); const size = bytes[i + 2] & 0x7f; return bytes.slice(i + 3, i + 3 + size); };
    return { muxer, chunks, head, chunk, element };
}

test('WebM Opus CodecDelay uses the encoder pre-skip while SeekPreRoll stays independent at 80ms', async () => {
    const h = opusMuxer(); h.muxer.setAudioConfig(h.head);
    h.muxer.addVideoChunk(h.chunk(0)); h.muxer.addAudioChunk(h.chunk(0));
    h.muxer.setAudioEndTime(2_000_000); h.muxer.addAudioChunk(h.chunk(2_000_000));
    const bytes = new Uint8Array(await h.muxer.finalize().arrayBuffer());
    const uint = xs => [...xs].reduce((n, x) => n * 256 + x, 0);
    assert.equal(uint(h.element(bytes, 0x56, 0xaa)), 6_500_000);
    assert.equal(uint(h.element(bytes, 0x56, 0xbb)), 80_000_000);
    const tail = h.element(bytes, 0x75, 0xa2);
    assert.equal(new DataView(tail.buffer, tail.byteOffset).getBigInt64(0, false), 13_500_000n);
});

test('streaming WebM holds early clusters until codec metadata, then writes header first with bounded waiting', () => {
    const h = opusMuxer(true);
    h.muxer.addVideoChunk(h.chunk(0)); h.muxer.addVideoChunk(h.chunk(1_000_000)); assert.equal(h.chunks.length, 0);
    h.muxer.setAudioConfig(h.head);
    assert.deepEqual([...h.chunks[0].slice(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    assert.deepEqual([...h.chunks[1].slice(0, 4)], [0x1f, 0x43, 0xb6, 0x75]);
    h.muxer.addAudioChunk(h.chunk(0)); h.muxer.setAudioEndTime(20_000); h.muxer.finalize();
    const large = opusMuxer(true); large.muxer.addVideoChunk(large.chunk(0, 'key', 16 * 1024 * 1024 + 1));
    assert.throws(() => large.muxer.addVideoChunk(large.chunk(1_000_000)), /header buffer budget/);
});

test('malformed Opus headers and missing audio configuration fail explicitly instead of producing a wrong track', () => {
    for (const change of [head => head[0] = 0, head => head[9] = 1, head => head[18] = 1]) {
        const h = opusMuxer(); change(h.head); assert.throws(() => h.muxer.setAudioConfig(h.head), /Unsupported Opus/);
    }
    const h = opusMuxer(); assert.throws(() => h.muxer.finalize(), /No audio codec/);
});
