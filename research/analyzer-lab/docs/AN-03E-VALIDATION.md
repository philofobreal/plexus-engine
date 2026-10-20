# AN-03E validation: removal candidates and local recordings

Actual analyzer code added: [ContinuationOnsets](../../../src/analyzer/ContinuationOnsets.ts), with [research result types](../../../src/types/continuationOnsets.ts). This is a candidate filter, not a new accepted musical event classifier. [Contract](../../../documents/features/analyzer-continuation-onsets.md) and [predeclared protocol](AN-03E-EXPERIMENT.md) define scope and math. Existing v1-v5 implementations, schema, transport, browser activation and default analyzer are unchanged. Selection through analyzeAudio remains limited to its existing versions; the new function is available directly for research.

## Synthetic results

Matching uses retained mir_eval metrics at 2/10/20/25/30/50/70 ms. The following counts are at 2 ms; 25 ms totals for v5/v6 are identical. Startup extras remain counted as extras, not silently excluded. Negative exposure separately excludes the first .1 s as originally declared.

| Matrix | Authored attacks | v5 matches | New filter matches | Positive extras v5/new | Negative candidates v5/new |
| --- | ---: | ---: | ---: | ---: | ---: |
| Known C2 + AN03 + B + C, 333 conditions | 864 | 864 | 864 | 108/108 | 0/0 |
| Known D, 96 conditions | 288 | 217 | 217 | 32/32 | 6/2 |
| Predeclared new E transfer, 56 conditions | 192 | 108 | 108 | 32/32 | 14/0 |
| Total, 485 conditions | 1344 | 1189 | 1189 | 172/172 | 20/2 |

The known 429 conditions have 132.3 s negative exposure; the new transfer adds 19.2 s. None of the previous 1081 matched attacks is lost. No new matches are introduced. D still misses 71 plucks; E still misses 84. The accepted bounded improvement is reduced removal-related false candidates; this is not a claim of solved soft onsets or overall musical precision. E uses related synthetic generators, not an independently annotated music holdout. Its output was not used to retune the selected 12 ms directional rule.

Revision 01 fails: removal negatives disappear but 128 previously matched attacks are lost (12 isolated C2,72 mixed C2,36 AN03,8 D). Revision 02 preserves prior attacks and reduces D negatives to two. The final revision adds full-window guards and explicit evidence/support/type contracts; counts are unchanged. All revisions, source copies and scores remain:

- [01 raw](../fixtures/an03e-development-01.json), [01 scores](../fixtures/an03e-development-01.scores.json).
- [02 raw](../fixtures/an03e-development-02.json), [02 scores](../fixtures/an03e-development-02.scores.json).
- [Final raw](../fixtures/an03e-development-final.json), [final scores](../fixtures/an03e-development-final.scores.json).
- [Transfer raw](../fixtures/an03e-transfer-frozen.json), [transfer scores](../fixtures/an03e-transfer-frozen.scores.json).

The new cumulative Node suite regenerates all 485 conditions, verifies PCM/truth/source identities and unchanged v5 baseline timestamps, counts matches independently from candidate selection, checks rejection evidence, physical support, polarity/gain invariance, deterministic repeats and real short tails/malformed clocks/PCM. It does not convert the known outcomes into a musical acceptance threshold.

## User-provided recordings

Input directory: `C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\prodigy`. Filenames identify these files; their titles/recording provenance are not verified externally. The files decode locally with soundfile/libsndfile: 44.1 kHz, stereo, durations approximately 365.768,410.594,350.460 s. Encoded file SHA256 and decoded channel-0 PCM SHA256 are recorded. No files were uploaded, resampled, changed, or copied into tracked fixtures/source ZIPs.

Three 20 s centered excerpts per track at 15%,45%,75% duration, each with 100 ms context on either side, yield 180 s analyzed exposure. [Full compact recording evidence](../fixtures/an03e-prodigy-recorded-01.json) retains absolute sample ranges, all event timestamps, versions, source hashes and a source-copy directory. Decoded excerpt PCM and raw bridge artifacts are in ignored `.cache/an03e-prodigy-pcm-01/`; regeneration needs the original local files.

| Track file identifier | Plexus v5/new candidates over three excerpts | Librosa candidates |
| --- | ---: | ---: |
| Goa_The_Heat_The_Energy_Part_2 | 449/449 | 550 |
| No_Good_Start_The_Dance_Bad_For_You_Mix | 133/133 | 503 |
| Scienide | 65/65 | 265 |
| Total | 647/647 | 1318 |

Maximum-cardinality symmetric shared events are 16 at 2 ms,426 at 25 ms,457 at 50 ms. At 25 ms there are 221 Plexus-only and 892 librosa-only candidates; Dice agreement is about .434. These are disagreement measures, not correctness or confidence. Librosa's 512-sample hop is about 11.61 ms at 44.1 kHz, so 2 ms overlap is particularly sensitive to clocks/localization; no fitted timestamp correction is applied. The new filter changes no timestamps in these excerpts. The candidate count gap motivates investigation of repeated/soft evidence and independent annotation; neither count alone establishes under-detection or over-detection. This run tests the v5/new research candidate branch, not default production beat/tempo/section inference or instrument recognition.

## Reproduction and validation

Run from the repository root. Every output/cache/basetemp must be a new path. Existing outputs below are immutable; use another filename to replay.

```powershell
node research/analyzer-lab/diagnostics/measure-an03e.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03e-transfer.mjs --output NEW_TRANSFER_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03e.py --input NEW_JSON --output NEW_SCORES_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/recorded-onsets.py --input-dir 'C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\prodigy' --cache NEW_CACHE --output NEW_RECORDING_JSON
node --test tests/analyzer-continuation-onsets.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_recorded_onsets.py -q -p no:cacheprovider --basetemp=NEW_ABSENT_TEMP
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report NEW_FULL_REPORT
```

Targeted results: four Node tests pass; five Python tests pass, including a real f32le-to-analyzer subprocess, truncation/reused-output rejection, one-to-one event agreement and original-clock recording metadata. Local Node/npm and the existing lab Python virtual environment are used. Nothing is installed and no runner fallback is required. The completed cumulative outcome follows below.

Next: establish independently annotated soft/repeated onsets in these recordings and other musical origins; compare positive multiband/spectral evidence while retaining every old timing/negative regression. Promote a consumer-ready field only after clock/schema/cost/uncertainty validation. This gate alone cannot improve missing-event recall, and physical XR readiness is still untested.

Retention evidence: cumulative inventory v0008 protects 860 files, with 139 active
Node test files,25 Python test files and 48 explicitly unexecuted historical
mirrors. All 743 predecessor entries remain byte-identical; 117 files are added.
No per-path replacement migration was needed. Its source ZIP SHA256 is
`ab1cdadc38fb69a4cf632831629c85e810ebaa34b30246f13b0e67aaa9722698`.
No MP3/WAV/f32le appears in that inventory. All 100 experiment/recording source
copies match their recorded SHA256. Current analyzer function SHA256 is
`374762a7c8382fc8499a1103e364331956773a51516e7066226ca5536acd4af1`;
research type SHA256 is
`98ee96cad16c3a2884bb6510a351bf707f588449752e2582353634984dc89c50`.
The two remaining known negative cases are D four-carrier removal at 44.1 kHz,
phases .19 and 1.27; those counterexamples remain active and explicitly recorded.

## Completed cumulative run

Run `20261011T061229-17d5b59fc777`: [immutable compact history](../tools/harness/history/20261011T061229-17d5b59fc777.json).
Detailed report/logs/XML remain in ignored `.cache/an03e-full-validation.json` and
`.cache/regression-harness/20261011T061229-17d5b59fc777/`.

| Gate | Result |
| --- | --- |
| Declared npm build | Pass, exit 0 |
| Declared npm test | 1363 tests:1354 pass,9 fail;139/139 active files executed |
| Complete Python lab pytest | 296 pass;25/25 active files executed |
| New/unknown failures | 0 |
| Known failures | 9 exact previously recorded Wormhole assertion signatures |
| Missing/skipped/cancelled/todo Node tests | 0 |
| Post-run protected inventory | Pass,0 issues |
| Analyzer/lab source changed during run | False |
| Overall harness | Failed,exit 1; known failures are never masked |

The nine known failures are clip profile (4), geometry LFO integration (1),
preset differentiation (2) and projected motion (2). This task does not repair
those unrelated visual presets or declare the whole repository green.
All prior active regression files run with the new ones. The 48 historical
mirrors remain explicitly unexecuted, as before. Recorded-music manifest tests
verify retained measurement evidence; the full run does not re-decode the three
external MP3s. The separately executed recording program above performs that
measurement and can be replayed with new outputs when the source files exist.

Executed integration command:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03e-full-validation.json
```

This invokes existing Node/npm 25.2.1/11.6.2 for `npm run build` and `npm test`
with the retained JSON reporter; Python 3.12.14 runs the entire lab test directory
with `-q -p no:cacheprovider -o junit_family=xunit1`, fresh basetemp
`.cache/t70056911fd93/p`, and JUnit XML. Exact resolved commands/cwds, logs and
their hashes are in the report/history. Targeted Python command used
`--basetemp=research/analyzer-lab/.cache/an03e-recorded-targeted-unique-a`.
No required build/automated suite was unavailable. Independently annotated music,
default-analyzer recording validation and physical browser/XR trials remain
outside the measured evidence.

Current source identity:291 files, SHA256
`276826481184435edcd5c070a3f35b49548c860761ba855d0fb67a6dc17a41d6`.
Immutable history SHA256:
`064d23727b9f5b5e70035f4a1b28094557087b6949ab2cb174077054dbd92d36`.
Full evidence digest:
`d974a6b215adb8b76cb892c6dbaa0f4dec5c654b5e9567fe9c4093cb95f6a642`.
The harness records the canonical JSON digest convention in the report/history.
