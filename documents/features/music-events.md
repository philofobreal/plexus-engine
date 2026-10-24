# T11a — traceable accepted events

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
