# AN-02 C2: mixtures, density and negative controls

Predeclared 2026-10-11 before measuring this corpus. Integration owner: root.
Status: diagnostic research cycle; no production or consumer promotion.
Protocol v2: explicit padded-context reference output policy after the original
strict-clock run failed. Original protocol/program and failure remain in
`../fixtures/history/an02-c2-reference-clock/`; no v1 success is claimed.

## Question and fixed scope

Does the existing `overlap-energy-rise-v1` candidate stream retain authored
attacks under gain changes, sustained carriers and dense repetitions? Which
losses occur at sample localization, the 30 ms energy-doubling gate, and the
15 ms sequential suppression? Does bypassing that gate or replacing suppression
with strength-ordered greedy suppression recover events at a negative-event cost?

Keep algorithm 7, every existing regression, and the v1 stream unchanged.
Instrument the current source in memory, with exact-source SHA256
`eba437661861f0d14d411246e6f6f093059f3e085a1cff8da65e9c39c3458491`.
Require exact output parity between instrumented and original execution on every
case. Instrumentation changes observation only; ablations are research outputs.
No source, schema, worker, visual, semantic or gameplay changes are planned.

## Frozen authored matrix

Single-channel f32 PCM, no resampling, rates 8000/44100/48000 Hz; N=512,H=128.
Each clip is 0.8 s. Truth is the sample where the generator adds an attack,
not a human audibility annotation or a MIDI/recording claim.

- Isolated: noise/pluck, gains 1/0.001/0.00001/0.000001, starts 0.2/0.4/0.6 s.
- Mixtures: noise/pluck, sustained 110 Hz carrier amplitude 0.2, attack/carrier
  amplitude ratios 0.1/0.5/1/2, carrier phases 0/pi/3; same three starts.
- Density: short noise, six attacks from 0.25 s, gaps 8/12/16/24/40/80 ms,
  equal versus increasing amplitude. The last event ends inside the clip.
- Negatives: sustain, 200 ms linear rise, 4 Hz amplitude modulation, 110+113 Hz
  beating, linear fade, and cutoff at 0.6 s; phases 0/pi/3. These controls have
  no discrete added attacks after 0.1 s. Initial [0,0.1) is excluded for all
  providers; [0.1,L/fs) is completely annotated negative, including clip tail.

Use seeded reproducible 4 ms decaying noise and 12 ms decaying 440 Hz pluck;
do not infer source identity from these waveforms. Preserve f32le PCM hash,
truth-sample hash, parameters, candidate timestamps and stage observations.
These are one known synthetic generator family, not independent holdout groups.

## Evaluation fixed before scores

Recompute maximum-cardinality one-to-one `mir_eval` matching independently at
10/20/25/30/50/70 ms. Report misses, FP, precision/recall/F, signed timing and
matched-only p95/p99; a low error with low recall does not pass. Report each
condition and macro/micro scores by family and provider. Negatives use FP/minute,
exposure and clean-condition fraction; both-empty event F stays undefined.
Do not round or shift provider timestamps to improve scores.

Stages: unique refined positions before gate, gate-accepted positions before NMS,
and final v1 candidates. Stage matching uses the same tolerance curve and truth.
Record rejection counts (absolute power floor, relative energy, incomplete
continuation), with overlap explicitly allowed; these are not additive losses.

Ablations: (1) gated proposals + descending-strength greedy 15 ms suppression;
(2) all positive-step refined proposals + that suppression, bypassing only the
energy gate. The second is a counterexample probe, not a proposed acceptance
policy. Never report either as an integrated algorithm. Equal-strength ties use
sample index then original proposal index. No threshold search or fitting.

Reference: installed librosa 0.11 onset_strength/onset_detect, defaults except
explicit N=512,H=128, sr=actual fs, center=true, no backtracking, frame times
mH/fs. Record exact resolved kwargs/version; same f32le PCM/hash. This differs
from the existing general adapter's default N=2048 and is a separate controlled
configuration. Library output is a prediction compared to authored truth, not
truth itself. Any exception/nonfinite/negative/unordered output fails the
experiment, never becomes an empty-success prediction. Protocol v2 retains every
returned time, including centered padded-context times at or beyond L/fs, in a
separate out-of-domain list. Those outputs count as extra FP, also on negatives;
they are never clamped, shifted, discarded or promoted to physical sample events.
All authored positives are sufficiently far from the endpoint that these cannot
match truth at the largest 70 ms tolerance. Installed mir_eval 0.8.2 supplies shared evaluation.

## Acceptance and preservation

This cycle accepts the measurement infrastructure only if PCM/truth identities,
instrumentation parity, determinism, ablation invariants, all-condition execution,
and cumulative build/Node/Python coverage pass. Candidate quality failures remain
visible in the result and block musical/consumer promotion. Do not freeze a bad
score as a correctness requirement; retained summaries are historical evidence.
Retain all new generators, evaluators, diagnostics and original v1/v2 inventories.
Append a new inventory and immutable run history. Known baseline failures remain
nonzero failures. No installation, snapshot regeneration, physical XR or recorded
music claim. After inspection this corpus is known regression material.
