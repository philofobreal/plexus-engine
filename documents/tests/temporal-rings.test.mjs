import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('temporal amorphic rings use scaled modulation bus values', () => {
  const temporal = read('src/visuals/TemporalMusicEffect.ts');

  assert.match(temporal, /const melodyVal = tuneAudioValue\(State\.currentFeatures\.melody, State\.visualTuning\)/);
  assert.match(temporal, /const vocalVal = tuneAudioValue\(State\.currentFeatures\.vocal, State\.visualTuning\)/);
  assert.match(temporal, /const fxVal = tuneAudioValue\(State\.currentFeatures\.fx, State\.visualTuning\)/);
  assert.match(temporal, /melodyDrive = Math\.max\(melodyVal, State\.modulation\.kineticTension\)/);
  assert.match(temporal, /vocalDrive = Math\.max\(vocalVal, State\.modulation\.kineticTension \* 0\.82\)/);
  assert.match(temporal, /fxDrive = Math\.max\(fxVal, State\.modulation\.spectralChaos\)/);
  assert.match(temporal, /deformation: melodyDrive \* 0\.085/);
  assert.match(temporal, /deformation: vocalDrive \* 0\.055/);
  assert.match(temporal, /deformation: fxDrive \* 0\.15/);
});
