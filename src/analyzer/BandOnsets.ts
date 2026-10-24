import {extractContinuationOnsets} from './ContinuationOnsets';
import {appendSeparatedBandProposals} from './BandProposalIndex';
import type {BandCandidate, BandOnsetAnalysis} from '../types/bandOnsets';

/** Offline physical-frequency research evidence; preserves v6 with priority. */
export function extractBandOnsets(samples: Float32Array, sampleRate: number,
    options: {innovationContrast?: number; continuationRatio?: number; physicalPeakContrast?: number; physicalFloor?: number} = {}): BandOnsetAnalysis {
    const contrast = options.innovationContrast ?? 16;
    const direction = options.continuationRatio ?? 1.3;
    const physicalContrast = options.physicalPeakContrast ?? 8;
    const physicalFloor = options.physicalFloor ?? 1e-4;
    if (![8,16].includes(contrast) || ![1.1,1.3].includes(direction)) throw new Error('Undeclared band selection parameters');
    if (![2,4,8].includes(physicalContrast)) throw new Error('Undeclared physical peak contrast');
    if (![1e-5,1e-4].includes(physicalFloor)) throw new Error('Undeclared physical floor');
    const base = extractContinuationOnsets(samples, sampleRate);
    const centres = [300,600,1200,2400,4800].filter(f => f < .4 * sampleRate);
    const lag = Math.max(1, Math.round(sampleRate / 8000));
    const continuation = Math.max(1, Math.round(.008 * sampleRate));
    const refine = Math.max(1, Math.round(.003 * sampleRate));
    const separation = Math.max(1, Math.round(.007 * sampleRate));
    const physicalDirection = Math.max(1, Math.round(.012 * sampleRate));
    const candidates: BandCandidate[] = base.candidates.map(c => ({...c}));
    const proposals: BandCandidate[] = [];
    const raw = (i: number) => i >= 0 ? samples[i] : 0;
    const fourth = (i: number) => (raw(i) - 4*raw(i-lag) + 6*raw(i-2*lag)
        - 4*raw(i-3*lag) + raw(i-4*lag)) / 16;
    const second = (i: number) => (raw(i)-2*raw(i-lag)+raw(i-2*lag))/4;
    for (const frequency of centres) {
        const w = 2*Math.PI*frequency/sampleRate, alpha = Math.sin(w)/2;
        const b0=alpha/(1+alpha), a1=-2*Math.cos(w)/(1+alpha), a2=(1-alpha)/(1+alpha);
        const band = new Float64Array(samples.length);
        let x1=0,x2=0,y1=0,y2=0,u1=0,u2=0,v1=0,v2=0;
        for (let i=0; i<samples.length; i++) {
            const x=samples[i], y=b0*(x-x2)-a1*y1-a2*y2;
            x2=x1; x1=x; y2=y1; y1=y;
            const v=b0*(y-u2)-a1*v1-a2*v2;
            u2=u1; u1=y; v2=v1; v1=v; band[i]=v;
        }
        const value = (i: number) => i >= 0 ? band[i] : 0;
        let pp=0,pz=0,power=0,cursor=0;
        const update = (i: number, sign: number) => {
            const p=value(i-lag),z=value(i)+value(i-2*lag);
            pp+=sign*p*p; pz+=sign*p*z; power+=sign*value(i)**2;
        };
        for (let anchor=base.historySamples+4*lag,frame=0; anchor<samples.length; anchor+=base.hopSize,frame++) {
            while (cursor<anchor) {
                update(cursor,1);
                if (cursor>=base.historySamples) update(cursor-base.historySamples,-1);
                cursor++;
            }
            if (frame%1024===0) {
                pp=0; pz=0; power=0;
                for (let i=anchor-base.historySamples;i<anchor;i++) update(i,1);
            }
            const a=pp>1e-30 ? Math.max(-2,Math.min(2,pz/pp)) : 2;
            const residual=(i:number)=>value(i)-a*value(i-lag)+value(i-2*lag);
            let before=0,after=0,rise=0,index=anchor,previous=residual(anchor-1)**2;
            for (let i=anchor-base.contrastSamples;i<anchor;i++) before+=residual(i)**2;
            before/=base.contrastSamples;
            const end=Math.min(samples.length,anchor+base.refinementSamples);
            for (let i=anchor;i<end;i++) {
                const r=residual(i)**2; after+=r;
                if (r-previous>rise) {rise=r-previous;index=i;}
                previous=r;
            }
            after/=end-anchor;
            const floor=Math.max(1e-20,Math.max(0,power)/base.historySamples*1e-5);
            if (rise<=0 || after<contrast*Math.max(before,1e-20) || after<floor) continue;
            const post=index+2*lag, postEnd=post+continuation;
            if (index<continuation || postEnd>samples.length) continue;
            let past=0,future=0;
            for (let i=index-continuation;i<index;i++) past+=value(i)**2;
            for (let i=post;i<postEnd;i++) future+=value(i)**2;
            if (future<direction*Math.max(past,1e-20)) continue;
            // Localization uses observed original PCM, independent of band group delay.
            let best=0,localized=index;
            const start=Math.max(4*lag,index-refine), stop=Math.min(samples.length,index+refine+1);
            let previousRaw=fourth(start-1)**2;
            for (let i=start;i<stop;i++) {
                const p=fourth(i)**2;
                if (p-previousRaw>best) {best=p-previousRaw;localized=i;}
                previousRaw=p;
            }
            if (best<=0) continue;
            const contrastEnd=localized-4*lag, contrastStart=contrastEnd-base.refinementSamples;
            const physicalEnd=localized+base.refinementSamples;
            if (contrastStart<4*lag || physicalEnd>samples.length) continue;
            let pastPeak=0,newPeak=0;
            for (let i=contrastStart;i<contrastEnd;i++) pastPeak=Math.max(pastPeak,fourth(i)**2);
            for (let i=localized;i<physicalEnd;i++) newPeak=Math.max(newPeak,fourth(i)**2);
            if (newPeak<physicalContrast*Math.max(pastPeak,1e-20)) continue;
            const rawStart=localized-base.historySamples, afterRaw=localized+4*lag,
                afterDirectionEnd=afterRaw+physicalDirection;
            if (rawStart<0 || localized<physicalDirection+2*lag || afterDirectionEnd>samples.length) continue;
            let rawHistory=0,beforeDirection=0,afterDirection=0,rawContinuation=0;
            for (let i=rawStart;i<localized;i++) rawHistory+=samples[i]**2;
            rawHistory/=base.historySamples;
            if (newPeak<Math.max(1e-20,rawHistory*physicalFloor)) continue;
            for (let i=localized-physicalDirection;i<localized;i++) beforeDirection+=second(i)**2;
            for (let i=afterRaw;i<afterDirectionEnd;i++) {afterDirection+=second(i)**2;rawContinuation+=samples[i]**2;}
            if (rawHistory>1e-18 && rawContinuation/physicalDirection<=1e-20) continue;
            if (afterDirection<1.3*Math.max(beforeDirection,1e-20)) continue;
            proposals.push({time:localized/sampleRate,sampleIndex:localized,proposalSample:anchor,
                strength:after,innovationRatio:after/Math.max(before,1e-20),
                supportStartSample:0,supportEndSample:Math.max(stop,postEnd,physicalEnd,afterDirectionEnd),endpointAmbiguous:false,
                evidenceSource:'physical-band-innovation',bandHz:frequency,bandRiseRatio:future/Math.max(past,1e-20)});
        }
    }
    // Earliest sharp rise owns a new cluster; prior v6 always retains priority.
    proposals.sort((a,b)=>a.sampleIndex-b.sampleIndex || b.strength-a.strength || a.bandHz!-b.bandHz!);
    appendSeparatedBandProposals(candidates, proposals, separation);
    candidates.sort((a,b)=>a.sampleIndex-b.sampleIndex);
    return {algorithm:'experimental-physical-bands-v8',sampleRate,sampleCount:samples.length,
        bandCentresHz:centres,bandQ:1,cascadedSections:2,predictorLagSamples:lag,
        historySamples:base.historySamples,hopSize:base.hopSize,refinementSamples:base.refinementSamples,
        directionalWindowSamples:continuation,innovationContrast:contrast,continuationRatio:direction,physicalPeakContrast:physicalContrast,
        physicalFloor,physicalDirectionSamples:physicalDirection,physicalDirectionRatio:1.3,predictorRateHz:sampleRate/lag,
        minimumNewSeparationSamples:separation,timestamp:'original-pcm-refined-sample',selection:'candidate-only',candidates};
}
