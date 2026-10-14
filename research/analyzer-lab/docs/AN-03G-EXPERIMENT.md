# AN-03G: physical bands and explicit consumer evidence

Owner: root integration, analyzer DSP and pure semantic evidence projection.
Keep v1-v7, all old tests/results and production interfaces unchanged. No runtime,
worker, shared state, visual or gameplay activation is authorized by a research
score alone. Use existing Node/npm and Python; no new package is needed.

Hypothesis declared before measurements: causal biquad bands at fixed physical
centres [300,600,1200,2400,4800] Hz (Q=1, two cascaded sections, centres below
0.4 Fs) separate a predictable sustained background from a new attack. Fit a
two-lag sinusoidal recurrence in each band at approximately 8 kHz physical lag,
using observed 30 ms history. Require a sharp innovation rise over a 2 ms contrast
and a 4 ms refinement window, then positive band energy continuation over 8 ms.
The ratio grid is fixed before results: innovation contrast [8,16], continuation
ratio [1.1,1.3]. Relative floor is 1e-5 of band history power; absolute floor
1e-20. Preserve v6 with priority. New proposals use 7 ms exclusion to avoid
repeated body peaks; this is a conservative proposal rule, not a tempo assumption.

Localize separately on original PCM using a fourth difference at the same
physical lag, over a declared +/-3 ms range. Do not fit timestamp corrections
to music. Causal IIR dependence starts at sample 0; publish that full support
honestly rather than claiming a finite filter history. Short or incomplete
continuation abstains. Confidence stays unknown. A band is not an instrument.

All 589 previously viewed conditions are development/regression material,
including the rejected AN-03F transfer. Primary authored tolerance is 2 ms, with
25 ms diagnostic scores and exposure-based negatives. Addition acceptance requires
more matches without extra or negative increases in each prior matrix; no old
candidate may be displaced. Store every measured grid revision and sources.
After selection, declare a new related synthetic matrix before viewing its
outputs; do not call it independent recorded-music holdout or retune after it.

Keep strict librosa/audioFlux reference pairing from AN-03F: only their two votes,
both-timestamp qualification, fixed 25 ms and no fabricated truth. If a recording
comparison is performed, replay the same original PCM and prior library output
identities. A density increase is not an accuracy improvement.

The semantic projection should expose the difference between a physical
candidate, two-library agreement and a consumer-ready event. Retain uncertainty
and provenance. Research candidates and coarse pseudo-labels must not become XR
scoring targets or accepted dramaturgical/instrument facts by conversion. Test
abstention, malformed evidence, order, duplicates and original timestamps.

Grid 01 is retained and rejected: even contrast16/continuation1.3 introduces
many modulation/negative candidates. Band recurrence plus energy rise alone is
insufficient. The next declared development grid fixes those two parameters and
tests original-PCM physical fourth-difference peak contrasts [2,4,8]. Compare the
4 ms peak after localization to the full 4 ms maximum preceding the filter's
four-lag memory. This tests sharp physical change, not a second fitted library
vote. Preserve all grid-01 outputs and code snapshots. No unseen matrix has been
viewed yet. The selected parameter is still required to pass every known matrix.

The band coefficients use the standard constant-peak-gain biquad mathematics
documented in the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/).
The recurrence, localization, confirmation and selection are Plexus research
design; no third-party onset source or model is copied.

Grid 02 retains many added matches but all settings still introduce ramp and
cutoff/removal negatives. Added ramps have very small absolute innovation and
cutoffs leave IIR ringing despite absent raw continuation. Grid 03 is declared
before its scores: hold contrast16/continuation1.3/physicalPeakContrast8; test
physical raw-history-relative floor [1e-5,1e-4]. Require observed nonzero raw
continuation beyond the four-lag memory and a 1.3 rise in physical-lag second
difference mean power over complete 12 ms windows. No missing tail is silence.
This is a physical sign/scale check, not instrument recognition. Retain grids
01/02; no new transfer output is yet inspected.

Selection: grid03 physicalFloor1e-4 adds 11 D and 52 F matches with no extra or
negative increase in any of the seven known matrices. The 1e-5 choice introduces
one D negative and is rejected. Freeze contrast16/continuation1.3/peakContrast8/
physicalFloor1e-4 before transfer; default metadata records this exact choice.

New related transfer declaration, before output:22.05/48 kHz; two [211,523] or
four [211,389,659,947] carrier beds, total amplitude .12; phases .37/1.13;
7 ms noise (seed20261025,2.3 ms exponential decay) or 20 ms 1173 Hz plucks
(7 ms decay); gains .018/.055; six starts at .241+j*gap with gaps13/29 ms.
64 positives/384 authored starts.48 negatives (43.2 s exposure after .1 s) use
sustain,120 ms linear rise,5.3 Hz AM,paired +2.7 Hz beating,lowest-source removal
at .67 s and continuous lowest-carrier chirp (+88 Hz over .4 s from .2 s).
This related generator is not independent music. Do not retune the selected DSP
after viewing transfer. Preserve both success and newly observed failures.
