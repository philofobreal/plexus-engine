# AN-03G: bounded physical-band improvement and semantic evidence gate

Implemented actual analyzer DSP, not only comparison tests. The selected direct
research `extractBandOnsets` preserves every v6 candidate and adds physical-band
attack proposals. `assessAcousticOnsets` separately preserves their evidence and
consumer uncertainty. Defaults/TrackAnalysis/worker/UI and existing visual/XR
publication remain unchanged. Owner: root analyzer/semantic integration.

## Authored before/after evidence

All 589 previously viewed conditions are replayed as development/regression,
including AN-03F's failed peak transfer. A selected source is frozen before a
new related 112-condition matrix is evaluated. These are generated controls,
not independent musical holdout. The [experiment declarations](AN-03G-EXPERIMENT.md)
record parameter grids and their timing; no tolerance changes are fitted to music.

| Strict 2 ms measure | v6 | Selected physical bands |
| --- | ---: | ---: |
| Known authored matches / 1728 | 1431 | 1494 |
| Known positive-case extras | 240 | 240 |
| Known negatives / 183.5 s | 2 | 2 |
| New authored matches / 384 | 208 | 279 |
| New positive-case extras | 64 | 64 |
| New negatives / 43.2 s | 4 | 4 |

The known gain is 11 AN-03D and 52 AN-03F attacks; every other known matrix
retains its own match/extra/negative counts. New transfer improves 71 matches
without extra or negative increases. Thus the selected direct function passes
this bounded addition gate. It does not eliminate the existing misses, extras
or removal false candidates, and is not declared XR-ready or universally better.
The four new removal negatives remain an03g-025/081/108/109 in both versions.
At 25 ms, known totals are 1435 versus 1498 matches,236 extras in each; new
transfer counts remain 208 versus 279 matches and64 extras.

Grid 01 (band recurrence/continuation alone) and grid 02 (physical peak contrast)
are rejected: their modulation/ramp/cutoff negatives increase. Grid 03's raw
physicalFloor1e-5 has one extra D negative and is rejected;1e-4 is selected.
`an03g-development-grid-01.json`, `-02.json`, `-03.json`, `-final.json` and all
`.sources/` copies preserve every measured revision. `an03g-transfer-frozen.json`
retains new truth, raw candidates, parameters, timing scores and baseline results.
No earlier result or v1-v7 source is rewritten. No parameter is retuned after
viewing the new matrix.

## Recorded music and actual library agreement

`an03g-recorded-01.json` replays the exact retained channel-0 44.1 kHz PCM for
the same nine Prodigy excerpts (180 s), verifying its SHA256/length/clock. It
reuses immutable AN-03F actual librosa0.11.0/audioFlux0.1.9 predictions with
the input report hash and1184 shared references. **Neither library is rerun in
this slice.** No recording/decoded PCM/native runtime is copied into fixtures;
the cache can be regenerated using the preserved native dual-library diagnostic.

| Three excerpts per recording | v6 candidates | Band candidates | v6 qualified | Band qualified |
| --- | ---: | ---: | ---: | ---: |
| Goa / The Heat / The Energy Part 2 | 449 | 538 | 220 | 279 |
| No Good / Start The Dance / Bad For You Mix | 133 | 135 | 115 | 116 |
| Scienide | 65 | 65 | 44 | 44 |
| Total | 647 | 738 | 379 | 439 |

Only class-matched one-to-one library pairs are eligible references; qualifying
a Plexus candidate requires proximity to both original timestamps, not just
their mean. All old v6 recording timestamps remain. The299 new-stream unqualified
candidates are unknown, not false labels. More agreement is diagnostic and
does not establish recorded-music accuracy; AN-03F's shared false control remains
active. The [continuing policy](TWO-LIBRARY-REFERENCE-POLICY.md) applies, including
its exclusion of permissive legacy single-library exports from trusted targets.

## Interpretation layer and tests

The pure semantic evidence gate checks PCM/clock, physical support, duplicate
events/votes, exactly two actual-provider identities, pseudo-label status and
unmodified times. It qualifies one-to-one at25 ms, copies nested evidence and
emits explicit unknown/endpoint reasons. All observations remain diagnostic-only
for dramaturgy/choreography and ineligible for XR scoring: neither acoustic
attack nor library agreement supplies an instrument, beat, bar, drop or scoring
target. This research boundary is executed in the new recording diagnostic;
it is not wired into production cue or chart generation.

Targeted command `node --test tests/analyzer-band-onsets.test.mjs tests/acoustic-evidence.test.mjs`
passes nine tests:701 authored cases, physical support, old-candidate retention,
polarity/binary gain, repeat determinism, malformed inputs, short tails,
both-vote matching, exhaustive assignment cardinality, order and input-copy
contracts. Its first run exposed a new test helper's wrong fixture nesting;
the helper was corrected without changing DSP/expected measurements, and the
complete targeted pair was rerun successfully. Two new Python tests independently
recompute new recording qualification with `qualify_pair`:738 candidates/439
qualified, original times and all consumer abstentions are retained.

The full suite tests retained recording evidence, not external MP3 re-decoding
or optional native execution. Actual new DSP on exact retained PCM is measured
by the separate recording program above. This slice adds no dependency, installs
nothing and uses no runtime/package-manager fallback. Node/npm25.2.1/11.6.2 and
existing lab Python3.12.14 are used. Browser smoke and Quest/manual music
annotations are not performed: production UI/runtime activation is unchanged,
and the tested path is direct headless DSP/semantic projection. `diff_export.ps1`
is skipped as unnecessary for this bounded local development; no PR/handoff.

## Reproduction and retention

Cost observation `an03g-cost-final.json`: one20.2 s/44.1 kHz excerpt, one
warmup then three calls per function. Median v6 is797 ms; selected bands2615 ms
on this host. Per-call outputs are deterministic. The earlier cost01 observation
and its source snapshot remain; its corresponding medians are739/1571 ms.
Observed spread and host load prohibit a hardware/realtime speed guarantee.
One band array allocates7,126,560 bytes for this excerpt; it is not a measured
process-memory peak. Longer-file allocation, quadratic new-proposal suppression
and browser/worker cost remain optimization work before consumer activation.

From the repository root, use fresh output/cache/basetemp paths:

```powershell
node research/analyzer-lab/diagnostics/measure-an03g.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03g-transfer.mjs --output NEW_TRANSFER_JSON
node research/analyzer-lab/diagnostics/measure-an03g-recorded.mjs --references research/analyzer-lab/fixtures/an03f-dual-prodigy-01.json --pcm-cache EXACT_PCM_CACHE --output NEW_RECORDING_JSON
node research/analyzer-lab/diagnostics/profile-an03g.mjs --request EXACT_PCM_REQUEST_JSON --output NEW_COST_JSON
node --test tests/analyzer-band-onsets.test.mjs tests/acoustic-evidence.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_band_reference_assessment.py -q -p no:cacheprovider --basetemp=NEW_ABSENT_TEMP
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report NEW_FULL_REPORT
```

The final targeted Python command uses
`--basetemp=research/analyzer-lab/.cache/an03g-pair-targeted-unique-a`:2 pass.
Exact cache replay uses `.cache/an03f-prodigy-pcm-01`. Missing exact PCM fails
explicitly; do not substitute another decode or fabricate the external votes.

The cumulative inventory, full build/all Node/Python results and source identity
are recorded below. All old active tests run with the new
ones; historical mirrors remain explicitly unexecuted. Earlier source ZIPs and
run histories remain unchanged. Large audio/runtime/log files stay ignored.

Inventory v0010 protects1139 files, adding123 with zero replacements/deletions.
All1016 v0009 predecessor records remain identical. There are142 active Node
test files,27 Python files and48 explicitly unexecuted historical mirrors.
Archive SHA256:
`d97ed6327ed3a5bb277a8d1ae61e103fd502858b6e3ce64595d43b37b534f359`.
All107 AN-03G measurement source copies match their recorded SHA256. No
MP3/WAV/FLAC/f32le is protected; no exact-hash replacement migration was needed.
Current DSP SHA256 is
`ae9031a2b11d609c36592a2ec029bf625e54e6a0970150e828bbb5ee8aaa7a0d`;
semantic gate SHA256 is
`a868d069be56c3e0280346d0661af64bcd6876ae949bc9fddc010ebe0251de91`.

Next: retain these newly seen conditions as regressions; add independently
reviewed musical starts and explicit target-precision annotations, investigate
the remaining source-removal negatives, and validate cost/uncertainty before
worker/default or accepted dramaturgical/XR publication. Frequency-band evidence
does not by itself recognize musical meaning.

## Completed cumulative run

Run `20261011T084436-5be0f6d7eda9`:
[immutable compact history](../tools/harness/history/20261011T084436-5be0f6d7eda9.json).
Detailed report/logs/XML remain in ignored `.cache/an03g-full-validation.json`
and `.cache/regression-harness/20261011T084436-5be0f6d7eda9/`.

| Gate | Result |
| --- | --- |
| Declared npm build | Pass, exit 0 |
| Declared npm test | 1375 tests: 1366 pass, 9 fail; 142/142 active files executed |
| Complete Python lab pytest | 314 pass; 27/27 active files executed |
| New/unknown failures | 0 |
| Known failures | 9 exact previously recorded Wormhole assertion signatures |
| Missing/skipped/cancelled/todo Node tests | 0 |
| Post-run protected inventory | Pass, 0 issues |
| Analyzer/lab source changed during run | False |
| Overall harness | Failed, exit 1; known failures remain nonzero |

The nine known failures are clip profile (4), geometry LFO integration (1),
preset differentiation (2) and projected motion (2). All previous active tests
run with the additions, including required semantic determinism and Visual Score
suites. The 48 historical mirrors remain explicitly unexecuted. No golden
fixture or known-failure signature is refreshed; no unrelated visual fix is
claimed. The bounded DSP addition passes its own declared gates despite those
pre-existing repository failures.

Executed cumulative command from the repository root:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03g-full-validation.json
```

Console was redirected to `.cache/an03g-full-console.log`. The harness invokes
`npm run build` and `npm test -- --test-reporter=<retained-node-reporter-URL>`.
From `research/analyzer-lab`, the existing Python runs
`-m pytest tests -q -p no:cacheprovider -o junit_family=xunit1` with fresh
basetemp `.cache/t4ffad6e13fdc/p` and run-directory JUnit XML. Exact resolved
commands/cwd/absolute arguments and log hashes are retained in report/history.
`& ./node_modules/.bin/tsc.cmd --noEmit` and `git diff --check` also pass.
Source-copy/UTF-8/JSON/link/whitespace review reports zero issues for all 132
new files and related documentation. No runner/package-manager fallback is used.

Current source identity: 300 files, SHA256
`176a1fbed77ca3e6e0ca842c01f7de6d35f28cfa68c9d3be10eeab8edeab3644`.
Immutable history SHA256:
`db5bf3d4188957e35a37b2494a381ccec5551e3a2dc2ea68e85976908accd292`.
Full evidence digest:
`93953000f5f0d3958945aef570f442e9c2ae63d969d6a5e97c2f4b62ca254bd0`.
The harness records the canonical JSON digest convention in report/history.
