import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

test('worker contract includes request id, hop size, success, and error messages', () => {
  const types = read('src/types/index.ts');
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(types, /export interface AnalysisRequest[\s\S]*requestId: number;/);
  assert.match(types, /export interface AnalysisResult[\s\S]*requestId: number;[\s\S]*hopSize: number;/);
  assert.match(types, /export interface AnalysisErrorMessage[\s\S]*errorCode: string;[\s\S]*message: string;/);
  assert.match(worker, /type:\s*'analysis_done'/);
  assert.match(worker, /type:\s*'analysis_error'/);
});

test('analysis thresholds match the V0.2 macro-dynamics ACs', () => {
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(worker, /energyRatio\s*>=\s*0\.45\s*\?\s*'HIGH'\s*:\s*'LOW'/);
  assert.match(worker, /sE\s*<\s*0\.35/);
  assert.match(worker, /sE\s*>\s*0\.95/);
  assert.match(worker, /secondsPerBlock\s*=\s*secondsPerBeat\s*\*\s*16/);
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
  assert.match(ui, /this\.els\.playBtn\.innerText = "Play"/);
});
