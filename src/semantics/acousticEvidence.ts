import type {AcousticEvidenceIdentity, AcousticEvidenceCandidate, PairedOnsetReference,
    AcousticEvidenceAssessment} from '../types/acousticEvidence';

/** Offline interpretation of research onsets; no DSP, retiming or cue publication. */
export function assessAcousticOnsets(candidates: readonly AcousticEvidenceCandidate[],
    references: readonly PairedOnsetReference[], identity: AcousticEvidenceIdentity): AcousticEvidenceAssessment {
    const tolerance=.025;
    if (!/^[a-f0-9]{64}$/.test(identity.pcmSha256) || !Number.isSafeInteger(identity.sampleRate)
        || identity.sampleRate<1000 || identity.sampleRate>384000 || !Number.isSafeInteger(identity.sampleCount)
        || identity.sampleCount<=0 || !Number.isFinite(identity.timelineOffsetSeconds) || identity.timelineOffsetSeconds<0)
        throw new Error('Invalid research PCM identity');
    const end=identity.timelineOffsetSeconds+identity.sampleCount/identity.sampleRate;
    const physical=(t:number)=>Number.isFinite(t)&&t>=identity.timelineOffsetSeconds&&t<end;
    const sorted=[...candidates].sort((a,b)=>a.sampleIndex-b.sampleIndex);
    for (let i=0;i<sorted.length;i++) {
        const c=sorted[i];
        if (!Number.isSafeInteger(c.sampleIndex)||c.sampleIndex<0||c.sampleIndex>=identity.sampleCount
            || c.time!==c.sampleIndex/identity.sampleRate || typeof c.endpointAmbiguous!=='boolean'
            || !Number.isSafeInteger(c.supportStartSample)||c.supportStartSample<0||c.supportStartSample>c.sampleIndex
            || !Number.isSafeInteger(c.supportEndSample)||c.supportEndSample<=c.sampleIndex||c.supportEndSample>identity.sampleCount
            || (i>0&&c.sampleIndex===sorted[i-1].sampleIndex)) throw new Error('Invalid or duplicate physical candidate');
    }
    const votes=new Set<string>();
    const intervals=references.map(r=>{
        if (r.class!=='onset'||r.acceptance!=='two-library-agreement'||r.groundTruthStatus!==false||r.confidence!==null
            || r.evidenceType!=='pseudo_label'
            || !r.identity || Object.keys(identity).some(k=>r.identity[k as keyof AcousticEvidenceIdentity]!==identity[k as keyof AcousticEvidenceIdentity])
            || r.votes.length!==2 || r.votes[0].provider===r.votes[1].provider
            || r.votes.some(v=>!['librosa','audioflux'].includes(v.provider)||!physical(v.time))
            || Math.abs(r.votes[0].time-r.votes[1].time)>tolerance
            || r.time!==(r.votes[0].time+r.votes[1].time)/2
            || r.disagreementSeconds!==Math.abs(r.votes[0].time-r.votes[1].time)
            || r.timeInterval?.length!==2 || r.timeInterval[0]!==Math.min(...r.votes.map(v=>v.time))
            || r.timeInterval[1]!==Math.max(...r.votes.map(v=>v.time))) throw new Error('Invalid two-library reference or PCM clock');
        for (const v of r.votes) {
            const key=v.provider+'|'+v.time;
            if (votes.has(key)) throw new Error('Reused oracle vote');
            votes.add(key);
        }
        const reference:PairedOnsetReference={class:'onset',time:r.time,acceptance:'two-library-agreement',
            groundTruthStatus:false,confidence:null,evidenceType:'pseudo_label',timeInterval:[...r.timeInterval],
            disagreementSeconds:r.disagreementSeconds,identity:{...identity},
            votes:[...r.votes].sort((a,b)=>a.provider<b.provider?-1:a.provider>b.provider?1:0)};
        return {reference,low:Math.max(...r.votes.map(v=>v.time-tolerance)),high:Math.min(...r.votes.map(v=>v.time+tolerance))};
    }).sort((a,b)=>a.high-b.high||a.low-b.low||a.reference.votes[0].time-b.reference.votes[0].time);
    const times=sorted.map(c=>identity.timelineOffsetSeconds+c.time), next=Array.from({length:times.length+1},(_,i)=>i);
    // Earliest-ending interval / earliest available point gives maximum cardinality.
    // Successor links skip assigned points without an O(candidates*references) scan.
    const find=(start:number):number=>{
        let i=start;
        while(next[i]!==i)i=next[i];
        while(next[start]!==start){const old=next[start];next[start]=i;start=old;}
        return i;
    };
    const assigned=new Map<number,PairedOnsetReference>();
    for (const interval of intervals) {
        // Conservative search arithmetic; final original differences enforce exactly 25 ms.
        const epsilon=Number.EPSILON*Math.max(1,Math.abs(interval.low),Math.abs(interval.high))*2;
        let l=0,h=times.length;
        while(l<h){const mid=(l+h)>>>1;if(times[mid]<interval.low-epsilon)l=mid+1;else h=mid;}
        let i=find(l);
        while (i<times.length && times[i]<=interval.high+epsilon) {
            if (!interval.reference.votes.every(v=>Math.abs(times[i]-v.time)<=tolerance)) {i=find(i+1);continue;}
            assigned.set(i,interval.reference);next[i]=find(i+1);
            break;
        }
    }
    return {policy:'research-onset-consumer-gate-v1',identity:{...identity},toleranceSeconds:tolerance,
        events:sorted.map((c,i)=>{
            const r=assigned.get(i);
            return {sampleIndex:c.sampleIndex,time:times[i],supportStartSample:c.supportStartSample,
                supportEndSample:c.supportEndSample,endpointAmbiguous:c.endpointAmbiguous,
                referenceStatus:r?'two-library-agreement':'unqualified',
                reference:r?{...r,identity:{...r.identity},timeInterval:[...r.timeInterval],votes:r.votes.map(v=>({...v}))}:null,
                confidence:null,groundTruthStatus:false,dramaturgy:'diagnostic-only',choreography:'diagnostic-only',xrScoring:'ineligible',
                reasons:['research-candidate','independent-accuracy-unvalidated',
                    ...(r?['coarse-library-timing']:['no-two-library-agreement']),...(c.endpointAmbiguous?['endpoint-ambiguous']:[])]};
        }),uncoveredReferenceCount:references.length-assigned.size,unqualifiedAreNegatives:false};
}
