// Authored PCM/truth; independent of the candidate algorithm and its selected peaks.
export function impulsePhaseCorpus(sampleRate, phases, legacyHop = 1024) {
    const spacing = Math.ceil(Math.max(2048, sampleRate * 0.1) / legacyHop) * legacyHop;
    const samples = new Float32Array(spacing * (phases.length + 2));
    const truthSamples = phases.map((phase, i) => spacing * (i + 1) + phase);
    for (const at of truthSamples) samples[at] = 1;
    return { samples, truthSamples, sampleRate };
}

export function attackCorpus(sampleRate, kind) {
    const samples = new Float32Array(Math.round(sampleRate * 0.7));
    const truthSamples = [.12, .32, .52].map(t => Math.round(t * sampleRate));
    let state = 12345;
    const noise = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 31 - 1; };
    const waveform = Float32Array.from({ length: Math.round(sampleRate * .012) }, (_, i) => {
        const t = i / sampleRate;
        return kind === 'noise' ? noise() * Math.exp(-t / .004) : Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t / .006);
    });
    for (const at of truthSamples) for (let i = 0; i < waveform.length; i++) samples[at + i] += waveform[i] * .5;
    return { samples, truthSamples, sampleRate };
}

export function pairedSampleMetrics(candidates, truthSamples, toleranceSamples) {
    const matched = new Set(), errors = [];
    let falsePositives = 0;
    for (const candidate of candidates) {
        let selected = -1, distance = Infinity;
        for (let i = 0; i < truthSamples.length; i++) {
            const d = Math.abs(candidate.sampleIndex - truthSamples[i]);
            if (!matched.has(i) && d <= toleranceSamples && d < distance) { selected = i; distance = d; }
        }
        if (selected < 0) falsePositives++;
        else { matched.add(selected); errors.push(candidate.sampleIndex - truthSamples[selected]); }
    }
    const absolute = errors.map(Math.abs).sort((a, b) => a - b);
    return { truthCount: truthSamples.length, estimatedCount: candidates.length, matchedCount: errors.length,
        misses: truthSamples.length - matched.size, falsePositives,
        signedMeanSamples: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
        absoluteP95Samples: absolute.length ? absolute[Math.ceil(.95 * absolute.length) - 1] : null,
        maximumAbsoluteSamples: absolute.length ? absolute[absolute.length - 1] : null };
}
