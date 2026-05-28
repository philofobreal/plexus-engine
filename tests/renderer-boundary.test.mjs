import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadRendererBackendModule() {
  const source = readFileSync(join(process.cwd(), 'src/visuals/RendererBackend.ts'), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const context = vm.createContext({ exports: {} });
  vm.runInContext(transpiled, context);
  return context.exports;
}

class MockRendererBackend {
  width = 800;
  height = 600;
  frameCount = 1;
  drawNodeCalls = 0;
  drawLineCalls = 0;
  drawTriangleCalls = 0;
  background() {}
  noStroke() {}
  noFill() {}
  fill() {}
  stroke() {}
  strokeWeight() {}
  line() {
    this.drawLineCalls++;
  }
  circle() {
    this.drawNodeCalls++;
  }
  triangle() {
    this.drawTriangleCalls++;
  }
  beginShape() {}
  vertex() {}
  endShape() {}
  radialGlow() {}
}

test('scene geometry delegates drawing commands through VisualRendererBackend', () => {
  const { drawPlexusSceneGeometry } = loadRendererBackendModule();
  const backend = new MockRendererBackend();
  const a = { x: 0, y: 0, size: 2 };
  const b = { x: 10, y: 0, size: 3 };
  const c = { x: 0, y: 10, size: 4 };

  drawPlexusSceneGeometry(backend, {
    nodes: [a, b, c],
    links: [{ from: a, to: b, alpha: 100, weight: 1 }],
    triangles: [{ a, b, c, alpha: 40 }]
  }, {
    node: [255, 255, 255],
    line: [0, 229, 255],
    triangle: [80, 160, 255]
  });

  assert.equal(backend.drawNodeCalls, 3);
  assert.equal(backend.drawLineCalls, 1);
  assert.equal(backend.drawTriangleCalls, 1);
});
