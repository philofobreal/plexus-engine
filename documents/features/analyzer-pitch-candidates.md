# Raw PCM pitch proposals — AN-04B

Status: executable offline research API. Integration owner: Codex / root.
Analyzer owns periodicity DSP and the unresolved-part adapter; types own the
clock/evidence contract; semantics owns two-provider frequency qualification.

`extractPitchCandidates(samples, identity)` now extracts periodicity candidates
directly from original-clock channel-0 PCM without supplied F0 or notes. It uses
the YIN-style cumulative mean normalized difference function over a common fixed
comparison length, takes the first qualifying period trough and refines the
period by bounded parabolic interpolation. Integer-lag estimates are retained
as a numerical baseline. Additional troughs are period aliases, not additional
voices. The range is 80–1000 Hz and threshold is 0.15. Frequencies outside that
range, expressive pitch transitions and low-periodicity mixtures need separate
validation; a harmonic alias can occur outside the supported fundamental range.

## Clock, support and limits

Input identity is `AcousticEvidenceIdentity`; sample count must match supplied
finite float32 PCM. This API supports 8000–96000 Hz. Frame size is the next power
of two >=0.08*sampleRate; hop is round(0.02*sampleRate). At 16/32 kHz the support
is 128 ms; at 22.05/44.1 kHz it is about 92.88 ms. Lattice spacing is 20 ms;
it is not note-onset accuracy. Only complete unpadded frames are analyzed; the
unobserved tail is explicit. Insufficient support returns an empty unavailable
analysis. Original frame support remains `[start,end)` samples. Global time is
`timelineOffsetSeconds + sampleIndex/sampleRate`; there is no fitted offset,
resampling or beat snapping.

DC-removed RMS must exceed 1e-6 before a pitch proposal is generated. A valid
clock can still yield no periodic trough. Scores are normalized differences,
not calibrated confidence. Work is bounded to 4096 frames and 350 million pair
differences; overflow fails explicitly. Long tracks require measured chunking
with original support/identity preservation, not silent sparse sampling.

## Safe handoff to musical identity tracking

`pitchCandidatesToUnresolvedParts` creates only unresolved-mixture observations,
with no timbre descriptor or note boundaries. It does not set
`kind='isolated-candidate'`, even for apparent monophony or external agreement.
Passing these observations to the AN-04A tracker therefore produces no inferred
source or motif identity. Pitch alone cannot prove a separate instrument,
number of singers, a complete phrase, or which source returned.

`assessPitchCandidates` requires an actual audited pair on the same PCM, frame
index and support: librosa-YIN and audioFlux-NCF, <=25 cents disagreement.
Both original frequencies are retained. Qualification against Plexus must be
within 25 cents to both frequencies, not just their geometric mean. Duplicate
frames, mismatched clocks, duplicated provider IDs, invented confidence or
ground-truth status are rejected. Unqualified means unknown, not negative.
The TypeScript gate validates the supplied record; proof of actual inference
comes from the retained native adapter run, sources and binary hashes.

Confidence stays null; output is diagnostic-only and XR scoring ineligible.
`analyzeAudio`, TrackAnalysis/worker payloads, playback, default visuals,
choreography and gameplay are unchanged. No realtime DSP or runtime dependency
was added. The existing optional librosa/audioFlux lab runtime was reused.

Results and reproducible commands: [AN-04B validation](../../research/analyzer-lab/docs/AN-04B-VALIDATION.md).
