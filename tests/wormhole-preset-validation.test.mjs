import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const PRESET_ROOT = join(process.cwd(), 'public/visual-tuning-presets');

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
    const output = ts.transpileModule(readFileSync(filePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    vm.runInNewContext(output, {
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Math,
      Number
    }, { filename: filePath });
    return module.exports;
  }
  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

const { visualTuningControls } = createSrcLoader()('config/visualTuning.ts');
const controlsByKey = new Map(Array.from(visualTuningControls, (control) => [control.key, control]));
const presetFiles = readdirSync(PRESET_ROOT).filter((name) => /^vos-wh-.*\.json$/.test(name)).sort();

test('every authored wormhole preset value stays within its declared tuning-control range', () => {
  for (const name of presetFiles) {
    const tuning = JSON.parse(readFileSync(join(PRESET_ROOT, name), 'utf8')).visualTuning ?? {};
    for (const [key, value] of Object.entries(tuning)) {
      if (!key.startsWith('wormhole')) continue;
      const control = controlsByKey.get(key);
      assert.ok(control, `${name} uses declared control metadata for ${key}`);
      assert.equal(typeof value, 'number', `${name}.${key} is numeric`);
      assert.ok(
        value >= control.min && value <= control.max,
        `${name}.${key}=${value} is outside [${control.min}, ${control.max}]`
      );
    }
  }
});
