import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const prefix = 'plexus-mvp-meta-tuning:v1:';
const point = { id: 'manual-1', time: 4, sectionId: 'intro', preset: 'wormhole.json', confidence: 1,
    intensity: 1.7, reason: 'manual', morphDurationSec: 2, morphCurve: 'easeInOut', locked: true,
    bendMirror: true, meta: { motif: 'tunnel-drive', sceneId: 'scene-1' } };
const payload = () => ({ version: 1, macros: { intensity: 0.8, motion: 0.4, depth: 0.6, detail: 0.7 },
    advancedBoosts: { wormholeGrainShape: 1, lineWeight: 0.75 },
    journey: { version: 1, plan: { version: 1, source: 'edited', points: [structuredClone(point)] },
        activityLevel: 'active', variantMode: 'expressive', morphScale: 1.5, edited: true } });

function harness() {
    const storage = new Map();
    const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const modules = new Map();
    function load(file) {
        if (modules.has(file)) return modules.get(file);
        const exports = {};
        modules.set(file, exports);
        const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
        } }).outputText;
        vm.runInNewContext(code, { exports, localStorage, TextEncoder, crypto: webcrypto,
            require: request => load(path.resolve(path.dirname(file), request + '.ts')) }, { filename: file });
        return exports;
    }
    return { storage, localStorage, ...load(path.resolve('src/ui/mvp/metaTuningStorage.ts')) };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('one existing per-track key round-trips tuning, edited points, metadata and controls', () => {
    const h = harness(), data = payload();
    assert.equal(h.saveMetaTuning('track-A', data), true);
    assert.equal(h.loadMetaTuning('track-A').journey, undefined, 'effect Save does not implicitly save automation');
    assert.equal(h.saveJourney('track-A', data.journey), true);
    assert.equal(h.storage.size, 1);
    assert.ok(h.storage.has(prefix + 'track-A'));
    const restored = h.loadMetaTuning('track-A', 60);
    assert.deepEqual(plain(restored.journey), data.journey);
    assert.deepEqual(plain(restored.macros), data.macros);
    assert.equal(restored.advancedBoosts.lineWeight, 0.75);
    data.journey.plan.points[0].intensity = 4;
    restored.journey.plan.points[0].intensity = 0.1;
    assert.equal(h.loadMetaTuning('track-A', 60).journey.plan.points[0].intensity, 1.7);
    assert.equal(h.loadMetaTuning('track-B', 60), null);
});

test('wide and single-point journeys retain scales above 400% through storage, bounded on track restore', () => {
    const h = harness(), data = payload();
    data.journey.morphScale = 19.99;
    data.journey.plan.points[0].time = 10;
    assert.equal(h.saveJourney('single', data.journey), true);
    assert.equal(h.loadMetaTuning('single', 50).journey.morphScale, 19.99);
    assert.equal(h.loadMetaTuning('single', 20).journey.morphScale, 4.99,
        'restore uses the actual track end');
    data.journey.plan.points.push({ ...point, id: 'second', time: 50 });
    assert.equal(h.saveJourney('wide', data.journey), true);
    assert.equal(h.loadMetaTuning('wide', 120).journey.morphScale, 19.99);
    assert.equal(h.loadMetaTuning('wide', 55).journey.morphScale, 2.49,
        'the final automation constrains the same multiplier for the whole journey');
});

test('legacy tuning saves and intentionally empty journeys remain valid', () => {
    const h = harness(), legacy = payload();
    delete legacy.journey;
    delete legacy.advancedBoosts.wormholeGrainShape;
    h.saveMetaTuning('old', legacy);
    const restored = h.loadMetaTuning('old');
    assert.equal(restored.journey, undefined);
    assert.equal(restored.advancedBoosts.wormholeGrainShape, 0);
    const empty = payload(); empty.journey.plan.points = [];
    h.saveJourney('empty', empty.journey);
    assert.deepEqual(plain(h.loadMetaTuning('empty').journey.plan.points), []);
});

test('malformed journeys fail atomically while valid effect settings survive', () => {
    const h = harness();
    const mutations = [
        data => data.journey.version = 2,
        data => data.journey.activityLevel = 'unknown',
        data => data.journey.variantMode = 'unknown',
        data => data.journey.edited = 'yes',
        data => data.journey.morphScale = null,
        data => data.journey.plan.points[0].time = 61,
        data => data.journey.plan.points[0].intensity = 100,
        data => data.journey.plan.points[0].morphDurationSec = 0,
        data => data.journey.plan.points[0].preset = '../bad.json',
        data => data.journey.plan.points.push(structuredClone(point)),
    ];
    for (const mutate of mutations) {
        const data = payload(); mutate(data);
        h.storage.set(prefix + 'bad', JSON.stringify(data));
        const restored = h.loadMetaTuning('bad', 60);
        assert.equal(restored.journey, undefined);
        assert.equal(restored.macros.intensity, 0.8);
    }
});

test('untrusted tuning numbers are bounded and unknown fields never become controls', () => {
    const h = harness(), data = payload();
    data.macros = { intensity: 8, motion: -1, depth: 'loud', detail: null, extra: 1 };
    data.advancedBoosts = { lineWeight: -4, wormholeGrainShape: 0.7, unknown: 1 };
    h.saveMetaTuning('bad-numbers', data);
    const restored = h.loadMetaTuning('bad-numbers');
    assert.deepEqual(plain(restored.macros), { intensity: 1, motion: 0, depth: 0.5, detail: 0.5 });
    assert.equal(restored.advancedBoosts.lineWeight, 0);
    assert.equal(restored.advancedBoosts.wormholeGrainShape, 0);
    assert.equal(restored.advancedBoosts.unknown, undefined);
});

test('corrupt entries, unknown versions and disabled storage fail safely', () => {
    const h = harness();
    for (const raw of ['{broken', 'null', '{"version":2}', '{"version":1,"macros":null,"advancedBoosts":{}}']) {
        h.storage.set(prefix + 'bad', raw);
        assert.equal(h.loadMetaTuning('bad'), null);
    }
    h.localStorage.getItem = () => { throw new Error('storage blocked'); };
    h.localStorage.setItem = () => { throw new Error('quota'); };
    assert.equal(h.loadMetaTuning('any'), null);
    assert.equal(h.saveMetaTuning('any', payload()), false);
    assert.equal(h.saveJourney('any', payload().journey), false);
});

test('the two explicit saves preserve the other persisted slice and never save live edits implicitly', () => {
    const h = harness(), data = payload();
    h.storage.set(prefix + 'A', JSON.stringify(data)); // Also exercises earlier combined-save compatibility.
    const live = payload();
    live.macros.intensity = 1;
    live.journey.plan.points[0].intensity = 3;
    h.saveMetaTuning('A', live);
    assert.equal(h.loadMetaTuning('A').journey.plan.points[0].intensity, 1.7);
    assert.equal(h.loadMetaTuning('A').macros.intensity, 1);
    h.saveJourney('A', live.journey);
    live.macros.intensity = 0;
    assert.equal(h.loadMetaTuning('A').macros.intensity, 1);
    assert.equal(h.loadMetaTuning('A').journey.plan.points[0].intensity, 3);
    h.saveJourney('new', live.journey);
    assert.equal(h.loadMetaTuning('new').macros.intensity, 0.5, 'fresh automation save uses default effects');
});

test('a failed read or quota write cannot discard the other saved slice', () => {
    const h = harness(), data = payload();
    const previous = JSON.stringify(data);
    h.storage.set(prefix + 'A', previous);
    h.localStorage.getItem = () => { throw new Error('blocked read'); };
    assert.equal(h.saveMetaTuning('A', payload()), false);
    assert.equal(h.saveJourney('A', payload().journey), false);
    assert.equal(h.storage.get(prefix + 'A'), previous);
    h.localStorage.getItem = key => h.storage.get(key);
    h.localStorage.setItem = () => { throw new Error('quota'); };
    assert.equal(h.saveJourney('A', payload().journey), false);
    assert.equal(h.storage.get(prefix + 'A'), previous);
});

test('fingerprint retains the existing filename-independent descriptor contract', async () => {
    const h = harness();
    const analysis = { bpm: 128, duration: 60, sections: [{ start: 0 }, { start: 30 }], bars: [{}, {}] };
    const first = await h.computeTrackFingerprint({ ...analysis, name: 'old.wav' });
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(first, await h.computeTrackFingerprint({ ...analysis, name: 'renamed.wav' }));
    assert.notEqual(first, await h.computeTrackFingerprint({ ...analysis, duration: 80 }));
});

test('Save all atomically updates both slices with one write; failed writes preserve the saved entry', () => {
    const h = harness(), data = payload();
    h.storage.set(prefix + 'A', JSON.stringify(data));
    const previous = h.storage.get(prefix + 'A');
    data.macros.motion = 1; data.journey.morphScale = 2;
    const changes = { tuning: data, journey: data.journey };
    h.localStorage.setItem = () => { throw new Error('quota'); };
    assert.equal(h.saveTrackChanges('A', changes), false);
    assert.equal(h.storage.get(prefix + 'A'), previous);
    let writes = 0;
    h.localStorage.setItem = (key, value) => { writes++; h.storage.set(key, value); };
    assert.equal(h.saveTrackChanges('A', changes), true);
    assert.equal(writes, 1);
    assert.equal(h.loadMetaTuning('A').macros.motion, 1);
    assert.equal(h.loadMetaTuning('A').journey.morphScale, 2);
});
