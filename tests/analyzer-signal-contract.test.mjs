import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader({}, { Float32Array, Float64Array });
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { FeatureExtractor } = load('analyzer/FeatureExtractor.ts');
const { FFT } = load('analyzer/math/FFT.ts');
const { SectionAnalyzer } = load('analyzer/SectionAnalyzer.ts');
const { GridAligner } = load('analyzer/GridAligner.ts');
const { normalizeTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
const { normalizeFeatureClock, featureFrameStepSeconds } = load('types/featureClock.ts');
const { cueContext } = load('semantics/cueEvidence.ts');
const H = 1024, FS = 44100;
const visual = value => ({ melody: value, vocal: value, fx: value, density: value, brightness: value, tension: value });
const assertFinite = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Published number must be finite');
    else if (value && typeof value === 'object') for (const child of Object.values(value)) assertFinite(child);
};

test('invalid PCM/clock/hop/request ids fail before progress or DSP', () => {
    const cases = [
        { samples: new Float32Array() }, { samples: [0, 1] }, { samples: new Float64Array(8) },
        ...[NaN, Infinity, -Infinity, 8.01, 1e30].map(value => ({ samples: Float32Array.of(0, value) })),
        ...[NaN, 0, 999, 384001, 44100.5].map(sampleRate => ({ sampleRate })),
        ...[NaN, 0, 2, 3, 1024.5, 131072].map(hopSize => ({ options: { hopSize } })),
        ...[NaN, -1, .5].map(requestId => ({ options: { requestId } }))
    ];
    for (const invalid of cases) {
        let callbacks = 0;
        assert.throws(() => analyzeAudio({ samples: new Float32Array(H), sampleRate: FS,
            onProgress: () => callbacks++, ...invalid }), /Analysis/);
        assert.equal(callbacks, 0);
    }
    assertFinite(analyzeAudio({ samples: new Float32Array(H).fill(1.25), sampleRate: FS }));
});

test('FFT rejects coercion/allocation hazards and retains the independent two-point DFT', () => {
    for (const size of [NaN, Infinity, 0, -4, 2.5, 4.5, 1024.5, 131072, 2 ** 32]) {
        assert.throws(() => new FFT(size), /power of two/);
    }
    const fft = new FFT(2);
    fft.re.set([2, -1]); fft.transform();
    assert.deepEqual(Array.from(fft.re), [1, 3]);
    assert.deepEqual(Array.from(fft.im), [0, 0]);
});

for (const length of [1, H - 1, H, H + 1, 2 * H - 1]) {
    test(`real support and true duration are preserved for ${length} samples`, () => {
        const samples = new Float32Array(length).fill(-.25), original = samples.slice();
        const result = analyzeAudio({ samples, sampleRate: FS });
        const duration = length / FS;
        assert.equal(result.frames.length, Math.ceil(length / H));
        assert.equal(result.trackAnalysis.duration, duration);
        assert.equal(result.trackAnalysis.sections.at(-1).end, duration);
        assert.equal(result.trackAnalysis.bars.at(-1).end, duration);
        const clock = normalizeFeatureClock(result.trackAnalysis);
        assert.equal(clock.sampleCount, length);
        assert.equal(featureFrameStepSeconds(result.trackAnalysis), H / FS);
        for (const frame of result.frames) assert.ok(frame.subEnergy !== undefined && frame.bassFlux !== undefined);
        for (const time of [...result.beats, ...result.barStarts, ...result.events.map(e => e.time),
            ...result.trackAnalysis.cues.map(e => e.time), ...result.trackAnalysis.noveltyPeaks.map(e => e.time)]) {
            assert.ok(time >= 0 && time < duration, `time ${time} outside ${duration}`);
        }
        for (const interval of [...result.trackAnalysis.bars, ...result.trackAnalysis.sections,
            ...result.trackAnalysis.tensionTrends.segments]) assert.ok(interval.end <= duration);
        assertFinite(result);
        assert.deepEqual(samples, original);
        assert.equal(JSON.stringify(analyzeAudio({ samples, sampleRate: FS })), JSON.stringify(result));
    });
}

test('tail-only attack enters features and zero padding invents no ZCR or RMS dilution', () => {
    const samples = new Float32Array(H * 8 + 512);
    samples[H * 8 + 256] = 1;
    const features = new FeatureExtractor(samples, FS, H); features.process();
    assert.equal(features.totalFrames, 9);
    assert.ok(Math.abs(features.rmsT[8] - Math.sqrt(1 / 512)) < 1e-8);
    assert.ok(features.fluxT[8] > 0);
    assert.equal(features.percussiveT[8], 0, 'Partial tail preserves raw evidence but abstains from a visual hit');
    samples[H * 7 + 512] = 1;
    const preceding = new FeatureExtractor(samples, FS, H); preceding.process();
    assert.ok(preceding.percussiveT[7] > 0, 'The preceding complete-window attack remains eligible');
    const negative = new FeatureExtractor(new Float32Array(H + 1).fill(-.5), FS, H); negative.process();
    assert.equal(negative.rmsT[1], .5);
    assert.equal(negative.zcrT[1], 0);
});

test('an exact one-second terminal bar includes the partial frame and its physical RMS', () => {
    const samples = new Float32Array(FS), remainder = FS % H;
    samples.fill(.25, FS - remainder);
    const result = analyzeAudio({ samples, sampleRate: FS });
    const expected = Math.sqrt(remainder * .25 ** 2 / FS);
    for (const interval of [result.trackAnalysis.bars.at(-1), result.trackAnalysis.sections.at(-1)]) {
        assert.equal(interval.end, 1);
        assert.ok(Math.abs(interval.rmsAmplitude - expected) < 1e-9);
        assert.equal(interval.peakRms, 1);
    }
});

test('bar and section RMS equal sample-weighted amplitude, separately from arrangement energy', () => {
    const features = { totalFrames: 3, sampleCount: 2304, rmsT: Float32Array.of(1, .25, .5),
        rawBassT: new Float32Array(3), rawMidT: new Float32Array(3), rawHighT: new Float32Array(3), typRms: 1 };
    const sectioner = new SectionAnalyzer(features,
        { gridConfidence: 1, bpmConfidence: 1, secondsPerBar: 10, gridOffset: 0 }, 1024, H);
    sectioner.calculate(Array.from({ length: 3 }, () => visual(.2)));
    const expected = Math.sqrt((1024 + 1024 * .25 ** 2 + 256 * .5 ** 2) / 2304);
    for (const interval of [...sectioner.barAnalyses, ...sectioner.trackSections]) {
        assert.ok(Math.abs(interval.rmsAmplitude - expected) < 1e-12);
        assert.ok(Math.abs(interval.avgRms - expected) < 1e-12);
        assert.equal(interval.peakRms, 1);
        assert.equal(interval.end, 2.25);
    }
    assert.equal(sectioner.trackSections[0].energy, 0);
});

test('a partial-window cutoff cannot re-anchor the accepted beat grid or its normalization', () => {
    const length = 1000, envelope = new Float32Array(length);
    for (let i = 8; i < length; i += 21) envelope[i] = 1;
    const source = { totalFrames: length, fluxT: envelope, onsetEnvT: envelope,
        fluxLowT: envelope, fluxMidT: envelope, fluxHighT: envelope,
        rawBassT: new Float32Array(length).fill(.7), rmsT: envelope, typRms: 1, typFlux: 1 };
    const tail = { ...source, totalFrames: length + 1, sampleCount: length * H + 512 };
    for (const name of ['fluxT', 'onsetEnvT', 'fluxLowT', 'fluxMidT', 'fluxHighT', 'rawBassT', 'rmsT']) {
        tail[name] = new Float32Array(length + 1); tail[name].set(source[name]); tail[name][length] = 1000;
    }
    const full = new GridAligner(source, FS, H), padded = new GridAligner(tail, FS, H);
    full.calculate(); padded.calculate();
    assert.ok(full.beats.length > 20);
    assert.equal(JSON.stringify(padded.musicalGrid()), JSON.stringify(full.musicalGrid()));
    assert.equal(JSON.stringify(padded.tempoCandidates), JSON.stringify(full.tempoCandidates));
    assert.equal(JSON.stringify(padded.timingConfidence), JSON.stringify(full.timingConfidence));
});

test('explicit sample clock preserves cue contrast at a late boundary; legacy remains compatible', () => {
    const base = { duration: 10.25, featureHopSize: H,
        features: Array.from({ length: 11 }, (_, i) => visual(i === 10 ? 1 : 0)) };
    const current = { ...base, featureClock: { sampleRate: 1024, sampleCount: 10496, hopSize: H,
        windowSize: H, originSample: 0, timestamp: 'window-start', tailPolicy: 'zero-pad' } };
    assert.equal(cueContext(current, 10).before, 0);
    assert.equal(cueContext(current, 10).after, 1);
    assert.equal(cueContext(base, 10).before, 1);
    assert.equal(featureFrameStepSeconds(base), 10.25 / 11);
    const normalized = normalizeTrackAnalysis(current);
    assert.equal(normalized.featureClock.sampleCount, 10496);
    assert.equal(JSON.parse(JSON.stringify(normalized)).featureClock.timestamp, 'window-start');
    assert.notEqual(normalized.featureClock, current.featureClock);
    for (const patch of [{ sampleRate: NaN }, { sampleCount: 10497 }, { hopSize: 512 },
        { windowSize: 2048 }, { originSample: 512 }, { tailPolicy: 'discard' }]) {
        const malformed = { ...current, featureClock: { ...current.featureClock, ...patch } };
        assert.equal(normalizeFeatureClock(malformed), undefined);
        assert.equal(normalizeTrackAnalysis(malformed).featureClock, undefined);
        assert.equal(cueContext(malformed, 10).before, 1);
    }
});
