// Shared, engine-agnostic fixture + summary library for the analyzer timing tests.
//
// Imported by BOTH:
//   - scripts/generate-golden-masters.ts (Bun) to WRITE regression snapshots, and
//   - tests/analyzer-golden.test.mjs (regression, +/-15ms) and
//     tests/analyzer-verification.test.mjs (musical correctness vs ground truth).
//
// Pure JavaScript, no imports, fully deterministic (seeded LCG only).
//
// Each fixture carries a `groundTruth` block describing the KNOWN musical timing of the
// synthesized signal (tempo, beat positions, bar starts) with explicit tolerances, so the
// verification suite asserts correctness rather than mere regression.

export const HOP_SIZE = 1024;
export const TIME_TOLERANCE_SEC = 0.015; // regression snapshot tolerance for time arrays
export const SCALAR_TOLERANCE = 1e-4;

// --- deterministic signal primitives -------------------------------------------------

function makeNoise(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return (state / 0xffffffff) * 2 - 1;
    };
}

function addKick(samples, sampleRate, timeSec, gain) {
    // Pitched, fast-decaying sine sweep ~90 -> 45 Hz: a sharp broadband-ish low transient.
    const start = Math.floor(timeSec * sampleRate);
    const decay = 0.16;
    const length = Math.floor(decay * sampleRate);
    for (let i = 0; i < length; i++) {
        const idx = start + i;
        if (idx < 0 || idx >= samples.length) break;
        const t = i / sampleRate;
        const env = Math.exp(-t / (decay * 0.35));
        const freq = 45 + 45 * Math.exp(-t / 0.012);
        samples[idx] += Math.sin(2 * Math.PI * freq * t) * gain * env;
    }
}

function addNoiseHit(samples, sampleRate, timeSec, gain, decaySec, noise, highMix) {
    const start = Math.floor(timeSec * sampleRate);
    const length = Math.floor(decaySec * sampleRate);
    let prev = 0;
    for (let i = 0; i < length; i++) {
        const idx = start + i;
        if (idx < 0 || idx >= samples.length) break;
        const t = i / sampleRate;
        const n = noise();
        const hp = n - prev;
        prev = n;
        samples[idx] += (n * (1 - highMix) + hp * highMix) * gain * Math.exp(-t / (decaySec * 0.5));
    }
}

function addTone(samples, sampleRate, startSec, endSec, freq, gain) {
    const start = Math.max(0, Math.floor(startSec * sampleRate));
    const end = Math.min(samples.length, Math.floor(endSec * sampleRate));
    for (let i = start; i < end; i++) {
        const t = i / sampleRate;
        samples[i] += Math.sin(2 * Math.PI * freq * t) * gain;
    }
}

function softClip(samples) {
    for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
    return samples;
}

// --- pattern-driven EDM renderer -----------------------------------------------------

// Renders a track from a 16th-note pattern (one bar, repeated) at a given tempo/offset and
// returns both the audio and the exact ground-truth beat/bar grid.
//
// pattern: { kick:[..16th idx], snare:[..], hat:[..] }, optional silenceBars:[barIndex...]
function renderEdm({ id, requestId, bpm, sampleRate, durationSec, offsetSec, pattern, subFreq, seed, silenceWindow, strictTempo, allowedBpmError }) {
    const samples = new Float32Array(Math.floor(durationSec * sampleRate));
    const noise = makeNoise(seed);
    const beatSec = 60 / bpm;
    const sixteenth = beatSec / 4;
    const barSec = beatSec * 4;
    if (subFreq) addTone(samples, sampleRate, 0, durationSec, subFreq, 0.08);

    const inSilence = (t) => silenceWindow && t >= silenceWindow[0] && t < silenceWindow[1];

    for (let barStart = offsetSec, bar = 0; barStart < durationSec; barStart += barSec, bar++) {
        // Low-frequency downbeat marker (a short sub-bass note on "the one"), the way a
        // bassline anchors the bar in real productions. This survives soft-clipping and makes
        // the bar phase unambiguous to a bass-weighted downbeat detector.
        if (!inSilence(barStart)) addKick(samples, sampleRate, barStart, 0.55); // extra low "boom" on the one
        for (const s of pattern.kick) {
            const t = barStart + s * sixteenth;
            if (!inSilence(t)) addKick(samples, sampleRate, t, s === 0 ? 1.15 : 0.9);
        }
        for (const s of (pattern.snare || [])) {
            const t = barStart + s * sixteenth;
            if (!inSilence(t)) addNoiseHit(samples, sampleRate, t, 0.34, 0.11, noise, 0.55);
        }
        for (const s of (pattern.hat || [])) {
            const t = barStart + s * sixteenth;
            if (!inSilence(t)) addNoiseHit(samples, sampleRate, t, 0.10, 0.03, noise, 0.92);
        }
    }
    if (silenceWindow) {
        // ambient pad so the breakdown is not pure digital silence
        addTone(samples, sampleRate, silenceWindow[0], silenceWindow[1], 220, 0.05);
    }
    softClip(samples);

    // ground-truth grid
    const beats = [];
    for (let t = offsetSec; t < durationSec - beatSec * 0.25; t += beatSec) beats.push(Number(t.toFixed(6)));
    const bars = [];
    for (let t = offsetSec; t < durationSec - barSec * 0.25; t += barSec) bars.push(Number(t.toFixed(6)));

    return {
        id,
        requestId,
        sampleRate,
        build: () => samples.slice(),
        groundTruth: {
            expectedBpm: bpm,
            allowedBpmError: allowedBpmError ?? 2,
            // When strict, a half/double-time read is a FAILURE (the engine must lock the
            // actual beat rate); otherwise a metric multiple is accepted.
            strictTempo: strictTempo ?? false,
            expectedBeatPositions: beats,
            allowedBeatTolerance: 0.045,
            expectedBarStarts: bars,
            allowedBarTolerance: 0.075
        }
    };
}

// Pattern vocabulary (16th-note indices within one bar: 0..15; quarters = 0,4,8,12).
// Clap/snare on the 2 & 4 backbeat (slots 4, 12) gives every four-on-floor variant an
// unambiguous downbeat (the "one" is the beat WITHOUT the backbeat), as in real productions.
const FOUR_ON_FLOOR = { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] };
const TECHNO = { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] };
const TRANCE = { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] };
const BREAKBEAT = { kick: [0, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] };
const DNB = { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] };
const SPARSE = { kick: [0, 4, 8, 12], snare: [4, 12] };
// Unambiguous slow four-on-floor at 70 BPM (kick every beat) so the verification grid is exact;
// genuine half/double metric ambiguity is exercised separately in analyzer-metric-ambiguity.
const SLOW_FLOOR = { kick: [0, 4, 8, 12], snare: [4, 12], hat: [8] };

export const GOLDEN_FIXTURES = [
    renderEdm({ id: 'house-120', requestId: 7001, bpm: 120, sampleRate: 44100, durationSec: 7, offsetSec: 0.25, pattern: FOUR_ON_FLOOR, subFreq: 55, seed: 0x1111 }),
    renderEdm({ id: 'house-128', requestId: 7002, bpm: 128, sampleRate: 44100, durationSec: 7, offsetSec: 0.20, pattern: FOUR_ON_FLOOR, subFreq: 55, seed: 0x2222 }),
    renderEdm({ id: 'techno-140', requestId: 7003, bpm: 140, sampleRate: 44100, durationSec: 7, offsetSec: 0.15, pattern: TECHNO, subFreq: 49, seed: 0x3333 }),
    renderEdm({ id: 'trance-150', requestId: 7004, bpm: 150, sampleRate: 44100, durationSec: 7, offsetSec: 0.10, pattern: TRANCE, subFreq: 49, seed: 0x4444 }),
    renderEdm({ id: 'dnb-176', requestId: 7005, bpm: 176, sampleRate: 44100, durationSec: 7, offsetSec: 0.12, pattern: DNB, subFreq: 44, seed: 0x5555, strictTempo: true, allowedBpmError: 5 }),
    renderEdm({ id: 'breakbeat-140', requestId: 7006, bpm: 140, sampleRate: 44100, durationSec: 7, offsetSec: 0.18, pattern: BREAKBEAT, subFreq: 49, seed: 0x6666 }),
    renderEdm({ id: 'sparse-techno-90', requestId: 7007, bpm: 90, sampleRate: 44100, durationSec: 8, offsetSec: 0.30, pattern: SPARSE, subFreq: 50, seed: 0x7777 }),
    renderEdm({ id: 'slow-floor-70', requestId: 7008, bpm: 70, sampleRate: 44100, durationSec: 9, offsetSec: 0.20, pattern: SLOW_FLOOR, subFreq: 41, seed: 0x8888 }),
    renderEdm({ id: 'breakdown-124', requestId: 7009, bpm: 124, sampleRate: 44100, durationSec: 9, offsetSec: 0.22, pattern: FOUR_ON_FLOOR, subFreq: 53, seed: 0x9999, silenceWindow: [3.5, 5.5] })
];

export function buildFixtureInput(fixture) {
    return {
        samples: fixture.build(),
        sampleRate: fixture.sampleRate,
        options: { requestId: fixture.requestId, algorithmVersion: 2, phraseSize: 8, hopSize: HOP_SIZE }
    };
}

// --- regression summary projection ---------------------------------------------------

function round(value, digits = 6) {
    return Number((value ?? 0).toFixed(digits));
}

export function summarizeForGolden(fixtureId, result) {
    return {
        id: fixtureId,
        bpm: result.bpm,
        bpmConfidence: round(result.bpmConfidence),
        gridConfidence: round(result.gridConfidence),
        downbeatConfidence: round(result.downbeatConfidence),
        gridOffset: round(result.trackAnalysis.gridOffset),
        hopSize: result.hopSize,
        duration: round(result.trackAnalysis.duration),
        timingConfidence: {
            tempo: round(result.timingConfidence.tempo),
            beat: round(result.timingConfidence.beat),
            grid: round(result.timingConfidence.grid),
            overall: round(result.timingConfidence.overall)
        },
        counts: {
            frames: result.frames.length,
            events: result.events.length,
            beats: result.beats.length,
            bars: result.trackAnalysis.bars.length,
            barStarts: result.barStarts.length,
            sections: result.trackAnalysis.sections.length,
            cues: result.trackAnalysis.cues.length,
            patterns: result.trackAnalysis.patterns.length
        },
        tempoCandidates: result.tempoCandidates.map(c => ({
            bpm: c.bpm,
            score: round(c.score),
            intervalSec: round(c.intervalSec),
            peakCount: c.peakCount,
            isHalfTime: c.isHalfTime,
            isDoubleTime: c.isDoubleTime
        })),
        beats: result.beats.map(t => round(t)),
        barStarts: result.barStarts.map(t => round(t)),
        sectionStarts: result.trackAnalysis.sections.map(s => round(s.start))
    };
}

// --- tolerant regression comparison --------------------------------------------------

const TIME_ARRAY_KEYS = new Set(['beats', 'barStarts', 'sectionStarts']);

function compareNumber(actual, expected, tol, path, failures) {
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
        failures.push(`${path}: expected finite number, got ${actual}`);
        return;
    }
    if (Math.abs(actual - expected) > tol) failures.push(`${path}: expected ${expected}, got ${actual} (tol ${tol})`);
}

function compareTimeArray(actual, expected, path, failures) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
        failures.push(`${path}: length ${Array.isArray(actual) ? actual.length : 'n/a'} != ${expected.length}`);
        return;
    }
    for (let i = 0; i < expected.length; i++) compareNumber(actual[i], expected[i], TIME_TOLERANCE_SEC, `${path}[${i}]`, failures);
}

export function compareGolden(actual, expected, path = '$', failures = []) {
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            failures.push(`${path}: array length mismatch (${Array.isArray(actual) ? actual.length : 'n/a'} != ${expected.length})`);
            return failures;
        }
        for (let i = 0; i < expected.length; i++) compareGolden(actual[i], expected[i], `${path}[${i}]`, failures);
        return failures;
    }
    if (expected && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object') {
            failures.push(`${path}: expected object, got ${actual}`);
            return failures;
        }
        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);
        if (actualKeys.length !== expectedKeys.length) {
            failures.push(`${path}: key count ${actualKeys.length} != ${expectedKeys.length}`);
        }
        for (const key of expectedKeys) {
            const childPath = `${path}.${key}`;
            if (TIME_ARRAY_KEYS.has(key) && Array.isArray(expected[key])) compareTimeArray(actual[key], expected[key], childPath, failures);
            else compareGolden(actual[key], expected[key], childPath, failures);
        }
        return failures;
    }
    if (typeof expected === 'number' && !Number.isInteger(expected)) {
        compareNumber(actual, expected, SCALAR_TOLERANCE, path, failures);
        return failures;
    }
    if (actual !== expected) failures.push(`${path}: expected ${expected}, got ${actual}`);
    return failures;
}

// --- musical-correctness helpers (used by the verification suite) --------------------

// Fraction of expected events that have a detected event within tolerance (recall).
export function coverage(expected, detected, tolerance) {
    if (expected.length === 0) return 1;
    let matched = 0;
    for (const e of expected) {
        if (detected.some(d => Math.abs(d - e) <= tolerance)) matched++;
    }
    return matched / expected.length;
}

// Is `bpm` the expected tempo or a metric multiple (x2 / x0.5 / x1.5 for 3:2 feels)?
export function isMetricMatch(bpm, expectedBpm, tolerance) {
    const ratios = [1, 2, 0.5, 1.5, 2 / 3];
    return ratios.some(r => Math.abs(bpm - expectedBpm * r) <= tolerance);
}
