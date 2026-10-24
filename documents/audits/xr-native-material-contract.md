# T06c: native filament material and bounded carrier haze

Single integration owner: this chat; owners: shared visuals/types producer, XR GPU presentation,
player-setting hints and docs. User accepted T06b and requested the missing material next.

Before implementation: keep spatial v1 coordinates/stride, append optional material metadata with
resolved Amount/Detail/Bloom and aligned 3-float records (material phase, energy, raw emission alpha)
for grains and weave. Fixed arrays 1440/4320, borrowed until next render/prepare/dispose. The identity
emits its existing release phase and spectral energy, not wall time or a second simulation. Legacy
packets without metadata select the exact previous line shader branch. Existing Amount/Detail/Bloom
remain preset-owned, with the same player menu boosts, localStorage and Copy. No new switch.

Representation: carrier-local continuous capsule core, seeded fibre/filament structure, depth
extinction/throat damping and colour perspective follow the existing material's artistic laws.
Local halo plus two analytic wider emission lobes replace raster L1/L2 bloom in this spatial branch.
This is a spatial analogue, not pixel identity with the raster gather/blur and not a global volume
simulation. The wider lobes have only the original carrier's emission provenance. Zero Amount
bypasses all new shading/support; zero Bloom removes the wider lobes, retaining the material core
and its local halo. Detail changes fibre frequency/contrast and local halo support.

Budget: retain two instanced draws, 1440 grains + at most 4320 link segments, zero textures,
background canvases/workers/render targets/postprocessing passes. Material metadata adds 67.5 KiB
to the source. CPU computes bounded metre radii; shader also caps their support to a per-eye radius
of 12/14/16/18 pixels according to the existing quality budget. Outer support <=0.6 m and the near
gameplay corridor clearance accounts for it. Each eye uses its actual view/projection/viewport.
No per-frame object/mesh or buffer growth. Wider supports cost fill, not additional draw calls.

Stage priority remains T06b's explicit alpha-blended background queue, before notes/runway/HUD.
Validation must prove real pixel differences for Amount/Detail/Bloom, exact zero bypass, no empty
frame glow, deterministic fixed fixture, stereo/near/opaque+transparent stage priority, bounded
support/resources and clean disposal/mode changes. Desktop timing is evidence only, not a Quest
GPU/comfort acceptance. Hybrid remains default until physical testing.

Remaining inventory: T06d stars/galaxies/skybox/deep field; T06e wall/membrane/cracks/caustics/mosaic;
T06f lens/refraction/ring tint/vignette plus full inventory stereo/cockpit/Quest acceptance. Stop
after T06c deploy and manual feedback; do not label the complete native Wormhole finished.

## User-reported main-thread stutter: next priority before more visual layers

The user reports substantially worse main-thread stutter on Meta Quest in native mode. This is a
device observation, not reproduced on a physical headset here. Technical inspection confirms:
`XrAppController.update` -> scene update -> `XrNativeWormhole.update` -> native source `render` ->
private context `step` and full identity `draw` all run synchronously on the main thread. GPU
shading does not move this CPU work. `setQualityBudget` caps only the XR consumer; the producer
still evaluates its preset's complete grain pool and neighbours. The canvas worker is separate
and is not used by the native factory. These are plausible costs, not a proven single cause.

**T06c2, next priority after the T06c manual gate:** profile source/context/identity CPU, packet
copy/upload, scene and GPU costs separately; investigate a native geometry worker with bounded
transferable packet buffers, generation/serial matching, coalesced latest-song-time requests,
return/lease ownership, cancellation/disposal and a visible main-thread capability fallback.
Keep native shaders in the XR WebGL renderer and keep the worker canvas-free. Decide producer
quality budgeting without changing preset character or silently dropping important neighbours.
Retain a reproducible desktop profile; physical Quest frame pacing remains the user's manual gate.
