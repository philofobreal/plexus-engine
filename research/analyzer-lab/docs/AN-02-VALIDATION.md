# AN-02 first-cycle validation and cumulative retention — 2026-10-10

This is the first narrow AN-02 cycle, governed by the
[predeclared experiment](AN-02-EXPERIMENT.md). Root owns analyzer, shared optional
contracts and integration. Independent reviews own the research harness and
archive tools. The new [acoustic stream](../../../documents/features/analyzer-acoustic-candidates.md)
is a headless opt-in, with algorithm identifier `overlap-energy-rise-v1`. Default
algorithm-7 frames/events/grid/consumer interpretation are preserved.

## Reproduced candidate measurements

The executable measurement program is
[`measure-an02-candidates.mjs`](../diagnostics/measure-an02-candidates.mjs).
Its [immutable compact result](../fixtures/an02-acoustic-candidates.summary.json)
records actual implementation, helper and waveform hashes plus Node version.
These are authored known regression fixtures, not a new independent holdout.

| Corpus | Denominator and result |
| --- | --- |
| Isolated impulses | 3364 truths across all 1024 legacy phases and acoustic hop phases, two overlaps, six sample rates; 3364 matches, zero misses/false positives, zero sample error |
| Fixed seeded noise | Nine truths at 8/44.1/48 kHz; nine matches, zero misses/false positives, zero sample error |
| Fixed 440 Hz decaying plucks | Nine truths; nine matches, zero misses/false positives; localization follows authored beginning by 3/12/13 samples (0.375/0.272/0.271 ms) at 8/44.1/48 kHz |
| Endpoints and partial tails | 24 conditions, including repeated first/last condition for one-sample buffers; every observed impulse is exact and explicitly ambiguous |
| DC/sustain/fade/cutoff negatives | 60 conditions, 19.446 s exposure after an explicitly excluded initial 80 ms per condition; zero selected candidates in that exposure |

The negative exposure is small and does not establish a population false-positive
rate. Matching is one-to-one nearest matching, valid here because events are
well-separated; general overlapping event evaluation needs the lab's task matching.
No missing event was removed from these denominators. Noise/pluck tolerances were
12 ms as declared; measured pluck bias remains disclosed rather than relabeled as
sample-perfect onset detection. The endpoint ambiguity is observation metadata,
not proof that a truncated sample is a perceptually complete onset.

Independent mathematical checks cover flatness GM/AM = 6/7 for `[1,2,4]`, bounded
gain invariance including quiet spectra, and the analytic EMA time response across
rates/hops. Legacy flatness/EMA migration is not part of this acceptance.

## Exact commands and focused results

Executed from the repository root using existing Node 25.2.1/npm 11.6.2 and lab
Python 3.12.14; no dependencies installed or upgraded:

```powershell
node --test tests/analyzer-acoustic-onsets.test.mjs tests/test-discovery.test.mjs tests/analyzer-contract.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_acoustic_transport.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/acoustic-schema-final-20261010
node research/analyzer-lab/diagnostics/measure-an02-candidates.mjs --output research/analyzer-lab/fixtures/an02-acoustic-candidates.summary.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an02-inventory-initial.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an02-full-validation.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/verify_archive.py --root . --output research/analyzer-lab/.cache/retention-integration-20261010 --historical-evidence-dir research/analyzer-lab/.cache --tonal-smoke --record-output research/analyzer-lab/.cache/retention-integration-20261010.json
```

Focused Node integration: **24 passed**, no skipped/cancelled cases, 20.951 s;
after the additional malformed-falsy transport checks, **24 passed**, 22.603 s.
Independent draft 2020-12 schema validation of the actual opt-in production output
and malformed examples: **six passed**. Initial harness self-tests: **24 passed**;
the reviewed temp/history correction adds four cases, **28 passed**, 12.91 s.
Retention integration replay: **24 checks passed**, original 21 source identities
verified, historical baseline evidence replayed, live schemas unchanged.

The initial focused run had one cross-realm object-prototype comparison failure;
JSON projection comparison corrected the test without changing the algorithm.
The final context frame and stricter support/endpoint/clock normalization were
reviewed before freezing the first inventory and full run. Their added tests pass.
None of the active headless/golden snapshots were regenerated for AN-02.

## First full cumulative run — retained failure

The immutable first [run history](../tools/harness/history/20261010T211125-3e0984f08408.json)
used inventory v1: 356 protected files, 132 active Node files, 19 Python files and
48 historical unexecuted snapshots. Build passed. Node executed **1325 cases:
1316 passed, nine failed, no skips/cancellations**, 497.729 s. All nine assertion
failures exactly matched the known Wormhole baseline. The historical tenth
failure, Windows preset-save rename EPERM, passed with workspace-local native temp.

Python executed **235 cases: 232 passed, three failed**, 58.03 s. All three errors
were Windows path-length failures in the harness's overly nested pytest temp path:
`test_reference_unsupported_events_are_partial_not_empty_success`,
`test_failure_isolation_and_report_immutability` and
`test_external_protocol_success_and_identity_failure_keep_diagnostics`.
They were classified as new failures and blocked acceptance. No source changed,
no protected file changed and no active file was omitted during the run.

The initial history remains untouched. A reviewed second inventory/run corrects
the temp-root length and additionally persists Node case counts/executed paths in
compact history, so they survive removal of ignored logs/full reports. The first
history already preserved commands, exits, log hashes, failures, inventory/source
identities and Python outcomes, but omitted Node counts/paths; the values above
were taken from its retained full report and final structured Node summary.

The [v2 migration record](../tools/harness/migrations-an02-v2.json) documents exact
old/new identities and integration review for three protected files. Every prior
assertion remains. A retained
[recording program](../diagnostics/prepare-an02-migrations.py) verifies predecessor
archive bytes and exclusively writes those reviewed reasons; it is not an
automatic semantic-equivalence checker or approval mechanism.

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-an02-migrations.py --root . --reviewed-by 'Codex /root integration owner, user-authorized continuation' --output research/analyzer-lab/tools/harness/migrations-an02-v2.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/tools/harness/migrations-an02-v2.json --report research/analyzer-lab/.cache/an02-inventory-v2.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an02-full-validation-v2.json
& ./research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab doctor
```

These exact migration/output paths are historical and already exist; replay uses
fresh paths and newly reviewed reasons. No blanket replacement acceptance exists.
The v1 full-report SHA256 is
`c8fcea367e1e96f4d7ee37eb7aba51d77dcef58ccba6c596287dbec88d3896ee`;
its immutable history SHA256 remains
`366c9564cdda04ca9db68b3d1a02e677c05c89e97d02f7168d44839c465df8fc`.

Doctor passed for the existing core dependencies, headless bridge and algorithm 7;
optional providers remain explicitly unavailable/nonfatal. No provider installed.

## Corrected full cumulative run — final evidence

The immutable [second run history](../tools/harness/history/20261010T212542-4ca432ee8bd4.json)
uses [inventory v2](../tools/harness/inventories/v0002.json): **357 protected files**,
the same 132 active Node files and 19 Python files, with 48 explicitly historical
unexecuted snapshots. Three exact-hash reviewed migrations preserve all old
assertions and predecessor bytes. The added recording program is also inventoried.

| Stage | Final result |
| --- | --- |
| Declared `npm run build` | Passed, including TypeScript; 5.547 s. Existing Vite large-chunk advisory remains nonfatal. |
| Declared `npm test` | 1325 cases: 1316 passed, nine exact known failures; zero skipped/cancelled/TODO; Node global duration 422.061 s. |
| Entire Python lab | 239 passed, zero failures/skips; pytest duration 269.18 s. |
| Executed-file coverage | All 132 Node and all 19 Python files; no missing/unexpected Node files, matching expected/executed path hashes. |
| Protected sources | Pre/post inventory passed; no source mutation during run. Both earlier archives and the first failed history remain intact. |
| New failures | Zero. The three initial Python path-length failures are resolved. |

The overall command deliberately returns **exit 1 / failed**, because nine known
Wormhole assertions remain failing. The analyzer candidate checks and full Python
suite pass; this is narrow AN-02 research acceptance, not an entirely green
product release or promotion into musical consumers. The old EPERM preset-save
failure passes with workspace-local temp, without editing its assertion.

The new immutable history retains the global Node counts, all executed Node paths,
expected/executed path hashes, coverage status, Python results, commands/exits/log
hashes, runtime/source identities and temporary locations. Pytest XML SHA256 is
`dadda9d654d688a7f3c5970cdfae367b1588826b10819b4731857b848a7cd2ba`.
The full-evidence digest is
`72da5098e108fc0386cc40aad2623973833f3e5d7fa4f3093b6c639e4b8ba3c8`,
using the explicit canonical serialization/exclusions recorded in the history.
Large logs/XML/full reports remain ignored; these compact outcomes survive them.

Final source hygiene checked tracked changes plus all new UTF-8/JSON/Markdown
files and links. The two ZIPs are intentional source archives, separately verified
against their immutable manifests; no audio/model/environment artifact was added.
`git diff --check` passed. No golden generator, commit, PR or deployment was run.

## Preservation and review

The [cumulative harness](../tools/harness/README.md) runs the declared npm build,
all recursively discovered active Node files and the entire Python test tree.
Structured Node assertions and pytest XML prove executed-file coverage. Prior
known failures stay nonzero; classification requires exact assertion evidence,
not just a matching name. Silent exclusions, skips, missing evidence, source
mutation and undocumented protected replacements fail the run.

The first immutable inventory retains test/helpers/fixtures, lab source, bridge,
diagnostics and archive tools in a SHA256-verified ZIP plus a versioned manifest.
Future additions append inventory versions; replacements require exact old/new
hashes, reviewer and reasons, with predecessor bytes retained. The ZIP is a
deliberately retained source archive, separately verified by the harness rather
than treated as a generic generated binary. Histories are tamper evidence against
accidental edits, not signatures against an attacker rewriting the entire repo.

The [retention record](RESEARCH-CODE-RETENTION.md) preserves 21 original programs
byte-for-byte, with safe configurable replay tools and compact evidence from 27
historical logs. Original inline commands without surviving source cannot be
recovered verbatim; the record states this limitation. Generated audio, weights,
environments and large logs remain ignored. Historical algorithm-7 snapshots are
[frozen before this cycle](../fixtures/history/algorithm-7/README.md).

Historical `documents/tests` mirrors are inventoried separately. Exact active
aliases are identified, but detached archives are explicitly unexecuted and are
not counted as independent passing coverage. Restoring their original contexts
is separate work. All previously active production and lab tests remain active.

Governance review checked root authority, all supporting governance documents,
references and the thin CLAUDE inheritance shim. A pre-existing raw-DSP ownership
description was corrected to `src/analyzer/`, with the worker remaining an adapter.
No playback/state/renderer or realtime ownership changed.

## Limits and checks not performed

No recorded-music generalization, new oracle/model training, independent final
holdout, long-track stage cost, quiet attacks over sustained beds, ramps or dense
attack chains were established. Raw flux strength remains uncalibrated across
gain/window/rate; fixed samples imply different physical spectral resolution.
The sample-power maximum is a localization heuristic. The 2x/30 ms gate and
sequential 15 ms suppression restrict recall. Consumer promotion remains blocked
on the broader [development method](ANALYZER-DEVELOPMENT-METHOD.md) evidence.

Browser/render/playback and physical Quest smoke were skipped because this cycle
adds an offline headless opt-in with no runtime integration; these results make
no physical XR timing claim. `diff_export.ps1` was skipped as unnecessary for this
local source review. Shell uses the existing lab venv directly because the bare
Python shim failed earlier; no installation fallback was used. Workspace-local
fresh temporary paths avoid the prior Windows pytest numbered-temp failure.
