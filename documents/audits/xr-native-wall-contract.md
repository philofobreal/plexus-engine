# T06e: native membrane, caustics, mosaic and fractures

User accepted T06d. Single integration owner: this chat. Owners: shared visuals/context/types and
native worker transport, XR instanced consumer and player settings. No audio/analyzer/judge owner
changes. No dependency, second simulation, background canvas or offscreen image. Hybrid stays default.

Use existing drawWall helpers and original preprojection projectWormholeTubePoint output. Emit
metre heads/tails/width/colour/alpha before perspective, capturing original ripple, clump/Fresnel,
sector brightness, dense caustic interpolation, mosaic tick placement and kick/LOW_DROP crack paths.
Reuse the one existing bounded wave-front pool, never re-detect events. Chromatic fringe uses the
original warm/cool palette and a bounded physical radial offset before per-eye projection; it is
coloured edge light, not a background-refraction implementation. Lens/imaging stays T06f.

Optional native v1 wall segment field: stride 16, fixed 3200 records. Layout matches native segments;
slot 15 identifies membrane=0, caustic=1, mosaic=2, crack=3; slot 12 fringe variant -1/0/+1.
Max membrane 16*48 core + <=1536 fringes + 5*47 caustics + 7*7*3 fractures = 2686 (<3200).
Mosaic 12*24 plus fractures is smaller. Original 437760-byte primary and 308352-byte cosmos banks
stay unchanged; one additional fixed 204800-byte wall bank shares the same atomic request lease.
All buffers return once, including stale results; absence clears wall instances. Two main banks,
one in-flight/latest request, epoch/revision/generation/time, deadlines and main fallback remain.

XR adds one bounded instanced stroke batch, no full-screen fill. Authored width in metres, per-eye
pixel caps and stable quality strides; reject near/gameplay-crossing/too-long segments. Depth writes
off, batch before grains and stage/notes/HUD. Finite geometry honours background distance. Disposal,
load/reprepare, off/on and Hybrid restoration clear old packets and GPU counts.

Wall menu: Off (legacy default), Preset (authored wormholeOpticsEnabled and wormholeWall), On
(explicit wall-only override; use authored positive amount, or unit base when authored zero).
Material Preset/Membrane/Mosaic; Amount/Fringe/Caustics/Waves/Cracks use shared Advanced gain law
(50 neutral, 0 zero, upper half up to 4x then existing tuning bounds). Preset owns underlying amounts,
mode, ripple/route/depth and events. Manual choices do not mutate preset/plan. Controls are menu,
localStorage/Copy and presentation scope. Old records normalize to Off/Preset/neutral. The private
context restores only the wall's authored gate; it never turns on the MVP surface's lens globally.
Hybrid and Native can use the same explicit wall presentation; unrelated hosts without it retain
the prior surface policy. No forced preset edits or experimental-default promotion.

Validate all families, zero/off/mode/gains, authored gate without preset mutation, canonical wave
and crack events, native/worker equality and stale/lease/absence errors, stereo/near/transparent
stage priority, bounded draws/copies and real UI persistence/Copy. Full cumulative regression and
build before deploy. Desktop/GPU submission does not establish Quest pacing or comfort. Keep prior
sources/results; rollback Off/Hybrid or previous Pages tree in a new commit. Stop for manual test.
