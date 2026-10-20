# Improvement-cycle validation (2026-10-10)

Owners: integration agent owns the analyzer correction, research model integration, measurements and docs; delegated agents authored an independent frozen corpus, analyzer fixtures, model contract checks and clean-HEAD failure verification in disjoint files. No production worker/schema/audio/state/UI/render ownership changed. Existing runtime/package-manager versions and Python pins remain those recorded in [initial validation](VALIDATION.md) and [P0 validation](DRUM-VALIDATION.md).

## Production checks

From repository root:

```powershell
npm run build
npm test
node --test tests/analyzer-golden.test.mjs tests/analyzer-percussive-events.test.mjs tests/analyzer-parity.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-timing-edgecases.test.mjs
node --test tests/analyzer-tonal-sustain.test.mjs
```

Build passed (TypeScript + Vite); existing chunk-size warning remains informational. Targeted existing analyzer checks passed 45/45. New tonal fixtures passed 33/33 in the final full suite. No golden data was regenerated. An extra targeted final-frame/eight-second run passed 4/4.

Full `npm test`: **1291 total, 1281 passed, 10 failed**. The same ten failures were reproduced on a clean archive of HEAD `29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14`. All 566 extracted tracked files were verified against exact Git blob SHA1, zero mismatches. This establishes baseline failures rather than claiming a green full suite:

- `dev-preset-save.test.mjs`: one temporary-file rename `EPERM` in this Windows environment.
- `wormhole-clip-profile.test.mjs`: four preset assertions.
- `wormhole-geometry-lfo-integration.test.mjs`: one projected-geometry assertion.
- `wormhole-preset-differentiation.test.mjs`: two preset separation/order assertions.
- `wormhole-projected-motion.test.mjs`: two projected-motion assertions.

The five baseline files ran 40 tests: 30 passed, the same 10 failed. Failure names and the nine assertion messages match the changed checkout. Exact baseline command from `research/analyzer-lab/.cache/baseline-check/checkout`:

```powershell
& 'C:/Users/budap/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test --test-reporter=spec tests/dev-preset-save.test.mjs tests/wormhole-clip-profile.test.mjs tests/wormhole-geometry-lfo-integration.test.mjs tests/wormhole-preset-differentiation.test.mjs tests/wormhole-projected-motion.test.mjs
```

Bundled Node was used for the isolated baseline check; it reused existing ancestor dependencies. Original source was not changed. Full logs, identity proof and failure comparison are ignored local files in `.cache/baseline-check/`. Unrelated visual presets were not altered to silence baseline assertions.

## Research checks

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests -q --basetemp research/analyzer-lab/.cache/pytest-improvement-full
& research/analyzer-lab/.venv/Scripts/python.exe -m compileall -q research/analyzer-lab/src
git diff --check
```

Full Python suite: **191 passed in 86.09 seconds**. Targeted corpus checks passed 13; v2 feature/model tests passed 9; model contract checks passed 27; measurement identity/partial-coverage checks passed 12. Compileall and `git diff --check` passed. Final static review checked all 108 new text files for JSON parsing, local Markdown links, whitespace/final newlines and accidental binary artifacts: zero issues. Tests use generated original waveforms and mocked provider observations only for failure-path contracts; actual library measurements use the real adapters, never test substitutes.

Actual measurement commands are in [the cycle report](DRUM-IMPROVEMENT-CYCLE.md). The frozen models were reevaluated after contract hardening in new `runs/drums-v2-paired-final` artifacts; fitting weights and model file bytes were retained. Actual production/librosa reference measurements were rerun with the final identity checks in `runs/music-reference-v2-final`. Historical-regression artifacts remain in `runs/drums-v2-historical`.

## Limits

Python 3.12.14 was used because preferred 3.11 was unavailable; manifests retain actual versions. No dependency was installed for this improvement cycle. No real Slakh/MIDI/stem dataset or actual drum-specific oracle was available. Synthetic labels only prove scheduled procedural identities. Library onset metrics neither prove drum identity nor BPM/structural correctness. The new drum model is opt-in because the historical corpus has kick/snare regressions.

Physical browser playback, render and XR/Quest smoke were not run: this cycle changes offline analyzer interpretation without UI, renderer or lifecycle edits. No deployment, PR, staging or commit was performed. The original checkout remains untouched.
