import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Exercise the production setup/resize callbacks. Like p5 2, createCanvas replaces the
// renderer and resets density; graphics created afterwards inherit the parent's density.
function startHost({ dpr, width, height, options }) {
  const drawBoundary = new Error('Stop after preview policy application');
  let p;
  let exported;
  let resizeObserver;
  const graphics = [];
  class Empty { constructor() { this.items = []; } syncMode() { throw drawBoundary; } }
  class FakeP5 {
    constructor(sketch) {
      p = this;
      this.windowWidth = width;
      this.windowHeight = height;
      this.width = this.height = 100;
      this.density = Math.ceil(dpr);
      this.canvas = {};
      sketch(this);
      this.setup();
    }
    resizeCanvas(w, h) {
      this.width = w;
      this.height = h;
      this.canvas.width = Math.floor(w * this.density);
      this.canvas.height = Math.floor(h * this.density);
    }
    pixelDensity(value) {
      if (value === undefined) return this.density;
      this.density = value;
      this.resizeCanvas(this.width, this.height);
    }
    createCanvas(w, h) {
      this.density = Math.ceil(dpr);
      this.resizeCanvas(w, h);
      return { elt: this.canvas, parent() {} };
    }
    createGraphics(w, h) {
      const target = { width: w, height: h, density: this.density };
      graphics.push(target);
      return target;
    }
    frameRate() {}
  }
  function load(path) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, {
      exports,
      window: { devicePixelRatio: dpr },
      document: { getElementById: () => ({}) },
      ResizeObserver: class { constructor(callback) { resizeObserver = callback; } observe() {} },
      require(id) {
        if (id === 'p5') return FakeP5;
        if (id === '../state/store') return { State: { visualMode: 'cosmic-wormhole', isExporting: false } };
        if (id === './P5RenderTargetCompositor') return load('src/visuals/P5RenderTargetCompositor.ts');
        if (id === './PausedPreviewGate') return load('src/visuals/PausedPreviewGate.ts');
        return new Proxy({}, { get: () => Empty });
      }
    });
    return exports;
  }
  load('src/visuals/PlexusRenderer.ts').startPlexusRenderer('preview', {
    updateDashboard() {},
    setExportTarget(instance, canvas) {
      exported = { density: instance.pixelDensity(), width: canvas.width, height: canvas.height };
    }
  }, { addPositionChangedListener() {}, addPlaybackEndedListener() {}, getCurrentTime: () => 0 }, {}, undefined, options);
  return { p, exported, graphics, notifyResize: () => resizeObserver(),
    advancePolicy: () => assert.throws(() => p.draw(), error => error === drawBoundary) };
}

for (const fixture of [
  { name: 'compact DPR cap', dpr: 3, width: 390, height: 844, options: { pixelRatioCap: 1.25, maxBackingLongEdge: 1280 }, expected: 1.25 },
  { name: 'desktop long-edge cap', dpr: 2, width: 2560, height: 1440, options: { pixelRatioCap: 2, maxBackingLongEdge: 1920 }, expected: 0.75 },
  { name: 'fractional device density', dpr: 1.5, width: 1000, height: 600, options: { pixelRatioCap: 2 }, expected: 1.5 },
  { name: 'absolute cap alone', dpr: 3, width: 1920, height: 1080, options: { maxBackingLongEdge: 1280 }, expected: 1280 / 1920 },
  { name: 'DPR 1 stays native', dpr: 1, width: 390, height: 844, options: { pixelRatioCap: 1.25, maxBackingLongEdge: 1280 }, expected: 1 },
  { name: 'unspecified policy preserves p5 default', dpr: 1.5, width: 1000, height: 600, expected: 2 }
]) {
  test(`first-frame canvas and transition targets: ${fixture.name}`, () => {
    const { p, exported, graphics } = startHost(fixture);
    assert.equal(exported.density, fixture.expected);
    assert.equal(exported.width, Math.floor(fixture.width * fixture.expected));
    assert.equal(exported.height, Math.floor(fixture.height * fixture.expected));
    assert.equal(p.width, fixture.width);
    assert.equal(p.height, fixture.height);
    assert.equal(graphics.length, 2);
    for (const target of graphics) assert.equal(target.density, fixture.expected);
  });
}

test('main surface re-applies the cap on window resize', () => {
  const { p } = startHost({ dpr: 2, width: 1280, height: 720,
    options: { pixelRatioCap: 2, maxBackingLongEdge: 1920 } });
  p.windowWidth = 3840;
  p.windowHeight = 2160;
  p.windowResized();
  assert.equal(p.pixelDensity(), 0.5);
  assert.equal(p.canvas.width, 1920);
  assert.equal(p.canvas.height, 1080);
});

test('MVP applies the initial container size and follows its ResizeObserver', () => {
  let size = { width: 390, height: 220 };
  const { p, exported, notifyResize } = startHost({ dpr: 3, width: 800, height: 900,
    options: { pixelRatioCap: 1.25, maxBackingLongEdge: 1280, getPreviewSize: () => size } });
  assert.equal(exported.width, 487);
  assert.equal(exported.height, 275);
  size = { width: 1600, height: 900 };
  notifyResize();
  assert.equal(p.pixelDensity(), 0.8);
  assert.equal(p.canvas.width, 1280);
  assert.equal(p.canvas.height, 720);
  size = { width: 390, height: 220 };
  notifyResize();
  assert.equal(p.pixelDensity(), 1.25);
});

test('live quality changes apply on the next draw without resizing CSS or reloading', () => {
  const preference = { pixelRatioCap: 2, maxBackingLongEdge: 1920, compactMaterialPreview: false };
  const { p, advancePolicy } = startHost({ dpr: 2, width: 1920, height: 1080,
    options: { previewQuality: preference } });
  assert.equal(p.canvas.width, 1920);
  preference.pixelRatioCap = 1.25;
  preference.maxBackingLongEdge = 1280;
  preference.compactMaterialPreview = true;
  advancePolicy();
  assert.equal(p.canvas.width, 1280);
  assert.equal(p.canvas.height, 720);
  assert.equal(p.width, 1920);
  assert.equal(p.height, 1080);
  preference.pixelRatioCap = 2;
  preference.maxBackingLongEdge = 1920;
  advancePolicy();
  assert.equal(p.canvas.width, 1920);
});
