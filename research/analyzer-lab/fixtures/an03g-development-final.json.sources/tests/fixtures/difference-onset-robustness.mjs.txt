// AN-03D matrix declared before selected DSP source/frozen result inspection.
import {pcmBytes, sha256} from './acoustic-onset-challenges.mjs';

export function differenceSpecs() {
    const specs = [], add = s => specs.push({...s, id: `an03d-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [11025, 44100]) {
        for (const bed of ['silence', 'two', 'four']) for (const kind of ['noise', 'pluck'])
            for (const gap of [.009, .017]) for (const amplitude of [.015, .05])
                add({family: 'positive', sampleRate, bed, kind, gap, amplitude, phase: .19});
        for (const bed of ['two', 'four']) for (const kind of ['sustain', 'rise-fast', 'rise-slow', 'am', 'beating', 'removal'])
            for (const phase of [.19, 1.27]) add({family: 'negative', sampleRate, bed, kind, phase});
    }
    return specs;
}

export function differenceFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.8 * fs));
    const truthSamples = spec.family === 'positive' ? Array.from({length: 6}, (_, j) => Math.round((.217 + j * spec.gap) * fs)) : [];
    let frequencies = spec.bed === 'silence' ? [] : spec.bed === 'two' ? [191, 337] : [191, 337, 503, 719];
    if (spec.kind === 'beating') frequencies = frequencies.flatMap(hz => [hz, hz + 3]);
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        let envelope = 1;
        if (spec.kind === 'rise-fast' || spec.kind === 'rise-slow')
            envelope = .1 + .9 * Math.min(1, Math.max(0, (t - .2) / (spec.kind === 'rise-fast' ? .06 : .18)));
        if (spec.kind === 'am') envelope = .55 + .45 * Math.sin(2 * Math.PI * 6 * t);
        // Remove one source, preserving the other carriers; truth remains empty.
        samples[i] = frequencies.reduce((sum, hz, j) => sum + (spec.kind === 'removal' && t >= .6 && j === 0 ? 0
            : .12 / frequencies.length * envelope * Math.sin(2 * Math.PI * hz * t + spec.phase)), 0);
    }
    let seed = 20261014;
    const wave = Float32Array.from({length: Math.round(fs * (spec.kind === 'noise' ? .005 : .018))}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return spec.kind === 'noise' ? (seed / 2 ** 31 - 1) * Math.exp(-i / fs / .0016)
            : Math.sin(2 * Math.PI * 880 * i / fs) * Math.exp(-i / fs / .006);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += spec.amplitude * wave[i];
    return {spec, samples, truthSamples, duration: samples.length / fs, negativeStart: spec.family === 'negative' ? .1 : null,
        pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples))};
}
