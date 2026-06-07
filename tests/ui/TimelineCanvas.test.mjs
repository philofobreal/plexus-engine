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

function createMockCanvas() {
  const context = createMockContext();
  return {
    context,
    width: 0,
    height: 0,
    clientWidth: 200,
    clientHeight: 80,
    getBoundingClientRect() {
      return { width: 200, height: 80 };
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
  assert.ok(gradients.some(gradient => gradient.stops.some(stop => stop[1] === 'rgba(213, 84, 172, 0.28)') && gradient.stops.some(stop => stop[1] === 'rgba(0, 229, 255, 0.01)')));
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
