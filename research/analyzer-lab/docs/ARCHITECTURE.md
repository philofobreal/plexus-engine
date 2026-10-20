# Architecture

The integration owner owns this research subsystem, bridge, schema and reports. Production ownership remains under [AGENTS.md](../../../AGENTS.md) and [ADR-002](../../../documents/adr/ADR-002-headless-analyzer-core.md). Only the research bridge reads `src/analyzer/`; no production module imports research. Root package.json, runtime types, worker schema, AudioEngine, State, UI, renderer, gameplay and XR remain untouched. The subsequent [improvement cycle](DRUM-IMPROVEMENT-CYCLE.md) includes an analyzer-owned production tonal-sustain correction and an opt-in original v2 research model; the research model is never a production dependency.

```text
local WAV → SoundFile decode → channel-0 mono Float32 (explicit mean optional), original sample clock
                            ├→ temporary f32le → Node/TypeScript → existing analyzeAudio()
                            │                                      → raw result → PlexusAdapter
                            └→ librosa onset_strength/beat_track/onset_detect
                                         ↓ canonical schema + provenance
                                  mir_eval matching + tempo/metadata differences
                                         ↓ immutable measurement artifacts
                                  report.json / report.md → pseudo-label JSONL
```

The Node loader follows the existing analyzer-parity/golden tests' `typescript.transpileModule` + CommonJS/vm approach. It loads analyzer-local relative imports only and offers no DOM, Web Audio, Worker, UI state or renderer globals. It is a loader, not a second DSP implementation. The Python projection does not resample. Both providers receive identical mono PCM and sample rate. The raw production result is saved unchanged; the sample count/duration are lab decode metadata, not additions to AnalysisResult.

Canonical version 1.0.0 uses seconds and Hz. `metadata` binds track identity, byte-content SHA256 and decoded clock; `provenance` binds provider/tool, model identity/version/checksum (nullable), parameters, timestamp and evidence taxonomy. The remaining domains support timing, arbitrary event classes, activity intervals, pitch tracks, notes, chords/key, sections, stem references, tags, confidence and artifacts. JSON Schema plus Python invariants reject nonfinite values, invalid intervals, unsorted grids and inconsistent pitch arrays. `null` means not supplied/unsupported; `[]` means supported but no results. Confidence can be unknown. Providers declare computed event classes in provenance parameters; a missing class is never automatically a negative prediction.

Plexus authoritative beats/barStarts are projected directly. `BeatEvent.type` is stored as visualImpact subclass; its intensity is an attribute, not confidence. Sections have unknown confidence because the source contract has no section confidence. Boundary candidates and novelty peaks remain artifact evidence with original reasons; raw output retains the novelty curve and all existing feature frames. Librosa computes only tempo/beats/onsets; there are no fabricated downbeats, sections or drum sources.

External providers use separate user-managed interpreters and JSON-only process boundaries. Request on stdin:

```json
{"protocolVersion":"1.0.0","audioPath":"absolute-normalized-mono.wav","outputPath":"absolute-provider.canonical.json","metadata":{},"timestamp":"UTC","options":{}}
```

Response stdout: `{"resultPath":"exact absolute outputPath","diagnostics":{}}`. Log messages belong on stderr. The result must validate against canonical schema, preserve request metadata/provider identity, and use `oracle_prediction`. Commands are argument arrays with no shell interpolation. Timeout/nonzero exit/malformed result/unavailable executable only fail that provider; exit code and stderr persist in manifest. Normalized WAV/PCM intermediates are removed in finally blocks. Heavy integrations are scaffolds and need wrapper implementations before they produce output. Model license/identity/checksum must be recorded by future wrappers, not inferred from the code license.

Run directories are independent attempts. `runId` hashes input identity plus UTC attempt timestamp; `reproducibilityHash` groups equivalent input/config/source/environment and actual provider/model provenance. The source fingerprint includes analyzer/types, research Python, bridge, schemas and registry/config; Git HEAD is recorded when available. Provider outcomes, actual dependencies, config hash, seed, diagnostics and versions persist in manifest. Unknown optional model identity is a reproducibility limitation, not a known checksum.

Artifacts live under ignored runs/tmp/cache/data/local/models/venv locations. Report regeneration reads successful immutable canonical artifacts and writes only report files. Training export copies positive windows' existing production features into provenance-bearing JSONL; unknown targets never become negative labels. NPZ is deliberately deferred to keep the first interchange contract inspectable.

## Repository audit record

The desktop parent worktree initially contained an empty `plexus-engine/` directory. A local, independent clone of the existing `C:/novy/Plexus Engine (VJ System)/plexus-engine` repository supplied the real project without modifying that original checkout. All required governance documents, ADR-002, analyzer/types/worker, TS fixtures/loaders, package.json, tsconfig and ignore rules were inspected before implementation. The original ignored Graphify corpus existed; `graphify explain analyzeAudio` failed with `uv trampoline failed to canonicalize script path`, so targeted source/tests established the relationships. No graph rebuild was attempted.

The requested logical layout is retained. Additions: `fixture` CLI, validation dependency snapshot and integration tests/validation notes. Synthetic WAVs are generated, never checked in. Editable installation is intentional to keep one analyzer implementation and one set of repository-owned schemas.
