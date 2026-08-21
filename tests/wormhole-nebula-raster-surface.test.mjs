import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Retained W4 renderer primitive + owned buffer surface validation for the corrected foreground
// grain-material architecture gate. The renderer stays unaware of wormholes and grain semantics.

const SRC_ROOT = join(process.cwd(), 'src');

function createLoader() {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module);
    const resolve = request => {
      const base = normalize(join(dirname(path), request));
      return load(base.endsWith('.ts') ? base : `${base}.ts`);
    };
    vm.runInNewContext(output, {
      module, exports: module.exports, require: resolve,
      Math, Number, Object, Array, Map, Set, Float32Array, Uint8ClampedArray,
      // CanvasFieldRasterSurface's default canvas factory only runs when no factory is injected
      // (P5RendererBackend's own `new CanvasFieldRasterSurface()`); stub it here so that path is
      // exercised too, the same way a real browser's `document.createElement('canvas')` would be.
      document: { createElement: () => createMockCanvas(0, 0) }
    });
    return module.exports;
  }
  return relative => load(join(SRC_ROOT, relative));
}

/** A minimal fake CanvasRenderingContext2D-ish object, following the mock pattern already used by
 *  tests/postfx-fragmentation.test.mjs (createMockCanvas) and tests/wormhole-ring-tint.test.mjs
 *  (the hand-rolled `context` object passed to P5RendererBackend). No jsdom is used anywhere in
 *  this repo's test suite, so this mirrors the established pattern rather than inventing a new one. */
function createMockCanvas(width, height) {
  let imageData = null;
  const ctx = {
    canvas: null,
    imageSmoothingEnabled: false,
    _operation: 'source-over',
    ops: [],
    get globalCompositeOperation() { return this._operation; },
    set globalCompositeOperation(value) { this._operation = value; this.ops.push(['setCompositeOperation', value]); },
    save() { this.ops.push(['save']); },
    restore() { this.ops.push(['restore']); },
    createImageData(w, h) {
      imageData = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      this.ops.push(['createImageData', w, h]);
      return imageData;
    },
    putImageData(data, x, y) {
      this.ops.push(['putImageData', data, x, y]);
    },
    drawImage(...args) {
      this.ops.push(['drawImage', ...args]);
    }
  };
  const canvas = {
    width,
    height,
    getContext: () => ctx
  };
  ctx.canvas = canvas;
  return canvas;
}

function loadSurface() {
  const load = createLoader();
  return load('visuals/CanvasFieldRasterSurface.ts');
}

test('a fresh surface allocates nothing until first beginFieldRaster call, per layer', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  let factoryCalls = 0;
  const surface = new CanvasFieldRasterSurface(() => { factoryCalls++; return createMockCanvas(0, 0); });

  for (const layer of [0, 1, 2]) {
    assert.equal(surface.bufferAllocationCount(layer), 0);
    assert.equal(surface.bufferResizeCount(layer), 0);
  }
  assert.equal(factoryCalls, 0, 'constructing the surface must not touch the canvas factory');

  const buffer = surface.beginFieldRaster(0, 8, 4);
  assert.ok(buffer instanceof Float32Array);
  assert.equal(buffer.length, 8 * 4 * 4);
  assert.equal(surface.bufferAllocationCount(0), 1);
  assert.equal(surface.bufferResizeCount(0), 1, 'the first sizing counts as a resize too');
  assert.equal(factoryCalls, 1);

  // Layers never touched stay untouched.
  assert.equal(surface.bufferAllocationCount(1), 0);
  assert.equal(surface.bufferAllocationCount(2), 0);
});

test('the same buffer object is reused across frames at unchanged dimensions, resize only on real change', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));

  const first = surface.beginFieldRaster(0, 16, 9);
  for (let i = 0; i < 60; i++) {
    const buffer = surface.beginFieldRaster(0, 16, 9);
    assert.equal(buffer, first, 'unchanged dimensions must return the same reused buffer object');
  }
  assert.equal(surface.bufferAllocationCount(0), 1, 'no per-frame allocation');
  assert.equal(surface.bufferResizeCount(0), 1, 'no per-frame resize when dimensions are unchanged');

  const resized = surface.beginFieldRaster(0, 32, 18);
  assert.notEqual(resized, first, 'a real dimension change must produce a new buffer');
  assert.equal(surface.bufferAllocationCount(0), 1, 'resize reuses the same lifecycle slot, not a second independent allocation event');
  assert.equal(surface.bufferResizeCount(0), 2);

  surface.beginFieldRaster(0, 32, 18);
  assert.equal(surface.bufferResizeCount(0), 2, 'calling again with identical dimensions must not bump the resize counter');
});

test('an oversized request (> 640*360 px) is refused and allocates nothing', () => {
  const { CanvasFieldRasterSurface, MAX_FIELD_RASTER_PIXELS } = loadSurface();
  assert.equal(MAX_FIELD_RASTER_PIXELS, 640 * 360);
  let factoryCalls = 0;
  const surface = new CanvasFieldRasterSurface(() => { factoryCalls++; return createMockCanvas(0, 0); });

  assert.equal(surface.beginFieldRaster(0, 641, 360), null, 'one pixel over the cap must be refused');
  assert.equal(surface.beginFieldRaster(1, 1000, 1000), null);
  assert.equal(factoryCalls, 0);
  assert.equal(surface.bufferAllocationCount(0), 0);
  assert.equal(surface.bufferAllocationCount(1), 0);

  // Exactly at the cap must succeed.
  assert.ok(surface.beginFieldRaster(2, 640, 360) instanceof Float32Array);
  assert.equal(surface.bufferAllocationCount(2), 1);
});

test('malformed size requests (zero, negative, non-finite) are refused without allocating', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  let factoryCalls = 0;
  const surface = new CanvasFieldRasterSurface(() => { factoryCalls++; return createMockCanvas(0, 0); });

  assert.equal(surface.beginFieldRaster(0, 0, 10), null);
  assert.equal(surface.beginFieldRaster(0, 10, 0), null);
  assert.equal(surface.beginFieldRaster(0, -4, 10), null);
  assert.equal(surface.beginFieldRaster(0, NaN, 10), null);
  assert.equal(surface.beginFieldRaster(0, Infinity, 10), null);
  assert.equal(factoryCalls, 0);
  assert.equal(surface.bufferAllocationCount(0), 0);
});

test('the three layers are fully independent: filling/resizing layer 0 does not touch layer 1/2', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));

  const layer1First = surface.beginFieldRaster(1, 4, 4);
  const layer2First = surface.beginFieldRaster(2, 5, 5);

  for (let i = 0; i < 5; i++) {
    surface.beginFieldRaster(0, 100 + i, 50 + i); // layer 0 resizes every call
  }

  assert.equal(surface.bufferAllocationCount(0), 1);
  assert.equal(surface.bufferResizeCount(0), 5);
  assert.equal(surface.bufferAllocationCount(1), 1);
  assert.equal(surface.bufferResizeCount(1), 1, 'layer 1 must be unaffected by layer 0 churn');
  assert.equal(surface.bufferAllocationCount(2), 1);
  assert.equal(surface.bufferResizeCount(2), 1, 'layer 2 must be unaffected by layer 0 churn');

  assert.equal(surface.beginFieldRaster(1, 4, 4), layer1First, 'layer 1 buffer identity must survive layer 0 activity');
  assert.equal(surface.beginFieldRaster(2, 5, 5), layer2First, 'layer 2 buffer identity must survive layer 0 activity');
});

test('drawFieldRaster restores globalCompositeOperation to source-over and leaves no dirty transform/fillStyle state', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));
  const buffer = surface.beginFieldRaster(0, 2, 2);
  buffer.fill(0.5);

  const target = createMockCanvas(200, 100);
  const targetCtx = target.getContext('2d');
  targetCtx.fillStyle = 'sentinel';

  surface.drawFieldRaster(0, targetCtx, 10, 20, 80, 40, 1, 'screen');

  assert.equal(targetCtx.globalCompositeOperation, 'source-over', 'must restore to source-over after the blend');
  assert.equal(targetCtx.fillStyle, 'sentinel', 'must not touch fillStyle');
  assert.deepEqual(targetCtx.ops[0], ['save']);
  assert.ok(targetCtx.ops.some(op => op[0] === 'setCompositeOperation' && op[1] === 'screen'));
  assert.ok(targetCtx.ops.some(op => op[0] === 'restore'));
  const drawImageOp = targetCtx.ops.find(op => op[0] === 'drawImage');
  assert.ok(drawImageOp, 'must blit via drawImage');
  // [op, srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh]
  assert.deepEqual(drawImageOp.slice(2), [0, 0, 2, 2, 10, 20, 80, 40], 'source rect must be the exact layer size, dest rect must be the requested rect');
  assert.equal(typeof drawImageOp[1].getContext, 'function', 'must blit from the layer-owned offscreen canvas');
  assert.equal(targetCtx.imageSmoothingEnabled, true, 'the bilinear upscale during drawImage is the bloom blur');
});

test('drawFieldRaster restores source-over even when a mid-blit call throws', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));
  surface.beginFieldRaster(0, 2, 2);

  const target = createMockCanvas(50, 50);
  const targetCtx = target.getContext('2d');
  targetCtx.drawImage = () => { throw new Error('boom'); };

  assert.throws(() => surface.drawFieldRaster(0, targetCtx, 0, 0, 50, 50, 1, 'lighter'), /boom/);
  assert.equal(targetCtx.globalCompositeOperation, 'source-over', 'restore-to-source-over must survive a throwing drawImage');
});

test('drawFieldRaster clamps out-of-range gain and malformed color data with no throw and no NaN pixels', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  // putImageData runs on the layer's own offscreen canvas, not the destination - capture it via
  // the injected factory so the test can inspect the actual converted pixels.
  let layerCanvas = null;
  const surface = new CanvasFieldRasterSurface(() => { layerCanvas = createMockCanvas(0, 0); return layerCanvas; });
  const buffer = surface.beginFieldRaster(0, 2, 2);
  // Malformed source channel data: NaN, +-Infinity, out-of-[0,1]-range values.
  buffer.set([NaN, Infinity, -Infinity, 2.5, -1, 0.5, 100, -100, NaN, NaN, NaN, NaN, 0, 0, 0, 1]);

  const target = createMockCanvas(20, 20);
  const targetCtx = target.getContext('2d');
  const layerCtx = layerCanvas.getContext('2d');

  assert.doesNotThrow(() => surface.drawFieldRaster(0, targetCtx, 0, 0, 20, 20, NaN, 'source-over'));
  assert.doesNotThrow(() => surface.drawFieldRaster(0, targetCtx, 0, 0, 20, 20, Infinity, 'screen'));
  assert.doesNotThrow(() => surface.drawFieldRaster(0, targetCtx, 0, 0, 20, 20, -50, 'screen'));

  const putOps = layerCtx.ops.filter(op => op[0] === 'putImageData');
  assert.ok(putOps.length > 0, 'the gain-scaled conversion must reach the layer canvas via putImageData');
  for (const op of putOps) {
    const pixels = op[1].data;
    for (let i = 0; i < pixels.length; i++) {
      assert.ok(Number.isFinite(pixels[i]), 'no NaN/Infinity may reach the pixel buffer');
      assert.ok(pixels[i] >= 0 && pixels[i] <= 255, 'pixels must stay in the 8-bit range');
    }
  }
});

test('an unfilled layer (beginFieldRaster never called) is a silent no-op blit, and an invalid blend falls back to source-over', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));
  const target = createMockCanvas(20, 20);
  const targetCtx = target.getContext('2d');

  assert.doesNotThrow(() => surface.drawFieldRaster(1, targetCtx, 0, 0, 20, 20, 1, 'screen'));
  assert.equal(targetCtx.ops.length, 0, 'a never-began layer must not touch the target context at all');

  surface.beginFieldRaster(0, 2, 2);
  // Deliberately malformed blend value (not one of the three allowed modes) for the
  // defensive-fallback assertion; JS has no compile-time enum enforcement.
  surface.drawFieldRaster(0, targetCtx, 0, 0, 20, 20, 1, 'multiply');
  assert.equal(targetCtx.globalCompositeOperation, 'source-over');
  const compositeOps = targetCtx.ops.filter(op => op[0] === 'setCompositeOperation');
  assert.ok(compositeOps.every(op => op[1] === 'source-over'), 'an invalid blend must never reach the real context as-is');
});

test('degenerate destination rects (zero/negative/non-finite width, height, or origin) are refused without a throw', () => {
  const { CanvasFieldRasterSurface } = loadSurface();
  const surface = new CanvasFieldRasterSurface(() => createMockCanvas(0, 0));
  surface.beginFieldRaster(0, 2, 2);
  const target = createMockCanvas(20, 20);
  const targetCtx = target.getContext('2d');

  for (const [dstX, dstY, dstW, dstH] of [
    [0, 0, 0, 10],
    [0, 0, 10, 0],
    [0, 0, -5, 10],
    [NaN, 0, 10, 10],
    [0, Infinity, 10, 10]
  ]) {
    targetCtx.ops.length = 0;
    assert.doesNotThrow(() => surface.drawFieldRaster(0, targetCtx, dstX, dstY, dstW, dstH, 1, 'source-over'));
    assert.equal(targetCtx.ops.length, 0, `degenerate rect [${dstX},${dstY},${dstW},${dstH}] must not touch the target context`);
  }
});

test('RendererBackend interface exposes the two new field-raster primitives with the exact pinned signature shape', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals', 'RendererBackend.ts'), 'utf8');
  assert.match(source, /beginFieldRaster\(layer: 0 \| 1 \| 2, cols: number, rows: number\): Float32Array \| null;/);
  assert.match(source, /drawFieldRaster\(/);
  assert.match(source, /blend: FieldRasterBlendMode/);
  assert.match(source, /export type FieldRasterBlendMode = 'source-over' \| 'screen' \| 'lighter';/);
});

test('P5RendererBackend delegates field-raster bookkeeping to CanvasFieldRasterSurface (thin adapter, no inline buffers)', () => {
  const source = readFileSync(join(SRC_ROOT, 'visuals', 'P5RendererBackend.ts'), 'utf8');
  assert.match(source, /import \{ CanvasFieldRasterSurface \} from '\.\/CanvasFieldRasterSurface';/);
  assert.match(source, /new CanvasFieldRasterSurface\(\)/);
  assert.doesNotMatch(source, /new Float32Array/, 'P5RendererBackend must not allocate field buffers inline');
});

test('P5RendererBackend.beginFieldRaster/drawFieldRaster round-trip through a real instance', () => {
  const load = createLoader();
  const source = readFileSync(join(SRC_ROOT, 'visuals', 'P5RendererBackend.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const State = { videoBackplateActive: false, visualTuning: { chromaKeyMode: 0 } };
  const { CanvasFieldRasterSurface } = load('visuals/CanvasFieldRasterSurface.ts');
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(request) {
      if (request === 'p5') return { default: class MockP5 {} };
      if (request === '../state/store') return { State };
      if (request === './CanvasFieldRasterSurface') return { CanvasFieldRasterSurface };
      throw new Error(`Unexpected import: ${request}`);
    },
    Math, Number, Float32Array, Uint8ClampedArray
  });

  const target = createMockCanvas(64, 64);
  const host = { width: 64, height: 64, frameCount: 1, drawingContext: target.getContext('2d') };
  const { P5RendererBackend } = module.exports;
  const backend = new P5RendererBackend(host);

  const buffer = backend.beginFieldRaster(0, 4, 4);
  assert.ok(buffer instanceof Float32Array);
  buffer.fill(0.4);
  backend.drawFieldRaster(0, 0, 0, 64, 64, 1, 'source-over');

  const ctx = target.getContext('2d');
  assert.ok(ctx.ops.some(op => op[0] === 'drawImage'));
  assert.equal(ctx.globalCompositeOperation, 'source-over');
});
