# Timed music events (T11 partial)

## T11a — traceable accepted events

One small additive layer, not a new detector or player switch. Analyzer publishes trackAnalysis.musicEvents; the existing worker transports it and the canonical normalizer validates/clones it against the real feature clock and accepted BeatEvents. Legacy/empty payloads remain valid and keep their old chart. No algorithm-7 math, cache key, accepted-event time/intensity/type, cue, scoring or rendering behavior changes.

Each accepted event has a stable ID within this analysis, exact original song time, integer sample position, accepted-event index, strength/type provenance and the real half-open feature support window, clipped to PCM length. Uncertainty is explicitly the engineering feature window, not a probability interval. Source is accepted-visual; family transient includes FX hits, not a claimed drum/instrument identity. No new onset, note offset, sustain span or source identity is invented. Empty accepted lists do not prove silence.

## Existing capability inventory

| Existing source | Current meaning and boundary |
| --- | --- |
| BeatEvent / DramaturgyBuilder | Accepted visual hits, preserved exactly; current chart remains authoritative |
| AcousticOnsets / PredictiveOnsets / AdaptiveOnsets | Optional diagnostic acoustic candidates; separate from accepted eligibility |
| BandOnsets / difference / continuation / peak modules | Research candidate families and pre-existing tests; no automatic promotion |
| PitchCandidates | Engineering periodicity proposals, unverified mixtures; pitch change is not a note onset |
| HarmonicEvidence / HarmonicForecast | Diagnostic harmonic compatibility/forecast, not source identity or vocal detection |
| MusicalEntityTracker | Registry of supplied boundaries/notes, no inferred isolation; not artistic motif identity |
| VisualFeatureFrame melody/vocal | Heuristic display scores; never copied into event-family labels |

Tonal/vocal recognition is unsupported, acoustic onset accuracy unverified, dominance unknown. The normalizer rejects a payload claiming otherwise under this schema. A real tonal onset/offset/sustain and dominance producer still needs timed evidence for silence, overlapping/held/repeated/legato/vocal/FX cases; window coverage, hysteresis and minimum hold must be measured before its outputs can reach the chart. This delivery does not implement that producer or report musical accuracy. T11 remains partial.

## Verification

Six focused tests cover sample/tail support, immutable exact legacy projection, empty/unknown behavior, bad clocks/duplicates, malformed/forged capabilities, association mismatch, worker transport, legacy payloads and complete analyzer parity for default and existing lab v1/v2. Existing analyzer golden, verification, timing and chart suites remain active. No historical experiment result is rewritten.

Build/diff pass. Targeted **82/82**, schema **9/9**; full **1756 tests / 1747 pass / nine exact retained failures**, zero skips/cancellations. Failure names/assertion messages match the T10 cleanup baseline. No old numeric snapshot changed. Real Scienide local worker load/play/pause retains 824 notes/781 arrows/56 pairs, no console warnings/errors. Current-run evidence: logs/timing-cleanup/t11-*.

Commands: npm run build; npm test -- --test-reporter=tap; git diff --check; node --test --test-reporter=tap tests/music-events.test.mjs tests/xr-timing-modes.test.mjs tests/xr-audio-integration.test.mjs tests/xr-controller-regeneration.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-signal-contract.test.mjs tests/event-timing-worker-contract.test.mjs tests/accepted-timing-measurement.test.mjs tests/band-proposal-index.test.mjs (82/82). Additional schema check: node --test --test-reporter=tap tests/analyzer-baseline.test.mjs tests/analyzer-contract.test.mjs tests/music-events.test.mjs (9/9). The pre-existing JSON schema gains one optional property and strict definitions; numeric baselines are unchanged.

Node 25.2.1/npm 11.6.2, Node gh-pages publisher replaces the package script's unavailable Bun. Python pytest is unavailable and not run; no Python inference changes. No physical Quest latency/FPS measurement. Full tests need existing temp/Git fixture permissions. Publishing: node scripts/release-pages.mjs prepare t11a-events, then publish and verify. The publisher retains only hashes, normalizes Git CRLF/LF text for verification, and limits parallel network reads to six after a transient connection reset. No dependency install or source/force push.

No new menu or visible rhythm change is expected. Manually check loading, playback, pause and the familiar chart after deployment. New files for T11a: one source module, one regression file and this note. No source snapshots or generated report set.

Deployed 6a7ed740e24f9f5eba5a4b6ffb955a8baf1be74a, release t11a-events-20261024T180844738Z: [live XR](https://philofobreal.github.io/plexus-engine/xr/?release=t11a-events-20261024T180844738Z). 53 public files/three routes verified against the build (32 copied public text files normalized only for Git CRLF/LF), 345 source hashes unchanged. Real public Scienide load/play/pause passes with the same 824/781/56 chart and no console warnings/errors. Audio cleared; existing viewer preferences preserved. Stop for manual test. T11 remains partial; tonal/onset-offset/sustain/dominance producer work is not implemented, T12 not started.

## T11b — acoustic activity evidence (2026-10-25)

Owner: analyzer/contracts; this chat is the single integration owner. `trackAnalysis.musicActivity`
is a separate additive, deterministic `acoustic-activity-v1` publication from the original analysis
PCM. It runs once during loading in the existing analyzer worker. No renderer/frame DSP, research
runtime dependency, new button, chart change, grid change or retiming is introduced. Algorithm-7
numeric behavior stays intact; this sidecar has its own identity. Loading already invokes analysis,
while legacy/imported results may omit the sidecar and continue through the existing fallback.

- Activity uses AC energy (absolute RMS floor 1e-5, not track-relative normalization), two complete
  quiet windows to close a span, and explicit censored start/end boundaries. A partial padded tail
  cannot prove an offset. `sustainSamples` means an activity span of at least 120 ms; release hold
  can bridge a short quiet gap. It does **not** assert a single held musical note or note release.
- Attacks are energy-rise **candidates**, at most one per feature frame with a 60 ms localized
  refractory interval. Re-articulation requires a measured dip and rise; pitch change alone is not
  a trigger. Localization searches the preceding/current observed window, bounded by the current
  activity and previous attack. IDs are local to this analysis; `observationFrame`, original song
  time/sample position and half-open sample support retain provenance. Support bounds describe
  engineering uncertainty/observations, never a statistical confidence interval.
- The read-only FFT observer borrows the existing transform. AC spectral concentration subtracts
  the observed Hann-window DC contribution, including a clipped tail; only the fixed Hann transform
  and one partial-tail window transform are additional. The existing FFT/PCM arrays are not changed.
- `family` is the **aggregated spectral texture of its declared support window**, including about
  60 ms lookahead. It is not the timbre of an isolated attack: an impulse followed by a tone can
  have tonal support. Six peak neighborhoods distinguish tonal/broadband/mixed texture; windows
  shorter than 512 samples or 15 ms abstain with unknown. No F0, instrument, voice or source identity
  is inferred. All confidence values remain null; RMS and power ratios are engineering measurements.
- `dominance` is acoustic texture, not musical-role/source dominance: trailing 200 ms aggregation,
  at least 80 ms/two-frame confirmation, 200 ms minimum hold and separate entry/exit thresholds.
  Coverage is contiguous over real PCM, initially unknown; `decisionSample` exposes when the
  offline window is available. Silence means below the stated AC floor, not a missing accepted hit.
- The canonical normalizer validates clocks, frame/localization/support association, order,
  censoring, texture-resolution abstention, bounded arrays and capability identity, then deep copies.
  Malformed layers are omitted; the old chart remains usable. The JSON schema describes strict
  shape; existing small schema test helpers do not implement every JSON Schema keyword, so the
  targeted runtime-normalizer rejection tests establish the numeric/censoring invariants.

The 13 authored signal kinds cover silence/DC/below-floor, held/repeated/legato/vibrato, noise/FX-like
bursts, overlap, sparse/dense starts and clipped boundaries. Development tuning changed the valley
comparison to preserve rises split across coarse windows (the first 16 kHz/1024 dense development
run recovered 8/12; the revised run recovers all 12). Transfer rates/phases/frequencies/seeds were
fixed before measurement and remain separate. No recorded-music accuracy is inferred from this.

The retained two-provider pitch results are replayed only on identical reconstructed PCM: 40 cases,
388 original agreement pairs, reported as a texture cross-tab, **not** onset/offset or vocal truth.
The original librosa/audioFlux environments are unavailable; no new provider inference was run.
For the three MP3s, FFmpeg decoding matches original lengths and file hashes but differs from the
retained SoundFile PCM hashes in all nine reference excerpts. The runner therefore abstains from
comparing their original onset votes; it does not silently relabel or align mismatched samples.
Every pre-existing analyzer output is compared exactly on each full newly decoded recording.

One reusable runner writes one exclusive result under ignored logs, never a source-copy tree:
`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\Prodigy" --output logs/t11b/measurement-quiet.json`.
It records delivery-file hashes, Node/decoder identity and alternated warm pairs on 20-second excerpts.
`performance.now()` measures offline elapsed analyzer time, not process CPU time, render FPS or
physical Quest latency. Full source identity belongs to the eventual source commit.

T11 remains partial: true note offset/sustain, validated percussive-versus-tonal attacks, musical
roles and vocal/source identity are still unsupported. `xrScoring: ineligible` and
`consumerUse: signal-evidence-only` explicitly prevent treating this as chart-eligible proof.
T12 is not started. Manual expectation: loading/play/pause and the familiar chart stay the same;
this delivery supplies measured internal evidence for the remaining T11 work.

### T11b verification and handoff

`npm run build` and `git diff --check` pass. Targeted analyzer/golden/timing/worker/XR regression:
94/94. Full `npm test -- --test-reporter=tap`: 1782 tests, 1773 pass, nine existing failures;
all nine names and exact assertion messages equal the cleanup baseline, zero skipped/cancelled.
After final publication-boundary tightening, the 21-test activity/events/schema package also passes.
All 1770 predecessor cases remain active; no historical measurement/source fixture is rewritten.
The protected source-evolution manifest retains superseded hashes and names the additive FFT
observer/publication migration; no new source snapshot tree or numeric golden update.

Exact targeted command: `node --test --test-reporter=tap tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs tests/accepted-timing-measurement.test.mjs tests/analyzer-band-onsets.test.mjs tests/music-events.test.mjs tests/music-activity.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-signal-contract.test.mjs tests/event-timing-worker-contract.test.mjs tests/xr-audio-integration.test.mjs tests/xr-controller-regeneration.test.mjs`.
Final boundary command: `node --test --test-reporter=tap tests/music-activity.test.mjs tests/music-events.test.mjs tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs`.
Node 25.2.1/npm 11.6.2 execute the declared scripts. No dependency install or Python inference change;
Python models and physical Quest measurements were not run. Full suite uses the existing temp/Git
fixture filesystem escalation. The optional diff-export script is not run because it duplicates
source archives; direct `git diff` review preserves the user's minimal-artifact requirement.

Local real-worker Scienide load/play/pause passes with 824 notes/781 arrows/56 pairs and no console
warnings/errors. No presentation setting is changed; test audio is cleared. Publish from the clean
committed branch with `node scripts/release-pages.mjs prepare t11b-activity`, then `publish` and
`verify`; the live release marker binds the exact source commit/build inputs. The final handoff
reports the verified release URL. Stop for manual loading/playback/pause/chart feedback afterward.


Final signal measurement (`logs/t11b/measurement-quiet.json`): development 23/23 authored attacks,
transfer 46/46, no extras in either split (P/R/F1 = 1 on this authored corpus only). Signed bias
is +1.90/+1.87 ms; absolute p50 2.19/2.13 ms and p95 2.19/2.56 ms. Matching tolerance is explicitly
1024/sampleRate + 4 ms, not an undisclosed musical-accuracy target. The nine entirely negative
silence/DC/below-floor cases total 19.8 s with zero false candidates (0 FP/min on that small corpus).
Held/legato/vibrato/noise each retain only their authored initial rise. The initial coarse-window
failure remains in ignored measurement logs; historical reference files are unchanged.

| Full recording | Exact legacy output | Warm 20 s excerpt median: old / new | Extra sidecar JSON |
| --- | --- | --- | --- |
| Goa | yes | 271.4 / 284.9 ms (+5.0%) | 620053 bytes |
| No Good | yes | 271.6 / 300.6 ms (+10.7%) | 621612 bytes |
| Scienide | yes | 273.9 / 283.1 ms (+3.4%) | 411814 bytes |

Five alternating pairs after warmup, separate from the regression run, with visible elapsed-time
noise; these are observations, not a hardware performance guarantee. Each sidecar is published
once per analysis; render messages and per-frame host work are unchanged. No physical Quest test.
New files: one DSP module, one authored corpus, one regression file and one reusable diagnostic.

## T11c — quiet spectral entries over a tonal carrier (2026-10-25)

Adds optional `musicActivity.spectralEntries`, version `tonal-carrier-entry-v1`, with null
confidence and explicit signal-evidence-only / scoring-ineligible status. This is a raw candidate
producer for a quiet new spectral component over a persistent tonal carrier. It is not source
separation, vocal/percussion identity, musical-role dominance or chart promotion. The existing
`attacks[].family` remains the original 60 ms context texture, including its known impulse-then-tone
limitation; this delivery does not reinterpret that field or claim that limitation is solved.

The existing DC-corrected shared FFT feeds a fixed three-spectrum ring and one scratch spectrum
(16 KiB extra spectral storage at hop1024, plus small peak records). No additional PCM FFT or
spectrogram is computed. All work runs once in the existing analyzer worker during load.
Three prior complete windows must have concentration >=0.8 and power max/min <=1.2. Novelty is
positive power above four times the oldest prefix spectrum, outside two-bin neighborhoods of
its occupied peaks; it must exceed 0.5% of current power and the absolute AC floor. This measures
new spectral energy, not probability. Previously occupied carrier power must retain at least
80% over three complete body windows, so replacement/legato/cutoff is rejected conservatively.
Windows below 512 samples/15 ms and incomplete body tails abstain.

Timing uses a two-tap predictor fitted only on `[anchor-3hop, anchor-hop]`, strictly before the
localization search `[anchor-hop, anchor+hop]`. Mean/coefficient/fit error never use attack/body
samples. Prefix residual fraction must be <=0.05; a maximum positive 2 ms residual-energy step
localizes the proposal. Published prefix/body/full support and decisionSample expose all evidence,
including offline lookahead. Candidate times are original song/sample times; playback/judge/grid
clocks are unchanged. A 150 ms localized refractory and conservative dedup against existing energy
attacks prevent duplicate candidate floods. Complete support is required; missing output is not
proof of silence or of absent notes. Nearby/coincident frequencies, nonstationary or broadband
backgrounds and source identities remain outside the validated scope.

One integration owner updates analyzer/types/schema/normalization; an independent read-only audit
caught and verified correction of a prefix that initially extended past the search start. The
normalizer now binds frame/clock/support, prefixEnd<=event, complete body, engineering bounds,
order, refractory/dedup, scope and version, then clones the extension. Legacy T11b payloads without
it remain valid. Unknown fields cannot introduce a source identity. A frozen aggregate digest from
T11b commit `a1a0eaa63f143f9fa374d9c03f89a18f2c4dddb5` preserves all 13 original development outputs.
Full-recording comparisons additionally require every previous T11b field and every legacy
analyzer/chart input to be exactly equal. Earlier source/measurements remain in Git and unchanged
retained fixtures; no source-copy tree, new file family, button, setting or dependency is added.

The existing corpus/runner are extended with 15 authored conditions at three clocks: quiet tone,
repeated quiet tone, 60 ms noise hit, stable carrier, legato, 20 ms crossfade, glide, vibrato, AM,
gain ramp, cutoff, noise bed, DC, below-floor and clipped body. These are engineering regressions
from known generator families, not an independent musical holdout/generalization claim. The
clipped-body case has a real onset and insufficient body support: it is reported separately as
abstention, never as a completely negative case. Matching tolerance is hop/sampleRate + 4 ms.
Additional tests sweep five subwindow phases at each clock, DC/gain, future-prefix independence,
malformed/legacy packets and positive real-worker transport. No truth pitch/F0/source is supplied
to the production detector. The original two-model periodicity/onset evidence does not label
this new component class; retained recorded decoder mismatch still forbids an accuracy claim.

Reproduction: `node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\Prodigy" --output logs/t11c/measurement-final.json`.
Current protocol extends T11b's reusable runner, using its Git-identified producer as the paired
baseline. It writes one exclusive ignored result; full source identity belongs to the source
commit. Alternate five warm pairs on 20 s excerpts measure elapsed analysis time, not FPS/CPU time.

T11 remains partial; T12 has not started. The player-facing chart stays unchanged. After deploy,
manually check loading, play/pause and the familiar chart before continuing T11's remaining
musical note-boundary/role work. Actual vocal/source/note identity remains unsupported.

### T11c measured results

`logs/t11c/measurement-final.json` preserves all input/source/decoder identities and raw pairs.
Complete-body controls: development 4/4 matched additions, transfer 8/8, no extras (conditional
P/R/F1=1, only 12 authored events). Matched-only signed bias +3.86/+2.21 ms, absolute p50
2.44/2.24 ms, p95 8.13/2.43 ms. Eleven no-addition controls per clock give 66 s negative exposure,
zero extra entries (0 FP/min on these controls). Three physically present clipped-tail onsets are
correctly abstained, 0/3 detected; overall physical-onset recall including them is 12/15=80%,
not 100%. Complete-body coverage, small sample size and generator dependence limit these scores.
All 15 subwindow-phase checks, DC/gain, future-prefix independence and positive worker transport pass.

| Full decoded recording | All legacy/T11b values exact | Extra raw entries | Warm 20 s median T11b / T11c |
| --- | --- | --- | --- |
| Goa | yes / yes | 9 | 264.1 / 274.9 ms (+4.1%) |
| No Good | yes / yes | 26 | 318.7 / 273.3 ms (-14.3%) |
| Scienide | yes / yes | 3 | 270.8 / 266.7 ms (-1.5%) |

Five paired elapsed-time observations have substantial scheduling/JIT/GC variation; negative
percentages are not a speedup claim. These are offline Node observations, not Quest/render FPS.
New entries increase the once-per-load JSON by about 1.2–9.7 KiB; render packets stay unchanged.
Recorded candidate counts are not accuracy. Original two-model votes remain unused on mismatched
recorded PCM; no new provider inference/calibration or source-identity assertion is made.

### T11c verification and delivery

`npm run build` and `git diff --check` pass. Targeted regression 96/96; full
`npm test -- --test-reporter=tap`: 1788 tests /1779 pass /nine exact known failures, zero skips or
cancellations. All nine names and assertion messages match the retained cleanup baseline.
After hardening raw-proposal dedup lookup against out-of-order localization, final boundary tests
pass 21/21. Six new tests extend the existing active regression file; all 1782 predecessor tests
remain active. No protected source/result fixture or numeric golden is rewritten.

Exact targeted command: `node --test --test-reporter=tap tests/music-activity.test.mjs tests/music-events.test.mjs tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs tests/accepted-timing-measurement.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-signal-contract.test.mjs tests/event-timing-worker-contract.test.mjs tests/xr-audio-integration.test.mjs tests/xr-controller-regeneration.test.mjs`.
Final boundary command: `node --test --test-reporter=tap tests/music-activity.test.mjs tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs`.
Node25.2.1/npm11.6.2 execute the declared scripts; no runtime fallback or dependency install.
Full suite uses the established temp/Git-fixture escalation. Python models/pytest and physical
Quest measurements are not run; no Python inference code changes. Direct Git diff review replaces
the optional source-copy diff export, preserving the minimal-artifact request.

Publish the clean committed source using `node scripts/release-pages.mjs prepare t11c-spectral-entry`,
then `publish` and `verify`. The release marker binds source/build identities; the delivery handoff
records verified live files/routes and the public load/play/pause smoke result. Pause for manual
feedback after deployment. Resume partial T11 from this checkpoint, not T12.


## T11d - Entry-frozen band activity (2026-10-25)

T11c accepted. Optional `musicActivity.bandActivity`, algorithm
`entry-fixed-band-activity-v1`, measures when the entry's frozen frequency mask becomes quiet
above its frozen prefix background. It does not infer the end of an isolated note/source.
`scope: frozen-frequency-mask`, `sourceOwnership: unresolved`, null confidence and scoring
ineligibility are contractual. The original T11b/c fields, accepted hits and clock are unchanged.

### Measurement and resource boundary

At each provisional T11c entry, freeze up to six positive-excess peaks and their immediate
neighbor bins (at most 18 distinct positive-frequency bins). Ignore peaks below 2% of the
largest excess peak to exclude numerical/DC roundoff. These are NEW excess bins, distinct from
the old carrier-retention bins. Freeze four times the prefix power per bin as background, using
the same baseline as the entry detector. The mask is fixed; it is not retuned from future PCM.

Each complete borrowed FFT window supplies sum(max(binPower - frozenBackground, 0)). The maximum
of the three entry body windows sets a reference; later louder sources cannot increase it.
Two consecutive complete windows below 10% of that reference (or the absolute AC power floor)
close the activity at the first quiet-window start. Partial/padded tails cannot close it.
No extra PCM FFT, neural inference, spectrogram or frame-loop work is introduced. At most 32
provisional masks run concurrently, with at most 18 bin reads each. Proposal records remain
bounded by feature-frame count, as in T11c. This is offline worker work and one result per load.

Only finally accepted T11c entries publish a band record, matched by observation frame/local
entry ID. `startSample` is the associated entry localization, not a new band-onset measurement.
`maskSupportSamples` covers prefix through seed-window end. A confirmed record carries its first
quiet-window `endSample`, offset support from the preceding through both confirmation windows,
and `decisionSample` no earlier than both entry acceptance and full quiet confirmation.

At file end, the record ends at real PCM length with `rightCensored: true`, null offset support
and reason `file-boundary`; it asserts no observed offset. Resource saturation instead publishes
`budget-exceeded`, empty bins, null end/support, and the entry's decision time. It never invents
a release or silently removes an accepted entry. Normalization checks version/scope, exact entry
association, bounded sorted unique bins, clocks, censoring and full confirmation support, and
clones all arrays. Old payloads without the extension remain valid.

### Interpretation and promotion

Use this only as signal evidence to inspect entry-associated frequency-band activity. No player
control is added: no chart/render feature consumes it. It does not change note count, scoring,
visual presets or the existing MVP/XR Offscreen path. Any future player use must follow the
menu/localStorage/Copy and preset relevance rules and first pass its own evidence/promotion gate.

A same/near-bin overlapping sound may keep the mask active after the original source ends.
A pitch glide may leave the mask while the source still sounds. A fade crosses the relative
power threshold before its last nonzero sample. Frozen background changes and broadband masks
likewise are not source separation. Existing T11c proposals can multiply under added-tone AM,
glide or near-band overlap; these remain raw candidates, not inferred repeated notes. Tests keep
these limitations explicit rather than altering the retained detector or calling them accuracy.
The old `attack.family` is still context texture. Vocal, instrument and musical role identity
remain unsupported; **T11 is partial and T12 has not started**.

### T11d validation and delivery

Seven tests extend the active Node suite (six activity tests and positive/censored worker-schema
coverage); all predecessor tests and historical results remain. Frozen T11b and T11c aggregate
identities verify unchanged evidence on their original corpora. New authored controls cover
quiet releases against a continuing carrier, repeats, broadband hits, held/AM/vibrato entries,
same/near-band overlap, glide, fade, carrier cutoff, file boundaries, partial/one-quiet tails,
gain/polarity/DC invariance, malformed normalization and explicitly injected resource saturation.
Resource injection checks the capacity path; it is not an acoustic accuracy measurement.

The existing measurement runner extends its protocol to `t11d-fixed-band-activity-1`, retains
prior authored/periodicity comparisons and uses the Git-identified T11c producer as the paired
cost baseline. Previous model onset/pitch agreements supply no offset truth. Recorded PCM
identity mismatches remain abstentions; raw real-recording band counts are not musical accuracy.
One ignored JSON per run is used; no generated source copies or new experiment/report family.

Current measurement: `logs/t11d/measurement-final.json` (ignored), 39 original attack controls,
45 prior entry controls, 30 new band controls and 40 exact-PCM prior periodicity cases. Four
complete-body release references in development and eight in transfer all have confirmed
endpoints within one hop, with every authored endpoint inside published support. Matched-only
signed bias / absolute p50 / p95: development +12 /10 /16 ms; transfer +6.485 /7.438 /25.238 ms
(nearest-rank absolute percentiles). These small authored controls do not establish general
musical source-offset accuracy. Of the new band controls, all 15 applicable endpoint references
are inside support; nine held/partial/one-quiet-tail cases correctly remain censored. Six
fade/glide controls intentionally have no source-end accuracy score.

| Full decoded recording | All legacy/T11b/T11c values exact | Closed fixed masks | Extra payload | Warm 20 s median T11c / T11d |
|---|---|---|---|---|

| Goa | Yes | 9 | 2747 bytes | 285.952 /275.582 ms (-3.63%) |
| No Good | Yes | 26 | 7974 bytes | 295.793 /267.314 ms (-9.63%) |
| Scienide | Yes | 3 | 1035 bytes | 250.703 /263.318 ms (+5.03%) |

Five alternating warm pairs measure offline Node elapsed analyzer time, not CPU time, browser
FPS or Quest main-thread cost. Negative deltas reflect JIT/GC/scheduling noise, not a claimed
speedup. No recording exhausted the monitor budget. Nine decoder contexts still fail exact PCM
identity against earlier SoundFile evidence; no new precision/recall is claimed from those votes.
Fixed-mask support/ownership limits above apply to every raw recorded result.

Owner: parent owns analyzer, additive type/schema/normalizer and integration. Read-only subagent
review found no blocking producer/support issue and verified AM/vibrato/overlap/glide/tail cases.
The 32 limit bounds concurrent active monitors, not total retained proposal memory; total retained
band/bin/baseline data is O(raw proposals), bounded by feature-frame count. Normalization checks
each record's format and association; only the producer enforces concurrent-monitor capacity.

Final validation uses Node25.2.1/npm11.6.2 with no runtime fallback or dependency installation.
`npm run build` passes (existing chunk-size warning only). Targeted command:
`node --test --test-reporter=tap tests/music-activity.test.mjs tests/music-events.test.mjs tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs tests/accepted-timing-measurement.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-signal-contract.test.mjs tests/event-timing-worker-contract.test.mjs tests/xr-audio-integration.test.mjs tests/xr-controller-regeneration.test.mjs`.
Measurement command:
`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:/novy/Plexus Engine (VJ System)/plexus-engine/tests/audio/Prodigy" --output logs/t11d/measurement-final.json`.
Full cumulative command: `npm test -- --test-reporter=tap` (established temp/Git-fixture escalation).
Python models/pytest and physical Quest measurements are not run: no Python inference changes,
no physical headset. Direct Git diff review replaces optional `diff_export.ps1`; no duplicate
source archive is generated. Deployment follows the clean-source `release-pages.mjs`
prepare/publish/verify path, then public browser file-load/play/pause smoke and a manual pause.

Final results: targeted 103/103, cumulative 1795 tests /1786 pass /nine exact retained failures,
zero skips/cancellations. All nine names AND assertion messages exactly match
`logs/timing-cleanup/baseline-failures.json`, recorded in `logs/t11d/failure-comparison.json`.
The final full suite includes the sparse-array hardening. `logs/t11d/build-final.log`,
`targeted.tap` and `full.tap` retain local evidence; `git diff --check` passes. Seven new tests are
added to the 1788 active predecessor tests, with no baseline/golden result rewritten.


## T11e - Dominant excess neighborhood context (2026-10-25)

T11d accepted. Optional `musicActivity.entryContexts` adds algorithm
`entry-prefix-neighborhood-v1`, scoped to `dominant-excess-neighborhood`. It is a conservative
measurement of a small frequency neighborhood before a raw entry, not a duplicate filter or
recognition of a new note/source. All T11b/c/d fields and accepted chart inputs remain exact.
Confidence is null, source ownership unresolved and chart scoring ineligible.

For the strongest positive-excess peak, freeze its FFT bin and read power within four bins on
either side in the two guaranteed pre-search windows f-3 and f-2. Take the larger neighborhood
power. Do NOT use f-1: a valid entry can localize inside it. Compare that prefix measurement with
current seed-window power within one bin of the same peak, and retain the ratio plus Parseval-
scaled prefix AC power (engineering units, not calibrated source loudness). The policy is fixed
by the algorithm version: prefix power above 1e-10 AND ratio >=.025 gives
`occupied-neighborhood`; prefix power <=1e-10 AND ratio <=.0025 gives
`unoccupied-neighborhood`; everything between is `uncertain`. Producer and normalizer share the
same dependency-light contract classifier. This is at most 21 bin reads per raw proposal,
three retained scalars, no new FFT, spectral-history copy, active monitor or render work.

Unoccupied means only below the declared floor in those two Hann-weighted neighborhoods. It
does not prove physical silence or a new source: other novelty peaks, window edges, frequency
leaps and masked sounds are outside this narrow claim. Occupied is not a false-attack label:
a true new sound can enter the same neighborhood, and a true re-articulation can occur before
old context decays. A fast glide may outrun the fixed neighborhood. Neither label deletes raw
candidates or enables chart consumption. Player menu/localStorage/Copy and relevant preset rules
continue to apply to any future player feature; no player switch is introduced for this evidence.

### Measurement support versus retrospective publication

An explicit regression revealed an inherited T11c limit: its energy-attack dedup is retrospective.
At44.1k/H1024 with .2/.3/.4-hop shifted entries, changing only samples after the old local
`decisionSample` creates a later energy attack localized backwards into the dedup neighborhood,
removing the earlier raw entry. The frozen prefix/bin values are unchanged, but the final entry
list is not generally causal at that timestamp. T11c `decisionSample` is its local complete-body
gate; T11d's corresponding value is its local body/quiet-confirmation gate. Neither is a promise
that an associated record is irrevocably published online at that time. Prior metadata values
and historical measurements are retained, with this limitation made explicit here.

The new layer therefore declares `publication: full-track-analysis`, and each record's
`decisionSample` is the real PCM length. Its separate `prefixSamples` and `seedSamples` retain
the actual local measurement support. Publish one record per final accepted entry ID only;
rejected provisional contexts never leak. This does not delay playback: analysis already runs
once in the worker before loading completes. No streaming consumer may infer an earlier stable
publication deadline from a local body gate.

Normalization checks version/scope/publication, exact entry-ID/order, peak-bin range, clean
prefix, seed clock, full-track decision time, finite nonnegative engineering values and derived
classification, then clones every array. When a non-budget T11d band record is also present,
the dominant peak must belong to its frozen bins. Older payloads can omit the new extension;
a context can remain independently valid without the optional band layer.

### Validation and promotion boundary

The frozen T11d producer commit `4fb6ba2e5f0d52c4ef0008aa75e3e4aab9b1a369` supplies a new aggregate
identity over the unchanged 45 entry plus30 band controls. All existing T11b/c aggregate guards
remain active. On the prior20 extra AM/glide/near-overlap proposals,17 contexts are occupied and
three uncertain; none are unoccupied. The three uncertain22.05k glide contexts have above-floor
prefix residue with low neighborhood ratio; thresholds were not lowered to force a label.
This diagnostic separation is development evidence, not false-positive or musical accuracy.

Five appended tests add aggregate/raw/core/band preservation, three clocks and five subwindow
phases, polarity/gain/DC, policy/association/clone rejection, the retrospective suffix-dedup
counterexample and exact frozen provisional measurements. Sixteen declared new parameter cases
vary AM rate/depth, glide speed, true neighboring additions, repeat gaps and subwindow phase.
New transfer controls are authored regressions, not independent recordings or human truth.
True neighboring attacks can be occupied and remain raw candidates; no label is source accuracy.

The reusable measurement runner extends to `t11e-prefix-neighborhood-1`, preserving the previous
39 attack/45 entry/30 band/40 periodicity controls and adding16 context controls. Full recordings
must preserve all legacy/T11b/c/d outputs exactly. Compare current and Git-identified T11d
producers under the same pipeline in five alternating warm20s pairs. Decoder identity
mismatches remain abstentions; old onset/pitch consensus is not context/source truth.

Parent owns analyzer, additive contracts/schema/normalizer and integration. Read-only subagent
review found the inherited publication limit and the peak-to-band cross-invariant; both are now
covered explicitly. T11 remains partial: musical note boundaries/roles and vocal/instrument
identity are unsupported. T12 has not started. Wall stays Off; MVP/XR Offscreen remains intact.
No new source/report-file family or dependency is introduced.

### T11e measured results and commands

Primary result: `logs/t11e/measurement-final.json` (ignored, exclusive output). All earlier root
and T11b/c/d values are exact on all three full decoded recordings. Each recorded raw candidate
has occupied local context (9/26/3 respectively); this is not a count of false attacks or sources.
All nine prior decoded contexts remain PCM-identity mismatches, so musical accuracy stays null.

The16 new authored parameter cases contain24 physical additions and47 raw proposals:23 occupied,
23 unoccupied and one uncertain context. Three genuine neighboring additions remain occupied
raw candidates, as does one genuine short-gap repeat. In the22.05k fast-glide case, all four raw
contexts are unoccupied despite only one source onset: a fast sweep leaves the fixed neighborhood.
This explicitly prevents promotion of 'unoccupied' to a new-note/source classifier.

| Full decoded recording | All previous values exact | New context payload | Warm20s median T11d /T11e |
|---|---|---|---|
| Goa | Yes | 2457 bytes | 316.870 /385.427 ms (+21.64%) |
| No Good | Yes | 6740 bytes | 292.870 /338.735 ms (+15.66%) |
| Scienide | Yes | 974 bytes | 312.457 /319.736 ms (+2.33%) |

These are offline Node elapsed times over five alternating warm pairs, not CPU time, browser
frame cost or Quest performance. No per-frame DSP or render messages were added. The primary
elapsed overhead ranges from+2.33% to+21.64%; it does not support a zero-offline-cost claim.
A separate repeat after cumulative tests checks timing variability; retain both results rather
than choosing the better score. The additional payload is about1-7KB once per load.

`npm run build` passes (existing chunk-size warning only). Exact targeted command,108/108 pass:
`node --test --test-reporter=tap tests/music-activity.test.mjs tests/music-events.test.mjs tests/analyzer-contract.test.mjs tests/analyzer-baseline.test.mjs tests/accepted-timing-measurement.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs tests/analyzer-signal-contract.test.mjs tests/event-timing-worker-contract.test.mjs tests/xr-audio-integration.test.mjs tests/xr-controller-regeneration.test.mjs`.
Final boundary command,2/2 pass:
`node --test --test-reporter=tap --test-name-pattern="context normalization|full-track publication" tests/music-activity.test.mjs`.
Measurement command:
`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:/novy/Plexus Engine (VJ System)/plexus-engine/tests/audio/Prodigy" --output logs/t11e/measurement-final.json`.
Full cumulative command: `npm test -- --test-reporter=tap`, with established temp/Git-fixture
escalation. Node25.2.1/npm11.6.2; no runtime fallback or dependency installation. Python inference
models/pytest and physical Quest measurements are not run: no changed Python inference code or
physical headset. Direct Git diff review replaces optional `diff_export.ps1`, avoiding duplicate
source archives. Final source is committed/pushed, then the guarded `release-pages.mjs`
prepare/publish/verify and public browser load/play/pause smoke precede a manual pause.

Final cumulative result:1800 tests /1791 pass /nine exact retained failures, zero skips or
cancellations. All nine names AND assertion messages exactly match the cleanup baseline;
`logs/t11e/failure-comparison.json` records the comparison. All1795 predecessor tests remain
active alongside the five new tests. `logs/t11e/build-final.log`, `targeted.tap`, `full.tap` and
`final-boundary.tap` retain local evidence; `git diff --check` passes. No numeric baseline or
historical result was rewritten.


Repeat after cumulative tests: `logs/t11e/measurement-repeat.json`, same source hashes and
protocol. Every non-timing field, including all synthetic/recorded results and identities,
is exactly equal to the primary result. Repeat20s elapsed medians:

| Recording | T11d /T11e | Elapsed delta |
|---|---|---|
| Goa | 335.192 /352.578 ms | +5.19% |
| No Good | 337.049 /341.500 ms | +1.32% |
| Scienide | 309.735 /314.037 ms | +1.39% |

The repeat ranges from+1.32% to+5.19%, versus primary+2.33% to+21.64%. Retain both runs and raw
pairs; this variability cannot establish a precise CPU-cost percentage or a frame-rate effect.
It confirms a small added offline workload, with no measured zero-cost claim. Repeat invocation
is the same command with `--output logs/t11e/measurement-repeat.json`; no source copy/helper
family is created. Physical Quest acceptance and independent musical/source validation remain
outside these Node measurements.


## T11f - attack-local positive spectral change (2026-10-25)

T11e was accepted. Graphify was refreshed first: scripts and fixture generators are navigable,
with exact-symbol guidance in platform operations. The subsequent T11f owner is the parent for
analyzer, shared contract/schema, normalization and integration; a read-only analyzer reviewer
checks the DSP and boundary. Render-worker preparation omits unused acoustic evidence; UI,
audio lifecycle, render-frame algorithms and chart consumption are unchanged.

The inherited `AcousticAttack.family` is a **context texture** using60ms lookahead rounded
to feature windows (plus the triggering window), not the spectrum of an isolated attack. A later tone can recolor that context. The additive `attackChanges` sidecar
measures a shorter, attack-aligned positive spectral change. It does not replace that legacy
field, correct onset localization or classify percussive/tonal sounds. This is evidence toward
T11's later event/role qualification, not completed musical recognition or T12 chart promotion.

### Contract and measurement

Algorithm `attack-local-excess-v1`, scope `local-window-positive-spectrum`, source ownership
`unresolved`, confidence null, scoring ineligible, publication `full-track-analysis`.
Every accepted legacy energy attack has one record in the same order, identified by `attackId`.
Quiet spectral-entry candidates are outside this layer's coverage. No attack is added/deleted.

The common FFT size N is the largest power of two no longer than16ms, capped at512 and at the
feature hop. N must be at least128 and span at least8ms; otherwise records explicitly report
`insufficient-resolution`. Examples:16k/N256,22.05k/N256,44.1k or48k/N512. Above64k the bounded
window is too short and remains unavailable. These different frequency resolutions must not be
interpreted as a calibrated common sound-family score.

For localized sample a, body begins at `a-ceil(.002*fs)` and spans N samples. The equal-size
prefix ends4ms before that body begins. Prefix is a **pre-estimated-attack measurement window**,
not guaranteed silence or a true pre-onset window. Full real PCM is required; missing either
window reports `file-boundary`, null supports and null measurements. No zero-padding claims.
All records publish at the real PCM length, consistent with retrospective accepted attacks.

Both windows subtract their own Hann-weighted mean, multiply by Hann, then transform. This
rejects constant DC and avoids the large narrow-band artifact caused by unweighted centering
of an impulse at a Hann edge. Bins1..N/2-1 are used; DC and Nyquist are excluded. Define
`delta[k]=max(Pbody[k]-Pprefix[k],0)`. Measurements:

- `positivePower = 2*sum(delta)/(N*sum(Hann^2))`: window-normalized positive spectral change,
  not isolated-source loudness or an exact total AC RMS measurement.
- `positivePowerFraction = sum(delta)/sum(Pbody)`, or zero for a zero denominator.
- `peakBin`: strongest positive bin, with lowest-bin tie break. Its clipped +/-1-bin sum divided
  by **all** positive power is `peakNeighborhoodFraction`. It is concentration of this local
  change, not pitch, probability, source count or a sound-family classifier.

Above the existing1e-10 engineering power floor status is `measured`. At/below it status is
`below-floor`, with numeric power/fraction retained but null peak/share. A Hann edge can suppress
a real impulse below the floor; this is limited sensitivity, never proof of no attack. Prefix
subtraction can also suppress a real repeated component, and unrelated overlapping sound can
contribute to the same local change. No additional texture-category thresholds are introduced:
the old six-peak thresholds change meaning on short FFT windows and were rejected in review.

The normalizer enforces version/scope/null confidence, exact N, complete ID/order/count binding,
exact derived supports, full-track decision sample, finite ranges, floor/status consistency,
peak resolution and unavailable nulls, then clones arrays. Earlier payloads may omit the layer.
It cannot authenticate acoustic truth without PCM. The JSON schema remains additive and strict.

### Cost and acceptance boundary

Scratch storage is lazy: one <=512 FFT and two <=256-bin arrays reused across accepted attacks,
not an additional spectrogram. At most two short transforms run per accepted energy attack;
the inherited60ms refractory bounds this work to roughly16.7 attacks/s. The old feature FFT,
entry/band/context paths remain exact. Work and payload are added once per load in the analyzer
worker, with no render-frame DSP or messages. Offline elapsed time and added payload must still
be measured; absence of frame DSP is not a zero-cost claim. All four MVP/XR raster/native/exact render-worker proxies now call the shared
`projectRenderWorkerAnalysis` only at preparation: omit the unused `musicActivity` tree while
retaining every other analysis field. The host publication, cache reference keys, plan-only
updates and main fallback input remain original. This removes both old and new unused acoustic
evidence from renderer structured-clone/memory cost. It does not eliminate analysis-to-main
publication, establish Quest frame rate or change frame messages. Four additional regressions
cover real structured-clone omission, unchanged host/plan cache and native fallback/exact paths.
No new player setting is required for an internal evidence protocol. Wall stays Off and MVP/XR Offscreen behavior is preserved.

The existing corpus and single measurement runner are extended, with no source-copy or new
report-file family. Ninety declared controls cross3 clocks,5 subhop phases and6 first/later signal
combinations. Forty-five isolated controls measure narrow concentration for a pure sine and
spread power for impulse/noise; numeric test bounds are not production category thresholds.
Among45 later-addition comparisons,34 retain the same accepted anchor and their entire short
measurement is exactly unchanged;11 inherit a different legacy anchor near the later addition.
Those11 are explicitly disclosed, not counted as successful isolation or fixed onset timing.
The later addition begins30ms after the authored first signal. Separate fixed-anchor kernel
controls exercise actual first/last Hann samples, gain/DC, below-floor, file ends and resolution.

All old13/45/75 aggregate identities remain frozen by omitting only the new optional layer in
predecessor projections. The runner also compares the whole T11e producer at commit
`ca974e94123eead17dea79f21789ac2f6d2d1f43` on the3 full recordings, then all older T11d/c/b/root
values. Old model consensus/PCM-identity mismatches remain as previously disclosed; none of
these numeric signal controls establish musical note/source/vocal accuracy. Full cumulative
tests retain every predecessor test and known failure rather than rewriting historical results.

T11 remains partial; T12 is not started. Continue after manual acceptance with validated
musical event/role qualification, including the inherited nearby-attack localization ambiguity.


### T11f validation procedure

Use Node/npm25.2.1/11.6.2, no runtime fallback or dependency installation. Required commands:
`npm run build`; `npm test -- --test-reporter=tap`; targeted analyzer/clock/worker validation
as in T11e plus the four renderer publication suites:
`node --test --test-reporter=tap tests/wormhole-host-worker.test.mjs tests/xr-wormhole-worker.test.mjs tests/xr-native-worker.test.mjs tests/wormhole-exact-frame.test.mjs`.
The existing accepted-event legacy test now stubs only its intended projection export while
retaining the real module's other helpers; no historical numeric assertion is changed.
MVP publication tests compare cloned cross-realm arrays as plain values, not prototype identity.

The first candidate measurement is retained in `logs/t11f/measurement-primary.log`; its source
identity guard correctly rejects it because review changed contracts/runner during execution.
The exclusive JSON stays empty. It is not a validated performance/accuracy result. Rerun the
existing runner against unchanged final source after cumulative testing, using a fresh exclusive
output. Neither candidate source changes nor parallel-test elapsed times can be silently accepted.

Direct Git diff plus read-only analyzer/renderer reviews replace optional `diff_export.ps1`;
no duplicate source snapshot. No Python inference/pytest or physical Quest measurement is run:
there is no changed Python inference, installed research-model runtime or attached headset.
Public browser load/play/pause smoke is required after guarded Pages prepare/publish/verify;
it checks wiring, not musical truth or headset frame pacing. Pause for manual acceptance.


### T11f final regression and navigation record

Build passes (`logs/t11f/build-projection.log`), with the existing informational chunk-size
warning. Nine new tests are added:5 analyzer/local-window controls and4 worker-publication tests.
All1800 predecessor tests remain active. Full final code run (`logs/t11f/full-final.tap`):
1809 tests,1799 pass,10 fail, zero skipped/cancelled. Nine failures have exactly the prior
cleanup baseline names AND messages. The tenth was the protected current-source hash for
`CanvasVisualSource.ts`, whose reviewed projection addition changes bytes but no clock logic.

The existing source-evolution manifest now records the exact new hash and independent review
reason; its prior hash/reviewer/reason is retained in `supersededReplacements`. Original measured
source copies, all timing measurements and numerical baseline assertions remain unchanged.
After this metadata-only correction, the affected timing/event/renderer suites pass62/62:
`node --test --test-reporter=tap tests/accepted-timing-measurement.test.mjs tests/music-events.test.mjs tests/wormhole-host-worker.test.mjs tests/xr-wormhole-worker.test.mjs tests/xr-native-worker.test.mjs tests/wormhole-exact-frame.test.mjs`.
Do not rewrite the10-failure full log as a9-failure run: `logs/t11f/failure-comparison.json`
records that source guard's passing rerun and the nine remaining exact baseline failures.
No third full-suite replay is needed for the reviewed-hash metadata edit; changed runtime was
already in the complete run and its affected suites reran together afterward.

The initial targeted analyzer/clock/XR command from T11e ran113 tests,112 pass/one old stub
failure; spreading the real contract exports and overriding only the intended legacy projection
resolves that compatibility fixture (6/6 separately, also in62/62 above). The four worker suites
first exposed a cross-realm array-prototype comparison in the new MVP test; plain-value comparison
fixes the assertion (four new publication checks4/4, all worker suites in62/62 afterward).
Failed candidate logs remain local; no historical numeric expectation was weakened.

Final Graphify refresh covers891 code files:8340 nodes/20060 raw AST edges, preserved at ignored
`graphify-out/AST_EXTRACTION.json`; clustered navigation projection8340/17579, no dangling
endpoints. Raw unresolved external endpoints remain documented. Exact attack-change, window-size,
normalizer, fixture and render-projection nodes are verified; all four worker import/call paths
are navigable. Clustering used no LLM labels or visualization. The incremental changed-file
extraction trap is documented in platform operations; full source was re-extracted before final
clustering. Generated graph/cache/report remain local, not duplicate committed source artifacts.


### T11f final recorded result

`logs/t11f/measurement-final.json`, protocol `t11f-attack-local-excess-1`, completes with all11
source hashes unchanged. All prior root and T11b/c/d/e values are exactly equal on all3 full
recordings. The39 attack/45 entry/30 band/16 context/40 periodicity controls remain, plus90 new
local-change controls. Same-anchor34/34 comparisons are exact;11 other pairs retain the known
legacy retargeting limit. No independent musical accuracy is inferred. All9 historical recording
contexts still mismatch the current decoder's PCM identity, so comparison accuracy remains null.

| Recording | Existing energy attacks | New sidecar | Whole acoustic tree omitted from renderer prepare | Warm20s median T11e /T11f |
|---|---|---|---|---|
| Goa | 2341 | 663747 bytes | 1292545 bytes | 342.541 /357.774 ms (+4.45%) |
| No Good | 2385 | 676987 bytes | 1323286 bytes | 339.407 /343.810 ms (+1.30%) |
| Scienide | 1536 | 435160 bytes | 850278 bytes | 318.029 /339.506 ms (+6.75%) |

The source-stable run follows completed cumulative tests, using5 alternating warm pairs per
recording. Added offline elapsed time is+1.30% to+6.75% in this run; individual pairs vary.
This is Node analyzer elapsed wall time, not process CPU, main-thread load, browser FPS or Quest
performance. Do not claim precise/stable CPU percentages or zero offline cost. Main-host result
normalization still has a once-per-load record cost. Renderer preparation avoids the complete
unused tree (about0.85-1.32MB JSON representation per full recording), including previous acoustic
metadata; structured-clone memory size is not identical to JSON bytes. No per-frame payload/DSP
is added, and scratch DSP storage is roughly12KiB at N512, excluding returned record objects.

Exact command:
`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:/novy/Plexus Engine (VJ System)/plexus-engine/tests/audio/Prodigy" --output logs/t11f/measurement-final.json`.
Only the source-stable final JSON is a validated result; the earlier source-changing candidate
remains explicitly rejected. Source commits separate the analyzer evidence (`f700885`) and worker
preparation optimization (`f3a85cb`). Commit/push documentation, deploy the exact committed tree,
verify public files/routes, then perform public browser smoke and pause for manual testing.


## T11g - quiet-prefix energy crossing (2026-10-25)

T11f was manually accepted by the user's next-task request. T11 remains partial; T12 is not
started. Parent owns analyzer/contracts/schema/integration; independent read-only review checks
the DSP, normalizer and counterexamples. Existing source/fixture/runner files are extended.
No additional report family, dependency, UI switch or render-time DSP is introduced.

### Scope and contract

Optional `AcousticAttack.quietOnset` provides an alternative **engineering threshold-crossing
sample**, not a replacement for the legacy sample/time/family or an isolated musical onset.
The parent activity layer retains null confidence, signal-only use and scoring ineligibility.
Algorithm `quiet-prefix-energy-v1`; `decisionSample` is full real PCM length. Association is the
containing legacy attack ID; no new attack, note, source label or scoring input is created.
The legacy T11b-f projections omit only this new optional field and must remain exact.

Qualification requires a complete preceding feature frame with AC power <=1e-10, a complete
triggering frame and a feature hop at least the rounded2ms radius R. Other cases omit the
optional measurement; omission is unavailable evidence, never proof of no onset. The preceding
frame supplies its own mean and AC power. Threshold is fixed `max(1e-10,4*prefixPower)`.
No future strongest peak or per-track normalization sets that threshold.

Starting from the complete observed trailing prefix window `[anchor-R,anchor)`, first require
its prefix-mean-referenced energy to be at/below threshold. A quiet full hop can hide a brief
prefix spike; if this short window is already above threshold, abstain. Then slide one sample
at a time through the triggering frame and return the first above-threshold mean square:
`sampleIndex=n`, measurement `supportSamples=[n-R+1,n+1]`, exact preceding-frame `prefixSamples`,
`prefixPower`, `thresholdPower`, and `crossingPower`. The support includes prefix samples where
appropriate and is never clipped to manufacture a smaller window.

This support is **not** a guaranteed physical-onset uncertainty interval. A very quiet/slow rise
can cross much later than its physical beginning. A DC step can cross the signal threshold;
therefore this is not instrument, vocal, percussive/tonal or musical-event recognition. A quiet
prefix also does not certify an isolated sound source. Continuous nonquiet mixtures are outside
this refinement's coverage; their original evidence stays unchanged.

Normalization enforces exact algorithm, supported clock/frame, support/prefix association,
full-track decision sample, finite measured ranges, prefix floor, derived threshold and strictly
above-threshold crossing power. Unknown keys are rejected and permitted fields/arrays are
explicitly cloned. This verifies the payload contract, not acoustic truth without PCM. Earlier
payloads may omit the field. The optional JSON schema preserves all old required properties.

### Validation and cost

The previous90 authored controls are retained. Across45 first/later signal combinations, all11
known legacy retargetings now have an alternative crossing near the first authored start; the
34 legacy-stable combinations also retain an early crossing. Old legacy anchors and the entire
T11f short-spectrum measurements remain unchanged. This is a narrow authored timing advance,
not independent recorded musical accuracy or separation of both nearby sounds.

Three appended tests cover3 clocks/five subhop phases, gain/DC, near-floor stationary
noise, nonquiet background, file start/end, insufficient hop, slow attack and DC-step limits,
normalizer omission/clone/malformed values. Review found two defects before final validation:
a short spike at the end of a globally quiet prefix could masquerade as a new crossing, and a
spread clone could retain forged confidence/source claims. Initial short-window qualification,
strict keys, explicit cloning and both counterexample regressions fix these defects.

Work is one cheap eligibility check per accepted attack and, only when eligible, a bounded
prefix/search scan with scalar rolling energy. No FFT, history array or per-frame message is
added. The T11f renderer projection continues to omit the complete acoustic tree from all four
render-worker preparation paths. Main-host analysis normalization still processes the optional
records once per load. Measure offline elapsed cost separately from cumulative tests; do not
interpret Node elapsed time as process CPU, main-frame cost or Quest frame rate.

The existing runner adds a Git-identified T11f producer (`d3ec168`) and compares all previous
root/T11b-f values exactly, including T11f attackChanges. Its90 controls also record quiet
crossings; old model agreements and decoder-identity abstentions retain their original limits.
The real3-recording measurement uses unchanged final source hashes and no model installation.

After build, cumulative tests, source-stable measurement and final docs: commit/push, guarded
Pages prepare/publish/verify, live XR load/play/pause smoke, then pause for manual acceptance.
Wall remains Off; MVP/XR Offscreen and the old chart path remain intact. Continue afterward with
validated musical event/role qualification; continuous-mixture attacks and note/source boundaries
remain unresolved. Vocal/instrument identity stays unsupported and is not a prerequisite to a
future T12 restricted to capabilities that actually pass validation.


### T11g final test and navigation record

`npm run build` passes (`logs/t11g/build-final.log`), existing chunk-size warning only.
`node --test --test-reporter=tap tests/music-activity.test.mjs tests/music-events.test.mjs tests/analyzer-contract.test.mjs tests/accepted-timing-measurement.test.mjs`
passes51/51 before the final review fixes. Final boundary command:
`node --test --test-name-pattern="quiet-prefix crossing|quiet crossings|quiet-crossing normalizer" tests/music-activity.test.mjs`
passes3/3 with the prefix-spike and forged-claim counterexamples covered.
`npm test -- --test-reporter=tap` after all runtime/test changes runs1812 tests:1803 pass,
nine failures, zero skips/cancellations. All1809 predecessors remain active. Each failure name
AND assertion message exactly matches `logs/timing-cleanup/baseline-failures.json`;
`logs/t11g/failure-comparison.json` verifies this. No numeric baseline or historical measurement
is rewritten, and no additional source-evolution manifest change is needed.

Node25.2.1/npm11.6.2, no runtime fallback or dependency installation. Python inference/pytest
and physical Quest were not run: no changed Python inference code/model runtime or attached
headset. Direct Git diff and read-only analyzer review replace optional `diff_export.ps1`.
Full public browser UI smoke follows guarded deployment; it is not a headset performance test.

Graphify full code-only refresh covers891 files,8342 nodes and20064 raw AST edges. The ignored
raw extraction is retained before clustering; the navigation projection has17583 edges with no
dangling endpoints. Exact `src_analyzer_musicactivity_musicactivity_quietonset` is verified in
source and graph. No semantic/LLM extraction, backend, hooks, visualization or new global graph.
The documented manifest-reset workflow avoids the known changed-file-only extraction trap.


### T11g source-stable measurement and handoff

`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:/novy/Plexus Engine (VJ System)/plexus-engine/tests/audio/Prodigy" --output logs/t11g/measurement-final.json`
completes with11 unchanged source hashes, protocol `t11g-quiet-prefix-crossing-1`. Every previous
root/T11b-f value is exactly equal on all3 full decoded recordings; only optional quietOnset
measurements are new. Old attackChanges spectra, raw anchors, event times and chart inputs stay
exact. Old39 attack/45 entry/30 band/16 context/40 periodicity controls and90 T11f controls remain.
No new model inference is run; all9 historical decoder-identity mismatches remain abstentions,
so independent recording accuracy is null.

On the11 previously retargeted authored controls, median/max absolute errors change from
30.0625/31.9375 ms for the legacy anchor to 0.0000/0.0000 ms for the alternative crossing.
All90 hard-start control crossings fall within 0.0000 ms of the authored start.

These are declared synthetic-signal results, not a general musical onset-accuracy claim. Slow
rises and DC steps retain their explicitly tested limits; prefix-spike cases abstain. The
alternative times have no separate note-separation/refractory guarantee and are not promoted
into the chart automatically.

| Recording | Previous values exact | Quiet-prefix candidates | Warm20s median T11f /T11g |
|---|---|---|---|
| Goa | Yes | 0 | 277.229 /279.908 ms (+0.97%) |
| No Good | Yes | 1 | 278.444 /287.207 ms (+3.15%) |
| Scienide | Yes | 1 | 253.498 /260.969 ms (+2.95%) |

Five alternating warm pairs per recording run after completed cumulative testing. Individual
pairs vary; these are offline Node elapsed wall times, not CPU/FPS/Quest results. No speedup,
zero-cost or stable percentage claim follows from the deltas. New per-recording payload is only
the listed optional candidates, and the unchanged render-worker projection omits the complete
acoustic tree. Main normalization still has once-per-load work. Full source provenance is in
Git; no new source-copy/report-file family is added.

Source commit `ce5751f` separates runtime/contract/tests from this documentation update. Push
both, deploy the exact reviewed tree with `release-pages.mjs prepare/publish/verify`, then verify
public XR load/play/pause and unchanged chart counts. Preserve the actual deployment receipt
and manual continuation point in `logs/t11g/handoff.json` and the workspace status file. Stop
for manual acceptance; T11 stays partial and T12 is not started.


## T11h - crossing-anchored short spectral change (2026-10-25)

T11g was manually accepted by the user's continuation. T11h applies that existing timing
measurement to the existing short-spectrum layer, instead of introducing another sidecar.
Analyzer, shared contract, integration, tests and docs have one parent owner; independent
analyzer review is read-only. T11 remains partial and T12 is not started.

The producer now emits `attack-local-excess-v2`. For each historical energy attack, it uses
`quietOnset.sampleIndex` when that qualified measurement exists, otherwise `attack.sampleIndex`.
The body starts2 ms before the selected sample; the equal-size prefix ends4 ms before the body.
The N policy, Hann-weighted centering, power/ratio/bin calculations, full-track publication,
null confidence, unresolved source ownership and scoring ineligibility are unchanged.

The historical `attackId` still binds the record to its original attack. The alternative time
is not substituted into the legacy attack's ID/time/family, accepted hits, grid or chart.
If the chosen crossing lacks complete real-PCM spectral support, the record is `file-boundary`;
it does not silently switch back to the later legacy anchor. No qualified crossing means the
same numerical measurement as v1. Missing resolution remains explicitly unavailable.

The normalizer and strict worker schema accept both versions. v1 always binds windows to the
legacy sample, even when quietOnset is present; v2 binds the selected crossing or legacy fallback.
When the selected anchors differ, simply renaming versions, deleting a used crossing, or
transplanting legacy support into a corrected record fails closed. With absent/equal quiet
anchors both versions intentionally bind the same support. Legacy omission and genuine v1 records remain valid. The parent
validates quietOnset before using it for v2 binding, then clones the publication explicitly.
The subalgorithm version carries the changed interpretation; root algorithm7 and its existing
chart/cache identity are retained because their numeric inputs and behavior do not change.
No persisted acoustic-analysis cache is introduced or migrated.

### Validation scope and limitations

The retained90 hard-start controls cover3 clocks,5 hop phases, impulse/tone/noise and three
later-addition pair families. All45 pairs now have exactly equal prefix/body support and
spectral measurements before versus after the later addition, excluding historical attack IDs.
The34 stable-ID comparisons remain; all11 legacy-retargeted comparisons now also preserve the
first measurement. This is a local measurement correction, not new source recognition.

All prior active tests remain. The T11g omission test now constructs actual v1 legacy-bound
records before deleting quietOnset: deleting the anchor from v2 would create an inconsistent
payload, not a predecessor. Its former source is retained at `8f6f392`; no fixture hashes or
historical result files are rewritten. The first targeted run exposed this migration mismatch
and an incorrectly chosen test boundary; both are retained in `logs/t11h/targeted.tap`. The
boundary control now has a valid legacy measurement but insufficient earlier crossing support,
which must abstain. The subsequent focused4 tests pass (`logs/t11h/new-reviewed.tap`).

Continuous nonquiet backgrounds retain the previous fallback. Slow threshold crossings can
still be late; DC steps can still cross the engineering threshold; Hann-edge impulses can be
below floor. The positive spectrum is neither an isolated-source spectrum nor a categorical
percussive/tonal/instrument/vocal detector. No probability or note-quality claim is added.
T12 needs separately qualified musical events/role evidence and conservative fallback before
any chart promotion. Wall remains Off; renderer-worker projection still omits the complete
acoustic tree, with no new FFT, packet or cloning work in render callbacks. No player control
is needed for this internal versioned correction.

The existing runner retains Git-identified T11b-g producers and every earlier control. It
compares all T11g values except the intentionally versioned attackChanges exactly on the three
full recordings; changed records require a qualified crossing. Other records must remain
numerically exact. Recorded decoder mismatches remain abstentions, not independent accuracy.
Warm alternating20s comparisons use T11g versus T11h after cumulative tests, with unchanged
source hashes checked at the end. No external model inference, source-copy family or new report
framework is added. Exact final checks and delivery receipts follow below.


### T11h cumulative validation and review

`npm run build` passes (`logs/t11h/build-final.log`), with the existing large-chunk warning.
`node --test --test-name-pattern="quiet-crossing normalizer|v2 " tests/music-activity.test.mjs`
passes4/4 after the migration/boundary test corrections. The final
`npm test -- --test-reporter=tap` runs1816 tests:1807 pass, nine failures, zero skips or
cancellations,322.292 s. Every1812 predecessor remains active. Failure names AND assertion
messages exactly match `logs/timing-cleanup/baseline-failures.json`, verified in
`logs/t11h/failure-comparison.json`. The first targeted54-test run (52 pass/2 fail) is retained;
the final full suite includes those corrected tests and the new schema compatibility test.
No golden, numeric baseline or source-evolution manifest is changed.

Independent read-only analyzer review found no runtime blocker; renderer/cache review verified
all four prepare-only projections, unchanged original fallback/cache references and absence of
sidecar consumers in visuals/XR/gameplay/UI/audio/export. Its documentation clarification is
applied: same-support v1/v2 payloads are intentionally both valid. Direct Git diff/review is used;
optional `diff_export.ps1` is skipped. `git diff --check` passes. No dependencies or runtime
fallbacks; Node25.2.1/npm11.6.2. Python inference/pytest and physical Quest are not run because
no Python inference code or attached headset is involved. MVP browser smoke is not repeated:
render/UI unchanged and cumulative host/worker tests retained. Public XR load/play/pause smoke
follows the guarded release; that is browser verification, not a Quest performance benchmark.

Full local code-only Graphify refresh covers891 files,8342 nodes,20064 raw AST edges and17583
canonical edges with zero dangling endpoints. Exact attackChanges and quietOnset symbols are
verified. Raw extraction is saved before clustering; no LLM/backend/hooks/visualization or
semantic corpus rebuild. Generated graph and logs remain local/ignored.


### T11h source-stable recording comparison

`node research/analyzer-lab/diagnostics/measure-music-activity.mjs --audio-dir "C:/novy/Plexus Engine (VJ System)/plexus-engine/tests/audio/Prodigy" --output logs/t11h/measurement-final.json`
completes with11 unchanged source hashes, protocol `t11h-crossing-anchored-spectrum-1`.
Three full recordings retain every root/T11b-g value except the intentionally versioned
attackChanges. Goa has2341 attacks/zero quiet anchors/zero changed records; No Good2385/1/1;
Scienide1536/1/1. Every changed record has its existing qualified crossing; all unqualified
records remain numerically exact. All prior controls, including90 attack-change controls and
45 exact late-addition comparisons (11 retargeted legacy IDs), pass. The9 decoder/PCM mismatches
remain explicit abstentions; no independent recording-label accuracy or model rerun is claimed.

First-run warm20s medians T11g/T11h: Goa273.430/317.568 ms (+16.14%),
No Good271.189/272.855 ms (+0.61%), Scienide270.285/266.050 ms (-1.57%).
The Goa outlier triggers a complete unchanged-source repeat into `logs/t11h/measurement-repeat.json`;
the first evidence is retained. Five alternating pairs are noisy elapsed wall time, not process
CPU time, browser frame rate or Quest performance. Do not reinterpret an outlier as a stable
slowdown or a favorable later run as proof of zero overhead. Runtime/contract/test/runner changes
are committed separately as `34ac16c`; final repeat results and deployment handoff follow.


The complete repeat passes the same11 source-hash guards. All non-timing values from both
runs are exactly equal; no result is discarded or overwritten. Repeat medians are:

| Recording | T11g /T11h warm20s median | Delta |
|---|---|---|
| Goa | 277.674 /284.515 ms | +2.46% |
| No Good | 267.103 /274.754 ms | +2.86% |
| Scienide | 246.500 /256.352 ms | +4.00% |

The original Goa+16.14% does not recur (repeat+2.46%). The repeat still observes+2.46%..+4.00%
offline elapsed differences; do not claim a speedup, zero overhead or a stable device percentage.
Both runs and their individual pairs are retained. The producer still has the same bounded
transform count/scratch, and unchanged renderer projection proves no new frame DSP/payload.
This desktop Node measurement does not establish physical Quest acceptance.

After documentation commit/push, release the exact clean HEAD through
`node scripts/release-pages.mjs prepare t11h-crossing-spectrum`,
`node scripts/release-pages.mjs publish` and `node scripts/release-pages.mjs verify`.
Public XR load/play/pause must retain the chart. Actual source/Pages hashes, release URL and
browser receipt live in `logs/t11h/handoff.json` and the workspace status file. Stop after the
manual handoff. T11 stays partial; T12 has not started. The next bounded step freezes and tests
one selective musical-event qualification rule with transfer/negative examples, event-level
precision/recall, confusion and abstention before any classification or chart promotion.
