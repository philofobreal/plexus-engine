// AN-03F transfer declaration before inspecting output; not independent music.
import {pcmBytes, sha256} from './acoustic-onset-challenges.mjs';

export function peakSpecs() {
    const specs = [], add = s => specs.push({...s, id: `an03f-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [16000, 96000]) for (const bed of ['one', 'three']) {
        for (const kind of ['noise', 'pluck']) for (const gap of [.011, .023])
            for (const amplitude of [.014, .045]) for (const phase of [.29, .91])
                add({family: 'positive', sampleRate, bed, kind, gap, amplitude, phase});
        for (const kind of ['sustain', 'rise', 'am', 'beating', 'removal']) for (const phase of [.29, .91])
            add({family: 'negative', sampleRate, bed, kind, phase});
    }
    return specs;
}

export function peakFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.9 * fs));
    let frequencies = spec.bed === 'one' ? [149] : [149, 283, 461];
    if (spec.kind === 'beating') frequencies = frequencies.flatMap(hz => [hz, hz + 2]);
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        const envelope = spec.kind === 'rise' ? .1 + .9 * Math.min(1, Math.max(0, (t - .2) / .12))
            : spec.kind === 'am' ? .55 + .45 * Math.sin(2 * Math.PI * 5.5 * t) : 1;
        samples[i] = frequencies.reduce((sum, hz, j) => sum + (spec.kind === 'removal' && t >= .63 && j === 0 ? 0
            : .12 / frequencies.length * envelope * Math.sin(2 * Math.PI * hz * t + spec.phase)), 0);
    }
    const truthSamples = spec.family === 'positive' ? Array.from({length: 6}, (_, j) => Math.round((.227 + j * spec.gap) * fs)) : [];
    let seed = 20261017;
    const wave = Float32Array.from({length: Math.round(fs * (spec.kind === 'noise' ? .005 : .018))}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return spec.kind === 'noise' ? (seed / 2 ** 31 - 1) * Math.exp(-i / fs / .0016)
            : Math.sin(2 * Math.PI * 797 * i / fs) * Math.exp(-i / fs / .006);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += spec.amplitude * wave[i];
    return {spec, samples, truthSamples, duration: samples.length / fs, negativeStart: spec.family === 'negative' ? .1 : null,
        pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples))};
}
