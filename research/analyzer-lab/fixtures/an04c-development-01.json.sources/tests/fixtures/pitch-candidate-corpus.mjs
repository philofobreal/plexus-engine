import {hash,pcmBytes} from './musical-entity-corpus.mjs';

export function pitchSpecs(split){
    if(!['development','transfer'].includes(split))throw new Error('Unknown pitch split');
    const rates=split==='development'?[16000,32000]:[22050,44100];
    const frequencies=split==='development'?[110.3,261.63,439.17]:[147.41,329.73,587.19];
    const main=rates.flatMap(sampleRate=>frequencies.flatMap(frequencyHz=>['sine','harmonic'].map(kind=>
        ({sampleRate,frequencyHz,kind,phase:split==='development'?.37:1.73,gain:split==='development'?.15:.045}))));
    const controls=['silence','dc','below-floor','noise','two-incommensurate','two-octave','two-unison','missing-fundamental']
        .map(kind=>({sampleRate:rates[0],frequencyHz:220.3,kind,phase:.81,gain:.12}));
    return [...main,...controls];
}

/** Only mixture PCM is given to the estimator; truth fields are evaluator-only. */
export function renderPitchFixture(spec){
    const fs=spec.sampleRate,samples=new Float32Array(Math.round(.32*fs));
    let seed=421904;
    for(let i=0;i<samples.length;i++){
        const t=i/fs,base=2*Math.PI*spec.frequencyHz*t+spec.phase;
        let x=Math.sin(base);
        if(spec.kind==='harmonic')x+=.35*Math.sin(2*base)+.16*Math.sin(3*base)+.04*Math.sin(4*base);
        if(spec.kind==='silence')x=0;
        if(spec.kind==='dc')x=.7;
        if(spec.kind==='below-floor')x*=1e-7;
        if(spec.kind==='noise'){seed=(Math.imul(seed,1664525)+1013904223)>>>0;x=seed/2**31-1;}
        if(spec.kind==='two-incommensurate')x+=.8*Math.sin(2*Math.PI*317.7*t+.23);
        if(spec.kind==='two-octave')x+=.8*Math.sin(2*base+.23);
        if(spec.kind==='two-unison')x+=.8*Math.sin(base+.23);
        if(spec.kind==='missing-fundamental')x=Math.sin(2*base)+.6*Math.sin(3*base);
        samples[i]=spec.gain*x;
    }
    const monophonic=['sine','harmonic','missing-fundamental'].includes(spec.kind);
    return {spec,samples,identity:{pcmSha256:hash(pcmBytes(samples)),sampleRate:fs,
        sampleCount:samples.length,timelineOffsetSeconds:0},
        truth:{category:monophonic?'monophonic':spec.kind.startsWith('two-')?'polyphonic':'non-tonal',
            frequencyHz:monophonic?spec.frequencyHz:null,sourceCount:spec.kind.startsWith('two-')?2:monophonic?1:0}};
}
