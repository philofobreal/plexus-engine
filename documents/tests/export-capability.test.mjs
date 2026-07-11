import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadExportCapabilityModules(overrides = {}) {
  const detectorRaw = readFileSync(join(process.cwd(), 'src/export/ExportCapabilityDetector.ts'), 'utf8');
  const registryRaw = readFileSync(join(process.cwd(), 'src/export/ExportBackendRegistry.ts'), 'utf8');
  const source = `${detectorRaw}\n${registryRaw}`;
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

  class MockCanvasElement {}

  const context = vm.createContext({
    exports: {},
    console,
    window: {
      innerWidth: overrides.innerWidth ?? 1280,
      innerHeight: overrides.innerHeight ?? 720
    },
    navigator: {
      userAgent: overrides.userAgent ?? 'Desktop Chrome',
      maxTouchPoints: overrides.maxTouchPoints ?? 0
    },
    HTMLCanvasElement: MockCanvasElement
  });

  if (overrides.webcodecs !== false) {
    context.window.AudioEncoder = class MockAudioEncoder {};
    context.window.VideoEncoder = class MockVideoEncoder {};
  }

  vm.runInContext(transpiled, context);
  return context.exports;
}

test('ExportCapabilityDetector returns none when WebCodecs are missing', async () => {
  const { ExportCapabilityDetector } = loadExportCapabilityModules({ webcodecs: false });

  const report = await ExportCapabilityDetector.detectCapabilities();

  assert.equal(report.webcodecsSupported, false);
  assert.equal(report.preferredBackend, 'none');
  assert.match(report.warnings.join(' '), /Offline export requires a modern browser \(Safari 16\.4\+ or Chrome 94\+\)\./);
});

test('ExportCapabilityDetector prefers WebCodecs when supported codecs are available', async () => {
  const { ExportCapabilityDetector } = loadExportCapabilityModules();

  const report = await ExportCapabilityDetector.detectCapabilities();

  assert.equal(report.webcodecsSupported, true);
  assert.equal(report.webcodecsCodecs.vp9, true);
  assert.equal(report.webcodecsCodecs.vp8, true);
  assert.equal(report.preferredBackend, 'webcodecs');
});

test('ExportCapabilityDetector disables 4K and emits a warning on mobile', async () => {
  const { ExportCapabilityDetector } = loadExportCapabilityModules({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    maxTouchPoints: 5,
    innerWidth: 390,
    innerHeight: 844
  });

  const report = await ExportCapabilityDetector.detectCapabilities();

  assert.equal(report.isMobile, true);
  assert.equal(report.canExport4K, false);
  assert.match(report.warnings.join(' '), /4K rendering disabled/);
});

test('ExportCapabilityDetector returns none when no backend is available', async () => {
  const { ExportCapabilityDetector } = loadExportCapabilityModules({
    webcodecs: false
  });

  const report = await ExportCapabilityDetector.detectCapabilities();

  assert.equal(report.webcodecsSupported, false);
  assert.equal(report.preferredBackend, 'none');
  assert.match(report.warnings.join(' '), /Offline export requires a modern browser/);
});

test('ExportBackendRegistry selects the backend requested by capabilities', () => {
  const { ExportBackendRegistry } = loadExportCapabilityModules();
  ExportBackendRegistry.clear();
  ExportBackendRegistry.register({
    id: 'webcodecs',
    priority: 100,
    isSupported: (capabilities) => capabilities?.webcodecsSupported === true,
    create: () => ({ id: 'webcodecs' })
  });

  const webcodecs = ExportBackendRegistry.getPreferred(null, {}, null, 'track', {
    webcodecsSupported: true,
    webcodecsCodecs: { vp9: true, vp8: true },
    canExport4K: true,
    isMobile: false,
    preferredBackend: 'webcodecs',
    warnings: []
  });

  assert.equal(webcodecs.id, 'webcodecs');
});

test('ExportBackendRegistry rejects unsupported capability reports', () => {
  const { ExportBackendRegistry } = loadExportCapabilityModules();
  ExportBackendRegistry.clear();

  assert.throws(() => ExportBackendRegistry.getPreferred(null, {}, null, 'track', {
    webcodecsSupported: false,
    webcodecsCodecs: { vp9: false, vp8: false },
    canExport4K: true,
    isMobile: false,
    preferredBackend: 'none',
    warnings: ['No supported browser export backend is available.']
  }), /No supported browser export backend/);
});
