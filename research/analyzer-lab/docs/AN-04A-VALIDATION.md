# AN-04A — persistent source and musical-motif hypotheses

Date: 2026-10-14 (Europe/Budapest). Integration owner: Codex / root.
Scope: pure offline analyzer/types/semantics, authored fixtures, diagnostics and
cumulative regression. [Protocol](AN-04A-EXPERIMENT.md),
[product contract](../../../documents/features/analyzer-musical-entities.md).

## Implemented behavior

- `HarmonicTimbre.ts`: actual PCM descriptor with explicit support, bandwidth,
  supplied-F0 and floor conditions.
- `MusicalEntityTracker.ts`: independent dynamic source/motif registries,
  immutable first anchors, reentry association, transposition/time scaling,
  ambiguity alternatives and unresolved-mixture abstention.
- `musicalRelations.ts`: coactivity and successive return/handoff evidence with
  original sample-clock lineage; research-only consumer policy.
- Three active test files, 16 tests: actual synthetic PCM association, phase/gain,
  ambiguity, overlap, malformed inputs, ordering/immutability, evidence relations,
  evaluator arithmetic and immutable research snapshots.

No production analysis schema or consumer wiring changed. The pre-existing
artistic motif system does not establish musical motif identity.

## Measurements and their exact scope

The [development result](../fixtures/an04a-development-01.json) contains 8 authored
conditions and 56 candidate observations. The [frozen transfer result](../fixtures/an04a-transfer-frozen.json)
contains 12 disjoint sample-rate/phase/gain tuples and 84 observations; it requires
the identical source/protocol hash set from development. Transfer also uses
different harmonic profiles. Both sets share a generator, seven-observation
arrangement and known symbolic contour templates. This is parameter transfer,
not an independent composition, artist or recorded-music holdout.

Each main condition has three source hypotheses and three musical motifs:
two initially overlapping sources, pauses/reentry, a source changing phrase,
and phrases changing source/transposition/duration. Candidate isolation,
activity/phrase boundaries, F0 and notes are **supplied authored inputs**. The
tracker never receives authored source/motif identifiers. The waveform mixture,
stems and truth have hashes; mixture separation is not evaluated.

| Main stationary-candidate set | Source same-identity pairs | Motif same-identity pairs | Wrong merges / missed positive pairs |
| --- | --- | --- | --- |
| Development, 8 conditions | 40/40 | 40/40 | 0 / 0 |
| Frozen parameter transfer, 12 conditions | 60/60 | 60/60 | 0 / 0 |

Pairwise precision/recall and assignment coverage are 1 on these narrowly
controlled main sets. The declared no-memory baseline has zero positive-pair
recall because every observation receives a fresh identity. It is a comparison
for persistence functionality, not a previous production instrument recognizer
or a third-party model. The positive results must not be averaged with the
following negative/limit controls to claim general source-identification accuracy.

## Retained counterexamples and abstention

Five separate controls accompany each measurement:

1. Indistinguishable overlapping candidates: second source assignment abstains,
   no invented extra identity. Source pair remains unknown; motif sharing can
   still be described from supplied notes.
2. Indistinguishable sequential but genuinely different authored sources:
   **one false source merge**. Timbral continuity alone cannot distinguish this
   from a real reentry. This is a failure, retained explicitly.
3. One authored source changing its timbre: **one missed same-source pair**,
   creating a fragment. First-anchor association has no learned timbre-change
   invariance. This is another retained failure.
4. Unresolved mixture: source and motif association unavailable; positive-pair
   recall includes the abstained known positive, but unknown pairs are not counted
   as correctly rejected negatives.
5. Partial three-note occurrence: source may continue, motif remains unavailable;
   this version does not implement partial or ornamented phrase matching.

Thus zero-error main-set scores do not imply robust arbitrary source tracking.
Every output remains a hypothesis with null confidence and XR scoring ineligible.
Actual same-task two-library reference and independently annotated recorded-music
accuracy are unavailable. No third-party inference, model installation or neural
training took place in this slice. The three Prodigy mixtures cannot provide
the missing independent source/motif identity labels by themselves.

The transfer median association time was approximately 0.142 ms for seven supplied
observations on this host. Candidate rendering/extraction and pitch estimation
are excluded; actual memory peak and XR/browser performance were not measured.
Worst-case registry/relations costs are quadratic; this is not a scalability claim.

## Reproduction and retention

Run from `plexus-engine/`, Node v25.2.1 / npm 11.6.2, existing Python 3.12.14 lab:

```powershell
node --test tests/musical-entity-tracker.test.mjs tests/musical-relations.test.mjs tests/musical-entity-evaluation.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node research/analyzer-lab/diagnostics/measure-an04a.mjs --split development --output research/analyzer-lab/.cache/an04a-development-new.json
node research/analyzer-lab/diagnostics/measure-an04a.mjs --split transfer --frozen-reference research/analyzer-lab/.cache/an04a-development-new.json --output research/analyzer-lab/.cache/an04a-transfer-new.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an04a-inventory.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an04a-full-validation.json
```

Use fresh result names on repeated runs. Diagnostics refuse existing result or
snapshot destinations. Each measurement retains ten exact source snapshots with
SHA256 identities. The v0012 inventory adds 27 protected files to the unchanged
1145 predecessors: 1172 total, zero replacement/deletion, 148 active Node files,
27 Python files. Four additional test-source snapshots are historical unexecuted
copies, making 52 historical files; they are not counted as executed coverage.
The preserved reproduction program, labels, input descriptors and controls remain
in versioned research source. Generated PCM is recreated by the retained generator.

The first targeted run (3 passed / 13, 10 rejected) rejected descriptors because support coordinates were
passed under the wrong property names. TypeScript independently caught the same
contract mistake. It was corrected before development/transfer measurement;
the frozen thresholds were unchanged. The final targeted run passes all 16 tests
and TypeScript checking.

## Cumulative validation

The [immutable full result](../tools/harness/history/20261014T180458-5ad83f285b03.json)
records the exact executable paths, commands, logs, source and outcome hashes.
Run ID: `20261014T180458-5ad83f285b03`.

- `npm run build`: passed, TypeScript and Vite. The existing large-chunk warning
  remains a warning, not a failed build.
- `npm test -- --test-reporter=<harness reporter URI>`: 1465 tests, 1456 passed,
  9 failed; 148/148 active Node files executed, zero skipped/cancelled/todo.
- Full Python tree: 314 passed, 27/27 files executed. The harness invokes the
  lab Python with `-m pytest tests -q -p no:cacheprovider -o junit_family=xunit1`
  and separate `--basetemp`/`--junitxml` paths.
- All nine failures match predecessor names and assertion signatures: Wormhole
  clip-profile (4), geometry-LFO (1), preset-differentiation (2), projected-motion
  (2). Unknown failures: 0. Overall harness status **failed**, exit code 1;
  known failures never mask the test-suite exit status.
- v0012 retention passed before and after execution: zero historical source
  replacements/deletions; sources did not change during the run.
- Source archive SHA256:
  `693a9c223b7e4f318abff7cbdd26e7dbf1bc795b579e508b6bce90d08e412b4f`.
- Full evidence SHA256:
  `345fcc6fd8ee79c3df1c9730aa775775f62abdc289b4f46ce3bfda963a21e8e9`.
- `git diff --check`, scoped import review and all documentation links passed.

No dependency/runtime fallback was required. Browser/render/Quest smoke is not
applicable to this isolated API addition; physical headset timing remains
unvalidated. `diff_export.ps1` was skipped because no PR or diff export was requested.

## Next bounded milestone

Expand authored and independently annotated candidate data to evolving timbres,
larger same-family source counts, phrase variants and uncertain/missing notes.
Add actual mixture candidate extraction as a separately measured upstream stage.
Retain this first baseline and its false-merge/fragmentation controls. Source
identity eligibility, musical roles, complete separation/transcription and
consumer promotion require further independent evidence.
