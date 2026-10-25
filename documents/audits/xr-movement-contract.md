# T09 — Guarded movement contract

Owner: gameplay owns the offline versioned movement model, validator, deterministic revoicing/filter and rigid reflection; XR owns the chart-scoped setting and compact-menu focus integration. Controller/session/input/render ownership and clocks stay unchanged. T08 was accepted by user continuation on 2026-10-24. Wall/T06f remains deferred.

## Rollout and player contract

Settings → Choreo → Movement → Legacy / Guarded. Legacy remains the default, represented by an absent optional `generation.motionSafety` field; old records and library golden charts retain byte-identical behavior. Guarded is an explicit viewer generation preference, saved in localStorage and Copy settings. It regenerates/restarts the chart through the existing chart scope; it is not an artist preset override. Existing difficulty, Activity, Variation, Hands, Lead, Zones and Standard/Tall choices remain supported.

Guarded starts from the existing authored choreography. It checks the cut's entry/exit and movement to the next cut, simplifies unsafe target placement into own-hand corridors/previous reachable rows when possible, then omits an infeasible song-time group atomically. It never shifts or invents an onset, changes assigned hands/cut directions/intensity/source metadata, or leaves half a pair. Pair layouts retain their authored rows; fallback never promotes an ordinary note to the overhead row. Existing within-group order and identities stay stable.

Changing movement mode can change note count, positions and therefore maximum score/section demand; the existing scoring planner recomputes the correct maximum. There is no new hit value/bonus or timing exception. For Left versus Right lead in Guarded, generate one canonical Left score and rigidly reflect hand, lane, x and horizontal cut direction for Right. Timing, pair membership, IDs, difficulty and section demand/max score remain equal. Even remains the balanced pattern, not a score-equivalence claim against a differently authored lead pattern.

## Version 1 model

The model operates offline in canonical playfield metres/song seconds. `notePosition` remains the position authority. A directional cut uses an 8 cm half-stroke along `CUT_VECTORS`, with 100 ms reserved for the stroke. The recovery route goes from the prior cut's exit to the next cut's entry in the remaining time, bounded by the existing difficulty-scaled hand-travel speed. Free cuts invent no directional offset. These are conservative design constants, not new player switches or calibrated body measurements.

The validator reports:

| Violation | Contract |
|---|---|
| Invalid/unreachable target, duplicate identity/order | Finite supported fields, three-lane layout, x within ±.55 m, rows 0–2 Standard / 0–3 Tall, unique IDs and chronological groups |
| Global / same-hand density | Existing difficulty-scaled floors; a simultaneous pair is one global onset, two separate hands |
| Row step / recovery speed | Existing row-step envelope, stroke endpoints and available recovery seconds; overhead still must satisfy physical travel |
| Overhead preparation/rest | At least .5 s preparation and .75 s recovery, or the same-hand floor when longer; existing authored musical overhead spacing also remains |
| Crossing clearance | Existing difficulty-specific shared-space clearance before and after a crossing/centre stroke |
| Hand collision | Exact closest separation of time-overlapping linear cut/recovery segments; minimum .16 m, including pair strokes and paths whose target centres are separated |
| Malformed pair | Complete same-time two-member group with matching pair identity; never accept only one member |

Movement segments are piecewise linear in song time. Opposite-hand segment overlap is solved analytically through relative velocity, not render-dt sampling. Ordered segment ends allow binary-search overlap lookup. The diagnostic sample caps at 256 issues while the total still counts every detected issue. All retained chart groups are checked by the same pure contract; retries are bounded to two simpler placement proposals. No per-frame analysis, random choice, worker/schema/dependency or shader changes.

Either-hand targets retain either-hand judging; the offline validator tries both hand witnesses, bounded to four assignments for a two-note group. It does not change the chart's hand field. This is a deterministic greedy feasibility model, not an exhaustive optimization over all future human gestures. Passing it does not establish individual reach, saber-body collision safety, fatigue or physical Quest comfort.

## Shared spatial and input contracts

No new target path is introduced. Existing far `XrTrackPath` bend and exact strike inverse remain; the straight near-hit zone and hit volume are unchanged. The existing GPU note pose uses song time, not accumulated dt; decorative spin does not rewrite `cutDirection`. Real swept XR strikes and explicit desktop direction assist still enter the same `RhythmGameSession`/`RhythmJudge`. Existing note GPU/path, judge/session and Standard/Tall/Ultra tests remain active.

The seventh Choreo row exposed an existing weighted-distance focus bug: Down could skip the adjacent row to a farther aligned column. Vertical keyboard focus now chooses nearest row first, then nearest column; horizontal/tab behavior remains. Prior menu tests run unchanged.

## Evidence and limits

187 predecessor test files retained in 188 active files; one reviewed additive authored-default expectation for the new menu descriptor, predecessor retained. No chart golden migration. Six predecessor sources archived in `t09-retention.json`. New ten-case suite covers adversarial movement routes/collisions/density/reach/rest, either witnesses, atomic pairs, 480 generated profiles, reflection/scoring/storage and real swept versus desktop judging.

The synthetic corpus spans four 96/62-second source fixtures, all five difficulties (including Expert), four hand patterns, three zones and two play spaces with a deterministic spread of activity/variation/lead. Legacy 76250 target instances → Guarded 67632, retaining 88.6977%; 8185 pairs and 654 overhead targets retained. Legacy has 10726 violations under the **new** model; Guarded has zero. The worst individual profile retains only 28.11%, so do not promote this conservative filter to default. No assertion that all legacy violations are physically impossible for every person. Further density/ergonomic tuning needs manual Quest feedback, not weakened validator limits.

Physical reach/fatigue/readability, actual controller tracking and frame pacing remain unmeasured. This task does not expand musical source evidence (T12) or touch deferred Wall work. Roll back immediately with Movement → Legacy; old stored settings need no migration.

## Version 2 — recovery without permanent hand starvation (T12a1, 2026-10-25)

The user reported a disappearing hand and thinning rhythm in No Good under Musical/Ultra/Active/
Expressive/Alternate/Even/Guarded/Crossover/Tall. V1's single uniform recovery could collide with
historical opposite-hand paths; after rejection the same old hand position remained, causing an
indefinite rejection cascade. A currently valid crossing could also block the next recovery.
The version1 description/results above remain historical evidence, not current quality claims.

V2 first keeps the uniform route, then tries early or late recovery at the same travel-speed
limit. Explicit stationary holds cover every unused second, followed by the unchanged cut.
All candidates use the same exact continuous collision checks against the entire retained
history; no time-based expiry, hand reset, teleport, cut/hand change or onset shift is allowed.
Crossed/shared strokes reserve at least the original clearance and the horizontal own-corridor
return time plus stroke time. This strengthens the old fixed clearance at demanding crossings.

Before committing a shared placement, Guarded previews four upcoming real onset groups and
compares the original against its two existing own-side revoicings. Only a strictly better
retained-onset count wins; ties keep the original proposal. No grid-only note is invented and
pairs remain atomic with their authored rows. The final guard still runs after Tall overhead.
Validator replay reconstructs the same selected paths and enforces every prior numeric limit.

Previews synchronously read an immutable authoritative prefix and own only a bounded suffix.
IDs and collision queries see both. No whole-track history is copied, truncated or mutated by a
discarded branch. This is offline chart preparation only, with no playback-frame work, audio,
analyzer, worker or rendering change. It is a bounded greedy model, not exhaustive choreography
optimization or a physical headset safety guarantee. Legacy charts/goldens remain unchanged.
