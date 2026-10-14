import {hash,pcmBytes} from './musical-entity-corpus.mjs';

export function forecastSpecs(split){
    if(!['development','transfer'].includes(split))throw new Error('Unknown forecast split');
    return ['steady','linear-rise','linear-fall','curved-envelope','gain-step','vibrato','chirp','octave','unison','incommensurate','silence']
        .map(kind=>({kind,sampleRate:split==='development'?16000:22050,
            frequencyHz:split==='development'?220.3:273.41,phase:split==='development'?.37:1.31}));
}
export function renderForecastFixture(spec){
    const fs=spec.sampleRate,samples=Float32Array.from({length:Math.round(.48*fs)},(_,i)=>{
        const t=i/fs;let phase=2*Math.PI*spec.frequencyHz*t+spec.phase;
        if(spec.kind==='vibrato')phase+=2*Math.sin(2*Math.PI*5.7*t);
        if(spec.kind==='chirp')phase+=2*Math.PI*100*t*t/2;
        let x=Math.sin(phase)+.3*Math.sin(2*phase);
        if(spec.kind==='octave')x+=.8*Math.sin(2*phase+.9);
        if(spec.kind==='unison')x+=.8*Math.sin(phase+.9);
        if(spec.kind==='incommensurate')x+=.8*Math.sin(2*Math.PI*spec.frequencyHz*Math.SQRT2*t+.9);
        if(spec.kind==='linear-rise')x*=.3+2*t;
        if(spec.kind==='linear-fall')x*=1.3-2*t;
        if(spec.kind==='curved-envelope')x*=.3+4*t*t;
        if(spec.kind==='gain-step')x*=t<.24?.15:1;
        return spec.kind==='silence'?0:.12*x;
    });
    return {spec,samples,identity:{pcmSha256:hash(pcmBytes(samples)),sampleRate:fs,sampleCount:samples.length,timelineOffsetSeconds:0},
        truth:{sourceCount:['octave','unison','incommensurate'].includes(spec.kind)?2:spec.kind==='silence'?0:1,
            sourceCountIsEvaluatorOnly:true}};
}
