// AN-03G transfer declaration, before selected-probe outputs are viewed.
import {pcmBytes,sha256} from './acoustic-onset-challenges.mjs';

export function bandSpecs(){
    const specs=[],add=s=>specs.push({...s,id:'an03g-'+specs.length.toString().padStart(3,'0')});
    for(const sampleRate of [22050,48000])for(const bed of ['two','four']){
        for(const kind of ['noise','pluck'])for(const gap of [.013,.029])
            for(const amplitude of [.018,.055])for(const phase of [.37,1.13])
                add({family:'positive',sampleRate,bed,kind,gap,amplitude,phase});
        for(const kind of ['sustain','rise','am','beating','removal','chirp'])for(const phase of [.37,1.13])
            add({family:'negative',sampleRate,bed,kind,phase});
    }
    return specs;
}

export function bandFixture(spec){
    const fs=spec.sampleRate,samples=new Float32Array(fs);
    let frequencies=spec.bed==='two'?[211,523]:[211,389,659,947];
    if(spec.kind==='beating')frequencies=frequencies.flatMap(f=>[f,f+2.7]);
    for(let i=0;i<samples.length;i++){
        const t=i/fs,envelope=spec.kind==='rise'?.1+.9*Math.min(1,Math.max(0,(t-.2)/.12))
            :spec.kind==='am'?.55+.45*Math.sin(2*Math.PI*5.3*t):1;
        samples[i]=frequencies.reduce((sum,f,j)=>{
            if(spec.kind==='removal'&&t>=.67&&j===0)return sum;
            const u=Math.max(0,Math.min(.4,t-.2));
            const chirp=spec.kind==='chirp'&&j===0 ? 110*u*u+88*Math.max(0,t-.6):0;
            return sum+.12/frequencies.length*envelope*Math.sin(2*Math.PI*(f*t+chirp)+spec.phase);
        },0);
    }
    const truthSamples=spec.family==='positive'?Array.from({length:6},(_,j)=>Math.round((.241+j*spec.gap)*fs)):[];
    let seed=20261025;
    const wave=Float32Array.from({length:Math.round(fs*(spec.kind==='noise'?.007:.020))},(_,i)=>{
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        return spec.kind==='noise'?(seed/2**31-1)*Math.exp(-i/fs/.0023)
            :Math.sin(2*Math.PI*1173*i/fs)*Math.exp(-i/fs/.007);
    });
    for(const at of truthSamples)for(let i=0;i<wave.length;i++)samples[at+i]+=spec.amplitude*wave[i];
    return {spec,samples,truthSamples,duration:1,negativeStart:spec.family==='negative'?.1:null,
        pcmSha256:sha256(pcmBytes(samples)),truthSha256:sha256(JSON.stringify(truthSamples))};
}
