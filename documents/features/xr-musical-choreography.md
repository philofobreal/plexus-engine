# XR musical choreography

The XR score is a motor interpretation of the existing Visual OS, prepared once after analysis.
`prepareWormholePerformance` builds the default Cosmic Wormhole balanced/paired journey. The
facade passes that exact plan to both the pure chart builder and the optional background.
Turning the background on later does not regenerate the score or its accompanying journey.
No preset filename is interpreted as gameplay meaning, no new DSP is introduced, and no
render callback performs narrative or chart planning. Failed planning uses event-driven phrase variation
and reports it in the command drawer; an empty shared plan prevents an independent background retry.

## Musical vocabulary

The mapping deliberately separates musical meaning, rhythmic texture and motor constraints.
`automationSituation`, `variantRole`, `movementGesture`, `motif` and `globalArcRole` are
renderer-independent provenance already emitted by Visual OS. Target timestamps always remain
actual published BeatEvent times; grid/meter information can omit or group events, never create
an attack in silence or quantize a detected onset away from its audio. Type 3 remains an FX
transient, not an inferred snare/hi-hat instrument label.

| Visual OS context | Gameplay texture | Motor phrase |
| --- | --- | --- |
| Intro, breakdown, release, sparse, resolution | Restrained family: breath, pulse, echo, weave | Slower directional phrases with local accent pairs |
| Foundation / pulse | Pulse: at most one onset per beat | Alternating hands, down/up recovery |
| Drive, tunnel, slice, fragment | Drive: at most one onset per half beat | Vertical and lateral call/return cuts |
| Orbit, ripple, swarm | Weave: half-beat ceiling | Low/middle/high/middle wave with mirrored diagonal cuts |
| Secondary role / echo | Echo: half-beat ceiling inside answer windows | Alternating half-bar call/answer windows, mirrored diagonals |
| Buildup | Build: beat to half-beat as normalized energy passes 0.65 | Upper-row accents open the gesture as energy grows |
| Drop / peak | Impact-led family with contrasting response phrases | Horizontal, diagonal and vertically separated accents |

The semantic role chooses a permitted family, not one fixed pattern for a whole section.
The movement gesture chooses its entry texture inside that family (orbit/weave, ripple/echo;
see `GESTURE_ENTRY_TEXTURE`), which may differ from the family the gesture selects. Every populated
phrase develops that family, avoids immediate texture repetition and restarts at automation
changes. Phrase length is 16 beats bounded to 4-12 seconds. With an unreliable grid, the
median audible-onset interval supplies a conservative spacing scaffold; confidence never
disables arrows or pairs. Type-3 FX also retain direction and height variation.
Behaviour energy is normalized; automation
intensity is a 0.3..3 gain and is divided by three only as a legacy fallback. The last beat of
every fourth bar leaves space for a phrase ending unless the onset is very strong or building.
These are ceilings and selection rules, not promises of a fixed note count: quiet music stays quiet.

## Player generation settings

The command drawer exposes six game settings. Defaults (Normal / Balanced / Paired / Alternate /
Even / Own side) reproduce the historical chart byte-for-byte (`tests/fixtures/xr-chart-default-golden.json`).

| Setting | Owns | Behaviour |
| --- | --- | --- |
| Difficulty: Easy / Normal / Hard / Expert | Physical demand envelope | Global floor 0.5 / 0.25 / 0.2 / 0.15 s, same-hand floor 0.8 / 0.4 / 0.33 / 0.3 s, hand travel 0.9 / 1.2 / 1.6 / 2.0 m/s, texture ceilings x1.5 / x1 / x0.7 / x0.5, consecutive hard moves 0 / 1 / 2 / 4. Easy frees weak-onset cuts and limits row steps to one; Hard/Expert reverse conflicting cuts instead of freeing them and let the other hand take an onset when the alternate hand is not ready. |
| Zones: Own side / Shared center / Crossover | How the play space is shared | Own side keeps each saber in its half. Shared center adds the middle lane (rows 0-1) for either saber, exclusive to one hand at a time. Crossover also lets a saber reach into the other half. |
| Activity: Calm / Balanced / Active | Total target density | Scales every texture's spacing ceiling (x2 / x1 / x0.5); Calm also doubles the 0.25 s global floor, Active never goes below it and keeps playing through the four-bar breathing rest. Also selects the Visual OS activity level. |
| Variation: Stable / Paired / Expressive | Phrase complexity, cut diversity | Textures per scene 2 (held two phrases) / 4 / 4 with 8-beat phrases; Stable uses no lateral cuts, Expressive adds lateral and diagonal strokes. Also selects the Visual OS variant mode. |
| Hands: Alternate / Call & Response / Together / Independent | Hand selection, pair propensity, call length | Alternate takes turns; Call & Response gives one hand a 1-bar (impact/drive/strong build) or 2-bar call and the other the answer; Together realizes one salient accent per 1/2/4-bar window as a pair; Independent splits primary (dense impacts, above-median strong-beat onsets) and secondary streams between the hands. |
| Lead: Left / Even / Right | Hand dominance | Error-diffusion target of 65 % primary work for the lead hand (Alternate, Together); Call & Response uses a 2:1 call/answer cycle; Independent gives the lead hand the denser stream. |

Zone mixing is musical: `RhythmZonePolicy` weighs texture energy (breath lowest, impact highest,
build rising with energy), onset strength against the phrase median, movement gesture (slice, fragment,
orbit, swarm and ripple invite crossings; tunnel, drive and lock gather to the center; lock, fade and
collapse keep the halves apart) and phrase position (the first bar of a scene stays in-lane, fills
cross more). Difficulty scales crossing propensity. Safety is enforced by the planner: a crossing needs
the other hand clear for 1 / 0.5 / 0.4 / 0.35 s before and after, never follows another crossing of
the same hand, counts toward the hard-move chain, must be reachable, and pairs never cross. Crossed
targets keep their hand colour.

Precedence is fixed: physical constraints (spacing, reach, parity, silence, pair divergence, zone
safety), then the Difficulty envelope and Activity budget, then the hand pattern and zones, then the
Variation shape. Activity stays the musical density preference (and the Visual OS level); Difficulty is
the absolute physical envelope. Automation modulates realization
inside the chosen pattern (call length, Together window, stream fallback) and never switches it.
Hand selection is `RhythmHandPolicy` (no randomness: error diffusion plus a deterministic hash).
Changing a setting stops and rewinds playback and regenerates from the captured analysis: Activity
and Variation re-prepare the shared Visual OS plan (and the Wormhole) only when they change; hand
settings reuse it. No re-analysis, reload or second AudioEngine state; stale results are dropped.
Settings are not persisted across page loads.

## Pairs, readability and hand flow

Each phrase with at least six real onsets over two seconds reserves one locally salient
event for a pair. Relative intensity and dense-impact type rank candidates: no absolute 0.72
gate, drop label or high tempo confidence is required. A preparation gap reserves both hands;
following notes wait at least 0.5 s. Two targets retain distinct IDs, hands and independent
scoring on the same onset. Silence and isolated events never receive invented pairs.

Successive phrases cycle horizontal, diagonal and vertical arrangements. Horizontal pairs
share the middle row at X +/-0.45 m. Diagonal pairs occupy low/high rows at the same X offsets.
Vertical pairs occupy low/high rows with X +/-0.22 m: deliberately offset hand corridors rather
than a literal shared center column that asks the sabers to cross. Pair arrows point apart;
gold glyphs distinguish the shared accent without changing the hand colors.

With the default Alternate/Even setting single targets alternate hands. Direction parity survives automation changes: recent strokes
get a return or orthogonal stroke, with diagonals mirrored by hand. Pulse/drive phrases include
lateral cuts, while simultaneous pairs never require converging horizontal cuts. If an accent direction conflicts
with the preceding stroke it becomes a free cut. A 1.5 s rest permits a fresh downstroke.
Both single and paired targets obey the 0.4 s per-hand interval and 1.2 m/s target-to-target
travel budget; unreachable pair layouts fall back to one reachable target. Three body-relative
rows remain the same size and calibration as before. No obstacles, cross-hand assignments,
head-height center blocks, holds or rapid same-hand chains are added.

The thresholds are conservative game-design defaults, not measured ergonomic guarantees.
Physical Quest playtesting remains necessary for cut tolerance, shoulder comfort and fatigue.
Low confidence changes the spacing source, not the motor vocabulary. Missing plans retain the
same whole-track phrase planner. Coverage applies to playable musical material, not fabricated
notes in silence or a promise that automated analysis identifies every human-perceived cue.
Chart generation is deterministic and replay/seek reuses it.

## Verified automation placement

The production Visual OS loader and the legacy dramaturgy generator publish through
`alignAutomationToCues`, so the same rule applies to the dashboard, MVP and XR plans. The rule
is owned by the [ADR-005 cue-evidenced publication addendum](../adr/ADR-005-visual-os-style-system.md#addendum-cue-evidenced-automation-publication-2026-09-26):
evidence comes from `src/semantics/cueEvidence.ts` (0.5-second before/after feature windows),
proposals search both sides within neighbour midpoints and at most four seconds, and
unsupported proposals are omitted. `cueAnchor` and `cueAlignmentReport` are provenance of the
automatic publication only; manual edits do not update them and Copy/Load does not carry them.

Analyzer v5 binds impact cues to already-detected transient frames: a sustained density plateau
cannot trigger another impact solely because its cooldown expired. Significant moments retain
the entire track instead of only the first 32 entries. The version bump invalidates older analysis
caches; BeatEvent detection, tempo estimation and section classification are unchanged.

## Input and cost

The eight supported arrows mean actual blade travel in playfield XY. The existing swept-blade
judge checks a 50-degree cone and minimum 0.2 m/s in-plane movement at the contacting blade sample,
scaled by the sample interval so headset refresh rate does not change the threshold;
Z motion of the arriving note cannot fake a cut. Wrong direction leaves a note pending until
a valid cut or its existing miss deadline. There is no separate wrong-cut score penalty.
Desktop remains one click per target with explicit direction assist; aim, color and timing
still pass through the same judge. Two nearby clicks can score a pair inside the existing window.

Blocks, dots and arrows use three fixed-capacity instanced batches. Glyphs are allocated once,
their angle uses the same vectors as judging, and inactive glyph batches have count zero.
The idle/pause invalidation policy, desktop 60 Hz ceiling and 30 Hz background budget remain.

Tests: `tests/xr-whole-track-variation.test.mjs` checks each quarter of six-minute quiet FX-only
tracks at slow/medium/fast onset rates and low/high timing confidence, plus silence and gesture
contrast. `tests/automation-cue-alignment.test.mjs` checks both-sided evidence, false-cue rejection,
late-song coverage, user ownership and the production loader. `tests/xr-choreography.test.mjs`
covers real Visual OS integration, immutable deterministic
generation, all pair geometries, confidence fallback, density/response windows, reach/parity,
all eight directions, desktop assistance, and glyph/physics agreement.
