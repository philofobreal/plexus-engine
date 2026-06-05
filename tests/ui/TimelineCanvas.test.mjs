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
  return {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    setLineDash() {},
    measureText(value) {
      return { width: String(value).length * 6 };
    },
    fillText() {},
    createLinearGradient() {
      return { addColorStop() {} };
    }
  };
}

function createMockCanvas() {
  return {
    width: 0,
    height: 0,
    clientWidth: 200,
    clientHeight: 80,
    getBoundingClientRect() {
      return { width: 200, height: 80 };
    },
    getContext() {
      return createMockContext();
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
    sectionOverrides: {},
    audioSensitivity: 1,
    dropAnticipation: 0,
    scrubTime: null
  }));
});
