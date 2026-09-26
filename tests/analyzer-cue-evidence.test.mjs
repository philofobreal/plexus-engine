import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader();
const { DramaturgyBuilder } = load('analyzer/DramaturgyBuilder.ts');

test('a dense sustained plateau cannot manufacture periodic impact cues from cooldown expiration', () => {
    const count = 1000;
    const features = Array.from({ length: count }, () => ({ density: 0.9, melody: 0.1, vocal: 0.1, fx: 0.1, brightness: 0.5, tension: 0.5 }));
    const frames = Array.from({ length: count }, () => ({ state: 'HIGH', eRatio: 0.9 }));
    const builder = new DramaturgyBuilder({ totalFrames: count }, { secondsPerBar: 2 }, {}, 100, 10);
    builder.buildCues(features, frames);
    assert.equal(builder.cues.filter(c => c.kind === 'impact').length, 0);
    const onsets = Array.from({ length: 40 }, (_, i) => ({ time: 2 + i * 2.2, type: 2, intensity: 0.9 }));
    builder.events = onsets;
    builder.buildCues(features, frames);
    const impacts = builder.cues.filter(c => c.kind === 'impact');
    assert.equal(impacts.length, 40);
    assert.ok(impacts.at(-1).time > 80, 'late-track impact evidence is retained');
    for (const cue of impacts) assert.ok(onsets.some(e => Math.abs(e.time - cue.time) < 1e-8));
});
