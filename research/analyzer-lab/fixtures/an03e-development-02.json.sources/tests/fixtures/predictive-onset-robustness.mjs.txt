// Frozen synthetic robustness matrix, declared before inspection; no detector-derived truth.
import { pcmBytes, sha256 } from './acoustic-onset-challenges.mjs';

export function robustnessSpecs() {
    const specs = [];
    const add = spec => specs.push({...spec, id: `an03-r${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [16000, 44100, 96000]) {
        for (const bed of ['mono', 'poly']) for (const kind of ['noise', 'tone']) for (const amplitude of [.03, .15])
            add({family: 'positive', sampleRate, bed, kind, amplitude});
        for (const bed of ['mono', 'poly']) for (const kind of ['sustain', 'linear-rise', 'am'])
            add({family: 'negative', sampleRate, bed, kind});
        add({family: 'negative', sampleRate, bed: 'mono', kind: 'cutoff'});
    }
    return specs;
}

export function robustnessFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.8 * fs));
    const truthSamples = spec.family === 'positive' ? [.17, .37, .57].map(t => Math.round(t * fs)) : [];
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        let envelope = 1;
        if (spec.kind === 'linear-rise') envelope = .1 + .9 * Math.min(1, Math.max(0, (t - .2) / .2));
        if (spec.kind === 'am') envelope = .55 + .45 * Math.sin(2 * Math.PI * 4 * t);
        if (spec.kind === 'cutoff' && t >= .6) envelope = 0;
        const bed = spec.bed === 'mono' ? .15 * Math.sin(2 * Math.PI * 220 * t + .23)
            : [110, 220, 329].reduce((sum, hz) => sum + .05 * Math.sin(2 * Math.PI * hz * t + .23), 0);
        samples[i] = envelope * bed;
    }
    let seed = 20261011;
    const wave = Float32Array.from({length: Math.round(fs * (spec.kind === 'noise' ? .004 : .020))}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const t = i / fs;
        return spec.kind === 'noise' ? (seed / 2 ** 31 - 1) * Math.exp(-t / .003)
            : Math.sin(2 * Math.PI * 660 * t + .2) * Math.exp(-t / .005);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += spec.amplitude * wave[i];
    return {spec, samples, truthSamples, pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples)),
        duration: samples.length / fs, negativeStart: spec.family === 'negative' ? .1 : null};
}
