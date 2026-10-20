import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLoader } from './helpers/xr-loader.mjs';

test('legacy, v1, historical v2 and corrected v2 keep independent journeys and checkpoint tokens across reloads', async () => {
    const values = new Map(), localStorage = {
        getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)
    };
    const module = () => createLoader({}, { TextEncoder, crypto: webcrypto, localStorage })('ui/mvp/metaTuningStorage.ts');
    const store = module(), base = { bpm: 120, duration: 32, sections: [{ start: 0 }], bars: Array(16) };
    const algorithms = [null, 'accepted-frame-band-timing-v1', 'accepted-frame-band-timing-v2', 'accepted-frame-band-timing-v2-dc1'];
    const keys = [];
    for (const [i, algorithm] of algorithms.entries()) {
        const key = await store.computeTrackFingerprint({ ...base, ...(algorithm ? { eventTiming: { algorithm } } : {}) });
        keys.push(key);
        const journey = { version: 1, activityLevel: 'balanced', variantMode: 'paired', morphScale: 1, edited: true,
            plan: { version: 1, source: 'edited', points: [{ id: 'user-point', time: 2 + i, sectionId: 'intro', preset: 'A.json',
                confidence: 1, intensity: 1, reason: 'manual', morphDurationSec: 1, morphCurve: 'easeInOut', locked: true }] } };
        assert.equal(store.saveTrackChanges(key, { journey, checkpoint: { token: `mode-${i}` } }), true);
    }
    assert.equal(new Set(keys).size, 4);
    const reloaded = module();
    for (const [i, key] of keys.entries()) {
        assert.equal(reloaded.loadMetaTuning(key, 32).journey.plan.points[0].time, 2 + i);
        assert.equal(reloaded.loadMetaTuning(key, 32).journey.plan.points[0].locked, true);
        assert.equal(reloaded.readTrackCheckpoint(key).token, `mode-${i}`);
    }
    reloaded.removeTrackCheckpoint(keys[3], 'mode-2');
    assert.equal(reloaded.readTrackCheckpoint(keys[3]).token, 'mode-3', 'another mode cannot consume the corrected checkpoint');
    reloaded.removeTrackCheckpoint(keys[3], 'mode-3');
    assert.equal(reloaded.readTrackCheckpoint(keys[3]), null);
    assert.equal(reloaded.readTrackCheckpoint(keys[2]).token, 'mode-2');
    assert.equal((await reloaded.computeTrackFingerprint(base)), keys[0], 'returning to legacy restores its original key');
});
