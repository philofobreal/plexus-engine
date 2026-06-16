import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const STYLE_IDS = ['classic', 'temporal', 'dark-techno', 'organic-ambient', 'cyberpunk', 'hero'];
const PHASES = ['INTRO', 'BUILDUP', 'DROP', 'BREAK'];

function createSrcLoader() {
  const moduleCache = new Map();

  function resolvePath(request, parentPath) {
    if (request === 'p5') return 'p5';
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    return base.endsWith('.ts') ? base : `${base}.ts`;
  }

  function load(filePath) {
    if (filePath === 'p5') return { default: class MockP5 {} };
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText;

    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      console,
      Math,
      Error
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

class MockRendererBackend {
  width = 960;
  height = 540;
  frameCount = 1;
  counts = {
    background: 0,
    noStroke: 0,
    noFill: 0,
    fill: 0,
    stroke: 0,
    strokeWeight: 0,
    line: 0,
    circle: 0,
    triangle: 0,
    beginShape: 0,
    vertex: 0,
    endShape: 0,
    radialGlow: 0
  };

  background(...args) { this.count('background', args); }
  noStroke(...args) { this.count('noStroke', args); }
  noFill(...args) { this.count('noFill', args); }
  fill(...args) { this.count('fill', args); }
  stroke(...args) { this.count('stroke', args); }
  strokeWeight(...args) { this.count('strokeWeight', args); }
  line(...args) { this.count('line', args); }
  circle(...args) { this.count('circle', args); }
  triangle(...args) { this.count('triangle', args); }
  beginShape(...args) { this.count('beginShape', args); }
  vertex(...args) { this.count('vertex', args); }
  endShape(...args) { this.count('endShape', args); }
  radialGlow(...args) { this.count('radialGlow', args); }

  count(name, args) {
    for (const value of args) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${name} received non-finite number`);
      if (Array.isArray(value)) {
        for (const item of value) assert.ok(Number.isFinite(item), `${name} received non-finite array value`);
      }
    }
    this.counts[name]++;
  }

  signature() {
    return Object.entries(this.counts).map(([key, value]) => `${key}:${value}`).join('|');
  }
}

class MockParticle {
  constructor(index) {
    const col = index % 10;
    const row = Math.floor(index / 10);
    this.pos = {
      x: 130 + col * 78 + Math.sin(index * 1.7) * 18,
      y: 82 + row * 64 + Math.cos(index * 2.1) * 15
    };
    this.vel = {
      x: Math.cos(index * 0.73),
      y: Math.sin(index * 0.73),
      normalize() {
        const len = Math.hypot(this.x, this.y) || 1;
        this.x /= len;
        this.y /= len;
        return this;
      },
      heading() {
        return Math.atan2(this.y, this.x);
      },
      set(x, y) {
        this.x = x;
        this.y = y;
        return this.normalize();
      }
    };
    this.vel.normalize();
  }

  update(energy, activity, beat, isPlaying, centripetalOrbit = 0) {
    const speed = isPlaying ? 0.25 + energy * 1.9 + beat * 2.7 + activity * 0.8 : 0.1;
    const turn = activity * 0.05 + centripetalOrbit * 0.04;
    const nextX = this.vel.x * Math.cos(turn) - this.vel.y * Math.sin(turn);
    const nextY = this.vel.x * Math.sin(turn) + this.vel.y * Math.cos(turn);
    this.vel.set(nextX, nextY);
    this.pos.x += this.vel.x * speed;
    this.pos.y += this.vel.y * speed;
  }
}

class MockShockwave {
  constructor(seed) {
    this.r = 20 + seed * 7;
    this.alpha = 160 - seed * 6;
    this.speed = 5 + seed;
  }

  update() {
    this.r += this.speed;
    this.alpha -= 9;
  }

  draw(backend, cx, cy) {
    backend.noFill();
    backend.stroke(220, 220, 220, this.alpha);
    backend.strokeWeight(1.5);
    backend.circle(cx, cy, this.r * 2);
  }
}

function createParticles() {
  return Array.from({ length: 48 }, (_, index) => new MockParticle(index));
}

function createShockwaves(frame) {
  return frame % 15 === 0 ? [new MockShockwave(frame / 15)] : [];
}

function audioFrame(e, density, melody, fx, state) {
  return { e, densityProj: density, melodyProj: melody, fxProj: fx, state, eRatio: e };
}

function visualFeatures(melody, vocal, fx, density, brightness, tension) {
  return { melody, vocal, fx, density, brightness, tension };
}

function buildFrames(profile) {
  const frames = [];
  const features = [];
  const phases = [
    { state: 'IDLE', label: 'intro', start: 0, end: 15, mult: 0.45 },
    { state: 'HIGH', label: 'build', start: 15, end: 30, mult: 0.85 },
    { state: profile.dropState, label: 'drop', start: 30, end: 45, mult: 1 },
    { state: 'LOW', label: 'break', start: 45, end: 60, mult: 0.35 }
  ];

  for (let i = 0; i < 60; i++) {
    const phase = phases.find(item => i >= item.start && i < item.end);
    const pulse = profile.pulse(i);
    const slow = Math.sin(i * profile.slowRate) * 0.5 + 0.5;
    const energy = clamp01(profile.energy * phase.mult + pulse * profile.pulseGain + slow * profile.slowGain);
    const density = clamp01(profile.density * phase.mult + pulse * profile.densityPulse);
    const melody = clamp01(profile.melody * (0.7 + slow * 0.4));
    const vocal = clamp01(profile.vocal * (0.65 + slow * 0.55));
    const fx = clamp01(profile.fx * phase.mult + pulse * profile.fxPulse);
    const brightness = clamp01(profile.brightness * phase.mult + profile.spectralFlatness * 0.25);
    const tension = clamp01(profile.tension * phase.mult + (phase.label === 'build' ? 0.22 : 0) + (phase.label === 'drop' ? 0.16 : 0));
    frames.push(audioFrame(energy, density, melody, fx, phase.state));
    features.push(visualFeatures(melody, vocal, fx, density, brightness, tension));
  }
  return { frames, features, phases };
}

function buildTrackAnalysis(profile, frames, features, phases) {
  return {
    duration: 60,
    bars: [],
    sections: phases.map(phase => ({
      start: phase.start,
      end: phase.end,
      label: phase.label,
      energy: profile.energy * phase.mult,
      density: profile.density * phase.mult,
      dominantFeature: profile.dominantFeature,
      avgRms: profile.energy * phase.mult,
      peakRms: Math.min(1, profile.energy * phase.mult + 0.2)
    })),
    patterns: [{
      id: `${profile.id}-motif`,
      signature: `${profile.id}:motif`,
      label: 'drop',
      dominantFeature: profile.dominantFeature,
      occurrences: [
        { start: 18, end: 26, intensity: profile.patternIntensity, confidence: 0.82 },
        { start: 32, end: 42, intensity: profile.patternIntensity, confidence: 0.9 }
      ],
      averageEnergy: profile.energy,
      averageDensity: profile.density
    }],
    cues: [],
    significantMoments: [],
    features,
    buildupConfidence: frames.map((_, index) => index >= 15 && index < 30 ? (index - 15) / 15 : index >= 30 && index < 45 ? 1 : 0.15),
    spectralPivot: frames.map((_, index) => clamp01(profile.spectralFlatness + Math.sin(index * 0.2) * 0.08)),
    tensionTrends: {
      globalSlope: profile.tension,
      peakTime: 34,
      peakValue: profile.tension,
      segments: [{ start: 0, end: 60, startValue: 0.1, endValue: profile.tension, direction: 'rising', confidence: 0.85 }]
    },
    featureHopSize: 1024
  };
}

const referenceProfiles = [
  {
    id: 'peak-time-techno',
    name: 'Peak Time Techno',
    bpm: 128,
    energy: 0.78,
    density: 0.72,
    melody: 0.18,
    vocal: 0.08,
    fx: 0.54,
    brightness: 0.7,
    tension: 0.92,
    spectralFlatness: 0.42,
    pulseGain: 0.24,
    densityPulse: 0.2,
    fxPulse: 0.12,
    slowGain: 0.04,
    slowRate: 0.11,
    dropState: 'LOW_DROP',
    dominantFeature: 'rhythm',
    patternIntensity: 0.9,
    pulse: (i) => i % 4 === 0 ? 1 : 0.18
  },
  {
    id: 'organic-house-ambient',
    name: 'Organic House / Ambient',
    bpm: 90,
    energy: 0.38,
    density: 0.32,
    melody: 0.78,
    vocal: 0.84,
    fx: 0.2,
    brightness: 0.48,
    tension: 0.24,
    spectralFlatness: 0.3,
    pulseGain: 0.06,
    densityPulse: 0.04,
    fxPulse: 0.03,
    slowGain: 0.16,
    slowRate: 0.05,
    dropState: 'HIGH',
    dominantFeature: 'vocal',
    patternIntensity: 0.46,
    pulse: (i) => Math.sin(i * 0.12) * 0.5 + 0.5
  },
  {
    id: 'idm-breakbeat',
    name: 'IDM / Breakbeat',
    bpm: 140,
    energy: 0.62,
    density: 0.95,
    melody: 0.38,
    vocal: 0.12,
    fx: 0.72,
    brightness: 0.78,
    tension: 0.68,
    spectralFlatness: 0.64,
    pulseGain: 0.2,
    densityPulse: 0.35,
    fxPulse: 0.22,
    slowGain: 0.03,
    slowRate: 0.19,
    dropState: 'HIGH',
    dominantFeature: 'fx',
    patternIntensity: 0.8,
    pulse: (i) => (i % 3 === 0 || i % 5 === 0) ? 1 : 0.12
  },
  {
    id: 'industrial-techno',
    name: 'Industrial Techno',
    bpm: 150,
    energy: 0.74,
    density: 0.82,
    melody: 0.08,
    vocal: 0.04,
    fx: 1,
    brightness: 1,
    tension: 0.96,
    spectralFlatness: 0.86,
    pulseGain: 0.18,
    densityPulse: 0.18,
    fxPulse: 0,
    slowGain: 0.02,
    slowRate: 0.17,
    dropState: 'LOW_DROP',
    dominantFeature: 'fx',
    patternIntensity: 0.88,
    pulse: (i) => i % 2 === 0 ? 1 : 0.3
  },
  {
    id: 'cinematic-ambient',
    name: 'Cinematic Ambient',
    bpm: 70,
    energy: 0.22,
    density: 0.18,
    melody: 0.54,
    vocal: 0.28,
    fx: 0.38,
    brightness: 0.36,
    tension: 0.58,
    spectralFlatness: 0.92,
    pulseGain: 0.025,
    densityPulse: 0.02,
    fxPulse: 0.04,
    slowGain: 0.12,
    slowRate: 0.035,
    dropState: 'LOW',
    dominantFeature: 'melody',
    patternIntensity: 0.38,
    pulse: (i) => Math.sin(i * 0.06) * 0.5 + 0.5
  }
].map(profile => {
  const { frames, features, phases } = buildFrames(profile);
  return { ...profile, frames, features, phases, trackAnalysis: buildTrackAnalysis(profile, frames, features, phases) };
});

function applyState(State, profile, frameIndex) {
  const frame = profile.frames[frameIndex];
  const features = profile.features[frameIndex];
  State.isPlaying = true;
  State.duration = 60;
  State.currentTime = frameIndex;
  State.bpm = profile.bpm;
  State.sampleRate = 44100;
  State.hopSize = 1024;
  State.frames = profile.frames;
  State.events = [
    { time: frameIndex - 0.05, intensity: 0.78, type: 2 },
    { time: frameIndex + 0.7, intensity: 0.46, type: 1 },
    { time: frameIndex + 1.4, intensity: 0.92, type: 2 },
    { time: frameIndex + 2.3, intensity: 0.64, type: 3 },
    { time: frameIndex + 4.8, intensity: 0.35, type: 1 }
  ];
  State.trackAnalysis = profile.trackAnalysis;
  State.playbackFade = 1;
  State.rotationPhase = frameIndex;
  State.currentFrame.e = frame.e;
  State.currentFrame.densityProj = frame.densityProj;
  State.currentFrame.melodyProj = frame.melodyProj;
  State.currentFrame.fxProj = frame.fxProj;
  State.currentFrame.state = frame.state;
  State.currentFrame.eRatio = frame.eRatio;
  State.currentFeatures.melody = features.melody;
  State.currentFeatures.vocal = features.vocal;
  State.currentFeatures.fx = features.fx;
  State.currentFeatures.density = features.density;
  State.currentFeatures.brightness = features.brightness;
  State.currentFeatures.tension = features.tension;
  State.beatDecay = frameIndex % 4 === 0 ? 1 : 0.24;
  State.cueDecay = frameIndex % 13 === 0 ? 0.72 : 0.08;
  State.denseImpactFlash = frame.state === 'LOW_DROP' || frameIndex % 17 === 0 ? 0.86 : 0.04;
  State.activeCueKind = frameIndex % 19 === 0 ? profile.dominantFeature : null;
  State.activePatternId = State.activeCueKind === 'pattern' ? `${profile.id}-motif` : null;
  State.modulation.kineticTension = features.tension;
  State.modulation.densityDrive = features.density;
  State.modulation.spectralChaos = Math.max(features.fx, profile.spectralFlatness * 0.65);
  State.modulation.rhythmicImpulse = State.beatDecay;
  State.modulation.macroMomentum = frame.e;
  State.directorOutput.state = frame.state === 'LOW_DROP' ? 'GLITCH_LOW_DROP' : frameIndex >= 30 && frameIndex < 45 ? 'DROP' : frameIndex >= 15 && frameIndex < 30 ? 'BUILDUP' : 'IDLE';
  State.directorOutput.centripetalOrbit = features.tension * 0.65;
  State.directorOutput.glitchIntensity = frame.state === 'LOW_DROP' ? 1 : Math.max(0, features.tension - 0.62);
  State.directorOutput.invertBackground = false;
}

function simulateStyle(style, State, profile) {
  const backend = new MockRendererBackend();
  const particles = createParticles();
  const shockwaves = [];

  for (let frameIndex = 0; frameIndex < 60; frameIndex++) {
    backend.frameCount = frameIndex + 1;
    applyState(State, profile, frameIndex);
    if (frameIndex % 15 === 0) shockwaves.push(...createShockwaves(frameIndex));
    assert.doesNotThrow(() => style.draw(backend, particles, shockwaves), `${style.id} crashed on ${profile.name} frame ${frameIndex}`);
  }

  return backend;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

test('registered visual identities render deterministically across genre reference profiles', () => {
  const loadSrcModule = createSrcLoader();
  const { createDefaultStyleRegistry } = loadSrcModule('visuals/StyleRegistry.ts');
  const { State } = loadSrcModule('state/store.ts');
  const registry = createDefaultStyleRegistry();

  for (const styleId of STYLE_IDS) {
    const style = registry.get(styleId);
    assert.equal(style.id, styleId);

    for (const profile of referenceProfiles) {
      const first = simulateStyle(style, State, profile);
      const second = simulateStyle(style, State, profile);
      assert.equal(second.signature(), first.signature(), `${styleId} call counts drifted for ${profile.name}`);
      assert.ok(first.counts.background >= 60, `${styleId} did not clear background for ${profile.name}`);
      assert.ok(first.counts.fill + first.counts.stroke + first.counts.line + first.counts.circle + first.counts.triangle > 0, `${styleId} produced no draw calls for ${profile.name}`);
    }
  }
});

test('reference profiles cover intro, buildup, drop, and break phases', () => {
  for (const profile of referenceProfiles) {
    const labels = new Set(profile.phases.map(phase => phase.label.toUpperCase() === 'BUILD' ? 'BUILDUP' : phase.label.toUpperCase()));
    for (const phase of PHASES) assert.ok(labels.has(phase), `${profile.name} missing ${phase}`);
  }
});
