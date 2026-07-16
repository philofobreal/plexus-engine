# Cosmic Wormhole Videoclip Profile

This document records the Cosmic Wormhole videoclip performance profile: a deterministic,
music-aware BASELINE videoclip performance profile for the `cosmic-wormhole` visual
identity. It is explicitly not a guaranteed finished videoclip generator. The goal is
that any loaded track receives an acceptable, safe, non-boring, non-degenerate baseline
clip; when the timing analysis is weak, the profile falls back to a simpler, slower
dramaturgy instead of pretending confidence it does not have.

## Architecture position

The profile introduces NO new pipeline layer. There is no ClipDirector, no ClipScenePlan,
no EffectActionPlan, and no separate clip-actions asset. It is realized entirely through
the existing Visual OS data mechanisms defined by
[ADR-005](../adr/ADR-005-visual-os-style-system.md):

- `behaviourVocabulary` in `public/visual-tuning-presets/style-packs.json` authors the
  wormhole ACTION vocabulary per `AutomationSituation` (opaque handles, index 0 is the
  home family).
- `targetMap` binds each opaque action handle to a concrete clip preset with a morph
  curve and an optional intensity scale. This binding exists only in the adapter tier.
- The presets themselves are the clip scene roles (see below).

The domain chain (semantics -> ChoreographyDirector -> StyleTranslator -> situation
classifier -> long-scene planner -> micro-choreography) is unchanged and never sees a
preset filename or tuning key.

## Action vocabulary

The wormhole action handles are opaque, renderer-independent names. They appear in
`PerformanceAutomationPoint.meta.targetStateReference` provenance and resolve to presets
only inside `scenePlanAdapter` via the pack `targetMap`.

| Action handle | Preset | Clip role |
|---|---|---|
| `wormhole.establish-space` | `vos-wh-establish.json` | build the space: slow, distant, straight, calm |
| `wormhole.straight-drive` | `vos-wh-drive.json` | groove: close steady straight flight (curve exactly 0) |
| `wormhole.spiral-build` | `vos-wh-spiral.json` | distant rising tension: strong spiral flow and the largest authored path bend |
| `wormhole.sparse-break` | `vos-wh-sparse.json` | close segmented field / readable ribbed break texture |
| `wormhole.tunnel-punch` | `vos-wh-punch.json` | focused drop hit: sudden speed and warp jump |
| `wormhole.overdrive-peak` | `vos-wh-overdrive.json` | close full-frame rush: maximum speed/warp, jitter >= 0.8 |
| `wormhole.deep-drift` | `vos-wh-drift.json` | aftermath: the deepest, slowest space of the family |
| `wormhole.collapse-transition` | `vos-wh-collapse.json` | close transition: restrained depth compression into rings |
| `wormhole.reveal-galaxy` | `vos-wh-galaxy.json` | distant reveal: slow glide with the longest streaks |
| `wormhole.outro-dissolve` | `vos-wh-dissolve.json` | close dissolve: quieter but still visible perspective trails |

## Situation mapping

`behaviourVocabulary` is authored for all 11 situations, so the generic base-temporal
vocabulary and the variant-pair fallback never engage for this pack:

| AutomationSituation | Action handles (home family first) |
|---|---|
| `intro-establish` | establish-space, straight-drive |
| `verse-long` | straight-drive, establish-space, reveal-galaxy |
| `groove-sustain` | straight-drive, spiral-build, reveal-galaxy, sparse-break |
| `buildup-ramp` | spiral-build, collapse-transition, tunnel-punch |
| `drop-short` | tunnel-punch, overdrive-peak |
| `drop-long` | tunnel-punch, overdrive-peak, reveal-galaxy, collapse-transition |
| `drop-after-build` | tunnel-punch, overdrive-peak, reveal-galaxy |
| `breakdown-long` | deep-drift, sparse-break, reveal-galaxy, establish-space |
| `peak-sustain` | overdrive-peak, tunnel-punch, collapse-transition, reveal-galaxy |
| `transition-release` | collapse-transition, sparse-break |
| `outro-dissolve` | outro-dissolve, deep-drift, establish-space |

The narrative-level `targetMap` keys (intro, groove, tension, build, fake-drop, release,
peak, breakdown, outro, default) are all overridden to clip presets as well, so no main
dramaturgy key falls back to a generic `temporal*.json` preset.

Note on `release -> vos-wh-punch.json`: in Plexus semantics the `release` narrative IS
the dramaturgical drop, not a wind-down. `NarrativeEngine` maps the analyzer's `drop`
section label to the `release` narrative, and the situation classifier treats `release`
as the drop payoff (`drop-short`/`drop-long`/`drop-after-build`). The punch/drop-hit
character is therefore the semantically correct binding; the wind-down roles live on
`breakdown` (sparse-break), `outro` (outro-dissolve), and the `wormhole.deep-drift`
action inside the situation vocabularies.

## Preset family constraints

- The family contains ten tunnel roles; it deliberately adds no craft, star-system, or
  camera-journey layer to the wormhole identity.
- Every `vos-wh-*.json` preset pins `"visualMode": "cosmic-wormhole"` at the root, so
  loading one always lands in the wormhole identity.
- Every clip preset explicitly carries its route/grain wormhole role keys, but does not
  write `wormholeStarfield`, `wormholeGalaxy`, or `wormholeSkybox`. Those remain
  user-global background masters. Cross-identity pollution is handled by the automation
  ownership guard for explicitly foreign presets, not by resetting user background
  controls on every wormhole role change.
- Every factory wormhole preset keeps `lineAlpha >= 1.25`. Establish,
  drive, spiral, collapse, and dissolve use longer continuity to preserve tunnel velocity
  instead of falling back to a point-cloud look.
- Only collapse uses `wormholeRing`, with restrained `0.35` compression. Sparse keeps
  ring alignment at zero and recovers segmented/ribbed texture through depth coherence,
  sparse emission, and long continuity.
- Every role explicitly authors `wormholeDepthCoherence`; roles without cohort compression
  pin it to zero. Coherence is distinct from ring alignment and cannot accumulate
  path-dependent damage across horizon morphs or seeks.
- Every role explicitly authors `wormholePathBend`. Establish, drive, sparse, collapse, punch, and
  dissolve are exact straight-axis roles; drift and galaxy own restrained scenic arcs; overdrive may
  bank under peak energy; spiral alone owns the strongest hero turn. The value is signed: positive
  and negative values are horizontal mirror directions. `wormholePathBendVertical` is independently
  signed for diagonal scenic arcs; `bendMirror` flips the mirrorable spiral/overdrive direction before
  the target is applied. Straight roles actively steer a previously curved runtime route back to the
  zero-heading baseline without a camera teleport. This explicit-authoring discipline is not limited
  to the 10 wormhole clip roles: every bundled factory preset asset that authors `wormholeRadius` or
  `wormholeDepth` also explicitly authors `wormholePathBend`, `wormholePathBendVertical`, and both
  complete radius/depth LFO profiles, so route-bend and LFO state cannot stick
  across a preset switch into any other factory preset, wormhole or otherwise. Runtime behaviour for
  externally-authored/user presets is unaffected: an absent key still stays sticky (VT-3.7).
- Every factory geometry preset authors a role-expressive radius/depth waveform, rate, and amount:
  atmospheric states stay slow and organic, drive/build states use medium rhythmic movement, and
  peak/transition states use faster, sharper shapes. The LFO modulates the release-snapshotted tunnel radius/depth around their authored values in the
  distance domain (never wall-clock time), so it freezes with the rest of a grain's geometry at
  release and reproduces identically under seek, export, and any playback FPS. See
  [VT-2.16](../acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md) for the full contract
  (enum range, normalization semantics, and morph-snap behavior).
- The style-pack pair metadata is operational: `minSegmentSec`, `maxSegmentSec`, `alternation`, and
  `intensityShape` select the pacing envelope, and the wormhole morph floor prevents a high-delta
  preset pair from collapsing into a short attack morph.
- Role-level contrast is a tested contract, not a styling accident: the drive is exactly
  straight, the spiral out-twists the drive, the punch outruns the drive, the overdrive
  tops the punch, the drift is the deepest and slowest, the sparse break uses a continuous
  segmented sparse texture, collapse owns ring compression, the galaxy reveal owns streak length, and the
  dissolve is the dimmest while retaining visible perspective trails. The preset values themselves are
  first-draft designer values; tuning them is fine as long as these relations hold.

## Near/far geometry pairs

The fixed-lens projected tube scale follows `wormholeRadius / wormholeDepth`. Each natural role
pair therefore uses both controls in opposition: the near member has a larger radius and shallower
horizon, while the far member has a smaller radius and deeper horizon. The authored pair contrast
is at least `2.2x`; LFO motion animates around those centers without erasing their spatial identity.

| Near member | Far member |
|---|---|
| straight drive | establish space |
| collapse transition | spiral build |
| sparse break | galaxy reveal |
| overdrive peak | tunnel punch |
| outro dissolve | deep drift |

## Readability and perspective pass

The ten original presets raise `audioSensitivity` and `lineAlpha` while preserving their
relative character (including dissolve as the dimmest role). Continuity increases on the
deep-perspective and transitional roles strengthen tunnel velocity; sparse is the explicit
exception, using sparse emission, depth coherence, and long continuity for its ribbed texture.
Punch, overdrive, and collapse keep at least `2.2` depth, `0.75` radius, and at most `1.25`
authored line weight; renderer-side near fade and projection caps remain the final safety net.
Reduced spiral/punch/overdrive warp avoids a centrifuge-like camera feel. This pass does not change the
user-global `wormholeStarfield`/`wormholeGalaxy` masters and does not alter
`WormholeEmission.ts`: the continuous emission-mode morph is not the source of the observed
brightness loss. A master-default boost, if needed after visual review, remains a separate
change.

The automation lane uses fills of at most `0.08` alpha. Selected morphs are indicated by
outline and a restrained glow instead of a stronger filled gradient, preventing the editor
overlay from visually swallowing dark wormhole passages.

## Low-confidence fallback

Weak timing analysis produces a simpler clip, not a broken one. Both mechanisms below are
GLOBAL Visual OS safety rules: they live in the style-agnostic
`microChoreographyPlanner` and therefore apply to every style pack under low-confidence
timing, not only Cosmic Wormhole. The wormhole profile relies on them; it does not own
them. They engage at the same threshold (overall timing confidence below 0.35, or an
unreliable grid):

- `resolveSegmentCount` (existing) coarsens the subdivision (fewer, longer segments) and
  boundaries fall back to an equal-time split.
- `dampVariationForConfidence` (in `src/automation/microChoreographyPlanner.ts`,
  introduced alongside this profile) damps the variation profile: at most two behaviour
  families per scene, rarer switching and releases, less seeded jitter, and a longer
  trailing breath. It only engages when the tempo context carries real timing evidence
  (bpm or bars present); a neutral context from a direct adapter caller is left
  untouched. It always returns a fresh clone and never mutates the exported
  `VARIATION_PROFILES`.

## Determinism

The profile inherits the Visual OS determinism guarantees: all variation derives from
the seeded hash of the analysis, and identical input produces a byte-identical
`PerformanceAutomationPlan` (tested, including the low-confidence path).

## Validation

`tests/wormhole-clip-profile.test.mjs` pins the contract: 10-preset registration and role
coverage, explicit route/grain wormhole role keys, user-global background masters, the identity ownership guard, the mandatory `visualMode`, role-level contrast,
the opacity floor, authored ring roles only, targetMap purity on the main dramaturgy
keys, and the full 11-situation action vocabulary,
end-to-end action coverage for a clip-shaped fixture, byte-identical determinism, the
`dampVariationForConfidence` clone/no-mutation regression, and the low-confidence
simplification contracts. `tests/visual-os.test.mjs` keeps the pack-level dramaturgy
mapping assertion.

`tests/wormhole-depth-integrity.test.mjs` separately pins immutable depth-phase uniformity,
authored coherence determinism, repeated-seek integrity, and identical tunnel/galaxy geometry
at the same song position after different render histories. `tests/wormhole-lifecycle.test.mjs`
pins automation-transition re-arming after backward seek.

This feature is an ADR-005 data-mechanism extension, so ADR-005 itself is unchanged.
