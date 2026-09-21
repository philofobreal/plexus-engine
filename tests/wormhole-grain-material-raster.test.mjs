import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const MODULE_PATH = join(process.cwd(), 'src', 'visuals', 'wormholeGrainMaterialRaster.ts');

function loadMaterial(source = readFileSync(MODULE_PATH, 'utf8')) {
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

test('compact previews keep five bounded detail tiers while exports retain desktop resolution', () => {
  const size = (w, h, detail, exporting, compact) => material.resolveWormholeGrainMaterialRasterSize(w, h, detail, exporting, {}, compact);
  assert.deepEqual(size(1920, 1080, 0, false, true), { cols: 240, rows: 135 });
  assert.deepEqual(size(1920, 1080, 1, false, true), { cols: 320, rows: 180 });
  for (const [width, height] of [[390, 844], [844, 390], [1920, 1080]]) {
    const tiers = new Set();
    for (let i = 0; i <= 600; i++) {
      const detail = i / 600;
      const compact = size(width, height, detail, false, true);
      const desktop = size(width, height, detail, false, false);
      tiers.add(`${compact.cols}x${compact.rows}`);
      assert.ok(compact.cols * compact.rows < desktop.cols * desktop.rows * 0.58);
      assert.ok(Math.abs(compact.cols / compact.rows - width / height) < 0.02);
      assert.deepEqual(size(width, height, detail, true, true), size(width, height, detail, true, false));
    }
    assert.equal(tiers.size, 5);
    const preview = size(width, height, 0.49, false, true);
    size(height, width, 1, true, true);
    assert.deepEqual(size(width, height, 0.51, false, true), preview, 'export/rotation history cannot change the preview tier');
  }
});

// Keep the same material laws but evaluate the original full rectangle as an independent
// coverage oracle. Instrument only this test copy; production has no counters or allocations.
function instrumentedMaterial(exhaustive) {
  let source = readFileSync(MODULE_PATH, 'utf8');
  const rowLoop = 'for (let x = rowMinX; x <= rowMaxX; x++)';
  assert.ok(source.includes(rowLoop));
  if (exhaustive) source = source.replace(rowLoop, 'for (let x = minX; x <= maxX; x++)');
  source = 'export let scanVisits = 0;\n' + source.replace('const relX = x + 0.5 - tailX;', 'scanVisits++; const relX = x + 0.5 - tailX;');
  return loadMaterial(source);
}

test('scanline clipping is byte-identical to exhaustive coverage across angles, caps, clipping and material settings', () => {
  const fast = instrumentedMaterial(false), reference = instrumentedMaterial(true);
  let cases = 0;
  for (const [cols, rows, width, height] of [[128, 72, 128, 72], [72, 128, 1080, 1920], [192, 108, 1920, 1080]]) {
    const a = new Float32Array(cols * rows * 4), b = new Float32Array(a.length);
    for (let i = 0; i < 240; i++) {
      const angle = [0, 1e-9, -1e-9, Math.PI / 2, Math.PI, Math.PI / 4, i * 2.399963][i % 7];
      const length = [0, 1e-8, 0.5, 8, 45, 150, 900][Math.floor(i / 7) % 7];
      const x = [-20, 0, cols / 2, cols + 20][i % 4];
      const y = [-20, 0, rows / 2, rows + 20][Math.floor(i / 4) % 4];
      const carrier = baseCarrier({
        tailX: x * width / cols, tailY: y * height / rows,
        headX: (x + Math.cos(angle) * length) * width / cols,
        headY: (y + Math.sin(angle) * length) * height / rows,
        strokeWeight: [0, 0.25, 2, 30][i % 4], depth: (i % 11) / 10,
        alpha: [0, 1, 180, 255][i % 4], weave: i % 2, seed: i + 0.337,
        materialPhase: i * 0.618, generation: i % 9
      });
      a.fill(0); b.fill(0);
      const args = [cols, rows, width, height, carrier, (i % 13) / 12];
      fast.accumulateWormholeGrainCarrier(a, ...args);
      reference.accumulateWormholeGrainCarrier(b, ...args);
      assert.deepEqual(bytes(a), bytes(b), `coverage mismatch at case ${cases}`);
      cases++;
    }
  }
  assert.equal(cases, 720);
});

test('long diagonal carriers skip most empty samples without changing pixels', () => {
  const fast = instrumentedMaterial(false), reference = instrumentedMaterial(true);
  const a = new Float32Array(192 * 108 * 4), b = new Float32Array(a.length);
  const carrier = baseCarrier({ tailX: 35, tailY: 15, headX: 35 + 100 / Math.SQRT2, headY: 15 + 100 / Math.SQRT2, depth: 0, strokeWeight: 2 });
  const args = [192, 108, 192, 108, carrier, 0.65];
  fast.accumulateWormholeGrainCarrier(a, ...args);
  reference.accumulateWormholeGrainCarrier(b, ...args);
  assert.deepEqual(bytes(a), bytes(b));
  assert.ok(a.some(v => v > 0));
  assert.ok(fast.scanVisits < reference.scanVisits * 0.3, `${fast.scanVisits} vs ${reference.scanVisits}`);
  console.log(`Diagonal pixel candidates: ${reference.scanVisits} -> ${fast.scanVisits}`);
});

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
    depth: 0.3,
    weave: 0,
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

test('continuous detail sweeps use five monotonic raster sizes with unchanged quality endpoints', () => {
  for (const highTier of [false, true]) {
    const sizes = new Set();
    const out = { cols: 0, rows: 0 };
    let previousPixels = 0;
    for (let step = 0; step <= 600; step++) {
      material.resolveWormholeGrainMaterialRasterSize(1920, 1080, step / 600, highTier, out);
      sizes.add(`${out.cols}x${out.rows}`);
      assert.ok(out.cols * out.rows >= previousPixels);
      previousPixels = out.cols * out.rows;
    }
    assert.equal(sizes.size, 5, 'a slider sweep must not resize the backing canvas each frame');
    assert.equal([...sizes][0], highTier ? '480x270' : '320x180');
    assert.equal([...sizes].at(-1), highTier ? '640x360' : '480x270');
  }
});

test('raster tiers are stable within a band and independent of previous detail, aspect, and export requests', () => {
  const out = { cols: 0, rows: 0 };
  material.resolveWormholeGrainMaterialRasterSize(1920, 1080, 0.5, false, out);
  const expected = { ...out };
  for (const detail of [0.46, 0.49, 0.51, 0.54]) {
    material.resolveWormholeGrainMaterialRasterSize(1080, 1920, 1, true, out);
    material.resolveWormholeGrainMaterialRasterSize(1920, 1080, detail, false, out);
    assert.deepEqual(out, expected, 'revisiting a tier must not depend on render history');
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
  assert.match(source, /MAX_GRAIN_MATERIAL_PIXELS_PER_CARRIER = 1024/);
  assert.match(source, /MAX_GRAIN_MATERIAL_DILATION_PX = 6/);
});

// -- depth stratification (spiral material plan S3) ------------------------------------------

function coverage(buffers) {
  let pixels = 0;
  let emission = 0;
  for (let index = 3; index < buffers.l0.length; index += 4) {
    if (buffers.l0[index] > 0) pixels++;
    emission += buffers.l0[index];
  }
  return { pixels, emission };
}

test('a near carrier deposits a wider body than the same carrier at the far plane', () => {
  const near = coverage(renderCarrier(baseCarrier({ depth: 0.05 }), 0.65, 1, 0));
  const far = coverage(renderCarrier(baseCarrier({ depth: 0.95 }), 0.65, 1, 0));
  assert.ok(near.pixels > far.pixels * 1.5,
    `near support ${near.pixels} must clearly exceed far support ${far.pixels}`);
});

test('tunnel extinction makes emission fall monotonically with depth', () => {
  const depths = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const emissions = depths.map(depth => coverage(renderCarrier(baseCarrier({ depth }), 0.65, 1, 0)).emission);
  for (let index = 1; index < emissions.length; index++) {
    assert.ok(emissions[index] <= emissions[index - 1] + 1e-9,
      `emission rose from depth ${depths[index - 1]} to ${depths[index]}`);
  }
  assert.ok(emissions[0] > emissions[emissions.length - 1] * 3, 'the throat must be far dimmer than the near plane');
});

test('a weave carrier is spread and dimmed relative to the grain carrier it connects', () => {
  const grain = coverage(renderCarrier(baseCarrier({ depth: 0.5, weave: 0 }), 0.65, 1, 0));
  const weave = coverage(renderCarrier(baseCarrier({ depth: 0.5, weave: 1 }), 0.65, 1, 0));
  assert.ok(weave.pixels > grain.pixels, 'connective gas covers more area than the grain body');
  assert.ok(weave.emission < grain.emission * 1.6, 'connective gas must not outshine the grains it joins');
});

test('carriers without a depth field are treated as the near plane instead of producing NaN', () => {
  const carrier = baseCarrier();
  delete carrier.depth;
  const buffers = renderCarrier(carrier, 0.65, 1, 0.5);
  for (const value of buffers.l0) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
});
