# Metrics Source Audit

This audit traces the local Plexus Engine metrics pipeline from offline worker analysis through shared state, dashboard projection, modulation, and visual renderer consumption.

Reviewed sources:

- `AGENTS.md`
- `documents/governance/architecture-contract.md`
- `documents/governance/realtime-audio-safety.md`
- `documents/governance/worker-communication.md`
- `documents/audits/metrics-audit-matrix.md`
- `src/audio/analyzer.worker.ts`
- `src/types/index.ts`
- `src/state/store.ts`
- `src/ui/DashboardUI.ts`
- `src/visuals/PlexusRenderer.ts`
- `src/visuals/ClassicPlexusEffect.ts`
- `src/visuals/TemporalMusicEffect.ts`

Note: the requested `audit/metrics-audit-matrix.md` path is not present. The existing prior audit is `documents/audits/metrics-audit-matrix.md`.

## Pipeline Summary

The worker produces accepted analysis payloads: `AudioFrame[]`, `BeatEvent[]`, and `TrackAnalysis`. `PlexusRenderer` copies the current frame and feature frame into renderer-owned mutable state objects (`State.currentFrame` and `State.currentFeatures`), consumes beat/cue events by index, derives transient decay values, and writes `State.modulation` in place through `writeModulationBus`. `DashboardUI` reads state and projects selected values to DOM labels and bars. `ClassicPlexusEffect` and `TemporalMusicEffect` consume modulation, current features, cues, patterns, and sections for rendering.

The prior renderer aliasing issue was fixed in `src/visuals/PlexusRenderer.ts`: accepted worker frame and feature objects are no longer assigned directly into mutable render state. See `documents/audits/worker-immutability-audit.md`. Residual risk remains because accepted worker arrays are not deeply frozen at runtime.

The prior legacy dashboard labels were cleaned up, and the render-facing projections now use canonical names: `AudioFrame.densityProj`, `AudioFrame.melodyProj`, and `AudioFrame.fxProj`. The user-facing labels remain `Density`, `Melody Presence`, `Vocal`, `FX`, and `Beat Impulse`. `AudioFrame.fxProj` is not projected as its own dashboard card.

## Worker Frame Metrics

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `AudioFrame.e` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | `normRms = min(1, rmsT[i] / typRms)` where `rmsT[i] = sqrt(sum(sample^2) / 1024)` and `typRms` is 98th percentile RMS; output `e = sE` | Intended `0..1` | `sE += (normRms - sE) * 0.2`; paused/stopped decay multiplies by `0.9` on render copy only | `State.currentFrame`, dashboard, `writeModulationBus`, temporal/classic render through modulation | `Energy` | `macroMomentum`, `densityDrive`; indirectly affects particle speed, glow, network distance, rings | Yes: normalized energy | Low |
| `AudioFrame.densityProj` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Output is `sDensity`, where `sDensity` tracks `clamp01(normFlux)` and `normFlux = fluxT[i] / typFlux`; despite local `sB` tracking raw bass, `sB` is not output | Intended `0..1`; `normFlux` may exceed 1 before `clamp01` target | `sDensity += (clamp01(normFlux) - sDensity) * 0.15`; paused/stopped decay `* 0.9` on render copy only | `State.currentFrame`, dashboard, `writeModulationBus` | `Density` | `densityDrive = scaleUnit(frame.densityProj * 0.62 + features.density * 0.24 + frame.e * 0.14)`; drives particle motion, glow size/alpha, network density, temporal rings | Canonical projection field | Medium |
| `AudioFrame.melodyProj` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Output is `sMelody`; `melodyTarget = tonalFactor * max(0, rawMid - 0.2) * 1.35 + pitchedTransient * 1.4`; `tonalFactor = clamp01((1 - min(1, flatness * 1.8)) * 0.72 + harmonicStability * 0.28)`; `pitchedTransient = clamp01(pitchConfidence * max(0, rawMid - 0.12) * min(1, transientRatio * 4))` | Intended `0..1` | `sMelody += (clamp01(melodyTarget) - sMelody) * 0.1`; paused/stopped decay `* 0.9` on render copy only | `State.currentFrame`, dashboard, `writeModulationBus` only through feature duplicate when current features are also published | `Melody Presence` | Not directly read by effect modules | Canonical projection field | Medium |
| `AudioFrame.fxProj` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Output is decoupled `sFxPresence`; it smooths high-frequency energy ratio independently from canonical `VisualFeatureFrame.fx` | Intended `0..1` | `sFxPresence += (rawHigh - sFxPresence) * 0.15`; paused/stopped decay `* 0.9` on render copy only | `State.currentFrame`, beat classification, `writeModulationBus` | None; duplicate card removed | `spectralChaos = scaleUnit(frame.fxProj * 0.42 + features.fx * 0.36 + features.brightness * 0.22)`; drives color shifts, temporal background, FX rings | Correct as internal compatibility projection | Medium |
| `AudioFrame.state` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Bar-aligned state from `energyRatio >= adaptiveThreshold ? HIGH : LOW`; when HIGH, local overrides: `sE < 0.35 -> LOW_DROP`, `sE > 0.95 -> LOW_OVERLOAD`; default state in store is `IDLE` | Enum: `IDLE`, `HIGH`, `LOW`, `LOW_DROP`, `LOW_OVERLOAD` | Bar-level energy state plus immediate `sE` overrides; no numeric smoothing beyond inputs | Dashboard dynamics, shockwave constructor, classic low-mode color shift, playback-ended reset | `Dynamics State` value text | Classic glow hue uses `state.startsWith('LOW')`; shockwaves receive state | Mostly correct, but `LOW_OVERLOAD` under `LOW` naming is confusing | Medium |
| `AudioFrame.eRatio` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | `energyRatio = (bar.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE)` when range exists, else `0`; `bar.avgE` is average raw RMS over estimated bar | `0..1` when global max/min valid | Bar-level constant over each estimated bar; paused/stopped decay `* 0.9` on render copy only | Dashboard dynamics bar, `writeModulationBus`, impact cue gating, dramaturgy pressure | `Dynamics State` bar fill | `macroMomentum = scaleUnit(frame.eRatio * 0.58 + frame.e * 0.24 + features.density * 0.18)` | Yes as block-relative energy ratio; dashboard label is now clearer | Medium |

## Worker Event Metrics

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `BeatEvent.time` | `src/audio/analyzer.worker.ts` | worker `onmessage`, peak picking loop | `time = i * hopSize / sampleRate` for accepted spectral-flux local maxima | Seconds on track timeline | None | `PlexusRenderer` event index | Indirectly `Beat Impulse` via decay | Triggers beat decay and shockwave when playback time passes event | Yes | Low |
| `BeatEvent.intensity` | `src/audio/analyzer.worker.ts` | worker `onmessage`, peak picking loop | `min(normFlux, 1.0)` for flux peak where `normFlux > reqScore`, greater than adjacent flux ratios, and min gap `0.1s`; `reqScore` is `0.3` in HIGH, `0.4` otherwise | `0..1` | None on event; renderer applies `tuneAudioValue`, then decay values smooth visual response | Shockwaves, transient beat decay path | Indirectly `Beat Impulse` | `new Shockwave(... tuneAudioValue(ev.intensity), state, ev.type)`; sets `State.beatDecay = 1.0` | Yes | Medium |
| `BeatEvent.type` | `src/audio/analyzer.worker.ts`; contract in `src/types/index.ts` | worker `onmessage`, peak picking loop | Defaults `1`; if `sFx > 0.6` then `3`; else if `sDensity > 0.7` then `2` | Enum `1 | 2 | 3` | Classification uses smoothed `sFx` and `sDensity` | Renderer shockwaves and `denseImpactFlash`; type comments in types | None | Type `2` sets `State.denseImpactFlash = 1`; all types passed to `Shockwave`; type labels are default spectral-flux hit, dense impact hit, and fx/high-transient hit | Yes | Low |

## Visual Feature Metrics

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `VisualFeatureFrame.melody` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Same `sMelody` derivation as `AudioFrame.melodyProj`: tonal mid energy plus pitched transient | Intended `0..1` | `0.1` smoothing; paused/stopped decay `* 0.9` | Cues, sections, patterns, modulation, temporal effect | None; Melody Presence is the dashboard-facing melody metric via `AudioFrame.melodyProj` | Temporal hue shift, melody ring, `kineticTension`, cue generation | Mostly correct as internal/canonical heuristic presence | Medium |
| `VisualFeatureFrame.vocal` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | `vocalTarget = tonalFactor * vocalFormant * 1.55`; `vocalFormant = clamp01((1 - abs(formantRatio - 0.55) / 0.55) * rawMid * (1 - rawBass * 1.2))`; `formantRatio = formantHigh / formantLow` from 2000-4000 Hz over 300-1000 Hz | Intended `0..1` | `sVocal += (clamp01(vocalTarget) - sVocal) * 0.1`; paused/stopped decay `* 0.9` | Dashboard, cues, section dominant feature, modulation, temporal effect | `Vocal` | Temporal polygon color, vocal ring, `kineticTension` | Acceptable only as vocal/formant heuristic, not stem detection | Medium |
| `VisualFeatureFrame.fx` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Same `sFx` derivation as `AudioFrame.fxProj`: noise/high/transient pressure | Intended `0..1` | `0.15` smoothing; paused/stopped decay `* 0.9` | Dashboard, cues, modulation, temporal effect | `FX` | Temporal FX ring, hue shifts, `spectralChaos` | Mostly correct as FX/noise/transient presence | Medium |
| `VisualFeatureFrame.density` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | Same `sDensity` derivation as `AudioFrame.densityProj`: smoothed clamped spectral flux ratio | Intended `0..1` | `0.15` smoothing; paused/stopped decay `* 0.9` | Sections, bars, patterns, cues, modulation, temporal effect | None directly | Temporal network density through `densityDrive`, section/pattern generation, impact cue generation | Yes | Medium |
| `VisualFeatureFrame.brightness` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | `brightnessTarget = centroid * 3.0`; `centroid = sum(k * mag) / sumMag / 512` | Intended `0..1` after target clamp | `sBrightness += (clamp01(brightnessTarget) - sBrightness) * 0.1`; paused/stopped decay `* 0.9` | Modulation, dramaturgy pressure | None | `spectralChaos` input; indirectly affects temporal/classic color and FX intensity | Yes | Low |
| `VisualFeatureFrame.tension` | `src/audio/analyzer.worker.ts` | worker `onmessage`, pass 2 frame loop | `sTension` tracks `clamp01(sDensity * 0.5 + sBrightness * 0.5)` | Intended `0..1` | `sTension += (target - sTension) * 0.05`; paused/stopped decay `* 0.9` | Sections, dramaturgy pressure, modulation, temporal effect | None | `kineticTension` input; temporal line weight, glow, background, rings | Semantically acceptable as pressure estimate | Medium |

## Bar, Section, Pattern, Cue, And Dramaturgy Metrics

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `BarAnalysis.energy` | worker | `barAnalyses` map | `(bar.avgE - gMinAvgE) / (gMaxAvgE - gMinAvgE)` else `0` | `0..1` | Bar average of raw RMS | Timeline tooltip/graph, sections | Timeline `Energy` | Section energy and temporal section fallback | Yes | Low |
| `BarAnalysis.density` | worker | `barAnalyses` map | Average `features.density` over bar frame range | Intended `0..1` | Inherits feature smoothing; bar average | Timeline data, patterns/sections | None | Section and pattern derivation | Yes | Low |
| `BarAnalysis.avgRms` | worker | `rmsStats` | `clamp01((average rmsT over range) / typRms)` | `0..1` | Range average | Timeline RMS graph and tooltip as dB | Timeline tooltip `RMS` | None directly in effects | Yes | Low |
| `BarAnalysis.peakRms` | worker | `rmsStats` | `clamp01(peak rmsT over range / typRms)` | `0..1` | Peak over bar | Timeline peak bars | None | None directly in effects | Yes | Low |
| `BarAnalysis.bass` | worker | `barAnalyses` map | `clamp01(average rawBassT over bar)`, where raw bass is bins `<= 6` divided by total selected band magnitude | `0..1` relative band ratio | Bar average | Timeline tooltip spectral-band ratios | Timeline tooltip spectral-band ratios | None | Correct as raw low-band ratio, not a dashboard projection label | Medium |
| `BarAnalysis.mid` | worker | `barAnalyses` map | `clamp01(average rawMidT over bar)`, bins `7..93` over total selected bands | `0..1` relative band ratio | Bar average | Timeline tooltip spectral-band ratios | Timeline tooltip spectral-band ratios | None | Correct as raw mid-band ratio, not a dashboard projection label | Medium |
| `BarAnalysis.treble` | worker | `barAnalyses` map | `clamp01(average rawHighT over bar)`, bins `94..465` over total selected bands | `0..1` relative band ratio | Bar average | Timeline tooltip spectral-band ratios | Timeline tooltip spectral-band ratios | None | Correct as raw high-band ratio, not a dashboard projection label | Medium |
| `BarAnalysis.state` | worker | `barAnalyses` map | `energy >= adaptiveThreshold ? HIGH : LOW` | Enum `HIGH | LOW` | Bar-level | Timeline tooltip | Timeline tooltip state | None | Yes | Low |
| `BarAnalysis.dominantFeature` | worker | `dominantFeature` | Highest average of melody, vocal, fx, density over range; density maps to `rhythm` | Enum `melody | vocal | fx | rhythm` | Range average of smoothed features | Timeline tooltip/sections/patterns | Timeline section feature text | Pattern/section resonance metadata | Mostly correct | Medium |
| `TrackSection.energy` | worker | `trackSections` loop | Average `BarAnalysis.energy` over 4-bar phrase | `0..1` | Phrase average | Timeline section label/tooltip, temporal effect | Timeline section `Energy` | Temporal background and pattern ring section fallback | Yes | Low |
| `TrackSection.density` | worker | `trackSections` loop | Average `features.density` over phrase | Intended `0..1` | Phrase average | Labeling, patterns | None | Pattern signatures/resonance | Yes | Low |
| `TrackSection.avgRms` | worker | `trackSections` loop | Same `rmsStats.avgRms` over phrase | `0..1` | Phrase average | Data contract only in inspected files | None | None | Yes | Low |
| `TrackSection.peakRms` | worker | `trackSections` loop | Same `rmsStats.peakRms` over phrase | `0..1` | Phrase peak | Data contract only in inspected files | None | None | Yes | Low |
| `TrackSection.label` | worker | `labelForRange` | Heuristic: intro/outro low energy at ends; peak if energy `>0.72` and density `>0.48`; drop if energy `>0.58` and tension `>0.58`; build if energy `>0.42` and tension `>0.5`; break if energy `<0.28`; vocal phrase as verse; fallback verse | Enum section labels | Phrase-level | Timeline section blocks, patterns | Timeline section label | Temporal current-section styling | Mostly correct but heuristic | Medium |
| `TrackSection.dominantFeature` | worker | `dominantFeature` | Highest average feature in section range, density as `rhythm` | Enum | Phrase average | Timeline, patterns | Timeline tooltip | Pattern signature and temporal resonance metadata | Mostly correct | Medium |
| `MusicPattern.averageEnergy` | worker | `musicPatterns` map | Average `section.energy` across repeated signature group | `0..1` | Average across occurrences | Track analysis consumers | None | Pattern resonance metadata | Yes | Low |
| `MusicPattern.averageDensity` | worker | `musicPatterns` map | Average `section.density` across repeated signature group | `0..1` | Average across occurrences | Track analysis consumers | None | Pattern resonance metadata | Yes | Low |
| `PatternOccurrence.intensity` | worker | `musicPatterns` map | `clamp01(section.energy * 0.55 + section.density * 0.45)` | `0..1` | Section aggregate | Pattern cue creation, temporal resonance | None | `resonance.strength` and pattern ring | Yes | Low |
| `PatternOccurrence.confidence` | worker | `musicPatterns` map | `clamp01(0.45 + occurrenceCount * 0.1)` | `0..1` | Pattern group count | Pattern cue creation, temporal resonance | None | `resonance.strength` | Yes | Low |
| `VisualCueEvent.time` | worker | `addCue` | `i * hopSize / sampleRate` | Seconds | Min-gap gating per cue kind | Renderer cue index, timeline markers | Timeline cue marker | Triggers cue decay and cue shockwave | Yes | Low |
| `VisualCueEvent.duration` | worker | `addCue` call sites | Melody `4 beats`; vocal `8 beats`; fx `2 beats`; impact `1 beat`; break `8 beats`; pattern occurrence length | Seconds | None | Patterns/timeline; not heavily used in inspected renderer except pattern occurrence duration | None | Pattern resonance uses occurrence duration, not cue duration | Yes | Low |
| `VisualCueEvent.intensity` | worker | `addCue` | Clamp of source intensity: feature value, density, `1 - density * 0.5`, or pattern occurrence intensity | `0..1` | Feature smoothing plus min-gap gating | Renderer cue decay, shockwaves, timeline | None | Cue shockwave intensity and `State.cueDecay` | Yes | Low |
| `VisualCueEvent.confidence` | worker | `addCue` | Clamp of feature value, fixed `1.0` impact, fixed `0.85` break, or pattern confidence | `0..1` | Feature smoothing or aggregate | Timeline tooltip | Timeline cue confidence | None directly in effects | Yes | Low |
| `VisualCueEvent.kind` | worker | `addCue` | Threshold rules: melody peak `>0.52`; vocal peak `>0.48`; fx peak `>0.62`; impact when density `>0.72` and `eRatio >0.5`; break on LOW_DROP transition; pattern from recurring sections | Enum cue kinds | Peak/min-gap gating | Renderer cue type, timeline marker | Timeline `IMPACT`/`BREAK` labels | Shockwave type, active cue kind, pattern resonance boost | Mostly correct | Medium |
| `TrackAnalysis.buildupConfidence[]` | worker | `computeDramaturgyAnalysis` | Pressure per frame = `feature.tension * 0.34 + feature.density * 0.28 + frame.e * 0.22 + frame.eRatio * 0.16`; confidence = `clampUnit((currentAvg - previousAvg) * 4 + currentAvg * 0.18)`; then bar-aligned average if alignment count is passed | `0..1` | Window average and optional bar alignment | Timeline buildup graph, renderer dramaturgy boost | Timeline `Buildup` | Adds `buildup * 0.18` to `kineticTension`; raises `macroMomentum` to at least `buildup * 0.35` | Yes | Medium |
| `TrackAnalysis.spectralPivot[]` | worker | Spectral Pivot post-process | Zero below `sE <= 0.04`; otherwise stores compensation strength from low energy plus buildup or `LOW_DROP` tension, gated by melody/vocal/fx signal | `0..1` | Offline post-process over feature frames | Timeline dotted pivot overlay | Timeline pivot overlay | Highlights active dramatic feature compensation regions | Yes | Medium |
| `TensionTrends.globalSlope` | worker | `computeDramaturgyAnalysis` | `clampSigned(lastPressure - firstPressure)` | `-1..1` | Uses pressure endpoints | Track analysis contract; not used in inspected UI/effects | None | None | Yes | Low |
| `TensionTrends.peakTime` | worker | `computeDramaturgyAnalysis` | `peakIndex * hopSize / sampleRate` for max pressure | Seconds | None | Contract only in inspected files | None | None | Yes | Low |
| `TensionTrends.peakValue` | worker | `computeDramaturgyAnalysis` | Maximum pressure value | `0..1` | None beyond pressure formula | Contract only in inspected files | None | None | Yes | Low |
| `TensionTrendSegment.startValue` / `endValue` | worker | `computeDramaturgyAnalysis` | Pressure at first and last frame of each segment | `0..1` | Segment sampling | Timeline trend direction/confidence | Timeline trend tooltip | None | Yes | Low |
| `TensionTrendSegment.confidence` | worker | `computeDramaturgyAnalysis` | `clampUnit(abs(endValue - startValue) * 2.5)` | `0..1` | Segment-level | Timeline trend stroke width/tooltip | Timeline `Tension ... confidence` | None | Yes | Low |
| `TensionTrendSegment.direction` | worker | `computeDramaturgyAnalysis` | `stable` if `abs(delta) < 0.03`, otherwise `rising` or `falling` | Enum | Segment-level | Timeline trend color/tooltip | Timeline trend direction | None | Yes | Low |

## Shared State And Derived Runtime Metrics

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `State.currentFrame` | visuals publish accepted worker frame into render copy | `publishCurrentAnalysisFrame` in `PlexusRenderer.ts` | Copies `State.frames[floor(currentTime * sampleRate / hopSize)]` fields into the existing renderer-owned `State.currentFrame` object | Same as `AudioFrame` | Source frame smoothing plus stopped decay mutates render copy by `* 0.9` | Dashboard, modulation, effects | Multiple | Modulation source and state color | Yes. Prior worker-result aliasing is fixed; see `documents/audits/worker-immutability-audit.md` | Medium |
| `State.currentFeatures` | visuals publish accepted feature frame into render copy | `publishCurrentAnalysisFrame` | Copies `State.trackAnalysis.features[frameIdx]` fields into the existing renderer-owned `State.currentFeatures` object | Same as `VisualFeatureFrame` | Source smoothing plus stopped decay mutates render copy by `* 0.9` | Dashboard for vocal/fx, modulation, temporal effect | `Vocal`, `FX`; `melody` is internal/canonical only | Temporal feature rings and modulation | Yes. Prior worker-result aliasing is fixed; see `documents/audits/worker-immutability-audit.md` | Medium |
| `State.beatDecay` | visuals transient state | `PlexusRenderer.draw` event consumption | Set to `1.0` on any beat event, then `*= 0.88` each draw | Starts at `1.0`; decays toward `0` | Exponential frame decay | Dashboard, modulation, effects | `Beat Impulse` | `rhythmicImpulse`, classic core/network, temporal rings/particles | Yes | Medium |
| `State.denseImpactFlash` | visuals transient state | `PlexusRenderer.draw` event consumption | Set to `1.0` only when `BeatEvent.type === 2`, then `*= 0.85` each draw | Starts at `1.0`; decays toward `0` | Exponential frame decay | Classic and temporal polygon flash | None | Polygon alpha and temporal polygon limit | Yes | Low |
| `State.cueDecay` | visuals transient state | `PlexusRenderer.draw` cue consumption | `max(current cueDecay, tuneAudioValue(cue.intensity))`, then `*= 0.9` each draw; clears active cue below `0.02` | Can exceed `1` before modulation clamps if sensitivity > 1 | Exponential frame decay | Modulation, temporal pattern boost, effects | None | Cue shockwaves, rhythmic impulse, kinetic tension, background pulse | Yes | Low |
| `State.activeCueKind` | visuals transient state | `PlexusRenderer.draw` cue consumption | Last consumed cue kind while `cueDecay >= 0.02` | Enum or null | Lifetime tied to cue decay | Temporal pattern resonance | None | Pattern boost when kind is `pattern` | Yes | Low |
| `State.activePatternId` | visuals transient state | `PlexusRenderer.draw` cue consumption | Pattern cue `patternId`, retained until cue decay clears | String or null | Lifetime tied to cue decay | State only in inspected files | None | Not directly used by inspected effects | Yes | Low |
| `State.currentTime` | audio/visual playback sync | `PlexusRenderer.draw` | `engine.getCurrentTime()`; governed by audio engine playback formula | Seconds | Per draw update | Seekbar time display, timeline, renderer frame index | Time text | Frame/cue/event indexing, section lookup, pattern resonance | Yes | Low |

## Modulation Bus Metrics

These fields are renderer-facing animation control signals, not source musical metrics. They are owned by visuals and written in place to preserve the stable `State.modulation` reference required by governance.

| Field name | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Dashboard label | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `State.modulation.kineticTension` | `src/visuals` via `src/config/visualTuning.ts` | `writeModulationBus`, then `applyDramaturgyBoost` | `scaleUnit(features.vocal * 0.28 + features.melody * 0.22 + features.tension * 0.32 + cueDecay * 0.18, sensitivity)`; boost adds `buildup * 0.18` clamped to `1` | `0..1` after writes | Input smoothing plus cue decay; no bus-level low-pass except source smoothing | Classic/temporal effects | None | Temporal glow hue/radius, background blue, particle movement, line weight, rings | Correct as visual control, not a raw metric | Medium |
| `State.modulation.densityDrive` | visuals/config | `writeModulationBus` | `scaleUnit(frame.densityProj * 0.62 + features.density * 0.24 + frame.e * 0.14, sensitivity)` | `0..1` | Input smoothing | Classic/temporal effects, particles | None | Particle speed/Activity Turn input, glow size/alpha, network distance, ring radius | Yes: density is the dominant source and energy is secondary | Medium |
| `State.modulation.spectralChaos` | visuals/config | `writeModulationBus` | `scaleUnit(frame.fxProj * 0.42 + features.fx * 0.36 + features.brightness * 0.22, sensitivity)` | `0..1` | Input smoothing | Classic/temporal effects | None | Line color shifts, temporal background, particle movement, FX ring | Mostly correct | Medium |
| `State.modulation.rhythmicImpulse` | visuals/config | `writeModulationBus` | `scaleUnit(max(beatDecay, cueDecay * 0.65), sensitivity)` | `0..1` | Beat/cue decay | Classic/temporal effects, particles | None directly; dashboard shows `beatDecay` separately | Core pulse, line alpha/weight, rings, particle impulse | Yes | Low |
| `State.modulation.macroMomentum` | visuals/config | `writeModulationBus`, then `applyDramaturgyBoost` | `scaleUnit(frame.eRatio * 0.58 + frame.e * 0.24 + features.density * 0.18, sensitivity)`; boost raises to `max(current, buildup * 0.35)` | `0..1` | Bar energy plus smoothed sources | Classic/temporal effects, particles | None | Particle energy, temporal background fallback, section fallback | Yes | Medium |

## Dashboard Projection

| Dashboard label | Source field | Owner module | Producer function | Exact formula or derivation | Normalization range | Smoothing | Consumers | Renderer usage | Semantically correct? | Refactor risk |
|---|---|---|---|---|---|---|---|---|---|---|
| `BPM header badge` | `State.bpm` | audio publishes worker result | Worker BPM estimation | Mode of rounded intervals from accepted flux peaks between 70 and 180 BPM; default `120` | BPM number | None | Header badge and timeline grid | Beat/bar derivation already done in worker; renderer does not use `State.bpm` except UI timeline bar grid | Yes | Low |
| `Energy` | `State.currentFrame.e` | UI projection | `DashboardUI.updateDashboard` | Displays `toFixed(2)` and bar width `e * 100%` | Assumes `0..1` | Source smoothing | User dashboard | Renderer uses via modulation | Yes | Low |
| `Density` | `State.currentFrame.densityProj` | UI projection | `DashboardUI.updateDashboard` | Displays density projection as `toFixed(2)` and bar width `b * 100%` | Assumes `0..1` | Source smoothing | User dashboard | Renderer uses via `densityDrive` | Yes at dashboard layer; TypeScript field remains legacy | Medium |
| `Melody Presence` | `State.currentFrame.melodyProj` | UI projection | `DashboardUI.updateDashboard` | Displays melody-presence projection as `toFixed(2)` and bar width `melodyProj * 100%` | Assumes `0..1` | Source smoothing | User dashboard | No direct effect-module usage | Yes at dashboard layer | Medium |
| `Vocal` | `State.currentFeatures.vocal` | UI projection | `DashboardUI.updateDashboard` | Displays `toFixed(2)` and bar width `vocal * 100%` | Assumes `0..1` | Feature smoothing | User dashboard | Temporal vocal ring and modulation | Acceptable if understood as heuristic | Medium |
| `FX` | `State.currentFeatures.fx` | UI projection | `DashboardUI.updateDashboard` | Displays `toFixed(2)` and bar width `fx * 100%` | Assumes `0..1` | Feature smoothing | User dashboard | Temporal FX ring and modulation | Yes | Low |
| `Beat Impulse` | `State.beatDecay` | UI projection | `DashboardUI.updateDashboard` | Displays `beatDecay.toFixed(2)` and bar width `beatDecay * 100%` | Decay starts at `1`, approaches `0` | Renderer decay `* 0.88` per draw | User dashboard | Renderer uses `beatDecay` to derive `rhythmicImpulse` | Yes | Medium |
| `Dynamics State` | `State.currentFrame.state` and `State.currentFrame.eRatio` | UI projection | `DashboardUI.updateDashboard` | Text maps enum to `HIGH`, `LOW`, `LOW [DROP]`, `LOW [OVERLOAD]`, or `IDLE`; bar width is `eRatio * 100%` | Enum plus `0..1` bar | Bar-level state, render-copy decay when stopped | User dashboard | State and eRatio feed shockwaves/modulation | Yes | Medium |

## Renderer Usage By Metric Family

- `ClassicPlexusEffect` does not read raw `AudioFrame.densityProj/melodyProj/fxProj` directly. It reads `State.modulation` plus `State.currentFrame.state` and `State.denseImpactFlash`.
- `TemporalMusicEffect` reads `State.modulation`, `State.currentFeatures.melody/vocal/fx`, `State.trackAnalysis.sections`, `State.trackAnalysis.patterns`, `State.activeCueKind`, `State.cueDecay`, and `State.denseImpactFlash`.
- `PlexusRenderer` is the integration point: it maps current playback time to worker frame indices, consumes `BeatEvent` and `VisualCueEvent` arrays by index, writes transient decays, calls `writeModulationBus`, and applies dramaturgy boost from `buildupConfidence`.

## Findings

1. `AudioFrame.densityProj/melodyProj/fxProj` are compatibility projections, not spectral bands. The worker still computes raw `rawBassT/rawMidT/rawHighT`, but those are only published at bar level as `BarAnalysis.bass/mid/treble`.
2. The dashboard label issue is fixed: the user-facing labels now read `Density`, `Melody Presence`, `Vocal`, `FX`, `Beat Impulse`, and `Dynamics State`, while TypeScript fields remain unchanged for compatibility.
3. `BeatEvent.type` naming drift is fixed in `src/types/index.ts`: type `1` is default spectral-flux hit, type `2` is dense impact hit, and type `3` is fx/high-transient hit.
4. The renderer aliasing issue is fixed: `publishCurrentAnalysisFrame()` now copies accepted worker frame/feature values into renderer-owned mutable state before `decayCurrentAnalysisFrame()` mutates those render copies. See `documents/audits/worker-immutability-audit.md`.
5. Fixed: former `State.modulation.lowFrequencyDrive` is now `State.modulation.densityDrive`, matching its density/energy-driven formula while preserving runtime behavior.
6. Residual immutability risk remains because accepted worker arrays are not deeply frozen.
7. The duplicate dashboard `Melody` card was removed. `Melody Presence` is the dashboard-facing melody metric, while `VisualFeatureFrame.melody` remains the internal/canonical feature signal for track analysis, cues, modulation, and temporal rendering.
8. The BPM, Progress, and FX-presence projection cards were removed from the metrics grid. BPM now lives in the header badge, progress lives in the seekbar/time display, and canonical FX comes from `VisualFeatureFrame.fx`.

## Refactor Risk Summary

- Fixed: dashboard projection labels were renamed to semantically accurate user-facing labels: Density, Melody Presence, Vocal, FX, Beat Impulse, and Dynamics State.
- Fixed: `State.currentFrame` and `State.currentFeatures` no longer alias accepted worker frame/feature objects during renderer publication.
- Fixed: `AudioFrame.densityProj/melodyProj/fxProj` are now canonical internal projection field names.
- Fixed: the former low-frequency modulation name was migrated to canonical `State.modulation.densityDrive`.
- Medium: `LOW_OVERLOAD`, vocal heuristic labeling, modulation names exposed outside debug contexts.
- Low: energy, bar RMS, section energy/density, cues, buildup, progress, and current render-copy decay.
- Residual: accepted worker arrays are not deeply frozen, so future consumers could still mutate source analysis data if they bypass renderer copy ownership.

## Recommended Refactor Order

1. Done: `AudioFrame.densityProj/melodyProj/fxProj` are documented as semantic projection fields in `src/types/index.ts`.
2. Consider freezing or deep-copying accepted worker arrays at the audio/state boundary if stronger runtime immutability is required.
3. Only after labels, tests, and immutability are stable, consider internal field migration from `b/m/t` to explicit `density/melodyPresence/fxPresence`.
