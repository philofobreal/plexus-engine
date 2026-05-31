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

## BPM

## User Description

Estimated tempo of the loaded track.

## Technical Meaning

Worker-estimated beats per minute from accepted spectral-flux peak intervals. The estimator counts rounded intervals in the 70..180 BPM range and falls back to `120` when detection is insufficient.

## Source

`src/audio/analyzer.worker.ts` produces `AnalysisResult.bpm`; `AudioEngine` accepts it into `State.bpm`; `DashboardUI` displays it.

## Range

Nominally `70..180 BPM` from the estimator, with fallback `120 BPM`.

## Common Misinterpretations

- Not a DAW-grade tempo map.
- Not a live beat clock.
- Does not represent local tempo changes.

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

Dashboard label for `AudioFrame.b`, a legacy compatibility field containing the smoothed density projection. It is primarily derived from normalized spectral flux, not raw bass.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.b` as `sDensity`; `PlexusRenderer` copies it into `State.currentFrame.b`; `DashboardUI` displays it.

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

Dashboard label for `AudioFrame.m`, a legacy compatibility field containing the smoothed melody-presence projection. It combines tonal mid energy and pitched transient confidence.

## Source

`src/audio/analyzer.worker.ts` produces `AudioFrame.m` as `sMelody`; `PlexusRenderer` copies it into `State.currentFrame.m`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not raw mid-band energy.
- Not melody extraction or note detection.
- Not separate from vocals with stem-level accuracy.

## Tooltip Text

Pitched melodic presence estimate.
Not raw mid band or note detection.

## Vocal

## User Description

How strongly the current frame resembles vocal or formant-like content.

## Technical Meaning

`VisualFeatureFrame.vocal`, a heuristic feature derived from tonal factor and formant-ratio energy around vocal-like spectral regions.

## Source

`src/audio/analyzer.worker.ts` produces `TrackAnalysis.features[].vocal`; `PlexusRenderer` copies it into `State.currentFeatures.vocal`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not vocal stem separation.
- Not lyric or voice detection.
- Can respond to synths or instruments with vocal-like formants.

## Tooltip Text

Vocal/formant-like feature estimate.
Not stem separation.

## FX

## User Description

How much noise, transient, or effects-like texture is present.

## Technical Meaning

`VisualFeatureFrame.fx`, a smoothed FX/noise/transient feature. It shares the same core derivation as `AudioFrame.t`/FX Presence but is part of the canonical feature frame.

## Source

`src/audio/analyzer.worker.ts` produces `TrackAnalysis.features[].fx`; `PlexusRenderer` copies it into `State.currentFeatures.fx`; `DashboardUI` displays it.

## Range

`0.0..1.0`

## Common Misinterpretations

- Not raw treble.
- Not an effects bus or plugin signal.
- Can respond to noisy percussion and high transients.

## Tooltip Text

Noise, FX, and transient feature estimate.
Not raw treble.

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

Recent beat impact currently driving visual pulse.

## Technical Meaning

`State.beatDecay`, set to `1.0` when an accepted `BeatEvent` is consumed, then decayed each draw by `0.88`. It is a visual transient, not a worker scalar metric.

## Source

`src/audio/analyzer.worker.ts` produces `BeatEvent[]`; `PlexusRenderer` consumes events by playback time and writes `State.beatDecay`; `DashboardUI` displays it.

## Range

Starts at `1.0` on a beat event and decays toward `0.0`. Display assumes `0.0..1.0`.

## Common Misinterpretations

- Not beat strength directly from the worker.
- Not BPM.
- Not persistent rhythm density.

## Tooltip Text

Decaying visual pulse from recent beat events.
Not BPM or raw beat strength.

## Registry Sketch

```ts
const metricMetadata: Record<string, MetricMetadata> = {
  bpm: {
    name: 'BPM',
    description: 'Estimated tempo of the loaded track.',
    source: 'AnalysisResult.bpm from analyzer worker',
    range: '70..180 BPM, fallback 120',
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
    source: 'State.currentFrame.b',
    range: '0.0..1.0',
    tooltip: 'Smoothed density projection from spectral change.\nNot bass or low-band energy.'
  },
  melodyPresence: {
    name: 'Melody Presence',
    description: 'How strongly the current frame resembles pitched melodic material.',
    source: 'State.currentFrame.m',
    range: '0.0..1.0',
    tooltip: 'Pitched melodic presence estimate.\nNot raw mid band or note detection.'
  },
  vocal: {
    name: 'Vocal',
    description: 'How strongly the current frame resembles vocal or formant-like content.',
    source: 'State.currentFeatures.vocal',
    range: '0.0..1.0',
    tooltip: 'Vocal/formant-like feature estimate.\nNot stem separation.'
  },
  fx: {
    name: 'FX',
    description: 'How much noise, transient, or effects-like texture is present.',
    source: 'State.currentFeatures.fx',
    range: '0.0..1.0',
    tooltip: 'Noise, FX, and transient feature estimate.\nNot raw treble.'
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
    description: 'Recent beat impact currently driving visual pulse.',
    source: 'State.beatDecay from consumed BeatEvent[]',
    range: '1.0 on hit, decays toward 0.0',
    tooltip: 'Decaying visual pulse from recent beat events.\nNot BPM or raw beat strength.'
  }
};
```
