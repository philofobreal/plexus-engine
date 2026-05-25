import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const normalizePayload = (payload) => JSON.parse(JSON.stringify(payload));

function runAnalyzerWorker(samples, sampleRate = 44_100) {
  const workerSource = read('src/audio/analyzer.worker.ts');
  const transpiled = ts.transpileModule(workerSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const messages = [];
  const self = {
    onmessage: undefined,
    postMessage(message) {
      messages.push(message);
    }
  };
  const context = vm.createContext({
    self,
    exports: {},
    Float32Array,
    Math
  });

  vm.runInContext(transpiled, context);
  assert.equal(typeof self.onmessage, 'function');
  self.onmessage({
    data: {
      requestId: 42,
      algorithmVersion: 2,
      samples: samples.buffer,
      sampleRate
    }
  });

  assert.equal(messages.length, 1);
  return messages[0];
}

test('worker contract includes request id, hop size, success, and error messages', () => {
  const types = read('src/types/index.ts');
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(types, /export interface AnalysisRequest[\s\S]*requestId: number;/);
  assert.match(types, /export interface AnalysisResult[\s\S]*requestId: number;[\s\S]*hopSize: number;/);
  assert.match(types, /export interface AnalysisResult[\s\S]*trackAnalysis: TrackAnalysis;/);
  assert.match(types, /export interface TrackAnalysis[\s\S]*sections: TrackSection\[\];[\s\S]*patterns: MusicPattern\[\];[\s\S]*cues: VisualCueEvent\[\];[\s\S]*features: VisualFeatureFrame\[\];/);
  assert.match(types, /export interface AnalysisErrorMessage[\s\S]*errorCode: string;[\s\S]*message: string;/);
  assert.match(worker, /type:\s*'analysis_done'/);
  assert.match(worker, /type:\s*'analysis_error'/);
});

test('visual track analysis is precomputed and exposed through shared state', () => {
  const worker = read('src/audio/analyzer.worker.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const store = read('src/state/store.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');

  assert.match(worker, /const trackAnalysis: TrackAnalysis = \{/);
  assert.match(worker, /significantMoments/);
  assert.match(worker, /kind: VisualCueKind/);
  assert.match(worker, /const windowMultiplier = new Float32Array\(N\)/);
  assert.match(worker, /windowMultiplier\[i\] = 0\.5 \* \(1 - Math\.cos/);
  assert.match(worker, /function processFFT\(real: Float32Array, imag: Float32Array\)/);
  assert.match(worker, /let tonalFactor = 1\.0 - Math\.min\(1\.0, flatness \* 1\.8\)/);
  assert.match(worker, /let noiseFactor = Math\.min\(1\.0, flatness \* 2\.5\)/);
  assert.match(audio, /ANALYSIS_ALGORITHM_VERSION = 2/);
  assert.match(audio, /State\.trackAnalysis = e\.data\.trackAnalysis/);
  assert.match(store, /currentFeatures/);
  assert.match(renderer, /State\.trackAnalysis\.cues/);
  assert.match(renderer, /State\.trackAnalysis\.features/);
});

test('visual track analysis detects recurring temporal patterns', () => {
  const types = read('src/types/index.ts');
  const worker = read('src/audio/analyzer.worker.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(types, /export interface MusicPattern[\s\S]*occurrences: PatternOccurrence\[\];/);
  assert.match(types, /export type VisualCueKind = [\s\S]*'pattern'/);
  assert.match(worker, /let patternGroups: Record<string,/);
  assert.match(worker, /let sig = `\$\{section\.label\}:\$\{section\.dominantFeature\}:e\$\{Math\.floor\(section\.energy\*4\)\}:d\$\{Math\.floor\(section\.density\*4\)\}`/);
  assert.match(worker, /let musicPatterns: MusicPattern\[\]/);
  assert.match(worker, /addCue\(frameIdx,\s*'pattern'/);
  assert.match(renderer, /kind === 'pattern'/);
  assert.match(temporal, /function getPatternResonance\(time: number\)/);
});

test('visual mode selector preserves classic mode and exposes temporal mode', () => {
  const types = read('src/types/index.ts');
  const state = read('src/state/store.ts');
  const main = read('src/main.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(types, /export type VisualMode = 'classic' \| 'temporal'/);
  assert.match(state, /visualMode: 'classic' as VisualMode/);
  assert.match(main, /id="visual-mode"/);
  assert.match(ui, /State\.visualMode = mode === 'temporal' \? 'temporal' : 'classic'/);
  assert.match(renderer, /State\.visualMode === 'temporal'/);
  assert.match(renderer, /drawTemporalMusicEffect/);
  assert.match(renderer, /drawClassicPlexusEffect/);
  assert.match(classic, /function drawPolygonalNetwork/);
  assert.match(temporal, /function drawTemporalPolygonNetwork/);
  assert.match(temporal, /function drawMechanismRing/);
  assert.doesNotMatch(temporal, /drawPatternTimeline/);
  assert.doesNotMatch(temporal, /drawMelodicFilaments/);
  assert.doesNotMatch(temporal, /drawVocalPresence/);
});

test('visual effects expose live tuning controls and copyable config', () => {
  const types = read('src/types/index.ts');
  const config = read('src/config/visualTuning.ts');
  const state = read('src/state/store.ts');
  const main = read('src/main.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');
  const particle = read('src/visuals/Particle.ts');
  const shockwave = read('src/visuals/Shockwave.ts');

  assert.match(types, /export interface VisualTuningConfig/);
  assert.match(config, /export const defaultVisualTuning: VisualTuningConfig/);
  assert.match(config, /export const visualTuningControls: VisualTuningControl\[\]/);
  assert.match(config, /normalizeVisualTuningConfig/);
  assert.match(state, /visualTuning: cloneDefaultVisualTuning\(\)/);
  assert.match(main, /id="toggle-tuning-panel"/);
  assert.match(main, /id="visual-preset-list"/);
  assert.match(main, /id="visual-tuning-controls"/);
  assert.match(main, /id="copy-visual-config"/);
  assert.match(ui, /data-tuning-key="\$\{control\.key\}"/);
  assert.match(ui, /State\.visualTuning\[key\] = value/);
  assert.match(ui, /loadVisualPresetList/);
  assert.match(ui, /loadVisualPreset\(fileName/);
  assert.match(ui, /syncVisualTuningControls/);
  assert.match(ui, /navigator\.clipboard\?\.writeText/);
  assert.match(classic, /State\.visualTuning\.lineDistance/);
  assert.match(classic, /State\.visualTuning\.polygonAlpha/);
  assert.match(temporal, /State\.visualTuning\.temporalRingSize/);
  assert.match(temporal, /State\.visualTuning\.temporalPolygonAlpha/);
  assert.match(particle, /State\.visualTuning\.particleEnergySpeed/);
  assert.match(shockwave, /State\.visualTuning\.shockwaveSpeed/);
});

test('visual tuning presets are read from public json files and remain backward compatible', () => {
  const manifest = JSON.parse(read('public/visual-tuning-presets/index.json'));
  const preset = JSON.parse(read('public/visual-tuning-presets/default.json'));
  const config = read('src/config/visualTuning.ts');
  const ui = read('src/ui/DashboardUI.ts');

  assert.ok(Array.isArray(manifest.presets));
  assert.ok(manifest.presets.includes('default.json'));
  assert.ok(preset.visualTuning);
  assert.match(config, /const next = cloneDefaultVisualTuning\(\)/);
  assert.match(config, /source\?\.\[key\]/);
  assert.match(ui, /visual-tuning-presets\/\$\{encodeURIComponent\(fileName\)\}/);
  assert.match(ui, /Object\.assign\(State\.visualTuning, normalizeVisualTuningConfig/);
});

test('visual tuning controls cover circle, line, polygon, particle, and temporal parameters', () => {
  const config = read('src/config/visualTuning.ts');

  for (const key of [
    'backgroundRed',
    'backgroundGreen',
    'backgroundBlue',
    'circleHue',
    'circleAlpha',
    'circleSize',
    'shockwaveSpeed',
    'shockwaveThickness',
    'lineHue',
    'lineAlpha',
    'lineWeight',
    'polygonHue',
    'polygonAlpha',
    'polygonSize',
    'particleEnergySpeed',
    'temporalRingSpeed',
    'temporalNetworkDistance'
  ]) {
    assert.match(config, new RegExp(`key: '${key}'`));
  }
});

test('analysis thresholds match the V0.2 macro-dynamics ACs', () => {
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(worker, /energyRatio\s*>=\s*0\.45\s*\?\s*'HIGH'\s*:\s*'LOW'/);
  assert.match(worker, /sE\s*<\s*0\.35/);
  assert.match(worker, /sE\s*>\s*0\.95/);
  assert.match(worker, /blockFrames\s*=\s*Math\.floor\(\(secondsPerBeat\s*\*\s*16\)\s*\*\s*sampleRate\s*\/\s*hopSize\)/);
});

test('analysis worker uses spectral FFT features instead of legacy crossover filters', () => {
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(worker, /const N = hopSize/);
  assert.match(worker, /let prevMag = new Float32Array\(N \/ 2\)/);
  assert.match(worker, /currentFlux \+= fluxDiff/);
  assert.match(worker, /centroidT\[i\] = sumMag > 0 \? \(sumFreqMag \/ sumMag\) \/ 512 : 0/);
  assert.match(worker, /flatnessT\[i\] = sumMag > 0 \? Math\.exp\(sumLogMag \/ 511\) \/ \(sumMag \/ 511\) : 0/);
  assert.match(worker, /sVocal \+= \(clamp01\(vocalTarget\) - sVocal\) \* 0\.1/);
  assert.match(worker, /outFrames\[i\] = \{ e: sE, b: sDensity, m: sMelody, t: sFx, state: state, eRatio: energyRatio \}/);
  assert.doesNotMatch(worker, /a_bass/);
  assert.doesNotMatch(worker, /filterLow/);
  assert.doesNotMatch(worker, /filterMidHigh/);
});

test('analysis worker produces deterministic spectral analysis payloads', () => {
  const sampleRate = 44_100;
  const totalSamples = 1024 * 64;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    const beatGate = i % 11_025 < 512 ? 1 : 0;
    samples[i] = Math.sin(2 * Math.PI * 220 * time) * 0.25
      + Math.sin(2 * Math.PI * 1760 * time) * 0.08
      + beatGate * Math.sin(2 * Math.PI * 80 * time) * 0.7;
  }

  const first = runAnalyzerWorker(samples.slice(), sampleRate);
  const second = runAnalyzerWorker(samples.slice(), sampleRate);

  assert.equal(first.type, 'analysis_done');
  assert.equal(first.requestId, 42);
  assert.equal(first.hopSize, 1024);
  assert.equal(first.frames.length, totalSamples / 1024);
  assert.equal(first.trackAnalysis.features.length, first.frames.length);
  assert.equal(first.trackAnalysis.featureHopSize, 1024);
  assert.ok(first.bpm >= 70 && first.bpm <= 180);
  assert.ok(first.events.length > 0);
  assert.ok(first.trackAnalysis.sections.length > 0);
  assert.deepEqual(normalizePayload(second), normalizePayload(first));

  for (const frame of first.frames) {
    assert.ok(frame.e >= 0 && frame.e <= 1);
    assert.ok(frame.b >= 0 && frame.b <= 1);
    assert.ok(frame.m >= 0 && frame.m <= 1);
    assert.ok(frame.t >= 0 && frame.t <= 1);
  }

  for (const feature of first.trackAnalysis.features) {
    assert.ok(feature.melody >= 0 && feature.melody <= 1);
    assert.ok(feature.vocal >= 0 && feature.vocal <= 1);
    assert.ok(feature.fx >= 0 && feature.fx <= 1);
    assert.ok(feature.density >= 0 && feature.density <= 1);
    assert.ok(feature.brightness >= 0 && feature.brightness <= 1);
    assert.ok(feature.tension >= 0 && feature.tension <= 1);
  }
});

test('audio engine protects playback data and stale worker results', () => {
  const audio = read('src/audio/AudioEngine.ts');

  assert.match(audio, /const analysisSamples = new Float32Array\(channelData\.length\);/);
  assert.match(audio, /analysisSamples\.set\(channelData\);/);
  assert.doesNotMatch(audio, /postMessage\(\{[\s\S]*samples:\s*channelData\.buffer/);
  assert.match(audio, /currentAnalysisRequestId/);
  assert.match(audio, /e\.data\.requestId !== this\.currentAnalysisRequestId/);
  assert.match(audio, /terminateActiveWorker\(\)/);
});

test('playback seek and stop keep canonical time and visual sync callbacks aligned', () => {
  const audio = read('src/audio/AudioEngine.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(audio, /seek\(time: number\)/);
  assert.match(audio, /const stoppedAt = this\.getCurrentTime\(\);/);
  assert.match(audio, /State\.currentTime = clampedTime;/);
  assert.match(audio, /emitPositionChanged\(clampedTime\)/);
  assert.match(renderer, /addPositionChangedListener\(syncEventIndex\)/);
  assert.match(renderer, /State\.events\.findIndex\(e => e\.time >= time\)/);
  assert.match(ui, /this\.engine\.seek\(seekTime\)/);
  assert.match(ui, /setPlaybackUi\(false\)/);
});

test('player UI supports background controls, metrics toggle, draggable tuning, and loop mode', () => {
  const main = read('src/main.ts');
  const state = read('src/state/store.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const css = read('src/style.css');

  assert.match(main, /id="center-play-btn"/);
  assert.match(main, /id="toggle-loop"/);
  assert.match(main, /id="toggle-metrics"/);
  assert.match(main, /class="bottom-toolbar"/);
  assert.match(main, /id="metrics-grid"/);
  assert.match(main, /Music Block & Dynamics/);
  assert.match(main, /id="visual-preset-list"[\s\S]*id="toggle-loop"/);
  assert.doesNotMatch(main, /id="toggle-loop"[\s\S]*id="toggle-metrics"[\s\S]*id="toggle-tuning-panel"/);
  assert.match(state, /loopPlayback: true/);
  assert.match(audio, /State\.loopPlayback/);
  assert.match(ui, /canvasContainer\.addEventListener\('click'/);
  assert.match(ui, /event\.code === 'Space'/);
  assert.match(ui, /event\.code === 'ArrowLeft'/);
  assert.match(ui, /event\.code === 'ArrowRight'/);
  assert.match(ui, /initTuningPanelDrag/);
  assert.match(css, /\.center-play-btn/);
  assert.match(css, /\.metrics-grid\.is-hidden/);
  assert.match(css, /\.metrics-toggle/);
  assert.match(css, /body\.chrome-idle \.top-row/);
  assert.match(ui, /initChromeAutoHide/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(310px, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(main, /id="val-cue"/);
});
