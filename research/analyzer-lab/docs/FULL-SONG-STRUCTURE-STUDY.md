# Full-song external structure study - T13f

Date: 2026-10-28 (Europe/Budapest). Owner: integration; research tools and evidence only.
The user authorized completing all subtasks of this study without intermediate pauses. The
earlier T12c/2 handoff remains historical evidence; it did not run external structural models.

## Question and fixed protocol

Compare complete No Good, GoA and Scienide recordings with the current Plexus structure, using
two actual pretrained external families. Do not score the T12c selector against its own features
again. Do not tune on excerpts, shift clocks to improve scores or treat agreement as truth.

- Every provider starts from the same channel-0, 44.1-kHz float32 PCM, with original song time.
  The lossless FLOAT WAV preserves those bytes. Internal model resampling/separation is declared
  model preprocessing. In particular, the All-In-One separator receives a mono projection;
  this is a controlled-input comparison, not a claim of optimal native-stereo model accuracy.
- Compare **all internal section boundaries** and **label-changing boundaries** separately.
  Repeated equal-label subdivisions can be structurally meaningful but are not functional
  changes. Track start/end do not count as successful boundary predictions.
- One-to-one ordered assignment maximizes match count, then minimizes total absolute error.
  Report fixed 0.5 / 1 / 3 second tolerances, unmatched predictions and both denominators.
  These are agreement precision/recall/F1, never annotated accuracy.
- Form external consensus only from the two external families within 1 second. An ensemble's
  eight folds count as one family. Plexus cannot vote for its own reference. Confidence is null
  and groundTruthStatus is false; the midpoint retains both contributing times.
  A shared function-changing boundary means each classifier changes its own label there,
  not necessarily to/from the same named function.
- Record only literal shared label spellings. Chorus is not automatically a drop, bridge is
  not automatically a break/build, and no external label is silently converted to peak.
  Report noncomparable duration rather than calling it correct or incorrect.
  Even identical spellings do not establish identical ontology: Plexus currently uses verse
  as a continuing-body/ambiguous-role fallback, while the learned models have inst and other
  categories. Literal overlap is a descriptive spelling statistic, not semantic accuracy.
- Require full contiguous coverage and exact decoded PCM identity. Preserve raw endpoints;
  at most 0.25 seconds of terminal frame quantization may be normalized for interval comparison,
  with its signed delta reported. Reject failed, cropped, wrong-clock or wrong-input results.
- Supplement structural comparison with All-In-One beat-grid agreement at 70/150 ms and
  downbeat agreement at 150/500 ms. SongFormer supplies no beat/downbeat grid in this API, so
  its unsupported capability remains null. This is a single-family metrical diagnostic, not
  two-model beat consensus or an annotated timing-accuracy score.
- Inspect the actual generated scene-entry cue cohort separately: planned pre-anchor times and
  published numeric cue times against the same external boundary reference. Do not confuse the
  raw section grid with the already cue-aligned plan. Internal structure/evolution cues are
  intentionally not macrosection boundaries; particle/geometry arrival is not measured here.
  This is the same surviving published scene-entry cohort in both timing columns; omission
  of other original proposals is reported separately and is not counted as retained success.
  Report cue agreement against BOTH all shared boundaries and the shared function-changing
  subset. An equal-label phrase subdivision must not earn credit as a functional scene change.
  The latter requires a label change in each external family, without translating the labels.

## Models, sources and rights boundary

| Family | Actual selection | Fixed artifact identity | Evidence / scope |
| --- | --- | --- | --- |
| All-In-One | all-in-one-infer 3.1.0, harmonix-all (8 folds), HTDemucs preprocessing | taejunkim/allinone revision 379e5fd010b3fdd0ee8381ff8cbcfa51d70b5c19; checkpoint SHA256s in the run | Original learned model via a modern CPU-compatible inference port; one family vote |
| SongFormer | Official integrated model.safetensors, default 420-second global + 30-second local representations | ASLP-lab/SongFormer revision a75880ed1b7375ac71860ec6c4fc9c899cf99515; SHA256 8dcabf4ea19973edd51b9e5794004775fa7e8de3ecfa07eb1dbce00f516ce7f7 | Reviewed local source; all checkpoint parameters must load without missing/unexpected/mismatched keys |

Primary sources checked on the study date: [original All-In-One](https://github.com/mir-aidj/all-in-one),
[inference port](https://github.com/openmirlab/all-in-one-infer),
[All-In-One model card (MIT)](https://huggingface.co/taejunkim/allinone),
[SongFormer code](https://github.com/ASLP-lab/SongFormer),
[SongFormer checkpoint](https://huggingface.co/ASLP-lab/SongFormer),
[MuQ checkpoint (CC-BY-NC-4.0)](https://huggingface.co/OpenMuQ/MuQ-large-msd-iter).
SongFormer's repository CC-BY-4.0 notice does not override the integrated MuQ checkpoint's
noncommercial terms or supply a separate verified grant for every combined artifact. The study
keeps external weights, source copies and raw outputs in ignored local research storage. No
weights, source separation engine, pretrained embeddings, label targets or remote inference
service enter the shipped product. No commercial model-use permission is inferred here.

The representations/model families differ, but their postprocessing has related All-In-One
ancestry and their training/genre coverage may overlap. Agreement is therefore not two perfectly
independent witnesses, nor can this unannotated three-song set establish general precision.
No audio upload, new training, model distillation or source-code port into production is performed.

## Reproduction and retention

Use the isolated Python 3.11.15 CPU environment. Root Node/npm remains 25.2.1/11.6.2; no runtime
package or root dependency change. Actual full package versions are embedded in each prediction
report; the environment snapshot and upstream source hashes are retained under logs/t13f/.
Prepare the reviewed model snapshot explicitly; the runner never enables an automatic provider
in the lab registry. Source/audio/model artifacts remain local and ignored.
The model-only CPU package snapshot is [requirements.txt](../providers/structure/requirements.txt).
It records the actual selected model environment, including SciPy 1.17.1; it does not replace
the lab's separate canonical requirements.validation.txt/core pins. Reconstruct it in a separate
providers/structure/.venv with Python 3.11, then install that requirements file. The study's
existing lab checkout registration used --no-deps and did not silently change scientific packages.

From the repository root, with the prepared research environment:

```powershell
research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/run-full-structure.py --provider allinone --audio TRACK1 TRACK2 TRACK3 --threads 3 --output NEW_AIO_DIRECTORY
research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/run-full-structure.py --provider songformer --model-dir REVIEWED_LOCAL_SNAPSHOT --audio TRACK1 TRACK2 TRACK3 --threads 3 --output NEW_SONGFORMER_DIRECTORY
node research/analyzer-lab/diagnostics/compare-full-structure.mjs --manifest INPUT.json --output NEW_COMPARISON.json
research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/plot-full-structure.py --input NEW_COMPARISON.json --output NEW.png
node --test tests/full-structure-comparison.test.mjs
```

The comparison manifest contains recordings with name, capture (the retained Plexus
*.source.json path), and two oracles entries {path: predictions.json, index: track index}.
Output paths are exclusive; prior captures/reports are never overwritten. Both failed download
attempts and initial test failures are retained separately from final acceptance evidence.
The first model runs use the retained logs/t13f/runner-first.py identity. The final runner adds
an early request receipt, its own source hash and finite-PCM/1..420-second SongFormer guards
without changing this cohort's inference. All three full songs fit that validated single global
window; longer recordings are rejected, never silently cropped. This avoids claiming validation
of upstream multi-window/tiny-tail edge cases that this study did not exercise. Resource scheduling
may suspend/resume a worker without resetting its computation; elapsed wall time includes that
pause and concurrent regressions, and is not a hardware/model-speed comparison.

## Research bridge repair

Restoring actual Python execution exposed a pre-existing loader mismatch: the bridge allowed
src/analyzer only, although the current analyzer legitimately imports src/types/musicEvents.ts
runtime constants. It now allows precisely the analyzer and dependency-light shared-types roots,
while retaining external-package and other-subsystem rejection. This changes research execution,
not the analyzer, worker, clock, DTO or browser behavior. Predecessor Git blob:
999230386f8adf141785f5b5ce389a1869b5f51d (source commit 0b78612); retained local copy:
logs/t13f/bridge-before.mjs. Existing tests and protected results are unchanged.

The first Python run also preceded editable lab registration, so a subprocess-provider test
could not import the lab package. Installing the existing lab with --no-deps fixes environment
registration without changing scientific dependencies. Final cumulative validation is rerun
after these repairs; the initial failed run is not relabeled as acceptance.
The first isolated provider recheck also hit exactly 260 path characters because of the chosen
long pytest temporary directory name. An extended-path probe proved the cause; using the shorter
workspace-local logs/t13f/pt test directory resolves it without changing provider behavior or
rewriting the existing test. Its normal-path failure and extended-path probe are retained.

## Completed result and decision

Both families completed all three entire songs. All six PCM hashes match the original captures;
the SongFormer loading report has no missing, unexpected or mismatched checkpoint parameters.
No inference was replaced by a synthetic fixture or language-model guess. The first model runs
retain their original source identity; later wrapper guards/receipts do not change that inference.

| Recording (duration) | Plexus / All-In-One / SongFormer sections | Shared raw / function-changing boundaries | Plexus raw matches at 0.5 / 1 / 3 s |
| --- | --- | --- | --- |
| No Good (410.594 s) | 36 / 27 / 29 | 21 / 4 | 0 / 12 / 18 of 35 vs 21 |
| GoA (365.768 s) | 32 / 22 / 25 | 15 / 3 | 5 / 5 / 6 of 31 vs 15 |
| Scienide (350.460 s) | 30 / 27 / 27 | 23 / 2 | 13 / 19 / 23 of 29 vs 23 |

| Recording | Beat-grid agreement F1 at 70 / 150 ms | Downbeat matches at 150 / 500 ms (Plexus / external count) |
| --- | --- | --- |
| No Good | 0.97069 / 0.97789 | 0 / 0 (243 / 244) |
| GoA | 0.84337 / 0.88927 | 0 / 207 (226 / 209) |
| Scienide | 0.81888 / 0.82781 | 85 / 175 (216 / 176) |

No Good's strong beat-period agreement does not establish correct meter phase: first downbeats
are 1.0449 vs 0.21 s, approximately half a bar apart. This is a reference-relative phase issue,
not evidence of a drifting AudioContext clock. Other recordings do not support applying the same
constant shift everywhere. A grid intentionally extrapolated through quiet spans also need not
have the same event count as a learned tracker that abstains there. These are not accuracy scores.

| Recording | Proposed / published / omitted scene entries | Noninitial paired cohort | Raw-reference matches planned -> published, at 0.5 / 1 / 3 s |
| --- | --- | --- | --- |
| No Good | 36 / 15 / 21 | 14 | 0->4 / 4->4 / 7->8 |
| GoA | 32 / 17 / 15 | 16 | 3->3 / 3->3 / 3->3 |
| Scienide | 30 / 16 / 14 | 15 | 10->2 / 14->11 / 14->14 |

At 1 s the published cohort matches only 1/4, 1/3 and 1/2 of the smaller joint function-changing
reference sets. These references are sparse prediction agreements; not every intentional visual
scene must correspond to one. Most label time is not comparable even by spelling: No Good has
369.86 / 337.93 unknown seconds against the two families, GoA 317.44 / 273.05, Scienide
286.48 / 234.80. Reporting overall functional-label accuracy would be misleading.

All surviving scene-entry moves are forward; median displacement is 0.627 / 0.302 / 0.139 s.
The source explains this asymmetry: alignAutomationToCues enforces cuePlacement.start as a lower
ownership bound, and a scene-entry proposal starts exactly there. It cannot correct an earlier
candidate across that approximate detected boundary. Small moves can cross a tolerance edge,
as in Scienide; no universal superiority or blanket rollback follows from these three cases.

The next bounded PRODUCT correction should separate uncertain measured structure/meter phase
from hard cue ownership, retaining locked/manual points and deterministic clocks. Use original
multifeature/recurrence evidence; do not hardcode these track times or import chorus as drop.
The separate note-source problem still needs qualified acoustic-event selection: T12c local
band changes are not drum/vocal/dominant-source identity. Do not extend this into another broad
model-research loop or pretend the pulse grid itself must be globally retuned.

This study closes with no production threshold/label/tempo changes. The delivered code repairs
research execution and makes the comparison reproducible, bounded and explicit about unsupported
evidence. Existing T12c gameplay, Wall Off, cockpit default Off and MVP/XR Offscreen remain.
All model/source/audio/figure artifacts stay outside the public application build.

The upstream SongFormer emits invalid-divide warnings while dividing unused zero-count padded
logit bins before slicing to the populated length. Each of these songs uses one <420 s window;
the populated prefix has counts, and the unused tail is discarded before postprocessing. No
warning was suppressed or value imputed. Returned intervals are finite, contiguous and pass
the declared endpoint/clock validation. This does not validate other upstream window-edge cases.

Validation: complete Python341/341, the original cumulative Node1935/1926 pass/9 exact retained
baseline failures, and 14/14 final targeted observers. A second cumulative Node run checks the
final cue/function distinction; its exact names/messages and final build, graph, source/push and
public release receipts are retained in logs/t13f/handoff.json. All 259 predecessor Node test/
helper/fixture identities are unchanged; 202 active Node files / 260 identities now include the
eight-case structural observer. No Python test source changed. The standalone figure was visually
reviewed; it is not browser/headset or human listening acceptance. Fixed seeds do not constitute
an end-to-end bitwise repeat-inference guarantee. Training-set contamination is unverified.

The final observer comment review clarified spelling versus ontology; its new report's numerical
results exactly equal the inspected figure's input. Earlier reports/failures remain separate.
See the [current tracker](../../../documents/audits/xr-development-tracker.md#current-continuation-checkpoint---t13f-full-song-structure-study-2026-10-28)
for continuation. Stop after commit/push/guarded deploy for the user's review of this completed task.

## Local artifact identities

These are retained local receipts, not redistributed audio/models or training labels.

| Artifact | SHA256 |
| --- | --- |
| logs/t13f/aio-full/predictions.json | 581c50652796a862affb08c4198adc8595ae535e0e60507d8cf6f06694e68114 |
| logs/t13f/songformer-full/predictions.json | ea0d16583b406e5c05b1f570aa95831c24bedd07c2401bbee28743e5ad2c1633 |
| logs/t13f/comparison-accepted.json | e7477ac8cefdc49bee1344375a4acf000a677a2736944cb4af519af25475d892 |
| logs/t13f/structure-comparison.png | a1f35f6ad5111df5a9862fc238712c60aa40bd79aeb22f27fcc5b37fd9d357eb |

## Product follow-up - T13g (2026-10-28)

The accepted study is retained above without rewriting its findings. The next bounded product
correction now distinguishes an estimated scene start from protected cue ownership. Existing
accepted structural anchors can refine an entry on either side using stronger sustained contrast
in at least two published feature projections. Exact clock/coverage and hard neighbour limits
are required; single attacks, one projection, missing evidence and user-owned points cannot
authorize it. No source separation, model labeling, meter retune or new detected event is implied.
The complete policy and uncalibrated margins are in
[ADR-005](../../../documents/adr/ADR-005-visual-os-style-system.md#addendum-estimated-scene-entry-refinement---t13g-2026-10-28).

All three full PCM analyses were captured before the code correction, reproducing the earlier
T12c plans exactly. Exact-analysis replay then changes only cue publication. All six external
outputs and all older studies/tests remain immutable. New local artifacts live in logs/t13g:
*-before.json / *-after-final.json contain the full feature-clock analysis, PCM/analysis identities,
implementation hashes and published plan; comparison-before.json / comparison-after-final.json reuse
the same T13f raw AND label-changing external references at 0.5/1/3 seconds. source-parity.json
checks previous plans/PCM, summary.json reports changing and common cohorts, and handoff.json
records final checks/release. No model reinstall/inference was performed in this follow-up.

Published entry coverage increases 15->19 / 17->18 / 16->18 including the opening state; 4/1/2
omitted proposals recover and 0/0/3 existing entries move. All ten selected refinements happen
to be earlier on these tracks, but the policy is symmetric and its later-change regression passes.
Raw-reference matches at 0.5 seconds increase 4->5 / 3->3 / 2->5; jointly label-changing matches
do not increase at any tolerance. Added unmatched entries reduce precision in some comparisons;
do not claim a universal accuracy/F1 gain, use matched-only errors as whole-cohort accuracy, or
silently drop those recovered points to improve a score. The original rule uses no external
times/labels, and all raw sections/labels/beats/barStarts remain identical. Wider structure and
meter-phase uncertainty remains unresolved. Detailed measurements and next-work boundary are in
the [T13g tracker](../../../documents/audits/xr-development-tracker.md#current-continuation-checkpoint---t13g-scene-entry-refinement-2026-10-28).
