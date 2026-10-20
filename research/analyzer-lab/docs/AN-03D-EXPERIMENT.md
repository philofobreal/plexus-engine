# AN-03D: fixed fourth difference as multi-tone onset evidence

Owner: root, offline analyzer and optional shared transport integration. Preserve
all v1/v2/v3/v4 implementations, historical results, tests and defaults.

Known development is now 333 conditions: C2 (144), AN-03 (45), AN-03B (60),
AN-03C (84). Regenerate identical PCM/truth, verify actual v4 timestamps and
source identity. Retain original 2/10/20/25/30/50/70 ms matching and every startup
extra and negative exposure. These inspected cases are not independent holdout.

Hypothesis: a stable fixed fourth backward difference can suppress several smooth
low-frequency carriers without estimating one sinusoid or solving an ill-conditioned
multi-tone fit. Use coefficients [1,-4,6,-4,1]/16; for a sinusoid its amplitude
response is sin(omega/2)^4. This suppresses low frequencies, not polyphony in
general. Bright/smooth attacks and tonal discontinuities are explicit risks.
The binomial normalization bounds the absolute coefficient sum by one. Compare
observed recent 2 ms versus future 4 ms power, ratio eight, raw-history-relative
floor initially 1e-5*(8000/fs)^2, numerical floor 1e-20. Use actual four-sample
memory, real-tail continuation and 3 ms strength suppression. Retain each measured
revision/source, including failed designs. Do not retime truth or change tolerances.

Development gates: preserve 648 known C2/AN-03/AN-03B matches at strict 2 ms,
do not increase prior extras or negative hits; improve AN-03C's 158/216 strict
matches, keep silence/single-carrier gains, reduce its five beating hits. Report
per-stratum misses/extras, not only an average. Candidate data stays optional;
no accepted beat/chart/visual event promotion is inferred.

After source selection freeze a new synthetic matrix, declared now: rates
11025/44100, beds silence / 191+337 Hz / 191+337+503+719 Hz, attacks seeded
broadband (seed 20261014, 5 ms support, 1.6 ms decay) or 880 Hz pluck (18 ms,
6 ms decay), amplitudes .015/.05, six starts .217 s with gaps 9/17 ms.
48 positives / 288 authored starts. Negatives: 60/180 ms linear rises, 6 Hz AM,
beating (191/194/337/340 and eight paired tones), source removal and sustained
carriers, phases .19/1.27, both tonal beds and rates: 48 negatives / 33.6 s
after unchanged [0,.1) exclusion. No DSP tuning after this new matrix is inspected.

Run cumulative old/new Node and Python suites, build, independent actual payload
schema validation, preservation/inventory chain and file hygiene. No installs,
baseline refresh, browser/worker enablement or physical headset acceptance.

Development outcome before freezing: the pure-filter design loses soft attacks;
recent contrast restores dense attacks but produces tone-ending extras. A lower
floor recovers soft attacks and introduces negative/precision regressions, so is
rejected. Preserve the original floor, peak-confirm v4 proposals for soft evidence,
and require the direct branch's real continuation beyond memory to exceed that
same floor. Publish branch provenance and actual supports, with forward bound
R+5+H (about 6 ms plus five samples), rather than claiming the original 4 ms bound.
All five measured revisions remain retained. Final known gates pass before the
new 96-condition matrix is inspected; no DSP change follows that inspection.
