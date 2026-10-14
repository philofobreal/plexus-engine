# AN-03C: repeated weak attacks above predictable carriers

Owner: root, analyzer and shared optional transport/schema integration.
[Declared experiment](AN-03C-EXPERIMENT.md),
[implemented contract](../../../documents/features/analyzer-residual-onsets.md).
Actual new DSP is selected with
`options: {adaptiveOnsets: true, adaptiveOnsetVersion: 4}` and returned in the
existing `TrackAnalysis.adaptiveOnsets` field, ID `residual-innovation-v4`.
Absent selector preserves v3; default algorithm-7 accepted outputs are unchanged.
Activation is direct headless API/exporters only; browser worker and general lab
CLI do not forward this selector. No visual/chart/beat acceptance or product UI
enablement is inferred. No playback, state, grid/tempo or rendering changes.

## Known development material

[Final raw result](../fixtures/an03c-development-final.json) and
[scores](../fixtures/an03c-development-final.scores.json) cover **249 conditions**:
all 144 C2, 45 AN-03 and 60 AN-03B cases. Regenerated PCM/truth hashes match the
immutable historical results; actual v3 timestamps and source hash are recomputed
and required to match exactly. These inspected cases are development/regression
material, not independent holdout. Existing mir_eval maximum-cardinality scoring
retains 2/10/20/25/30/50/70 ms curves and original negative exclusions/exposure.

At strict **2 ms** (truth / matched / extra predictions):

| Family | Truth | V3 matched / extras | V4 matched / extras |
| --- | ---: | ---: | ---: |
| C2 isolated, all gains | 72 | 72 / 0 | 72 / 0 |
| C2 tone plus noise/pluck | 144 | 144 / 48 | 144 / 48 |
| C2 dense | 216 | 216 / 0 | 216 / 0 |
| Previous mono/poly AN-03 | 72 | 72 / 24 | 72 / 24 |
| AN-03B weak dense/silent | 144 | 86 / 12 | **144 / 12** |

Previously missed AN-03B carrier attacks improve **14/72 -> 72/72**; silent-bed
72/72 remains. Its 36 negatives/25.2 s improve **2 -> 0** (both 100 ms ramp corners
at 12 kHz). C2 36 negatives/25.2 s remain zero; AN-03 21 negatives/14.7 s remain
zero. The same matches/extras hold at 25 ms for these known cases. No gain is
claimed from changing truth, timestamp correction, deleting negatives or weakening
old tests. Clip-start extras remain ambiguous and counted, including all 48 C2
mixture extras: unfiltered precision there remains **0.75**, below the XR 0.98
proposal. Short synthetic exposure is not a population false-positive bound.

## Frozen new synthetic conditions

[Raw result](../fixtures/an03c-robustness-frozen.json) and
[scores](../fixtures/an03c-robustness-frozen.scores.json) cover **84 conditions**:
22.05/48 kHz; new seed/4 ms noise/1.3 ms decay, amplitudes .02/.06, gaps
7/14/28 ms, silent/137 Hz/137+251 Hz backgrounds. Total carrier amplitude .12 is
shared equally across components. Negative beating uses 137/140 Hz or
137/140/251/254 Hz; other negatives are sustain, 80/160 ms rises, 5 Hz AM and
cutoff with phases .37/1.1. All 48 negatives retain 33.6 s exposure after the same
[0,.1) exclusion. Matrix and constants were declared before inspecting results;
no DSP change followed inspection. This is synthetic transfer, not independent
recordings/generator-family validation or physical XR acceptance.

| New positive stratum | Truth | V3 matched / extras at 2 ms | V4 matched / extras at 2 ms |
| --- | ---: | ---: | ---: |
| Silent background | 72 | 72 / 0 | 72 / 0 |
| One carrier | 72 | 12 / 12 | **68 / 12** |
| Two carriers | 72 | 18 / 14 | **18 / 14** |

Overall strict 2 ms: **102/216 -> 158/216**, extras **26 -> 26**. At 25 ms:
**104/216 -> 160/216**, extras **24 -> 24**. Two additional paired polyphonic
predictions fall outside strict 2 ms; wider matching does not certify exact onset
localization. V4 still misses **58** at 2 ms / **56** at 25 ms. The new polyphonic
stratum has no improvement; the single-tone consistency gate deliberately falls
back rather than recreate the failed prototype's false-positive increase.
Negative hits remain **5 -> 5**, all polyphonic beating: 22.05 kHz phases .37 (one)
and 1.1 (two); 48 kHz each phase one. These stay as active counterexamples.

Unfiltered new positive precision at 25 ms is 160/184, about 0.87. No XR precision
gate is achieved. Timing is matched-only/tolerance-truncated; maximum-cardinality
dense pairing is not minimum-error assignment. No latency or population guarantee.
Frozen/final DSP SHA256:
`247ffab22e8f7b1ddcb24343ccba102eddf692955b699a665211571488096084`.

## Preserved development and verification

- [Revision 01](../fixtures/an03c-development-01.json) and
  [scores](../fixtures/an03c-development-01.scores.json): fixes all AN-03B misses/
  ramps and preserves C2, but one eligible local fit introduces 30 AN-03 negative
  hits and raises its positive extras 24 -> 76. Rejected as a precision regression.
- [Revision 02](../fixtures/an03c-development-02.json) and
  [scores](../fixtures/an03c-development-02.scores.json): three-block coefficient
  agreement restores AN-03 negatives/extras while keeping AN-03B gains. Final
  recognition constants/logic are these; final source additionally publishes
  exact clean/rolling provenance and fit support.
- Every measured version exclusively preserves exact source bytes beside its JSON
  in `.json.sources/`; earlier results/programs/tests/inventories remain unchanged.
- **Six targeted Node tests passed**: all known matrices at 2 ms and unchanged
  extras, analytical sine coefficient and actual model support, frozen partial
  transfer/negative cases, default/v3/v4 coexistence and invalid selector behavior
  before progress, malformed model/clock/support, no PCM mutation, determinism,
  real tiny tails and six-second sustained-history impulses across rebasing.
- **Eleven independent Python actual-transport/schema tests passed**, including
  authored dense timing, all six carrier attacks, required model provenance and
  malformed identity/count/fields. Original v1/v2/v3 assertions remain active.

## Cost observations

[Isolated-child profile](../fixtures/an03c-cost-profile.json), same 16 kHz generated
PCM, extraction time excludes loader and signal construction:

| Duration | V3 | V4 | V4 later candidates / authored hits |
| --- | ---: | ---: | ---: |
| 30 s | 199.81 ms | 341.67 ms | 6 / 6 |
| 180 s | unmeasured | 2061.27 ms | 36 / 36 |
| 600 s | unmeasured | 6311.74 ms | 120 / 120 |

Extra short-block fitting has a real cost. These are single observations, not
replicated production benchmarks or an extrapolated long v3 speed comparison.
Count agreement alone does not establish timing/one-to-one correctness of the long
profile. V4 600 s array buffers 38,424,815 -> 40,824,815 bytes, RSS high-water
149,192 KiB includes Node/VM/input. Before/after allocation is not peak live DSP
memory; no browser/renderer/Quest performance-budget claim.

## Preservation and cumulative validation

[Inventory v0006](../tools/harness/inventories/v0006.json) protects **623 files**,
137 active Node files, 23 active Python files, plus the 48 explicit historical
unexecuted mirrors. The only edited pre-existing protected file is the
[reviewed version-union schema migration](../tools/harness/migrations-an03c-v6.json).
Remove the new v4 definition and restore the original exact adaptive reference:
the JSON then equals the immutable v5 predecessor. Every old required field and
v1/v2/v3 definition remains unchanged; previous bytes remain in v5 ZIP. No
failure exclusion, silent snapshot replacement or lost predecessor/program.
V6 archive SHA256:
`70666f8adaee6b8fab8ecfc01bf607424fe3eb543a50d25d79119bc494481a84`.

Full cumulative run `20261011T030113-7d3321de7055` completed:

- Build passed (TypeScript and production Vite; existing large-chunk advisory).
- Node: **1353 tests, 1344 passed, 9 failed**; all **137/137** active files ran,
  no cancelled/skipped/todo cases and identical expected/executed file hashes.
- Python: **279 passed**, all **23/23** active files ran, no failures or skips.
- **Zero unknown failures**. The nine exact known Wormhole assertions remain:
  clip profile (4), geometry/LFO integration (1), preset differentiation (2),
  projected motion (2). Overall harness status is **failed, exit 1**; these failures
  remain visible rather than becoming an analyzer-specific success claim.
- Before/after inventory passed, no source changes during execution.
- Report and immutable summary share the independently recomputed full-evidence
  hash; command logs and pytest XML hashes were independently verified.

[Immutable run summary](../tools/harness/history/20261011T030113-7d3321de7055.json)
SHA256: `c46e770e55cab5d63aec729f398c74605611aa5f7c2a391ecfec9519aac7c260`.
Full-evidence SHA256:
`b5a78c019c11d77a8c20c90310f25bebe12b9f6921cc5413a1a1a03a6cb3d39c`.
Source identity (287 files):
`4d0d04c3f62d82fb7a24a8a8ea3473124ff7276a6afbaad600976ee89b7edd34`.
The detailed report/log/XML are retained in the lab cache; the history records
their identities and full-report hash. The compact history itself is not the
full report; its independent file hash is reported separately above.

Read-only hygiene review covered **101 changed/new files with zero issues**;
`git diff --check` passed. Final `regression.py check` passed with **623 files**,
inventory version **6**, zero issues, **137 Node / 23 Python** active files and
**48 historical unexecuted mirrors**; no active test is treated as historical.

## Commands and scope

From repo root, existing Node 25.2.1/npm 11.6.2 and explicit lab Python 3.12.14:

```powershell
npm run build
node --test tests/analyzer-residual-onsets.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_residual_transport.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/an03c-schema-unique-a
node research/analyzer-lab/diagnostics/measure-an03c.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03c.mjs --output NEW_FROZEN_JSON --frozen
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03c.py --input NEW_RAW_JSON --output NEW_SCORE_JSON
node research/analyzer-lab/diagnostics/profile-residual-onsets.mjs --output NEW_COST_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-an03c-migration.py --root . --output NEW_MIGRATION_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/tools/harness/migrations-an03c-v6.json --report research/analyzer-lab/.cache/an03c-inventory-v6.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03c-full-validation.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py check --report research/analyzer-lab/.cache/an03c-final-check.json
git diff --check
```

Recorded destinations already exist; use fresh NEW output/report/basetemp paths
for replay. The migration recorder is deliberately bound to v5. Existing pinned
MIR libraries are reused; no installation, dependency/model download or runtime
fallback, no golden regeneration, no external library source copying. Build runs
TypeScript and production Vite. Browser/playback/physical Quest and annotated
recordings were not run; optional offline candidate evidence cannot certify those
consumers. `diff_export.ps1` skipped as unnecessary for this local bounded change.
Manual review covers formulas, rounding, real support, model uncertainty, unchanged
default/v3 outputs, complete denominators and exact predecessor/schema preservation.

Next bounded development: a background model that represents multiple tones while
retaining these beating negatives and single-carrier gains. Then independent music
annotations and consumer-specific endpoint abstention are necessary before targets
are accepted automatically. Do not hide the current polyphonic misses in an average.
