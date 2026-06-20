# Dashboard Metrics Metadata

This document designs a metadata and tooltip system for dashboard and dashboard-adjacent music metrics. It is design-only and does not implement UI code.

## Metadata Interface

```ts
interface MetricMetadata {
  name: string;
  description: string;
  source: string;
  range: string;
  tooltip: string;
}
```

Implementation note: `description` should be user-facing. Technical details, negative definitions, and longer source notes should live in the metadata registry or documentation, not in the tooltip string.

## Signal-Integrity Calibration Context

Dashboard music metrics are downstream of the offline `SpectralCalibration -> FeatureExtractor -> FeatureClassifier` pipeline. Calibration uses a bounded two-pass approach: a fast RMS/flux scan selects candidate calibration windows, then target FFT analysis runs only on those selected windows. The calibration confidence object measures signal quality, not musical source type.

`signalToNoise` estimates how clearly spectral peaks stand above the noise floor. Low values reduce mid/presence false positives in the Vocal metric. `spectralStability` estimates how consistent the frequency distribution is across selected windows. High values can support Melody Presence when mid bands are concentrated; low values can support FX when high-frequency bands are active.

Classifier limits: Vocal means strictly mid/presence dominance, FX means transient/high-frequency presence, and Melody Presence is tonal/mid-band presence. These are deterministic DSP heuristics, not AI/ML stem separation.

`SpectralCalibrationMusicalProfile` adds broad track-level hints (`lowEnd`, `tonal`, `vocalLike`, `noisyHighs`, `transientRich`, `midBody`) for the classifier. These hints only bias the same deterministic metrics and should not be exposed as user-facing source labels.

## BPM

## User Description

Estimated tempo of the loaded track.

## Technical Meaning

Worker-estimated beats per minute from autocorrelation/comb-filter analysis of the onset envelope (`TempoEstimator`). The estimator builds ordered `TempoCandidate` values in the 70..185 BPM range, resolves close half/double-time aliases (preferring the actual beat rate when the fast grid is fully covered), and falls back to `120` when detection is insufficient. When candidates exist, the displayed BPM is the top candidate: `AnalysisResult.bpm === AnalysisResult.tempoCandidates[0].bpm`.

## Source

`src/audio/analyzer.worker.ts` produces `AnalysisResult.bpm`, `bpmConfidence`, `gridConfidence`, `downbeatConfidence`, and `tempoCandidates`; `AudioEngine` accepts the BPM into `State.bpm`; `DashboardUI` displays the BPM badge. Confidence and alternate tempo candidates are debug metadata, not default dashboard cards.

## Range

Nominally `70..185 BPM` from the estimator, with fallback `120 BPM`.

## Common Misinterpretations

- Not a DAW-grade tempo map.
- Not a live beat clock.
- Does not represent local tempo changes.
- Confidence fields are internal analyzer evidence and should not be presented as user-facing certainty by default.

## Tooltip Text

Estimated track tempo from offline beat analysis.
Not a live tempo map.

## Energy

## User Description

How loud or energetic the current moment is relative to the track.

## Technical Meaning

`AudioFrame.e`, normalized RMS energy. The worker smooths current RMS against a track-level typical RMS.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.e`; `PlexusRenderer` copies it into `State.currentFrame.e`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not musical intensity by itself.
- Not bass, density, or loudness in dB.
- Can be high during sustained non-rhythmic audio.

## Tooltip Text

Normalized RMS energy for the current frame.
Not a dB meter.

## Density

## User Description

How busy or active the current audio texture is.

## Technical Meaning

Dashboard label for `AudioFrame.densityProj`, a canonical projection field containing the smoothed density projection. It is primarily derived from normalized spectral flux, not raw bass.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.densityProj` as `sDensity`; `PlexusRenderer` copies it into `State.currentFrame.densityProj`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not bass.
- Not the `BarAnalysis.bass` low-band spectral ratio.
- Not a count of instruments or stems.

## Tooltip Text

Smoothed density projection from spectral change.
Not bass or low-band energy.

## Melody Presence

## User Description

How strongly the current frame resembles pitched melodic material.

## Technical Meaning

Dashboard label for `AudioFrame.melodyProj`, a canonical projection field containing the smoothed melody-presence projection. It combines tonal mid-band concentration, crest, flatness, and calibration `spectralStability`. High signal-integrity stability can boost this projection when mid bands are concentrated; noisy low-integrity spectra are penalized.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.melodyProj` as `sMelody`; `PlexusRenderer` copies it into `State.currentFrame.melodyProj`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not raw mid-band energy.
- Not melody extraction or note detection.
- Not separate from vocals with stem-level accuracy.
- Not an AI/ML stem separator.

## Tooltip Text

Pitched melodic presence estimate.
Not raw mid band or note detection.

## Vocal

## User Description

How strongly the current frame shows mid/presence dominance.

## Technical Meaning

`VisualFeatureFrame.vocal`, a mid/presence dominance heuristic derived from low-mid, mid, and presence energy with tonal and ZCR context. Calibration `signalToNoise` heavily penalizes this score when noisy material could masquerade as presence energy.

## Source

`src/audio/analyzer.worker.ts` produces `TrackAnalysis.features[].vocal`; `PlexusRenderer` copies it into `State.currentFeatures.vocal`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Strictly mid/presence dominance.
- Not vocal stem separation.
- Not lyric or voice detection.
- Not an AI/ML stem separator.
- Can respond to synths or instruments with vocal-like formants.

## Tooltip Text

Mid/presence dominance estimate.
Not voice detection or stem separation.

## FX

## User Description

How much transient or high-frequency texture is present.

## Technical Meaning

`VisualFeatureFrame.fx`, a smoothed transient/high-frequency presence feature. It shares the same core derivation as `AudioFrame.fxProj`/FX Presence but is part of the canonical feature frame. Low calibration `spectralStability` can boost this score when high-frequency bands are active, because chaotic high-band spectra are more likely to be transient/noise texture.

## Source

`src/audio/analyzer.worker.ts` produces `TrackAnalysis.features[].fx`; `PlexusRenderer` copies it into `State.currentFeatures.fx`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Transient/high-frequency presence, not raw treble.
- Not an effects bus or plugin signal.
- Not an AI/ML stem separator.
- Can respond to noisy percussion and high transients.

## Tooltip Text

Transient/high-frequency presence estimate.
Not raw treble or an effects bus.

## Tension

## User Description

How much musical pressure the current moment carries.

## Technical Meaning

`VisualFeatureFrame.tension`, a smoothed pressure estimate derived from density and brightness. It also contributes to dramaturgy and modulation.

## Source

`src/audio/analyzer.worker.ts` produces `TrackAnalysis.features[].tension`; `computeDramaturgyAnalysis()` also uses it for pressure and trends. It is currently timeline/modulation-facing rather than a primary dashboard card.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not harmonic tension analysis.
- Not emotional sentiment.
- Not the same as `State.modulation.kineticTension`, which is a renderer-facing composite.

## Tooltip Text

Density/brightness pressure estimate.
Not harmonic analysis.

## Buildup

## User Description

How strongly the track appears to be rising toward a more intense moment.

## Technical Meaning

`TrackAnalysis.buildupConfidence[]`, derived from a rolling pressure comparison using tension, density, current energy, and block-relative energy.

## Source

`src/audio/analyzer.worker.ts` computes `buildupConfidence`; `DashboardUI.drawTimelineBuildup()` visualizes it on the dramaturgy timeline; `PlexusRenderer` blends it into modulation.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not a guaranteed drop detector.
- Not a genre-aware section classifier by itself.
- Not computed live during playback.

## Tooltip Text

Rising pressure confidence from offline analysis.
Not a guaranteed drop marker.

## Dynamics State

## User Description

The current macro energy state of the track.

## Technical Meaning

Dashboard projection of `AudioFrame.state` and `AudioFrame.eRatio`. State is bar/block-aligned as `HIGH`, `LOW`, `LOW_DROP`, `LOW_OVERLOAD`, or `IDLE`; the bar fill uses block-relative energy ratio.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.state` and `AudioFrame.eRatio`; `PlexusRenderer` copies them into `State.currentFrame`; `DashboardUI` displays the state text and bar width.

## Range

State enum plus `eRatio` in `0.0..1.0`.

## Common Misinterpretations

- Not a full musical section label.
- `LOW_OVERLOAD` is a safety/override state, not a low-energy block.
- The bar is relative to track block energy, not absolute loudness.

## Tooltip Text

Macro energy state plus block-relative energy.
Not a section label.

## Beat Impulse

## User Description

Decaying visual pulse from accepted percussive beat events.

## Technical Meaning

`State.beatDecay`, set to `1.0` when an accepted `BeatEvent` is consumed, then decayed each draw by `0.88`. Accepted events come from offline percussive onset/transient evidence near the authoritative timing model, with sustained bass rejection. It is a visual transient, not a worker scalar metric.

## Source

`src/audio/analyzer.worker.ts` produces `BeatEvent[]` through the headless analyzer; `DramaturgyBuilder` accepts visual events from percussive onset evidence and `BeatEventClassifier` assigns a visual impact category. `PlexusRenderer` consumes events by playback time and writes `State.beatDecay`; `DashboardUI` displays it.

## Range

Starts at `1.0` on a beat event and decays toward `0.0`. Display assumes `0.0..1.0`.

## Common Misinterpretations

- Not beat strength directly from the worker.
- Not BPM.
- Not raw bass.
- Not persistent rhythm density.
- Not drum stem detection.

## Tooltip Text

Decaying visual pulse from accepted percussive beat events.
Not BPM, raw bass, or drum stem detection.

## Spectrum Balance

## User Description

24-column logarithmic spectral balance of the loaded track.

## Technical Meaning

`AudioFrame.perceptualSpectrum`, a precomputed 24-element array produced by the offline analyzer. Each element covers one logarithmically spaced band from 20 Hz to 16 kHz and is normalized to `0..1` using a track-relative baseline (p88/p98 of the per-band distribution) and effective-bin normalization to prevent low/sub bands from appearing sparse because few FFT bins fall there at 1024-sample resolution. A simplified inverse perceptual compensation is applied after normalization: bass/sub bands are visually lifted, presence is modestly controlled, and extreme high frequencies are very gently attenuated. The first six low bands receive very light adjacent smoothing to improve readability without making the columns identical.

The dashboard draws a 24-column monochrome canvas that reads `State.currentFrame.perceptualSpectrum`. A per-column peak-hold marker (`spectrumPeakHold`) rises immediately and falls back at rate `0.024` per draw. This peak-hold is UI-only state; it is not part of the analyzer output.

Spectrum Balance is a lightweight visualization. It is not a studio spectrum analyzer and does not claim psychoacoustic model accuracy, instrument detection, or stem separation.

## Source

`src/analyzer/FeatureExtractor.ts` accumulates `perceptualSpectrumT` and `perceptualSpectrumEffectiveBinCount` during FFT analysis. `src/analyzer/analyzeAudio.ts` calls `buildPerceptualSpectrum(features)` to produce `AudioFrame.perceptualSpectrum`. `PlexusRenderer.ts` copies the field into `State.currentFrame.perceptualSpectrum`. `DashboardUI.drawPerceptualSpectrum()` renders it to a `<canvas id="perceptual-spectrum-canvas">`.

## Range

`24 normalized bands, 20 Hz..16 kHz`, each value `0.0..1.0`.

## Common Misinterpretations

- Not a studio-grade or psychoacoustically accurate spectrum analyzer.
- Not a realtime FFT; no `getByteFrequencyData` is used. All values are precomputed offline.
- Not an instrument or stem detector.
- Peak-hold markers are UI-only; they are not persisted in `AudioFrame` or analyzer output.
- Low-band smoothing does not make columns identical — it only reduces visual noise in the sub/bass range.

## Tooltip Text

Track-relative compensated spectrum.
Bass/sub is visually lifted; no realtime FFT.

## Registry Sketch

```ts
const metricMetadata: Record<string, MetricMetadata> = {
  bpm: {
    name: 'BPM',
    description: 'Estimated tempo of the loaded track.',
    source: 'AnalysisResult.bpm from analyzer worker; debug confidence/candidates from AnalysisResult and TrackAnalysis',
    range: '70..185 BPM, fallback 120; confidence 0.0..1.0',
    tooltip: 'Estimated track tempo from offline beat analysis.\nNot a live tempo map.'
  },
  energy: {
    name: 'Energy',
    description: 'How loud or energetic the current moment is relative to the track.',
    source: 'State.currentFrame.e',
    range: '0.0..1.0',
    tooltip: 'Normalized RMS energy for the current frame.\nNot a dB meter.'
  },
  density: {
    name: 'Density',
    description: 'How busy or active the current audio texture is.',
    source: 'State.currentFrame.densityProj',
    range: '0.0..1.0',
    tooltip: 'Smoothed density projection from spectral change.\nNot bass or low-band energy.'
  },
  melodyPresence: {
    name: 'Melody Presence',
    description: 'How strongly the current frame resembles pitched melodic material.',
    source: 'State.currentFrame.melodyProj',
    range: '0.0..1.0',
    tooltip: 'Pitched melodic presence estimate.\nNot raw mid band or note detection.'
  },
  vocal: {
    name: 'Vocal',
    description: 'How strongly the current frame shows mid/presence dominance.',
    source: 'State.currentFeatures.vocal',
    range: '0.0..1.0',
    tooltip: 'Mid/presence dominance estimate.\nNot voice detection or stem separation.'
  },
  fx: {
    name: 'FX',
    description: 'How much transient or high-frequency texture is present.',
    source: 'State.currentFeatures.fx',
    range: '0.0..1.0',
    tooltip: 'Transient/high-frequency presence estimate.\nNot raw treble or an effects bus.'
  },
  tension: {
    name: 'Tension',
    description: 'How much musical pressure the current moment carries.',
    source: 'TrackAnalysis.features[].tension',
    range: '0.0..1.0',
    tooltip: 'Density/brightness pressure estimate.\nNot harmonic analysis.'
  },
  buildup: {
    name: 'Buildup',
    description: 'How strongly the track appears to be rising toward a more intense moment.',
    source: 'TrackAnalysis.buildupConfidence[]',
    range: '0.0..1.0',
    tooltip: 'Rising pressure confidence from offline analysis.\nNot a guaranteed drop marker.'
  },
  dynamicsState: {
    name: 'Dynamics State',
    description: 'The current macro energy state of the track.',
    source: 'State.currentFrame.state and State.currentFrame.eRatio',
    range: 'IDLE | HIGH | LOW | LOW_DROP | LOW_OVERLOAD plus 0.0..1.0 bar',
    tooltip: 'Macro energy state plus block-relative energy.\nNot a section label.'
  },
  beatImpulse: {
    name: 'Beat Impulse',
    description: 'Decaying visual pulse from accepted percussive beat events.',
    source: 'State.beatDecay from consumed BeatEvent[]',
    range: '1.0 on hit, decays toward 0.0',
    tooltip: 'Decaying visual pulse from accepted percussive beat events.\nNot BPM, raw bass, or drum stem detection.'
  },
  perceptualSpectrum: {
    name: 'Spectrum Balance',
    description: 'Offline 24-band logarithmic FFT aggregation from 20Hz..16kHz with track-relative normalization and simplified inverse perceptual compensation.',
    source: 'AudioFrame.perceptualSpectrum',
    range: '24 normalized bands, 20 Hz..16 kHz',
    tooltip: 'Track-relative compensated spectrum.\nBass/sub is visually lifted; no realtime FFT.'
  }
};
```
