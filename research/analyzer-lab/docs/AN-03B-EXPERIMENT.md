# AN-03B: recover nearby attacks and reject continuous envelope corners

Owner: root, analyzer and shared optional transport/schema integration. Existing
AN-03 v2 and every prior active test/result remain unchanged. This task develops
actual new DSP as an explicitly versioned, optional candidate stream, not musical
or XR acceptance. No playback, worker adapter, state or visual consumer changes.

Known development material: all C2 and previously inspected AN-03 robustness
conditions. Check exact PCM/truth/v2 timestamps against the preserved measurements.
Keep all tolerances 10/20/25/30/50/70 ms and initial negative exclusion [0,.1).
Also report strict 2 ms matching for dense material: 25 ms matching alone can pair
different close events and does not prove dense localization. Every output and
measured source revision must be exclusively saved before further changes.

Hypothesis: a 30 ms fitted tonal model remains useful, but its residual mean
contains previous attacks and suppresses subsequent ones. Estimate contrast from
the most recent 2 ms instead, retaining full model support. Preserve 4 ms future
evidence and 2 ms proposal lattice. Reduce candidate suppression from 15 to 3 ms;
raw nearby acoustic candidates should precede consumer-specific sparsity decisions.
The innovation floor may need a rate exponent of three instead of four: a sampled
slope discontinuity's residual and average window contribution scale differently
from a stationary sinusoid's second difference. This is a development hypothesis,
not a universal audio law. Keep contrast multiplier eight and numerical floor.
Observe cutoff and modulation controls; do not hide new false positives.

Revision 01 recovered all 216 dense truths at 2 ms and zero C2 negative hits,
but increased mixture extras 48 to 105 and previous robustness extras 24 to 93.
Revision 02 therefore retains the long residual guard when fitted mean model
error is at most 0.1 of raw background power. Only a poorly predicted/broadband
history uses the short contrast alone. This is a deterministic model-quality
gate, not an instrument identity. The failed revision remains fully recorded.

Revision 02 keeps previous robustness extras at 24 but C2 mixture extras remain
96: 48 are clip starts and 48 are truncated pluck offsets. Revision 03 compares
observed continuing innovation beyond the predictor's two-sample memory to the
same pre-event contrast. A spike followed by an eightfold decrease is a source
removal hypothesis and is rejected. Missing future evidence is never zero-filled.
This is an acoustic guard, not ground-truth-aware timestamp suppression.

Development gates: all known isolated/mixture attacks retained; dense matches at
25 ms greater than v2's 132/216, and improvement at 2 ms; original C2 negatives
zero if feasible; preserve the previously inspected robustness positives/negatives.
Report candidate precision and all extra events rather than treating a reduced
suppression radius as an automatic quality gain. If a gate fails, retain the
failed result and document the narrowed claim or next bounded revision.

After selecting/fixing the source, freeze it and run new synthetic material:
sample rates 12000/32000/88200, starts .18 s, six added attacks at gaps
6/10/18/30 ms; background absent or a 173 Hz tone; new seeded 3 ms noise
(seed 20261012, decay 1 ms), amplitude .08. Negatives at each rate: tone with
sustain, 100 ms and 300 ms linear rises, cosine rise, 7 Hz AM and cutoff,
phases .41/1.2. No changes based on these results in this cycle. This is a new
synthetic robustness test, not independent recordings. Known failures remain.

Append a reviewed additive schema migration/inventory; run the entire cumulative
build/Node/Python harness after all code/tests are final. No installations, golden
regeneration, source/result deletion, physical timing or recording claims.
