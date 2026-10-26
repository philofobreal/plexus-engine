import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
const load = createLoader();
const { interpretTrackStructure } = load('analyzer/TrackStructure.ts');
const { EMPTY_TRACK_ANALYSIS } = load('analyzer/normalizeAnalysisResult.ts');
const json = value => JSON.stringify(value);
const plain = value => JSON.parse(json(value));

function journey(labels = []) {
    const groups = [[.2,.2,.2,.2], [.3,.45,.6,.75], Array(4).fill(.8), Array(8).fill(.8),
        Array(4).fill(1.2), Array(4).fill(.25), Array(4).fill(.8), Array(4).fill(.15)];
    const bars = [], sections = [], events = [];
    for (let i = 0; i < groups.length; i++) {
        const start = bars.length * 2;
        for (const level of groups[i]) {
            const b = bars.length;
            bars.push({ index:b, start:b*2, end:b*2+2, rmsAmplitude:level*.1, energy:level/1.2,
                avgRms:level, peakRms:level, density:level, bass:.45,mid:.35,treble:.2, state:'HIGH',dominantFeature:'fx' });
            for (let k=0;k<Math.round(level*4);k++) events.push({time:b*2+.2+k*.35,intensity:.8,type:1});
        }
        sections.push({ start, end:bars.length*2, label:labels[i]??'outro', energy:.5,density:.5,
            dominantFeature:'fx',avgRms:.5,peakRms:.9,reasons:[] });
    }
    return { analysis:{...EMPTY_TRACK_ANALYSIS,duration:bars.length*2,bars,sections},events };
}

test('measured context distinguishes opening, rising build, arrival, continuing body, peak, withdrawal, return and terminal tail', () => {
    const {analysis,events}=journey(); const before=json(analysis);
    const result=interpretTrackStructure(analysis,events);
    assert.deepEqual(plain(result.sections.map(s=>s.label)),['intro','build','drop','verse','peak','break','drop','outro']);
    assert.equal(result.structureInterpretation.changedSections,7);
    assert.equal(json(analysis),before,'worker-owned input remains unchanged');
    assert.equal(result.bars,analysis.bars);
    assert.equal(result.cues,analysis.cues); assert.equal(result.patterns,analysis.patterns);
    assert.deepEqual(plain(result.sections.map(s=>[s.start,s.end])),plain(analysis.sections.map(s=>[s.start,s.end])));
    assert.equal(result.structureInterpretation.contexts.length,analysis.bars.length);
    assert.ok(result.structureInterpretation.contexts.some(c=>c.activeBands.length>1));
    assert.equal(interpretTrackStructure(result,events),result,'idempotent host publication');
    assert.equal(json(interpretTrackStructure(analysis,events)),json(result),'deterministic');
});

test('adversarial raw labels cannot turn a flat body into a build/drop or a middle break into an outro', () => {
    const a=journey(), b=journey(['peak','verse','intro','build','drop','outro','break','intro']);
    const first=interpretTrackStructure(a.analysis,a.events), second=interpretTrackStructure(b.analysis,b.events);
    assert.equal(json(first.sections.map(s=>s.label)),json(second.sections.map(s=>s.label)));
    assert.equal(second.sections[3].label,'verse'); assert.equal(second.sections[5].label,'break');
    assert.ok(second.structureInterpretation.decisions[5].reasons.includes('position-label-rejected'));
    assert.equal(second.structureInterpretation.decisions[5].originalLabel,'outro');
});

test('relative interpretation survives gain changes without pretending spectral shares are independent sources', () => {
    const {analysis,events}=journey(); const expected=interpretTrackStructure(analysis,events);
    for(const gain of [.2,.6,2,4]) {
        const scaled={...analysis,bars:analysis.bars.map(b=>({...b,rmsAmplitude:b.rmsAmplitude*gain}))};
        assert.equal(json(interpretTrackStructure(scaled,events).sections.map(s=>s.label)),json(expected.sections.map(s=>s.label)));
    }
    const altered={...analysis,bars:analysis.bars.map(b=>({...b,bass:b.bass/4,mid:b.mid,treble:b.treble*4}))};
    const result=interpretTrackStructure(altered,events);
    assert.equal(json(result.sections.map(s=>s.label)),json(expected.sections.map(s=>s.label)),
        'a lower bass share caused by added highs does not prove low-band withdrawal');
    assert.ok(result.structureInterpretation.contexts.every(c=>c.activeBands.every(x=>['low','mid','high'].includes(x))));
});

test('legacy, silent, nonfinite and incomplete measurements abstain instead of fabricating structure', () => {
    const {analysis,events}=journey();
    const variants=[{...EMPTY_TRACK_ANALYSIS}, {...analysis,bars:[]},
        {...analysis,bars:analysis.bars.map(({rmsAmplitude,...b})=>b)},
        {...analysis,bars:analysis.bars.map(b=>({...b,rmsAmplitude:0}))},
        {...analysis,bars:analysis.bars.map((b,i)=>i===2?{...b,bass:NaN}:b)},
        {...analysis,bars:analysis.bars.map((b,i)=>i===2?{...b,start:b.start+.2}:b)},
        {...analysis,sections:analysis.sections.map((s,i)=>i===2?{...s,end:s.end+.2}:s)}];
    for(const value of variants) assert.equal(interpretTrackStructure(value,events),value);
    const missingBands={...analysis,bars:analysis.bars.map(b=>({...b,bass:0,mid:0,treble:0}))};
    const result=interpretTrackStructure(missingBands,events);
    assert.ok(result.structureInterpretation.contexts.every(c=>c.spectrum===null&&c.activeBands.length===0),
        'unavailable spectrum is never manufactured silence or an instrument label');
});


test('a rhythm withdrawal with prominent mid/high texture supports a break and its equal-level return supports a drop', () => {
    const {analysis,events}=journey();
    const start=analysis.sections[5].start,end=analysis.sections[5].end;
    const loud={...analysis,bars:analysis.bars.map(b=>b.start>=start&&b.end<=end?
        {...b,rmsAmplitude:.08,density:.08,bass:.05,mid:.7,treble:.25}:b)};
    const noImpacts=events.filter(e=>e.time<start||e.time>=end);
    const result=interpretTrackStructure(loud,noImpacts);
    assert.equal(result.sections[5].label,'break');
    assert.equal(result.sections[6].label,'drop');
    assert.ok(result.structureInterpretation.decisions[5].reasons.includes('rhythm-withdrawal-and-spectral-rebalance'));
    assert.ok(result.structureInterpretation.decisions[6].reasons.includes('rhythm-arrival-and-spectral-rebalance'));
    assert.ok(result.structureInterpretation.decisions[5].activeBands.includes('mid'));
});


test('equal-RMS composition changes remain interpretable, while stationary controls abstain', () => {
    const {analysis,events}=journey();
    const equal={...analysis,bars:analysis.bars.map(b=>({...b,rmsAmplitude:.08}))};
    const start=analysis.sections[5].start,end=analysis.sections[5].end;
    equal.bars=equal.bars.map(b=>b.start>=start&&b.end<=end?{...b,density:.08,bass:.05,mid:.7,treble:.25}:b);
    const result=interpretTrackStructure(equal,events.filter(e=>e.time<start||e.time>=end));
    assert.ok(result.structureInterpretation);
    assert.equal(result.sections[5].label,'break'); assert.equal(result.sections[6].label,'drop');
    const steady={...analysis,bars:analysis.bars.map(b=>({...b,rmsAmplitude:.08,density:.5,bass:.5,mid:.3,treble:.2}))};
    const regular=steady.bars.map(b=>({time:b.start+.5,intensity:.8,type:1}));
    assert.equal(interpretTrackStructure(steady,regular),steady);
});

test('normalized missing band defaults cannot masquerade as measured withdrawal', () => {
    const {normalizeTrackAnalysis}=load('analyzer/normalizeAnalysisResult.ts');
    const {analysis,events}=journey();
    const raw=analysis.bars.map((b,i)=>{if(i>=24&&i<28){const {bass,...rest}=b;return rest;}return b;});
    const normalized=normalizeTrackAnalysis({...analysis,bars:raw});
    assert.equal(interpretTrackStructure(normalized,events,raw),normalized);
});


test('malformed and stale derived reports are not trusted by their version number', () => {
    const {analysis,events}=journey();
    const forged={...analysis,structureInterpretation:{version:1}};
    const result=interpretTrackStructure(forged,events);
    assert.ok(result.structureInterpretation.decisions.length);
    assert.equal(result.sections[3].label,'verse');
    const changed={...result,bars:result.bars.map(b=>({...b,rmsAmplitude:0}))};
    assert.equal(interpretTrackStructure(changed,events).structureInterpretation,undefined);
    assert.ok(result.structureInterpretation,'the prior result is not mutated');
});


test('section intervals cutting bars use duration-weighted support and preserve every boundary', () => {
    const {analysis,events}=journey();
    const sections=analysis.sections.map((s,i)=>i===0?{...s,end:9}:i===1?{...s,start:9}:s);
    const result=interpretTrackStructure({...analysis,sections},events);
    assert.ok(Math.abs(result.structureInterpretation.decisions[0].energyRatio-((8*.2+1*.3)/9/.8))<1e-9);
    assert.equal(result.sections[0].end,9); assert.equal(result.sections[1].start,9);
});

test('XR caches the measured structure explanation and copies it without adding frame work or a setting', async () => {
    const {harness}=await import('./helpers/xr-controller-harness.mjs');
    const h=harness({diagnostics:true});
    const {analysis}=journey(), scale=h.source.durationSec/analysis.duration;
    h.State.trackAnalysis=interpretTrackStructure({...h.State.trackAnalysis,duration:h.source.durationSec,
        bars:analysis.bars.map(b=>({...b,start:b.start*scale,end:b.end*scale}))},h.State.events);
    const report=h.State.trackAnalysis.structureInterpretation;
    assert.ok(report);
    await h.loadTrack();
    assert.match(h.drawer.chartDiagnosticsEl.textContent,/Structure: \d+\/\d+ labels updated/);
    assert.ok(h.controller.overlay.dataset.xrStructure);
    let copied; h.controller.copyToClipboard=text=>{copied=text;};
    h.controller.runMenuCommand({type:'copy-diagnostics'});
    const result=JSON.parse(copied.split('Structure JSON: ')[1].split('\n')[0]);
    assert.equal(json(result),json(report));
    assert.match(copied,/Spectral shares are not instrument identity/);
    h.controller.dispose();
    assert.equal(h.controller.overlay.dataset.xrStructure,undefined);
});
