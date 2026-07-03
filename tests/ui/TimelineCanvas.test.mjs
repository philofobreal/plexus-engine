import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { devicePixelRatio: 1 };
globalThis.document = {
  createElement() {
    return createMockCanvas();
  }
};

const { TimelineCanvas } = await import('../../src/ui/TimelineCanvas.ts');

function createMockContext() {
  const calls = [];
  return {
    calls,
    setTransform() {},
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    drawImage() {},
    beginPath() { calls.push(['beginPath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    closePath() {},
    rect(...args) { calls.push(['rect', ...args]); },
    clip() { calls.push(['clip']); },
    arc(...args) { calls.push(['arc', ...args]); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
    save() {},
    restore() {},
    setLineDash(value) { calls.push(['setLineDash', value]); },
    measureText(value) {
      return { width: String(value).length * 6 };
    },
    fillText(...args) { calls.push(['fillText', ...args]); },
    createLinearGradient() {
      const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
      calls.push(['createLinearGradient', gradient]);
      return gradient;
    }
  };
}

function createMockCanvas(width = 200, height = 80) {
  const context = createMockContext();
  return {
    context,
    width: 0,
    height: 0,
    clientWidth: width,
    clientHeight: height,
    getBoundingClientRect() {
      return { width, height };
    },
    getContext() {
      return context;
    }
  };
}

function createMockAudioBuffer(samples) {
  return {
    numberOfChannels: 1,
    length: samples.length,
    duration: samples.length / 1000,
    getChannelData() {
      return samples;
    }
  };
}

function assertFiniteDrawCoordinates(calls, kinds) {
  for (const call of calls) {
    if (!kinds.includes(call[0])) continue;
    for (const coordinate of call.slice(1)) {
      assert.equal(Number.isFinite(coordinate), true, `${call[0]} received invalid coordinate: ${coordinate}`);
    }
  }
}

test('TimelineCanvas computes cached RMS waveform amplitudes from an AudioBuffer', () => {
  const canvas = new TimelineCanvas(createMockCanvas());
  canvas.setAudioBuffer(createMockAudioBuffer(new Float32Array([0, 0.25, -0.25, 1, -1, 0.5, -0.5, 0])));

  const peaks = canvas.getWaveformPeaks();
  assert.ok(peaks.length >= 512);
  assert.ok(peaks.some(value => value > 0.9));
  assert.ok(peaks.every(value => value >= 0 && value <= 1));
});

test('TimelineCanvas render accepts invalid zoom and pan without throwing', () => {
  const canvas = new TimelineCanvas(createMockCanvas());
  assert.doesNotThrow(() => canvas.render({
    isExporting: false,
    exportTime: 0,
    currentTime: 10,
    duration: 20,
    zoom: -5,
    pan: Number.POSITIVE_INFINITY,
    bpm: 120,
    sampleRate: 44100,
    hopSize: 1024,
    frames: [],
    sections: [],
    bars: [],
    cues: [],
    significantMoments: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    performancePlan: null,
    audioSensitivity: 1,
    dropAnticipation: 0,
    scrubTime: null
  }));
});

test('TimelineCanvas renders performance automation plan lane with viewport scaling', () => {
  const mockCanvas = createMockCanvas();
  const canvas = new TimelineCanvas(mockCanvas);

  assert.doesNotThrow(() => canvas.render({
    isExporting: false,
    exportTime: 0,
    currentTime: 0,
    duration: 40,
    zoom: 2,
    pan: 10,
    bpm: 120,
    sampleRate: 44100,
    hopSize: 1024,
    frames: [],
    sections: [
      { start: 0, end: 20, label: 'intro', energy: 0.2, density: 0.2, dominantFeature: 'melody', avgRms: 0.2, peakRms: 0.3 },
      { start: 20, end: 40, label: 'drop', energy: 0.9, density: 0.8, dominantFeature: 'impact', avgRms: 0.9, peakRms: 1 }
    ],
    bars: [],
    cues: [],
    significantMoments: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    performancePlan: {
      version: 1,
      source: 'auto',
      points: [
        {
          id: 'visible',
          time: 20,
          sectionId: 'section-1',
          preset: 'temporal3.json',
          confidence: 0.9,
          intensity: 4,
          reason: 'drop',
          morphDurationSec: 1,
          morphCurve: 'exponential',
          locked: true
        },
        {
          id: 'hidden',
          time: 35,
          sectionId: 'section-2',
          preset: 'temporal4.json',
          confidence: 0.9,
          intensity: 1,
          reason: 'peak',
          morphDurationSec: 1,
          morphCurve: 'exponential'
        }
      ]
    },
    hoveredPointId: 'visible',
    hoveredHandleType: 'curve',
    audioSensitivity: 1,
    dropAnticipation: 0,
    scrubTime: null
  }));

  const calls = mockCanvas.context.calls;
  const gradients = calls.filter(call => call[0] === 'createLinearGradient').map(call => call[1]);
  assert.ok(calls.some(call => call[0] === 'fillRect' && call[1] === 90 && call[2] === 18 && call[3] === 20 && call[4] === 62));
  assert.ok(calls.some(call => call[0] === 'lineTo' && Math.abs(call[1] - 100) < 0.001 && call[2] === 75));
  assert.ok(gradients.some(gradient => gradient.stops.some(stop => stop[1] === 'rgba(213, 84, 172, 0.08)') && gradient.stops.some(stop => stop[1] === 'rgba(0, 229, 255, 0.01)')));
  assert.ok(!gradients.some(gradient => gradient.stops.some(stop => stop[1] === 'rgba(213, 84, 172, 0.28)')));
  assert.ok(calls.some(call => call[0] === 'setLineDash' && Array.isArray(call[1]) && call[1][0] === 2 && call[1][1] === 4));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 100.5 && call[2] === 18));
  assert.ok(calls.some(call => call[0] === 'lineTo' && call[1] === 100.5 && call[2] === 80));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 100 && call[2] === 18));
  assert.ok(calls.some(call => call[0] === 'lineTo' && Math.abs(call[1] - 100) < 0.001 && call[2] === 18));
  const exponentialMidY = 18 + (75 - 18) * Math.pow(2, 10 * (8 / 15) - 10);
  assert.ok(calls.some(call => call[0] === 'lineTo' && Math.abs(call[1] - 105.33333333333333) < 0.001 && Math.abs(call[2] - exponentialMidY) < 0.001));
  assert.ok(calls.some(call => call[0] === 'lineTo' && Math.abs(call[1] - 110) < 0.001 && call[2] === 75));
  assert.ok(calls.some(call => call[0] === 'moveTo' && Math.abs(call[1] - 110.5) < 0.001 && call[2] === 18));
  assert.ok(calls.some(call => call[0] === 'lineTo' && Math.abs(call[1] - 110.5) < 0.001 && call[2] === 80));
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '< >' && Math.abs(call[2] - 103) < 0.001 && call[3] === 20));
  assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 100 && call[2] === 14));
  assert.ok(calls.some(call => call[0] === 'lineTo' && call[1] === 104 && call[2] === 18));
  assert.ok(calls.some(call => call[0] === 'lineTo' && call[1] === 96 && call[2] === 18));
  assert.ok(calls.some(call => call[0] === 'rect' && call[1] === 100 && call[2] === 18 && call[3] === 100 && call[4] === 14));
  assert.ok(calls.some(call => call[0] === 'clip'));
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '...' && call[2] === 106 && call[3] === 22));
});

test('analyzer debug overlay is strictly gated by declarative render state', () => {
  const baseState = (showAnalyzerDebugOverlay) => ({
    isExporting: false, exportTime: 0, currentTime: 0, duration: 20, zoom: 1, pan: 0, bpm: 120,
    sampleRate: 44100, hopSize: 1024, frames: [], sections: [], bars: [], cues: [], significantMoments: [],
    buildupConfidence: [], spectralPivot: [], tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    noveltyCurve: [0.1, 0.9, 0.2],
    boundaryCandidates: [
      { time: 10, confidence: 0.9, timingMode: 'novelty', reasons: ['novelty-peak'] }
    ],
    showAnalyzerDebugOverlay,
    performancePlan: null, audioSensitivity: 1, dropAnticipation: 0, scrubTime: null
  });

  const countKind = (calls, kind) => calls.filter(call => call[0] === kind).length;

  const offCanvas = createMockCanvas();
  new TimelineCanvas(offCanvas).render(baseState(false));
  const off = offCanvas.context.calls;

  const onCanvas = createMockCanvas();
  new TimelineCanvas(onCanvas).render(baseState(true));
  const on = onCanvas.context.calls;

  // Flag OFF: the overlay must add zero draw work of any kind it owns (curve strokes + candidate dots).
  assert.equal(countKind(off, 'arc'), 0, 'no candidate dots when overlay is off');
  assert.equal(on.length > off.length, true, 'overlay must add draw calls only when enabled');

  // Flag ON: the novelty curve (lineTo + stroke) and the boundary-candidate dot (arc + fill) appear.
  assert.equal(countKind(on, 'arc') >= 1, true, 'candidate dots drawn when overlay is on');
  assert.equal(countKind(on, 'lineTo') > countKind(off, 'lineTo'), true, 'novelty curve adds lineTo calls when on');
  assert.equal(countKind(on, 'stroke') > countKind(off, 'stroke'), true, 'novelty curve adds a stroke when on');
  assert.equal(countKind(on, 'fill') > countKind(off, 'fill'), true, 'candidate dots add fill calls when on');
  assertFiniteDrawCoordinates(on, ['moveTo', 'lineTo', 'arc']);
});

test('analyzer debug overlay caps novelty curve sampling on wide timelines', () => {
  const wideCanvas = createMockCanvas(4000, 120);
  const curve = Array.from({ length: 4096 }, (_, i) => (i % 128) / 127);

  new TimelineCanvas(wideCanvas).render({
    isExporting: false, exportTime: 0, currentTime: 0, duration: 120, zoom: 1, pan: 0, bpm: 120,
    sampleRate: 44100, hopSize: 1024, frames: [], sections: [], bars: [], cues: [], significantMoments: [],
    buildupConfidence: [], spectralPivot: [], tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    noveltyCurve: curve,
    boundaryCandidates: [],
    showAnalyzerDebugOverlay: true,
    performancePlan: null, audioSensitivity: 1, dropAnticipation: 0, scrubTime: null
  });

  const lineToCount = wideCanvas.context.calls.filter(call => call[0] === 'lineTo').length;
  assert.ok(lineToCount <= 1500, `wide debug overlay should cap lineTo calls, got ${lineToCount}`);
  assertFiniteDrawCoordinates(wideCanvas.context.calls, ['moveTo', 'lineTo']);
});

test('TimelineCanvas identifies an active global morph scale in the automation lane', () => {
  const mockCanvas = createMockCanvas();
  new TimelineCanvas(mockCanvas).render({
    isExporting: false, exportTime: 0, currentTime: 0, duration: 20, zoom: 1, pan: 0, bpm: 120,
    sampleRate: 44100, hopSize: 1024, frames: [], sections: [], bars: [], cues: [], significantMoments: [],
    buildupConfidence: [], spectralPivot: [], tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    performancePlan: { version: 1, source: 'edited', points: [{ id: 'a', time: 1, sectionId: 'a', preset: 'default.json', confidence: 1, intensity: 1, reason: 'manual', morphDurationSec: 4, morphCurve: 'easeInOut' }] },
    automationMorphScale: 2, timelineLayers: { waveform: false, rms: false, buildup: false, cues: false, automation: true },
    snapToGrid: true, selectedPointId: null, followPlayhead: false, hoveredPointId: null, hoveredHandleType: null,
    audioSensitivity: 1, dropAnticipation: 0, videoDominantColor: { r: 0, g: 0, b: 0 }, gridOffset: 0
  });
  assert.ok(mockCanvas.context.calls.some(call => call[0] === 'fillText' && String(call[1]).includes('[200%]')));
});
