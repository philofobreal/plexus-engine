// Deterministic T09 synthetic chart corpus; not physical Quest or independently annotated music.
// node scripts/evaluate-movement.mjs [logs/t09/corpus.json]
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import { createHash } from 'node:crypto';
import { createLoader } from '../tests/helpers/xr-loader.mjs';
import { chartSources } from '../tests/helpers/xr-chart-sources.mjs';
/** Descriptive comparison of the SAME published features used by selection, not an independent
 * musical-quality metric. Common stratum weights remove unequal note-count weighting. Uniform
 * k-subset means are analytic expectations, not feasible random motor charts. Pairs count once.
 */
export function compareMeasuredChartSelection(source, before, after, {windowSec=4,offsetSec=0}={}) {
 const unavailable=reason=>({version:1,status:'unavailable',reason,windowSec,offsetSec});
 if(!Number.isFinite(windowSec)||windowSec<=0||!Number.isFinite(offsetSec)||offsetSec<0||offsetSec>=windowSec)throw Error('Invalid comparison strata');
 const e=source?.attention,events=source?.events,finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 if(!Array.isArray(events)||!e||e.version!==1||e.source!=='published-frame-change'||!Array.isArray(e.records)||e.records.length!==events.length)return unavailable('missing-or-invalid-evidence');
 if(!Number.isFinite(source.durationSec)||source.durationSec<=0||!Number.isSafeInteger(e.sampleRate)||e.sampleRate<1000||e.sampleRate>384000
  ||!Number.isSafeInteger(e.hopSize)||e.hopSize<4||e.hopSize>65536||!Number.isInteger(Math.log2(e.hopSize))
  ||!Number.isSafeInteger(e.frameCount)||e.frameCount<=0||Math.abs(e.frameCount-Math.ceil(source.durationSec*e.sampleRate/e.hopSize))>1)return unavailable('invalid-evidence-clock');
 if(!events.every((event,i)=>{const r=e.records[i];return event&&finite(event.time)&&event.time<source.durationSec&&finite(event.intensity)&&[1,2,3].includes(event.type)
  &&r&&r.time===event.time&&r.intensity===event.intensity&&r.type===event.type&&finite(r.energy)
  &&r.frame===Math.floor(Math.round(event.time*e.sampleRate)/e.hopSize)&&r.frame>=0&&r.frame<e.frameCount
  &&Array.isArray(r.change)&&r.change.length===3&&[0,1,2].every(j=>finite(r.change[j]));}))return unavailable('invalid-evidence-association');
 const ids=chart=>{if(!Array.isArray(chart))return null;const out=new Set();for(const n of chart){const match=/^note-(\d+)-(left|right)$/.exec(n?.id??'');const i=match?Number(match[1]):-1,event=events[i];
  if(!event||n.time!==event.time||n.sourceType!==event.type)return null;out.add(i);}return out;};
 const a=ids(before),b=ids(after);if(!a||!b)return unavailable('invalid-chart-association');
 const buckets=new Map();for(let i=0;i<events.length;i++){const bin=Math.floor((events[i].time-offsetSec)/windowSec);if(!buckets.has(bin))buckets.set(bin,{before:[],after:[]});
  if(a.has(i))buckets.get(bin).before.push(i);if(b.has(i))buckets.get(bin).after.push(i);}
 const sum=xs=>xs.reduce((x,y)=>x+y,0),mean=(is,key)=>sum(is.map(i=>key==='intensity'?events[i].intensity:sum(e.records[i].change)))/is.length;
 const totals={intensity:{before:0,after:0},publishedPositiveBandChange:{before:0,after:0}};
 let matchedEvents=0,commonWindows=0,beforeOnly=0,afterOnly=0,bothEmpty=0,commonSeconds=0;
 for(const [bin,group]of buckets){const k=Math.min(group.before.length,group.after.length);
  if(!k){if(group.before.length)beforeOnly++;else if(group.after.length)afterOnly++;else bothEmpty++;continue;}
  commonWindows++;matchedEvents+=k;commonSeconds+=Math.max(0,Math.min(source.durationSec,offsetSec+(bin+1)*windowSec)-Math.max(0,offsetSec+bin*windowSec));
  for(const key of Object.keys(totals)){totals[key].before+=k*mean(group.before,key);totals[key].after+=k*mean(group.after,key);}}
 const totalWindows=Math.ceil((source.durationSec-offsetSec)/windowSec)-Math.floor(-offsetSec/windowSec);
 if(!Number.isSafeInteger(totalWindows))return unavailable('invalid-strata-size');
 const sourceEmptyWindows=totalWindows-buckets.size;
 const populatedSeconds=sum([...buckets.keys()].map(bin=>Math.max(0,Math.min(source.durationSec,offsetSec+(bin+1)*windowSec)-Math.max(0,offsetSec+bin*windowSec))));
 const sourceEmptySeconds=Math.max(0,source.durationSec-populatedSeconds);
 bothEmpty+=sourceEmptyWindows;
 const metrics=Object.fromEntries(Object.entries(totals).map(([key,v])=>[key,matchedEvents?{before:v.before/matchedEvents,after:v.after/matchedEvents,delta:(v.after-v.before)/matchedEvents}:null]));
 return{version:1,status:matchedEvents?'measured':'no-common-support',windowSec,offsetSec,sourceEvents:events.length,beforeEvents:a.size,afterEvents:b.size,
  sharedEvents:[...a].filter(i=>b.has(i)).length,matchedEvents,commonWindows,commonSeconds,durationSec:source.durationSec,totalWindows,populatedSourceWindows:buckets.size,sourceEmptyWindows,sourceEmptySeconds,beforeOnly,afterOnly,bothEmpty,metrics,
  scope:'Common-cardinality stratum expectation on published normalized features. Self-feature alignment only; not independent musical accuracy or a feasible random chart.'};
}

async function main() {
const { buildRhythmChart, validateRhythmMovement, DIFFICULTIES, HAND_PATTERNS } = createLoader()('gameplay/index.ts');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Real-recording regression mode, with a cached plain-data chart source for exact before/after.
// --recording AUDIO OUTPUT_NEW.json | --source PREVIOUS.json.source.json OUTPUT_NEW.json
// Optional --baseline COMMIT_SHA compares the retained movement model on the SAME chart source.
if (['--recording', '--source'].includes(process.argv[2])) {
    const poolMode = process.argv.includes('--percussive-pool');
    const [mode, input, output, baselineFlag, baselineRef] = process.argv.slice(2).filter(a => a !== '--percussive-pool');
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
            analysis = analyzeAudio({ samples: new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)), sampleRate: 44100,
                ...(poolMode ? { options: { rhythmOnsets: true } } : {}) });
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
        if (poolMode) {
            const { rhythmOnsets, ...legacyAnalysis } = analysis.trackAnalysis;
            if (!rhythmOnsets) throw Error('Requested percussive pool was not published');
            capture.rhythmOnsets = rhythmOnsets;
            capture.featureClock = analysis.trackAnalysis.featureClock;
            capture.poolAttention = measureRhythmAttention(rhythmOnsets.events, durationSec, analysis.frames, 44100, analysis.hopSize);
            capture.legacyAnalysisSha256 = hash(legacyAnalysis);
            capture.poolImplementationHashes = ['src/analyzer/DramaturgyBuilder.ts', 'src/analyzer/analyzeAudio.ts', 'src/types/rhythmOnsets.ts',
                'src/gameplay/RhythmEventSource.ts'].map(path => ({ path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') }));
        }
        fs.writeFileSync(output + '.source.json', JSON.stringify(capture), { flag: 'wx' });
    }
    if (!Number.isFinite(capture.source?.durationSec) || capture.source.durationSec <= 0 || !Array.isArray(capture.source.events))
        throw Error('Invalid capture duration/events; refuse a misleading empty-chart measurement');
    const load = createLoader(), { choreographRhythmChart } = load('gameplay/RhythmScorePlanner.ts');
    if (poolMode) {
        const selected = load('gameplay/RhythmEventSource.ts').selectRhythmEvents(capture.source.events, capture.source.durationSec,
            'musical-v1', capture.rhythmOnsets, capture.featureClock);
        if (selected.info.kind !== 'grid-independent-percussive') throw Error('Requested recording evaluation has no valid pool; no silent fallback');
        capture = { ...capture, source: { ...capture.source, events: selected.events, eventSource: selected.info,
            attentionBudgetEvents: capture.source.events, attention: capture.poolAttention } };
    }
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
    let baseline, baselineChart;
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
            const chart = old.buildRhythmChart(capture.source, config, settings); baselineChart = chart;
            baseline = { commit: baselineRef, comparison: baselineFlag === '--baseline-chart' ? 'whole-chart-policy' : 'movement-only',
                sourceHashes: Object.fromEntries([...retained].map(([name, code]) => [name, createHash('sha256').update(code).digest('hex')])),
                movementSourceSha256: createHash('sha256').update(retained.get('RhythmMovement.ts')).digest('hex'),
                modelVersion: old.MOVEMENT_MODEL_VERSION, ...count(chart),
                windows: windows.map(w => ({ start: w.start, ...count(chart.filter(n => n.time >= w.start && n.time < w.start + 30)) })) };
        } finally { await bundle.close(); }
    }
    const detailed = load('gameplay/RhythmChartBuilder.ts').buildRhythmChartWithDiagnostics(capture.source, config, settings);
    const report = { recording: capture.recording, pcmSha256: capture.pcmSha256, chartSourceSha256: hash(capture.source), baseline,
        transfer: baselineChart ? [0, 2].map(offsetSec => compareMeasuredChartSelection(capture.source, baselineChart, guarded, {offsetSec})) : undefined,
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

}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
