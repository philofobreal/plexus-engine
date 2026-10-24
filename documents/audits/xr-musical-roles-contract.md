# T08 — Target meanings and musical halo contract

Owner: gameplay owns immutable role selection; XR owns sidecar rendering, appearance menu and lifecycle; controller integrates both under the accepted chart generation guard. No audio, worker, state, judge or scoring owner changes. T07c was manually accepted by the user's continuation request on 2026-10-24. Wall/T06f remains deferred.

## Orthogonal axes

Skin (Classic / Shard), gesture (free / directional), source (`sourceType` of the accepted percussive event), and highlight role are independent. A halo is never a collision object. Musical highlights are optional viewer preferences, not artist preset content: Settings → Visual → Note halos → Music, persisted and copied through existing appearance descriptors. Off remains default; Phrase keeps the compatible T02 phrase preview. This task adds three role meanings, no new judge type. Source-evidence expansion remains T10–T12; movement policy remains T09.

| Actual gesture / skin | Form | Hand | Direction | Musical source / role | Contact and timing | Value / bonus | Motion | Miss | Difficulty |
|---|---|---|---|---|---|---|---|---|---|
| Free / Classic | Chamfered block + dot | Cyan left / magenta right / gold either | Any | Accepted percussive event; optional role below | Existing swept blade, hand, speed and song-time windows | Existing grade × combo × section weight; no role bonus | Existing GPU approach and shared bend | Existing dim/expiry and combo reset | All, when emitted by generation profile |
| Directional / Classic | Same block + arrow | Same | Existing eight cut directions | Same | Same plus existing cut cone and blade travel speed | Same | Same | Same | All, profile determines permitted vocabulary |
| Free / Shard | Round faceted gem | Same | Any | Same | Same free-cut judge | Same | Existing GPU approach / gem rotation | Same | All, when emitted |
| Directional / Shard | Asymmetric crystal + cut ridge | Same | Crystal tip / ridge encodes existing cut direction | Same | Same directional judge | Same | Existing GPU approach / cut rotation | Same | All, when emitted |

Existing pair metadata combines two ordinary targets at the same song time, with separate required hands and independent resolutions; the gold central glyph identifies pairing, while a gold *outer arc* identifies the optional musical accent. No pair-specific judge or added pair bonus. Existing `either` targets accept either hand using the same contact/direction/timing rules. Neither pair membership nor skin creates a new role. Musical role ties at a paired onset mark the first chart member only, avoiding two competing cues.

Central gameplay defaults are Perfect ±.08 seconds, Good ±.11 seconds, miss after .16 seconds, .22 m contact radius, .6 m/s minimum strike speed, .2 m/s in-plane directional speed and 50-degree cut half-cone. The existing XR play profile can widen the early Good window to physical reach; roles consume the same effective config and never replace it. Desktop targeting retains its explicit direction assist.

| Role | Visible sidecar | Selection and measurable player cue | Timing / score / motion / miss / availability |
|---|---|---|---|
| Accent | Pale gold opposed outer arcs | Strongest accepted onset in an authored phrase, intensity ≥ .65 and ≥ phrase median + .10; identifies a locally salient target | All use the target's existing rules/value/motion, no added bonus; dim on miss; available across difficulties when evidence exists |
| Phrase | White corner arcs | First accepted note of each existing authored phrase; signals choreography entry | Same |
| Section | Pale violet closed ring + four outer ticks | First accepted note within an actual published section interval; signals section entry | Same |

No role is invented for absent phrase/section metadata or flat onset intensity. Accent is explicitly an existing-intensity proxy, not a new claim of independent musical truth. Stable chart order resolves simultaneous-pair ties. One note receives at most one role. Section > phrase > accent, with ≥1.5 song seconds between all selected highlights. Higher-priority collisions suppress lower cues without moving them to unrelated notes. The immutable offline plan caps at 1024 roles, preserving higher priorities before chart-order publication.

## Scoring and lifecycle

Unchanged scoring: perfect 100 / good 50 × existing combo multiplier (1/2/4/8) × section weight; maximum score uses the same all-perfect simulation, accuracy is score/maximum, existing clear/flawless section bonuses remain controlled by `RhythmScoring`. A halo adds zero points and has no maximum/combo/accuracy authority.

The renderer retains one instanced sidecar draw, 16 visible instances, 88 triangles each and no texture. Accepted-hit bursts take first capacity, followed by section, phrase, accent, then legacy assignments in chart order. Burst replacement remains bounded oldest-slot eviction. Overflow drops only presentation. Pending musical glyphs do not spin; hand colour and directional centre remain visible. Song time alone drives travel/pulse/burst age; uploads happen only on drawn-set/config/status changes.

Only the committed session observer starts an accepted-hit burst, at most once per role note per run. Misses dim without a hit burst; skipped notes do not burst. Existing slice/haptics/scoring stay on their existing accepted-hit path. Reset/restart/seek/load/clear/mode switch clear the sidecar, and turning it on mid-run does not replay earlier hits. A failing observer disables the optional presentation and leaves committed gameplay intact. Disposal releases mesh, geometry, material and attributes once. Disabling halos removes the draw and observer without chart regeneration.

## Acceptance

Preserve all 186 predecessor test files unchanged and archive five affected sources in `t08-retention.json`. Test real chart/session score parity across all difficulties, role determinism/missing evidence/overflow, production live mode changes, settings persistence/Copy and existing judge/GPU/lifecycle regressions. Render actual Three.js Classic and Shard, both hands, free/directional cuts and all three role silhouettes; pixel-compare central glyph regions. Physical Quest readability and frame pacing remain manual. Capture local/public UI behavior and guarded Pages build identity; publish only gh-pages.
