import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectExportWebM } from './helpers/inspect-export-webm.mjs';
// Independently hand-assembled EBML; never call the production muxer to define expectations.
const join = (...xs) => Uint8Array.from(xs.flatMap(x => [...x]));
const el = (id, data) => { assert.ok(data.length < 127); return join(id, [128 | data.length], data); };
function fixture({ videoTime = 20, audioTime = 20, tailTime = 0, laced = false } = {}) {
    const block = (track, ms, payload) => el([0xa3], [128 | track, (ms >> 8) & 255, ms & 255, laced ? 2 : 0, ...payload]);
    const head = new Uint8Array(19); head.set(new TextEncoder().encode('OpusHead')); head[8] = 1; head[9] = 2;
    const track = el([0xae], el([0x63, 0xa2], head));
    const cluster = el([0x1f, 0x43, 0xb6, 0x75], join(el([0xe7], [tailTime]), block(1, 0, [1]), block(2, 0, [0xf8]), block(1, videoTime, [2]), block(2, audioTime, [0xf8])));
    return join([0x18, 0x53, 0x80, 0x67, 1, 255, 255, 255, 255, 255, 255, 255], el([0x16, 0x54, 0xae, 0x6b], track), cluster);
}
test('independent output reader pins all packet clocks, Opus durations and A/V endpoints', () => {
    const r = inspectExportWebM(fixture(), { frames: 2, fps: 50 });
    assert.equal(r.videoPackets, 2); assert.equal(r.audioPackets, 2); assert.equal(r.audioEndMs, 40); assert.equal(r.lastVideoMs, 20); assert.equal(r.contiguous, true);
});
test('reader rejects missing/duplicated/shifted video and broken audio continuity', () => {
    for (const options of [{ videoTime: 40 }, { videoTime: 0 }, { audioTime: 40 }, { tailTime: 10 }])
        assert.throws(() => inspectExportWebM(fixture(options), { frames: 2, fps: 50 }), /discontinuity|origin/);
    assert.throws(() => inspectExportWebM(fixture(), { frames: 3, fps: 50 }), /track count/);
});
test('reader rejects a wrong output endpoint and unsupported lacing rather than guessing timestamps', () => {
    assert.throws(() => inspectExportWebM(fixture(), { frames: 2, fps: 48 }), /A\/V endpoint/);
    assert.throws(() => inspectExportWebM(fixture({ laced: true }), { frames: 2, fps: 50 }), /unsupported block/);
});
test('reader rejects truncated elements and invalid variable integers', () => {
    assert.throws(() => inspectExportWebM(fixture().slice(0, -1), { frames: 2, fps: 50 }), /truncated/);
    assert.throws(() => inspectExportWebM(Uint8Array.of(0), { frames: 2, fps: 50 }), /invalid integer/);
});
