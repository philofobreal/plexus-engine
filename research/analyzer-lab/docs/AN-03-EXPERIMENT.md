# AN-03: develop and integrate a predictive-background attack detector

Owner: root (analyzer, shared optional transport and tests). User explicitly
requested algorithm improvement using the existing tests, not more measurement
alone. AN-02 C2 is known development/regression material; no holdout claim.

Development hypothesis: a sustained sinusoid satisfies x[n]=a*x[n-1]-x[n-2],
a=2*cos(2*pi*f/fs). Fit a over observed past 30 ms, and test short 4 ms
prediction-error power against its own background and the original signal level.
This detects added sources without doubling total mixture power. Multiple tones,
noise and fast modulation can violate this model and need explicit countertests.
Use a 2 ms proposal clock, real PCM indices, no padding as evidence, and distinct
innovation units/ratio (never reinterpret v1 powerRatio). Preserve v1 unchanged.
Development revision 02: after revision 01 scored 144/144 mixture, 132/216 dense,
72/72 isolated and seven negative hits (six cutoffs, one smooth-rise corner), add
an observed-continuation guard. An active prehistory followed by observed silent
samples after the two-sample predictor memory is a cutoff; unavailable tail is
not silence. All revision-01 source bytes and scores remain retained.
Revision 03: publication/normalization use the same explicit field order and
proposal sample anchor. Rebase rolling statistics every 1024 frames and reset
exact observed silent history to avoid fictitious coefficients from cancellation.
No quality threshold changes; add a sparse-silence coefficient regression.

## Frozen synthetic robustness matrix (before inspection)

After revision 03, freeze the detector and evaluate fs=16000/44100/96000;
0.8 s mono clips; starts .17/.37/.57 s. Bed = .15*sin(220 Hz) or sum of
110/220/329 Hz sinusoids, each .05, with phase .23. Attacks = new seeded
4 ms noise (LCG seed 20261011, decay 3 ms) or 660 Hz exponentially decaying
20 ms sine (phase .2, decay 5 ms), amplitudes .03/.15. Matrix: 24 positive
conditions / 72 truths. Negatives: both beds, sustain/200 ms linear rise/4 Hz
AM at all three rates (18 cases), plus three mono-bed cutoffs (21 negatives),
exclude only [0,.1) as in C2. Apply unchanged tolerance curve and raw clocks.
Preserve every result; no threshold fitting after inspection. Polyphonic cases
are explicitly expected to challenge a single-tone predictor. Synthetic grouping
does not establish recording generalization or physical XR precision.

Initial development constants: residual contrast 8, minimum residual/background
power ratio 1e-5*(8000/fs)^4, numerical power floor 1e-20, 15 ms strength-ordered
suppression with explicit ties. Rate factor reflects second-difference power
scaling, not a guarantee for all frequencies. Keep every measured development
revision and exact source snapshot before changing these constants. No fitting
on new final material. Reduce absolute numerical floor only with negative controls.

Evaluate C2 at original 10/20/25/30/50/70 ms tolerances, with unchanged truth,
negative exposure, matching and recorded librosa reference after verifying PCM
identity. Recompute v1 output and require equality with its historical event times.
Report per-family counts and per-condition timing; no aggregate hides a regression.
Development objectives at 25 ms: recover at least 90% mixture attacks, exceed
v1 dense recall, retain isolated attacks, and at most 38 C2 negative hits. These
are regression-development gates, not recording/XR acceptance standards.

After code selection freeze constants and source identity, then test a separately
declared robustness matrix (different carriers, attacks, gain, modulation and
polyphonic background). It remains synthetic, not independent recordings. Failed
strata stay visible and narrow support; do not erase tests or rewrite old results.
Integrate the improved detector as explicit optional headless analyzer evidence,
including schema, normalization, malformed-input, clock, deterministic/no-mutation
and default-output parity tests. Do not convert candidates into accepted XR notes,
instrument identities or dramatic cues without the corresponding consumer evidence.

Preserve all prior Node/Python tests and immutable inventories/results. Document
exact reviewed schema migrations and append the cumulative inventory before a
full build/Node/Python run. No dependencies, model downloads or golden regeneration.
