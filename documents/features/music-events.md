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
