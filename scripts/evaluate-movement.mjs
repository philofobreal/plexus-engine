// Deterministic T09 synthetic chart corpus; not physical Quest or independently annotated music.
// node scripts/evaluate-movement.mjs [logs/t09/corpus.json]
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createLoader } from '../tests/helpers/xr-loader.mjs';
import { chartSources } from '../tests/helpers/xr-chart-sources.mjs';
const { buildRhythmChart, validateRhythmMovement, DIFFICULTIES, HAND_PATTERNS } = createLoader()('gameplay/index.ts');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Real-recording regression mode, with a cached plain-data chart source for exact before/after.
// --recording AUDIO OUTPUT_NEW.json | --source PREVIOUS.json.source.json OUTPUT_NEW.json
// Optional --baseline COMMIT_SHA compares the retained movement model on the SAME chart source.
if (['--recording', '--source'].includes(process.argv[2])) {
    const [mode, input, output, baselineFlag, baselineRef] = process.argv.slice(2);
    if (baselineFlag && (!['--baseline', '--baseline-chart'].includes(baselineFlag) || !/^[a-f0-9]{7,40}$/.test(baselineRef ?? '')))
        throw Error('Expected --baseline COMMIT_SHA or --baseline-chart COMMIT_SHA');
    if (!input || !output || fs.existsSync(output) || mode === '--recording' && fs.existsSync(output + '.source.json'))
        throw Error('Supply an input and an unused output path; retained results are never overwritten');
    let capture;
    if (mode === '--source') capture = JSON.parse(fs.readFileSync(input));
    else {
        const { execFileSync } = await import('node:child_process');
        const { rolldown } = await import('rolldown');
        const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', input, '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
            { maxBuffer: 256 * 1024 ** 2, windowsHide: true });
        const bundle = await rolldown({ input: 'src/analyzer/analyzeAudio.ts' });
        let analysis;
        try {
            const result = await bundle.generate({ format: 'esm' });
            const { analyzeAudio } = await import('data:text/javascript;base64,' + Buffer.from(result.output[0].code).toString('base64'));
            analysis = analyzeAudio({ samples: new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)), sampleRate: 44100 });
        } finally { await bundle.close(); }
        // Match all hosts: structure-v1 is derived after raw analyzer-v7 publication.
        const { interpretTrackStructure } = createLoader()('analyzer/TrackStructure.ts');
        const { measureRhythmAttention } = createLoader()('gameplay/RhythmLocalAttention.ts');
        analysis = { ...analysis, trackAnalysis: interpretTrackStructure(analysis.trackAnalysis, analysis.events) };
        const { generateVisualOsPerformancePlan } = createLoader()('automation/visualOsPlanLoader.ts');
        const durationSec = pcm.length / 4 / 44100;
        const performancePlan = await generateVisualOsPerformancePlan(analysis.trackAnalysis, { duration: durationSec,
            stylePackId: 'cosmic-wormhole', activityLevel: 'active', variantMode: 'expressive',
            stylePacksFile: JSON.parse(fs.readFileSync('public/visual-tuning-presets/style-packs.json')) });
        if (!performancePlan?.points.length) throw Error('Expected the shipped Visual OS plan; no silent plan fallback');
        capture = { recording: input, structureInterpretation: analysis.trackAnalysis.structureInterpretation, pcmSha256: createHash('sha256').update(pcm).digest('hex'), sampleRate: 44100,
            source: { events: analysis.events, durationSec, beats: analysis.trackAnalysis.beats,
                barStarts: analysis.trackAnalysis.barStarts, timingConfidence: analysis.trackAnalysis.timingConfidence?.overall,
                sections: analysis.trackAnalysis.sections, sectionStarts: analysis.trackAnalysis.sections.map(s => s.start), performancePlan,
                attention: measureRhythmAttention(analysis.events, durationSec, analysis.frames, 44100, analysis.hopSize) } };
        fs.writeFileSync(output + '.source.json', JSON.stringify(capture), { flag: 'wx' });
    }
    if (!Number.isFinite(capture.source?.durationSec) || capture.source.durationSec <= 0 || !Array.isArray(capture.source.events))
        throw Error('Invalid capture duration/events; refuse a misleading empty-chart measurement');
    const load = createLoader(), { choreographRhythmChart } = load('gameplay/RhythmScorePlanner.ts');
    const { DEFAULT_RHYTHM_GAME_CONFIG: config, normalizeGenerationSettings, playSpaceConfig, MOVEMENT_MODEL_VERSION } = load('gameplay/index.ts');
    const settings = normalizeGenerationSettings({ chartProfile: 'musical-v1', difficulty: 'ultra', activity: 'active', variation: 'expressive',
        handPattern: 'alternate', handLead: 'even', zones: 'cross', playSpace: 'tall', motionSafety: 'guarded' });
    const raw = choreographRhythmChart(capture.source, playSpaceConfig(config, 'tall'), settings);
    const guarded = buildRhythmChart(capture.source, config, settings);
    const count = chart => ({ notes: chart.length, left: chart.filter(n => n.hand === 'left').length, right: chart.filter(n => n.hand === 'right').length,
        lastLeft: chart.findLast(n => n.hand === 'left')?.time, lastRight: chart.findLast(n => n.hand === 'right')?.time,
        pairs: chart.filter(n => n.pairId).length / 2, sha256: hash(chart) });
    const windows = Array.from({ length: Math.ceil(capture.source.durationSec / 30) }, (_, i) => ({ start: i * 30,
        raw: count(raw.filter(n => n.time >= i * 30 && n.time < (i + 1) * 30)),
        guarded: count(guarded.filter(n => n.time >= i * 30 && n.time < (i + 1) * 30)) }));
    let baseline;
    if (baselineRef) {
        const { execFileSync } = await import('node:child_process');
        const { rolldown } = await import('rolldown');
        const paths = baselineFlag === '--baseline-chart' ? ['RhythmMovement.ts', 'RhythmScorePlanner.ts', 'RhythmPhrasePlanner.ts', 'RhythmChartBuilder.ts'] : ['RhythmMovement.ts'];
        const retained = new Map(paths.map(name => [name, execFileSync('git', ['show', `${baselineRef}:src/gameplay/${name}`], { encoding: 'utf8', windowsHide: true })]));
        const bundle = await rolldown({ input: 'src/gameplay/index.ts', plugins: [{ name: 'retained-movement', load(id) {
            for (const [name, code] of retained) if (id.replaceAll('\\', '/').endsWith('/gameplay/' + name)) return { code, moduleType: 'ts' };
        } }] });
        try {
            const result = await bundle.generate({ format: 'esm' });
            const old = await import('data:text/javascript;base64,' + Buffer.from(result.output[0].code).toString('base64'));
            const chart = old.buildRhythmChart(capture.source, config, settings);
            baseline = { commit: baselineRef, comparison: baselineFlag === '--baseline-chart' ? 'whole-chart-policy' : 'movement-only',
                sourceHashes: Object.fromEntries([...retained].map(([name, code]) => [name, createHash('sha256').update(code).digest('hex')])),
                movementSourceSha256: createHash('sha256').update(retained.get('RhythmMovement.ts')).digest('hex'),
                modelVersion: old.MOVEMENT_MODEL_VERSION, ...count(chart),
                windows: windows.map(w => ({ start: w.start, ...count(chart.filter(n => n.time >= w.start && n.time < w.start + 30)) })) };
        } finally { await bundle.close(); }
    }
    const detailed = load('gameplay/RhythmChartBuilder.ts').buildRhythmChartWithDiagnostics(capture.source, config, settings);
    const report = { recording: capture.recording, pcmSha256: capture.pcmSha256, chartSourceSha256: hash(capture.source), baseline,
        attention: detailed.diagnostics.attention, selection: { ...detailed.diagnostics, decisions: undefined },
        structureInterpretation: capture.structureInterpretation, movementModelVersion: MOVEMENT_MODEL_VERSION, settings, raw: count(raw), guarded: count(guarded), windows,
        validation: validateRhythmMovement(guarded, config, settings),
        scope: 'Deterministic accepted-event/motor regression; not annotated musical accuracy or physical headset safety.' };
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ ...report, structureInterpretation: report.structureInterpretation ? { version: 1, changedSections: report.structureInterpretation.changedSections } : undefined, windows: undefined, baseline: baseline ? { ...baseline, windows: undefined } : undefined,
        validation: { valid: report.validation.valid } }));
    process.exit(report.validation.valid ? 0 : 1);
}
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
