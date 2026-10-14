# Musical source / part / motif registry — AN-04A

Status: executable offline research prototype. Owner: analyzer for descriptors and
association, types for contracts, semantics for evidence relations. Integration
owner: Codex / root. No runtime dependency was added.

## What the implementation does

`extractHarmonicTimbre` measures eight relative harmonic amplitudes in a supplied
isolated, approximately stationary PCM window with supplied fundamental frequency.
The Hann-windowed exact-frequency DFT removes DC and normalizes amplitudes to sum
one. This supports gain/phase variation in the authored examples. It does not
discover the fundamental, establish source isolation, identify a synthesizer
patch, recognize a real singer, or provide a calibrated probability.

`trackMusicalEntities` consumes candidate activity intervals and descriptors plus
optional supplied monophonic phrase notes. It maintains separate source hypotheses
and musical-motif hypotheses. A source can play multiple motifs; a motif can recur
on another source. Source anchors are the first observed descriptors. Note shape
uses relative integer-MIDI contour and normalized onset/duration geometry, so an
entire phrase may be transposed or uniformly time-scaled. Equal note count and at
least four notes are required. No ornamentation, partial-match or polyphonic
transcription claim is made. Candidate phrase boundaries are upstream inputs.

Source identities represent acoustically associated part hypotheses within one
track, not proven physical instruments or people. A changing timbre may fragment
one source, and different sources with indistinguishable sequential timbres may
merge. The authored counterexamples remain visible in the measurements. An
overlapping matching source or close competing anchors trigger abstention.
Missing descriptors and unresolved mixtures remain unavailable.

The default maximum input count is 4096 observations, independent of instrument
taxonomy; there is no fixed four-/six-stem output. This is a finite resource limit,
not a promise to resolve arbitrary numbers of simultaneous instruments. Each
phrase contains at most 64 notes. Exceeding budgets throws; nothing is silently
discarded. Source/phrase association is worst-case quadratic in observation count;
the seven-observation measurements do not establish long-track performance.

## API, clock and identity

Contracts: `src/types/musicalEntities.ts`; PCM identity uses
`AcousticEvidenceIdentity` from `src/types/acousticEvidence.ts`. All activity,
note and support coordinates are integer original-PCM samples. Intervals are
half-open `[startSample,endSample)`. The physical presentation time is
`timelineOffsetSeconds + sampleIndex/sampleRate`; the registry does not retime,
resample or snap events to beats. The caller binds the supplied descriptors and
notes to that clock. Descriptor support must lie inside its candidate interval.

```ts
const registry = trackMusicalEntities(observations, identity);
const evidenceRelations = projectMusicalRelations(registry);
```

Canonical ordering is start sample, end sample, then binary observation-ID order.
Equal inputs give equal output, regardless of input array order. Registry IDs
must be interpreted together with the PCM identity, candidate input and algorithm
options. They are not cross-song identities or stable IDs after arbitrary track
edits. Inputs are not mutated; output arrays and clock objects are detached.

Distance and rhythm-error thresholds are engineering choices documented in the
[frozen experiment](../../research/analyzer-lab/docs/AN-04A-EXPERIMENT.md), not learned
confidence calibration. The registry preserves source/motif alternatives,
transposition, duration scale, authored-versus-unqualified note origin and reasons
for unknown assignments. `confidence=null`, `groundTruthStatus=false`,
`consumerUse='diagnostic-only'`, `xrScoring='ineligible'`.

`projectMusicalRelations` returns lineage-bound source coactivity and successive
motif return/handoff candidates. Overlap intervals preserve sample support;
simultaneous sharing is not a chronological handoff. These relations do not
establish musical intention, call-and-response, section roles or artistic cues.
The default relation budget is 10000; overflow rejects the result explicitly.

## Existing product boundaries

The API is separate from `analyzeAudio()`, `TrackAnalysis`, worker payloads,
normalization, visual automation, choreography and gameplay publication. No render
loop DSP, state mutation or worker schema change was introduced. Existing artistic
`VisualMotif` and `MotifPlanner` remain separate from measured musical phrases.
Existing `vocal`, `melody` and `patterns` heuristics do not become source or motif
truth through this addition.

## Training and promotion path

The first slice authors stems and notes, not a neural training process. The
retained corpus establishes interfaces, labels, evaluation and hard negatives
for subsequent training. Real multitrack labels must define whether the tracked
unit is a stem, perceptual source or musical part; these are not interchangeable.
Group splits must separate songs, duplicated MIDI, artists and sound generators
as appropriate. Repeated excerpts/remixes cannot be treated as independent data.

Next: connect candidate extraction with pitch/voicing uncertainty to this contract,
increase controlled same-family source counts and timbre-change difficulty, then
evaluate on independently annotated multitracks. Train/fine-tune association
features only after there is sufficient independent evidence. Evaluate identity
switches, fragmentation, source merges, activity boundaries, motif retrieval,
abstention coverage and consumer timing independently.

The user's two-library rule still governs external references. This slice has no
compatible actual provider pair for source identity or motif matching; its
external reference is explicitly unavailable. Authored truth is a different
evidence category. Onset agreement cannot supervise instrument identity. Neither
these easy controlled results nor provider agreement authorizes XR scoring.

Results, limitations and reproduction: [AN-04A validation](../../research/analyzer-lab/docs/AN-04A-VALIDATION.md).
