/** Explicit authored signal boundaries, not human/reference labels for recorded music.
 * Fixed development/transfer tuples are declared here before measurement. No source identity.
 */
export const ACTIVITY_TUPLES = {
    development: [{ sampleRate: 16000, frequency: 220.3, phase: .37, seed: 73 }],
    transfer: [{ sampleRate: 22050, frequency: 341.9, phase: 1.71, seed: 587 },
        { sampleRate: 44100, frequency: 517.4, phase: .91, seed: 239 }]
};
export const ACTIVITY_KINDS = ['silence', 'dc', 'below-floor', 'held-tone', 'repeat', 'legato',
    'vibrato', 'noise', 'noise-hit', 'overlap', 'dense', 'tail', 'start-clipped'];

export function activityFixture(kind, tuple = ACTIVITY_TUPLES.development[0]) {
    const { sampleRate: fs, frequency, phase } = tuple;
    const duration = kind === 'tail' ? 1.013 : 2.2;
    const samples = new Float32Array(Math.round(fs * duration)), attacks = [], offsets = [];
    let random = tuple.seed >>> 0;
    const noise = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 2 ** 31 - 1; };
    const tone = (start, end, gain = .1, freq = frequency) => {
        attacks.push(start); offsets.push(Math.min(duration, end));
        for (let i = Math.round(start * fs); i < Math.min(samples.length, Math.round(end * fs)); i++) {
            const t = i / fs - start;
            const envelope = Math.min(1, t / .003, (end - i / fs) / .005);
            samples[i] += gain * Math.max(0, envelope) * Math.sin(2 * Math.PI * freq * t + phase);
        }
    };
    if (kind === 'dc') samples.fill(.37);
    else if (kind === 'below-floor') tone(.4, 1.6, 1e-6);
    else if (kind === 'held-tone') tone(.4, 1.6);
    else if (kind === 'repeat') for (const t of [.3, .8, 1.3]) tone(t, t + .25);
    else if (kind === 'dense') for (let t = .2; t < 1.9; t += .15) tone(t, t + .075);
    else if (kind === 'tail') tone(.4, 1.5);
    else if (kind === 'start-clipped') tone(0, 1.2);
    else if (kind === 'legato' || kind === 'vibrato') {
        tone(.3, 1.9); let angle = phase;
        for (let i = Math.round(.3 * fs); i < Math.round(1.9 * fs); i++) {
            const t = i / fs;
            const f = kind === 'legato' ? frequency * (t < .9 ? 1 : t < 1.4 ? 1.334 : 1.5)
                : frequency * (1 + .015 * Math.sin(2 * Math.PI * 5 * t));
            angle += 2 * Math.PI * f / fs;
            samples[i] = .1 * Math.min(1, (t - .3) / .003, (1.9 - t) / .005) * Math.sin(angle);
        }
    } else if (kind === 'noise') {
        attacks.push(.3); offsets.push(1.9);
        for (let i = Math.round(.3 * fs); i < Math.round(1.9 * fs); i++) samples[i] = .1 * noise();
    } else if (kind === 'noise-hit') {
        attacks.push(.4); offsets.push(.46);
        for (let i = Math.round(.4 * fs); i < Math.round(.46 * fs); i++) samples[i] = .3 * noise();
    } else if (kind === 'overlap') {
        tone(.3, 1.9); attacks.push(.9);
        for (let i = Math.round(.9 * fs); i < Math.round(1.02 * fs); i++) samples[i] += .8 * noise();
    }
    return { kind, tuple, samples, sampleRate: fs, attacks: ['silence', 'dc', 'below-floor', 'start-clipped'].includes(kind) ? [] : attacks,
        offsets, truth: 'authored-signal', negativeAfterFirstAttack: ['held-tone', 'legato', 'vibrato', 'noise'].includes(kind),
        rightCensored: kind === 'tail' };
}


// T11c predeclared development/transfer stress set. These are authored signals, not independent music.
export const ENTRY_KINDS = ['soft-tone', 'repeat-soft-tone', 'soft-noise-hit', 'stable', 'legato', 'crossfade', 'glide', 'vibrato', 'am', 'gain-ramp', 'cutoff', 'noise-bed', 'dc', 'below-floor', 'clipped-tail'];
export function entryFixture(kind, tuple = ACTIVITY_TUPLES.development[0]) {
    const fs = tuple.sampleRate, duration = kind === 'clipped-tail' ? .711 : 2;
    const samples = new Float32Array(Math.round(fs * duration));
    let phase = tuple.phase, seed = tuple.seed >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 31 - 1; };
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        const frequency = tuple.frequency * (kind === 'legato' && t >= .7 ? 1.7 : kind === 'glide' ? 1 + 2 * t / duration : kind === 'vibrato' ? 1 + .015 * Math.sin(2 * Math.PI * 5 * t) : 1);
        phase += 2 * Math.PI * frequency / fs;
        const gain = kind === 'am' ? .2 * (.7 + .3 * Math.sin(2 * Math.PI * 4 * t)) : kind === 'gain-ramp' ? .1 + .3 * t / duration : kind === 'cutoff' && t >= .7 ? .02 : .2;
        samples[i] = kind === 'noise-bed' ? .2 * random() : kind === 'dc' ? .4 : gain * Math.sin(phase);
        if (kind === 'below-floor') samples[i] *= 1e-6;
        if (kind === 'crossfade' && t >= .7) {
            const blend = Math.min(1, (t - .7) / .02);
            samples[i] = (1 - blend) * samples[i] + blend * .2 * Math.sin(2 * Math.PI * (tuple.frequency + 1100) * t);
        }
        if (kind === 'repeat-soft-tone') {
            for (const onset of [.7, 1.4]) if (t >= onset && t < onset + .25) samples[i] += .04 * Math.min(1, (t - onset) / .003, (onset + .25 - t) / .005) * Math.sin(2 * Math.PI * (tuple.frequency + 1100) * (t - onset) + .43);
        }
        if (['soft-tone', 'soft-noise-hit', 'clipped-tail'].includes(kind) && t >= .7 && t < (kind === 'soft-noise-hit' ? .76 : 1.2)) {
            const end = kind === 'soft-noise-hit' ? .76 : 1.2;
            const envelope = Math.min(1, (t - .7) / .003, (end - t) / .005);
            samples[i] += Math.max(0, envelope) * (kind === 'soft-noise-hit' ? .08 * random() : .04 * Math.sin(2 * Math.PI * (tuple.frequency + 1100) * (t - .7) + .43));
        }
    }
    const attacks = kind === 'repeat-soft-tone' ? [.7, 1.4] : ['soft-tone', 'soft-noise-hit', 'clipped-tail'].includes(kind) ? [.7] : [];
    return { samples, sampleRate: fs, kind, attacks, expectedEntries: kind === 'clipped-tail' ? [] : attacks,
        coverage: kind === 'clipped-tail' ? 'insufficient-body' : 'complete-control', truth: 'authored-signal' };
}

// Exact aggregate of all 13 development cases, hop512; T11b commit a1a0eaa63f143f9fa374d9c03f89a18f2c4dddb5.
// Prior MusicActivity source SHA256: f91106e7071810563e1557a525621cc5a8f1b2254ae27e9d84fdf60901898664. No old measurements rewritten.
export const ACTIVITY_V1_SHA256 = '238d9fe49edd57724a2ff78df058b63ab9d6732f15d0b6b20519ed3242de514e';

// Exact T11c producer, commit 485ddd0dea789b7d79938ece6d36ea2e80c23e08: all 45 entry controls.
export const ENTRY_V1_SHA256 = '137501e05059b10f8cf3dcd90a13c13e6edae18a440b0ba1eb23a519da323b81';

// T11d fixed-mask controls; authored source ends are NOT necessarily band-activity ends.
export const BAND_KINDS = ['held', 'am-entry', 'vibrato-entry', 'same-band-overlap', 'near-band-overlap',
    'fade', 'entry-glide', 'carrier-cutoff', 'partial-tail', 'one-quiet-tail'];
export function bandFixture(kind, tuple = ACTIVITY_TUPLES.development[0], hop = 512) {
    const fs = tuple.sampleRate, bed = entryFixture('stable', tuple);
    const count = kind === 'partial-tail' ? Math.round(1.013 * fs)
        : kind === 'one-quiet-tail' ? (Math.ceil(fs / hop) + 1) * hop + Math.floor(hop / 2) : bed.samples.length;
    const samples = bed.samples.slice(0, count), onset = .7;
    const end = kind === 'held' ? 2.5 : kind === 'one-quiet-tail' ? Math.ceil(fs / hop) * hop / fs
        : ['am-entry', 'vibrato-entry', 'fade', 'entry-glide'].includes(kind) ? 1.6 : 1.2;
    let angle = .43;
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        if (kind === 'carrier-cutoff' && t >= .95) samples[i] = 0;
        if (t >= onset && t < end) {
            const freq = (tuple.frequency + 1100) * (kind === 'vibrato-entry' ? 1 + .005 * Math.sin(2 * Math.PI * 5 * (t - onset)) : 1)
                + (kind === 'entry-glide' && t > .95 ? (t - .95) * 2000 : 0);
            angle += 2 * Math.PI * freq / fs;
            const envelope = Math.max(0, Math.min(1, (t - onset) / .003, (end - t) / (kind === 'fade' ? .3 : .005)));
            const gain = kind === 'am-entry' ? .7 + .3 * Math.sin(2 * Math.PI * 4 * (t - onset)) : 1;
            samples[i] += .04 * envelope * gain * Math.sin(angle);
        }
        if (['same-band-overlap', 'near-band-overlap'].includes(kind) && t >= .95 && t < 1.6)
            samples[i] += .04 * Math.min(1, (t - .95) / .003, (1.6 - t) / .005)
                * Math.sin(2 * Math.PI * (tuple.frequency + 1100 + (kind === 'near-band-overlap' ? .2 * fs / hop : 0)) * (t - onset) + .43);
    }
    return { kind, samples, sampleRate: fs, attacks: [onset], sourceEnd: end,
        expectedBandEnd: ['same-band-overlap', 'near-band-overlap'].includes(kind) ? 1.6
            : ['fade', 'entry-glide', 'held', 'partial-tail', 'one-quiet-tail'].includes(kind) ? null : end,
        truth: 'authored-signal' };
}


// Exact T11d commit 4fb6ba2e5f0d52c4ef0008aa75e3e4aab9b1a369: prior 45 entry +30 band controls.
export const BAND_V1_SHA256 = '1c80267601c5fb5dbb179d85166fba01c34ec3846521e82224cda3e73dfa1b46';
export const CONTEXT_SPECS = {
    development: [{ kind: 'am', rate: 3, depth: .6, phaseFraction: 0 },
        { kind: 'glide', speed: 800, phaseFraction: 0 }, { kind: 'neighbor', binGap: 2, phaseFraction: 0 },
        { kind: 'repeat', gap: .25, phaseFraction: 0 }],
    transfer: [{ kind: 'am', rate: 7, depth: .95, phaseFraction: .625 },
        { kind: 'am', rate: 5, depth: .8, phaseFraction: .125 }, { kind: 'glide', speed: 5000, phaseFraction: .375 },
        { kind: 'neighbor', binGap: 3, phaseFraction: .375 }, { kind: 'repeat', gap: .08, phaseFraction: .625 },
        { kind: 'repeat', gap: .3, phaseFraction: .125 }]
};
export function contextFixture(spec, tuple = ACTIVITY_TUPLES.development[0], hop = 512) {
    const fs = tuple.sampleRate, f = entryFixture('stable', tuple), samples = f.samples.slice();
    const onset = .7 + Math.round(hop * spec.phaseFraction) / fs, end = spec.kind === 'repeat' ? onset + .18 : 1.6;
    const starts = spec.kind === 'repeat' ? [onset, end + spec.gap] : spec.kind === 'neighbor' ? [onset, 1.05] : [onset];
    let angle = .43;
    for (let i = 0; i < samples.length; i++) {
        const t = i / fs;
        if (t >= onset && t < end) {
            const freq = tuple.frequency + 1100 + (spec.kind === 'glide' && t > .95 ? (t - .95) * spec.speed : 0);
            angle += 2 * Math.PI * freq / fs;
            const gain = spec.kind === 'am' ? 1 - spec.depth / 2 + spec.depth / 2 * Math.cos(2 * Math.PI * spec.rate * (t - onset)) : 1;
            samples[i] += .04 * gain * Math.max(0, Math.min(1, (t - onset) / .003, (end - t) / .005)) * Math.sin(angle);
        }
        if (spec.kind === 'repeat' && t >= starts[1] && t < starts[1] + .18)
            samples[i] += .04 * Math.max(0, Math.min(1, (t - starts[1]) / .003, (starts[1] + .18 - t) / .005))
                * Math.sin(2 * Math.PI * (tuple.frequency + 1100) * (t - starts[1]) + .43);
        if (spec.kind === 'neighbor' && t >= starts[1] && t < 1.65)
            samples[i] += .04 * Math.max(0, Math.min(1, (t - starts[1]) / .003, (1.65 - t) / .005))
                * Math.sin(2 * Math.PI * (tuple.frequency + 1100 + spec.binGap * fs / hop) * (t - starts[1]) + .81);
    }
    return { samples, sampleRate: fs, spec, attacks: starts, truth: 'authored-signal; neighborhood is not source identity' };
}
