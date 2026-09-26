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

function makeNoteState(overrides = {}) {
  const { note: noteOverrides, ...rest } = overrides;
  return {
    note: {
      id: 'n0',
      time: 5.0,
      lane: 0,
      row: 1,
      hand: 'left',
      intensity: 0.8,
      sourceType: 1,
      ...noteOverrides
    },
    status: 'pending',
    judgement: null,
    ...rest
  };
}

function leftTargetAttempt(overrides = {}) {
  return {
    songTime: 5.0,
    hand: 'left',
    position: { x: -0.45, y: 0, z: ((overrides.songTime ?? 5) - 5) * 4 },
    speed: 1.0,
    ...overrides
  };
}

test('a strike inside the perfect window grades perfect and resolves the note', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ songTime: 5.02 }), notes);
  assert.ok(result);
  assert.equal(result.grade, 'perfect');
  assert.equal(notes[0].status, 'hit');
});

test('a strike inside the good window but outside perfect grades good', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ songTime: 5.09 }), notes);
  assert.ok(result);
  assert.equal(result.grade, 'good');
});

test('an early strike within the good window still resolves', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ songTime: 4.90 }), notes);
  assert.ok(result);
  assert.equal(result.grade, 'good');
});

test('a strike beyond the miss window does not resolve the note', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ songTime: 5.5 }), notes);
  assert.equal(result, null);
  assert.equal(notes[0].status, 'pending');
});

test('wrong hand fails to register a hit', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ hand: 'right' }), notes);
  assert.equal(result, null);
  assert.equal(notes[0].status, 'pending');
});

test('either-hand notes accept both hands', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState({ note: { lane: 1, hand: 'either' } })];
  const result = judgeStrike({ songTime: 5.0, hand: 'right', position: { x: 0, y: 0, z: 0 }, speed: 1.0 }, notes);
  assert.ok(result);
});

test('low strike velocity fails to register a hit', () => {
  const { judgeStrike, DEFAULT_RHYTHM_GAME_CONFIG } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ speed: DEFAULT_RHYTHM_GAME_CONFIG.minStrikeSpeedMps - 0.1 }), notes);
  assert.equal(result, null);
  assert.equal(notes[0].status, 'pending');
});

test('a spatially distant strike fails to register a hit', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const result = judgeStrike(leftTargetAttempt({ position: { x: 5, y: 5, z: 5 } }), notes);
  assert.equal(result, null);
  assert.equal(notes[0].status, 'pending');
});

test('an already-hit note cannot be resolved twice', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [makeNoteState()];
  const first = judgeStrike(leftTargetAttempt(), notes);
  assert.ok(first);
  const second = judgeStrike(leftTargetAttempt(), notes);
  assert.equal(second, null);
});

test('when multiple notes qualify, the smallest timing error wins deterministically', () => {
  const { judgeStrike } = loadGameplay();
  const notes = [
    makeNoteState({ note: { id: 'far', time: 4.85 } }),
    makeNoteState({ note: { id: 'near', time: 5.0 } })
  ];
  const result = judgeStrike(leftTargetAttempt({ songTime: 5.02 }), notes);
  assert.equal(result.noteId, 'near');
});

test('markExpiredNotesAsMissed marks only pending notes past the miss boundary', () => {
  const { markExpiredNotesAsMissed } = loadGameplay();
  const notes = [
    makeNoteState({ note: { id: 'a', time: 1.0 } }),
    makeNoteState({ note: { id: 'b', time: 2.0 }, status: 'hit', judgement: 'perfect' }),
    makeNoteState({ note: { id: 'c', time: 10.0 } })
  ];
  const missed = markExpiredNotesAsMissed(notes, 5.0);
  assert.deepEqual(normalizePayload(missed), ['a']);
  assert.equal(notes[0].status, 'missed');
  assert.equal(notes[1].status, 'hit');
  assert.equal(notes[2].status, 'pending');
});

