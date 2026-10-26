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
const typed = (time, role, start = 10, end = 20, extra = {}) => ({ ...p(time), ...extra, cuePlacement: {role,start,end} });
const automatic = points => ({version:1,source:'auto',points});
const normal = extra => ({...EMPTY_TRACK_ANALYSIS,duration:30,...extra});
const opening = () => typed(0,'scene-entry',0,10,{reason:'intro'});

test('normal production scene entries require compatible evidence inside their causal half-open scene', () => {
    const a=normal({cues:[cue(9.99),cue(10.1)], boundaryCandidates:[{time:10.5,confidence:.8}],sections:[{start:10.5,end:20,label:'drop'}]});
    const input=automatic([opening(),typed(10,'scene-entry')]), before=JSON.stringify(a);
    const out=alignAutomationToCues(input,a);
    assert.equal(out.points[1].time,10.5);
    assert.equal(out.points[1].cueAnchor.role,'section:drop');
    assert.equal(out.points[1].cueAnchor.kind,'boundary');
    assert.equal(out.points[1].cueAnchor.confidence,.8,'requested role retains its own source evidence');
    assert.equal(JSON.stringify(a),before);
    assert.equal(a.eventTiming,undefined,'ordinary mode needs no timing experiment');
});

test('attack and actual release select their own role, independently of scene evolution and variant styling', () => {
    const a=normal({cues:[cue(11.9,'break'),cue(12.2),cue(16.1,'break'),cue(16)]});
    const out=alignAutomationToCues(automatic([opening(),typed(12,'attack',10,20,{meta:{evolutionPhase:'birth',variantRole:'release'}}),typed(16,'release')]),a);
    assert.deepEqual(Array.from(out.points,p=>p.time),[0,12.2,16.1]);
    assert.deepEqual(Array.from(out.points.slice(1),p=>p.cueAnchor.role),['attack','release']);
});

test('missing matching roles omit explicit points without generic novelty or adjacent-scene fallback', () => {
    const a=normal({cues:[cue(9.9,'break'),cue(20,'break'),cue(12)],noveltyPeaks:[{time:15,value:.9}]});
    const out=alignAutomationToCues(automatic([opening(),typed(15,'release')]),a);
    assert.deepEqual(Array.from(out.points,p=>p.time),[0]);
    assert.equal(out.cueAlignmentReport.decisions[1].reason,'no-role-evidence');
    const attack=alignAutomationToCues(automatic([typed(19.9,'attack',10,20)]),normal({cues:[cue(20)]}));
    assert.equal(attack.points.length,0,'end boundary belongs to next scene');
});

test('late first scene and first accent are never teleported to zero', () => {
    const a=normal({boundaryCandidates:[{time:10.5,confidence:.8}],cues:[cue(2)]});
    assert.equal(alignAutomationToCues(automatic([typed(10,'scene-entry')]),a).points[0].time,10.5);
    assert.equal(alignAutomationToCues(automatic([typed(2,'attack',0,10)]),a).points[0].time,2);
    assert.equal(alignAutomationToCues(automatic([typed(10,'scene-entry')]),normal({})).points.length,0);
});

test('malformed explicit windows fail closed while manual and locked records remain byte-equivalent', () => {
    for(const window of [null,{role:'unknown',start:10,end:20},{role:'attack',start:NaN,end:20},{role:'attack',start:20,end:10},{role:'attack',start:11,end:20}]){
        const point={...typed(10,'attack'),cuePlacement:window};
        const out=alignAutomationToCues(automatic([point]),normal({cues:[cue(10)]}));
        assert.equal(out.points.length,0); assert.equal(out.cueAlignmentReport.decisions[0].reason,'invalid-window');
        for(const protectedPoint of [{...point,locked:true},{...point,reason:'manual'}]){
            const protectedOut=alignAutomationToCues(automatic([protectedPoint]),normal({}));
            assert.equal(JSON.stringify(protectedOut.points[0]),JSON.stringify(protectedPoint));
            assert.equal(protectedOut.cueAlignmentReport.decisions[0].status,'protected');
        }
    }
});

test('proposal-index ledger distinguishes duplicate IDs after unsorted placement and deduplication', () => {
    const input=automatic([typed(16,'attack',10,20,{id:'same'}),opening(),typed(12,'release',10,20,{id:'same'})]);
    const out=alignAutomationToCues(input,normal({cues:[cue(16),cue(12)]}));
    assert.deepEqual(Array.from(out.cueAlignmentReport.omittedTimes),[12]);
    assert.deepEqual(Array.from(out.cueAlignmentReport.decisions,d=>[d.proposalIndex,d.status]),[[0,'anchored'],[1,'initial'],[2,'omitted']]);
    assert.equal(out.cueAlignmentReport.publishedPoints,2);
});

test('a previous-scene accent cannot suppress the next scene entry in a close collision', () => {
    const input=automatic([opening(),typed(9.96,'attack',0,10),typed(10,'scene-entry')]);
    const out=alignAutomationToCues(input,normal({cues:[cue(9.96)],boundaryCandidates:[{time:10,confidence:.9}]}));
    assert.deepEqual(Array.from(out.points,p=>p.time),[0,10]);
    assert.equal(out.cueAlignmentReport.decisions[1].reason,'collision');
    assert.equal(out.cueAlignmentReport.decisions[2].status,'anchored');
});

test('strict role selection never widens neighbour or four-second search bounds', () => {
    const out=alignAutomationToCues(automatic([opening(),typed(12,'release'),typed(14,'attack')]),normal({cues:[cue(13.1,'break'),cue(14)]}));
    assert.equal(out.cueAlignmentReport.decisions[1].status,'omitted','release is beyond midpoint');
    const far=alignAutomationToCues(automatic([typed(12,'release',0,30)]),normal({cues:[cue(16.01,'break')]}));
    assert.equal(far.points.length,0);
});
