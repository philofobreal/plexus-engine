// AN-03E transfer matrix: declare before inspecting this matrix's output.
import {pcmBytes, sha256} from './acoustic-onset-challenges.mjs';

export function continuationSpecs() {
    const specs = [], add = s => specs.push({...s, id: `an03e-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [24000, 48000]) for (const bed of ['two', 'four']) {
        for (const kind of ['noise', 'pluck']) for (const amplitude of [.012, .04]) for (const phase of [.4, 1.6])
            add({family: 'positive', sampleRate, bed, kind, amplitude, phase});
        for (const kind of ['remove-low', 'remove-high', 'remove-both']) for (const phase of [.4, 1.6])
            add({family: 'negative', sampleRate, bed, kind, phase});
    }
    return specs;
}

export function continuationFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.9 * fs));
    const frequencies = spec.bed === 'two' ? [157, 293] : [157, 293, 467, 683];
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        samples[i] = frequencies.reduce((sum, hz, j) => {
            const removed = t >= .63 && (spec.kind === 'remove-low' && j === 0
                || spec.kind === 'remove-high' && j === frequencies.length - 1
                || spec.kind === 'remove-both' && (j === 0 || j === frequencies.length - 1));
            return sum + (removed ? 0 : .12 / frequencies.length * Math.sin(2 * Math.PI * hz * t + spec.phase));
        }, 0);
    }
    const truthSamples = spec.family === 'positive' ? Array.from({length: 6}, (_, j) => Math.round((.223 + j * .013) * fs)) : [];
    let seed = 20261015;
    const wave = Float32Array.from({length: Math.round(fs * (spec.kind === 'noise' ? .005 : .018))}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return spec.kind === 'noise' ? (seed / 2 ** 31 - 1) * Math.exp(-i / fs / .0016)
            : Math.sin(2 * Math.PI * 1031 * i / fs) * Math.exp(-i / fs / .006);
    });
    for (const at of truthSamples) for (let i = 0; i < wave.length; i++) samples[at + i] += spec.amplitude * wave[i];
    return {spec, samples, truthSamples, duration: samples.length / fs, negativeStart: spec.family === 'negative' ? .1 : null,
        pcmSha256: sha256(pcmBytes(samples)), truthSha256: sha256(JSON.stringify(truthSamples))};
}
