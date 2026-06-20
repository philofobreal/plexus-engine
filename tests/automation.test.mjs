import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePerformancePlan } from '../src/automation/performancePlanGenerator.ts';

function createSection(start, end, label, dominantFeature, energy = 0.5, density = 0.5) {
  return {
    start,
    end,
    label,
    energy,
    density,
    dominantFeature,
    avgRms: energy,
    peakRms: Math.min(1, energy + 0.1)
  };
}

function createTrackAnalysis(sections) {
  return {
    duration: 90,
    bars: [],
    sections,
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: {
      globalSlope: 0,
      peakTime: 0,
      peakValue: 0,
      segments: []
    },
    featureHopSize: 1024
  };
}

function createBars(starts, seconds = 4) {
  return starts.map((start, index) => ({
    index,
    start,
    end: start + seconds,
    energy: 0.5,
    density: 0.5,
    avgRms: 0.5,
    peakRms: 0.6,
    bass: 0.3,
    mid: 0.4,
    treble: 0.3,
    state: 'LOW',
    dominantFeature: 'rhythm'
  }));
}

function createCue(time, kind, confidence = 0.85) {
  return {
    time,
    duration: 0.25,
    intensity: 0.9,
    confidence,
    kind
  };
}

test('generatePerformancePlan creates deterministic section-aligned automation plans', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody', 0.3, 0.2),
    createSection(6, 14, 'verse', 'vocal', 0.4, 0.4),
    createSection(14, 28, 'build', 'pattern', 0.7, 0.6),
    createSection(30, 48, 'drop', 'impact', 0.95, 0.9),
    createSection(52, 66, 'break', 'break', 0.2, 0.25),
    createSection(70, 86, 'peak', 'fx', 1, 0.95)
  ]);
  const presets = [
    'default.json',
    'club-temporal1.json',
    'wide-temporal3.json',
    'peak-temporal4.json',
    'ambient-temporal5.json'
  ];

  const first = await generatePerformancePlan(trackAnalysis, presets, 90);
  const second = await generatePerformancePlan(trackAnalysis, presets, 90);

  assert.deepEqual(second, first);
  assert.equal(first.version, 1);
  assert.equal(first.source, 'auto');
  assert.deepEqual(first.points.map(point => point.time), [0, 6, 14, 30, 52, 70]);
  assert.deepEqual(first.points.map(point => point.sectionId), [
    '0:intro:0-000',
    '1:verse:6-000',
    '2:build:14-000',
    '3:drop:30-000',
    '4:break:52-000',
    '5:peak:70-000'
  ]);
  assert.deepEqual(first.points.map(point => point.preset), [
    'default.json',
    'default.json',
    'club-temporal1.json',
    'wide-temporal3.json',
    'ambient-temporal5.json',
    'peak-temporal4.json'
  ]);
  assert.deepEqual(first.points.map(point => point.reason), ['intro', 'verse', 'build', 'drop', 'break', 'peak']);
  assert.deepEqual(first.points.map(point => point.morphDurationSec), [4, 2, 2.5, 1, 2.5, 1]);
  assert.deepEqual(first.points.map(point => point.morphCurve), ['easeInOut', 'easeInOut', 'easeInOut', 'exponential', 'easeInOut', 'exponential']);
  // Dynamic intensity: low-energy labels (intro, break) < 1, high-energy labels (drop, peak) > 1
  const findByReason = (reason) => first.points.find(p => p.reason === reason);
  assert.ok(findByReason('intro').intensity < 1.0, 'intro intensity should be < 1');
  assert.ok(findByReason('break').intensity < 1.0, 'break intensity should be < 1');
  assert.ok(findByReason('drop').intensity > 1.0, 'drop intensity should be > 1');
  assert.ok(findByReason('peak').intensity > findByReason('drop').intensity, 'peak intensity should exceed drop');
});

test('generatePerformancePlan falls back gracefully for empty or unmatched preset lists', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 10, 'intro', 'melody'),
    createSection(12, 24, 'drop', 'impact'),
    createSection(36, 48, 'verse', 'vocal')
  ]);

  const emptyPresetPlan = await generatePerformancePlan(trackAnalysis, [], 60);
  assert.deepEqual(emptyPresetPlan.points.map(point => point.preset), ['default.json', 'default.json', 'default.json']);
  assert.deepEqual(emptyPresetPlan.points.map(point => point.time), [0, 12, 36]);
  assert.equal(emptyPresetPlan.points[2].reason, 'verse');

  const unmatchedPresetPlan = await generatePerformancePlan(trackAnalysis, ['custom-a.json', 'custom-b.json'], 60);
  assert.deepEqual(unmatchedPresetPlan.points.map(point => point.preset), ['custom-a.json', 'custom-a.json', 'custom-a.json']);
});

test('generatePerformancePlan scores custom preset metadata instead of relying on file names', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 16, 'build', 'pattern', 0.65, 0.7),
    createSection(16, 32, 'drop', 'impact', 0.95, 0.9),
    createSection(32, 48, 'break', 'break', 0.2, 0.25)
  ]);
  const presets = ['quiet-room.json', 'my-epic-drop.json', 'slow-burn-builder.json'];
  const options = {
    strategy: 'dramaturgy',
    strictPresets: [],
    strictBars: 8,
    strictMorph: 1,
    presetMetadata: {
      'quiet-room.json': {
        visualTuning: {
          particleEnergySpeed: 4,
          particleBeatSpeed: 8,
          shockwaveRadius: 0.2,
          temporalRingAlpha: 2
        },
        dramaturgyProfile: {
          breakRestraint: 1.8,
          dropDampening: 1.4
        }
      },
      'my-epic-drop.json': {
        visualTuning: {
          particleEnergySpeed: 72,
          particleBeatSpeed: 150,
          polygonFlash: 4,
          shockwaveSpeed: 9
        },
        dramaturgyProfile: {
          dropDampening: 0.2,
          fxChaos: 1.8
        }
      },
      'slow-burn-builder.json': {
        visualTuning: {
          particleEnergySpeed: 36,
          temporalRingSpeed: 9,
          temporalNetworkDistance: 6
        },
        dramaturgyProfile: {
          buildupIntensity: 1.9,
          dropDampening: 1
        }
      }
    }
  };

  const plan = await generatePerformancePlan(trackAnalysis, presets, 48, options);

  assert.equal(plan.points.find(point => point.reason === 'build')?.preset, 'slow-burn-builder.json');
  assert.equal(plan.points.find(point => point.reason === 'drop')?.preset, 'my-epic-drop.json');
  assert.equal(plan.points.find(point => point.reason === 'break')?.preset, 'quiet-room.json');
});

test('generatePerformancePlan anchors consecutive section boundaries deterministically', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody'),
    createSection(12, 24, 'intro', 'melody'),
    createSection(24, 36, 'intro', 'vocal'),
    createSection(36, 48, 'intro', 'vocal'),
    createSection(48, 60, 'build', 'pattern')
  ]);

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal2.json'], 60);

  assert.deepEqual(plan.points.map(point => point.time), [0, 12, 24, 36, 48]);
  assert.deepEqual(plan.points.map(point => point.sectionId), [
    '0:intro:0-000',
    '1:intro:12-000',
    '2:intro:24-000',
    '3:intro:36-000',
    '4:build:48-000'
  ]);
});

test('generatePerformancePlan keeps same-label major energy drops with contrast bypass pacing', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 10, 'intro', 'melody', 0.25),
    createSection(10, 20, 'build', 'pattern', 0.8),
    createSection(22, 32, 'build', 'pattern', 0.2),
    createSection(34, 44, 'drop', 'impact', 0.95)
  ]);

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json'], 240);

  assert.ok(plan.points.some(point => point.time === 22));
  assert.equal(plan.points.find(point => point.time === 22)?.sectionId, '2:build:22-000');
  assert.ok(plan.points.some(point => point.time === 34));
});

test('generatePerformancePlan detects lower energy and perceived loudness shifts', async () => {
  const energyShift = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody', 0.4),
    createSection(12, 24, 'intro', 'melody', 0.55)
  ]);
  const loudnessShift = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody', 0.4),
    { ...createSection(12, 24, 'intro', 'melody', 0.45), avgRms: 0.53 }
  ]);

  assert.deepEqual((await generatePerformancePlan(energyShift, ['default.json'], 48)).points.map(point => point.time), [0, 12]);
  assert.deepEqual((await generatePerformancePlan(loudnessShift, ['default.json'], 48)).points.map(point => point.time), [0, 12]);
});

test('generatePerformancePlan prioritizes primary section anchors before nearby cue events', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 20, 'intro', 'melody', 0.3),
    createSection(20, 40, 'build', 'pattern', 0.6),
    createSection(40, 60, 'drop', 'impact', 0.95)
  ]);
  trackAnalysis.significantMoments = [
    createCue(21, 'break', 1)
  ];

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json', 'temporal5.json'], 240);

  assert.ok(plan.points.some(point => point.time === 20 && point.sectionId === '1:build:20-000'));
  assert.ok(plan.points.some(point => point.time === 21 && point.reason === 'break'));
});

test('generatePerformancePlan preserves section starts and snaps cue automation to musical bar starts', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0.2, 17.5, 'intro', 'melody', 0.25),
    createSection(17.7, 34.2, 'build', 'pattern', 0.65),
    createSection(34.4, 50.8, 'drop', 'impact', 0.95)
  ]);
  trackAnalysis.bars = createBars([0, 8, 16, 24, 32, 40, 48]);
  trackAnalysis.significantMoments = [
    createCue(41.2, 'impact')
  ];

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json'], 64);

  assert.deepEqual(plan.points.map(point => point.time), [0.2, 17.7, 34.4, 42]);
  assert.equal(plan.points.find(point => point.reason === 'drop')?.time, 34.4);
});

test('generatePerformancePlan adds significant cue points in long sections', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 24, 'intro', 'melody'),
    createSection(24, 54, 'verse', 'melody'),
    createSection(54, 72, 'drop', 'impact')
  ]);
  trackAnalysis.significantMoments = [
    createCue(10, 'impact'),
    createCue(17, 'break'),
    createCue(34, 'impact'),
    createCue(43, 'break')
  ];

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal3.json', 'temporal5.json'], 72);

  assert.deepEqual(plan.points.map(point => point.time), [0, 10, 17, 24, 34, 43, 54]);
  assert.deepEqual(plan.points.map(point => point.reason), ['intro', 'intro', 'break', 'verse', 'verse', 'break', 'drop']);
  assert.equal(plan.points.find(point => point.time === 43)?.preset, 'default.json');
});

test('generatePerformancePlan scales pacing gaps proportionally to track length', async () => {
  const sections = [
    createSection(0, 20, 'intro', 'melody', 0.2),
    createSection(20, 40, 'build', 'pattern', 0.5),
    createSection(40, 60, 'drop', 'impact', 0.8),
    createSection(60, 80, 'break', 'break', 0.5),
    createSection(80, 100, 'build', 'pattern', 0.75),
    createSection(100, 120, 'peak', 'fx', 0.9),
    createSection(120, 140, 'break', 'break', 0.6),
    createSection(140, 160, 'drop', 'impact', 0.85),
    createSection(160, 180, 'outro', 'melody', 0.55)
  ];
  const analysis = createTrackAnalysis(sections);

  const shortPlan = await generatePerformancePlan(analysis, ['default.json', 'temporal3.json', 'temporal5.json'], 240);
  const longPlan = await generatePerformancePlan(analysis, ['default.json', 'temporal3.json', 'temporal5.json'], 960);

  assert.equal(shortPlan.points[0].time, 0);
  assert.equal(longPlan.points[0].time, 0);
  assert.deepEqual(shortPlan.points.map(point => point.time), longPlan.points.map(point => point.time));
  assert.deepEqual(shortPlan.points.map(point => point.time), [0, 20, 40, 60, 80, 100, 120, 140, 160]);
});

test('generatePerformancePlan assigns dynamic intensity proportional to section label and energy', async () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 16, 'intro', 'melody', 0.2, 0.2),
    createSection(16, 32, 'build', 'pattern', 0.6, 0.5),
    createSection(32, 48, 'drop', 'impact', 0.95, 0.9),
    createSection(48, 64, 'break', 'break', 0.15, 0.2),
    createSection(64, 80, 'peak', 'fx', 1.0, 1.0)
  ]);

  const plan = await generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json', 'temporal4.json', 'temporal5.json'], 90);

  const byReason = (reason) => plan.points.find(p => p.reason === reason);

  // Intro and break are restrained sections - intensity below 1.0
  assert.ok(byReason('intro').intensity < 1.0, `intro: ${byReason('intro').intensity}`);
  assert.ok(byReason('break').intensity < 1.0, `break: ${byReason('break').intensity}`);

  // Drop and peak are high-energy sections - intensity above 1.0
  assert.ok(byReason('drop').intensity > 1.0, `drop: ${byReason('drop').intensity}`);
  assert.ok(byReason('peak').intensity > 1.0, `peak: ${byReason('peak').intensity}`);

  // Peak is the highest-energy label - exceeds drop
  assert.ok(byReason('peak').intensity > byReason('drop').intensity,
    `peak (${byReason('peak').intensity}) should exceed drop (${byReason('drop').intensity})`);

  // All intensities are finite positive numbers
  assert.ok(plan.points.every(p => Number.isFinite(p.intensity) && p.intensity > 0));
});

test('weak-grid sections produce novelty timing mode and damped confidence', async () => {
  // A beatless/low-grid track: section boundaries came from novelty, not bars.
  const weak = createTrackAnalysis([
    { ...createSection(0, 20, 'verse', 'melody', 0.4, 0.4), reasons: ['low-grid-confidence', 'novelty-peak'] },
    { ...createSection(20, 45, 'drop', 'impact', 0.9, 0.8), reasons: ['low-grid-confidence', 'novelty-peak', 'energy-rise'] }
  ]);
  weak.bpm = 0;
  weak.bpmConfidence = 0.1;
  weak.gridConfidence = 0.1;
  weak.timingConfidence = { tempo: 0.1, beat: 0.1, grid: 0.1, overall: 0.1 };
  weak.boundaryCandidates = [
    { time: 20, confidence: 0.9, timingMode: 'novelty', reasons: ['low-grid-confidence', 'novelty-peak', 'energy-rise'] }
  ];

  const strong = createTrackAnalysis([
    { ...createSection(0, 20, 'verse', 'melody', 0.4, 0.4), reasons: ['bar-aligned'] },
    { ...createSection(20, 45, 'drop', 'impact', 0.9, 0.8), reasons: ['bar-aligned', 'energy-rise'] }
  ]);
  strong.bpm = 124;
  strong.bpmConfidence = 0.92;
  strong.gridConfidence = 0.9;
  strong.timingConfidence = { tempo: 0.9, beat: 0.9, grid: 0.9, overall: 0.9 };

  const weakPlan = await generatePerformancePlan(weak, ['default.json'], 45);
  const strongPlan = await generatePerformancePlan(strong, ['default.json'], 45);

  const weakDrop = weakPlan.points.find(p => p.reason === 'drop');
  const strongDrop = strongPlan.points.find(p => p.reason === 'drop');
  assert.ok(weakDrop && strongDrop);

  // Novelty-driven boundary on an untrusted grid is flagged 'novelty', never bar-aligned.
  assert.equal(weakDrop.timingMode, 'novelty');
  assert.equal(strongDrop.timingMode, 'bar-aligned');

  // Critically low overall timing confidence damps the automation point confidence.
  assert.ok(weakDrop.confidence < strongDrop.confidence,
    `weak drop confidence ${weakDrop.confidence} should be < strong ${strongDrop.confidence}`);
  assert.ok((weakDrop.analysisConfidence ?? 1) <= 0.2);
});

test('weak-grid automation timing mode follows the section start boundary candidate', async () => {
  const weak = createTrackAnalysis([
    { ...createSection(0, 20, 'verse', 'melody', 0.4, 0.4), reasons: ['low-grid-confidence', 'novelty-peak'] },
    { ...createSection(20, 45, 'drop', 'impact', 0.9, 0.8), reasons: ['low-grid-confidence', 'weak-evidence-fallback'] }
  ]);
  weak.bpm = 0;
  weak.bpmConfidence = 0.1;
  weak.gridConfidence = 0.1;
  weak.timingConfidence = { tempo: 0.1, beat: 0.1, grid: 0.1, overall: 0.1 };
  weak.boundaryCandidates = [
    { time: 20, confidence: 0.9, timingMode: 'novelty', reasons: ['low-grid-confidence', 'novelty-peak', 'energy-rise'] },
    { time: 45, confidence: 0.35, timingMode: 'energy-reactive', reasons: ['low-grid-confidence', 'weak-evidence-fallback'] }
  ];

  const plan = await generatePerformancePlan(weak, ['default.json'], 45);
  const drop = plan.points.find(p => p.reason === 'drop');
  assert.ok(drop);
  assert.equal(drop.timingMode, 'novelty');
});
