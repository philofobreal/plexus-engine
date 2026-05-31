import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('particle boundary pull avoids p5 distance and trigonometry in the hot path', () => {
  const particle = read('src/visuals/Particle.ts');

  assert.match(particle, /let distSq = dx \* dx \+ dy \* dy/);
  assert.match(particle, /let maxRadiusSq = maxRadius \* maxRadius/);
  assert.match(particle, /if \(distSq > maxRadiusSq\)/);
  assert.match(particle, /this\.vel\.x \+= \(dx \/ dist\) \* State\.visualTuning\.particleBoundaryPull/);
  assert.match(particle, /this\.pos\.x \+= this\.vel\.x \* speed/);
  assert.match(particle, /this\.pos\.y \+= this\.vel\.y \* speed/);
  assert.doesNotMatch(particle, /this\.p\.dist/);
  assert.doesNotMatch(particle, /angleToCenter/);
  assert.doesNotMatch(particle, /atan2\(cy - this\.pos\.y/);
  assert.doesNotMatch(particle, /p5\.Vector\.mult/);
});

test('p5 backend caches redundant draw state changes while preserving noStroke and noFill reactivation', () => {
  const backend = read('src/visuals/P5RendererBackend.ts');

  assert.match(backend, /private lastStrokeR = NaN/);
  assert.match(backend, /private lastFillR = NaN/);
  assert.match(backend, /private lastStrokeWeight = -1/);
  assert.match(backend, /private strokeActive = true/);
  assert.match(backend, /private fillActive = true/);
  assert.match(backend, /this\.lastFillR !== r/);
  assert.match(backend, /this\.lastStrokeR !== r/);
  assert.match(backend, /if \(this\.lastStrokeWeight !== weight\)/);
  assert.match(backend, /this\.fillActive = false/);
  assert.match(backend, /this\.strokeActive = false/);
  assert.match(backend, /!this\.fillActive/);
  assert.match(backend, /!this\.strokeActive/);
  assert.doesNotMatch(backend, /const key = `\$\{r\},\$\{g\},\$\{b\},\$\{a\}`/);
});

test('visual hot paths reuse per-frame color buffers and avoid repeated loop color allocation', () => {
  const config = read('src/config/visualTuning.ts');
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(config, /export function hueToRgbInto/);
  assert.match(classic, /const lineColor: \[number, number, number\]/);
  assert.match(classic, /hueToRgbInto\(lineColor, State\.visualTuning\.lineHue\)/);
  assert.match(temporal, /hueToRgbInto\(lineColor, State\.visualTuning\.lineHue \+ melody \* 45 \+ fx \* 30/);
  assert.match(temporal, /const polygonDistanceFactor = maxDistSq \* 0\.55 \* State\.visualTuning\.polygonSize/);
});

test('renderer reuses modulation state and lowers frame rate while paused or idle', () => {
  const renderer = read('src/visuals/PlexusRenderer.ts');

  assert.match(renderer, /writeModulationBus\(/);
  assert.doesNotMatch(renderer, /State\.modulation = computeModulationBus/);
  assert.doesNotMatch(renderer, /State\.modulation = \{/);
  assert.match(renderer, /State\.modulation\.kineticTension = 0/);
  assert.match(renderer, /State\.modulation\.densityDrive = 0/);
  assert.match(renderer, /State\.modulation\.spectralChaos = 0/);
  assert.match(renderer, /State\.modulation\.rhythmicImpulse = 0/);
  assert.match(renderer, /State\.modulation\.macroMomentum = 0/);
  assert.match(renderer, /State\.isPlaying \? 60 : State\.duration > 0 \? 30 : 15/);
  assert.match(renderer, /p\.frameRate\(targetFrameRate\)/);
});

test('temporal mechanism rings pass numeric RGB components without sharing color array references', () => {
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(temporal, /opts: \{ radius: number, deformation: number, colorR: number, colorG: number, colorB: number/);
  assert.match(temporal, /backend\.stroke\(opts\.colorR, opts\.colorG, opts\.colorB, opts\.alpha\)/);
  assert.match(temporal, /setMechanismRingColor\(State\.visualTuning\.circleHue/);
  assert.match(temporal, /colorR: mechanismRingColor\[0\]/);
  assert.doesNotMatch(temporal, /color:\s*hueToRgbInto\(ringColor/);
  assert.doesNotMatch(temporal, /color:\s*hueToRgbInto\(mechanismRingColor/);
  assert.doesNotMatch(temporal, /color: number\[\]/);
});

test('radial glow remains gated by playback state and expensive-glow policy', () => {
  const classic = read('src/visuals/ClassicPlexusEffect.ts');
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(classic, /if \(State\.isPlaying && shouldUseExpensiveGlow\(State\.visualTuning\)\)/);
  assert.match(temporal, /if \(State\.isPlaying && shouldUseExpensiveGlow\(State\.visualTuning\)\)/);
});
