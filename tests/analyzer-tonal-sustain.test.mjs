import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

// The shared TypeScript/vm helper also loads the environment-independent
// analyzer. These fixtures use no playback, renderer, Worker, or oracle code.
const { analyzeAudio } = createLoader({}, { Float32Array, Math, Number, Error })('analyzer/analyzeAudio.ts');
const HOP = 1024;
const DURATION = 6;
const HIT_TOLERANCE = 0.095;

function analyze(samples, sampleRate) {
    return analyzeAudio({ samples, sampleRate, options: { hopSize: HOP, requestId: 9021 } });
}

function sustainedTone(sampleRate, frequency, phase = 0, duration = DURATION, amplitude = 0.3) {
    const samples = new Float32Array(Math.round(duration * sampleRate));
    for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * time + phase) * Math.min(1, time / 0.1);
    }
    return samples;
}

function addPluck(samples, sampleRate, time, frequency, amplitude = 0.7) {
    const start = Math.round(time * sampleRate);
    const count = Math.round(0.18 * sampleRate);
    for (let i = 0; i < count && start + i < samples.length; i++) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.0006);
        samples[start + i] += amplitude * attack * Math.exp(-t / 0.035) * Math.cos(2 * Math.PI * frequency * t);
    }
}

function addPercussion(samples, sampleRate, time, kind, seed) {
    const start = Math.round(time * sampleRate);
    const count = Math.round((kind === 'kick' ? 0.25 : kind === 'snare' ? 0.16 : 0.055) * sampleRate);
    let previousNoise = 0;
    for (let i = 0; i < count && start + i < samples.length; i++) {
        const t = i / sampleRate;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = 2 * seed / 0xffffffff - 1;
        const attack = Math.min(1, t / 0.0006);
        let value;
        if (kind === 'kick') {
            // Independent descending-frequency pulse with a short envelope.
            const phase = 2 * Math.PI * (55 * t + 80 * 0.035 * (1 - Math.exp(-t / 0.035)));
            value = 0.7 * Math.cos(phase) * Math.exp(-t / 0.065);
        } else if (kind === 'snare') {
            value = (0.5 * noise + 0.12 * Math.cos(2 * Math.PI * 190 * t)) * Math.exp(-t / 0.028);
        } else {
            value = 0.26 * (noise - previousNoise) * Math.exp(-t / 0.012);
        }
        samples[start + i] += attack * value;
        previousNoise = noise;
    }
}

function assertAttacksPresent(result, times, description) {
    for (const time of times) {
        assert.ok(result.events.some(event => Math.abs(event.time - time) <= HIT_TOLERANCE),
            `${description}: missing generated attack at ${time.toFixed(3)} s; events=${result.events.map(event => event.time.toFixed(3)).join(',')}`);
    }
}

for (const sampleRate of [44_100, 48_000]) {
    for (const frequency of [55, 110, 220, 440, 1000]) {
        for (const phase of [0, Math.PI / 3]) {
            test(`sustained ${frequency} Hz at ${sampleRate} Hz, phase ${phase.toFixed(3)}, has no plateau BeatEvents`, () => {
                const samples = sustainedTone(sampleRate, frequency, phase);
                const result = analyze(samples, sampleRate);
                // Generator truth: after the initial smooth fade, neither the
                // amplitude nor frequency changes. There are zero new attacks.
                // The authoritative DP musical grid may continue independently.
                const plateauEvents = result.events.filter(event => event.time >= 1 && event.time < DURATION);
                assert.equal(plateauEvents.length, 0,
                    `steady tone leaked ${plateauEvents.length} false attacks: ${plateauEvents.map(event => event.time.toFixed(3)).join(',')}`);
            });
        }
    }

    for (const frequency of [220, 440, 1000]) {
        test(`short ${frequency} Hz tonal plucks at ${sampleRate} Hz preserve generated attacks`, () => {
            const samples = new Float32Array(DURATION * sampleRate);
            const times = [0.55, 1.65, 2.75, 3.85, 4.95];
            for (const time of times) addPluck(samples, sampleRate, time, frequency);
            const result = analyze(samples, sampleRate);
            assertAttacksPresent(result, times, `${frequency} Hz short plucks`);
        });
    }

    test(`kick, snare, and hat attacks over a sustained mid tone survive at ${sampleRate} Hz`, () => {
        const samples = sustainedTone(sampleRate, 440, Math.PI / 3, DURATION, 0.16);
        const times = [0.55, 1.5, 2.45, 3.4, 4.35, 5.3];
        const kinds = ['kick', 'snare', 'hihat'];
        times.forEach((time, index) => addPercussion(samples, sampleRate, time, kinds[index % kinds.length], 31 + index * 101));
        const result = analyze(samples, sampleRate);
        assertAttacksPresent(result, times, 'percussion over sustained mid tone');
        const unrelated = result.events.filter(event => event.time >= 1 && !times.some(time => Math.abs(event.time - time) <= HIT_TOLERANCE));
        assert.equal(unrelated.length, 0, `tone or percussion decay produced extra attacks: ${unrelated.map(event => event.time.toFixed(3)).join(',')}`);
    });

    test(`real tonal attack near the end of a clip remains audible to events at ${sampleRate} Hz`, () => {
        const samples = sustainedTone(sampleRate, 440, 0, DURATION, 0.12);
        const time = DURATION - 0.09;
        addPluck(samples, sampleRate, time, 1000);
        const result = analyze(samples, sampleRate);
        assertAttacksPresent(result, [time], 'late genuine tonal attack');
    });
}

for (const frequency of [440, 1000]) {
    test(`eight-second ${frequency} Hz sustain has no false attacks where final future context is truncated`, () => {
        const samples = sustainedTone(44_100, frequency, 0, 8);
        const result = analyze(samples, 44_100);
        const plateauEvents = result.events.filter(event => event.time >= 1 && event.time < 8);
        assert.equal(plateauEvents.length, 0,
            `steady tone leaked ${plateauEvents.length} false attacks: ${plateauEvents.map(event => event.time.toFixed(3)).join(',')}`);
    });
}

test('tonal sustain and short attacks remain deterministic without mutating input PCM', () => {
    const samples = sustainedTone(44_100, 1000, Math.PI / 3, 4, 0.15);
    addPluck(samples, 44_100, 1.2, 440);
    const before = samples.slice();
    const first = analyze(samples, 44_100);
    const second = analyze(samples, 44_100);
    assert.deepEqual(samples, before);
    assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)));
});
