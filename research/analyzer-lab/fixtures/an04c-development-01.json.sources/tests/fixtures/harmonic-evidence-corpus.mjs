import {hash,pcmBytes} from './musical-entity-corpus.mjs';

export function harmonicSpecs(split){
    if(!['development','transfer'].includes(split))throw new Error('Unknown harmonic split');
    return ['steady','incommensurate','octave','unison','gain-step','vibrato','note-transition','tone-noise']
        .map(kind=>({kind,sampleRate:split==='development'?16000:22050,
            frequencyHz:split==='development'?220.3:273.41,phase:split==='development'?.37:1.31}));
}

export function renderHarmonicFixture(spec){
    const fs=spec.sampleRate,samples=new Float32Array(Math.round(.48*fs));let seed=204031;
    for(let i=0;i<samples.length;i++){
        const t=i/fs,frequency=spec.kind==='note-transition'&&t>=.24?spec.frequencyHz*4/3:spec.frequencyHz;
        let phase=2*Math.PI*frequency*t+spec.phase;
        if(spec.kind==='vibrato')phase+=2*Math.sin(2*Math.PI*5.7*t);
        let x=Math.sin(phase)+.3*Math.sin(2*phase);
        if(spec.kind==='incommensurate')x+=.8*Math.sin(2*Math.PI*spec.frequencyHz*Math.SQRT2*t+.9);
        if(spec.kind==='octave')x+=.8*Math.sin(2*phase+.9);
        if(spec.kind==='unison')x+=.8*Math.sin(phase+.9);
        if(spec.kind==='gain-step')x*=t>=.24?1:.15;
        if(spec.kind==='tone-noise'){seed=(Math.imul(seed,1664525)+1013904223)>>>0;x+=.8*(seed/2**31-1);}
        samples[i]=.12*x;
    }
    return {spec,samples,identity:{pcmSha256:hash(pcmBytes(samples)),sampleRate:fs,sampleCount:samples.length,timelineOffsetSeconds:0},
        truth:{sourceCount:['incommensurate','octave','unison'].includes(spec.kind)?2:1,
            nonstationary:['gain-step','vibrato','note-transition'].includes(spec.kind),sourceCountIsEvaluatorOnly:true}};
}
