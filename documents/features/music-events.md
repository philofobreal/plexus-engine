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
