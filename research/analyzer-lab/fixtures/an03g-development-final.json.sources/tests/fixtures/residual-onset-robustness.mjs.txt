// New AN-03C synthetic conditions; defined before final source/measurement inspection.
import {pcmBytes, sha256} from './acoustic-onset-challenges.mjs';

export function residualSpecs() {
    const specs = [];
    const add = s => specs.push({...s, id: `an03c-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [22050, 48000]) {
        for (const bed of ['silence', 'tone', 'poly']) for (const gap of [.007, .014, .028])
            for (const amplitude of [.02, .06]) add({family: 'positive', sampleRate, bed, gap, amplitude, phase: .37});
        for (const bed of ['tone', 'poly']) for (const kind of ['sustain', 'rise-fast', 'rise-slow', 'am', 'beating', 'cutoff'])
            for (const phase of [.37, 1.1]) add({family: 'negative', sampleRate, bed, kind, phase});
    }
    return specs;
}

export function residualFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.8 * fs));
    const truthSamples = spec.family === 'positive'
        ? Array.from({length: 6}, (_, j) => Math.round((.23 + j * spec.gap) * fs)) : [];
    if (spec.bed !== 'silence') for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        let envelope = 1;
        if (spec.kind === 'rise-fast' || spec.kind === 'rise-slow')
            envelope = .1 + .9 * Math.min(1, Math.max(0, (t - .2) / (spec.kind === 'rise-fast' ? .08 : .16)));
        if (spec.kind === 'am') envelope = .55 + .45 * Math.sin(2 * Math.PI * 5 * t);
        if (spec.kind === 'cutoff' && t >= .6) envelope = 0;
        const frequencies = spec.kind === 'beating' ? (spec.bed === 'tone' ? [137, 140] : [137, 140, 251, 254])
            : spec.bed === 'tone' ? [137] : [137, 251];
        samples[i] = .12 * envelope * frequencies.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t + spec.phase), 0) / frequencies.length;
    }
    let seed = 20261013;
    const wave = Float32Array.from({length: Math.round(.004 * fs)}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return (seed / 2 ** 31 - 1) * Math.exp(-i / fs / .0013);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += spec.amplitude * wave[i];
    return {spec, samples, truthSamples, duration: samples.length / fs, negativeStart: spec.family === 'negative' ? .1 : null,
        pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples))};
}
