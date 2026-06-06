import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualDirectorFSM } from '../src/visuals/VisualDirectorFSM.ts';

const baseFrame = {
  e: 0.7,
  b: 0.4,
  m: 0.3,
  t: 0.2,
  state: 'HIGH',
  eRatio: 0.7
};

const baseFeatures = {
  melody: 0.5,
  vocal: 0.4,
  fx: 0.3,
  density: 0.6,
  brightness: 0.5,
  tension: 0.4
};

const baseTuning = {
  audioSensitivity: 1,
  transitionSpeed: 0.08,
  dynamicsThreshold: 0.45,
  dropThreshold: 0.35,
  dropAnticipation: 0,
  phraseSize: 4,
  chromaKeyMode: 0,
  performanceMode: 0,
  backgroundRed: 8,
  backgroundGreen: 5,
  backgroundBlue: 14,
  particleIdleSpeed: 0.2,
  particleEnergySpeed: 8,
  particleBeatSpeed: 20,
  particleBoundaryPull: 0.05,
  particleActivityTurn: 0.1,
  shockwaveRadius: 1,
  shockwaveSpeed: 1,
  shockwaveAlpha: 1,
  shockwaveThickness: 1,
  shockwaveExpansion: 0.05,
  shockwaveDecay: 5,
  circleBackgroundHue: 205,
  circleBackgroundAlpha: 1,
  circleHue: 205,
  circleAlpha: 1,
  circleSize: 1,
  circleLineWeight: 1,
  lineHue: 200,
  lineAlpha: 1,
  lineDistance: 1,
  lineWeight: 1,
  polygonHue: 210,
  polygonAlpha: 1,
  polygonSize: 1,
  polygonFlash: 1,
  temporalRingSize: 1,
  temporalRingAlpha: 1,
  temporalRingSpeed: 1,
  temporalNetworkDistance: 1,
  temporalPolygonAlpha: 1,
  morphDurationSec: 3,
  morphCurveValue: 1,
  buildupIntensity: 1,
  dropDampening: 1,
  breakRestraint: 1,
  vocalHighlight: 1,
  fxChaos: 1
};

const baseModulation = {
  kineticTension: 0.5,
  densityDrive: 0.4,
  spectralChaos: 0.3,
  rhythmicImpulse: 0.2,
  macroMomentum: 0.25
};

const clone = value => structuredClone(value);

test('VisualDirectorFSM returns deterministic DROP output for a high-energy frame', () => {
  const director = new VisualDirectorFSM();
  const frame = clone(baseFrame);
  const features = clone(baseFeatures);
  const modulation = clone(baseModulation);

  assert.deepEqual(
    director.update(0, frame, features, 0, 0, baseTuning, modulation),
    {
      state: 'DROP',
      centripetalOrbit: 0,
      glitchIntensity: 0,
      invertBackground: false
    }
  );
  assert.equal(frame.state, 'HIGH');
  assert.deepEqual(features, baseFeatures);
  assert.deepEqual(modulation, baseModulation);
});

test('VisualDirectorFSM dampens low-state modulation and feature copies', () => {
  const director = new VisualDirectorFSM();
  const frame = { ...baseFrame, eRatio: 0.2 };
  const features = clone(baseFeatures);
  const modulation = clone(baseModulation);
  const tuning = { ...baseTuning, breakRestraint: 0.5 };

  const output = director.update(0, frame, features, 0, 0, tuning, modulation);

  assert.equal(output.state, 'INTRO_BREAK');
  assert.equal(frame.state, 'LOW');
  assert.equal(modulation.densityDrive, 0.4 * 0.15 * 0.5);
  assert.equal(modulation.kineticTension, 0.5 * 0.20 * 0.5);
  assert.equal(modulation.macroMomentum, 0.25 * 0.10 * 0.5);
  assert.equal(features.melody, 0.5 * 0.20 * 0.5);
  assert.equal(features.vocal, 0.4 * 0.20 * 0.5);
  assert.equal(features.fx, 0.3 * 0.15 * 0.5);
});

test('VisualDirectorFSM applies look-ahead drop anticipation inside the FSM', () => {
  const director = new VisualDirectorFSM();
  const frame = clone(baseFrame);
  const features = clone(baseFeatures);
  const modulation = clone(baseModulation);
  const tuning = { ...baseTuning, dropAnticipation: 2, dropDampening: 0.5 };
  const futureFrame = { ...baseFrame, state: 'LOW_DROP' };

  const output = director.update(12, frame, features, 0, 0, tuning, modulation, futureFrame);

  assert.equal(output.state, 'DROP');
  assert.equal(modulation.kineticTension, 0.5 * 0.72 * 0.5);
  assert.equal(modulation.densityDrive, 0.4 * 0.72 * 0.5);
  assert.equal(modulation.macroMomentum, 0.25);
});

test('VisualDirectorFSM boosts buildup tension and exposes centripetal orbit', () => {
  const director = new VisualDirectorFSM();
  const frame = clone(baseFrame);
  const features = clone(baseFeatures);
  const modulation = clone(baseModulation);
  const tuning = { ...baseTuning, buildupIntensity: 2 };

  const output = director.update(3, frame, features, 0.75, 0, tuning, modulation);

  assert.equal(output.state, 'BUILDUP');
  assert.equal(output.centripetalOrbit, 0.75);
  assert.equal(modulation.kineticTension, Math.min(1, 0.5 + 0.75 * 0.18 * 2));
  assert.equal(modulation.macroMomentum, Math.max(0.25, 0.75 * 0.35 * 2));
});

test('VisualDirectorFSM maps low-drop into glitch output and mutates frame state compatibly', () => {
  const director = new VisualDirectorFSM();
  const frame = { ...baseFrame, e: 0.2, eRatio: 0.8 };
  const features = clone(baseFeatures);
  const modulation = clone(baseModulation);

  const output = director.update(0, frame, features, 0, 0, baseTuning, modulation);

  assert.equal(output.state, 'GLITCH_LOW_DROP');
  assert.equal(output.glitchIntensity, 1);
  assert.equal(output.invertBackground, false);
  assert.equal(frame.state, 'LOW_DROP');
});
