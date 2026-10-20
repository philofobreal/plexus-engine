import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';
import { acceptedTimingFixture, acceptedTimingSpecs, measureAcceptedFixture, summarizeAcceptedMeasurements }
    from '../research/analyzer-lab/diagnostics/measure-accepted-timing.mjs';

const load = createLoader({}, { Float32Array, Float64Array });
const { refineAcceptedEventTiming: refine } = load('analyzer/AcceptedEventTiming.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const spec = (kind, sampleRate = 44100, phase = .25) => ({ kind, sampleRate, phase, gain: 1, polarity: 1, edge: null });
const observation = result => result.report.observations[0];

test('real-detector DC counterexamples retain their accepted times without touching PCM', () => {
    for (const phase of [.25, .95]) {
        const f = acceptedTimingFixture(spec('ramp', 44100, phase));
        const shifted = Float32Array.from(f.samples, x => x + .01), before = shifted.slice();
        // V1 still exposes the same physical candidate: this must be a gate repair,
        // not an accidental loss of the candidate due to offset-sensitive detection.
        const v1 = refine(shifted, f.sampleRate, f.hopSize, f.events, 1);
        assert.equal(observation(v1).status, 'refined');
        const v2 = refine(shifted, f.sampleRate, f.hopSize, f.events, 2);
        assert.equal(v2.report.algorithm, 'accepted-frame-band-timing-v2-dc1');
        assert.equal(observation(v2).status, 'gradual-attack');
        assert.equal(v2.events[0].time, f.events[0].time);
        assert.deepEqual(shifted, before);
    }
});

test('real-detector ramp sweep does not turn DC/gain/polarity into a discrete attack', () => {
    let checked = 0;
    for (const sampleRate of [8000, 22050, 44100, 48000]) for (const phase of [0, 1, .125, .25, .5, .75, .95]) {
        const f = acceptedTimingFixture(spec('ramp', sampleRate, phase));
        for (const gain of [.125, 1, 2]) for (const polarity of [-1, 1]) for (const dc of [-.1, -.01, 0, .01, .1]) {
            const samples = Float32Array.from(f.samples, x => x * gain * polarity + dc);
            const result = refine(samples, sampleRate, f.hopSize, f.events, 2);
            assert.notEqual(observation(result).status, 'refined', JSON.stringify({ sampleRate, phase, gain, polarity, dc }));
            assert.deepEqual(plain(result.events), f.events);
            checked++;
        }
    }
    assert.equal(checked, 840);
});

test('real sharp noise attacks retain useful localization with small DC offsets at multiple rates/phases', () => {
    let refined = 0;
    for (const sampleRate of [8000, 22050, 44100, 48000]) for (const phase of [0, 1, .125, .25, .75, .95]) {
        const f = acceptedTimingFixture(spec('noise-decay', sampleRate, phase));
        const baselineError = Math.abs(refine(f.samples, sampleRate, f.hopSize, f.events, 2).events[0].time - f.truthSamples[0] / sampleRate);
        const insideSearch = f.truthSamples[0] - Math.round(f.events[0].time * sampleRate)
            < Math.min(f.hopSize, Math.ceil(.03 * sampleRate));
        for (const polarity of [-1, 1]) for (const dc of [-.01, 0, .01]) {
            const samples = Float32Array.from(f.samples, x => x * polarity + dc);
            const result = refine(samples, sampleRate, f.hopSize, f.events, 2);
            if (insideSearch) {
                assert.equal(observation(result).status, 'refined', JSON.stringify({ sampleRate, phase, polarity, dc }));
                const error = Math.abs(result.events[0].time - f.truthSamples[0] / sampleRate);
                assert.ok(error < .010, 'the existing 10 ms measurement tolerance remains satisfied');
                assert.ok(error <= baselineError + 1 / sampleRate, 'small DC does not worsen localization by more than one sample');
                refined++;
            } else {
                assert.equal(result.events[0].time, f.events[0].time, 'the declared 30 ms cap still abstains');
            }
        }
    }
    assert.equal(refined, 114);
});

// Isolate sharpness from the separate band's offset-sensitive eligibility. This
// metamorphic test holds its candidate fixed, then varies PCM level and background.
let candidateOffset = 0;
const gate = createLoader({ './BandOnsets': { extractBandOnsets: (_, sampleRate) => {
    const sampleIndex = Math.ceil(.06 * sampleRate) + candidateOffset;
    return { candidates: [{ sampleIndex, endpointAmbiguous: false,
        supportStartSample: sampleIndex, supportEndSample: sampleIndex + 1 }] };
} } }, { Float32Array, Float64Array })('analyzer/AcceptedEventTiming.ts').refineAcceptedEventTiming;

test('fixed-candidate gate is DC/gain/polarity stable over silence and tonal mixtures', () => {
    let checked = 0;
    for (const sampleRate of [8000, 22050, 44100, 48000, 96000]) for (const kind of ['ramp', 'sharp-decay']) {
        // A fresh original-clock fixture permits a rate not used by the old generator.
        const frame = Math.ceil(.12 * sampleRate / 1024) * 1024;
        candidateOffset = Math.round(.003 * sampleRate);
        const onset = frame + candidateOffset, count = frame + 1024 + Math.ceil(.2 * sampleRate);
        const events = [{ time: frame / sampleRate, type: 1, intensity: .8 }];
        for (const background of ['silence', 'bass', 'mid', 'two-tones']) {
            const samples = Float32Array.from({ length: count }, (_, i) => {
                const t = i / sampleRate;
                let value = background === 'silence' ? 0 : .12 * Math.sin(2 * Math.PI * (background === 'mid' ? 440 : 70) * t + .3);
                if (background === 'two-tones') value += .04 * Math.sin(2 * Math.PI * 231 * t + .7);
                if (i >= onset) value += kind === 'ramp'
                    ? .4 * Math.min(1, (i - onset) / (.08 * sampleRate)) * Math.sin(2 * Math.PI * 70 * t)
                    : .6 * Math.sin((i - onset) * 2.6 + .3) * Math.exp(-(i - onset) / (.003 * sampleRate));
                return value;
            });
            const expected = observation(gate(samples, sampleRate, 1024, events, 2)).status;
            if (background === 'silence') assert.equal(expected, kind === 'ramp' ? 'gradual-attack' : 'refined');
            for (const gain of [.125, 1, 2]) for (const polarity of [-1, 1]) for (const dc of [-.2, 0, .2]) {
                const shifted = Float32Array.from(samples, x => x * gain * polarity + dc);
                const result = gate(shifted, sampleRate, 1024, events, 2);
                assert.equal(observation(result).status, expected, JSON.stringify({ sampleRate, kind, background, gain, polarity, dc }));
                checked++;
            }
        }
    }
    assert.equal(checked, 720);
});

test('pre-frame baseline never includes a preceding in-frame impulse, and reports all gate support', () => {
    for (const sampleRate of [8000, 44100, 96000]) {
        const frame = 10 * 1024, offset = Math.round(.003 * sampleRate);
        const samples = new Float32Array(frame + 1024 + Math.ceil(.06 * sampleRate)).fill(.01);
        samples[frame + offset] += .8;
        const events = [{ time: frame / sampleRate, type: 1, intensity: .8 }];
        candidateOffset = offset + 1;
        assert.equal(observation(gate(samples, sampleRate, 1024, events, 2)).status, 'gradual-attack',
            'a candidate after the impulse sees silence, not a baseline contaminated by the impulse');
        candidateOffset = offset;
        const result = gate(samples, sampleRate, 1024, events, 2), o = observation(result);
        assert.equal(o.status, 'refined');
        assert.equal(o.supportStartSample, frame - Math.ceil(.06 * sampleRate));
        assert.equal(o.supportEndSample, o.sampleIndex + Math.round(.012 * sampleRate));
        assert.ok(o.supportStartSample >= 0 && o.supportEndSample <= samples.length);
        assert.equal(plain(result.report).observations[0].time, o.sampleIndex / sampleRate);
    }
});

test('all frozen v1 outputs and the known v2 timing/abstention tradeoffs remain unchanged', () => {
    const v1 = JSON.parse(readFileSync('research/analyzer-lab/fixtures/accepted-timing-authored-01.json'));
    const v2 = JSON.parse(readFileSync('research/analyzer-lab/fixtures/accepted-timing-v2-development-01.json'));
    const current = [];
    for (const [index, input] of acceptedTimingSpecs().entries()) {
        assert.deepEqual(plain(measureAcceptedFixture((...args) => refine(...args, 1), input)), v1.cases[index]);
        const result = measureAcceptedFixture((...args) => refine(...args, 2), input), previous = v2.authored.cases[index].v2;
        assert.deepEqual(result.acceptedAfter, previous.acceptedAfter);
        assert.deepEqual(result.timing, previous.timing);
        for (const [i, o] of result.observations.entries()) {
            const old = previous.observations[i];
            const withoutSupport = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('support')));
            assert.deepEqual(plain(withoutSupport(o)), withoutSupport(old));
            assert.ok(o.supportStartSample <= old.supportStartSample && o.supportEndSample >= old.supportEndSample);
        }
        current.push(result);
    }
    assert.deepEqual(plain(summarizeAcceptedMeasurements(current)), v2.authored.summary.v2);
});
