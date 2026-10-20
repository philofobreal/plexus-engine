# Accepted-frame timing and role-aware placement

Frozen before new measurements, 2026-10-14. Integration owner: Codex/root.
Starting snapshot: analyzer worktree commit 72800fe. Owners: analyzer/types,
audio worker, semantics/automation, composition roots; gameplay stays a consumer.

## Declared scope

Explicit opt-in `eventTiming=local-band-v1` only. Default algorithm 7 events and
plans keep their existing behavior. This is an experimental timing proposal for
an already accepted percussive event, never independent target eligibility or
instrument recognition. No arbitrary v8 research onset becomes a new event.

Search exactly the accepted nonoverlapping feature frame, capped at 30 ms; retain
60 ms real preceding context and 30 ms following context. Run the unchanged
physical-band research function on that local PCM. No padding, resampling,
oracle inputs or truth-dependent corrections. Reject incomplete support,
below-floor PCM (peak amplitude <=1e-6), no candidate and multiple separated
candidate clusters. Cluster span is at most 3 ms from its first sample; choose
its earliest observed candidate. Candidates must have complete original-clock
support and lie inside the accepted frame and before the next accepted event.
Preserve event count, type, intensity and ordering; retain original times for
abstentions. Bound cumulative inspected PCM to 50 million samples; exceeding
the declared budget fails explicitly. Never silently discard later events.

Retiming applies only to impact cues carrying `percussive-onset` at the original
event time. Novelty, structure, beat/bar grid and other cue times are untouched.
The opt-in automation gate prefers compatible structural/attack/release evidence
within its existing bounded search; roles at a shared time remain available.
No applicable role uses the legacy distance ranking. Manual/locked points remain
user-owned. This is placement logic, not a new drop/phrase recognizer.

## Measurements and limits

Authored phase/rate controls measure timing, counts, ambiguity and abstention;
they are known generated controls, not independent recorded music. Keep all
historical regression tests and exact old fixtures. New declared controls cover
noise attacks, impulses, two attacks in a frame, sustained tones, cutoff,
silence/DC/floor, edges, gain/polarity and malformed clocks/contracts.
Independent human-reviewed audible-onset annotations are required for real-song
accuracy/promotion. The evaluator freezes 2/10/25/50 ms tolerance matching,
signed bias, matched-only p50/p95 and negative exposure; library agreement cannot
substitute for those annotations. Keep opt-in status if evidence is unavailable.

Profile local inspection cost separately from full analysis. Build, cumulative
Node/Python suites, worker stale-result/lifecycle, semantics and XR integration
remain required. Physical headset latency/comfort requires actual device evidence.
No physical precision claim follows from a passing software test.
