import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareTimingReview } from '../research/analyzer-lab/diagnostics/prepare-event-timing-review.mjs';
import { evaluateTimingInput } from '../research/analyzer-lab/diagnostics/evaluate-event-timing.mjs';

test('real-PCM review preparation binds exact bytes and cannot masquerade as reviewed truth', () => {
    const bytes = Buffer.alloc(8000 * 4), before = Buffer.from(bytes);
    const result = prepareTimingReview(bytes, 8000, { originalFile: 'locally-owned-recording' });
    assert.deepEqual(bytes, before); assert.equal(result.identity.pcmSha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.identity.sampleCount, 8000); assert.equal(result.identity.channel, 0);
    assert.deepEqual(result.baseline, []); assert.deepEqual(result.candidate, []);
    assert.equal(result.annotation.status, 'awaiting-human-review'); assert.throws(() => evaluateTimingInput(result), /human-reviewed/);
    assert.deepEqual(result.parameters, prepareTimingReview(bytes, 8000).parameters);
});

test('review preparation rejects invalid raw PCM and unsupported clocks', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(3)]) assert.throws(() => prepareTimingReview(bytes, 8000));
    const bad = Buffer.alloc(4); bad.writeFloatLE(NaN); assert.throws(() => prepareTimingReview(bad, 8000));
    assert.throws(() => prepareTimingReview(Buffer.alloc(32), NaN));
});
