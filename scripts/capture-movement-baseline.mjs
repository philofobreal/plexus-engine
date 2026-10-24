// T09 immutable predecessor capture. Run once before editing role/settings/controller sources.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { discoverTests } from './run-tests.mjs';
const destination = 'documents/tests/t09-retention.json';
if (fs.existsSync(destination)) throw Error('T09 baseline already exists; never overwrite');
const hash = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const paths = ['src/gameplay/RhythmGenerationProfile.ts', 'src/gameplay/RhythmChartBuilder.ts', 'src/gameplay/index.ts', 'src/xr/XrSettings.ts', 'tests/xr-settings.test.mjs'];
const predecessorSources = paths.map(path => {
    const archive = 'documents/tests/' + path.replaceAll('/', '--') + '.pre-t09.txt';
    fs.copyFileSync(path, archive, fs.constants.COPYFILE_EXCL);
    return { path, archive, sha256: hash(path) };
});
const result = { task: 'T09', capturedAt: new Date().toISOString(),
    previousTests: discoverTests().map(path => ({ path: path.replaceAll('\\', '/'), sha256: hash(path) })),
    predecessorSources, protectedLoaderSha256: hash('tests/helpers/xr-loader.mjs'),
    protectedEvolutionManifestSha256: hash('research/analyzer-lab/fixtures/accepted-timing-integration-source-evolution-01.json') };
fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ previousTests: result.previousTests.length, sourceArchives: predecessorSources.length }));
