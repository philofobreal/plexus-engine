import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

test('compact material policy survives compositor targets and resizing without changing the default backend', () => {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = readFileSync(file, 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
      exports,
      require(id) {
        if (id === 'p5') return {};
        if (id === '../state/store') return { State: {} };
        return load(resolve(dirname(file), `${id}.ts`));
      }
    });
    return exports;
  }
  const { P5RendererBackend } = load(resolve('src/visuals/P5RendererBackend.ts'));
  const { P5RenderTargetCompositor } = load(resolve('src/visuals/P5RenderTargetCompositor.ts'));
  const targets = [];
  let density = 2;
  const host = { width: 390, height: 220, pixelDensity: () => density, createGraphics(width, height) {
    const graphics = { width, height, density, densityWrites: 0, clear() {},
      pixelDensity(value) { if (value !== undefined) { this.density = value; this.densityWrites++; } return this.density; },
      resizeCanvas(w, h) { this.width = w; this.height = h; } };
    targets.push(graphics);
    return graphics;
  } };
  assert.equal(new P5RendererBackend(host).compactMaterialPreview, false);
  let compact = true;
  const compositor = new P5RenderTargetCompositor(host, () => compact);
  for (const [w, h] of [[390, 220], [844, 390], [1920, 1080]]) {
    compositor.beginFrame(1, w, h);
    for (const backend of [compositor.outgoingBackend, compositor.incomingBackend]) {
      assert.equal(backend.compactMaterialPreview, true);
      assert.equal(backend.width, w);
      assert.equal(backend.height, h);
    }
  }
  compact = false;
  density = 0.5;
  compositor.beginFrame(2, 2560, 1440);
  for (const target of targets) assert.equal(target.density, 0.5);
  assert.equal(compositor.incomingBackend.compactMaterialPreview, false);
  host.__plexusExportTarget = { pixelDensity: () => 1 };
  compositor.beginFrame(3, 3840, 2160);
  for (const target of targets) {
    assert.equal(target.density, 1);
    assert.equal(target.width, 3840);
  }
  delete host.__plexusExportTarget;
  compositor.beginFrame(4, 2560, 1440);
  compositor.beginFrame(5, 2560, 1440);
  assert.equal(targets.length, 2);
  for (const target of targets) {
    assert.equal(target.density, 0.5);
    assert.equal(target.densityWrites, 3); // No resize/density churn on an unchanged frame.
  }
  const composites = [];
  let transform = [0.5, 0, 0, 0.5, 0, 0];
  let saved;
  host.drawingContext = {
    canvas: { width: 1280, height: 720 },
    save() { saved = transform; }, restore() { transform = saved; },
    setTransform(...args) { transform = args; },
    clearRect(...args) { composites.push(['clear', transform, args]); },
    drawImage(_image, ...args) { composites.push(['draw', transform, args]); }
  };
  compositor.composite(0.5);
  assert.deepEqual(transform, [0.5, 0, 0, 0.5, 0, 0]);
  assert.equal(composites.length, 3);
  for (const [, matrix, rect] of composites) {
    assert.deepEqual(matrix, [1, 0, 0, 1, 0, 0]);
    assert.deepEqual(rect, [0, 0, 1280, 720]);
  }
});
