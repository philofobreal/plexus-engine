import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCheckpoint, decodeCheckpoint, MAX_EXPANDED_CHECKPOINT_CHARS } from '../src/ui/mvp/checkpointEncoding.ts';

const fixture = () => ({ version: 1, token: 'test', history: { version: 1, scope: 'all', past: [], future: [],
    snapshots: [
        { domain: 'journey', data: 'a'.repeat(1000) + 'árvíztűrő 🌌' + 'b'.repeat(1000) },
        { domain: 'tuning', data: 'c'.repeat(1000) + '1' },
        { domain: 'journey', data: 'a'.repeat(1000) + 'árvíztűrő 🌠' + 'b'.repeat(1000) },
        { domain: 'tuning', data: 'c'.repeat(1000) + '2' },
        { domain: 'journey', data: '' },
        { domain: 'journey', data: 'short' }
    ] } });

test('encoding round-trips UTF-16 text, mixed domains, empty strings and literal fallbacks without mutation', () => {
    const input = fixture(), original = structuredClone(input), encoded = encodeCheckpoint(input);
    assert.ok(JSON.stringify(encoded).length < JSON.stringify(input).length);
    assert.deepEqual(decodeCheckpoint(encoded), input);
    assert.deepEqual(input, original);
    assert.equal(decodeCheckpoint(input), input, 'legacy plain checkpoints remain supported');
});

test('invalid, forward, cross-domain and out-of-bounds references are rejected', () => {
    const mutations = [
        value => value.encoding = 'unknown',
        value => value.history.snapshots[2].data.base = 2,
        value => value.history.snapshots[2].data.base = -1,
        value => value.history.snapshots[2].data.base = 1,
        value => value.history.snapshots[2].data.prefix = -1,
        value => value.history.snapshots[2].data.prefix = .5,
        value => value.history.snapshots[2].data.suffix = 100000,
        value => value.history.snapshots[2].data.insert = null,
        value => value.history.snapshots[2].data = null,
        value => value.history.snapshots = Array(601).fill(value.history.snapshots[0])
    ];
    for (const mutate of mutations) {
        const wire = structuredClone(encodeCheckpoint(fixture())); mutate(wire);
        assert.equal(decodeCheckpoint(wire), null, mutate.toString());
    }
});

test('a small delta chain cannot expand past the decoded budget', () => {
    const data = 'x'.repeat(100000), count = Math.floor(MAX_EXPANDED_CHECKPOINT_CHARS / data.length) + 1;
    const snapshots = [{ domain: 'journey', data }];
    for (let i = 1; i < count; i++) snapshots.push({ domain: 'journey', data: { base: i - 1, prefix: data.length, suffix: 0, insert: '' } });
    assert.equal(decodeCheckpoint({ encoding: 'history-delta-v1', history: { snapshots } }), null);
});
