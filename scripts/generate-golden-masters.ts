// Golden-master generator.
//
// Run with:  bun run update-golden-masters
// (falls back to `node --experimental-strip-types` per AGENTS.md if Bun is unavailable)
//
// Runs analyzeAudio() over every deterministic fixture in tests/fixtures/golden-fixtures.mjs
// and writes a tolerant summary snapshot to tests/fixtures/golden/<id>.json.
//
// IMPORTANT: This intentionally OVERWRITES baselines. Only run it when a DSP change is
// believed to be an improvement, and inspect the git diff before committing.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeAudio } from '../src/analyzer/analyzeAudio.ts';
// @ts-expect-error - shared pure-JS fixture library, no type declarations.
import { GOLDEN_FIXTURES, buildFixtureInput, summarizeForGolden } from '../tests/fixtures/golden-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, '..', 'tests', 'fixtures', 'golden');
mkdirSync(goldenDir, { recursive: true });

let written = 0;
for (const fixture of GOLDEN_FIXTURES) {
    const input = buildFixtureInput(fixture);
    const result = analyzeAudio(input);
    const summary = summarizeForGolden(fixture.id, result);
    const outPath = join(goldenDir, `${fixture.id}.json`);
    writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    written++;
    // eslint-disable-next-line no-console
    console.log(`wrote ${fixture.id}.json  (bpm=${summary.bpm}, events=${summary.counts.events}, bars=${summary.counts.bars})`);
}

// eslint-disable-next-line no-console
console.log(`\nGolden masters updated: ${written} fixture(s) in ${goldenDir}`);
