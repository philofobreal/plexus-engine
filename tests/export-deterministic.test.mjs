import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadWebMExporter() {
  const source = readFileSync(join(process.cwd(), 'src/export/WebMExporter.ts'), 'utf8')
    .replace("import { State } from '../state/store';", '')
    .replace("import ExportWorker from './export.worker.ts?worker';", '');

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

  const State = { duration: 1 / 60, isExporting: false, exportTime: 0, bpm: 128, beatDecay: 0.5 };

  class FakeVideoFrame {
    constructor(canvas, init) {
      this.canvas = canvas;
      this.timestamp = init.timestamp;
    }
    close() {}
  }

  class FakeWorker {
    constructor() {
      this.messages = [];
      this.onmessage = null;
      this.onerror = null;
    }
    postMessage(message) {
      this.messages.push(message);
      if (message.type === 'finalize_export') {
        this.onmessage?.({ data: { type: 'export_done', blob: new Blob(['webm']) } });
      }
    }
    terminate() {
      this.terminated = true;
    }
  }

  const events = [];
  const context = vm.createContext({
    State,
    ExportWorker: FakeWorker,
    Blob,
    VideoFrame: FakeVideoFrame,
    window: {
      requestAnimationFrame(callback) {
        events.push(['raf']);
        callback();
        return 1;
      }
    },
    exports: {}
  });

  vm.runInContext(transpiled, context);
  return { WebMExporter: context.exports.WebMExporter, State, events };
}

function createMockCanvas(drawnText = [], calls = []) {
  const ctx = {
    save() { calls.push(['ctx.save']); },
    restore() { calls.push(['ctx.restore']); },
    beginPath() {},
    roundRect() {},
    rect() {},
    fill() {},
    stroke() {},
    arc() {},
    fillText(text) { drawnText.push(text); },
    measureText(text) { return { width: String(text).length * 8 }; },
    set fillStyle(value) { this._fillStyle = value; },
    set strokeStyle(value) { this._strokeStyle = value; },
    set lineWidth(value) { this._lineWidth = value; },
    set shadowBlur(value) { this._shadowBlur = value; },
    set shadowColor(value) { this._shadowColor = value; },
    set font(value) { this._font = value; },
    set textBaseline(value) { this._textBaseline = value; }
  };
  return { getContext: () => ctx };
}

test('WebMExporter owns p5 loop state without renderer polling', async () => {
  const { WebMExporter, State, events } = loadWebMExporter();
  const calls = [];
  const drawnText = [];
  const canvas = createMockCanvas(drawnText, calls);
  const p5 = {
    width: 320,
    height: 180,
    resizeCanvas(width, height) {
      calls.push(['resizeCanvas', width, height]);
      events.push(['resizeCanvas', width, height]);
      this.width = width;
      this.height = height;
    },
    redraw() {
      calls.push(['redraw']);
      events.push(['redraw']);
    },
    noLoop() {
      calls.push(['noLoop']);
    },
    loop() {
      calls.push(['loop']);
    }
  };

  const exporter = new WebMExporter(p5, canvas, { getAudioBuffer: () => null });
  const blob = await exporter.startExport({
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 60,
    trackName: 'Long Deterministic Track Name'
  }, () => {});

  assert.equal(blob.size, 4);
  assert.equal(State.isExporting, false);
  assert.equal(State.exportTime, 0);
  assert.equal(drawnText.includes('PLEXUS ENGINE'), true);
  assert.equal(drawnText.some((text) => String(text).startsWith('Long Deterministic Track Name')), true);
  assert.equal(drawnText.includes('128 BPM'), true);
  assert.equal(calls.findIndex(([name]) => name === 'noLoop') < calls.findIndex(([name]) => name === 'redraw'), true);
  assert.equal(events.findIndex(([name]) => name === 'resizeCanvas') < events.findIndex(([name]) => name === 'raf'), true);
  assert.equal(events.findIndex(([name]) => name === 'raf') < events.findIndex(([name]) => name === 'redraw'), true);
  assert.equal(calls.at(-1)[0], 'loop');
  assert.deepEqual(calls.filter(([name]) => name === 'resizeCanvas'), [
    ['resizeCanvas', 1280, 720],
    ['resizeCanvas', 320, 180]
  ]);
});

test('WebMExporter stopAndSave finalizes a partial WebM blob', async () => {
  const { WebMExporter, State } = loadWebMExporter();
  State.duration = 1;
  const calls = [];
  const p5 = {
    width: 320,
    height: 180,
    resizeCanvas(width, height) {
      calls.push(['resizeCanvas', width, height]);
      this.width = width;
      this.height = height;
    },
    redraw() {
      calls.push(['redraw']);
    },
    noLoop() {
      calls.push(['noLoop']);
    },
    loop() {
      calls.push(['loop']);
    }
  };

  const exporter = new WebMExporter(p5, createMockCanvas(), { getAudioBuffer: () => null });
  let progressCalls = 0;
  const blob = await exporter.startExport({ resolution: '720p', aspectRatio: '16:9', fps: 60 }, () => {
    progressCalls++;
    exporter.stopAndSave();
  });

  assert.equal(blob.size, 4);
  assert.equal(progressCalls, 2);
  assert.equal(calls.filter(([name]) => name === 'redraw').length < 60, true);
  assert.equal(calls.at(-1)[0], 'loop');
});

test('PlexusRenderer does not poll export loop state', () => {
  const renderer = readFileSync(join(process.cwd(), 'src/visuals/PlexusRenderer.ts'), 'utf8');

  assert.doesNotMatch(renderer, /setInterval\(syncExportLoopState/);
  assert.doesNotMatch(renderer, /lastExporting/);
  assert.doesNotMatch(renderer, /syncExportLoopState/);
});
