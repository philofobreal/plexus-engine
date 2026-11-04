import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoader } from './helpers/xr-loader.mjs';

const { WebMMuxer } = createLoader({}, { Blob, DataView, TextDecoder, TextEncoder, Uint8Array })('export/WebMMuxer.ts');

function readDefaultDuration(header) {
    const tag = header.findIndex((byte, i) => byte === 0x23 && header[i + 1] === 0xe3 && header[i + 2] === 0x83);
    assert.ok(tag >= 0, 'Missing WebM DefaultDuration');
    const size = header[tag + 3];
    assert.ok(size > 0x80 && size <= 0x88, 'Invalid unsigned integer size');
    return header.subarray(tag + 4, tag + 4 + (size & 0x7f))
        .reduce((value, byte) => (value << 8n) + BigInt(byte), 0n);
}

test('WebM video DefaultDuration decodes as integer nanoseconds in streamed and buffered headers', async () => {
    for (const [fps, ns] of [[24, 41_666_667n], [60_000 / 1001, 16_683_333n], [60, 16_666_667n]]) {
        const config = { width: 3840, height: 2160, fps, codecId: 'V_VP9', sampleRate: 48000, hasAudio: false };
        const chunks = [];
        const streamed = new WebMMuxer({ ...config, onChunk: chunk => chunks.push(chunk) });
        const buffered = new WebMMuxer(config);
        for (const muxer of [streamed, buffered]) {
            muxer.addVideoChunk({ timestamp: 0, type: 'key', byteLength: 1, copyTo() {} });
        }
        streamed.finalize();
        const local = new Uint8Array(await buffered.finalize().arrayBuffer());
        assert.equal(readDefaultDuration(chunks[0]), ns);
        assert.equal(readDefaultDuration(local), ns);
    }
});

test('Opus SimpleBlock is seekable while the trimmed tail keeps BlockGroup flags reserved', async () => {
    const chunks = [];
    const muxer = new WebMMuxer({ width: 3840, height: 2160, fps: 60, codecId: 'V_VP9',
        sampleRate: 48000, hasAudio: true, onChunk: chunk => chunks.push(chunk) });
    const head = new Uint8Array(19);
    head.set(new TextEncoder().encode('OpusHead'));
    head[8] = 1;
    head[9] = 2;
    const metadata = new DataView(head.buffer);
    metadata.setUint16(10, 312, true);
    metadata.setUint32(12, 48000, true);
    const chunk = timestamp => ({ timestamp, duration: 20_000, type: 'key', byteLength: 1, copyTo() {} });
    muxer.setAudioConfig(head);
    muxer.addVideoChunk(chunk(0));
    muxer.addAudioChunk(chunk(0));
    muxer.addAudioChunk(chunk(20_000));
    muxer.setAudioEndTime(30_000);
    muxer.finalize();
    const cluster = chunks[1];
    const audioBlock = tag => {
        const at = cluster.findIndex((byte, i) => byte === tag && cluster[i + 1] === 0x85 && cluster[i + 2] === 0x82);
        assert.ok(at >= 0, 'Missing Opus block');
        return cluster[at + 5];
    };
    assert.equal(audioBlock(0xa3), 0x80, 'Opus SimpleBlock must be a keyframe');
    assert.equal(audioBlock(0xa1), 0, 'BlockGroup Block reserves the keyframe bit');
});
