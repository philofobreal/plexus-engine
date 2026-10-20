# AN-03D: confirmed fixed-difference evidence above multiple tones

Owner: root, offline analyzer and shared optional type/normalizer/schema integration.
[Declared experiment](AN-03D-EXPERIMENT.md),
[implementation contract](../../../documents/features/analyzer-difference-onsets.md).
Actual DSP selector: `adaptiveOnsets: true, adaptiveOnsetVersion: 5` in direct
headless `analyzeAudio()`. Existing adaptive output field, new algorithm ID
`confirmed-difference-v5`. Default algorithm-7 outputs, absent-selector v3,
explicit v4 and v1/v2 companions remain compatible. Browser worker/general lab
CLI do not forward this option. No accepted beat/chart/visual event promotion.

## Known development

[Final raw results](../fixtures/an03d-development-final.json) and
[scores](../fixtures/an03d-development-final.scores.json) cover **333 conditions**:
C2 144, AN-03 45, AN-03B 60, AN-03C 84. All regenerated PCM/truth hashes and
actual v4 timestamps match retained predecessor results; the v4 source identity
is checked exactly. These now-inspected conditions are development/regression,
not independent holdout. Original mir_eval maximum-cardinality one-to-one matching
retains 2/10/20/25/30/50/70 ms curves, every initial extra and [0,.1) negative
exclusion. No retiming, tolerance loosening or hidden denominator change.

Strict **2 ms** results (same known counts at 25 ms except previous AN-03C):

| Family | Truth | V4 matched / extras | V5 matched / extras |
| --- | ---: | ---: | ---: |
| C2 isolated | 72 | 72 / 0 | 72 / 0 |
| C2 mixture | 144 | 144 / 48 | 144 / 48 |
| C2 dense | 216 | 216 / 0 | 216 / 0 |
| AN-03 mono/poly | 72 | 72 / 24 | 72 / 24 |
| AN-03B weak attacks | 144 | 144 / 12 | 144 / 12 |
| AN-03C new carrier/density cases | 216 | 158 / 26 | **216 / 24** |

All **648 earlier truths remain matched**, then AN-03C improves by **58 matches**
at 2 ms (at 25 ms 160 -> 216). Its two extra localization errors disappear;
24 ambiguous clip-start extras remain. AN-03C negative hits **5 -> 0** over
33.6 s; C2 25.2 s, AN-03 14.7 s and AN-03B 25.2 s negatives remain zero.
For AN-03C specifically, silence/one carrier/two carriers now each **72/72**;
old v4 was 72/68/18 at 2 ms. C2 mixture's unfiltered precision is still 0.75.
Known total precision 864/(864+108) is about 0.889, below the proposed XR 0.98
gate. Ambiguity is recorded, not silently excluded. Zero short synthetic
negative hits is not a population false-positive guarantee.

## Frozen new synthetic transfer

[Raw results](../fixtures/an03d-robustness-frozen.json) and
[scores](../fixtures/an03d-robustness-frozen.scores.json), **96 conditions**:
11025/44100 Hz, silence/two/four carriers (191/337/503/719 Hz), different seed,
six noise/pluck starts, gaps 9/17 ms, amplitudes .015/.05. Negatives include
6 Hz AM, 60/180 ms rises, paired beating tones and removal of one source while
others continue. Matrices were declared before source selection; no DSP tuning
followed inspection. These are same-family synthetic transfer, not independent
recordings or physical musical/XR acceptance.

| New positive stratum | Truth | V4 matched / extras at 2 ms | V5 matched / extras at 2 ms |
| --- | ---: | ---: | ---: |
| Silence / noise | 48 | 48 / 0 | 48 / 0 |
| Silence / pluck | 48 | 10 / 0 | **38 / 0** |
| Two carriers / noise | 48 | 8 / 8 | **48 / 8** |
| Two carriers / pluck | 48 | 6 / 8 | **16 / 8** |
| Four carriers / noise | 48 | 10 / 9 | **48 / 8** |
| Four carriers / pluck | 48 | 2 / 8 | **19 / 8** |

Overall strict 2 ms **84/288 -> 217/288**, extras **33 -> 32**; at 25 ms
**85/288 -> 217/288**, extras **32 -> 32**. All **144 noise attacks** match;
only **73/144 plucks** match. **71 misses remain**, explicitly per stratum.
All 32 v5 positive extras are clip-start ambiguous. Unfiltered new positive
precision 217/249 is about 0.871, still below the XR proposal.

New negatives **6 -> 6** over **33.6 s**. Every hit is source removal: both
phases/rates with two carriers, and both phases at 44.1 kHz with four carriers.
Rise/AM/sustain/beating are zero in this finite matrix. These six discontinuity
counterexamples stay active; fixed filtering cannot on its own decide whether a
source discontinuity is an intended added musical attack. Timing statistics are
matched-only/tolerance-truncated; maximum-cardinality dense matching does not
minimize error or prove population tails, causal latency or authored chart quality.

Frozen/final DSP SHA256:
`a2914d0c5555ffbef70405c87811809b7e25389aa768dd49d1ba07a99ac38bf2`.

## Retained development and targeted verification

- [Revision 01](../fixtures/an03d-development-01.json) and
  [scores](../fixtures/an03d-development-01.scores.json): direct filter with long
  historical innovation guard. Keeps negatives/dense/isolated, but misses C2
  soft attacks and repeated attacks (AN-03B 84/144, AN-03C 96/216). Rejected.
- [Revision 02](../fixtures/an03d-development-02.json) and
  [scores](../fixtures/an03d-development-02.scores.json): recent-only contrast fixes
  all AN-03B/AN-03C attacks and beating; still misses C2 plucks and introduces
  nine AN-03 tone-ending extras. Rejected.
- [Revision 03](../fixtures/an03d-development-03.json) and
  [scores](../fixtures/an03d-development-03.scores.json): lower rate-scaled floor
  1e-7*(8000/fs)^4 recovers soft attacks, but C2 extras rise 48 -> 60, AN-03
  24 -> 59; negatives C2 2, AN-03B 8, AN-03C 7. Rejected precision regression.
- [Revision 04](../fixtures/an03d-development-04.json) and
  [scores](../fixtures/an03d-development-04.scores.json): restored floor plus v4
  peak-confirmed soft proposals preserves old truths, but nine AN-03 ending extras
  remain. Rejected.
- [Revision 05](../fixtures/an03d-development-05.json) and
  [scores](../fixtures/an03d-development-05.scores.json): direct branch requires
  continuing filtered evidence above the same relative floor beyond four-sample
  memory, removes those nine extras and passes all known development gates.
  Final recognition logic/constants match this revision; final source adds typed
  API integration and a consistent conservative endpoint margin.
- Every measured revision exclusively saves exact source bytes in `.json.sources/`.
  V4 DSP/type helpers are unchanged. No previous result/program/test is deleted.
- **Six final targeted Node tests passed**: 864 authored truths at 2 ms with exact
  extras, analytic FIR response, soft confirmation source, all frozen partial
  outcomes/negative counterexamples, default/v3/v4/v5 projections, JSON round trip,
  invalid selector before progress, both source-specific supports, bad clock/model,
  input mutation/determinism, rebasing and real one/two/four/five-sample tails.
- **Twelve independent Python actual-transport/schema tests passed**, including
  all six authored polyphonic attacks within 2 ms and malformed filter/provenance/
  evidence fields. Relational clocks/supports are tested by the Node normalizer;
  JSON Schema alone checks structural values.
- The initial targeted Node run had five passes and one test-code failure from an
  outer index shadowed by a sample index. Its [original source](../fixtures/an03d-targeted-test-initial.mjs.txt)
  and [failure record](../fixtures/an03d-targeted-initial-validation.json) are retained,
  inert and not claimed as active coverage. Only the test time expression was
  corrected; DSP/frozen scores were unchanged. All six tests then ran successfully.

## Observed cost

[Isolated-child profile](../fixtures/an03d-cost-profile.json), 16 kHz identical
generated PCM, timing includes v5's internal v4 extraction and confirmation,
excludes signal construction/loader:

| Duration | V4 | V5 | V5 later candidates / authored hits |
| --- | ---: | ---: | ---: |
| 30 s | 357.91 ms | 557.72 ms | 6 / 6 |
| 180 s | unmeasured | 7987.95 ms | 36 / 36 |
| 600 s | unmeasured | 42024.41 ms | 120 / 120 |

The combination costs more; these single observations do not support a replicated
production/long-v4 speed ratio or fixed per-second guarantee. Long-profile count
agreement is not one-to-one timestamp verification. V5 600 s array buffers
38,424,815 -> 43,224,815 bytes, RSS high-water 155,124 KiB includes Node/VM/input.
Before/after memory is not peak live DSP. Browser/renderer/Quest budgets remain
unmeasured. No speed improvement is claimed or physical precision inferred.

## Preservation and cumulative gate

[Inventory v0007](../tools/harness/inventories/v0007.json) protects **743 files**;
138 active Node files, 24 active Python files and 48 historical unexecuted mirrors.
[Reviewed migration](../tools/harness/migrations-an03d-v7.json) verifies only two
pre-existing protected replacements against retained exact v6 ZIP:
add one v5 schema definition/reference (reversal yields identical v6 JSON), and
change only the old unsupported-selector example 5 to 6 because 5 is now supported.
Every other old assertion/definition remains unchanged; new tests cover supported
5 and unsupported 6 explicitly. This is an intentional feature-contract change,
not exclusion of an unexplained failure. V1/v2/v3/v4 sources and required fields
remain preserved. Archive SHA256:
`90ff5a5dd6f4a735d19da42876913c8d410ade0b86ba6307964cb3af3ade6f19`.

Full cumulative run `20261011T033917-b52c9ac0fe84` completed:

- Build passed TypeScript and production Vite (existing chunk advisory).
- Node **1359 tests: 1350 passed, 9 failed**; all **138/138** active files ran,
  matching expected/executed file hashes, no cancelled/skipped/todo cases.
- Python **291 passed**, all **24/24** active files ran, no failures/skips.
- **Zero unknown failures**. The nine exact known Wormhole assertions remain:
  clip profile (4), geometry/LFO integration (1), preset differentiation (2),
  projected motion (2). Overall harness **failed, exit 1**; the known failures
  remain visible and are not masked as an overall success.
- Before/after inventory passed with zero issues, source unchanged during run.
- Full-report evidence hash independently recomputed and matched immutable
  history; command-log hashes and pytest XML identity independently verified.

[Immutable history](../tools/harness/history/20261011T033917-b52c9ac0fe84.json)
SHA256: `125202dbd526ef188b50a4e2744ddfb1e826ddf692c23f0860305709849c8cb2`.
Full-evidence SHA256:
`0b8306a71a1a5b7b529b6fdc98ffd1e4b58055d4e316855fc8d344beb166922e`.
Source identity (289 files):
`a3cd29e47beb63e64ce88fd5ecde564be526ac2300fbb863208a043357cad574`.
Detailed report/log/XML are retained in the lab cache, with identities recorded
by immutable history. Its independent file hash above is distinct from the full
report hash; the compact summary alone does not reproduce the full report bytes.
Read-only hygiene review covered **134 changed/new files, zero issues**;
`git diff --check` passed (only an informational future LF-to-CRLF Git warning
for the schema). Final `regression.py check` passed: inventory **v7**, **743 files**,
zero issues, **138 Node / 24 Python** active files, **48 historical unexecuted
mirrors**. No active file is counted as historical or omitted from execution.

## Exact commands and scope

From repo root, existing Node 25.2.1/npm 11.6.2 and explicit Python 3.12.14:

```powershell
npm run build
node --test tests/analyzer-difference-onsets.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_difference_transport.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/an03d-schema-unique-a
node research/analyzer-lab/diagnostics/measure-an03d.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03d.mjs --output NEW_FROZEN_JSON --frozen
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03d.py --input NEW_RAW_JSON --output NEW_SCORE_JSON
node research/analyzer-lab/diagnostics/profile-difference-onsets.mjs --output NEW_COST_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-an03d-migration.py --root . --output NEW_MIGRATION_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/tools/harness/migrations-an03d-v7.json --report research/analyzer-lab/.cache/an03d-inventory-v7.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03d-full-validation.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py check --report research/analyzer-lab/.cache/an03d-final-check.json
git diff --check
```

Recorded outputs/basetemp already exist: replay with fresh NEW paths, never reuse
pytest basetemp. Migration recorder is deliberately bound to v6. Existing pinned
MIR deps reused; no installs, library/model downloads, runtime fallback or golden
refresh. Build passed TypeScript and Vite (existing chunk advisory); final targeted
Node output is retained in `.cache/an03d-node-targeted-final.log`.
Manual review covers filter math, sample rounding, finite evidence units, both
real support branches, original defaults and exact predecessor preservation.
No browser/playback/annotated recordings/physical headset runs; this diagnostic
candidate change cannot certify those consumers. `diff_export.ps1` unnecessary
for this local bounded change; skipped.

Next bounded task: source-removal versus added-attack evidence and repeated soft
tonal attacks above bright carriers, retaining every current gain/counterexample.
Consumer-specific boundary abstention and independently annotated music must
precede accepted choreography/dramaturgy/XR targets.
