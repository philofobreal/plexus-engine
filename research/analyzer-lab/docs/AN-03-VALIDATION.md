# AN-03: actual analyzer improvement from the existing tests

Owner: root, analyzer/shared optional transport/schema integration and testing.
The [experiment](AN-03-EXPERIMENT.md) used C2 as known development material, then
froze source for a new synthetic robustness matrix. Actual original DSP is in
`src/analyzer/PredictiveOnsets.ts`, invoked by the headless API's boolean
`predictiveOnsets` switch and returned as typed/validated
`TrackAnalysis.predictiveOnsets`. See the [feature contract](../../../documents/features/analyzer-predictive-onsets.md).

This cycle implements an analyzer improvement; it does not merely collect tests.
Ordinary algorithm-7/legacy v1 outputs remain available and unchanged. Candidate
acceptance for musical roles, visual impacts and XR targets remains a separate
consumer task, because this evidence has unconfirmed clip-start events and no
recorded-music/physical acceptance yet.

## Before/after on known C2 development material

The [final retained raw result](../fixtures/an03-development-03.json) checks
all PCM/truth identities against the immutable C2 record and recomputes actual
v1 output, requiring exactly the historical v1 timestamps. The
[score](../fixtures/an03-development-03.scores.json) recomputes maximum-cardinality
mir_eval matching at all original 10/20/25/30/50/70 ms tolerances. The reference
librosa output is reused from C2 only after exact PCM/truth/hash verification;
it is not rerun or reclassified as truth.

At 25 ms (truth / matched / FP):

| Family | Truth | V1 matched / FP | Predictive v2 matched / FP | Recorded librosa N512 matched / FP |
| --- | ---: | ---: | ---: | ---: |
| Isolated, four gains | 72 | 36 / 0 | **72 / 0** | 44 / 1 |
| 110 Hz bed plus noise/pluck | 144 | 0 / 24 | **144 / 48** | 142 / 62 |
| Dense six-attack sequences | 216 | 111 / 0 | **132 / 0** | 108 / 2 |

The 36 negative conditions retain the original 25.2 s exposure: v1 **38** hits,
v2 **1**, recorded librosa **430** under this configuration. The remaining v2 hit
is a smooth-ramp corner at 48 kHz/phase pi/3. This is a disclosed counterexample,
not removed evidence. Negative rates are 90.48/min versus 2.38/min over a very
short stress corpus, not population-rate estimates.

All 48 v2 mixture FPs occur at the clip start and carry `endpointAmbiguous=true`;
overall mixture precision under this protocol is still **0.75**, even with full
recall. They are not silently excluded, relabeled as true, or converted to XR
targets. The candidate stream cannot claim the proposed 0.98 XR precision gate.
After deliberate consumer abstention a different task must be measured separately.
Dense recall still misses **84/216**: sub-15 ms suppression and previous-attack
innovation in the history are unresolved losses. Improvements in one family do
not establish correctness across all rhythms or musical source identities.

Timing remains matched-only and tolerance-truncated. Across populated C2 conditions,
the largest individual-condition p95 at 25 ms matching is 12 ms; this is not a
pooled p95, excludes misses, and maximum-cardinality collision pairing is not a
minimum-error assignment. No physical timing guarantee follows.

## Frozen new synthetic robustness

After source selection, the [new raw matrix](../fixtures/an03-robustness-frozen.json)
and [scores](../fixtures/an03-robustness-frozen.scores.json) test 45 conditions:
fs 16/44.1/96 kHz; a 220 Hz background or 110+220+329 Hz polyphony; different
noise seed/envelope and 660 Hz attacks; two amplitudes, and sustain/ramp/AM/cutoff.
Exact detector SHA256 matches the final C2 development result:
`45534e7e0f232bff0fde918e49f53bc511dbba9b51af81afde7af3f1e320fc92`.
No detector/threshold change occurred after inspecting these cases.

At 25 ms, each mono/poly × noise/tone stratum has 18 truths. V1 matches **0/72**
overall, v2 **72/72**. V1 has 16 extra positive-condition predictions, v2 24;
these v2 extras are unconfirmed clip-start candidates, retained in the record.
The 21 negatives have 14.7 s exposure: v1 **27** hits, v2 **0**. This demonstrates
transfer to these changed synthetic conditions, not independent recordings or a
population false-positive bound. The same family becomes known regression material
after inspection and all cases now run as active tests.

## Development history and engineering checks

- [Revision 01](../fixtures/an03-development-01.json) and its
  [scores](../fixtures/an03-development-01.scores.json): all mixture/isolated
  attacks recovered, dense 132, seven negative hits (six cutoffs, one ramp).
- [Revision 02](../fixtures/an03-development-02.json) and its
  [scores](../fixtures/an03-development-02.scores.json): observed-continuation
  guard removes the six cutoffs; no threshold fitting or silent result replacement.
- Revision 03 publishes an explicit proposal anchor and matching property order;
  periodic rebasing/exact-silence reset removes spurious predictor coefficients
  caused by rolling floating-point cancellation. Sparse-silence assertions protect
  this fix. Exact source bytes for each measured development revision remain
  beside its result in `.json.sources/`.
- [First integration failure](../fixtures/history/an03-integration-first/failure.json)
  retains pre-fix core/test source. Two strict JSON roundtrip assertions initially
  failed on property order; all original assertions remain, with an added silence
  regression. Final targeted Node: **8 + 2 tests passed**. Independent Python
  actual-transport/schema: **7 passed**.

Tests cover an analytical sine recurrence, real sample/support clocks, impulse
phases and tiny tails, malformed PCM/rate/options/transport, boolean validation
before progress, deterministic output/no mutation, v1/default projection parity,
coexisting v1/v2 fields, one-to-one collision matching, full C2/new matrix quality
gates and a six-second later impulse over sustain across rolling rebases.

## Cost observations

The [retained cost profile](../fixtures/an03-cost-profile.json) uses isolated Node
children with the same 16 kHz generated PCM, excludes VM-loader startup from the
timed extraction and records before/after memory plus process RSS high-water.

| Duration | V1 extraction | V2 extraction | V2 later candidates / authored added hits |
| --- | ---: | ---: | ---: |
| 30 s | 727.46 ms | 175.65 ms | 6 / 6 |
| 180 s | not measured | 906.84 ms | 36 / 36 |
| 600 s | not measured | 3797.41 ms | 120 / 120 |

These are single observations, not replicated production benchmarks. The counts
alone do not prove timing/one-to-one correctness of the long profile. V2 600 s
observed array-buffer memory goes from 38,424,815 to 40,824,815 bytes; process RSS
high-water is 147,304 KiB including Node/TypeScript VM and input. Before/after
memory is not peak live DSP allocation. No browser, renderer or Quest budget claim.

## Preservation and cumulative validation

[Inventory v0004](../tools/harness/inventories/v0004.json) protects **419 files**,
all 135 active Node files and 21 active Python files; previous inventories/results
and 48 explicit historical-unexecuted mirrors remain unchanged. The only changed
pre-existing protected file is the additive transport schema. The
[reviewed migration](../tools/harness/migrations-an03-v4.json) verifies structural
identity with v3 after removing the new definition/property; old required fields
and v1 schema are unchanged. Both schema source versions remain in inventory ZIPs.
V4 archive SHA256:
`dda34c0db77f7d614838e86f0c4d65776dfa394f11a24186bddd040df080ad6e`.

The completed cumulative run is
[20261010T232048-477269f1f098](../tools/harness/history/20261010T232048-477269f1f098.json):
build **passed**, Node **1341 tests / 1332 passed / 9 failed**, Python **259 passed**.
All **135/135 Node** and **21/21 Python** active files executed, with no skips,
cancelled tests or todos. All nine failure signatures exactly match the previously
recorded Wormhole baseline; **unknown failures: 0**. The overall harness remains
**failed / exit 1** and does not mask those unrelated failures as success.
Both before/after inventory gates passed; `sourceChangedDuringRun=false`.

Independent verification recomputed the canonical full evidence hash, checked
the immutable history's matching evidence hash, all three log digests and the
pytest XML digest. Full evidence SHA256:
`118d37a75e68589ba27446ee6a901e35135a5778896804a60a3649cc2a17e5cb`.
The history file SHA256 is
`dff2798d68595c67cb03535e5b5acb2285b7cabf7050f188df58de6751a4acaa`.
Expected/executed Node-file digests are identical:
`1aff9b219692ec8a8a96708a08412cefaa2ef6e0f3165e28cc65fb248323b9f1`.
The frozen runtime/source identity covers 283 files, SHA256
`6a97b2db9311054ee22839a43eeb6233cefd9260dda285055a6b1fd09ae4043e`.
All measured final detector/integration source digests match the working code.
The final standalone inventory check passed at v4 with no issues. Text/JSON/link
hygiene review covered 55 source/support files and all five documentation files
with no issues; `git diff --check` passed. Documentation completion after the run
does not change the tested runtime or protected fixture identities.

## Reproduction and scope

From repo root, using existing Node 25.2.1/npm 11.6.2 and lab Python 3.12.14:

```powershell
npm run build
node --test tests/analyzer-predictive-onsets.test.mjs
node --test tests/analyzer-predictive-robustness.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_predictive_transport.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/an03-schema-unique-a
node research/analyzer-lab/diagnostics/measure-an03-improvement.mjs --output NEW_RAW_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03-improvement.py --input NEW_RAW_JSON --output NEW_SCORE_JSON
node research/analyzer-lab/diagnostics/measure-an03-robustness.mjs --output NEW_ROBUSTNESS_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03-robustness.py --input NEW_ROBUSTNESS_JSON --output NEW_SCORE_JSON
node research/analyzer-lab/diagnostics/profile-predictive-onsets.mjs --output NEW_PROFILE_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-an03-migration.py --root . --output NEW_MIGRATION_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/tools/harness/migrations-an03-v4.json --report research/analyzer-lab/.cache/an03-inventory-v4.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03-full-validation.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py check --report research/analyzer-lab/.cache/an03-final-check.json
git diff --check
```

Recorded measurement paths above already exist: use new `.cache/` paths for replay.
The migration recorder is deliberately tied to the v3 predecessor, not a blanket
permission for future replacements. Libraries/matching/environment remain the
existing pinned MIR setup; no installation, dependency fallback or model copying.
The existing venv is invoked explicitly to use its working research dependencies;
Node/npm are from PATH. No Bun/golden generator ran.

Manual source review covers model formula, cancellation/continuation semantics,
source freeze, complete denominators, endpoint uncertainty, optional API parity,
shared schema ownership and exact predecessor preservation. Browser/playback/Quest
smoke and annotated recordings were not run: consumers/playback are unchanged and
physical acceptance cannot be inferred from synthetic offline tests.
`diff_export.ps1` is skipped as unnecessary for this local bounded change.

Next development: distinguish continuous slope changes from attacks, improve
dense-event recovery without discarding close raw observations, then evaluate
independently annotated recordings and consumer-specific endpoint abstention.
Do not promote the current 0.75 unfiltered mixture precision to XR target quality.
