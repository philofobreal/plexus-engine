import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const plain = value => JSON.parse(JSON.stringify(value));
const pointerKey = 'plexus-mvp-session:v1';
const trackKey = 'plexus-mvp-meta-tuning:v1:track-A';
function harness() {
    const local = new Map(), session = new Map();
    const storage = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
    const recordStorage = storage(local), sessionStorage = storage(session);
    // Two logical key buckets, both exposed through the same real-browser localStorage API.
    const localStorage = {
        getItem: k => (k === pointerKey ? sessionStorage : recordStorage).getItem(k),
        setItem: (k, v) => (k === pointerKey ? sessionStorage : recordStorage).setItem(k, v),
        removeItem: k => (k === pointerKey ? sessionStorage : recordStorage).removeItem(k)
    };
    const modules = new Map();
    function load(name) {
        const file = path.resolve(name);
        if (modules.has(file)) return modules.get(file);
        const exports = {}; modules.set(file, exports);
        vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText, { exports, localStorage, sessionStorage, crypto: webcrypto,
            require: request => load(path.resolve(path.dirname(file), request + '.ts')) }, { filename: file });
        return exports;
    }
    const codec = load('src/ui/mvp/sessionCheckpoint.ts');
    const { EditHistory } = load('src/ui/mvp/EditHistory.ts');
    const { SessionStore } = load('src/ui/mvp/SessionStore.ts');
    const tuningStorage = load('src/ui/mvp/metaTuningStorage.ts');
    const file = { name: 'track.wav', size: 1024, hash: 'a'.repeat(64) };
    const plan = { version: 1, source: 'auto', points: [{ id: 'p', time: 2, sectionId: 'intro', preset: 'A.json',
        confidence: 1, intensity: 1, reason: 'manual', morphDurationSec: 1, morphCurve: 'easeInOut', locked: false }] };
    const journey = intensity => {
        const effective = structuredClone(plan); effective.points[0].intensity = intensity;
        return codec.normalizeSessionSnapshot('journey', JSON.stringify({ plan: effective, generatedPlan: plan,
            edited: true, activity: 'balanced', variant: 'paired', scale: 1 }), 60);
    };
    const tuning = intensity => codec.normalizeSessionSnapshot('tuning', JSON.stringify({
        macros: { intensity, motion: 0.5, depth: 0.5, detail: 0.5 }, advancedBoosts: {} }), 60);
    const history = new EditHistory();
    history.record('journey', journey(1), journey(2), 'Strength');
    history.record('tuning', tuning(0.5), tuning(0.8), 'Intensity');
    history.setScope('journey'); history.undo();
    const checkpoint = { version: 1, token: 'token-A', fingerprint: 'track-A', duration: 60, file,
        current: { journey: journey(1), tuning: tuning(0.8) }, history: history.exportArchive(),
        workspace: { position: 12.345, wasPlaying: false, fullscreen: true, selectedMomentId: 'p', timelineHidden: true,
            snap: true, follow: false, draw: true, zoom: 2, pan: 5,
            layers: { waveform: false, rms: true, buildup: false, automation: true, cues: false },
            drawer: 'tuning', sheetOpen: false, previewQuality: 'reduced', exportResolution: '1080p', loopPlayback: false,
            targetTuning: {} } };
    const changes = { tuning: JSON.parse(checkpoint.current.tuning.data), journey: {
        version: 1, plan, activityLevel: 'balanced', variantMode: 'paired', morphScale: 1, edited: true } };
    return { local, session, localStorage, sessionStorage, codec, EditHistory, SessionStore,
        tuningStorage, checkpoint, changes, file, journey, tuning,
        encoding: load('src/ui/mvp/checkpointEncoding.ts'),
        computeAudioContentHash: load('src/ui/mvp/audioContentHash.ts').computeAudioContentHash };
}

test('checkpoint restores both journal branches, filtered scope and complete durable workspace', () => {
    const h = harness(), value = h.codec.normalizeCheckpoint(h.checkpoint);
    assert.ok(value);
    assert.equal(value.workspace.position, 12.345);
    assert.equal(value.workspace.layers.cues, false);
    assert.equal(value.workspace.previewQuality, 'reduced');
    assert.equal(value.workspace.loopPlayback, false);
    const restored = new h.EditHistory();
    assert.equal(restored.importArchive(value.history, value.current,
        (d, data) => h.codec.normalizeSessionSnapshot(d, data, 60)), true);
    assert.equal(restored.getStatus().scope, 'journey');
    assert.equal(restored.getStatus().redoCount, 1);
    assert.equal(JSON.parse(restored.redo().after.data).plan.points[0].intensity, 2);
    restored.setScope('all');
    assert.equal(restored.undo().domain, 'journey');
    assert.equal(JSON.parse(restored.undo().before.data).macros.intensity, 0.5);
});

test('a large single-point morph scale survives checkpoint save, restore and undo/redo', async () => {
    const h = harness(), history = new h.EditHistory();
    const before = h.journey(1);
    const value = JSON.parse(before.data); value.scale = 50;
    const after = h.codec.normalizeSessionSnapshot('journey', JSON.stringify(value), 60);
    assert.equal(JSON.parse(after.data).scale, 50);
    history.record('journey', before, after, 'Morph scale');
    h.checkpoint.current.journey = after;
    h.checkpoint.history = history.exportArchive();
    h.changes.journey.morphScale = 50;
    assert.equal(await new h.SessionStore().save(h.checkpoint, h.changes, () => true), true);
    assert.equal(h.tuningStorage.loadMetaTuning('track-A', 60).journey.morphScale, 50);
    const restored = await new h.SessionStore().consume();
    assert.ok(restored);
    const journal = new h.EditHistory();
    assert.equal(journal.importArchive(restored.history, restored.current,
        (domain, data) => h.codec.normalizeSessionSnapshot(domain, data, 60)), true);
    assert.equal(JSON.parse(journal.undo().before.data).scale, 1);
    assert.equal(JSON.parse(journal.redo().after.data).scale, 50);
});

test('schema, pointer indices, continuity, domains, unsafe paths and excessive histories are rejected atomically', () => {
    const h = harness();
    const mutations = [
        c => c.version = 9, c => c.duration = -1, c => c.file.size = 0,
        c => c.history.scope = 'unknown', c => c.history.past[0].after = 999,
        c => c.history.past[0].domain = 'journey', c => c.current.tuning = h.tuning(0.3),
        c => c.history.future = Array(301).fill(c.history.future[0]),
        c => c.workspace.position = 61, c => c.workspace.zoom = Infinity,
        c => c.workspace.drawer = 'arbitrary', c => c.workspace.layers.cues = 'yes',
        c => c.current.journey.data = c.current.journey.data.replace('A.json', '../escape.json'),
        c => c.history.snapshots[0].data = '{broken'
    ];
    for (const mutate of mutations) {
        const corrupt = structuredClone(h.checkpoint); mutate(corrupt);
        assert.equal(h.codec.normalizeCheckpoint(corrupt), null, mutate.toString());
    }
    const missingSelection = structuredClone(h.checkpoint); missingSelection.workspace.selectedMomentId = 'gone';
    missingSelection.workspace.unknownRuntimeHandle = { execute: 'untrusted' };
    const normalized = h.codec.normalizeCheckpoint(missingSelection);
    assert.equal(normalized.workspace.selectedMomentId, null);
    assert.equal(normalized.workspace.unknownRuntimeHandle, undefined);
});

test('one explicit save publishes panels and history without audio; restoration consumes it exactly once', async () => {
    const h = harness(), store = new h.SessionStore();
    assert.equal(await store.save(h.checkpoint, h.changes, () => true), true);
    assert.equal(h.local.size, 1);
    const saved = JSON.parse(h.local.get(trackKey));
    assert.equal(saved.macros.intensity, 0.8); assert.equal(saved.checkpoint.token, 'token-A');
    const restored = await new h.SessionStore().consume();
    assert.equal(restored.file.hash, h.file.hash);
    assert.deepEqual(Object.keys(restored.file).sort(), ['hash', 'name', 'size']);
    assert.equal(restored.history.future.length, 1);
    assert.equal(JSON.parse(h.local.get(trackKey)).checkpoint, undefined);
    assert.equal(h.session.size, 0);
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(h.tuningStorage.loadMetaTuning('track-A', 60).macros.intensity, 0.8, 'ordinary panel save survives consumption');
});

test('first edit invalidates once without rewriting the large track record; old history cannot resurrect', async () => {
    const h = harness(), store = new h.SessionStore();
    await store.save(h.checkpoint, h.changes, () => true);
    const saved = h.local.get(trackKey);
    let writes = 0; const set = h.sessionStorage.setItem;
    h.sessionStorage.setItem = (...args) => { writes++; set(...args); };
    for (let i = 0; i < 500; i++) store.invalidate();
    assert.equal(writes, 1); assert.equal(h.local.get(trackKey), saved);
    h.tuningStorage.saveJourney('track-A', h.changes.journey);
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(JSON.parse(h.local.get(trackKey)).checkpoint, undefined);
});

test('explicit discard deletes the checkpoint, preserving ordinary panel settings', async () => {
    const h = harness(), store = new h.SessionStore();
    await store.save(h.checkpoint, h.changes, () => true);
    await store.discard();
    assert.equal(JSON.parse(h.local.get(trackKey)).checkpoint, undefined);
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(h.tuningStorage.loadMetaTuning('track-A').macros.intensity, 0.8);
});

test('superseded save cannot publish a checkpoint', async () => {
    const h = harness(), store = new h.SessionStore();
    const saving = store.save(h.checkpoint, h.changes, () => false);
    assert.equal(await saving, false); assert.equal(h.local.size, 0);
    assert.equal(JSON.parse(h.session.get(pointerKey)).valid, false);
});

test('quota and denied capability store never report a successful checkpoint', async () => {
    for (const kind of ['local', 'session', 'publish']) {
        const h = harness(), store = new h.SessionStore();
        if (kind === 'local') h.localStorage.setItem = () => { throw Error('quota'); };
        if (kind === 'session') h.sessionStorage.setItem = () => { throw Error('denied'); };
        if (kind === 'publish') {
            const set = h.sessionStorage.setItem;
            h.sessionStorage.setItem = (key, value) => { if (JSON.parse(value).valid) throw Error('denied'); set(key, value); };
        }
        assert.equal(await store.save(h.checkpoint, h.changes, () => true), false, kind);
        assert.equal(await new h.SessionStore().consume(), null, kind);
    }
});

test('byte budget rejects oversized history before storage, without trimming commands', async () => {
    const h = harness(), store = new h.SessionStore();
    h.checkpoint.extra = 'x'.repeat(h.codec.MAX_CHECKPOINT_CHARS);
    assert.equal(await store.save(h.checkpoint, h.changes, () => true), false);
    assert.equal(h.local.size, 0);
    assert.equal(store.getSaveError(), 'too-large');
});

test('300 ordinary edits of a detailed journey fit storage and restore every undo step', async () => {
    const h = harness(), history = new h.EditHistory();
    const value = JSON.parse(h.journey(1).data);
    value.plan.points = Array.from({ length: 80 }, (_, i) => ({ ...value.plan.points[0], id: `p${i}`, time: i * .7,
        morphDurationSec: .3, meta: { sceneId: `scene-${i}`, stylePack: 'cosmic-wormhole',
            motif: 'tunnel-drive', targetStateReference: 'cosmic-wormhole:wormhole.deep-drift' } }));
    value.generatedPlan = structuredClone(value.plan);
    let before = h.codec.normalizeSessionSnapshot('journey', JSON.stringify(value), 60);
    for (let i = 1; i <= 300; i++) {
        value.plan.points[0].intensity = 1 + i / 300;
        const after = h.codec.normalizeSessionSnapshot('journey', JSON.stringify(value), 60);
        history.record('journey', before, after, 'Strength'); before = after;
    }
    h.checkpoint.current.journey = before; h.checkpoint.history = history.exportArchive();
    h.changes.journey.plan = value.plan;
    assert.ok(JSON.stringify(h.checkpoint).length > h.codec.MAX_CHECKPOINT_CHARS,
        'the previous full-snapshot format exceeds the budget during ordinary editing');
    const archive = JSON.stringify(h.checkpoint.history);
    assert.equal(await new h.SessionStore().save(h.checkpoint, h.changes, () => true), true);
    assert.equal(JSON.stringify(h.checkpoint.history), archive, 'encoding must not alter live history');
    const restored = await new h.SessionStore().consume(); assert.ok(restored);
    const journal = new h.EditHistory();
    assert.equal(journal.importArchive(restored.history, restored.current,
        (domain, data) => h.codec.normalizeSessionSnapshot(domain, data, 60)), true);
    assert.equal(journal.getStatus().undoCount, 300);
    for (let i = 300; i > 0; i--) assert.equal(JSON.parse(journal.undo().before.data).plan.points[0].intensity, 1 + (i - 1) / 300);
    assert.equal(journal.getStatus().redoCount, 300);
});

test('denied invalidation/discard fails visibly and can retry without losing the live capability', async () => {
    const h = harness(), store = new h.SessionStore();
    await store.save(h.checkpoint, h.changes, () => true);
    const get = h.localStorage.getItem;
    h.localStorage.getItem = () => { throw Error('storage blocked'); };
    assert.equal(store.invalidate(), false);
    assert.equal(store.discard(), false);
    assert.equal(await store.save(h.checkpoint, h.changes, () => true), false);
    h.localStorage.getItem = get;
    assert.equal(store.discard(), true);
    assert.equal(await new h.SessionStore().consume(), null);
});

test('corrupt encoded checkpoints burn their capability and leave panel settings recoverable', async () => {
    const h = harness();
    assert.equal(await new h.SessionStore().save(h.checkpoint, h.changes, () => true), true);
    const record = JSON.parse(h.local.get(trackKey));
    record.checkpoint = h.encoding.encodeCheckpoint(h.checkpoint);
    const delta = record.checkpoint.history.snapshots.find(s => typeof s.data === 'object');
    assert.ok(delta); delta.data.base = 999;
    h.local.set(trackKey, JSON.stringify(record));
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(h.session.size, 0);
    assert.ok(h.tuningStorage.loadMetaTuning('track-A', 60));
});

test('serialization and schema failures return a reason without poisoning subsequent saves', async () => {
    const h = harness(), store = new h.SessionStore();
    const circular = { ...h.checkpoint }; circular.extra = circular;
    assert.equal(await store.save(circular, h.changes, () => true), false);
    assert.equal(store.getSaveError(), 'invalid-checkpoint');
    assert.equal(await store.save({ ...h.checkpoint, duration: -1 }, h.changes, () => true), false);
    assert.equal(store.getSaveError(), 'invalid-checkpoint');
    assert.equal(await store.save(h.checkpoint, h.changes, () => true), true);
    assert.equal(store.getSaveError(), null);
});

test('corrupted checkpoint and invalid content hash fail closed and consume the capability', async () => {
    for (const kind of ['hash', 'corrupt']) {
        const h = harness(), store = new h.SessionStore();
        await store.save(h.checkpoint, h.changes, () => true);
        const v = JSON.parse(h.local.get(trackKey));
        if (kind === 'hash') v.checkpoint.file.hash = 'not-a-hash'; else v.checkpoint.history.version = 2;
        h.local.set(trackKey, JSON.stringify(v));
        assert.equal(await new h.SessionStore().consume(), null);
        assert.equal(await new h.SessionStore().consume(), null);
        assert.equal(h.session.size, 0);
    }
});

test('another tab replacing the same track wins; stale token cannot restore or delete its checkpoint', async () => {
    const h = harness(), first = new h.SessionStore();
    await first.save(h.checkpoint, h.changes, () => true);
    const stalePointer = h.session.get(pointerKey);
    const second = new h.SessionStore();
    await second.save({ ...h.checkpoint, token: 'token-B' }, h.changes, () => true);
    first.invalidate();
    assert.equal(JSON.parse(h.session.get(pointerKey)).token, 'token-B', 'old tab cannot invalidate newer capability');
    assert.equal(JSON.parse(h.session.get(pointerKey)).valid, true);
    h.session.set(pointerKey, stalePointer);
    assert.equal(await new h.SessionStore().consume(), null);
    assert.equal(JSON.parse(h.local.get(trackKey)).checkpoint.token, 'token-B');
});

test('content identity ignores filename/metadata and distinguishes equal-size, different audio bytes', async () => {
    const h = harness();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const a = await h.computeAudioContentHash({ name: 'A.wav', arrayBuffer: async () => bytes.buffer });
    assert.equal(a, await h.computeAudioContentHash({ name: 'renamed.wav', arrayBuffer: async () => bytes.buffer }));
    bytes[3] = 5;
    assert.notEqual(a, await h.computeAudioContentHash({ name: 'A.wav', arrayBuffer: async () => bytes.buffer }));
    assert.match(a, /^[a-f0-9]{64}$/);
});

test('archive import failure keeps the live journal; stored group IDs never merge new gestures', () => {
    const h = harness(), history = new h.EditHistory();
    history.record('journey', h.journey(1), h.journey(2), 'Original');
    assert.equal(history.importArchive({ version: 99 }, {}, () => null), false);
    assert.equal(history.getStatus().undoLabel, 'Original');
    const archive = history.exportArchive();
    assert.equal(archive.snapshots.length, 2);
    assert.equal(history.importArchive(archive, { journey: h.journey(2), tuning: h.tuning(0.5) },
        (d, data) => h.codec.normalizeSessionSnapshot(d, data, 60)), true);
    history.beginGroup(); history.record('journey', h.journey(2), h.journey(3), 'New gesture');
    assert.equal(history.getStatus().undoCount, 2);
});
