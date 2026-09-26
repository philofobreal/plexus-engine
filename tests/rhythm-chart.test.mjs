import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');

function createSrcLoader() {
  const moduleCache = new Map();

  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try {
      readFileSync(`${base}.ts`, 'utf8');
      return `${base}.ts`;
    } catch {
      return join(base, 'index.ts');
    }
  }

  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText;

    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Float32Array,
      Math,
      Number,
      Infinity,
      Map
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const loadGameplay = () => createSrcLoader()('gameplay/index.ts');
const normalizePayload = (payload) => JSON.parse(JSON.stringify(payload));

function makeEvent(time, intensity = 0.8, type = 1) {
  return { time, intensity, type };
}

test('identical input produces an identical chart', () => {
  const { buildRhythmChart } = loadGameplay();
  const events = [makeEvent(0.5), makeEvent(1.0, 0.6, 2), makeEvent(1.9, 0.9, 3), makeEvent(3.2, 0.4, 1)];
  const source = { events, durationSec: 10, beats: [] };

  const first = buildRhythmChart(source);
  const second = buildRhythmChart({ events: events.map((e) => ({ ...e })), durationSec: 10, beats: [] });

  assert.deepEqual(normalizePayload(first), normalizePayload(second));
});

test('chart output is sorted ascending by time', () => {
  const { buildRhythmChart } = loadGameplay();
  const events = [makeEvent(4), makeEvent(1), makeEvent(3), makeEvent(2), makeEvent(0.2)];
  const chart = buildRhythmChart({ events, durationSec: 10, beats: [] });

  for (let i = 1; i < chart.length; i++) {
    assert.ok(chart[i].time >= chart[i - 1].time);
  }
  assert.ok(chart.length > 0);
});

test('builder never mutates the source events array', () => {
  const { buildRhythmChart } = loadGameplay();
  const events = [makeEvent(0.5), makeEvent(1.5), makeEvent(2.5)];
  const snapshot = JSON.parse(JSON.stringify(events));

  buildRhythmChart({ events, durationSec: 10, beats: [] });

  assert.deepEqual(events, snapshot);
});

test('dense clusters are thinned to the configured minimum spacing', () => {
  const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = loadGameplay();
  const events = [];
  for (let i = 0; i < 200; i++) events.push(makeEvent(i * 0.01, 0.9, (i % 3) + 1));

  const chart = buildRhythmChart({ events, durationSec: 5, beats: [] });

  assert.ok(chart.length < events.length);
  for (let i = 1; i < chart.length; i++) {
    assert.ok(chart[i].time - chart[i - 1].time >= DEFAULT_RHYTHM_GAME_CONFIG.minGlobalNoteSpacingSec - 1e-9);
  }
});

test('sparse events input still produces a valid chart', () => {
  const { buildRhythmChart } = loadGameplay();
  const chart = buildRhythmChart({ events: [makeEvent(2.0)], durationSec: 10, beats: [] });
  assert.equal(chart.length, 1);
  assert.equal(chart[0].time, 2.0);
});

test('empty events and empty beat grid produce an empty chart', () => {
  const { buildRhythmChart } = loadGameplay();
  const chart = buildRhythmChart({ events: [], durationSec: 10, beats: [] });
  assert.equal(chart.length, 0);
});

test('grid extrapolation without percussive events never invents notes', () => {
  const { buildRhythmChart } = loadGameplay();
  const beats = Array.from({ length: 32 }, (_, i) => i * 0.5);
  const chart = buildRhythmChart({ events: [], durationSec: 20, beats });
  assert.equal(chart.length, 0);
  for (const note of chart) assert.ok(Number.isFinite(note.time));
});

test('non-finite and negative event times are rejected', () => {
  const { buildRhythmChart } = loadGameplay();
  const events = [
    makeEvent(Number.NaN),
    makeEvent(Number.POSITIVE_INFINITY),
    makeEvent(-1),
    makeEvent(2.0)
  ];
  const chart = buildRhythmChart({ events, durationSec: 10, beats: [] });
  assert.equal(chart.length, 1);
  assert.equal(chart[0].time, 2.0);
});

test('events outside the audio never invent an end-of-track target', () => {
  const { buildRhythmChart } = loadGameplay();
  const chart = buildRhythmChart({ events: [makeEvent(999)], durationSec: 10, beats: [] });
  assert.equal(chart.length, 0);
});

test('zero or invalid duration produces an empty chart', () => {
  const { buildRhythmChart } = loadGameplay();
  assert.equal(buildRhythmChart({ events: [makeEvent(1)], durationSec: 0, beats: [] }).length, 0);
  assert.equal(buildRhythmChart({ events: [makeEvent(1)], durationSec: Number.NaN, beats: [] }).length, 0);
});

test('low-intensity events below the floor are dropped', () => {
  const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = loadGameplay();
  const chart = buildRhythmChart({
    events: [makeEvent(1, DEFAULT_RHYTHM_GAME_CONFIG.intensityFloor - 0.01), makeEvent(2, 0.9)],
    durationSec: 10,
    beats: []
  });
  assert.equal(chart.length, 1);
  assert.equal(chart[0].time, 2);
});

test('lane and hand assignment is deterministic across repeated builds', () => {
  const { buildRhythmChart } = loadGameplay();
  const events = Array.from({ length: 40 }, (_, i) => makeEvent(i * 0.3, 0.7, (i % 3) + 1));
  const a = buildRhythmChart({ events, durationSec: 20, beats: [] });
  const b = buildRhythmChart({ events, durationSec: 20, beats: [] });

  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].lane, b[i].lane);
    assert.equal(a[i].hand, b[i].hand);
  }
  const lanesUsed = new Set(a.map((n) => n.lane));
  assert.ok(lanesUsed.size > 1, 'expected variety across lanes for a large enough input');
});

test('every note hand agrees with its lane assignment', () => {
  const { buildRhythmChart, LANE_HAND } = loadGameplay();
  const events = Array.from({ length: 30 }, (_, i) => makeEvent(i * 0.4, 0.7, (i % 3) + 1));
  const chart = buildRhythmChart({ events, durationSec: 20, beats: [] });
  for (const note of chart) {
    const expected = LANE_HAND.find((entry) => entry.lane === note.lane);
    if (expected.hand !== 'either') assert.equal(note.hand, expected.hand);
    else assert.ok(['left', 'right'].includes(note.hand));
  }
});



test('opening notes get the full approach horizon without shifting musical timestamps', () => {
  const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG } = loadGameplay();
  const events = [makeEvent(0), makeEvent(0.5), makeEvent(2), makeEvent(3)];
  const chart = buildRhythmChart({ events, durationSec: 10, beats: [] });
  assert.deepEqual(normalizePayload(chart.map(n => n.time)), [2, 3]);
  assert.ok(chart.every(n => n.time >= DEFAULT_RHYTHM_GAME_CONFIG.approachTimeSec));
});
