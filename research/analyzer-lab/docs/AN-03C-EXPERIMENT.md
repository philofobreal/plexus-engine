# AN-03C: repeated weak attacks over predictable carriers

Owner: root, offline analyzer and shared optional transport/schema integration.
Keep v1/v2/v3, all earlier active tests and immutable histories unchanged. Expose
v4 through the existing adaptive stream with an explicit version selector rather
than introduce a fourth parallel optional output field. Default selector stays v3.

Known development material: 144 C2, 45 AN-03 and 60 AN-03B conditions. The previous
58 mixed-density misses and two fast-rise errors are now known development cases.
Require exact regenerated PCM/truth hashes and recomputed historical v3 timestamps.
Report all original tolerance curves plus 2 ms; retain clip-start extras/exposure.
Do not call known cases independent holdout. Save every measured revision/source.

Hypothesis: the 30 ms fit is contaminated by past attacks even when the background
is simple. Retain short-block sufficient statistics over that support; choose a
locally predictable 2 ms block for the tone coefficient when its normalized fit
error is below 1e-5*(8000/fs)^4. Use its stable model with recent 2 ms contrast,
instead of letting previous attacks raise the full-history gate. Fall back to v3
model/contrast when no clean block exists. Silence, polyphony and offsets remain
explicit controls; a clean-fit threshold is a heuristic, not instrument identity.
Test a relative innovation floor with rate exponent two (same 1e-5 constant) to
protect against envelope-corner spikes; document losses instead of hiding them.
Keep 4 ms observed lookahead, 2 ms hop, 3 ms candidate suppression and contrast 8.

Revision 01 recovers 144/144 previous AN-03B attacks and removes its two ramp
errors, preserving C2, but introduces 30 AN-03 negative hits and increases its
positive extras 24 to 76. Revision 02 requires at least three eligible short
blocks, with coefficient range at most 1e-6*(8000/fs)^2. A single predictable
polyphonic slice cannot by itself activate the clean-model path. Failed revision
01 is retained. Adjacent blocks are temporal consistency evidence, not independent
musical sources or independent validation samples.

Development gates: all known C2 isolated/mixture/density truths at 2 ms retained;
no increase in their extras; original C2 negatives zero. Preserve old AN-03's
72 matches/24 extras/zero negatives. Exceed AN-03B 86/144 matches without raising
its 12 extras, reduce its two ramp hits if feasible. Any failed revision is saved
and explicitly reviewed before selecting a final version.

After source selection, freeze and evaluate new synthetic conditions: sample
rates 22050/48000; six 4 ms attacks at starts .23 s, gaps 7/14/28 ms; carrier
137 Hz, or 137+251 Hz at equal component amplitude; tone amplitude .12, attack
amplitudes .02/.06, new seeded noise (seed 20261013, exponential decay 1.3 ms).
36 positive conditions (also a silent background), 216 authored starts. Negatives
at both rates/backgrounds: sustain, 80/160 ms linear rises, 5 Hz AM, beating and
cutoff, phases .37/1.1: 48 conditions, excluding only [0,.1). No DSP changes after
inspection. This tests synthetic transfer only, not independently recorded music.

Append exact reviewed additive versioned-schema migration and cumulative inventory;
run build and every old/new active Node/Python test. No installs, golden refresh,
consumer acceptance, playback/UI/worker-policy changes or physical Quest claims.
