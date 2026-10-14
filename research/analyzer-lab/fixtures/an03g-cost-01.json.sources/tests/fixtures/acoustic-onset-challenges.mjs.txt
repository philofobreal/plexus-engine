// AN-02 C2 authored mono PCM. No analyzer output participates in truth construction.
import { createHash } from 'node:crypto';

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function pcmBytes(samples) {
    const bytes = Buffer.alloc(samples.length * 4);
    for (let i = 0; i < samples.length; i++) bytes.writeFloatLE(samples[i], i * 4);
    return bytes;
}

function waveform(fs, kind) {
    let seed = 0x12345678;
    const length = Math.round(fs * (kind === 'noise' ? .004 : .012));
    return Float32Array.from({length}, (_, i) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const t = i / fs;
        return kind === 'noise' ? (seed / 2 ** 31 - 1) * Math.exp(-t / .0015)
            : Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t / .006);
    });
}

export function challengeFixture(spec) {
    const fs = spec.sampleRate, samples = new Float32Array(Math.round(.8 * fs));
    if (![8000, 44100, 48000].includes(fs)) throw new Error('Undeclared sample rate');
    const truthSamples = spec.family === 'negative' ? [] : spec.family === 'density'
        ? Array.from({length: 6}, (_, i) => Math.round((.25 + i * spec.gapSeconds) * fs))
        : [.2, .4, .6].map(t => Math.round(t * fs));
    if (spec.family === 'mixture' || spec.family === 'negative') {
        for (let i = 0; i < samples.length; i++) {
            const t = i / fs, tone = Math.sin(2 * Math.PI * 110 * t + spec.phase);
            let amplitude = .2;
            if (spec.kind === 'linear-rise') amplitude = .02 + .18 * Math.min(1, Math.max(0, (t - .2) / .2));
            if (spec.kind === 'am') amplitude *= .55 + .45 * Math.sin(2 * Math.PI * 4 * t);
            if (spec.kind === 'fade') amplitude *= 1 - t / .8;
            if (spec.kind === 'cutoff' && t >= .6) amplitude = 0;
            samples[i] = spec.kind === 'beating'
                ? .1 * (tone + Math.sin(2 * Math.PI * 113 * t + spec.phase)) : amplitude * tone;
        }
    }
    if (truthSamples.length) {
        const attack = waveform(fs, spec.kind);
        for (let j = 0; j < truthSamples.length; j++) {
            const amplitude = spec.family === 'mixture' ? .2 * spec.ratio
                : spec.family === 'density' ? (spec.pattern === 'rising' ? .1 + j * .12 : .5)
                : .5 * spec.gain;
            for (let k = 0; k < attack.length; k++) samples[truthSamples[j] + k] += attack[k] * amplitude;
        }
    }
    const bytes = pcmBytes(samples);
    return {spec, samples, truthSamples, pcmSha256: sha256(bytes),
        truthSha256: sha256(JSON.stringify(truthSamples)), duration: samples.length / fs,
        negativeStart: spec.family === 'negative' ? .1 : null};
}

export function challengeSpecs() {
    const specs = [];
    const add = spec => specs.push({...spec, id: `c2-${specs.length.toString().padStart(3, '0')}`});
    for (const sampleRate of [8000, 44100, 48000]) {
        for (const kind of ['noise', 'pluck']) for (const gain of [1, .001, .00001, .000001])
            add({family: 'isolated', sampleRate, kind, gain});
        for (const kind of ['noise', 'pluck']) for (const ratio of [.1, .5, 1, 2]) for (const phase of [0, Math.PI / 3])
            add({family: 'mixture', sampleRate, kind, ratio, phase});
        for (const gapSeconds of [.008, .012, .016, .024, .04, .08]) for (const pattern of ['equal', 'rising'])
            add({family: 'density', sampleRate, kind: 'noise', gapSeconds, pattern});
        for (const kind of ['sustain', 'linear-rise', 'am', 'beating', 'fade', 'cutoff']) for (const phase of [0, Math.PI / 3])
            add({family: 'negative', sampleRate, kind, phase});
    }
    return specs;
}
