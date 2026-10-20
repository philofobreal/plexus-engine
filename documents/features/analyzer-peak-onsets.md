# Experimental peak onset evidence: rejected for promotion

`src/analyzer/PeakOnsets.ts` exposes a direct research probe,
`experimental-peak-curvature-v7`. This name does not select production analyzer
algorithm 7 or add a worker/TrackAnalysis version. No default or consumer flow
uses this probe.

The probe preserves v6 continuation candidates with priority and proposes sharp
fourth-difference power peaks relative to the raw history floor. A 12 ms
second-difference power rise must confirm a proposal; 3 ms suppression never
displaces a retained v6 candidate. Physical sample support, parameters,
localization and evidence source are retained. Rolling raw power is rebased
every 1024 proposal frames, and its timestamps match the unoptimized selected
revision on all 485 historical conditions. This is a frequency-weighted waveform
experiment, not a completed fixed-Hz multiband detector.

It gains 11 matches on the known authored corpus without increasing that corpus's
extra or negative counts. On the frozen 104 new conditions, however, strict
2 ms matching gains 19 while adding 58 extra positive-case candidates. At
25 ms it still adds 19 extras. The prototype therefore fails promotion; the
tests deliberately retain its observed failure instead of certifying improvement.
Recorded-music agreement counts do not override this failure.

The [validation record](../../research/analyzer-lab/docs/AN-03F-VALIDATION.md)
preserves all revisions, authored truth and actual two-library comparison.
Future work must separate physical attack localization from coarse spectral
novelty, add fixed-Hz background/attack evidence, and check every old regression
plus new independently annotated musical cases before consumer activation.
