# Physical band onset evidence and consumer interpretation

Owner: root analyzer/semantic integration. `src/analyzer/BandOnsets.ts` exposes
`extractBandOnsets`, a direct offline research function identified as
`experimental-physical-bands-v8`. It is absent from TrackAnalysis, normalizer,
worker version selection, renderer, UI and gameplay. Its defaults are the
selected, bounded synthetic improvement; earlier research parameter choices
remain explicit and are not promoted by that selection.

Five physical centre frequencies [300,600,1200,2400,4800] Hz each use two
constant-peak-gain biquad sections with Q=1 per section. Only centres below
0.4 Fs are active. Observed 30 ms history fits a bounded sinusoidal recurrence
at integer lag `round(Fs/8000)`. Candidate novelty requires contrast16 over the
past 2 ms, a 4 ms search and 1.3 band-energy continuation over 8 ms. Separate
original-PCM localization searches +/-3 ms using a fourth difference at that
physical lag. Physical peak contrast8, raw-history floor1e-4 and a complete
12 ms second-difference rise of 1.3 reject slow ramps and filter ringing.
Original v6 candidates retain priority; new additions use 7 ms exclusion.

Causal IIR dependence includes the entire observed prefix, so new candidates
publish supportStartSample=0. Support end includes every localization and
confirmation sample; unavailable tails abstain. No confidence, instrument class
or accepted musical event is invented. Every result declares actual band centres,
lag and effective predictor rate, thresholds and clock.

Fixed centre Hz does not establish complete sample-rate invariance. Integer lag
rounding, digital bandwidth warping, physical-difference comb nulls and the
retained v6 branch remain limitations. Explicitly measure other sampling rates,
frequency ranges, dynamic levels and musical origins before broader claims.

`src/semantics/acousticEvidence.ts` adds pure `assessAcousticOnsets`. It binds
events/references to an exact PCM hash, sample count/rate and timeline offset,
validates exactly two distinct librosa/audioFlux onset votes and uses one-to-one
both-timestamp matching at the existing 25 ms tolerance. It retains original
times and reference bounds, copies nested evidence and distinguishes qualified
references from unknown candidates. It rejects duplicate events/votes, wrong
clocks/PCM, invented confidence and ground-truth claims. Earliest-ending-interval
matching with successor links avoids a full candidate/reference cross product;
an exhaustive small-case test and Python qualifier check its cardinality.

All research events remain diagnostic-only for dramaturgy and choreography,
and ineligible for XR scoring. This is an explicit interpretation boundary,
not another narrative or an automatic instrument/beat detector. No existing
production consumer is wired to the experimental stream. Independent annotation,
boundary uncertainty, cost and consumer timing must precede that integration.

[Validation and reproduction](../../research/analyzer-lab/docs/AN-03G-VALIDATION.md)
retain all failed prototypes, source copies, test additions and measurements.
