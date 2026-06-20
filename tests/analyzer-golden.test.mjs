import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import {
  GOLDEN_FIXTURES,
  buildFixtureInput,
  summarizeForGolden,
  compareGolden
} from './fixtures/golden-fixtures.mjs';

const SRC_ROOT = join(process.cwd(), 'src');
const GOLDEN_DIR = join(process.cwd(), 'tests', 'fixtures', 'golden');

// Same lightweight TS module loader used by the other analyzer tests, so verification
// runs on the same engine (V8) and resolves src/ TypeScript on the fly.
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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
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
      Error
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const loadSrc = createSrcLoader();
const { analyzeAudio } = loadSrc('analyzer/analyzeAudio.ts');

for (const fixture of GOLDEN_FIXTURES) {
  test(`golden master: ${fixture.id}`, () => {
    const goldenPath = join(GOLDEN_DIR, `${fixture.id}.json`);
    assert.ok(
      existsSync(goldenPath),
      `Missing golden master for ${fixture.id}. Run "bun run update-golden-masters" to create it.`
    );

    const expected = JSON.parse(readFileSync(goldenPath, 'utf8'));
    const result = analyzeAudio(buildFixtureInput(fixture));
    const actual = summarizeForGolden(fixture.id, result);

    const failures = compareGolden(actual, expected);
    assert.equal(
      failures.length,
      0,
      `Golden master drift for ${fixture.id}:\n  ${failures.join('\n  ')}\n` +
        `If this drift is an intended improvement, regenerate with "bun run update-golden-masters".`
    );
  });
}

// Determinism guard: identical input must produce byte-identical summaries.
test('golden fixtures are deterministic across repeated runs', () => {
  for (const fixture of GOLDEN_FIXTURES) {
    const a = summarizeForGolden(fixture.id, analyzeAudio(buildFixtureInput(fixture)));
    const b = summarizeForGolden(fixture.id, analyzeAudio(buildFixtureInput(fixture)));
    assert.deepEqual(b, a, `${fixture.id} is not deterministic`);
  }
});
