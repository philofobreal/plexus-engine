import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader();
const { alignAutomationToCues } = load('automation/alignAutomationToCues.ts');
const { musicalCueAnchors } = load('semantics/cueEvidence.ts');
const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
const p = (time, reason = 'drop', phase = 'birth') => ({ id: `p${time}`, time, reason, preset: 'a.json', sectionId: 's',
    confidence: .8, intensity: 1, morphDurationSec: .2, morphCurve: 'linear', meta: { evolutionPhase: phase } });
const cue = (time, kind = 'impact') => ({ time, kind, intensity: .9, confidence: .9, duration: .1,
    ...(kind === 'impact' ? { reasons: ['percussive-onset'] } : {}) });
const analysis = () => ({ ...EMPTY_TRACK_ANALYSIS, duration: 30, eventTiming: { policy: 'experimental-opt-in' },
    cues: [cue(9.99), cue(10.5)], boundaryCandidates: [{ time: 10.5, confidence: .8, reasons: [], timingMode: 'novelty' }],
    sections: [{ start: 10.5, end: 30, label: 'drop' }] });
const plan = point => ({ source: 'auto', version: 1, points: [p(0, 'intro'), point] });

test('scene birth chooses accepted drop boundary over unrelated closer beat; legacy keeps prior ranking', () => {
    const a = analysis();
    const result = alignAutomationToCues(plan(p(10)), a);
    assert.equal(result.points[1].time, 10.5); assert.equal(result.points[1].cueAnchor.role, 'section:drop');
    assert.equal(result.points[1].cueAnchor.kind, 'boundary'); assert.equal(result.points[1].cueAnchor.confidence, .8);
    delete a.eventTiming;
    assert.equal(alignAutomationToCues(plan(p(10)), a).points[1].time, 9.99);
});

test('accent uses attack; shared timestamp preserves boundary and attack roles and input immutability', () => {
    const a = analysis(), before = JSON.stringify(a), anchors = musicalCueAnchors(a, true);
    const joint = anchors.find(a => a.time === 10.5);
    assert.ok(joint.roles.includes('attack')); assert.ok(joint.roles.includes('section:drop'));
    assert.equal(JSON.stringify(a), before);
    assert.equal(alignAutomationToCues(plan(p(10, 'drop', 'peak')), a).points[1].time, 9.99);
});

test('bounded role selection falls back when unavailable and never moves manual/locked anchors', () => {
    const a = analysis(); a.boundaryCandidates[0].time = 22;
    assert.equal(alignAutomationToCues(plan(p(10)), a).points[1].time, 9.99);
    const locked = { ...p(10), locked: true };
    assert.deepEqual(JSON.parse(JSON.stringify(alignAutomationToCues(plan(locked), a).points[1])), locked);
    a.cues = []; a.boundaryCandidates = [];
    assert.equal(alignAutomationToCues(plan(p(10)), a).points.length, 1);
});
