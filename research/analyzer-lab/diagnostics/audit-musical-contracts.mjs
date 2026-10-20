// Diagnostic snapshot, not a golden test: fixes should change these observations.
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
const load = createLoader({}, { Float32Array, Float64Array });
const { SectionAnalyzer } = load('analyzer/SectionAnalyzer.ts');
const { applySpectralPivot } = load('analyzer/SpectralPivot.ts');
const { computeDramaturgyAnalysis } = load('analyzer/DramaturgyBuilder.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { featureFrameStepSeconds } = load('types/featureClock.ts');
const fill = (n, value) => new Float32Array(n).fill(value);
const features = { totalFrames: 1000, rmsT: fill(1000, .25), rawBassT: fill(1000, .1),
    rawMidT: fill(1000, .2), rawHighT: fill(1000, .1), typRms: .5 };
const visual = { melody: .2, vocal: .3, fx: .4, density: .5, brightness: .6, tension: .7 };
const section = new SectionAnalyzer(features, { gridConfidence: 1, bpmConfidence: 1, secondsPerBar: 2, gridOffset: 0 }, 100, 1);
section.calculate(Array.from({ length: 1000 }, () => ({ ...visual })));
const f = [{ ...visual }];
const frame = [{ e: .2, eRatio: .2, state: 'LOW', melodyProj: .2, fxProj: .4, densityProj: .5, perceptualSpectrum: [] }];
applySpectralPivot(f, frame, [.5], 1);
const pressureFrames = Array.from({ length: 8000 }, (_, i) => ({ e: i < 4000 ? .1 : .9, eRatio: i < 4000 ? .1 : .9 }));
const pressureFeatures = Array.from({ length: 8000 }, (_, i) => ({ ...visual, tension: i < 4000 ? .1 : .9, density: i < 4000 ? .1 : .9 }));
const raw = computeDramaturgyAnalysis(pressureFeatures, pressureFrames, 1, 100).buildupConfidence;
const aligned = computeDramaturgyAnalysis(pressureFeatures, pressureFrames, 1, 100, 3200).buildupConfidence;
const at = 3200;
const sampleCount = 44100 * 10 + 777, hop = 1024, rate = 44100;
const legacyCount = Math.floor(sampleCount / hop), duration = sampleCount / rate;
const current = analyzeAudio({ samples: new Float32Array(sampleCount), sampleRate: rate, options: { hopSize: hop, requestId: 1 } });
const count = current.frames.length, currentStep = featureFrameStepSeconds(current.trackAnalysis);
console.log(JSON.stringify({
  sectionRms: { inputBlockRms: .25, typicalRms: .5, barAvgRms: section.barAnalyses[0].avgRms,
    sectionAvgRms: section.trackSections[0].avgRms, sectionRmsAmplitude: section.trackSections[0].rmsAmplitude,
    sectionEnergy: section.trackSections[0].energy },
  spectralPivot: { beforeFx: .4, afterFeatureFx: f[0].fx, afterFrameFx: frame[0].fxProj, afterFeatureMelody: f[0].melody, afterFrameMelody: frame[0].melodyProj },
  buildup: { authoredStepSec: 40, alignmentSpanSec: 32, preStepProbeSec: at / 100,
    unalignedProbe: raw[at], alignedProbe: aligned[at], changedTemporalMeaning: aligned[at] !== raw[at] },
  tailClock: { sampleCount, sampleRate: rate, hop, frameCount: count, duration,
    trueFrameStep: hop / rate, publishedFrameStep: currentStep,
    lastFrameTimeDisagreement: (count - 1) * (currentStep - hop / rate), unprocessedTailSamples: 0,
    zeroPaddingSamples: count * hop - sampleCount,
    legacy: { frameCount: legacyCount, inferredFrameStep: duration / legacyCount,
      lastFrameTimeDisagreement: (legacyCount - 1) * (duration / legacyCount - hop / rate),
      unprocessedTailSamples: sampleCount % hop } },
  stereo: { channels: [1, -1], hostLeftProjection: 1, labDefaultChannel0Projection: 1, explicitArithmeticMeanProjection: 0,
    interpretation: 'Declared projection policy agrees; actual browser/SoundFile decoder and resampling parity remains unmeasured. WAV parity is tested in test_pcm_identity.py.' }
}, null, 2));
