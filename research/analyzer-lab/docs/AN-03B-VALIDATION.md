# AN-03B: actual adaptive attack-detector development

Owner: root, analyzer and shared optional transport/schema integration.
[Predeclared experiment and revisions](AN-03B-EXPERIMENT.md).
[Implemented API/units/model](../../../documents/features/analyzer-adaptive-onsets.md).
The new DSP is invoked by `analyzeAudio(...options: {adaptiveOnsets: true})` and
returned as `TrackAnalysis.adaptiveOnsets`, ID `adaptive-innovation-v3`.
V1, v2 and default algorithm-7 behavior remain independently available. Candidate
recognition improves here; no current consumer automatically promotes it to
musical source labels, visual impacts or XR notes.
Activation is through the direct headless API/diagnostic exporters: the normal
browser worker request and general lab CLI bridge do not forward this optional
flag. This cycle does not claim an enabled dashboard or XR product feature.

## Known development results

[Final measured integration](../fixtures/an03b-integration-validated.json) and
[scores](../fixtures/an03b-integration-validated.scores.json) cover all 144 C2 and
45 previously inspected AN-03 conditions. Each regenerated PCM/truth hash must
match the original record. Actual unchanged v2 timestamps are recomputed and
checked for exact identity. No retiming, changed truth/exposure or library-as-truth.
Scoring uses existing mir_eval maximum-cardinality matching, all previous
10/20/25/30/50/70 ms tolerances, plus strict **2 ms** for nearby event localization.

| Known family | Truth | V2 matched / FP at 2 ms | V3 matched / FP at 2 ms |
| --- | ---: | ---: | ---: |
| C2 isolated, all gains | 72 | 72 / 0 | 72 / 0 |
| C2 tone plus noise/pluck | 144 | 96 / 96 | **144 / 48** |
| C2 dense six-attack sequences | 216 | 132 / 0 | **216 / 0** |
| Previous mono/poly robustness | 72 | 72 / 24 | 72 / 24 |

At 25 ms, C2 mixture matches remain 144/144 for both versions, with 48 extras;
v3 corrects delayed pluck localization that wider matching previously tolerated.
The 36 original C2 negatives retain 25.2 s exposure: **1 -> 0 hits**. Previous
21 AN-03 negatives retain 14.7 s exposure: **0 -> 0**. These short synthetic
exposures are not population false-positive estimates. All 48 mixture extras are
uncertain clip-start candidates; unfiltered precision remains **0.75**, below the
proposed XR 0.98 gate. No silent filtering/relabeling or recording/XR acceptance.
Matched-only timing is tolerance-truncated; dense maximum-cardinality assignment
does not establish minimum-error timing or a physical latency bound.

## New frozen synthetic robustness: partial transfer

The [new raw result](../fixtures/an03b-robustness-frozen.json) and
[scores](../fixtures/an03b-robustness-frozen.scores.json) test 60 conditions:
12/32/88.2 kHz, six new seeded 3 ms noise attacks at 6/10/18/30 ms spacings,
silence or 173 Hz carrier; 100/300 ms linear rise, cosine rise, 7 Hz AM, sustain
and cutoff negatives with two phases. This matrix was declared before inspection.
All results stay visible; no DSP changes followed inspection.

At both 2 and 25 ms: **24/144 -> 86/144** matches, **12 -> 12** extras.
V3 finds **72/72** attacks over silence but only **14/72** over the carrier.
The long model-quality guard still masks repeated weak attacks on predictable
backgrounds. There are **58 misses**. The 36 negatives/25.2 s give **6 -> 2 hits**;
both remaining hits are 100 ms linear-rise corners at 12 kHz, phases .41/1.2.
The detector is an improvement in these conditions, not universal high recall or
perfect ramp rejection. Synthetic waveform/group dependence remains; no independent
recording generalization or physical Quest acceptance was measured.

Frozen DSP SHA256:
`d6d6632dd2db6eced6062783bd4e9e7d9eaa5087e156f222aa5a4ad9419d93c3`.
It matches final known-material measurement and the frozen matrix. Early frozen
source snapshots retain an incomplete transport-schema integration; schema fixes
below did not alter DSP, constants, timestamps or the frozen result. The validated
integration record captures the corrected final shared schema.

## Retained development/integration history

- [Revision 01](../fixtures/an03b-development-01.json),
  [scores](../fixtures/an03b-development-01.scores.json): local-only contrast and
  3 ms suppression recover all dense attacks, but raise mixture extras to 105
  and previous robustness extras to 93. This failed precision tradeoff is preserved.
- [Revision 02](../fixtures/an03b-development-02.json),
  [scores](../fixtures/an03b-development-02.scores.json): model-quality gate restores
  robustness extras to 24, but mixture extras remain 96 from pluck offsets.
- [Revision 03](../fixtures/an03b-development-03.json),
  [scores](../fixtures/an03b-development-03.scores.json): observed continuing
  innovation guard removes those offsets. Final core differs only in its explanatory
  comment/error identity, not constants or recognition logic.
- [Final core measurement](../fixtures/an03b-development-final.json) and
  [scores](../fixtures/an03b-development-final.scores.json) preserve that final DSP.
  All measured revisions exclusively preserve exact source copies in `.json.sources/`.
- [First schema failure](../fixtures/history/an03b-schema-first/failure.json)
  preserves invalid schema and unchanged Python assertions: nine tests exposed an
  unresolved definition reference after a formatting-preservation edit. Restoring
  the explicit definition made the payload tests pass.
- [Exact-migration failure](../fixtures/history/an03b-schema-migration/failure.json)
  preserves the intermediate schema: structural comparison independently detected
  an accidental extra root property. Removing it passed the exact predecessor
  gate; final **nine Python transport tests pass**. No assertions were weakened.
- [Intermediate integration raw record](../fixtures/an03b-integration-final.json)
  is retained with its pre-migration schema identity. The final validated record
  links the same DSP to the repaired strict contract.

Six targeted Node tests passed: all known matrices, strict timing/extra-event
gates, frozen partial transfer/counterexamples, deterministic/no-mutation behavior,
real tail/impulse clocks across rebasing, malformed PCM/rates/options/normalization,
default/false parity and coexistence of all three streams.

## Cost observations

[Isolated-child profile](../fixtures/an03b-cost-profile.json), same generated
16 kHz PCM, loader startup excluded from extraction:

| Duration | V2 | V3 | V3 later candidates / authored added hits |
| --- | ---: | ---: | ---: |
| 30 s | 179.21 ms | 191.57 ms | 6 / 6 |
| 180 s | unmeasured | 1022.18 ms | 36 / 36 |
| 600 s | unmeasured | 3285.04 ms | 120 / 120 |

Single observations, not replicated production/device benchmarks. Count agreement
alone does not establish one-to-one timing of these long cases. V3 600 s array
buffers go 38,424,815 -> 40,824,815 bytes; process RSS high-water 146,944 KiB includes
Node/VM/input. Before/after allocation is not peak live DSP memory. No browser/XR
budget or extrapolated long V2 speed-ratio claim.

## Preservation and cumulative validation

[Inventory v0005](../tools/harness/inventories/v0005.json) protects **534 files**,
136 active Node files, 22 active Python files; all earlier source/result versions
and 48 explicit historical-unexecuted mirrors remain. The only pre-existing
protected change is the [reviewed additive schema migration](../tools/harness/migrations-an03b-v5.json).
After removing only the v3 definition/property, JSON is exactly the v4 predecessor;
all original required fields and v1/v2 definitions are structurally unchanged.
Formatting is normalized and previous exact bytes remain in immutable ZIPs.
V5 source archive SHA256:
`a3dcb8ef3a89231932dd05e64b998d7b81fbb67aea95ebf830d9fdc5254a56cd`.

Completed cumulative run:
[20261010T234630-4b9608277aef](../tools/harness/history/20261010T234630-4b9608277aef.json).
Build **passed**, Node **1347 tests / 1338 passed / 9 failed**, Python **268 passed**.
All **136/136 Node** and **22/22 Python** active files executed with no cancelled,
skipped or todo tests. All nine failure signatures exactly match the pre-existing
Wormhole baseline; **unknown failures: 0**. The overall harness remains
**failed / exit 1**, preserving these failures instead of masking them as green.
Both inventory gates passed; `sourceChangedDuringRun=false`.

Independent verification recomputed the canonical full-evidence hash, checked
its identity in the immutable history, all three log hashes and pytest XML hash.
Full evidence SHA256:
`3a6d5bc57b470883d8475937a7e8f854b6627645bdfaa22d901ccb57f5c304ce`.
History file SHA256:
`5f68dc9512ca9707008758aa7927aafe46ed61c3fd750db98c456d207207f669`.
Expected/executed Node-path hashes agree:
`4592f799239b326a09d9193d15f8e5d5f104e62d752c865a098d0729f22d2796`.
Runtime/source identity covers 285 files, SHA256
`706a15be947c7a7fabbd0afc47c41c7bcc8b4624cd293f5c985e6a94fb17fb00`.
Final validated integration source hashes all match the current working code.
Source/text/JSON/link hygiene review covered 127 files with no issues, followed
by a final review of all five documentation files and `git diff --check`.
The final standalone inventory check passed at v5 with no issues.

## Reproduction and scope

From repo root with existing Node 25.2.1/npm 11.6.2 and lab Python 3.12.14:

```powershell
npm run build
node --test tests/analyzer-adaptive-onsets.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_adaptive_transport.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/an03b-schema-unique-c
node research/analyzer-lab/diagnostics/measure-an03b.mjs --output NEW_KNOWN_JSON
node research/analyzer-lab/diagnostics/measure-an03b.mjs --output NEW_FROZEN_JSON --frozen
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/score-an03b.py --input NEW_RAW_JSON --output NEW_SCORE_JSON
node research/analyzer-lab/diagnostics/profile-adaptive-onsets.mjs --output NEW_COST_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-an03b-migration.py --root . --output NEW_MIGRATION_JSON
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/tools/harness/migrations-an03b-v5.json --report research/analyzer-lab/.cache/an03b-inventory-v5.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an03b-full-validation.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py check --report research/analyzer-lab/.cache/an03b-final-check.json
git diff --check
```

Use NEW destinations/fresh basetemp for replay; recorded paths already exist.
Migration recorder is deliberately bound to v4, not blanket authorization for
later replacements. Existing pinned MIR libraries/environment are reused: no
installs, runtime fallbacks, model/source copying or golden regeneration. Exact
failed development/integration evidence is retained instead of overwritten.
Build includes TypeScript checking and production Vite bundling. Browser/playback,
physical Quest and recorded-music annotation were not run; this scope changes
offline optional candidate DSP/transport and does not establish consumer acceptance.
No renderer/state/audio lifecycle or grid/tempo changes; `diff_export.ps1` skipped
as unnecessary for this local bounded task. Manual review covers equations,
support/clock/units, uncertainty, baseline preservation and honest denominators.

Next bounded problem: recover repeated weak attacks on a predictable carrier
without reintroducing offset/polyphony false positives; retain the two faster-ramp
counterexamples. Then independently annotated music and consumer-specific endpoint
abstention are required before promoting these candidates to accepted targets.
