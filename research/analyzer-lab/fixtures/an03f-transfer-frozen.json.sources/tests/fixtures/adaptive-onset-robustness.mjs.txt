// AN-03B new synthetic matrix declared before source freeze/inspection.
import {pcmBytes, sha256} from './acoustic-onset-challenges.mjs';

export function adaptiveSpecs() {
    const specs = [];
    const add = s => specs.push({...s, id: `an03b-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [12000, 32000, 88200]) {
        for (const bed of ['silence', 'tone']) for (const gap of [.006, .010, .018, .030])
            add({family: 'positive', sampleRate, bed, gap, phase: .41});
        for (const kind of ['sustain', 'rise-fast', 'rise-slow', 'cosine-rise', 'am', 'cutoff'])
            for (const phase of [.41, 1.2]) add({family: 'negative', sampleRate, bed: 'tone', kind, phase});
    }
    return specs;
}

export function adaptiveFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.8 * fs));
    const truthSamples = spec.family === 'positive'
        ? Array.from({length: 6}, (_, j) => Math.round((.18 + j * spec.gap) * fs)) : [];
    if (spec.bed === 'tone') for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        let envelope = 1;
        if (spec.kind === 'rise-fast' || spec.kind === 'rise-slow')
            envelope = .1 + .9 * Math.min(1, Math.max(0, (t - .2) / (spec.kind === 'rise-fast' ? .1 : .3)));
        if (spec.kind === 'cosine-rise')
            envelope = .1 + .9 * (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, (t - .2) / .2)))) / 2;
        if (spec.kind === 'am') envelope = .55 + .45 * Math.sin(2 * Math.PI * 7 * t);
        if (spec.kind === 'cutoff' && t >= .6) envelope = 0;
        samples[i] = .15 * envelope * Math.sin(2 * Math.PI * 173 * t + spec.phase);
    }
    let seed = 20261012;
    const wave = Float32Array.from({length: Math.round(.003 * fs)}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return .08 * (seed / 2 ** 31 - 1) * Math.exp(-i / fs / .001);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += wave[i];
    return {spec, samples, truthSamples, duration: samples.length / fs,
        negativeStart: spec.family === 'negative' ? .1 : null,
        pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples))};
}
