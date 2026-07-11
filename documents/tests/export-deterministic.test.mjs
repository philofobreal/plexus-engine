import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadExportWorker() {
  const raw = readFileSync(join(process.cwd(), 'src/export/export.worker.ts'), 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '')
    .replace('const workerScope = self as unknown as {', 'const workerScope = self as {');
  const source = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const encoders = [];
  class FakeEncoder {
    constructor() { this.encoded = []; encoders.push(this); }
    configure(config) { this.config = config; }
    encode(_frame, options) { this.encoded.push(options); }
    flush() { return Promise.resolve(); }
    close() {}
  }
  const self = { VideoEncoder: FakeEncoder, VideoFrame: class { close() {} }, postMessage() {}, onmessage: null };
  const context = vm.createContext({
    self,
    performance,
    setInterval: () => 1,
    clearInterval() {},
    navigator: { storage: { async getDirectory() { return {
      async *entries() {}, async removeEntry() {},
      async getFileHandle() {
        return { async createSyncAccessHandle() { return { truncate() {}, write() {}, flush() {}, close() {} }; } };
      }
    }; } } },
    WebMMuxer: class { addVideoChunk() {} addAudioChunk() {} enableAudio() {} finalize() { return null; } }
  });
  vm.runInContext(source, context);
  return { self, encoders };
}

async function startWorkerExport(fps, width, height, bitrate) {
  const worker = loadExportWorker();
  worker.self.onmessage({ data: { type: 'start_export', fps, width, height, bitrate } });
  while (!worker.encoders[0]?.config) await new Promise((resolve) => setTimeout(resolve, 0));
  return worker;
}

function loadWebMExporter() {
  const webcodecsRaw = readFileSync(join(process.cwd(), 'src/export/WebCodecsBackend.ts'), 'utf8');
  const exporterRaw = readFileSync(join(process.cwd(), 'src/export/WebMExporter.ts'), 'utf8');
  const webcodecsSource = webcodecsRaw
    .replace("import { State } from '../state/store';", '')
    .replace("import type { ExportBackend } from './ExportBackend';", '')
    .replace("import { ExportBackendRegistry, type ExportBackendFactory } from './ExportBackendRegistry';", '')
    .replace("import type { ExportCapabilities, ExportConfig, ExportWorkerResponse } from './ExportTypes';", '')
    .replace("import ExportWorker from './export.worker.ts?worker';", 'const ExportWorker = FakeWorker;')
    .replace("import type p5 from 'p5';", '')
    .replace(/export const WebCodecsBackendFactory[\s\S]*?ExportBackendRegistry\.register\(WebCodecsBackendFactory\);/, '');
  const exporterStub = `
class ExportBackendRegistry {
  static getPreferred(p5Instance: any, canvas: HTMLCanvasElement, audioEngine: any, trackName: string) {
    return new WebCodecsBackend(p5Instance, canvas, audioEngine, trackName);
  }
}

class ExportCapabilityDetector {
  static async detectCapabilities() {
    return {
      webcodecsSupported: true,
      webcodecsCodecs: { vp9: true, vp8: true },
      canExport4K: true,
      isMobile: false,
      preferredBackend: 'webcodecs',
      warnings: []
    };
  }
}
`;
  const exporterSource = exporterRaw
    .replace("import type { ExportBackend } from './ExportBackend';", '')
    .replace("import type { ExportConfig } from './ExportTypes';", '')
    .replace("import { ExportCapabilityDetector } from './ExportCapabilityDetector';", '')
    .replace("import { ExportBackendRegistry } from './ExportBackendRegistry';", '')
    .replace("import './WebCodecsBackend';", '')
    .replace("export type { ExportConfig } from './ExportTypes';", '');
  const source = webcodecsSource + '\n' + exporterStub + '\n' + exporterSource;

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
      if (message.type === 'encode_frame') {
        this.onmessage?.({ data: { type: 'queue_update', size: 0 } });
      }
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
    FakeWorker,
    ExportWorker: FakeWorker,
    Blob,
    VideoFrame: FakeVideoFrame,
    createImageBitmap: async () => ({
      close() {}
    }),
    window: {
      requestAnimationFrame(callback) {
        events.push(['raf']);
        callback();
        return 1;
      }
    },
    exports: {}
  });
  context.VideoEncoder = class FakeVideoEncoder {};

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
    },
    createGraphics(width, height) {
      calls.push(['createGraphics', width, height]);
      return {
        elt: createMockCanvas(drawnText, calls),
        clear() {
          calls.push(['clearGraphics']);
        },
        remove() {
          calls.push(['removeGraphics']);
        }
      };
    }
  };

  const exporter = new WebMExporter(p5, canvas, { getAudioBuffer: () => null });
  const blob = await exporter.startExport({
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 60,
    trackName: 'Long Deterministic Track Name',
    watermark: true
  }, () => {});

  assert.equal(blob.size, 4);
  assert.equal(State.isExporting, false);
  assert.equal(State.exportTime, 0);
  assert.equal(drawnText.includes('PLEXUS ENGINE'), true);
  assert.equal(drawnText.some((text) => String(text).startsWith('Long Deterministic Track Name')), true);
  assert.equal(drawnText.includes('128 BPM'), true);
  assert.equal(calls.findIndex(([name]) => name === 'noLoop') < calls.findIndex(([name]) => name === 'redraw'), true);
  assert.equal(events.findIndex(([name]) => name === 'raf') < events.findIndex(([name]) => name === 'redraw'), true);
  assert.equal(calls.some(([name]) => name === 'loop'), true);
  assert.equal(calls.findIndex(([name]) => name === 'loop') < calls.findIndex(([name]) => name === 'removeGraphics'), true);
  assert.deepEqual(calls.filter(([name]) => name === 'resizeCanvas'), []);
  assert.deepEqual(calls.filter(([name]) => name === 'createGraphics'), [['createGraphics', 1280, 720]]);
  assert.equal(calls.some(([name]) => name === 'removeGraphics'), true);
});

test('WebMExporter omits metadata card when watermark is disabled', async () => {
  const { WebMExporter } = loadWebMExporter();
  const calls = [];
  const drawnText = [];
  const p5 = {
    width: 320,
    height: 180,
    redraw() {
      calls.push(['redraw']);
    },
    noLoop() {},
    loop() {},
    createGraphics() {
      return {
        elt: createMockCanvas(drawnText, calls),
        clear() {},
        remove() {}
      };
    }
  };

  const exporter = new WebMExporter(p5, createMockCanvas(drawnText, calls), { getAudioBuffer: () => null });
  await exporter.startExport({ resolution: '720p', aspectRatio: '16:9', fps: 60 }, () => {});

  assert.equal(drawnText.includes('PLEXUS ENGINE'), false);
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
    },
    createGraphics(width, height) {
      calls.push(['createGraphics', width, height]);
      return {
        elt: createMockCanvas([], calls),
        clear() {},
        remove() {
          calls.push(['removeGraphics']);
        }
      };
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
  assert.equal(calls.some(([name]) => name === 'loop'), true);
  assert.equal(calls.findIndex(([name]) => name === 'loop') < calls.findIndex(([name]) => name === 'removeGraphics'), true);
  assert.deepEqual(calls.filter(([name]) => name === 'resizeCanvas'), []);
  assert.equal(calls.some(([name]) => name === 'removeGraphics'), true);
});

test('PlexusRenderer does not poll export loop state', () => {
  const renderer = readFileSync(join(process.cwd(), 'src/visuals/PlexusRenderer.ts'), 'utf8');

  assert.doesNotMatch(renderer, /setInterval\(syncExportLoopState/);
  assert.doesNotMatch(renderer, /lastExporting/);
  assert.doesNotMatch(renderer, /syncExportLoopState/);
});

test('export worker configures constant-quality encoding and resolution bitrate floors', async () => {
  for (const [width, height, bitrate] of [
    [960, 720, 8_000_000],
    [1440, 1080, 14_000_000],
    [2880, 2160, 40_000_000],
    [3840, 2160, 40_000_000]
  ]) {
    const { encoders } = await startWorkerExport(60, width, height);
    assert.equal(encoders[0].config.latencyMode, 'quality');
    assert.equal(encoders[0].config.bitrateMode, 'constant');
    assert.equal(encoders[0].config.bitrate, bitrate);
  }
});

test('export worker gives a valid explicit bitrate priority over the resolution fallback', async () => {
  const { encoders } = await startWorkerExport(60, 1920, 1080, 22_000_000);
  assert.equal(encoders[0].config.bitrate, 22_000_000);
});

test('export worker forces the first and every one-second frame as keyframes', async () => {
  for (const fps of [60, 30]) {
    const { self, encoders } = await startWorkerExport(fps, 1280, 720);
    for (let index = 0; index <= fps; index++) {
      await self.onmessage({ data: { type: 'encode_frame', bitmap: { close() {} }, timestampUs: index } });
    }
    const keyframes = encoders[0].encoded
      .map((options, index) => options.keyFrame ? index : -1)
      .filter((index) => index >= 0);
    assert.deepEqual(keyframes, [0, fps]);
  }
});
