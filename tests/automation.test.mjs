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

test('generatePerformancePlan creates deterministic section-aligned automation plans', () => {
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

  const first = generatePerformancePlan(trackAnalysis, presets, 90);
  const second = generatePerformancePlan(trackAnalysis, presets, 90);

  assert.deepEqual(second, first);
  assert.equal(first.version, 1);
  assert.equal(first.source, 'auto');
  assert.deepEqual(first.points.map(point => point.time), [0, 14, 28.5, 52, 68.5]);
  assert.deepEqual(first.points.map(point => point.sectionId), [
    '0:intro:0-000',
    '2:build:14-000',
    '3:drop:30-000',
    '4:break:52-000',
    '5:peak:70-000'
  ]);
  assert.deepEqual(first.points.map(point => point.preset), [
    'default.json',
    'club-temporal1.json',
    'wide-temporal3.json',
    'ambient-temporal5.json',
    'peak-temporal4.json'
  ]);
  assert.deepEqual(first.points.map(point => point.reason), ['intro', 'build', 'drop', 'break', 'peak']);
  assert.deepEqual(first.points.map(point => point.morphDurationSec), [4, 2.5, 1, 2.5, 1]);
  assert.deepEqual(first.points.map(point => point.morphCurve), ['easeInOut', 'easeInOut', 'exponential', 'easeInOut', 'exponential']);
  assert.ok(first.points.every(point => point.intensity === 1));
});

test('generatePerformancePlan falls back gracefully for empty or unmatched preset lists', () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 10, 'intro', 'melody'),
    createSection(12, 24, 'drop', 'impact'),
    createSection(36, 48, 'verse', 'vocal')
  ]);

  const emptyPresetPlan = generatePerformancePlan(trackAnalysis, [], 60);
  assert.deepEqual(emptyPresetPlan.points.map(point => point.preset), ['default.json', 'default.json', 'default.json']);
  assert.deepEqual(emptyPresetPlan.points.map(point => point.time), [0, 10.5, 36]);
  assert.equal(emptyPresetPlan.points[2].reason, 'harmonicShift');

  const unmatchedPresetPlan = generatePerformancePlan(trackAnalysis, ['custom-a.json', 'custom-b.json'], 60);
  assert.deepEqual(unmatchedPresetPlan.points.map(point => point.preset), ['custom-a.json', 'custom-a.json', 'custom-a.json']);
});

test('generatePerformancePlan filters identical consecutive sections for cleaner pacing', () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody'),
    createSection(12, 24, 'intro', 'melody'),
    createSection(24, 36, 'intro', 'vocal'),
    createSection(36, 48, 'intro', 'vocal'),
    createSection(48, 60, 'build', 'pattern')
  ]);

  const plan = generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal2.json'], 60);

  assert.deepEqual(plan.points.map(point => point.time), [0, 24, 48]);
  assert.deepEqual(plan.points.map(point => point.sectionId), [
    '0:intro:0-000',
    '2:intro:24-000',
    '4:build:48-000'
  ]);
});

test('generatePerformancePlan keeps same-label major energy drops with contrast bypass pacing', () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 10, 'intro', 'melody', 0.25),
    createSection(10, 20, 'build', 'pattern', 0.8),
    createSection(22, 32, 'build', 'pattern', 0.2),
    createSection(34, 44, 'drop', 'impact', 0.95)
  ]);

  const plan = generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json'], 240);

  assert.ok(plan.points.some(point => point.time === 22));
  assert.equal(plan.points.find(point => point.time === 22)?.sectionId, '2:build:22-000');
  assert.ok(plan.points.some(point => point.time === 32.5));
});

test('generatePerformancePlan detects lower energy and perceived loudness shifts', () => {
  const energyShift = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody', 0.4),
    createSection(12, 24, 'intro', 'melody', 0.55)
  ]);
  const loudnessShift = createTrackAnalysis([
    createSection(0, 12, 'intro', 'melody', 0.4),
    { ...createSection(12, 24, 'intro', 'melody', 0.45), avgRms: 0.53 }
  ]);

  assert.deepEqual(generatePerformancePlan(energyShift, ['default.json'], 48).points.map(point => point.time), [0, 12]);
  assert.deepEqual(generatePerformancePlan(loudnessShift, ['default.json'], 48).points.map(point => point.time), [0, 12]);
});

test('generatePerformancePlan prioritizes primary section anchors before nearby cue events', () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0, 20, 'intro', 'melody', 0.3),
    createSection(20, 40, 'build', 'pattern', 0.6),
    createSection(40, 60, 'drop', 'impact', 0.95)
  ]);
  trackAnalysis.significantMoments = [
    createCue(21, 'break', 1)
  ];

  const plan = generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json', 'temporal5.json'], 240);

  assert.ok(plan.points.some(point => point.time === 20 && point.sectionId === '1:build:20-000'));
  assert.ok(!plan.points.some(point => point.time === 21));
});

test('generatePerformancePlan snaps section and cue automation to musical bar starts', () => {
  const trackAnalysis = createTrackAnalysis([
    createSection(0.2, 17.5, 'intro', 'melody', 0.25),
    createSection(17.7, 34.2, 'build', 'pattern', 0.65),
    createSection(34.4, 50.8, 'drop', 'impact', 0.95)
  ]);
  trackAnalysis.bars = createBars([0, 8, 16, 24, 32, 40, 48]);
  trackAnalysis.significantMoments = [
    createCue(41.2, 'impact')
  ];

  const plan = generatePerformancePlan(trackAnalysis, ['default.json', 'temporal1.json', 'temporal3.json'], 64);

  assert.deepEqual(plan.points.map(point => point.time), [0, 16, 24, 40]);
  assert.equal(plan.points.find(point => point.reason === 'drop')?.time, 24);
});

test('generatePerformancePlan adds significant cue points in long sections', () => {
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

  const plan = generatePerformancePlan(trackAnalysis, ['default.json', 'temporal3.json', 'temporal5.json'], 72);

  assert.deepEqual(plan.points.map(point => point.time), [0, 10, 24, 34, 43, 52.5]);
  assert.deepEqual(plan.points.map(point => point.reason), ['intro', 'intro', 'harmonicShift', 'harmonicShift', 'break', 'drop']);
  assert.equal(plan.points.find(point => point.time === 43)?.preset, 'default.json');
});

test('generatePerformancePlan scales pacing gaps proportionally to track length', () => {
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

  const shortPlan = generatePerformancePlan(analysis, ['default.json', 'temporal3.json', 'temporal5.json'], 240);
  const longPlan = generatePerformancePlan(analysis, ['default.json', 'temporal3.json', 'temporal5.json'], 960);

  assert.equal(shortPlan.points[0].time, 0);
  assert.equal(longPlan.points[0].time, 0);
  assert.ok(shortPlan.points.length > longPlan.points.length);
  assert.ok(shortPlan.points.slice(1).every((point, index) => point.time - shortPlan.points[index].time >= 8));
  assert.ok(longPlan.points.slice(1).every((point, index) => point.time - longPlan.points[index].time >= 32));
});
