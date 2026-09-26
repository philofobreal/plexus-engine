# XR musical choreography

The XR score is a motor interpretation of the existing Visual OS, prepared once after analysis.
`prepareWormholePerformance` builds the default Cosmic Wormhole balanced/paired journey. The
facade passes that exact plan to both the pure chart builder and the optional background.
Turning the background on later does not regenerate the score or its accompanying journey.
No preset filename is interpreted as gameplay meaning, no new DSP is introduced, and no
render callback performs narrative or chart planning. Failed planning uses event-driven phrase variation
and reports it in the launch panel; an empty shared plan prevents an independent background retry.

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

Single targets alternate hands. Direction parity survives automation changes: recent strokes
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
