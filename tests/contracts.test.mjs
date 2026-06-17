import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = process.cwd();
const SRC_ROOT = join(root, 'src');
const read = (path) => readFileSync(join(root, path), 'utf8');
const normalizePayload = (payload) => JSON.parse(JSON.stringify(payload));

function createSrcLoader(extraContext = {}) {
  const moduleCache = new Map();

  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try {
      readFileSync(`${base}.ts`, 'utf8');
      return `${base}.ts`;
    } catch {
      return join(base, 'index.ts');
    }
  }

  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText;

    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Float32Array,
      Math,
      Number,
      Error,
      ...extraContext
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

function runAnalyzerWorker(samples, sampleRate = 44_100) {
  const messages = [];
  const self = {
    onmessage: undefined,
    postMessage(message) {
      messages.push(message);
    }
  };
  const loadSrcModule = createSrcLoader({ self });
  loadSrcModule('audio/analyzer.worker.ts');
  assert.equal(typeof self.onmessage, 'function');
  self.onmessage({
    data: {
      requestId: 42,
      algorithmVersion: 2,
      samples: samples.buffer,
      sampleRate,
      phraseSize: 8
    }
  });

  const done = messages.find(message => message.type === 'analysis_done');
  assert.ok(done);
  assert.ok(messages.some(message => message.type === 'analysis_progress'));
  return done;
}

test('worker contract includes request id, hop size, success, and error messages', () => {
  const types = read('src/types/index.ts');
  const worker = read('src/audio/analyzer.worker.ts');

  assert.match(types, /export interface AnalysisRequest[\s\S]*requestId: number;/);
  assert.match(types, /export interface AnalysisRequest[\s\S]*phraseSize: number;/);
  assert.match(types, /export interface AnalysisResult[\s\S]*requestId: number;[\s\S]*adaptiveThreshold: number;[\s\S]*hopSize: number;/);
  assert.match(types, /export interface AnalysisResult[\s\S]*trackAnalysis: TrackAnalysis;/);
  assert.match(types, /export interface TrackAnalysis[\s\S]*bars: BarAnalysis\[\];[\s\S]*sections: TrackSection\[\];[\s\S]*patterns: MusicPattern\[\];[\s\S]*cues: VisualCueEvent\[\];[\s\S]*features: VisualFeatureFrame\[\];[\s\S]*spectralPivot: number\[\];/);
  assert.match(types, /export interface TrackAnalysis[\s\S]*featureHopSize: number;[\s\S]*gridOffset: number;/);
  assert.match(types, /export interface AnalysisErrorMessage[\s\S]*errorCode: string;[\s\S]*message: string;/);
  assert.match(worker, /type:\s*'analysis_done'/);
  assert.match(worker, /type:\s*'analysis_error'/);
});

test('BeatEvent type comments use semantic hit labels, not instrument names', () => {
  const types = read('src/types/index.ts');

  assert.match(types, /type: 1 \| 2 \| 3; \/\/ 1: default spectral-flux hit, 2: dense impact hit, 3: fx\/high-transient hit/);
  assert.doesNotMatch(types, /Kick/);
  assert.doesNotMatch(types, /Snare/);
  assert.doesNotMatch(types, /Hi-hat/);
});

test('active docs use semantic BeatEvent and dashboard metric labels', () => {
  const activeDocs = [
    'documents/acceptance-criteria/usage-acs.md',
    'documents/features/visual-tuning-presets-and-playback-ui.md',
    'documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md',
    'documents/audits/metrics-audit-matrix.md',
    'documents/governance/metrics-and-modulation-governance.md',
    'documents/metrics/metrics-source-audit.md',
    'documents/implementation/current-typescript-implementation.md'
  ].map(read).join('\n');

  assert.match(activeDocs, /default spectral-flux hit/);
  assert.match(activeDocs, /dense impact hit/);
  assert.match(activeDocs, /fx\/high-transient hit/);
  assert.match(activeDocs, /denseImpactFlash/);
  assert.match(activeDocs, /Density/);
  assert.match(activeDocs, /Melody Presence/);
  assert.match(activeDocs, /Vocal/);
  assert.match(activeDocs, /FX/);
  assert.match(activeDocs, /Beat Impulse/);
  assert.match(activeDocs, /Dynamics State/);
  assert.match(activeDocs, /BPM header badge/);
  assert.doesNotMatch(activeDocs, /FX Presence metric card|Progress card|BPM metric card|BPM appears in the metrics panel|calculated BPM appears as a metric card/);
  assert.doesNotMatch(activeDocs, /Kick|Snare|Hi-Hat|Hi-hat|Snare\/Drop|Snare\/Clap/);
  assert.doesNotMatch(activeDocs, /Beat Hit|Music Block & Dynamics|legacy Bass|legacy Mid|legacy Treble/);
});

test('active docs are free of mojibake and resolved-risk headings', () => {
  const activeDocs = [
    'documents/acceptance-criteria/usage-acs.md',
    'documents/features/visual-tuning-presets-and-playback-ui.md',
    'documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md',
    'documents/audits/metrics-audit-matrix.md',
    'documents/governance/metrics-and-modulation-governance.md',
    'documents/metrics/metrics-source-audit.md',
    'documents/implementation/current-typescript-implementation.md'
  ].map(read).join('\n');
  assert.doesNotMatch(activeDocs, /â†’|â€”|â€“|â€™|â€œ|â€ť|â€¦|Ă|Ĺ|Ä|Â|đ|ď|Ž|Ť|Ôćĺ|ÔÇö|├|┼|╜|╡|╢|�/);
  assert.doesNotMatch(activeDocs, /Beat types are overnamed/);
  assert.doesNotMatch(activeDocs, /bass-like frame drive/);
  assert.match(activeDocs, /Beat type labels are resolved/);
  assert.match(activeDocs, /density\/energy-driven animation signal/);
});

test('active docs allow bass mid treble only as BarAnalysis spectral-band ratios', () => {
  const activeDocs = [
    'documents/acceptance-criteria/usage-acs.md',
    'documents/features/visual-tuning-presets-and-playback-ui.md',
    'documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md',
    'documents/audits/metrics-audit-matrix.md',
    'documents/metrics/metrics-source-audit.md',
    'documents/implementation/current-typescript-implementation.md'
  ].map(read).join('\n');

  assert.match(activeDocs, /BarAnalysis bass\/mid\/treble spectral-band ratios/);
  assert.match(activeDocs, /`BarAnalysis\.bass`|`TrackAnalysis\.bars\[\]\.bass`/);
  assert.doesNotMatch(activeDocs, /dashboard Bass|dashboard Mid|dashboard Treble|Dashboard `Bass`|Dashboard `Mid`|Dashboard `Treble`/);
});

test('visual track analysis is precomputed and exposed through shared state', () => {
  const worker = read('src/audio/analyzer.worker.ts');
  const analyzer = read('src/analyzer/analyzeAudio.ts');
  const featureExtractor = read('src/analyzer/FeatureExtractor.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const store = read('src/state/store.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');

  assert.match(worker, /analyzeAudio/);
  assert.match(analyzer, /const trackAnalysis: TrackAnalysis = \{/);
  assert.match(analyzer, /significantMoments/);
  assert.match(analyzer, /DramaturgyBuilder/);
  assert.match(featureExtractor, /export class FeatureExtractor/);
  assert.match(featureExtractor, /const windowMultiplier = new Float32Array\(N\)/);
  assert.match(featureExtractor, /windowMultiplier\[i\] = 0\.5 \* \(1 - Math\.cos/);
  assert.match(featureExtractor, /const processFFT = \(\) =>/);
  assert.match(featureExtractor, /pitchConfidenceT\[i\]/);
  assert.match(featureExtractor, /flatnessT\[i\]/);
  assert.match(featureExtractor, /centroidT\[i\]/);
  assert.match(audio, /ANALYSIS_ALGORITHM_VERSION/);
  assert.match(audio, /State\.trackAnalysis = normalizeTrackAnalysis\(e\.data\.trackAnalysis, State\.bpm\)/);
  assert.match(store, /currentFeatures/);
  assert.match(renderer, /State\.trackAnalysis\.cues/);
  assert.match(renderer, /State\.trackAnalysis\.features/);
});

test('performance automation contracts and state are exposed and reset', () => {
  const types = read('src/types/index.ts');
  const store = read('src/state/store.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(types, /export type PerformanceAutomationReason = 'intro' \| 'verse' \| 'build' \| 'drop' \| 'break' \| 'peak' \| 'outro' \| 'harmonicShift' \| 'manual';/);
  assert.match(types, /export interface PerformanceAutomationPoint[\s\S]*id: string;[\s\S]*time: number;[\s\S]*sectionId: string;[\s\S]*preset: string;[\s\S]*confidence: number;[\s\S]*intensity: number;[\s\S]*reason: PerformanceAutomationReason;[\s\S]*morphDurationSec: number;[\s\S]*morphCurve: 'linear' \| 'easeInOut' \| 'exponential';[\s\S]*locked\?: boolean;/);
  assert.match(types, /export interface PerformanceAutomationPlan[\s\S]*version: 1;[\s\S]*source: 'auto' \| 'edited';[\s\S]*points: PerformanceAutomationPoint\[\];/);
  assert.match(types, /export interface VideoDominantColor[\s\S]*r: number;[\s\S]*g: number;[\s\S]*b: number;/);
  assert.match(types, /export interface RenderState[\s\S]*performancePlan: PerformanceAutomationPlan \| null;[\s\S]*videoDominantColor: VideoDominantColor;/);
  assert.match(store, /availablePresets: \[\] as string\[\]/);
  assert.match(store, /videoDominantColor: \{ \.\.\.emptyVideoDominantColor \} as VideoDominantColor/);
  assert.match(store, /performancePlan: null as PerformanceAutomationPlan \| null/);
  assert.match(store, /editedPerformancePlan: null as PerformanceAutomationPlan \| null/);
  assert.match(audio, /State\.performancePlan = null/);
  assert.match(audio, /State\.editedPerformancePlan = null/);
  assert.match(ui, /import \{ generatePerformancePlan.*\} from '\.\.\/automation\/performancePlanGenerator'/);
  assert.match(ui, /State\.availablePresets = presets/);
  assert.match(ui, /await generatePerformancePlan\(State\.trackAnalysis, State\.availablePresets, State\.duration,/);
  assert.match(ui, /State\.performancePlan = plan/);
  assert.match(ui, /State\.editedPerformancePlan = JSON\.parse\(JSON\.stringify\(plan\)\)/);
  assert.match(ui, /performancePlan: State\.editedPerformancePlan \?\? State\.performancePlan/);
  assert.match(ui, /videoDominantColor: State\.videoDominantColor/);
});

test('visual track analysis detects recurring temporal patterns', () => {
  const types = read('src/types/index.ts');
  const dramaturgyBuilder = read('src/analyzer/DramaturgyBuilder.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(types, /export interface MusicPattern[\s\S]*occurrences: PatternOccurrence\[\];/);
  assert.match(types, /export type VisualCueKind = [\s\S]*'pattern'/);
  assert.match(dramaturgyBuilder, /private sectionPatternDistance\(section: TrackSection, group:/);
  assert.match(dramaturgyBuilder, /const featureDelta = section\.dominantFeature === group\.dominantFeature \? 0 : 0\.36/);
  assert.match(dramaturgyBuilder, /const matchThreshold = 0\.32/);
  assert.match(dramaturgyBuilder, /let patternGroups: Array<\{/);
  assert.match(dramaturgyBuilder, /public musicPatterns: MusicPattern\[\]/);
  assert.match(dramaturgyBuilder, /this\.musicPatterns = patternGroups/);
  assert.match(renderer, /kind === 'pattern'/);
  assert.match(temporal, /function getPatternResonance\(time: number\)/);
});

test('visual mode selector preserves classic mode and exposes temporal mode', () => {
  const types = read('src/types/index.ts');
  const state = read('src/state/store.ts');
  const main = read('src/main.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const identity = read('src/visuals/VisualIdentity.ts');
  const registry = read('src/visuals/StyleRegistry.ts');
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(types, /export type VisualMode = 'classic' \| 'temporal' \| 'dark-techno' \| 'organic-ambient' \| 'cyberpunk'/);
  assert.match(state, /visualMode: 'classic' as VisualMode/);
  assert.match(main, /id="visual-mode"/);
  assert.match(main, /createDefaultStyleRegistry\(\)/);
  assert.match(ui, /function isVisualMode\(value: string\): value is VisualMode/);
  assert.match(renderer, /styleRegistry\.get\(State\.visualMode\)/);
  assert.match(renderer, /visualIdentity\.draw\(backend, particles, shockwaves\)/);
  assert.match(identity, /export interface VisualIdentity[\s\S]*draw\(backend: VisualRendererBackend, particles: Particle\[\], shockwaves: Shockwave\[\]\): void;/);
  assert.match(registry, /private readonly identities = new Map<string, VisualIdentity>\(\)/);
  assert.match(registry, /registry\.register\(classicPlexusIdentity\)/);
  assert.match(registry, /registry\.register\(temporalMusicIdentity\)/);
  assert.match(registry, /registry\.register\(darkTechnoIdentity\)/);
  assert.match(registry, /registry\.register\(organicAmbientIdentity\)/);
  assert.match(registry, /registry\.register\(cyberpunkIdentity\)/);
  assert.match(registry, /get\(id: string\): VisualIdentity[\s\S]*this\.identities\.get\(CLASSIC_STYLE_ID\)/);
  assert.match(classic, /export const classicPlexusIdentity: VisualIdentity = new ClassicPlexusIdentity\(\)/);
  assert.match(classic, /private drawPolygonalNetwork/);
  assert.match(temporal, /export const temporalMusicIdentity: VisualIdentity = new TemporalMusicIdentity\(\)/);
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
  assert.match(config, /particleActivityTurn: 0\.1/);
  assert.match(config, /label: 'Activity Turn'/);
  assert.match(config, /particleBassTurn\?: unknown/);
  assert.match(state, /visualTuning: cloneDefaultVisualTuning\(\)/);
  assert.match(main, /id="toggle-tuning-panel"/);
  assert.match(main, /id="visual-preset-list"/);
  assert.match(main, /id="visual-tuning-controls"/);
  assert.match(main, /id="copy-visual-config"/);
  // TuningController owns the DOM markup generation (FÁZIS 1 refactor)
  const tuningCtrl = read('src/ui/controllers/TuningController.ts');
  assert.match(tuningCtrl, /data-tuning-key="\$\{control\.key\}"/);
  assert.match(ui, /State\.targetTuning\[key\] = value/);
  assert.match(ui, /loadVisualPresetList/);
  assert.match(ui, /loadVisualPreset\(fileName/);
  assert.match(ui, /syncVisualTuningControls/);
  assert.match(ui, /navigator\.clipboard\?\.writeText/);
  assert.match(classic, /State\.visualTuning\.lineDistance/);
  assert.match(classic, /State\.visualTuning\.polygonAlpha/);
  assert.match(temporal, /State\.visualTuning\.temporalRingSize/);
  assert.match(temporal, /State\.visualTuning\.temporalPolygonAlpha/);
  assert.match(particle, /State\.visualTuning\.particleEnergySpeed/);
  assert.match(particle, /State\.visualTuning\.particleActivityTurn/);
  assert.doesNotMatch(config + particle, /Bass turn/);
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
  assert.equal(preset.visualTuning.particleActivityTurn, 0.1);
  assert.equal(preset.visualTuning.particleBassTurn, undefined);
  assert.match(config, /normalizeVisualTuningConfig\(payload: unknown, current\?: VisualTuningConfig\)/);
  assert.match(config, /const next = current \? \{ \.\.\.current \} : cloneDefaultVisualTuning\(\)/);
  assert.match(config, /source\?\.\[key\]/);
  assert.match(config, /legacySource\?\.particleBassTurn/);
  assert.match(ui, /visual-tuning-presets\/\$\{encodeURIComponent\(fileName\)\}/);
  assert.match(ui, /Object\.assign\(State\.targetTuning, normalizeVisualTuningConfig\(payload, State\.targetTuning\)\)/);
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
    'particleActivityTurn',
    'temporalRingSpeed',
    'temporalNetworkDistance'
  ]) {
    assert.match(config, new RegExp(`key: '${key}'`));
  }
});

test('analysis thresholds use bar-aligned macro dynamics with live safety overrides', () => {
  const analyzer = read('src/analyzer/analyzeAudio.ts');
  const gridAligner = read('src/analyzer/GridAligner.ts');
  const sectionAnalyzer = read('src/analyzer/SectionAnalyzer.ts');

  assert.match(sectionAnalyzer, /this\.adaptiveThreshold = Math\.min\(0\.6, Math\.max\(0\.3,/);
  assert.match(sectionAnalyzer, /state: energy >= this\.adaptiveThreshold \? 'HIGH' : 'LOW'/);
  assert.match(analyzer, /outFrames\[i\]\.e < 0\.35/);
  assert.match(gridAligner, /this\.secondsPerBar = secondsPerBeat \* 4/);
  assert.match(analyzer, /Math\.round\(grid\.secondsPerBar \* sampleRate \/ hopSize \* 8\)/);
  assert.match(analyzer, /adaptiveThreshold: segmenter\.adaptiveThreshold, frames: outFrames/);
});

test('analysis worker uses spectral FFT features instead of legacy crossover filters', () => {
  const analyzer = read('src/analyzer/analyzeAudio.ts');
  const featureExtractor = read('src/analyzer/FeatureExtractor.ts');
  const normalizer = read('src/analyzer/FeatureNormalizer.ts');

  assert.match(featureExtractor, /const N = this\.hopSize/);
  assert.match(featureExtractor, /const prevMag = new Float32Array\(N \/ 2\)/);
  assert.match(featureExtractor, /const mags = new Float32Array\(N \/ 2\)/);
  assert.match(featureExtractor, /currentFlux \+= fluxDiff/);
  assert.match(featureExtractor, /mags\[k\] = mag/);
  assert.match(featureExtractor, /cumulativeMag \+= mags\[k\]/);
  assert.doesNotMatch(featureExtractor, /cumulativeMag \+= Math\.sqrt/);
  assert.match(featureExtractor, /this\.centroidT\[i\] = sumMag > 0 \? \(sumFreqMag \/ sumMag\) \/ 512 : 0/);
  assert.match(featureExtractor, /this\.flatnessT\[i\] = sumMag > 0 \? Math\.exp\(sumLogMag \/ 511\) \/ \(sumMag \/ 511\) : 0/);
  assert.match(featureExtractor, /this\.zcrT\[i\] = zeroCrossings \/ Math\.max\(1, this\.hopSize - 1\)/);
  assert.match(featureExtractor, /this\.spectralRolloffT\[i\] = rolloffBin \/ 512/);
  assert.match(featureExtractor, /this\.spectralCrestT\[i\] = sumMag > 0 \? maxMag \/ \(sumMag \/ 511\) : 0/);
  assert.match(normalizer, /export function normalizeArray\(input: Float32Array, typMax: number\): Float32Array/);
  assert.doesNotMatch(normalizer, /\.sort\(/);
  assert.match(analyzer, /const normRms = normalizeArray\(features\.rmsT, features\.typRms\)/);
  assert.match(analyzer, /const normFlux = normalizeArray\(features\.fluxT, features\.typFlux\)/);
  assert.match(analyzer, /const classifier = new FeatureClassifier\(\{/);
  assert.match(analyzer, /const fx = applyEMA\(classified\.fxRaw, 0\.15\)/);
  assert.match(analyzer, /outFrames\[i\] = \{ e: energy\[i\], densityProj: density\[i\], melodyProj: melody\[i\], fxProj: fx\[i\], state: 'LOW', eRatio: energy\[i\] \}/);
  assert.doesNotMatch(featureExtractor + analyzer, /a_bass/);
  assert.doesNotMatch(featureExtractor + analyzer, /filterLow/);
  assert.doesNotMatch(featureExtractor + analyzer, /filterMidHigh/);
});

test('spectral pivot and noise gate are encoded in analyzer output contract', () => {
  const analyzer = read('src/analyzer/analyzeAudio.ts');
  const spectralPivot = read('src/analyzer/SpectralPivot.ts');
  const normalization = read('src/analyzer/normalizeAnalysisResult.ts');
  const types = read('src/types/index.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');

  assert.match(types, /export interface TrackAnalysis[\s\S]*spectralPivot: number\[\];/);
  assert.match(normalization, /spectralPivot: trackAnalysis\.spectralPivot \|\| \[\]/);
  assert.match(analyzer, /const spectralPivot = applySpectralPivot\(featureFrames, outFrames, dramaturgy\.buildupConfidence, totalFrames\)/);
  assert.match(spectralPivot, /export function applySpectralPivot\(/);
  assert.match(spectralPivot, /const spectralPivot = new Array<number>\(totalFrames\)\.fill\(0\)/);
  assert.match(spectralPivot, /if \(sE > 0\.04 && eRatio < 0\.55 && \(buildup > 0\.1 \|\| state === 'LOW_DROP'\)\)/);
  assert.match(spectralPivot, /const compensation = \(1\.0 - eRatio\) \* Math\.max\(buildup, 0\.25\)/);
  assert.match(spectralPivot, /const melodyGate = Math\.max\(0, featureFrames\[i\]\.melody - 0\.05\) \* 1\.1/);
  assert.match(spectralPivot, /const maxCeiling = Math\.min\(1\.0, 0\.35 \+ eRatio \* 0\.65 \+ buildup \* 0\.40\)/);
  assert.match(spectralPivot, /featureFrames\[i\]\.melody = Math\.min\(maxCeiling, featureFrames\[i\]\.melody \* \(1\.0 \+ compensation \* 1\.5 \* melodyGate\)\)/);
  assert.match(spectralPivot, /featureFrames\[i\]\.vocal = Math\.min\(maxCeiling, featureFrames\[i\]\.vocal \* \(1\.0 \+ compensation \* 1\.5 \* vocalGate\)\)/);
  assert.match(spectralPivot, /featureFrames\[i\]\.fx = Math\.min\(maxCeiling, featureFrames\[i\]\.fx \* \(1\.0 \+ compensation \* 2\.2 \* fxGate\)\)/);
  assert.match(spectralPivot, /spectralPivot\[i\] = Math\.min\(1\.0, compensation \* Math\.max\(melodyGate, vocalGate, fxGate, 0\.25\)\)/);
  assert.match(spectralPivot, /else if \(sE <= 0\.04\)[\s\S]*featureFrames\[i\]\.melody = 0;[\s\S]*featureFrames\[i\]\.vocal = 0;[\s\S]*featureFrames\[i\]\.fx = 0;[\s\S]*featureFrames\[i\]\.tension = 0;[\s\S]*outFrames\[i\]\.melodyProj = 0;[\s\S]*outFrames\[i\]\.fxProj = 0;[\s\S]*spectralPivot\[i\] = 0;/);
  assert.match(timeline, /pivotVal > 0\.05/);
  assert.match(timeline, /rgba\(213, 84, 172, 0\.95\)/);
  assert.match(timeline, /ctx\.setLineDash\(\[1, 4\]\)/);
});

test('drop anticipation look-ahead dampens modulation and is shown on the timeline', () => {
  const config = read('src/config/visualTuning.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const director = read('src/visuals/VisualDirectorFSM.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');

  assert.match(config, /dropAnticipation: 0\.0/);
  assert.match(config, /key: 'dropAnticipation'[\s\S]*min: 0\.0[\s\S]*max: 5\.0/);
  assert.match(renderer, /visualDirector\.update\(/);
  assert.match(renderer, /getDropAnticipationFrame\(ct\)/);
  assert.match(renderer, /const futureTime = currentTime \+ anticipation/);
  assert.match(renderer, /const futureIdx = Math\.floor\(futureTime \* State\.sampleRate \/ State\.hopSize\)/);
  assert.match(director, /futureFrame\.state !== 'LOW' && futureFrame\.state !== 'LOW_DROP'/);
  assert.match(director, /const damp = Number\.isFinite\(tuning\.dropDampening\) \? tuning\.dropDampening : 1/);
  assert.match(director, /const scale = futureFrame\.state === 'LOW_DROP' \? 0\.72 \* damp : 0\.86 \* damp/);
  assert.match(director, /modulation\.kineticTension \*= scale/);
  assert.match(director, /modulation\.densityDrive \*= scale/);
  assert.match(timeline, /state\.dropAnticipation <= 0/);
  assert.match(timeline, /const anticipationWidth = \(state\.dropAnticipation \/ Math\.max\(0\.001, viewport\.duration\)\) \* width/);
  assert.match(timeline, /rgba\(213, 84, 172, 0\.18\)/);
});

test('AudioFrame uses semantic projection field names', () => {
  const types = read('src/types/index.ts');

  assert.match(types, /export interface AudioFrame[\s\S]*Normalized RMS energy\.[\s\S]*e: number;/);
  assert.match(types, /export interface AudioFrame[\s\S]*Smoothed spectral-flux density projection\.[\s\S]*densityProj: number;/);
  assert.match(types, /export interface AudioFrame[\s\S]*Smoothed tonal melody-presence projection\.[\s\S]*melodyProj: number;/);
  assert.match(types, /export interface AudioFrame[\s\S]*Smoothed FX\/noise\/transient projection\.[\s\S]*fxProj: number;/);
  assert.doesNotMatch(types, /Legacy compatibility field: density projection, not bass/);
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
  assert.equal(first.trackAnalysis.spectralPivot.length, first.frames.length);
  assert.equal(first.trackAnalysis.featureHopSize, 1024);
  assert.ok(first.bpm >= 70 && first.bpm <= 180);
  assert.ok(first.events.length > 0);
  assert.ok(first.trackAnalysis.sections.length > 0);
  assert.deepEqual(normalizePayload(second), normalizePayload(first));

  for (const frame of first.frames) {
    assert.ok(frame.e >= 0 && frame.e <= 1);
    assert.ok(frame.densityProj >= 0 && frame.densityProj <= 1);
    assert.ok(frame.melodyProj >= 0 && frame.melodyProj <= 1);
    assert.ok(frame.fxProj >= 0 && frame.fxProj <= 1);
  }

  for (const feature of first.trackAnalysis.features) {
    assert.ok(feature.melody >= 0 && feature.melody <= 1);
    assert.ok(feature.vocal >= 0 && feature.vocal <= 1);
    assert.ok(feature.fx >= 0 && feature.fx <= 1);
    assert.ok(feature.density >= 0 && feature.density <= 1);
    assert.ok(feature.brightness >= 0 && feature.brightness <= 1);
    assert.ok(feature.tension >= 0 && feature.tension <= 1);
  }

  for (const pivot of first.trackAnalysis.spectralPivot) {
    assert.ok(pivot >= 0 && pivot <= 1);
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
  assert.doesNotMatch(renderer, /engine\.pausedAt[\s\S]*findIndex/);
  assert.match(ui, /commitScrubTime/);
  assert.match(ui, /this\.engine\.seek\(targetTime\)/);
  assert.match(ui, /setPlaybackUi\(false\)/);
});

test('renderer keeps accepted worker results immutable while decaying render copies', () => {
  const renderer = read('src/visuals/PlexusRenderer.ts');

  assert.match(renderer, /copyAudioFrame\(State\.frames\[frameIdx\], State\.currentFrame\)/);
  assert.match(renderer, /copyVisualFeatures\(State\.trackAnalysis\.features\[frameIdx\], State\.currentFeatures\)/);
  assert.doesNotMatch(renderer, /State\.currentFrame\s*=\s*State\.frames\[frameIdx\]/);
  assert.doesNotMatch(renderer, /State\.currentFeatures\s*=\s*State\.trackAnalysis\.features\[frameIdx\]/);
  assert.match(renderer, /function decayCurrentAnalysisFrame\(\)[\s\S]*State\.currentFrame\.e \*= 0\.9/);
  assert.match(renderer, /function copyAudioFrame\(source: AudioFrame, target: AudioFrame\)/);
  assert.match(renderer, /function copyVisualFeatures\(source: VisualFeatureFrame, target: VisualFeatureFrame\)/);
});

test('dense impact flash preserves former type 2 visual behavior', () => {
  const state = read('src/state/store.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(state, /denseImpactFlash: 0/);
  assert.match(audio, /State\.denseImpactFlash = 0/);
  assert.match(renderer, /if \(ev\.type === 2\) State\.denseImpactFlash = 1\.0/);
  assert.match(renderer, /State\.denseImpactFlash \*= 0\.85/);
  assert.match(renderer, /State\.denseImpactFlash = 0/);
  assert.match(classic, /State\.denseImpactFlash \* 150 \* State\.visualTuning\.polygonFlash/);
  assert.match(temporal, /Math\.max\(density, State\.denseImpactFlash\)/);
  assert.match(temporal, /State\.denseImpactFlash \* 105 \* State\.visualTuning\.polygonFlash/);
  assert.doesNotMatch(state + audio + renderer + classic + temporal, /snareFlash/);
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
  assert.match(main, /id="bpm-header-badge"[\s\S]*-- BPM/);
  assert.doesNotMatch(main, /class="metric-card bpm-card"/);
  assert.doesNotMatch(main, /data-metric-key="bpm"/);
  assert.doesNotMatch(main, /data-metric-key="progress"/);
  assert.match(main, /<div class="metric-card dyn-card" data-metric-key="dynamicsState"[\s\S]*Dynamics State[\s\S]*Section Energy[\s\S]*data-metric-key="energy"[\s\S]*Energy[\s\S]*data-metric-key="density"[\s\S]*Density[\s\S]*data-metric-key="melodyPresence"[\s\S]*Melody Presence[\s\S]*data-metric-key="vocal"[\s\S]*Vocal[\s\S]*data-metric-key="fx"[\s\S]*FX[\s\S]*data-metric-key="beatImpulse"[\s\S]*Beat Impulse/);
  assert.doesNotMatch(main, /data-metric-key="fxPresence"/);
  assert.doesNotMatch(main, /<div class="m-label">Melody<\/div>/);
  assert.doesNotMatch(main, /id="val-melody"/);
  assert.doesNotMatch(main, /id="bar-melody"/);
  assert.doesNotMatch(ui, /valMelody/);
  assert.doesNotMatch(ui, /barMelody/);
  assert.doesNotMatch(ui, /currentFeatures\.melody\.toFixed/);
  assert.doesNotMatch(main, /<div class="m-label">Bass<\/div>/);
  assert.doesNotMatch(main, /<div class="m-label">Mid<\/div>/);
  assert.doesNotMatch(main, /<div class="m-label">Treble<\/div>/);
  assert.doesNotMatch(main, /Beat Hit/);
  assert.doesNotMatch(main, /Music Block & Dynamics/);
  assert.match(main, /id="visual-preset-list"[\s\S]*id="toggle-loop"/);
  assert.doesNotMatch(main, /id="toggle-loop"[\s\S]*id="toggle-metrics"[\s\S]*id="toggle-tuning-panel"/);
  assert.match(state, /loopPlayback: true/);
  assert.match(audio, /State\.loopPlayback/);
  // PlaybackController owns DOM bindings (FÁZIS 1 refactor)
  const playbackCtrl = read('src/ui/controllers/PlaybackController.ts');
  assert.match(playbackCtrl, /canvasContainer\.addEventListener\('click'/);
  assert.match(playbackCtrl, /event\.code === 'Space'/);
  assert.match(playbackCtrl, /event\.code === 'ArrowLeft'/);
  assert.match(playbackCtrl, /event\.code === 'ArrowRight'/);
  // TuningController owns panel drag (FÁZIS 1 refactor)
  const tuningCtrlPlayer = read('src/ui/controllers/TuningController.ts');
  assert.match(tuningCtrlPlayer, /initDragHandle/);
  assert.match(css, /\.center-play-btn/);
  assert.match(css, /\.metrics-grid\.is-hidden/);
  assert.match(css, /\.metrics-toggle/);
  assert.match(css, /body\.chrome-idle \.top-row/);
  assert.match(css, /\.m-bar-fill[\s\S]*background: #ffffff/);
  assert.match(css, /\.dyn-card \.m-bar-fill[\s\S]*background: white/);
  assert.match(css, /\.default-card \.m-bar-fill[\s\S]*background: royalblue/);
  assert.doesNotMatch(main, /m-bar-fill[^>]*style="background/);
  assert.doesNotMatch(ui, /style\.background/);
  assert.doesNotMatch(ui, /style\.backgroundColor/);
  assert.match(ui, /drawTarget\.style\.opacity = State\.drawModeActive \? '1' : '0\.35'/);
  assert.match(ui, /presetBrush\.style\.opacity = enablePresetBrush \? '1' : '0\.35'/);
  assert.doesNotMatch(ui, /style\.filter/);
  assert.doesNotMatch(ui, /style\.mixBlendMode/);
  assert.doesNotMatch(ui, /barDyn\.style\.background/);
  assert.match(ui, /initChromeAutoHide/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(310px, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(main, /id="val-cue"/);
});

test('timeline draw mode writes directly to performance automation points', () => {
  const state = read('src/state/store.ts');
  const audio = read('src/audio/AudioEngine.ts');
  const renderer = read('src/visuals/PlexusRenderer.ts');
  const ui = read('src/ui/DashboardUI.ts');

  assert.doesNotMatch(state, /sectionOverrides/);
  assert.doesNotMatch(read('src/types/index.ts'), /export interface SectionOverride/);
  assert.match(state, /drawModeActive: false/);
  assert.match(state, /isDrawingEnvelope: false/);
  assert.doesNotMatch(audio, /State\.sectionOverrides = \{\}/);
  assert.doesNotMatch(renderer, /State\.sectionOverrides/);
  assert.match(ui, /drawAutomationAtPointer/);
  assert.match(ui, /State\.isDrawingEnvelope = true/);
  assert.match(ui, /const MIN_DRAW_DISTANCE_SEC = 2\.0/);
  assert.match(ui, /const existingPoint = this\.getNearestEditableAutomationPoint\(hoverTime, MIN_DRAW_DISTANCE_SEC\)/);
  assert.match(ui, /if \(existingPoint && !existingPoint\.locked\) \{[\s\S]*existingPoint\.preset = presetName;[\s\S]*existingPoint\.intensity = this\.getAutomationIntensityAtPercent\(focusY\);[\s\S]*return;/);
  assert.match(ui, /point\.intensity = this\.getAutomationIntensityAtPercent\(focusY\)/);
  assert.match(ui, /this\.createAutomationPointAtTime\(hoverTime\)/);
  assert.match(ui, /State\.editedPerformancePlan\?\.points\.sort\(\(a, b\) => a\.time - b\.time\)/);
  assert.match(ui, /this\.engine\.addPositionChangedListener\(\(\) => \{[\s\S]*this\.lastTriggeredAutomationPointId = null;[\s\S]*this\.triggerPerformanceAutomation\(\);[\s\S]*\}\);/);
  assert.doesNotMatch(ui, /triggerSectionPresetAutomation/);
  assert.doesNotMatch(ui, /splitTimelineSection/);
  assert.doesNotMatch(ui, /State\.sectionOverrides/);
  assert.match(ui, /timelinePresetBrush/);
});

test('performance plan playback automation and preloading are wired to playback time', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /private lastTriggeredAutomationPointId: string \| null = null/);
  assert.match(ui, /private async preloadPresetsForPlan\(plan: PerformanceAutomationPlan \| null\): Promise<void>/);
  assert.match(ui, /const uniquePresets = \[\.\.\.new Set\(plan\.points\.map\(p => p\.preset\)\)\]/);
  assert.match(ui, /if \(this\.presetCache\.has\(preset\)\) return/);
  assert.match(ui, /fetch\(this\.presetUrl\(preset\), \{ cache: 'no-store' \}\)/);
  assert.match(ui, /this\.presetCache\.set\(preset, payload\)/);
  assert.match(ui, /void this\.preloadPresetsForPlan\(plan\)/);
  assert.match(ui, /this\.lastTriggeredAutomationPointId = null/);
  assert.match(ui, /private triggerPerformanceAutomation\(\): void/);
  assert.match(ui, /const plan = State\.editedPerformancePlan \?\? State\.performancePlan/);
  assert.match(ui, /for \(const point of plan\.points\) \{[\s\S]*if \(point\.time > State\.currentTime\) break;[\s\S]*activePoint = point;[\s\S]*\}/);
  assert.match(ui, /activePoint\.id === this\.lastTriggeredAutomationPointId/);
  assert.match(ui, /this\.lastTriggeredAutomationPointId = activePoint\.id/);
  assert.match(ui, /State\.targetTuning\.morphDurationSec = activePoint\.morphDurationSec/);
  assert.match(ui, /State\.targetTuning\.morphCurveValue = activePoint\.morphCurve === 'linear'[\s\S]*\? 0[\s\S]*: activePoint\.morphCurve === 'exponential'[\s\S]*\? 2[\s\S]*: 1;/);
  assert.match(ui, /void this\.loadVisualPreset\(activePoint\.preset\)/);
  assert.match(ui, /updateDashboard\(\) \{[\s\S]*this\.triggerPerformanceAutomation\(\);/);
  assert.doesNotMatch(ui, /updateDashboard\(\) \{[\s\S]*this\.triggerSectionPresetAutomation\(\);/);
});

test('visual config copy and preset apply serialize performance plans', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /performancePlan: State\.editedPerformancePlan \?\? State\.performancePlan/);
  assert.match(ui, /performancePlan\?: unknown/);
  assert.match(ui, /if \(this\.isPerformanceAutomationPlan\(preset\.performancePlan\)\) \{[\s\S]*State\.performancePlan = preset\.performancePlan;[\s\S]*State\.editedPerformancePlan = JSON\.parse\(JSON\.stringify\(preset\.performancePlan\)\);[\s\S]*void this\.preloadPresetsForPlan\(preset\.performancePlan\);[\s\S]*this\.lastTriggeredAutomationPointId = null;[\s\S]*\}/);
  assert.match(ui, /private isPerformanceAutomationPlan\(value: unknown\): value is PerformanceAutomationPlan/);
  assert.match(ui, /plan\.version !== 1/);
  assert.match(ui, /plan\.source !== 'auto' && plan\.source !== 'edited'/);
  assert.match(ui, /Array\.isArray\(plan\.points\)/);
  assert.match(ui, /typeof candidate\.intensity === 'number'/);
  assert.match(ui, /this\.isPerformanceAutomationReason\(candidate\.reason\)/);
  assert.match(ui, /this\.isMorphCurve\(candidate\.morphCurve\)/);
});

test('dashboard metric cards are backed by metadata and a shared delegated tooltip', () => {
  const main = read('src/main.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const metadata = read('src/ui/metricMetadata.ts');

  const metricCardCount = (main.match(/class="metric-card/g) || []).length;
  const metricKeys = [...main.matchAll(/data-metric-key="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(metricKeys, [
    'dynamicsState',
    'energy',
    'density',
    'melodyPresence',
    'vocal',
    'fx',
    'beatImpulse'
  ]);
  assert.equal(metricKeys.length, metricCardCount);
  assert.equal(new Set(metricKeys).size, metricKeys.length);

  for (const key of metricKeys) {
    assert.match(metadata, new RegExp(`${key}: \\{`));
  }

  assert.match(metadata, /export interface MetricMetadata/);
  assert.match(main, /id="bpm-header-badge"/);
  assert.doesNotMatch(metadata, /bpm: \{/);
  assert.doesNotMatch(metadata, /progress: \{/);
  assert.doesNotMatch(metadata, /fxPresence: \{/);
  assert.match(ui, /private createDashboardMetricTooltip\(\)/);
  assert.match(ui, /tooltip\.id = 'dashboard-metric-tooltip'/);
  assert.equal((ui.match(/createDashboardMetricTooltip\(\)/g) || []).length, 2);
  assert.match(ui, /this\.els\.metricsGrid\.addEventListener\('pointerover'/);
  assert.match(ui, /this\.els\.metricsGrid\.addEventListener\('focusin'/);
  assert.match(ui, /this\.els\.metricsGrid\.addEventListener\('keydown'/);
  assert.match(ui, /event\.key === 'Escape'/);
  assert.match(ui, /this\.els\.metricsGrid\.addEventListener\('click'/);

  const updateDashboardSource = ui.match(/updateDashboard\(\) \{[\s\S]*?\n    \}\n\}/)?.[0] || '';
  assert.doesNotMatch(updateDashboardSource, /dashboard-metric-tooltip|createDashboardMetricTooltip|document\.createElement/);
  assert.doesNotMatch(ui, /requestAnimationFrame\([\s\S]{0,200}MetricTooltip|MetricTooltip[\s\S]{0,200}requestAnimationFrame/);
});

test('dramaturgy timeline draws the audio waveform from precomputed frame energy', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');

  assert.match(ui, /if \(buffer\) this\.timelineCanvas\.setAudioBuffer\(buffer\)/);
  assert.match(timeline, /private drawWaveform/);
  assert.match(timeline, /private waveformCache: HTMLCanvasElement \| OffscreenCanvas \| null = null/);
  assert.match(timeline, /document\.createElement\('canvas'\)/);
  assert.match(timeline, /private waveformPeaks: number\[\] = \[\]/);
  assert.match(timeline, /setAudioBuffer\(buffer: AudioBuffer\)/);
  assert.match(timeline, /state\.frames/);
  assert.match(timeline, /state\.sampleRate/);
  assert.match(timeline, /state\.hopSize/);
  assert.match(timeline, /centerY\s*-\s*halfHeight/);
  assert.match(timeline, /for \(let x = 0; x < width; x \+= 3\)/);
  assert.match(timeline, /cacheCtx\.fillRect\(/);
  assert.doesNotMatch(timeline, /cacheCtx\.stroke\(\)/);
  assert.match(timeline, /ctx\.drawImage\(cache, 0, 0\)/);
  assert.match(timeline, /this\.drawGridlines\(ctx, state, width, height, viewport\);[\s\S]*this\.drawWaveform\(ctx, state, width, height, viewport\);[\s\S]*this\.drawRms\(ctx, state, width, height, viewport\);/);
});
