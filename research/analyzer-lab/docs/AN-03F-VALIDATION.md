# AN-03F: strict dual-library evidence and rejected peak prototype

This slice implements the user's agreement-only third-party reference rule for
acoustic onsets with actual librosa 0.11.0 and audioFlux 0.1.9. It also evaluates
a new Plexus peak probe. The reference gate is implemented; the probe fails its
new-condition acceptance gate and remains research-only. No production default,
worker, UI, TrackAnalysis or rhythm-game target activation is changed.

## Actual external-library comparison

Nine retained 20 s excerpts at 15/45/75% of three local MP3 recordings provide
180 s measured exposure, with 100 ms context at each boundary. Original audio
stays at `C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\prodigy`.
Channel-0 float32 PCM remains at its original 44.1 kHz clock. Decoded/excerpt PCM
and old librosa/v5/v6 timestamps are checked against AN-03E evidence. No copied
recording, decoded PCM, native binary, wheel or environment becomes a tracked
fixture. Actual parameters, versions, binary and source hashes are retained.

| Recording (three excerpts each) | librosa | audioFlux | Paired references | v6 qualified | Peak probe qualified |
| --- | ---: | ---: | ---: | ---: | ---: |
| Goa / The Heat / The Energy Part 2 | 550 | 505 | 493 | 220 | 473 |
| No Good / Start The Dance / Bad For You Mix | 503 | 483 | 453 | 115 | 444 |
| Scienide | 265 | 332 | 238 | 44 | 162 |
| Total | 1318 | 1320 | 1184 | 379 | 1079 |

Pairs use fixed 25 ms, class-matched maximum-cardinality one-to-one matching.
Both implementations use spectral change but different spectral representations
and peak picking. They are actual separate libraries, not a handmade second
detector. Their 134 librosa-only and 136 audioFlux-only outputs remain unaccepted
unknowns. Each eligible reference retains both votes, disagreement and bounded
interval, with confidence null and groundTruthStatus false. Mean pair time is
only a representative timestamp. Plexus does not vote on its reference.

Qualification requires the Plexus candidate within 25 ms of **each** original
library timestamp; matching only the mean would overstate the final count. The
v6 stream contains 647 candidates and the probe 5828; 4749 probe candidates
remain unqualified unknowns. Three predeclared circular-shift density controls
(1.137/7.137/11.137 s) qualify 637/339/612 probe candidates, versus 1079 with
original alignment. These controls diagnose the effect of high candidate density;
they are not an IID null model or a significance estimate. Larger agreement
coverage alone cannot establish better analyzer precision or justify promotion.

Eight separately authored controls include 15 physical positive onsets. Both
libraries share all 15 positive events within the coarse pairing tolerance.
Sustain and ramp controls have no paired references. Source removal has **one
shared false onset**, retained explicitly. Thus agreement is eligible evidence,
not proof of truth, instrument identity, beat timing or XR readiness. The
[continuing reference policy](TWO-LIBRARY-REFERENCE-POLICY.md) also excludes
single-library labels produced by retained permissive historical workflows.

## Plexus experiment and acceptance decision

The [declared experiment](AN-03F-EXPERIMENT.md) separates authored 2 ms physical
onset truth from 25 ms coarse library agreement. All 485 previous conditions are
replayed; 104 additional conditions are declared before viewing their outputs.

| Strict 2 ms measure | v6 | Selected peak probe |
| --- | ---: | ---: |
| Known authored matches / 1344 | 1189 | 1200 |
| Known positive-case extras | 172 | 172 |
| Known negative candidates / 151.5 s | 2 | 2 |
| New authored matches / 384 | 242 | 261 |
| New positive-case extras | 68 | 126 |
| New negative candidates / 32 s | 0 | 0 |

The initial 4 ms direction-window/floor prototype gains 50 known matches but adds
six extras and one ramp negative: rejected and retained. The selected 12 ms
direction window and eight-times floor gains 11 known matches. The final rolling
power optimization produces identical candidate timestamps to that selected
revision on every known condition.

On the frozen new matrix, the probe gains 19 strict matches but adds 58 extras.
At 25 ms, v6 has 246 matches/64 extras and the probe 304 matches/83 extras:
19 additional extras remain even with coarse tolerance. **Do not promote the
probe as an analyzer improvement.** It is retained with failure assertions and
source snapshots, without further fitting to this now-seen matrix.

The new matrix also exposes a v6 limit: v5 has 252 strict matches versus v6's
242, while v6 removes three v5 negative candidates. The preceding continuation
filter's no-loss claim was bounded to its measured cases; it does not generalize
to all unseen attacks. This new counterexample remains cumulative evidence.

## Retained files and reproduction

`fixtures/an03f-development-01.json`, `-02.json` and `-final.json` retain failed,
selected and optimized revisions, with `.scores.json` and `.sources/` snapshots.
`an03f-transfer-frozen.json` retains the new matrix. `an03f-dual-prodigy-01.json`
retains all recording predictions and strict pairs; `an03f-oracle-calibration-01.json`
retains authored controls and the shared false event. Selection `-01.json` and
`-final.json` retain identical qualified counts before/after duplicate-vote
validation hardening. No predecessor fixture or implementation is rewritten.

Run from the repository root, using fresh output/cache/temporary paths:

```powershell
node research/analyzer-lab/diagnostics/measure-an03f.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03f-transfer.mjs --output NEW_TRANSFER_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03f.py --input NEW_JSON --output NEW_SCORES_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/dual-recorded-onsets.py --input-dir 'C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\prodigy' --runtime-root NEW_RUNTIME --cache NEW_CACHE --output NEW_RECORDING_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/calibrate-dual-onsets.py --runtime-root NEW_RUNTIME --output NEW_CALIBRATION_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/select-dual-references.py --input NEW_RECORDING_JSON --output NEW_SELECTION_JSON
node --test tests/analyzer-peak-onsets.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_strict_pair_references.py -q -p no:cacheprovider --basetemp=NEW_ABSENT_TEMP
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report NEW_FULL_REPORT
```

The [optional runtime record](../providers/audioflux/README.md) documents exact
wheel versions/hashes, real native loading and the safe extraction fallback after
`pip --target` encountered Windows temporary-directory access error 5. No core
lab/npm dependency is changed and no test-runner fallback is used. Node/npm
25.2.1/11.6.2 and Python 3.12.14 are the measured environment.

Targeted validation: three Node tests pass (485 old plus 104 new conditions,
physical support, exact timestamp preservation, malformed clocks and short
tails). Sixteen Python tests pass after duplicate-vote hardening. They validate
the strict gate, both-vote qualification, optional input contracts and retained
recording/calibration evidence. Full pytest does not re-decode external MP3s or
require optional native audioFlux; the separately executed measurement and
calibration programs above performed those actual provider runs.

Completed cumulative build, all Node/Python tests, inventory and source identities
are recorded below. Probe acceptance remains withheld regardless of whether the
counterexample-retention tests pass.

Retention check: inventory v0009 protects 1016 files, adding 156 to v0008 with
zero replacements or deletions. Every one of the 860 predecessor records remains
identical. There are 140 active Node test files,26 Python files and 48 explicitly
unexecuted historical mirrors. Source archive SHA256 is
`5a131f7e3be4a2607dccff83c4a7a445e5e99b50efa075d44fa3fa73ee6124ef`.
All 129 AN-03F experiment source copies match their recorded SHA256, and all ten
cached wheel hashes match the runtime lock. No MP3/WAV/FLAC/f32le is protected.
No per-path replacement migration was needed in this slice.

Next: separate coarse spectral novelty and precise physical attacks; test fixed-Hz
multiband background/attack evidence, independently reviewed musical annotations,
explicit boundary uncertainty and consumer cost/timing before activation. The
newly viewed transfer matrix is now a known regression set, not a fresh holdout.

There is a concrete mathematical reason to investigate sample-rate behavior.
The normalized fourth difference has response `(1-exp(-j*w))^4/16`, hence its
power gain at physical frequency f is `sin(pi*f/Fs)^8`; the second difference
has power gain `sin(pi*f/Fs)^4`. For fixed low physical frequencies, the former
falls approximately as `Fs^-8`, whereas the probe's raw-relative floor contains
`Fs^-2`. Its thresholds therefore do not imply sample-rate invariance. This is
an analytic design concern, not an ablation proving the cause of every miss.
The next model should declare physical band responses and normalization, measure
attack/background evidence separately, and localize a supported candidate on
the original sample clock. Coarse novelty, physical onset and consumer target
selection need separate precision and negative-exposure gates.

## Completed cumulative run

Run `20261011T074851-8b154e213b44`:
[immutable compact history](../tools/harness/history/20261011T074851-8b154e213b44.json).
Detailed report/logs/XML remain in ignored `.cache/an03f-full-validation.json`
and `.cache/regression-harness/20261011T074851-8b154e213b44/`.

| Gate | Result |
| --- | --- |
| Declared npm build | Pass, exit 0 |
| Declared npm test | 1366 tests:1357 pass,9 fail;140/140 active files executed |
| Complete Python lab pytest | 312 pass;26/26 active files executed |
| New/unknown failures | 0 |
| Known failures | 9 exact previously recorded Wormhole assertion signatures |
| Missing/skipped/cancelled/todo Node tests | 0 |
| Post-run protected inventory | Pass,0 issues |
| Analyzer/lab source changed during run | False |
| Overall harness | Failed,exit 1; known failures remain nonzero |

The nine known failures are clip profile (4), geometry LFO integration (1),
preset differentiation (2) and projected motion (2). All prior active tests ran
with the new ones; the 48 historical mirrors remain explicitly unexecuted.
No golden fixture or known-failure signature was refreshed. There was no
test-runner or package-manager fallback. Independently annotated recorded music,
production-default recording validation and physical browser/XR trials remain
unmeasured; the separately executed native diagnostic is not a browser trial.

Executed cumulative integration command, from the repository root:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03f-full-validation.json
```

This invokes `npm run build` and `npm test -- --test-reporter=<retained-node-reporter-URL>`
with existing Node/npm 25.2.1/11.6.2. From `research/analyzer-lab`, Python 3.12.14
runs `-m pytest tests -q -p no:cacheprovider -o junit_family=xunit1` with fresh
basetemp `.cache/t56f24d6d8db6/p` and JUnit XML in the run directory. The exact
resolved commands, cwd, absolute arguments and log hashes are retained in the
report/history. The final targeted Python run used
`--basetemp=research/analyzer-lab/.cache/an03f-pair-targeted-unique-b`.

Current source identity:296 files, SHA256
`77982f0f536d9edd60b238cbabee99914b2bcdf2ed64c45d7bee1daad508ca96`.
Immutable history SHA256:
`07612f01364700c368cbfa1505c5e14db6161a022fb4e982244e8a385b0cfb46`.
Full evidence digest:
`11d52c211c43623faf224fd78f43d0dde679fbdd463b59c4e17c422631a9deb7`.
The harness records the canonical JSON digest convention in the report/history.
