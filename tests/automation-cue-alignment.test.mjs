import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { readFileSync } from 'node:fs';
const load = createLoader();
const { alignAutomationToCues } = load('automation/alignAutomationToCues.ts');
const { musicalCueAnchors } = load('semantics/cueEvidence.ts');
const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
const point = time => ({ id: `p${time}`, time, preset: 'a.json', sectionId: 's', confidence: 0.8,
    intensity: 1, reason: 'verse', morphDurationSec: 5, morphCurve: 'easeInOut' });
const cue = time => ({ time, kind: 'fx', intensity: 0.8, confidence: 0.9, duration: 0.1 });
const plan = times => ({ version: 1, source: 'auto', points: times.map(point) });

test('automatic proposals compare both sides and publish exact earlier/later cue times with provenance', () => {
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 40, cues: [cue(9.7), cue(20.3), cue(35)] };
    const input = plan([0, 10, 20, 28]), before = JSON.stringify(input);
    const output = alignAutomationToCues(input, analysis);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(Array.from(output.points, p => p.time), [0, 9.7, 20.3]);
    assert.ok(output.points.every(p => p.time === p.cueAnchor.sourceTime));
    assert.equal(output.points[1].cueAnchor.plannedTime, 10);
    assert.equal(output.points[2].cueAnchor.plannedTime, 20);
    for (let i = 0; i < output.points.length - 1; i++) assert.ok(output.points[i].time + output.points[i].morphDurationSec < output.points[i + 1].time);
});

test('flat features reject unsupported cue/novelty/boundary; real before/after contrast survives', () => {
    const frame = density => ({ density, fx: 0, melody: 0, vocal: 0, brightness: 0, tension: 0 });
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 30, features: Array.from({ length: 300 }, (_, i) => frame(i < 200 ? 0.1 : 0.8)),
        cues: [cue(10), cue(20)], noveltyPeaks: [{ time: 10, value: 0.8, reasons: [] }],
        boundaryCandidates: [{ time: 10, confidence: 0.9, timingMode: 'novelty', reasons: [] }] };
    const out = alignAutomationToCues(plan([0, 10, 20]), analysis);
    assert.deepEqual(Array.from(out.points, p => p.time), [0, 20]);
    assert.ok(out.points[1].cueAnchor.after > out.points[1].cueAnchor.before);
    assert.equal(musicalCueAnchors(analysis).length, 1);
});

test('late-song cues are consumed even when significantMoments only includes early entries', () => {
    const cues = Array.from({ length: 60 }, (_, i) => cue(5 + i * 5));
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 310, cues, significantMoments: cues.slice(0, 32) };
    const out = alignAutomationToCues(plan([0, 100.2, 200.2, 299.8]), analysis);
    assert.deepEqual(Array.from(out.points, p => p.time), [0, 100, 200, 300]);
});

test('no musical evidence yields only initial state, while manual and locked placements remain untouched', () => {
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 30 };
    assert.equal(alignAutomationToCues(plan([0, 10, 20]), analysis).points.length, 1);
    const manual = { ...point(10.123), locked: true, morphDurationSec: 7 };
    const automatic = plan([0, 10]); automatic.points.push(manual);
    const out = alignAutomationToCues(automatic, { ...analysis, cues: [cue(10.12)] });
    assert.deepEqual(JSON.parse(JSON.stringify(out.points.find(p => p.locked))), manual);
    assert.equal(out.points.filter(p => Math.abs(p.time - 10) < 1).length, 1);
    const edited = { ...automatic, source: 'edited' };
    assert.equal(alignAutomationToCues(edited, analysis), edited);
});

test('the production Visual OS loader publishes cue-aligned times, not just its unverified micro subdivisions', async () => {
    const { generateVisualOsPerformancePlan } = load('automation/visualOsPlanLoader.ts');
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 64, bpm: 120, gridConfidence: 0.8, bpmConfidence: 0.8,
        sections: [0, 16, 32, 48].map((start, i) => ({ start, end: start + 16, label: ['intro', 'build', 'drop', 'break'][i],
            energy: [0.2, 0.6, 0.9, 0.2][i], density: 0.7, dominantFeature: 'rhythm', avgRms: 0.5, peakRms: 0.8 })),
        cues: Array.from({ length: 16 }, (_, i) => cue(0.15 + i * 4)) };
    const output = await generateVisualOsPerformancePlan(analysis, { stylePackId: 'cosmic-wormhole', duration: 64,
        stylePacksFile: JSON.parse(readFileSync('public/visual-tuning-presets/style-packs.json', 'utf8')) });
    assert.ok(output.points.length > 3);
    assert.ok(output.points.every(p => p.time === 0 || analysis.cues.some(c => c.time === p.time)));
    assert.ok(output.points.every(p => p.cueAnchor && p.meta));
    assert.equal(output.cueAlignmentReport.publishedPoints, output.points.length);
});

test('legacy dramaturgy section starts publish only with boundary evidence; unevidenced starts are reported, not kept', async () => {
    const { generatePerformancePlan } = load('automation/performancePlanGenerator.ts');
    const section = (start, end, label) => ({ start, end, label, energy: 0.5, density: 0.5, dominantFeature: 'melody', avgRms: 0.5, peakRms: 0.8 });
    const analysis = { ...EMPTY_TRACK_ANALYSIS, duration: 64, bpm: 120, sections: [section(0, 20, 'intro'), section(20, 40, 'build'), section(40, 64, 'drop')] };
    const unevidenced = await generatePerformancePlan(analysis, ['default.json', 'temporal1.json'], 64);
    assert.deepEqual(Array.from(unevidenced.points, p => p.time), [0]);
    assert.deepEqual(Array.from(unevidenced.cueAlignmentReport.omittedTimes), [20, 40]);
    const boundaryCandidates = [20, 40].map(time => ({ time, confidence: 0.9, timingMode: 'novelty', reasons: [] }));
    const evidenced = await generatePerformancePlan({ ...analysis, boundaryCandidates }, ['default.json', 'temporal1.json'], 64);
    assert.deepEqual(Array.from(evidenced.points, p => p.time), [0, 20, 40]);
});
