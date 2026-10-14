# Two-library acceptance policy (AN-03F)

The user's continuing rule is that a third-party prediction becomes an eligible
development reference only when another actual third-party library agrees on the
same capability and measurement. Single-library results remain observations.
Authored or independently reviewed annotations retain their separate evidence
type. Library agreement is a pseudo-label, never ground truth or a calibrated
probability.

The implemented onset path is librosa 0.11.0 plus audioFlux 0.1.9. Both process
identical channel-0 float32 PCM at the original clock. Record decoded/excerpt PCM,
package, native binary, source and parameter hashes. Declare timestamp meanings,
window support and tolerance before viewing results. The fixed primary tolerance
is 25 ms; 2/10/50 ms comparisons are diagnostics. No fitted timestamp offset,
resampling or tolerance change is used to manufacture agreement. These two
implementations both use spectral change and can make correlated errors.

`labels.strict_pair.strict_pair` pairs events one-to-one by class with maximum
cardinality within tolerance. Each accepted reference retains both library votes,
their disagreement, bounded interval and mean representative time. The mean is
not sample-accurate truth. Duplicate events cannot inflate agreement. A missing
provider gives no accepted reference; a supported empty list is a real result
and gives no pairs. Unmatched outputs are retained as unknown, never negative
labels. Plexus does not vote on its own reference.

`labels.qualify_pair.qualify_pair` separately qualifies Plexus candidates against
both original library timestamps, with one-to-one matching. Being close only to
the pair's mean is insufficient. It preserves the candidate timestamp and both
votes, rejects reused votes and does not assign an invented confidence. These
records support comparison and development selection; they are not automatic
dramaturgy cues, rhythm-game targets, instrument identities or beat/downbeat truth.

Use the [AN-03F measurement and selection commands](AN-03F-VALIDATION.md) for this
accepted-reference workflow. The previous generic `labels.consensus`, drum
`music-reference` and general `export-training` workflows are retained historical
diagnostics: their permissive consensus defaults can produce single-library
pseudo-labels. **Those outputs are not accepted references under this policy and
must not be used as trusted training targets.** This slice does not register
audioFlux as a full canonical CLI oracle or retrofit every old command. Before
another capability is used, add two actual task-compatible providers and the
same acceptance gate; otherwise mark its third-party reference unavailable.

Synthetic calibration found one shared false onset at source removal. Preserve
that counterexample. Independent annotation, negative exposure, localization,
consumer timing and cost checks remain required for analyzer promotion. A larger
agreement count cannot conceal false events or worse physical timing.

All new tests run with all previous active tests in the cumulative harness.
Preserve raw library outputs, rejected proposals, code, locks, compact results
and source snapshots. Never rewrite old results to satisfy the stricter policy.

[AN-03G](AN-03G-VALIDATION.md) adds executable pure semantic assessment of this
policy. `assessAcousticOnsets` binds each pair to the same PCM/clock, qualifies
against both original votes and preserves explicit consumer abstention. Library
agreement remains diagnostic for dramaturgy/choreography and ineligible for XR
scoring. The recording diagnostic verifies exact retained PCM while reusing
immutable actual AN-03F provider predictions; it does not claim another native
library run or independently annotated recorded-music accuracy.
