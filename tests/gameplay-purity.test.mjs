import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// ADR-009: src/gameplay/ is renderer-independent rhythm-game domain logic. It must never import
// Three.js, WebXR/DOM runtime, AudioEngine, or the shared mutable src/state/ store.

const GAMEPLAY_DIR = join(process.cwd(), 'src', 'gameplay');

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

function listGameplayFiles() {
  return readdirSync(GAMEPLAY_DIR).filter((name) => name.endsWith('.ts'));
}

test('src/gameplay/ contains no import of three, WebXR/DOM runtime, AudioEngine, or src/state', () => {
  for (const file of listGameplayFiles()) {
    const source = readFileSync(join(GAMEPLAY_DIR, file), 'utf8');

    assert.doesNotMatch(source, /from ['"]three['"]/, `${file} must not import three`);
    assert.doesNotMatch(source, /from ['"].*\/xr\//, `${file} must not import src/xr/`);
    assert.doesNotMatch(source, /from ['"].*AudioEngine['"]/, `${file} must not import AudioEngine`);
    assert.doesNotMatch(source, /from ['"].*\/state\/store['"]/, `${file} must not import the shared State store`);
    assert.doesNotMatch(source, /\bdocument\./, `${file} must not reference the DOM document`);
    assert.doesNotMatch(source, /\bnavigator\.xr\b/, `${file} must not reference navigator.xr`);
    assert.doesNotMatch(source, /\bTHREE\./, `${file} must not reference a THREE namespace`);
  }
});

test('src/gameplay/ files import only ./ relative modules or src/types', () => {
  for (const file of listGameplayFiles()) {
    const source = readFileSync(join(GAMEPLAY_DIR, file), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const inspect = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const specifier = node.moduleSpecifier.text;
        const isRelative = specifier.startsWith('./') && !specifier.includes('/../');
        const isSharedTypes = specifier === '../types' || specifier.startsWith('../types/');
        assert.ok(isRelative || isSharedTypes, `${file} has a disallowed import: ${specifier}`);
      }
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, `${file} uses a dynamic import`);
        assert.notEqual(node.expression.getText(ast), 'require', `${file} uses require`);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
  }
});

test('the XR composition entrypoint is the only module constructing AudioEngine for /xr/', () => {
  const main = readFileSync(join(process.cwd(), 'src', 'xr', 'main.ts'), 'utf8');
  assert.match(main, /new AudioEngine\(/);
  assert.match(main, /new XrRuntime\(/);

  for (const file of listGameplayFiles()) {
    const source = readFileSync(join(GAMEPLAY_DIR, file), 'utf8');
    assert.doesNotMatch(source, /new AudioEngine\(/, `${file} must not construct AudioEngine`);
  }

  const controller = readFileSync(join(process.cwd(), 'src', 'xr', 'XrAppController.ts'), 'utf8');
  assert.doesNotMatch(controller, /new AudioEngine\(/, 'XrAppController must receive AudioEngine, not construct it');
});

test('only the XR composition root can import the bounded Wormhole canvas source; no XR UI/renderer coupling', () => {
  const XR_DIR = join(process.cwd(), 'src', 'xr');

  for (const file of walk(XR_DIR)) {
    const source = readFileSync(file, 'utf8');
    if (file.endsWith(join('xr', 'main.ts'))) {
      const imports = [...source.matchAll(/from ['"]([^'"]*\/visuals\/[^'"]+)['"]/g)].map(match => match[1]);
      assert.deepEqual(imports, ['../visuals/WormholeCanvasSource', '../visuals/WormholeWorkerSource']);
    } else assert.doesNotMatch(source, /from ['"].*\/visuals\//, `${file} must not import src/visuals/`);
    assert.doesNotMatch(source, /from ['"].*\/ui\//, `${file} must not import src/ui/`);
  }
});

test('src/xr reads src/config only for the authored XR Wormhole defaults, in the background settings', () => {
  const XR_DIR = join(process.cwd(), 'src', 'xr');

  for (const file of walk(XR_DIR)) {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/from ['"]([^'"]*\/config\/[^'"]+)['"]/g)].map(match => match[1]);
    if (file.endsWith(join('xr', 'XrBackgroundSettings.ts'))) assert.deepEqual(imports, ['../config/xrWormholeTuning']);
    else assert.deepEqual(imports, [], `${file} must not import src/config/`);
  }
  const tuning = readFileSync(join(process.cwd(), 'src', 'config', 'xrWormholeTuning.ts'), 'utf8');
  const tuningImports = [...tuning.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.ok(tuningImports.every(path => path.startsWith('./')), 'the tuning module stays pure config (config-local imports only)');
});

test('only XrAppController reads the shared State store, and only reads it (never writes)', () => {
  const XR_DIR = join(process.cwd(), 'src', 'xr');

  for (const file of walk(XR_DIR)) {
    const source = readFileSync(file, 'utf8');
    const importsState = /from ['"].*\/state\/store['"]/.test(source);
    if (file.endsWith(join('xr', 'XrAppController.ts'))) {
      assert.ok(importsState, 'XrAppController.ts is expected to read published analysis state');
      assert.doesNotMatch(source, /State\.\w+(\.\w+)*\s*=(?!=)/, 'XrAppController.ts must only read State, never write it');
    } else {
      assert.doesNotMatch(source, /from ['"].*\/state\/store['"]/, `${file} must not import the shared State store`);
    }
  }
});

test('only XrAppController prepares the offline automation plan; other XR modules receive plain data', () => {
  for (const file of walk(join(process.cwd(), 'src', 'xr'))) {
    const imports = [...readFileSync(file, 'utf8').matchAll(/from ['"]([^'"]*\/automation\/[^'"]+)['"]/g)].map(match => match[1]);
    if (file.endsWith(join('xr', 'XrAppController.ts'))) assert.deepEqual(imports, ['../automation/prepareWormholePerformance']);
    else assert.deepEqual(imports, [], `${file} must not import src/automation/`);
  }
});

test('WormholeCanvasSource stays a bounded embedded-host adapter that never regenerates the plan', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'visuals', 'WormholeCanvasSource.ts'), 'utf8');
  const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) {
    assert.doesNotMatch(specifier, /^three$|\/(state|ui|audio|xr)\//, `WormholeCanvasSource must not import ${specifier}`);
  }
  assert.ok(!imports.includes('../automation/prepareWormholePerformance'), 'the host facade owns plan preparation');
  assert.doesNotMatch(source, /window\.location/, 'diagnostics are decided by the composition root');
});

test('Three.js is imported only under src/xr/ (ADR-009)', () => {
  const xrDir = join(process.cwd(), 'src', 'xr');
  for (const file of walk(join(process.cwd(), 'src'))) {
    if (file.startsWith(xrDir)) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), /from ['"]three(\/[^'"]*)?['"]/, `${file} must not import three`);
  }
});
