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

test('seekable OPFS WebM rewrites only its fixed-size header with duration and native VP9 color', async () => {
    const chunks = [];
    let finalizedHeader;
    const muxer = new WebMMuxer({ width: 1280, height: 720, fps: 30, codecId: 'V_VP9',
        sampleRate: 48000, hasAudio: true, vp9HighPrecision: true,
        onChunk: bytes => chunks.push(bytes), rewriteHeader: bytes => { finalizedHeader = bytes; } });
    const packet = timestamp => ({ timestamp, duration: 33333, type:'key',
        byteLength:1, copyTo(bytes) { bytes[0] = 0x12; } });
    muxer.setAudioConfig();
    assert.equal(chunks.length, 0, 'Opus setup must not emit a header with missing 10-bit video metadata');
    muxer.addVideoChunk(packet(0), {codec:'vp09.02.31.10',
        colorSpace:{primaries:'bt709',transfer:'iec61966-2-1',matrix:'bt709',fullRange:true}});
    muxer.addVideoChunk(packet(1_000_000), {codec:'vp09.02.31.10',colorSpace:{transfer:'bt709'}});
    muxer.finalize();
    assert.equal(chunks.length, 3);
    assert.equal(finalizedHeader.length, chunks[0].length);
    const bytes = Buffer.from(finalizedHeader);
    const color = bytes.indexOf(Buffer.from([0x55, 0xb0, 0x90]));
    assert.ok(color >= 0);
    assert.deepEqual([...bytes.subarray(color + 3, color + 19)], [
        0x55, 0xb1, 0x81, 1, 0x55, 0xb9, 0x81, 2, 0x55, 0xbb, 0x81, 1, 0x55, 0xba, 0x81, 13,
    ]);
    const duration = bytes.indexOf(Buffer.from([0x44, 0x89, 0x88]));
    assert.ok(duration >= 0);
    assert.equal(Buffer.from(chunks[0]).readDoubleBE(duration + 3), 0);
    assert.equal(bytes.readDoubleBE(duration + 3), 1033);
    assert.deepEqual(bytes.subarray(duration + 11), Buffer.from(chunks[0]).subarray(duration + 11));
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
