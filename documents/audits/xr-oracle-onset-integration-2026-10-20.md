# XR, Analyzer Oracle and onset-placement integration review

Integration owner: Codex, current user-authorized integration task, 2026-10-20.
Owners: analyzer/worker contracts and application wiring have one integration owner;
independent code and documentation/test reviewers supplied findings. XR runtime owns
browser orientation, the input adapter owns gestures, and gameplay retains its clock,
judge and scoring. No dependency installation or upgrade is part of this work.

## Scope and usefulness decision

The user authorized XR plus the latest Oracle, then explicitly included onset-placement
after further usefulness review. World Formation is preserved separately for later work.
It is a coherent optional XR world-building feature, not an Oracle prerequisite; its
close-boundary transition discontinuity, scan-kind/documentation mismatch and unused
motion vocabulary must be resolved before its own integration. No World source is imported.

Onset-placement is worth retaining as an **opt-in engineering experiment and evaluation
toolset**, with a measured narrow benefit. On the 340 already-viewed development controls,
228 authored positive attacks yield baseline/v1/v2 match counts of 56/148/132 at ±2 ms,
98/158/147 at ±10 ms and 158/158/158 at ±25 ms. The matched subset's median error drops
from 5.333 ms to 0.479 ms; this does not imply better overall recall. V2 rejects the 22
known erroneous gradual-ramp refinements from v1 but loses 24 positive cases versus v1.
The 8 kHz group includes regressions. These are not independent holdout results.

Nine recorded excerpts from three songs contain 659 accepted events; historical v2 moves
85 (12.9%). They have no human-reviewed onset truth, so shifts and abstentions do not prove
musical accuracy. The ordinary XR perfect window is 80 ms: a few-ms localization gain is
useful evidence and potentially perceptually useful, but does not establish a large scoring
or comfort benefit. Missing/false accepted events, early attacks outside the forward frame,
tempo/meter errors, approach-horizon omissions and physical headset latency remain unsolved.

The separate role-aware cue selection is a meaningful consumer improvement: it preserves
coincident structural, attack, release and melodic evidence rather than borrowing an
unrelated role's confidence. Its tests cover manual/locked ownership, bounded searches and
omissions. It is presently coupled to the experimental timing option; no independent
real-music ablation justifies promoting either component to the default.

Therefore: retain the DSP, role-aware consumers and truthful evaluator; fix the falsified
DC gate; keep the entire path off unless selected by URL. Do not change scoring windows,
default analyzer version, default chart golden or audio playback time to make it appear useful.

## Preserved histories and exact bytes

Oracle `a551aca` contains the production AN-01/version-7 PCM support/RMS/feature-clock
corrections plus standalone diagnostic onset, entity, pitch and harmonic research. AN-04D
prefix forecasts are not called by the production analyzer, worker, hosts or gameplay.
They remain diagnostic-only, confidence null, source isolation unverified and XR scoring
ineligible. Independent review found no production P1/P2 defect. A low-priority malformed
forecast-status validation gap remains in the standalone diagnostic evaluator; it is not
a production promotion claim or hidden runtime dependency.

The original Oracle working tree verified all 15 manifest links/ZIP hashes and 1366 current
protected file hashes. Git blobs did not consistently retain those exact working bytes:
older CRLF identities depended on autocrlf checkout behavior. The integration imports the
verified original bytes, adds scoped `-text` attributes, and retains six ignored egg-info
files already required by v0015. It does not regenerate old hashes or numeric measurements.
After explicit index renormalization, 1389 staged predecessor/manifest/archive entries
verified against their required raw SHA256. Historical whitespace in preserved hashed
sources is intentionally not reformatted. The first local preservation commit was amended
after the staged-byte gate identified unchanged index entries that needed renormalization.

The onset worktree has an independent history: v0001–v0013 raw manifests are shared;
v0014 differs in LF/CRLF bytes, and v0015/v0016 contain different development. Its complete
original source, including uncommitted files and inventory-required ignored metadata, is
retained as an inert path-preserving
[snapshot](../../research/analyzer-lab/fixtures/history/onset-placement-72800fe/README.md).
All 16 inner manifest links, ZIP hashes and protected source hashes were verified. This is
historical source preservation, not new active test coverage. The active inventory continues
Oracle v0015 with explicit per-file migrations and a new combined inventory.

## Review fixes and remaining validation

XR gestures now judge gameplay on primary contact, matching right-click timing; a successful
hit owns the gesture, empty-space dragging may rotate, and release never retries a missed
press. Menu opening/closing/navigation cancels held pointers. Native pointer-event facade
tests exercise the real ray/judge and actual canvas text calls verify every settings tab's
authored font sizes and fitted labels. The affected XR/MVP/gameplay suite passed 484/484;
the build passed before Oracle/onset integration.

The corrected v2 gate subtracts a baseline from the existing 60 ms **before the accepted
frame**, excluding the frame's attack. The observed support includes this baseline. It has
a distinct `accepted-frame-band-timing-v2-dc1` identity, still selected by `local-band-v2`;
historical v2 remains normalizable. V1 is unchanged. This fixes the demonstrated constant
offset failure, not general band-detector invariance to arbitrary backgrounds or drift.
Old frozen measurements/source snapshots stay immutable; current behavior has separate
regression evidence and reviewed source evolution. Legacy, v1, original v2 and corrected
v2 journeys/checkpoint tokens are tested for independent storage and reload. Real SessionStore
save/consume covers all four fingerprints, and the controller's same-content-file restore test
rejects mismatched timing fingerprints without restoring edits/history/seek; returning to the
matching fingerprint restores the saved workspace.

The corrected implementation passed 840 real-detector ramp/DC/gain/polarity/rate/phase cases
without refinement, retained useful localization on 114 sharp-noise cases, and passed 720
isolated-candidate gate metamorphic cases. This does not establish full detector DC invariance.
An additional 336 ramp-plus-tonal-mixture stress cases retain **eight false refinements** in
both old and corrected v2 (288 no-candidate, 40 gradual-attack, 8 refined; zero changes).
The complete counterexamples, generator and source hashes are retained separately.

The current combined production analyzer was freshly measured on all 340 authored controls
and all nine exact recorded PCM excerpts using the existing measurement runner and an exclusive
new output `accepted-timing-v2-dc1-integration-01.json` with 64 source snapshots. Default/v1
outputs and all 659 corrected-v2 statuses/times match the previous record; v2 support fields
honestly expand. Recorded counts remain 85 refined, 535 no-candidate, 27 ambiguous, 6 insufficient
and 6 gradual. Musical truth/accuracy remain null. Observed full-analysis totals are about
95.2 seconds baseline and 100.0 seconds opted-in, with about 9.3 seconds local v2 processing;
concurrent validation and single observations make this **not a controlled performance comparison**.
No previous measurement, annotation or source bundle was overwritten.

## First full integration gate and final contract finding

Run `20261020T203333-2c566eaa64b2` used active inventory v0016 (1585 protected paths,
ten explicit reviewed predecessor test migrations). Build passed; all 166 active Node files
ran, 1553 tests: 1544 passed, nine failed. All nine exactly match the retained known Wormhole
signatures; zero unknown failures, skips, cancellations or todo. Python passed 316/316 in all
28 active files. Post-run inventory passed and the 324-file production/lab source identity did
not change during execution. The overall harness correctly remains **failed**, exit 1.
Full evidence SHA256: `226867ed96f4b6873ef28929c89efcf748ba80dc2384d1f6f10a2b64b6aaec6e`.

The browser smoke was actual in-app UI automation against a localhost-only dev server, not
HTTP-only. A generated 60-second 128 BPM WAV produced BPM 128, 125 accepted events, 89 localized
and 91 playable notes in corrected-v2 mode. Play, empty-space mouse dragging, camera-facing pause
menu, keyboard/mouse settings navigation, the visible 4K choice/raster and return to Max worked.
Resume reached natural end and Results with 91 misses (no target-playing accuracy claim).
Captured browser error logs were empty. One file-chooser attempt timed out; the supported chooser
flow on the actual file input succeeded. Physical mobile/Quest, sustained 4K throughput and
musical annotation accuracy are not established. The finite background plane edge remains
visible at sufficiently oblique camera angles; this feature does not add a skybox.

Final contract inspection then caught a real omission that the default-only schema tests had
missed: optional `TrackAnalysis.eventTiming` was absent from the strict authoritative AnalysisResult
JSON schema. The standard laboratory bridge/config also rejected its string option. These are
corrected with a strict additive report/observation schema and separate enum validation in both
bridge and Python config. All predecessor schema definitions remain semantically identical.
Actual PlexusAdapter output now tests default/v1/corrected-v2 against JSONschema, malformed reports
and options fail closed, and a separate real worker test compares complete publications with
direct analysis for all three modes. Historical schema/source snapshots are not rewritten.
The new contract changes require a new inventory/version and another full gate below.

The focused follow-up passed 25/25 Python cases and the real worker publication test.
An independent documentation/test reviewer accepted commit `f1dc780`: removing the optional
property and its two new definitions reproduces the entire predecessor schema exactly;
the default, numeric validation, copy policy and historical v2 compatibility remain intact.
Active inventory v0017 records exactly three reviewed replacements (schema, bridge, config)
and adds the two actual transport test files. It does not replace historical schemas.

## Repeatable commands and preservation policy

Validation uses the existing Node/npm and Oracle Python environment, with no dependency
installation or upgrade. From the app root, the full command is:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:NUMBA_CACHE_DIR=(Join-Path (Get-Location).Path 'research/analyzer-lab/.cache/numba-integration-20261020')
& '<original-oracle>/research/analyzer-lab/.venv/Scripts/python.exe' research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/xr-oracle-onset-full-20261020-02.json
```

The harness executes the declared build and recursive npm test runner, followed by the whole
lab pytest tree with a unique temporary directory. It records exact coverage, failure
signatures, runtime identities, before/after inventory and source hashes. Reports use exclusive
new filenames. `inventory.local/verify-staged-bytes.mjs` additionally compares raw Git index
blobs against every protected source, every inventory/ZIP and the full-run source identity.
The v0016 gate verified 1889 entries after preserving `package-lock.json` raw bytes with a
scoped attribute; the lockfile's parsed dependency contents did not change.

The repository diff-export workflow was considered; targeted Git diffs, source inspection,
independent reviewers and explicit raw-byte provenance checks were used instead of generating
an additional broad snapshot. Local browser automation used native user actions and the actual
file chooser. Its temporary tab and the localhost dev server were closed after QA.

Closure preserves the complete independent repositories, including ignored PCM, measurement
caches, installed environments, runs/models and the original uncommitted onset source, by
same-volume moves to `C:/Users/budap/Plexus Archives/2026-10-20/`. The old absolute paths in
historical evidence remain unchanged; the archive README records relocation and virtual-
environment limitations. The separate assessment copies/logs are retained there as well.
Each repository's HEAD and working-tree status are compared before/after its move. Only then
may its clean outer worktree be removed, without force. The primary `C:/novy` worktree and
the separate `claude/xr-world-formation` branch remain.

## Final full integration gate

Run `20261020T205731-325608e2de98` uses inventory v0017 (1587 protected paths).
Build passed in 6 seconds. All 167 active Node files ran: **1554 tests, 1545 passed,
9 failed**, with no skips, cancellations or todo. All nine failures match the exact retained
Wormhole baseline signatures; there are **zero unknown failures**. All 29 active lab files
ran: **341/341 Python tests passed**. The post-run inventory passed with no issues and the
production/lab source identity did not change during execution. The harness correctly
returns **failed, exit 1** because known failures remain; no baseline was weakened or hidden.
The Node command took about 552 seconds and Python about 45 seconds; these are execution
observations, not performance benchmarks.

Full evidence SHA256: `8594a37dae0c7ee12ecab3f6e8d83576f8968c28368b65e2946e01a611afc623`.
The compact immutable run record is
[retained here](../../research/analyzer-lab/tools/harness/history/20261020T205731-325608e2de98.json).
Full JSON, structured Node logs, pytest XML and local byte/deployment checks are preserved
in the complete XR archive. Runtime discovery selected Node 25.2.1/npm and the existing
Oracle Python environment; TypeScript 6.0.3 and Vite 8.0.14 built successfully. The normal
Vite chunk-size warning remains a warning. No dependencies were installed or updated.

The user-authorized publication uses the tested `dist` directly. The declared deploy script
requires unavailable Bun, so the existing Node publisher is the equivalent fallback:

```powershell
node node_modules/gh-pages/bin/gh-pages.js --dist dist --repo https://github.com/philofobreal/plexus-engine.git --branch gh-pages --nojekyll --message 'Deploy reviewed XR and Analyzer Oracle integration'
```

Publication verification compares all 51 published files against the tested local build
and checks live root/MVP/XR HTML plus the XR referenced assets by SHA256. The resulting
publication proof and closure result are local completion artifacts in the preservation
archive; publication does not change the reviewed source.
