# Research code retention

Captured on 2026-10-10. The integration owner retains production ownership; this
archive owns only historical tool code and its provenance. The inventory covers
the surviving direct scripts in the ignored lab cache, two baseline-check tools,
and the original nested DSP diagnostic. No broad disk scan was performed.

All 21 independently authored programs (16 Python and 5 MJS) are retained
byte-for-byte as inert text in
[`tools/archive/history-20261010/sources`](../tools/archive/history-20261010/sources).
The [inventory](../tools/archive/history-20261010/inventory.json) records original
relative paths, byte sizes, SHA256 identities and dispositions. Inert originals
preserve author decisions and assertions without replaying old fixed-path writes.
Safe refactors have explicit inputs and fresh output paths. Neither representation
is a production or golden-test authority.

| Original program | Retention and purpose |
| --- | --- |
| `build_schemas.py` | Exact source plus `schema_snapshot.py initial-contracts`; initial six canonical/report/dataset schema builders. Later contract amendments are not regenerated. |
| `create_drum_schemas.py` | Exact source plus `initial-drums`; initial dataset/model schema builder, not the hardened current contract. |
| `create_drum_v2_schema.py` | Exact source plus `initial-v2`; initial v1-to-v2 shape transformation using explicit base schema and selected working-tree feature names. |
| `minimize-an01-schema.py` | Exact source plus `minimize-an01`; preserves the small textual AN-01 patch while reading an explicit pre-AN-01 base and writing a fresh staged result. |
| `update-an01-schemas.py` | Exact source plus `update-an01`; stages supplied schemas and reproduces the historical update without touching live schema files. |
| `review_files.py` | Exact source plus refactor of the same name; read-only hygiene/link/JSON review, with binary detection before text decoding and configurable root/file selection. |
| `summarize-an01.py` | Exact source plus `summarize_an01.py`; rechecks explicit historical logs and paired records into a fresh replay record. Original source/consumer hashes are historical, not recomputed and falsely presented as the experiment. |
| `summarize-principles-audit.py` | Exact source; incidental assembly of the already versioned principles-audit fixture summary. Compact record preserves the summary identity and limitations. Do not rerun it to overwrite the historical fixture. |
| `finalize-principles-audit.py` | Exact source; incidental publication/copy and Markdown-link edit script. The existing diagnostics/docs are canonical; a duplicate mutating publication tool is unnecessary. |
| `finalize_improvement_evidence.py` | Exact source; incidental fixed-cycle evidence/fixture assembly. Existing `drum-v2-cycle.summary.json` is the historical record. Tonal measurement is separately reusable; original weights/data/report directories are excluded. |
| `inspect_validation.py` | Exact source plus `model_validation.py inspect`; explicit model inputs, validation metadata only, no weights in its output. |
| `freeze_drum_models.py` | Exact source plus `model_validation.py freeze`; explicit trials/candidate and original validation ranking. Historical declaration about prior test inspection is retained as a declaration, not asserted by replay. |
| `measure_tonal_sustain.py` | Exact source plus refactor of the same name; configurable generated tones, explicit current/baseline source, optional installed librosa and fresh measurement directory. |
| `measure_tonal_sustain.mjs` | Exact source plus refactor of the same name; read-only TS loader with explicit repository/PCM paths and optional baseline FeatureExtractor, little-endian decoding and stdout response. |
| `pristine_build.py` | Exact source plus refactor of the same name; export explicit Git build inputs into a new directory; run a build only with `--run-build`, using existing dependencies. |
| `validate_cli.py` | Exact source; original three-track click/pulse/silence corpus builder and CLI smoke procedure. Shared `audio.synthetic`, current CLI and tests own the executable implementations. Original procedure's fixed temporary/export paths are not repeated as a new mutating runner. |
| `validate_drum_cli.py` | Exact source; original authored SMF/review fixture builder, MIDI import, training and benchmark smoke procedure. Current MIDI importer/corpus generators/CLI/tests own these functions; fixed model/run output names make direct historical replay inappropriate. |
| `baseline-check/check-identity.mjs` | Exact source plus `check_identity.py`; supplied checkout/ref verification, no missing-file restoration, SHA1/SHA256 object support and safe path checking. |
| `baseline-check/compare-failures.mjs` | Exact source plus `compare_failures.py`; explicit logs, fresh comparison result and optional explicitly supplied historical failure count. Failure equivalence never means a passing suite. |
| `analyzer-audit-root.mjs` | Exact source; already published as `diagnostics/audit-musical-contracts.mjs`. Historical observations must change after fixes; not a frozen acceptance target. |
| `analyzer-audit-evaluation/dsp-diagnostics.mjs` | Exact source; already published as `diagnostics/audit-dsp-principles.mjs`. Current configurable harness work owns reuse; the original diagnostic snapshot is retained without copied production DSP. |

The [archive README](../tools/archive/README.md) documents commands and execution
semantics. `capture_history.py` can repeat this retention capture from a different
explicit evidence directory into a new destination. Shared `_common.py` centralizes
exclusive JSON writes and new-directory creation. Existing destinations are errors;
there is no implicit overwrite mode. Schema replay executes only the known archived
stage after verifying its source identity and replacing initial path assignments;
it does not accept arbitrary source programs.

Historical evidence is preserved in
[`historical-evidence.json`](../tools/archive/history-20261010/historical-evidence.json):
27 available log identities and final-summary extracts, baseline failure comparison,
566-blob clean-HEAD identity verification, earlier dependency doctor output, the
validation-only drum freeze record, and identities/limitations of the three
already versioned experiment summaries. Extracts are observed history, not a new
validation run. Missing totals do not mean success. The historical candidate full
Node run and targeted clean-HEAD baseline both recorded ten failures; unchanged
failure names/messages do not turn them into passes. The targeted baseline log
contained 40 tests, not a complete clean-HEAD suite.
The record preserves this limitation instead of erasing or rewriting the logs.

Temporary baseline/pristine checkouts (422 and 237 program files), nine built
bundles and 25 pytest-generated provider stubs were classified as disposable copies
or generated artifacts. Their authoritative source already exists in Git or tests.
The saved `FeatureExtractor.algorithm5.ts` is copied production source, so only its
SHA256 is recorded. Virtual environments, audio, procedural datasets, model weights,
binary arrays, caches and temporary archive files are not retained here. No ignored
artifact was deleted.

Shell/REPL snippets with no surviving source file cannot be recovered verbatim.
Available original corpus/SMF/comparison/reproduction snippets are preserved in the
source snapshots, while the reusable corpus implementations remain in
`src/plexus_analyzer_lab/audio.py`, `drums/synthetic.py`, `drums/synthetic_v2.py` and
their versioned tests. No replacement source or historical result was invented.
Some original procedures require missing data or a historical production revision;
their retention is inspectability, not a promise of exact reproduction with today's
source. Real-recording generalization, physical headset timing and model accuracy
have not been established by this retention work.

Checks for this archive are targeted: Python AST parsing, Node syntax checks, CLI
help, source hash verification, fresh-output and collision checks, selected schema
stages, a small current-only tonal replay, and rechecking the available AN-01 logs.
No full test suite, model training, optional installation or historical checkout
build is required for retention. Exact performed checks and runtime fallbacks are
reported by the implementation owner; historical extracts above are separate.
The performed check record is
[`retention-validation.json`](../tools/archive/retention-validation.json).
