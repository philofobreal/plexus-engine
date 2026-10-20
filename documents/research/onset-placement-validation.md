# Accepted-event timing and automation integration validation

Date: 2026-10-14 (Europe/Budapest). Integration owner: Codex/root.
Starting state: complete project snapshot from the other analyzer chat's
`72800fe` commit, continued in this chat's `codex/onset-placement` branch.
No writes to the other chat's source or Git state were made.

## Delivered behavior

- Explicit opt-in local accepted-frame timing, separately identified v1/v2;
  legacy events, counts and meter retain their default behavior.
- Existing onset-backed impact cues follow the same sample-time correction.
- Role-aware automatic placement retains coincident source roles and each role's
  own confidence/kind. Structural births and internal accents have different
  evidence preference; manual/locked placements retain user ownership.
- Three hosts forward the timing choice through the existing request-id worker
  boundary. XR consumes the same corrected events and reports localization
  coverage. Experimental MVP journeys use a distinct saved fingerprint.
- Exact-PCM review preparation, human-annotation evaluation, reusable authored
  and recorded measurement tools, full retained results and source snapshots.

The [feature guide](../features/accepted-event-timing.md) gives activation and
review commands. Independent human-reviewed musical labels, physical headset
timing and early-song pre-roll remain unavailable, not implicitly implemented.

## Authored measurements and rejection evidence

The [first stable v1 result](../../research/analyzer-lab/fixtures/accepted-timing-authored-01.json)
retains 340 controls, exact PCM/truth/source hashes and 228 positive mathematical
attack times. Candidate event frames are supplied to this study; it does not
measure production eligibility or real musical correctness.

The [v2 development result](../../research/analyzer-lab/fixtures/accepted-timing-v2-development-01.json)
replays every known control. All 340 v1 case objects remain identical. All
count/type/intensity invariants hold. The controls share a generator and have
already been viewed; they are development/regression, not independent holdout.

| Measure | Original frame times | v1 | v2 |
| --- | ---: | ---: | ---: |
| Positive matches at 2 ms / 228 | 56 | 148 | 132 |
| Positive matches at 10 ms / 228 | 98 | 158 | 147 |
| Positive matches at 25 ms / 228 | 158 | 158 | 158 |
| Matched-only absolute p50 at 25 ms | 5.333 ms | 0.479 ms | 0.479 ms |
| Matched-only absolute p95 at 25 ms | 22.063 ms | 2.875 ms | 12.268 ms |
| Negative refinements / 140 controls | N/A | 22 | 0 |

V1's 22 negative refinements are gradual ramps. V2 rejects them, but has 24
positive regressions relative to v1: 22 impulse controls and two quiet attacks
over bass. These are retained, not compensated by an average score. Two-attack
controls have two known attacks but one supplied accepted event; this refiner
cannot recover an undetected second event. Lower sample rates have feature frames
longer than the 30 ms search cap, and late attacks can stay unrefined.

The [source-drift rejection](../../research/analyzer-lab/fixtures/accepted-timing-source-drift-rejected-01.json)
retains the first measurement's failed publication check. A later stable run was
used; it did not overwrite the rejection. Two new test-helper assertions initially
failed on cross-realm array prototypes; JSON normalization fixed the assertions
without changing DSP, measured outputs or expectations.

## Exact recorded replay and cost

Nine retained Prodigy excerpt PCMs from the existing local research cache were
replayed with original hashes/channel-0/44.1-kHz clocks and context. They cover
180 nominal excerpt seconds (20.2-second context per row). No source recording
was altered or copied into versioned fixtures. Actual headless analysis was run
for default and opted modes; independent local-refiner output equals the opted
full-analyzer output. Every historical default/v1 recording output matches.

All 659 accepted events retain count/type/intensity. V1 localizes 91; v2 localizes
85, adding six gradual-attack abstentions. Both retain 535 no-candidate, 27
ambiguous and six incomplete-support outcomes. Maximum observed v1 shift is
20.748 ms. Both reports explicitly keep recorded truth and accuracy null.

V2 run, summed across nine clips: observed elapsed default 59.005 s, opted
63.654 s, local-v2 5.116 s; process CPU 51.498/55.077/4.454 s respectively.
Single-pass/order/host observations are not controlled speed benchmarks, memory
peak measurements or Quest guarantees. The earlier v1 timings remain in its own
result. No number here establishes real-song onset precision.

## Exact import and retention

The local clone initially converted source CRLF/LF bytes. That invalidated old
SHA256 fixture identities despite identical code. Exact archived predecessor
bytes were restored after checking that differences were newline-only; six
ignored historical package-metadata files were materialized from the protected
archive. All 1279 old protected identities were retained. Thirteen old manifest
files required their original newline bytes to satisfy their unchanged hash
chain; their JSON data and archive identities were not rewritten.

[Byte-restoration evidence](../../research/analyzer-lab/fixtures/import-source-byte-restoration-01.json)
and [final-source equivalence](../../research/analyzer-lab/fixtures/import-timing-source-equivalence-01.json)
retain original/final hashes. All 62 v2 measured source entries equal final code
after canonical CRLF/LF conversion (55 differ in newline encoding only). Measured
source bundles remain untouched; results belong to their original bytes.
`.gitattributes` now disables automatic newline conversion, preserving committed
source identities on future checkouts. Local Git `core.whitespace` includes
`cr-at-eol` so valid retained CRLF metadata is not reported as trailing whitespace.

Inventory v0015 has 1419 protected files, adding 140 without replacing or
deleting the 1279 predecessors. Historical copied source is evidence, never
executed as extra coverage. No old golden or known-failure signature was refreshed.

The first cumulative Node run revealed two older DSP files whose measured
identities require CRLF, even though Git HEAD stores LF. Their exact retained
v2-snapshot bytes were restored, preserving code and old hash assertions. The
first canonical equivalence record remains historical; current equality is
also checked by the active measurement regression. A native Node ESM import
needed its explicit `.ts` suffix. Two contract syntax assertions were updated
for the new event-binding argument and timing option, with the complete old
test file retained in the v0015 ZIP. All 64 related tests then passed.

Inventory v0016 has 1423 protected files: four additions, one reviewed
[contract migration](../../research/analyzer-lab/fixtures/onset-placement-contract-migrations.json),
and no deletions. The migrated tests retain every prior test declaration;
their new assertions require the intended ownership and event association.

## Commands and consumer evidence

Commands run from the new `plexus-engine/` root:

```powershell
npm run build
node node_modules/typescript/bin/tsc --noEmit
node --test tests/accepted-event-timing.test.mjs tests/automation-cue-roles.test.mjs tests/automation-cue-alignment.test.mjs
node --test tests/event-timing-consumers.test.mjs tests/xr-audio-integration.test.mjs tests/semantics.test.mjs tests/visual-score-dsl.test.mjs
node --test tests/accepted-event-timing-v2.test.mjs
node --test tests/event-timing-evaluator.test.mjs
node --test tests/event-timing-review-preparation.test.mjs
node --test tests/accepted-timing-measurement.test.mjs
node --test tests/analyzer-band-onsets.test.mjs tests/accepted-event-timing-v2.test.mjs
```

Targeted suites pass after the stated helper fixes. They exercise actual analyzer
and worker parity, malformed timing reports, event count/time association,
request-id supersession, sample copy/transfer, canonical normalization, XR
spawn/hit/seek coherence, role provenance, saved-key separation and every retained
control/negative regression. Node 25.2.1, npm 11.6.2, copied existing node_modules;
no dependency was installed or lockfile changed. Existing laboratory Python
3.12.14/pytest 8.4.2/NumPy 2.2.6 was reused from the other worktree because this
fresh clone has no virtual environment; only its interpreter/dependencies are
read, while all code, temporary files and reports belong to this worktree.

The local clone needed sandbox escalation because Git's Windows shell helper was
blocked. Localhost browser navigation timed out; the shell HTTP request was
blocked by sandbox socket permissions and also timed out after read-only
escalation. The Vite dev server started successfully and was stopped. HTTP/browser
smoke and physical headset validation are not confirmed. No renderer geometry,
audio playback clock or scoring-window changes were made.

## Cumulative result

The [first incomplete result](../../research/analyzer-lab/fixtures/onset-placement-first-validation-failed-01.json)
retains build/Node evidence: 1502 Node tests, 1487 pass, 15 fail; nine exact known
Wormhole signatures and six integration/import/byte-identity failures. Python
stalled after 37 progress dots and was interrupted without a final coverage
claim. The single-test faulthandler probe located `tempfile._mkstemp_inner` /
`numba.core.caching.ensure_cache_path` trying to create a cache in the read-only
dependency environment. Directing `NUMBA_CACHE_DIR` to this project's ignored
cache made the same Librosa silence test pass in 27.91 s, with JIT enabled and
no algorithm/threading changes. [Repair evidence](../../research/analyzer-lab/fixtures/onset-placement-runtime-fix-01.json)
retains the six Node fixes, native stack location and exact runtime policy.

The final full run uses the existing Python environment plus this writable cache:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:NUMBA_CACHE_DIR='<this worktree>/plexus-engine/research/analyzer-lab/.cache/numba-placement-validation'
& '<existing analyzer worktree>/plexus-engine/research/analyzer-lab/.venv/Scripts/python.exe' research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/onset-placement-full-final.json
```

The harness runs declared `npm run build`, recursive `npm test` with its retained
reporter, and the entire lab `pytest tests -q -p no:cacheprovider` with isolated
basetemp/JUnit output. Nothing is skipped to bypass the native initialization.
Final run `20261014T205956-9ec4b88f7154` has an
[immutable compact history](../../research/analyzer-lab/tools/harness/history/20261014T205956-9ec4b88f7154.json).
The detailed report and stdout/XML remain in ignored
`.cache/onset-placement-full-final.json` and its run directory.

| Gate | Final result |
| --- | --- |
| Declared npm build | Pass, TypeScript and Vite, exit 0 |
| Declared recursive npm tests | 1516 tests: 1507 pass, 9 fail |
| Active Node files | 160/160 executed |
| Full laboratory pytest | 316/316 pass, 28/28 active files |
| New/unknown failures | 0 |
| Known failures | 9 exact retained Wormhole assertion signatures |
| Skipped/cancelled/todo Node tests | 0 |
| Post-run protected inventory | Pass, zero issues, v0016 |
| Source changed during full run | False |
| Overall harness | Failed, exit 1; known failures remain failures |

The remaining signatures are Wormhole clip-profile (4), geometry-LFO (1),
preset-differentiation (2) and projected-motion (2). No unrelated preset or
renderer repair is claimed. All prior tests run alongside the 31 new tests;
two strengthened contract assertions have their reviewed predecessor retained.
`git diff --check` and documentation-link review pass after final documentation.

Full evidence SHA256:
`721d18268103e3705395bb6bd9b80e5f9e28cd7add081c1c32f885d91786b311`.
Final analyzer/lab/runtime source-set SHA256:
`77146adea80965c5219fec194db253b169218e01f6555127488f7a4e64bf0fc8`.
The source identities, exact executable/command paths, costs, runtime policy,
coverage and failure signatures remain in the retained history/report.

Runtime/reproduction limits remain explicit: this worktree copied existing
Node dependencies and reuses the old isolated Python interpreter with a writable
local Numba cache. There was no installation, JIT disabling, library substitution
or test exclusion. Browser/HTTP and physical headset precision remain unverified.
Independent human-reviewed annotations are the next promotion gate; v2's 24
known positive regressions block an unconditional "universally better" claim.
