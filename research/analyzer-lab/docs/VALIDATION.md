# Implementation validation — 2026-10-10

Baseline: `29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14`; branch: `codex/analyzer-oracle-lab`. Changes are in the independent local clone at `C:/Users/budap/.codex/worktrees/7966/novy/Plexus Engine (VJ System)/plexus-engine`. The original checkout's existing XR/render work was neither copied into this baseline nor modified. All 21 analyzer source files match the original checkout as text (line endings differ).

Created: the research package, five versioned interchange schemas, registry/matrix/config, Node bridge, seven adapters/protocol/metric areas, evidence/consensus, dataset/splits, JSONL export, provider scaffolds, eight test modules, small JSON fixtures, docs and dependency snapshot. Modified existing file: root `.gitignore`. Added integration link: `documents/research/analyzer-oracle-lab.md`. Production source, types, worker schema, package/lockfiles, Vite/TS config and golden fixtures have no diff.

## Environment and setup actually used

Preferred Python 3.11 was unavailable. The initial default Python 3.13.2 venv/ensurepip path failed in the sandbox. A successful isolated environment used the bundled Python **3.12.14** with an authorized sandbox escalation:

```powershell
& 'C:\Users\budap\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv research/analyzer-lab/.venv
& research/analyzer-lab/.venv/Scripts/python.exe -m pip install -e 'research/analyzer-lab[test]'
Copy-Item -LiteralPath 'C:\novy\Plexus Engine (VJ System)\plexus-engine\node_modules' -Destination . -Recurse
```

No Node dependency was installed or upgraded. Existing ignored dependencies were copied from the original checkout because the new clone had none. Actual Node was **25.2.1**, TypeScript **6.0.3**, Vite **8.0.14**. Core declared/installed: numpy 2.2.6, scipy 1.15.3, soundfile 0.13.1 (libsndfile 1.2.2), librosa 0.11.0, mir_eval 0.8.2, jsonschema 4.25.1; test extra pytest 8.4.2. All transitive versions are recorded in `requirements.validation.txt` and each manifest. No optional ML environments, datasets or model weights were installed/downloaded.

Local clone creation needed sandbox escalation because the existing parent worktree had an empty project directory and system Git could not read the original repository within the sandbox:

```powershell
git clone --no-hardlinks -- 'C:\novy\Plexus Engine (VJ System)\plexus-engine' 'C:\Users\budap\.codex\worktrees\7966\novy\Plexus Engine (VJ System)\plexus-engine'
```

Git commands subsequently worked inside this clone. The bundled Git executable was also used for initial status/diff checks where the default Git could not traverse the original directory. Original-checkout status/HEAD inspection was read-only with escalation.

## Exact validation commands and outcomes

Run from the clone's repository root:

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests --basetemp research/analyzer-lab/.cache/pytest -q
& research/analyzer-lab/.venv/Scripts/python.exe -m compileall -q research/analyzer-lab/src
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab doctor
node --test tests/analyzer-parity.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-dsp.test.mjs tests/contracts.test.mjs
npm run build
git diff --check
git diff -- src package.json package-lock.json bun.lock tsconfig.json vite.config.ts tests/fixtures
```

- Final Python suite: **61 passed**, no skips. Coverage includes actual Node + librosa vertical slice, repeatability/input preservation, schema/clock/interval constraints, unsupported versus supported-empty event classes, consensus votes, official split preservation, actual-content leakage, timeout/nonzero/malformed/identity failure boundaries, partial reports and report immutability.
- Production targeted Node suites: **74 passed**, no failures or skips; analyzer golden results unchanged.
- Typecheck and production Vite build: passed. Existing >500 kB chunk and plugin timing warnings were informational.
- compileall, doctor and diff whitespace checks: passed. Optional provider environments are explicitly unavailable and nonfatal in doctor.
- Production tracked-source/config/golden diff: empty. No production import points at research.

CLI commands actually exercised:

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab oracle list
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab fixture --output research/analyzer-lab/tmp/click.wav --duration 16
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab analyze --audio research/analyzer-lab/tmp/click.wav --oracle librosa --plexus
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/.cache/validate_cli.py
```

The last ignored local validation helper generated 120 BPM, 128 BPM and silence WAVs, a three-track dataset manifest, and invoked the following real CLI operations with absolute artifact paths:

```text
python -m plexus_analyzer_lab doctor
python -m plexus_analyzer_lab oracle list
python -m plexus_analyzer_lab benchmark --manifest <tmp/synthetic.dataset.json> --runs-dir <lab/runs>
python -m plexus_analyzer_lab report --run <each resulting run>
python -m plexus_analyzer_lab export-training --run <each resulting run> --output <tmp/track.jsonl>
```

All succeeded. Export counts: click120 **15**, pulse128 **16**, silence **0** with explicit no-evidence diagnostic. Assigned splits remained train/validation/test. Every emitted label retained false ground-truth status. Differential tempos were Plexus/librosa 120/117.4538 and 129/129.1992 BPM; those are observed predictions, not accuracy assertions. Silence has no available tempo comparison.

After final provenance/environment refinements, `analyze --audio research/analyzer-lab/tmp/click.wav --oracle librosa --plexus` and `export-training --run <that run> --output research/analyzer-lab/tmp/examples.final.jsonl` succeeded again. This 16-second fixture exported **31** pseudo-label examples with the deterministic track-id split; no declared dataset split was attached to this standalone analyze run.

## Bundle and artifact review

An ignored pristine checkout of build inputs was extracted from HEAD using `git cat-file --filters HEAD:<path>` (matching checkout newline filters), then built with the same existing Node packages. Actual commands:

```powershell
node node_modules/vite/bin/vite.js build --outDir research/analyzer-lab/.cache/build-baseline
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/.cache/pristine_build.py
```

The helper invokes `node <repository>/node_modules/vite/bin/vite.js build` in the pristine input directory. **All 51 output files are byte-identical** to the production `dist/` build, including all JS/worker assets: zero bundle growth and no Python/ML assets. Its first attempted extraction omitted a Vite helper script; including tracked `scripts/` fixed that local validation setup. An earlier comparison to the dirty original checkout was discarded as an unsuitable baseline.

Manual source review and independent agent audits checked ownership/import direction, canonical semantics, external diagnostics, event availability, leakage, artifact paths and provenance. New-file JSON/schema validation and documentation links were reviewed. `git ls-files --others --exclude-standard` excludes generated WAV/PCM/JSONL, models, environments/caches/runs. New-file whitespace was checked separately because ordinary git diff excludes untracked files.

## Unvalidated and known limits

- Python 3.11 installation was not exercised; the working run used 3.12.14. Frozen validation dependencies describe that tested environment.
- Optional Basic Pitch/Spleeter/Omnizart/Essentia/MSAF wrappers and heavy environments remain planned/unavailable; their common process infrastructure is tested with synthetic provider processes.
- Pitch/voicing, note transcription and source-activity metrics are explicit future interfaces. Actual paired pitch/note/source datasets were not tested. Initial training export is positive onset JSONL only; NPZ is deferred.
- Content hashes detect identical encoded assets, not re-encodings/remixes of the same performance. Curated performance grouping remains necessary.
- Unknown model licenses/checksums remain unknown. Future wrappers must supply reviewed actual model provenance. Oracle outputs never become ground truth automatically.
- Full `npm test`, browser smoke and physical XR/headset validation were not run: no production/UI/render/XR change was made. Render output safety is supported here by the empty production diff and byte-identical bundle.
- `diff_export.ps1` was skipped as unnecessary; direct diff, untracked-file inspection and source review were used. Graphify explain was attempted but failed with its local uv trampoline error; targeted source navigation was used.

Recommended separate next task: P0 Musical Event Layer — kick/snare/hi-hat evidence benchmark and independent Plexus DrumEventClassifier development using reviewed Slakh/MIDI/stem ground truth plus oracle consensus.
