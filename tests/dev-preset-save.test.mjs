import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { PresetSaveError, savePresetTuning } from '../scripts/devPresetSavePlugin.mjs';

async function createPresetFixture() {
  const root = await mkdtemp(join(tmpdir(), 'plexus-preset-save-'));
  const presetRoot = join(root, 'public', 'visual-tuning-presets');
  await mkdir(presetRoot, { recursive: true });
  await writeFile(join(presetRoot, 'index.json'), JSON.stringify({ presets: ['test.json'] }), 'utf8');
  await writeFile(join(presetRoot, 'test.json'), JSON.stringify({
    version: 1,
    visualMode: 'cosmic-wormhole',
    label: 'Preserved metadata',
    visualTuning: { wormholeSpeed: 1.2, wormholeRadius: 0.9 },
  }), 'utf8');
  return { root, presetRoot };
}

test('development preset save updates existing keys, appends edited keys, and preserves metadata', async (t) => {
  const fixture = await createPresetFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const result = await savePresetTuning({
    presetRoot: fixture.presetRoot,
    fileName: 'test.json',
    tuning: { wormholeSpeed: 4.8, wormholeRadius: 0.8, wormholePathBend: 0.72, unrelated: 99 },
    changedKeys: ['wormholePathBend'],
  });
  const saved = JSON.parse(await readFile(join(fixture.presetRoot, 'test.json'), 'utf8'));

  assert.equal(saved.label, 'Preserved metadata');
  assert.deepEqual(saved.visualTuning, {
    wormholeSpeed: 4.8,
    wormholeRadius: 0.8,
    wormholePathBend: 0.72,
  });
  assert.deepEqual(result.savedKeys, ['wormholeSpeed', 'wormholeRadius', 'wormholePathBend']);
  assert.equal(saved.visualTuning.unrelated, undefined, 'untouched runtime-only keys do not pollute a partial preset');
});

test('development preset save rejects unregistered files and invalid edited values', async (t) => {
  const fixture = await createPresetFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  await assert.rejects(
    savePresetTuning({ presetRoot: fixture.presetRoot, fileName: '../index.json', tuning: {} }),
    (error) => error instanceof PresetSaveError && error.statusCode === 400,
  );
  await assert.rejects(
    savePresetTuning({ presetRoot: fixture.presetRoot, fileName: 'missing.json', tuning: {} }),
    (error) => error instanceof PresetSaveError && error.statusCode === 404,
  );
  await assert.rejects(
    savePresetTuning({
      presetRoot: fixture.presetRoot,
      fileName: 'test.json',
      tuning: { wormholeSpeed: 2, wormholeRadius: 1, wormholePathBend: null },
      changedKeys: ['wormholePathBend'],
    }),
    (error) => error instanceof PresetSaveError && error.statusCode === 422,
  );
});
