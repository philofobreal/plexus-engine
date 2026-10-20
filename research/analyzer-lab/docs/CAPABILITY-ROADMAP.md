# Capability roadmap

[capability-matrix.json](../configs/capability-matrix.json) distinguishes adapters that currently produce canonical fields (`implemented`) from optional integrations (`planned`). An empty provider list means no claim. Library features outside the current adapter are not implemented lab features. Estimates are evidence and may be incorrect.

## Initial working slice

Plexus runs its existing headless analyzer. The initial lab measured algorithm version 5; the tonal-sustain correction identifies version 6 and [AN-01](AN-01-VALIDATION.md) introduces the signal/clock/level contract in version 7. Canonical projection covers tempo, beats, bar starts/downbeats, accepted visual-event positions and existing section boundaries/labels. Visual-event timing is onset evidence; it is not complete raw-onset detection or instrument-specific drum transcription. Section labels are existing Plexus predictions with their original semantics.

librosa 0.11.0 supplies tempo, beat times and onset times. No librosa downbeat, drum, source, pitch, chord, key or section result is invented. The initial comparator measures BPM and event-time agreement with configurable tolerances and reports unavailable fields explicitly.

## Optional integrations

| Target | Planned provider | Required work before claiming implementation |
| --- | --- | --- |
| Polyphonic notes and frame pitch evidence | Basic Pitch 0.4.0 | Review weights, choose backend, implement canonical note/frame mapping and test it; dominant melody needs an explicit projection. |
| 2/4/5 source stems | Spleeter 2.4.2 | Pin model artifact/hash, supply isolated wrapper, preserve stem references and offsets; activity extraction is a separate measured step. |
| Drum events, beats, vocal pitch, chords, instrument notes | Omnizart 0.6.3 | Review each task checkpoint, validate isolated dependencies, implement task-specific canonical mappings and fixtures. |
| MIR descriptors, pitch/key/chords and model-based instrument presence | Essentia | Review AGPL build/dependencies and resolve model license conflict, select compatible platform release, implement opt-in wrapper. |
| Structural boundaries and acoustic-similarity labels | MSAF 0.1.80 | Validate modern environment, select algorithm, review OLDA weights when used and map labels without asserting verse/chorus semantics. |
| Dataset loading and provenance | future mirdata adapter | Add an optional manifest loader after dataset-specific permissions and version/checksum checks; keep mirdata out of core dependencies initially. |

Only the first slice is a required oracle implementation. Optional manifests declare upstream capability targets, and `command: null` leaves them unavailable until user-owned wrappers exist. No fake success path, fallback prediction or empty array can stand in for an absent provider. Core installation does not install optional providers or fetch checkpoints.

## Evidence and evaluation expansion

Add pitch/voicing, note transcription, section-boundary and frame activity evaluation when suitable paired canonical observations exist. Return `not_available` or `unsupported` when they do not. Validate sample-time alignment, resampling, offsets, masks and confidence calibration before comparing task outputs.

Vocal activity, instrument presence, drum identity and predominant melody require task-specific evidence. Stem energy can be a candidate feature, but it is not automatically a validated activity label. A model-free feature or polyphonic pitch array does not establish instrument identity.

Human annotation and reviewed ground truth may join comparisons later. Consensus retains oracle identities, time tolerance, agreement, confidence, ground-truth status and label provenance. Export track-level splits and Plexus-owned features only when those fields are available. An oracle vote does not turn an unresolved license or prediction into ground truth.

## Independent Plexus development

Research findings may motivate a separate production-analyzer task with its own governance, fixture evidence and review. That task designs original algorithms from numerical observations; it must not mechanically port provider source, copy weights or introduce a runtime dependency on this lab. See [the oracle/license policy](ORACLE-AND-LICENSE-POLICY.md).

## Prioritized independent development

The first P0 drum research baseline is now implemented in the isolated lab; see [DrumEventClassifier](DRUM-EVENT-CLASSIFIER.md). Production capability remains as listed below. Other own-module goals remain future tasks. Dataset candidates require separate rights and annotation-quality review; synthetic/local curated material establishes initial alignment tests before external datasets are acquired.

| Priority / capability | Current Plexus state | Reference oracle | Possible ground-truth material | Measurement | Future own-module goal |
| --- | --- | --- | --- | --- | --- |
| P0 kick events | Accepted visual impacts; no instrument certainty | Omnizart drum transcription; Spleeter drum stem evidence | Reviewed Slakh-like MIDI drum maps + stems and isolated synthetic attacks | Per-class event P/R/F, timing error, false hits on sustained bass | Independent DrumEventClassifier kick evidence |
| P0 snare events | Visual-impact classes do not identify snares | Omnizart drum task; isolated drum stems | Reviewed MIDI/stem snare annotations and curated mixed fixtures | Event P/R/F and confusion against kick/clap | Own DrumEventClassifier snare evidence |
| P0 hi-hat events | High/transient FX evidence is not hi-hat identity | Omnizart drum task | Reviewed MIDI open/closed-hat maps, stem transients | Class-specific event P/R/F with rate/velocity strata | Own hat event evidence without high-band assumptions |
| P0 vocal activity | Spectral vocal heuristic in TrackAnalysis.features; no separated vocal truth | Spleeter vocal stems; Omnizart vocal task | Human-reviewed voiced intervals on licensed isolated vocals/mixtures | Frame precision/recall/F and onset/offset error | Own VocalActivityEstimator with explicit confidence |
| P0 bass attack versus sustain | Fixed-band sub/bass energy and positive flux; percussive gate suppresses sustained triggers | Spleeter bass stems plus MIDI note evidence | Reviewed Slakh-like bass MIDI/stems; sustained/ramped synthetic tones | Attack event P/R/F and frame sustain confusion | Independent BassAttackClassifier using existing own features |
| P1 vocal phrase segmentation | Vocal cues are heuristic, not phrase boundaries | Omnizart vocal evidence + curated annotation | Human phrase-start/end and breath/gap annotation | Boundary P/R/F, phrase overlap/offset error | Own VocalPhraseSegmenter |
| P1 predominant melody / F0 | Melody-presence/pitch-confidence heuristics; no canonical F0 track | Essentia pitch reference; task-specific Omnizart | Licensed isolated annotated melody; rendered MIDI with known F0 | Pitch/voicing accuracy with voiced masks and clock alignment | Own MelodyF0Tracker, after reference alignment |
| P1 note onset, pitch, duration | Visual events and melody projections do not transcribe notes | Basic Pitch; Omnizart note task | Reviewed MIDI/stem note intervals, known synthetic notes | Note onset/offset/pitch P/R/F | Own NoteEvidenceEstimator |
| P2 instrument presence | Spectral dominant features do not identify instruments | Omnizart instrument task; reviewed Essentia model | Reviewed stem source metadata + instrument MIDI program annotations | Frame/track presence P/R/F and confusion | Own InstrumentPresenceClassifier |
| P2 chord / key / harmonic change | No explicit chord/key prediction | Omnizart chord task; Essentia tonal references | Curated human chord/key annotation; licensed MIDI harmonic fixtures | Chord duration-weighted agreement, key accuracy, harmonic-change event P/R/F | Own HarmonicEvidenceAnalyzer |
| P2 section refinement | Existing bar/energy/novelty sections and dramaturgy labels | MSAF boundaries/acoustic labels; Essentia descriptors | Human-reviewed structure boundaries; controlled arrangement fixtures | Internal-boundary P/R/F plus separate label metrics | Refine own SectionAnalyzer with measured evidence |
| P3 multi-instrument transcription | No polyphonic/instrument note transcription | Omnizart; Basic Pitch only for instrument-agnostic note evidence | Reviewed Slakh-like multitrack MIDI/stems with grouped splits | Per-instrument note P/R/F, source confusion, overlap/offset accuracy | Independent MultiInstrumentTranscription modules only after P0–P2 evidence |

**P0 Musical Event Layer first cycle implemented:** kick/snare/hi-hat research classifier, supervised benchmark, procedural ground truth, reviewed MIDI annotation import and optional canonical drum-oracle consensus. The subsequent [improvement cycle](DRUM-IMPROVEMENT-CYCLE.md) adds opt-in v2 research and a separately validated production tonal-sustain guard (algorithm 6). Real Slakh/MIDI/stem assets and actual drum oracle outputs were unavailable during validation.

Next evidence task: run the frozen research baseline on reviewed local MIDI/stem mixtures with official/grouped splits, and compare a separately validated drum oracle. Retain the synthetic holdout failures rather than changing thresholds after inspecting them.
