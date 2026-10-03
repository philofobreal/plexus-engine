import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';

const load = createLoader();
const settingsModule = () => load('xr/XrSettings.ts');
const json = value => JSON.stringify(value);

test('every setting is described once, round-trips through its control value; the gameplay library keeps its historical defaults', () => {
    const { XR_SETTINGS, XR_SETTING_SECTIONS, DEFAULT_XR_SETTINGS, resolveGameConfig } = settingsModule();
    const { DEFAULT_RHYTHM_GAME_CONFIG, DEFAULT_RHYTHM_GENERATION_SETTINGS } = load('gameplay/index.ts');
    const { DEFAULT_XR_BACKGROUND_SETTINGS } = load('xr/XrBackgroundSettings.ts');
    const ids = XR_SETTINGS.map(d => `${d.section}/${d.id}`);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(XR_SETTINGS.every(d => XR_SETTING_SECTIONS.some(s => s.id === d.section)));
    assert.ok(XR_SETTINGS.every(d => ['chart', 'session', 'presentation'].includes(d.scope)));
    for (const descriptor of XR_SETTINGS) {
        if (descriptor.kind === 'choice') {
            for (const choice of descriptor.choices) assert.equal(descriptor.read(descriptor.write(DEFAULT_XR_SETTINGS, choice.value)), choice.value, ids.join());
        } else {
            for (const value of [descriptor.min, descriptor.max]) assert.equal(descriptor.read(descriptor.write(DEFAULT_XR_SETTINGS, value)), value);
        }
    }
    // The pinned golden chart is built from the library's historical settings, not the XR player defaults.
    assert.equal(json(DEFAULT_RHYTHM_GENERATION_SETTINGS), json({ difficulty: 'normal', activity: 'balanced', variation: 'paired',
        handPattern: 'alternate', handLead: 'even', zones: 'split', playSpace: 'standard' }));
    assert.equal(json(DEFAULT_XR_SETTINGS.background), json(DEFAULT_XR_BACKGROUND_SETTINGS));
    // Play settings only touch judging and travel; every chart-defining field stays the golden default.
    for (const speed of ['normal', 'fast', 'hyper']) for (const saber of ['short', 'normal', 'long']) {
        const config = resolveGameConfig({ ...DEFAULT_XR_SETTINGS, generation: DEFAULT_RHYTHM_GENERATION_SETTINGS,
            play: { noteSpeed: speed, saberLength: saber } });
        for (const key of ['minGlobalNoteSpacingSec', 'minSameHandSpacingSec', 'intensityFloor', 'maxHandTravelMps', 'rowSpacingMeters',
            'cutConeDegrees', 'minCutSpeedMps', 'perfectWindowSec', 'goodWindowSec', 'missWindowSec', 'noteSizeMeters', 'hitRadiusMeters']) {
            assert.equal(config[key], DEFAULT_RHYTHM_GAME_CONFIG[key], `${speed}/${saber}: ${key}`);
        }
    }
});

test('the /xr/ player defaults are the authored menu values (ADR-009 Addendum T)', () => {
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, DEFAULT_XR_GENERATION_SETTINGS, normalizeXrSettings } = settingsModule();
    const expected = {
        playSpace: 'tall', noteSpeed: 'hyper', saberLength: 'long',
        difficulty: 'ultra', activity: 'active', variation: 'expressive', handPattern: 'alternate', handLead: 'even', zones: 'cross',
        wormhole: 'on', noteDesign: 'shard', quality: 'ultra', rateHz: '36', lineStroke: 34, sharpness: 100,
        intensity: 100, motion: 100, depth: 10, detail: 100
    };
    assert.equal(Object.keys(expected).length, XR_SETTINGS.length, 'every setting has an authored default');
    for (const descriptor of XR_SETTINGS) assert.equal(String(descriptor.read(DEFAULT_XR_SETTINGS)), String(expected[descriptor.id]), descriptor.id);
    assert.equal(DEFAULT_XR_SETTINGS.generation, DEFAULT_XR_GENERATION_SETTINGS);
    // A first visit (no stored record) and any missing field start from the same defaults.
    assert.equal(json(normalizeXrSettings({})), json(DEFAULT_XR_SETTINGS));
    assert.equal(normalizeXrSettings({ generation: { difficulty: 'hard' } }).generation.zones, 'cross');
});

test('changes are classified by their strongest scope; hostile input normalizes to valid settings', () => {
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope, normalizeXrSettings } = settingsModule();
    const by = id => XR_SETTINGS.find(d => d.id === id);
    const harder = by('difficulty').write(DEFAULT_XR_SETTINGS, 'expert');
    const thinner = by('lineStroke').write(DEFAULT_XR_SETTINGS, 20);
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, DEFAULT_XR_SETTINGS), null);
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, harder), 'chart');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, thinner), 'presentation');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, by('lineStroke').write(harder, 20)), 'chart', 'a mixed change takes the strongest scope');
    assert.equal(json(normalizeXrSettings(null)), json(DEFAULT_XR_SETTINGS));
    assert.equal(json(normalizeXrSettings({ generation: 'x', background: { quality: 'extreme', lineStroke: 'thick' } })), json(DEFAULT_XR_SETTINGS));
    assert.equal(normalizeXrSettings({ generation: { difficulty: 'hard' } }).generation.difficulty, 'hard');
});

test('the canvas game menu offers every described setting exactly once, on its section tab', () => {
    const { XR_SETTINGS, XR_SETTING_SECTIONS, DEFAULT_XR_SETTINGS } = settingsModule();
    const { menuLayout, DEFAULT_MENU_STATE } = load('xr/XrMenuModel.ts');
    const seen = [];
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: section.id }, { settings: DEFAULT_XR_SETTINGS,
            sessionState: 'ready', trackTitle: '', busy: false, canStart: true, status: '', results: null, input: 'desktop' });
        const ids = new Set(layout.items.filter(i => i.kind === 'option' || i.kind === 'step').map(i => i.id.split(':')[1]));
        assert.equal([...ids].join(), XR_SETTINGS.filter(d => d.section === section.id).map(d => d.id).join(), section.id);
        seen.push(...ids);
    }
    assert.equal(seen.length, XR_SETTINGS.length); assert.equal(new Set(seen).size, XR_SETTINGS.length);
});

test('every setting, including the newest ones, survives a reload through the per-browser store', () => {
    const { createXrSettingsStore } = load('xr/XrSettingsStore.ts');
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS } = settingsModule();
    const values = { playSpace: 'tall', noteSpeed: 'hyper', saberLength: 'auto', difficulty: 'ultra', wormhole: 'on', noteDesign: 'shard',
        quality: 'ultra', rateHz: '36', lineStroke: 55, sharpness: 80, intensity: 20, motion: 40, depth: 60, detail: 10 };
    let settings = DEFAULT_XR_SETTINGS;
    for (const [id, value] of Object.entries(values)) settings = XR_SETTINGS.find(d => d.id === id).write(settings, value);
    const storage = memoryStorage();
    createXrSettingsStore(storage).save(settings);
    const restored = createXrSettingsStore(storage).load();
    for (const [id, value] of Object.entries(values)) assert.equal(String(XR_SETTINGS.find(d => d.id === id).read(restored)), String(value), id);
    assert.equal(json(restored), json(settings));
});

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return { data, writes: 0, getItem(key) { return key in data ? data[key] : null; }, setItem(key, value) { this.writes++; data[key] = value; } };
}

test('settings persist in one versioned record; corrupt, foreign or unavailable storage falls back to defaults without throwing', () => {
    const { createXrSettingsStore, XR_SETTINGS_STORAGE_KEY, MEMORY_ONLY_SETTINGS_STORE } = load('xr/XrSettingsStore.ts');
    const { DEFAULT_XR_SETTINGS, XR_SETTINGS } = settingsModule();
    const storage = memoryStorage();
    const store = createXrSettingsStore(storage);
    assert.equal(json(store.load()), json(DEFAULT_XR_SETTINGS));
    const changed = XR_SETTINGS.find(d => d.id === 'zones').write(XR_SETTINGS.find(d => d.id === 'rateHz').write(DEFAULT_XR_SETTINGS, '36'), 'cross');
    store.save(changed); store.save(changed);
    assert.equal(storage.writes, 1, 'unchanged saves are not rewritten');
    const record = JSON.parse(storage.data[XR_SETTINGS_STORAGE_KEY]);
    assert.equal(record.version, 1);
    assert.equal(json(createXrSettingsStore(storage).load()), json(changed), 'a new visit restores the record');

    for (const raw of ['{not json', 'null', '42', json({ version: 2, generation: { difficulty: 'hard' } })]) {
        assert.equal(json(createXrSettingsStore(memoryStorage({ [XR_SETTINGS_STORAGE_KEY]: raw })).load()), json(DEFAULT_XR_SETTINGS), raw);
    }
    const partial = createXrSettingsStore(memoryStorage({ [XR_SETTINGS_STORAGE_KEY]: json({ version: 1, generation: { difficulty: 'easy', zones: 7 } }) })).load();
    assert.equal(partial.generation.difficulty, 'easy'); assert.equal(partial.generation.zones, 'cross', 'an invalid field takes the XR default');

    const hostile = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
    const guarded = createXrSettingsStore(hostile);
    assert.equal(json(guarded.load()), json(DEFAULT_XR_SETTINGS));
    assert.doesNotThrow(() => guarded.save(changed));
    assert.equal(createXrSettingsStore(null), MEMORY_ONLY_SETTINGS_STORE);
});

test('the session swaps its configuration only between runs and keeps the loaded chart', () => {
    const { RhythmGameSession, DEFAULT_RHYTHM_GAME_CONFIG } = load('gameplay/index.ts');
    const session = new RhythmGameSession();
    const chart = [{ id: 'n0', time: 3, lane: 0, row: 1, hand: 'left', intensity: 1, sourceType: 1 }];
    const faster = { ...DEFAULT_RHYTHM_GAME_CONFIG, noteSpeedMps: 7 };
    assert.equal(session.setConfig(faster), true);
    assert.equal(session.getState(), 'idle', 'an empty session stays idle');
    session.loadChart(chart); session.start();
    assert.equal(session.setConfig(DEFAULT_RHYTHM_GAME_CONFIG), false, 'refused while playing');
    session.update(4);
    assert.equal(session.getSnapshot().missCount, 1);
    session.pause();
    assert.equal(session.setConfig(faster), true);
    assert.equal(session.getState(), 'ready');
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.missCount, 0); assert.equal(snapshot.totalNotes, 1, 'the chart is kept');
});
