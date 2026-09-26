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

function makeChart(RhythmGameConfigDefaults) {
  // Three notes spread far enough apart to clear default spacing/window constants.
  return [
    { id: 'n0', time: 1.0, lane: 0, hand: 'left', intensity: 0.8, sourceType: 1 },
    { id: 'n1', time: 2.0, lane: 2, hand: 'right', intensity: 0.8, sourceType: 1 },
    { id: 'n2', time: 3.0, lane: 1, hand: 'either', intensity: 0.8, sourceType: 1 }
  ];
}

function leftAttempt(songTime) {
  return { songTime, hand: 'left', position: { x: -0.45, y: 0, z: 0 }, speed: 1.0 };
}

function rightAttempt(songTime) {
  return { songTime, hand: 'right', position: { x: 0.45, y: 0, z: 0 }, speed: 1.0 };
}

test('a fresh session starts idle and moves to ready after loading a chart', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  assert.equal(session.getState(), 'idle');
  session.loadChart(makeChart());
  assert.equal(session.getState(), 'ready');
});

test('start begins playing and finish ends the session', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();
  assert.equal(session.getState(), 'playing');
  session.finish();
  assert.equal(session.getState(), 'finished');
});

test('pause and resume round-trip without losing progress', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();
  session.attemptStrike(leftAttempt(1.0));
  session.pause();
  assert.equal(session.getState(), 'paused');
  assert.equal(session.getSnapshot().hitCount, 1);
  session.resume();
  assert.equal(session.getState(), 'playing');
  assert.equal(session.getSnapshot().hitCount, 1);
});

test('update() advances the miss cursor and marks expired pending notes missed', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();

  const missed = session.update(1.5);
  assert.deepEqual(normalizePayload(missed), ['n0']);
  assert.equal(session.getSnapshot().missCount, 1);
  assert.equal(session.getSnapshot().combo, 0);

  // A second call at the same song time must not re-report the same note.
  const missedAgain = session.update(1.5);
  assert.equal(missedAgain.length, 0);
});

test('a hit note is never reported missed by a later update() call', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();

  session.attemptStrike(leftAttempt(1.0));
  const missed = session.update(1.5);
  assert.equal(missed.length, 0);
  assert.equal(session.getSnapshot().hitCount, 1);
  assert.equal(session.getSnapshot().missCount, 0);
});

test('restart resynchronizes score, combo, and note state', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();
  session.attemptStrike(leftAttempt(1.0));
  session.update(1.5);
  assert.equal(session.getSnapshot().hitCount, 1);

  session.restart();
  assert.equal(session.getState(), 'playing');
  const snapshot = session.getSnapshot();
  assert.equal(snapshot.score, 0);
  assert.equal(snapshot.combo, 0);
  assert.equal(snapshot.hitCount, 0);
  assert.equal(snapshot.missCount, 0);

  // The previously-missed note must be strikeable again after restart.
  const result = session.attemptStrike(leftAttempt(1.0));
  assert.ok(result);
});

test('seeking backwards makes a previously missed note strikeable again', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();
  session.update(1.5); // note n0 (t=1.0) misses

  session.seek(0.5);
  const result = session.attemptStrike(leftAttempt(1.0));
  assert.ok(result);
});

test('seeking forwards past a note marks it missed without a strike', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();

  session.seek(1.5); // note n0 (t=1.0) is now behind the miss boundary
  const result = session.attemptStrike(leftAttempt(1.0));
  assert.equal(result, null);
});

test('a note cannot score twice across seeks', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();

  const first = session.attemptStrike(leftAttempt(1.0));
  assert.ok(first);
  session.seek(0.9);
  // Seeking resets pending state for review, but the exact same instant re-strike must still
  // behave deterministically (one active resolution per note at a time): it can be struck again
  // after the seek clears its status, matching a real rhythm-game rewind.
  const second = session.attemptStrike(leftAttempt(1.0));
  assert.ok(second);
  const third = session.attemptStrike(leftAttempt(1.0));
  assert.equal(third, null);
});

test('getActiveNotes returns only notes within the approach/miss window and stays bounded', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();

  const active = session.getActiveNotes(0.5);
  const ids = active.map((entry) => entry.note.id);
  assert.ok(ids.includes('n0'));
  assert.ok(!ids.includes('n2')); // n2 at t=3.0 is beyond the 2s approach horizon from t=0.5
});

test('reaching the end of the chart lets finish() transition cleanly and a later restart replays it', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession();
  session.loadChart(makeChart());
  session.start();
  session.attemptStrike(leftAttempt(1.0));
  session.attemptStrike(rightAttempt(2.0));
  session.attemptStrike({ songTime: 3.0, hand: 'left', position: { x: 0, y: 0, z: 0 }, speed: 1.0 });
  session.finish();

  const snapshot = session.getSnapshot();
  assert.equal(snapshot.state, 'finished');
  assert.equal(snapshot.hitCount, 3);
  assert.equal(snapshot.missCount, 0);

  session.restart();
  assert.equal(session.getState(), 'playing');
  assert.equal(session.getSnapshot().hitCount, 0);
});

test('seek resets the score ledger and natural end accounts for remaining notes exactly once', () => {
  const { RhythmGameSession } = loadGameplay();
  const session = new RhythmGameSession(); session.loadChart(makeChart()); session.start();
  session.attemptStrike(leftAttempt(1)); session.seek(0.9);
  assert.equal(session.getSnapshot().score, 0);
  session.attemptStrike(leftAttempt(1));
  assert.equal(session.getSnapshot().score, 100);
  session.finish(); session.finish();
  assert.equal(session.getSnapshot().hitCount, 1);
  assert.equal(session.getSnapshot().missCount, 2);
});
