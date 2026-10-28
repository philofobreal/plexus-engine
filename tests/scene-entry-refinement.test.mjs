import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader();
const { alignAutomationToCues } = load('automation/alignAutomationToCues.ts');
const { sustainedCueContrast } = load('semantics/cueEvidence.ts');
const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
const { serializeDramaturgyPlan, parseDramaturgyPlan } = load('automation/dramaturgyTransfer.ts');
const { automationMorphWindow, findActiveAutomationPoint } = load('automation/performanceAutomationRuntime.ts');
const point = (time, role = 'scene-entry', start = time, end = 20) => ({ id: `p${time}`, time, reason: 'drop', sectionId: 's',
    preset: 'default.json', confidence: .8, intensity: 1, morphDurationSec: .3, morphCurve: 'linear',
    cuePlacement: { role, start, end } });
const plan = points => ({ version: 1, source: 'auto', points: [point(0, 'scene-entry', 0, 10), ...points] });
const frame = (density, brightness = density) => ({ density, brightness, fx: .1, melody: .1, vocal: .1, tension: .1 });
const analysis = (change = 9.5) => ({ ...EMPTY_TRACK_ANALYSIS, duration: 30, bpm: 120, tempo: 120, featureHopSize: 64,
    featureClock: { sampleRate: 6400, sampleCount: 192000, hopSize: 64, windowSize: 64,
        originSample: 0, timestamp: 'window-start', tailPolicy: 'zero-pad' },
    features: Array.from({ length: 3000 }, (_, i) => frame(i / 100 < change ? .1 : .8)),
    noveltyPeaks: [{ time: change, value: .9 }], boundaryCandidates: [] });
const plain = x => JSON.parse(JSON.stringify(x));

test('sustained earlier structural evidence refines an estimated entry and keeps proposal provenance', () => {
    const a = analysis(), input = plan([point(10)]), before = JSON.stringify({ a, input });
    const out = alignAutomationToCues(input, a), entry = out.points[1];
    assert.equal(entry.time, 9.5); assert.equal(entry.cuePlacement.start, 9.5); assert.equal(entry.cuePlacement.end, 20);
    assert.equal(entry.cueAnchor.plannedTime, 10); assert.equal(entry.cueAnchor.sourceTime, 9.5);
    assert.equal(entry.cueAnchor.role, 'structure'); assert.equal(entry.cueAnchor.kind, 'novelty');
    assert.equal(out.cueAlignmentReport.decisions[1].placement.start, 10);
    assert.equal(JSON.stringify({ a, input }), before);
    assert.deepEqual(plain(alignAutomationToCues(input, a)), plain(out));
});

test('sustained contrast can replace a later phase-shifted boundary without changing meter or section labels', () => {
    const a = analysis();
    a.boundaryCandidates = [{ time: 10.2, confidence: .9 }];
    a.sections = [{ start: 10.2, end: 30, label: 'drop' }];
    const before = JSON.stringify(a);
    assert.equal(alignAutomationToCues(plan([point(10)]), a).points[1].time, 9.5);
    assert.equal(JSON.stringify(a), before);
});

test('refinement remains two-sided: a stronger later accepted structural change is eligible', () => {
    const a = analysis(10.5);
    a.boundaryCandidates = [{ time: 10, confidence: .8 }];
    assert.equal(alignAutomationToCues(plan([point(10)]), a).points[1].time, 10.5);
});

test('isolated accents, a single feature projection and stationary repeating rhythm cannot cross the scene start', () => {
    for (const makeFrame of [
        i => frame(i >= 940 && i < 970 ? .9 : .1),
        i => frame(i >= 950 ? .9 : .1, .1),
        i => frame(i % 50 < 5 ? .9 : .1)
    ]) {
        const a = analysis(); a.features = a.features.map((_, i) => makeFrame(i));
        assert.equal(alignAutomationToCues(plan([point(10)]), a).points.length, 1);
    }
});

test('a stronger original or currently accepted change is never replaced just to gain an earlier cue', () => {
    const a = analysis(10); a.noveltyPeaks = [{ time: 9.5, value: .9 }];
    a.boundaryCandidates = [{ time: 10, confidence: .8 }];
    assert.equal(alignAutomationToCues(plan([point(10)]), a).points[1].time, 10);
    const b = analysis(10.5); b.noveltyPeaks.push({ time: 9.5, value: 1 });
    assert.equal(alignAutomationToCues(plan([point(10)]), b).points[1].time, 10.5);
});

test('missing, contradictory, coarse and malformed feature evidence fails closed', () => {
    for (const modify of [a => delete a.featureClock, a => a.featureClock.sampleCount++,
        a => a.features[950].density = NaN, a => delete a.features[950],
        a => a.features[950].brightness = 2, a => a.tempo = -1]) {
        const a = analysis(); modify(a);
        assert.equal(alignAutomationToCues(plan([point(10)]), a).points.length, 1);
    }
    assert.equal(sustainedCueContrast(analysis(), .2, .5), undefined);
    assert.equal(sustainedCueContrast(analysis(), 29.5, .5), undefined);
    assert.equal(sustainedCueContrast(analysis(), 10, NaN), undefined);
    const coarse = analysis();
    coarse.featureHopSize = coarse.featureClock.hopSize = coarse.featureClock.windowSize = 32768;
    coarse.features = Array.from({length: 6}, () => frame(.5));
    assert.equal(sustainedCueContrast(coarse, 10, .5), undefined);
});

test('refinement never crosses an original predecessor, even when that proposal has no accepted evidence', () => {
    const a = analysis(), prior = point(9.6, 'attack', 0, 10);
    const out = alignAutomationToCues(plan([prior, point(10)]), a);
    assert.deepEqual(Array.from(out.points, p => p.time), [0]);
    for (const protectedPrior of [{ ...prior, locked: true }, { ...prior, reason: 'manual' }]) {
        const protectedOut = alignAutomationToCues(plan([protectedPrior, point(10)]), a);
        assert.equal(protectedOut.points.length, 2);
        assert.deepEqual(plain(protectedOut.points[1]), protectedPrior);
    }
});

test('scene end, next neighbour midpoint and two-beat radius remain hard bounds', () => {
    const far = analysis(8.9);
    assert.equal(alignAutomationToCues(plan([point(10)]), far).points.length, 1);
    const late = analysis(10.8);
    assert.equal(alignAutomationToCues(plan([point(10), point(11, 'attack', 10, 20)]), late).points.length, 1);
    assert.equal(alignAutomationToCues(plan([point(10, 'scene-entry', 10, 10.8)]), late).points.length, 1);
});

test('attacks, internal evolution, legacy and user-owned entries keep their existing ownership policy', () => {
    const a = analysis();
    for (const role of ['attack', 'release', 'structure', 'melody', 'fx'])
        assert.equal(alignAutomationToCues(plan([point(10, role)]), a).points.length, 1);
    for (const protectedPoint of [{ ...point(10), locked: true }, { ...point(10), reason: 'manual' }])
        assert.deepEqual(plain(alignAutomationToCues(plan([protectedPoint]), a).points[1]), protectedPoint);
    const edited = { ...plan([point(10)]), source: 'edited' };
    assert.equal(alignAutomationToCues(edited, a), edited);
    const legacy = point(10); delete legacy.cuePlacement;
    assert.equal(alignAutomationToCues(plan([legacy]), a).points[1].time, 9.5);
});

test('refined entries round-trip through Copy/Load and use the same arrival and direct-seek clock', () => {
    const out = alignAutomationToCues(plan([point(10)]), analysis());
    const parsed = parseDramaturgyPlan(serializeDramaturgyPlan(out));
    assert.ok(parsed.ok);
    const entry = parsed.plan.points[1], initial = parsed.plan.points[0];
    assert.equal(entry.time, 9.5); assert.equal(entry.cuePlacement.start, 9.5);
    const window = automationMorphWindow(entry, initial);
    assert.equal(window.end, 9.5); assert.equal(window.arrivalAtCue, true);
    assert.equal(findActiveAutomationPoint(parsed.plan, 9.49).id, initial.id);
    assert.equal(findActiveAutomationPoint(parsed.plan, 9.5).id, entry.id);
    assert.equal(findActiveAutomationPoint(parsed.plan, 0).id, initial.id);
});
