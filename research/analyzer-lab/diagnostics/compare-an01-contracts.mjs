// Read-only paired regression review. Never writes or regenerates production snapshots.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { GOLDEN_FIXTURES, buildFixtureInput, summarizeForGolden, compareGolden } from '../../../tests/fixtures/golden-fixtures.mjs';

const baselineRoot = process.argv[2];
if (!baselineRoot) throw new Error('Provide the frozen pre-edit src directory as the first argument');
const baseline = createLoader({}, { Float32Array })
    (resolve(baselineRoot, 'analyzer/analyzeAudio.ts')).analyzeAudio;
const candidate = createLoader({}, { Float32Array })('analyzer/analyzeAudio.ts').analyzeAudio;
const hashTree = root => {
    const hash = createHash('sha256');
    const walk = dir => {
        for (const name of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const path = join(dir, name.name);
            if (name.isDirectory()) walk(path);
            else if (name.name.endsWith('.ts')) hash.update(relative(root, path).replaceAll('\\', '/')).update('\0').update(readFileSync(path));
        }
    };
    for (const owner of ['analyzer', 'types']) walk(join(root, owner));
    return hash.digest('hex');
};
const delta = (a, b, path = '', changes = []) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ path, before: a, after: b });
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) delta(a[key], b[key], path ? `${path}.${key}` : key, changes);
    } else if (a !== b) changes.push({ path, before: a, after: b });
    return changes;
};
const observations = [];
for (const fixture of GOLDEN_FIXTURES) {
    const input = buildFixtureInput(fixture);
    const a = baseline(input), b = candidate(input);
    const before = summarizeForGolden(fixture.id, a), after = summarizeForGolden(fixture.id, b);
    const committed = JSON.parse(readFileSync(resolve('tests/fixtures/golden', `${fixture.id}.json`), 'utf8'));
    const observation = { id: fixture.id, inputSampleCount: input.samples.length,
        trueDuration: input.samples.length / input.sampleRate,
        baselineCommittedDrift: compareGolden(before, committed),
        before, after, changes: delta(before, after),
        committedDrift: compareGolden(after, committed),
        firstSectionRms: { before: a.trackAnalysis.sections[0]?.avgRms,
            after: b.trackAnalysis.sections[0]?.avgRms, amplitude: b.trackAnalysis.sections[0]?.rmsAmplitude } };
    observations.push(observation);
    console.log(JSON.stringify({ id: observation.id, baselineCommittedDrift: observation.baselineCommittedDrift,
        changes: observation.changes.filter(c => !c.path.startsWith('tempoCandidates')) }));
}
const output = resolve('research/analyzer-lab/.cache/an01-paired');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'regression-review.json'), JSON.stringify({
    protocol: 'AN-01 known-regression comparison, no parameter selection or new generalization claim',
    baselineSourceHash: hashTree(resolve(baselineRoot)), candidateSourceHash: hashTree(resolve('src')),
    hashConvention: 'sha256 sorted analyzer/types TS relative path + NUL + file bytes', observations
}, null, 2) + '\n');
