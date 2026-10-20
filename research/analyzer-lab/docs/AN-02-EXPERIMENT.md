# AN-02 first cycle: overlap acoustic candidates

Predeclared 2026-10-10 before implementation or new fixture inspection. Root owns analyzer/shared contracts/integration; independent reviewers own cumulative harness and source retention in disjoint research tools. The previous algorithm-7 tests and snapshots are protected regression material, preserved before this cycle.

Hypothesis: centered overlapping FFT support can observe short attacks at every legacy frame phase, with sample-level impulse localization, while raw observed energy guards reject sustain cutoffs. Publish this as optional **acoustic candidates**, not accepted visual events, beat/downbeat evidence or XR targets. Default algorithm-7 analysis/grid/consumer policy stays unchanged in this first cycle. General musical onset recall, source identity and recorded-music precision remain unproven.

Fixed implementation choices, not selected on final-test scores:

- Separate acoustic window N=512 and hop H=128 by default (75% overlap); permit radix-2 50%/75% overlap for controlled comparisons. Center mH, symmetric Hann, zero padding outside real PCM. Publish actual support and localization method.
- Raw positive magnitude flux (excluding DC/Nyquist), with time-based EMA tau=2 ms. Refine a flux peak within observed FFT support to the maximum positive sample-power step. This is a declared localization heuristic; a ramp's scheduled beginning is not necessarily its maximum step.
- Require observed mean-power increase of at least 2x across 30 ms pre/post intervals, minimum post RMS 1e-6. A truncated endpoint can supply candidate evidence only following observed silence; mark its uncertainty explicitly. Tail padding alone cannot establish a rise. Candidate separation is 15 ms; closer attacks and quiet attacks over a loud bed are outside the demonstrated coverage.
- Implement bounded scale-invariant magnitude flatness using the same positive stabilized bin values for geometric/arithmetic means. Use it in this new acoustic stream; migration of the legacy classifier's flatness and fixed-alpha EMA is a separate acceptance step.
- Implement time-based EMA analytically, keeping the legacy function and default response. Optional headless metadata is additive and must survive normalization/schema validation. No new runtime dependency, realtime DSP or artistic policy.

Required checks: all integer legacy phases 0..1023 for authored impulses; both overlap settings across 8/16/22.05/44.1/48/96 kHz (raw hop phases plus legacy-boundary offsets); seeded noise bursts and decaying plucks with fixed waveform/carrier separately; first/last-sample and partial-tail attacks; sustain/DC/silence/fade/cutoff negatives; multiple attacks and explicit merging; malformed clocks/options; deterministic finite immutable results; support bounds and JSON transport. Report one-to-one match counts, misses/duplicates and signed/absolute timing, not only successful localization. Analytic flatness/EMA checks are independent of the impulse generator.

Acceptance is narrow: full phase coverage for isolated impulse fixtures, no interior sustain/cutoff candidates in declared negatives, and legacy default projection parity. Failure stays visible in a versioned record. All existing production/lab tests run alongside new tests via the cumulative harness. A passing isolated fixture does not promote candidates into musical consumers. Later AN-02 cycles must measure mixtures, ramps, endpoint ambiguity, real music, candidate recall ceilings and consumer selection separately.

Implementation clarifications after the predeclared plan, before final acceptance:
one final zero-padded context center beyond the last sample is required to cover
the symmetric Hann endpoint at 50% overlap. Published positions/support remain
real sample evidence. The 15 ms suppression is sequential pairwise replacement;
a rising-strength chain can suppress more than 15 ms of evidence. Fixed sample
windows have different physical resolution across sample rates, and raw flux
strength is not calibrated across amplitudes/windows/rates. These are explicit
limitations, not relaxed acceptance thresholds. Boundary validation additionally
rejects support spans longer than N and contradictory endpoint ambiguity.
The first real sample has no observed pre-context: the energy gate uses its
numerical floor and publishes an ambiguous candidate, rather than establishing
that unobserved preceding audio was silent. This clarifies the endpoint wording.
