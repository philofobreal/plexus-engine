import test from 'node:test';
import assert from 'node:assert/strict';
import {compareMeasuredChartSelection as compare} from '../scripts/evaluate-movement.mjs';
function source(times=[1,2,5,6],strengths=[1,2,3,4]) {
 const events=times.map((time,i)=>({time,intensity:strengths[i],type:1}));
 return {durationSec:12,events,attention:{version:1,source:'published-frame-change',sampleRate:1024,hopSize:32,frameCount:384,
  records:events.map((e,i)=>({...e,frame:Math.floor(e.time*32),energy:.5,change:[strengths[i]/4,0,0]}))}};
}
const chart=(s,indices,hand='left')=>indices.map(i=>({id:`note-${i}-${hand}`,time:s.events[i].time,sourceType:s.events[i].type,intensity:Math.min(1,s.events[i].intensity)}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);

test('same-budget different source choices are measured from unclipped source intensity',()=>{
 const s=source(),r=compare(s,chart(s,[0,2]),chart(s,[1,3]));
 assert.equal(r.status,'measured');assert.equal(r.matchedEvents,2);
 near(r.metrics.intensity.before,2);near(r.metrics.intensity.after,3);
 near(r.metrics.publishedPositiveBandChange.delta,.25);
});
test('pairs count once per source index while simultaneous different indices remain separate',()=>{
 const s=source([1,1,5,6]),a=chart(s,[0,1,2]),paired=[...a,...chart(s,[0,1,2],'right')];
 const r=compare(s,a,paired);assert.equal(r.beforeEvents,3);assert.equal(r.afterEvents,3);assert.equal(r.sharedEvents,3);
 near(r.metrics.intensity.delta,0);assert.equal(r.matchedEvents,3);
});
test('common stratum weights prevent density redistribution from faking an improvement',()=>{
 const s=source([1,1.2,1.4,5,5.2,5.4],[1,1,1,4,4,4]);
 const r=compare(s,chart(s,[0,1,2,3]),chart(s,[0,3,4,5]));
 assert.equal(r.matchedEvents,2);near(r.metrics.intensity.before,2.5);near(r.metrics.intensity.after,2.5);
 near(r.metrics.intensity.delta,0);
});
test('one-sided and entirely missing common support is explicit and never filled with zero',()=>{
 const s=source(),r=compare(s,chart(s,[0]),chart(s,[2]));
 assert.equal(r.status,'no-common-support');assert.equal(r.beforeOnly,1);assert.equal(r.afterOnly,1);
 assert.equal(r.metrics.intensity,null);assert.equal(r.metrics.publishedPositiveBandChange,null);
 const empty=compare(s,[],[]);assert.equal(empty.bothEmpty,3);assert.equal(empty.totalWindows,3);assert.equal(empty.populatedSourceWindows,2);assert.equal(empty.sourceEmptyWindows,1);assert.equal(empty.sourceEmptySeconds,4);assert.equal(empty.commonSeconds,0);
});
test('missing evidence, wrong clocks and wrong note/source associations abstain',()=>{
 const s=source(),a=chart(s,[0]);
 assert.equal(compare({...s,attention:undefined},a,a).status,'unavailable');
 assert.equal(compare({...s,attention:{...s.attention,sampleRate:1}},a,a).reason,'invalid-evidence-clock');
 assert.equal(compare(s,[{...a[0],time:2}],a).reason,'invalid-chart-association');
 assert.equal(compare(s,[{...a[0],id:'note-99-left'}],a).reason,'invalid-chart-association');
 const bad={...s,attention:{...s.attention,records:s.attention.records.map((r,i)=>i?r:{...r,change:[,,]})}};
 assert.equal(compare(bad,a,a).reason,'invalid-evidence-association');
});
test('predeclared 0s and 2s offsets expose boundary sensitivity without mutating inputs',()=>{
 const s=source([1,2,4,6]),a=chart(s,[0,2]),b=chart(s,[1,3]),before=JSON.stringify({s,a,b});
 const zero=compare(s,a,b),shifted=compare(s,a,b,{offsetSec:2});
 assert.equal(zero.commonWindows,2);assert.equal(shifted.commonWindows,1);
 assert.equal(shifted.beforeOnly,1);assert.equal(shifted.afterOnly,1);
 assert.equal(JSON.stringify({s,a,b}),before);
 assert.throws(()=>compare(s,a,b,{windowSec:0}));
});
