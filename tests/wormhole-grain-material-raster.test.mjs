import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const MODULE_PATH = join(process.cwd(), 'src', 'visuals', 'wormholeGrainMaterialRaster.ts');

function loadMaterial() {
  const source = readFileSync(MODULE_PATH, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports, Math, Number, Object, Array, Float32Array
  });
  return module.exports;
}

const material = loadMaterial();

function createBuffers(cols = 64, rows = 36) {
  const l1Cols = Math.max(1, Math.round(cols / 3));
  const l1Rows = Math.max(1, Math.round(rows / 3));
  const l2Cols = Math.max(1, Math.round(cols / 8));
  const l2Rows = Math.max(1, Math.round(rows / 8));
  return {
    cols, rows, l1Cols, l1Rows, l2Cols, l2Rows,
    l0: new Float32Array(cols * rows * 4),
    l1: new Float32Array(l1Cols * l1Rows * 4),
    l2: new Float32Array(l2Cols * l2Rows * 4)
  };
}

function baseCarrier(overrides = {}) {
  return {
    headX: 52, headY: 20,
    tailX: 10, tailY: 17,
    alpha: 180,
    strokeWeight: 2.2,
    colorR: 90, colorG: 130, colorB: 255,
    seed: 41.337,
    generation: 3,
    materialPhase: 1.25,
    energy: 0.8,
    ...overrides
  };
}

function renderCarrier(carrier = baseCarrier(), detail = 0.65, amount = 1, bloom = 0.7) {
  const buffers = createBuffers();
  material.clearWormholeGrainMaterialBuffers(buffers.l0, buffers.l1, buffers.l2);
  material.accumulateWormholeGrainCarrier(
    buffers.l0, buffers.cols, buffers.rows, buffers.cols, buffers.rows, carrier, detail
  );
  material.resolveWormholeGrainMaterial(
    buffers.l0, buffers.cols, buffers.rows,
    buffers.l1, buffers.l1Cols, buffers.l1Rows,
    buffers.l2, buffers.l2Cols, buffers.l2Rows,
    amount, bloom
  );
  return buffers;
}

function bytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

test('raster sizing preserves viewport shape and never exceeds the renderer ceiling', () => {
  const out = { cols: 0, rows: 0 };
  for (const [width, height] of [[1920, 1080], [1080, 1920], [1000, 1000], [1, 1], [1, 100000]]) {
    for (const detail of [0, 0.5, 1]) {
      for (const highTier of [false, true]) {
        material.resolveWormholeGrainMaterialRasterSize(width, height, detail, highTier, out);
        assert.ok(out.cols > 0 && out.rows > 0);
        assert.ok(out.cols * out.rows <= material.MAX_GRAIN_MATERIAL_RASTER_PIXELS);
        assert.ok(Math.max(out.cols, out.rows) <= material.MAX_GRAIN_MATERIAL_RASTER_DIMENSION);
        assert.ok(Math.abs(out.cols / out.rows - width / height) < 0.02 || Math.min(width, height) === 1);
      }
    }
  }
});

test('identical carrier inputs are byte-identical across repeated and revisited material phases', () => {
  const first = renderCarrier(baseCarrier({ materialPhase: 8.5 }));
  renderCarrier(baseCarrier({ materialPhase: 19.25 }));
  const revisited = renderCarrier(baseCarrier({ materialPhase: 8.5 }));
  assert.ok(bytes(first.l0).equals(bytes(revisited.l0)));
  assert.ok(bytes(first.l1).equals(bytes(revisited.l1)));
  assert.ok(bytes(first.l2).equals(bytes(revisited.l2)));
});

test('30/60/120 FPS checkpoints are identical when canonical carrier phase is identical', () => {
  const canonicalPosition = 12.8;
  const outputs = [30, 60, 120].map(fps => {
    const checkpointFrame = Math.round(canonicalPosition * fps);
    const phase = checkpointFrame / fps;
    return renderCarrier(baseCarrier({ materialPhase: phase }));
  });
  assert.ok(bytes(outputs[0].l0).equals(bytes(outputs[1].l0)));
  assert.ok(bytes(outputs[0].l0).equals(bytes(outputs[2].l0)));
});

test('nonzero L0 pixels stay inside the declared maximum carrier dilation', () => {
  const carrier = baseCarrier({ tailX: 9, tailY: 18, headX: 55, headY: 18 });
  const { l0, cols, rows } = renderCarrier(carrier, 1, 1, 0);
  let nonzero = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const alpha = l0[(y * cols + x) * 4 + 3];
      if (alpha <= 0) continue;
      nonzero++;
      const distance = distanceToSegment(x + 0.5, y + 0.5, carrier.tailX, carrier.tailY, carrier.headX, carrier.headY);
      assert.ok(
        distance <= material.MAX_GRAIN_MATERIAL_DILATION_PX + 1e-6,
        `pixel (${x},${y}) escaped carrier support: ${distance}`
      );
    }
  }
  assert.ok(nonzero > 0, 'the accepted carrier must produce sharp material pixels');
});

test('generation/phase change breakup without moving support to a second coordinate model', () => {
  const a = renderCarrier(baseCarrier({ generation: 2, materialPhase: 0.25 }), 1, 1, 0);
  const b = renderCarrier(baseCarrier({ generation: 9, materialPhase: 4.75 }), 1, 1, 0);
  assert.ok(!bytes(a.l0).equals(bytes(b.l0)), 'breakup must respond to generation/material phase');

  for (const raster of [a, b]) {
    for (let y = 0; y < raster.rows; y++) {
      for (let x = 0; x < raster.cols; x++) {
        if (raster.l0[(y * raster.cols + x) * 4 + 3] <= 0) continue;
        assert.ok(distanceToSegment(x + 0.5, y + 0.5, 10, 17, 52, 20) <= material.MAX_GRAIN_MATERIAL_DILATION_PX + 1e-6);
      }
    }
  }
});

test('bloom has strict L0 provenance and amount zero resolves every layer to zero', () => {
  const empty = createBuffers();
  material.resolveWormholeGrainMaterial(
    empty.l0, empty.cols, empty.rows,
    empty.l1, empty.l1Cols, empty.l1Rows,
    empty.l2, empty.l2Cols, empty.l2Rows,
    1, 1
  );
  assert.ok(empty.l1.every(value => value === 0));
  assert.ok(empty.l2.every(value => value === 0));

  const zeroAmount = renderCarrier(baseCarrier(), 1, 0, 1);
  assert.ok(zeroAmount.l0.every(value => value === 0));
  assert.ok(zeroAmount.l1.every(value => value === 0));
  assert.ok(zeroAmount.l2.every(value => value === 0));

  const active = renderCarrier(baseCarrier({ alpha: 255, energy: 1 }), 1, 1, 1);
  assert.ok(active.l0.some((value, index) => index % 4 === 3 && value > 0));
  assert.ok(active.l1.some((value, index) => index % 4 === 3 && value > 0));
  assert.ok(active.l2.some((value, index) => index % 4 === 3 && value > 0));
});

test('clear/reuse works and all resolved channels remain finite and bounded', () => {
  const buffers = renderCarrier(baseCarrier({ alpha: Infinity, strokeWeight: Infinity }), 1, 1, 1);
  for (const layer of [buffers.l0, buffers.l1, buffers.l2]) {
    for (const value of layer) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= 0 && value <= 1);
    }
  }
  material.clearWormholeGrainMaterialBuffers(buffers.l0, buffers.l1, buffers.l2);
  assert.ok(buffers.l0.every(value => value === 0));
  assert.ok(buffers.l1.every(value => value === 0));
  assert.ok(buffers.l2.every(value => value === 0));
});

test('pure module has no forbidden geometry/runtime dependency or private raster allocation', () => {
  const source = readFileSync(MODULE_PATH, 'utf8');
  assert.doesNotMatch(source, /from ['"].*(WormholeLensWarp|WormholeGrainField|State|store|p5|audio|analyzer)/);
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|frameCount/);
  assert.doesNotMatch(source, /new\s+(?:Float32Array|ImageData|OffscreenCanvas|HTMLCanvasElement)/);
  assert.doesNotMatch(source, /document\.|drawingContext|getContext\(/);
  assert.match(source, /MAX_GRAIN_MATERIAL_SAMPLES_PER_CARRIER = 48/);
  assert.match(source, /MAX_GRAIN_MATERIAL_DILATION_PX = 3/);
});
