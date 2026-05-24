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
  assert.match(worker, /featureGate = smoothstep\(0\.04,\s*0\.18,\s*audibleEnergy\)/);
  assert.match(worker, /percussiveSuppression/);
  assert.match(worker, /melodyConfidence = featureGate/);
  assert.match(worker, /vocalConfidence = featureGate/);
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
  assert.match(worker, /function patternSignature\(section: TrackSection\)/);
  assert.match(worker, /let patternGroups: Record<string,/);
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
