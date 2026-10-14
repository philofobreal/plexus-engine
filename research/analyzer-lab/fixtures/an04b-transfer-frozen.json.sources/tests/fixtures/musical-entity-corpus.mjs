// Authored stems / notes. Candidate isolation, boundaries and F0 are supplied inputs.
// Truth source/motif IDs never enter the tracker. No human singer or mixture-separation claim.
import {createHash} from 'node:crypto';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function pcmBytes(samples) {
    const bytes = Buffer.alloc(samples.length * 4);
    for (let i = 0; i < samples.length; i++) bytes.writeFloatLE(samples[i], i * 4);
    return bytes;
}

export function corpusSpecs(split) {
    if (!['development', 'transfer'].includes(split)) throw new Error('Unknown corpus split');
    const rates = split === 'development' ? [16000, 32000] : [22050, 44100];
    const phases = split === 'development' ? [.2, 1.3] : [.63, 2.17];
    const gains = split === 'development' ? [.08, .3] : [.025, .17, .55];
    return rates.flatMap(sampleRate => phases.flatMap(phase => gains.map(gain => ({split, sampleRate, phase, gain}))));
}

export function renderEntityCorpus(spec, extract) {
    const fs = spec.sampleRate, sampleCount = Math.round(12 * fs), mixture = new Float32Array(sampleCount);
    const profiles = spec.split === 'development'
        ? [[1,.22,.07,.03,.01,0,0,0], [1,.8,.4,.2,.08,.04,0,0], [.2,1,.8,.5,.3,.15,.07,.03]]
        : [[1,.32,.12,.04,.02,0,0,0], [.35,1,.3,.18,.09,.05,0,0], [.1,.5,1,.4,.2,.1,.05,.02]];
    const motifs = [[60,64,67,62], [60,62,65,69], [55,58,54,57]];
    const definitions = [
        {time:.1, source:0, motif:0, transpose:0, scale:1},
        {time:.1, source:1, motif:1, transpose:0, scale:1},
        {time:2, source:0, motif:2, transpose:3, scale:1},
        {time:4, source:1, motif:1, transpose:-3, scale:1.2},
        {time:6, source:2, motif:0, transpose:5, scale:1.25},
        {time:8, source:0, motif:0, transpose:-5, scale:.8},
        {time:10, source:2, motif:2, transpose:7, scale:1.1},
    ];
    const observations = [], truth = [], stems = [];
    for (let k = 0; k < definitions.length; k++) {
        const d = definitions[k], startSample = Math.round(d.time * fs), step = Math.round(.22 * d.scale * fs);
        const notes = motifs[d.motif].map((midi, j) => ({midi:midi+d.transpose,
            startSample:startSample+j*step, endSample:startSample+(j+1)*step}));
        const stem = new Float32Array(4 * step), profile = profiles[d.source], weight = profile.reduce((a,b)=>a+b,0);
        for (let j = 0; j < notes.length; j++) {
            const f0 = 440 * 2 ** ((notes[j].midi - 69) / 12);
            for (let i = 0; i < step; i++) {
                const t = i/fs, envelope = Math.min(1,t/.012,(step-i)/fs/.012);
                let value = 0;
                for (let h = 0; h < profile.length; h++)
                    value += profile[h] / weight * Math.sin(2*Math.PI*f0*(h+1)*t + spec.phase*(h+1) + k*.31);
                stem[j*step+i] = spec.gain * envelope * value;
            }
        }
        for (let i = 0; i < stem.length; i++) mixture[startSample+i] += stem[i];
        // A stationary window inside the first supplied note. F0 comes from authored symbolic input.
        const windowStart = Math.round(.025*fs), windowEnd = Math.round(.145*fs);
        const timbre = extract(stem.slice(windowStart,windowEnd), fs,
            440*2**((notes[0].midi-69)/12), startSample+windowStart).descriptor;
        const id = `observation-${String(k).padStart(3,'0')}`;
        observations.push({id,startSample,endSample:startSample+stem.length,kind:'isolated-candidate',
            timbre,notes,notesOrigin:'authored-symbolic'});
        truth.push({observationId:id,source:`authored-source-${d.source}`,motif:`authored-motif-${d.motif}`});
        stems.push({observationId:id,pcmSha256:hash(pcmBytes(stem)),sampleCount:stem.length});
    }
    return {spec,identity:{pcmSha256:hash(pcmBytes(mixture)),sampleRate:fs,sampleCount,timelineOffsetSeconds:0},
        observations,truth,stems,truthSha256:hash(JSON.stringify(truth)),
        annotationMode:'authored-isolation-boundaries-f0-and-monophonic-notes',mixture};
}

/** Recall includes abstained positive pairs; precision excludes unknown predictions. */
export function pairwiseAssociation(truth, assignments, field) {
    const predicted = new Map(assignments.map(a=>[a.observationId,a[field+'Id']]));
    let truePositive=0,falsePositive=0,falseNegative=0,trueNegative=0,unknownPairs=0;
    for(let i=0;i<truth.length;i++)for(let j=i+1;j<truth.length;j++){
        const same=truth[i][field]===truth[j][field], a=predicted.get(truth[i].observationId), b=predicted.get(truth[j].observationId);
        if(a==null||b==null){unknownPairs++;if(same)falseNegative++;continue;}
        if(a===b){if(same)truePositive++;else falsePositive++;}
        else if(same)falseNegative++;else trueNegative++;
    }
    const assigned=truth.filter(t=>predicted.get(t.observationId)!=null).length;
    return {truePositive,falsePositive,falseNegative,trueNegative,unknownPairs,assigned,observations:truth.length,
        precision:truePositive+falsePositive?truePositive/(truePositive+falsePositive):null,
        recall:truePositive+falseNegative?truePositive/(truePositive+falseNegative):null,coverage:assigned/truth.length};
}
