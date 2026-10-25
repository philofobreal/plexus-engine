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
