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
  assert.doesNotMatch(particle, /this\.p\.dist/);
  assert.doesNotMatch(particle, /angleToCenter/);
  assert.doesNotMatch(particle, /atan2\(cy - this\.pos\.y/);
});

test('p5 backend caches redundant draw state changes while preserving noStroke and noFill reactivation', () => {
  const backend = read('src/visuals/P5RendererBackend.ts');

  assert.match(backend, /private lastStrokeColor = ''/);
  assert.match(backend, /private lastFillColor = ''/);
  assert.match(backend, /private lastStrokeWeight = -1/);
  assert.match(backend, /private strokeActive = true/);
  assert.match(backend, /private fillActive = true/);
  assert.match(backend, /if \(!this\.fillActive \|\| this\.lastFillColor !== key\)/);
  assert.match(backend, /if \(!this\.strokeActive \|\| this\.lastStrokeColor !== key\)/);
  assert.match(backend, /if \(this\.lastStrokeWeight !== weight\)/);
});
