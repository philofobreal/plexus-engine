// Deterministic T09 synthetic chart corpus; not physical Quest or independently annotated music.
// node scripts/evaluate-movement.mjs [logs/t09/corpus.json]
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createLoader } from '../tests/helpers/xr-loader.mjs';
import { chartSources } from '../tests/helpers/xr-chart-sources.mjs';
const { buildRhythmChart, validateRhythmMovement, DIFFICULTIES, HAND_PATTERNS } = createLoader()('gameplay/index.ts');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const cases = [], totals = { legacyNotes: 0, guardedNotes: 0, legacyIssues: 0, guardedIssues: 0, guardedPairs: 0, overhead: 0 };
const started = performance.now();
for (const [name, source] of Object.entries(chartSources())) for (const difficulty of DIFFICULTIES)
    for (const handPattern of HAND_PATTERNS) for (const zones of ['split', 'shared', 'cross']) for (const playSpace of ['standard', 'tall']) {
        const i = cases.length, settings = { difficulty, handPattern, zones, playSpace, activity: i % 2 ? 'active' : 'balanced',
            variation: i % 3 ? 'expressive' : 'stable', handLead: i % 2 ? 'right' : 'even' };
        const legacy = buildRhythmChart(source, undefined, settings), safeSettings = { ...settings, motionSafety: 'guarded' };
        const guarded = buildRhythmChart(source, undefined, safeSettings);
        const before = validateRhythmMovement(legacy, undefined, settings), after = validateRhythmMovement(guarded, undefined, safeSettings);
        totals.legacyNotes += legacy.length; totals.guardedNotes += guarded.length; totals.legacyIssues += before.issueCount;
        totals.guardedIssues += after.issueCount; totals.guardedPairs += guarded.filter(n => n.pairId).length / 2; totals.overhead += guarded.filter(n => n.row === 3).length;
        cases.push({ name, settings, legacyNotes: legacy.length, guardedNotes: guarded.length, legacyIssues: before.issueCount,
            guardedIssues: after.issueCount, legacySha256: hash(legacy), guardedSha256: hash(guarded) });
    }
const data = { pass: totals.guardedIssues === 0 && cases.every(c => c.guardedNotes > 0), cases: cases.length, totals,
    retainedShare: totals.guardedNotes / totals.legacyNotes, minRetainedShare: Math.min(...cases.map(c => c.guardedNotes / c.legacyNotes)),
    elapsedMs: performance.now() - started, scope: 'Synthetic 96/62-second sources; all five difficulties, four hand patterns, three zones and two spaces. Desktop offline work only.', results: cases };
fs.writeFileSync(process.argv[2] ?? 'logs/t09/corpus.json', JSON.stringify(data, null, 2) + '\n');
if (!data.pass) throw Error('Guarded corpus failed');
console.log(JSON.stringify({ ...data, results: undefined }));
