# T06d: native stars, galaxies and distant sky

Integration owner: this chat. Owners: visuals producer/context, shared plain contracts and worker
transport; XR GPU consumer; XR settings/menu/persistence. T06c2 accepted by the user. No subagents.

Reuse original star/galaxy pools, route states, travel and brightness. Emit preprojection coordinates
before raster optics; no second simulation. The native sky is a finite far directional plane derived
from the original normalized sky pool and heading law, not from rendered pixels. It covers the
authored forward field; it is not a new surrounding full-sphere environment. Lens/deep-field imaging
remains T06f. Membrane/wall remains T06e. Hybrid stays default and retains its full image.

Bounded optional native v1 cosmos carrier: stride 16, 1800 stars + 18 galaxy core/echo + 3000 sky
core/dust = 4818 records. Sky uses stable every-sixth original pool entry (1500/9000), deliberately
bounded for XR. Same metre head/tail/radius/RGB/alpha metadata; slot 15 identifies family. Original
grain/weave/material packet and its 437760-byte bank remain byte-layout compatible. A separate
308352-byte cosmos buffer shares the one request/lease and the same two presentation banks.
Absent cosmos means zero instances. Both buffers return once before the next request. All existing
generation, epoch, settings revision, identity, timeout and fallback checks apply atomically.

One additional instanced draw, procedural soft discs/short streaks, no texture or offscreen pass.
Finite cosmic coordinates are uniformly fitted under a separate group to the selected 40-500 m
horizon (1200 m source horizon), preserving angles and relative depth. Near/long streak safety and
per-eye width/fill caps protect the cockpit. Background renders before runway/notes/HUD and does
not write depth. Existing quality selects stable family sample strides, not changing pool seeds.

Cosmos menu: Stars 0-200%, Galaxies 0-200%, Sky 0-100%; stars/galaxies default 100%, Sky 0%
preserves the disabled legacy skybox. An explicit nonzero Sky enables it in both XR modes,
without changing the technical flag or Studio/MVP defaults. These are the existing
user-global tuning masters, not preset geometry. The private frame context applies the explicit
masters after preset/macro resolution; no preset mutation. Hybrid and Native consume them alike.
Stored/copied through existing player settings, old records normalize to defaults. Artistic route,
speed and grain material remain preset-owned. Changing any control invalidates old worker results.

Risk: added GPU fill and transfer/attribute-copy cost despite off-thread computation. Measure
producer, main copy and draw/triangle counts in a real WebGL fixture; desktop is not Quest acceptance.
Validate bounded/finite packets, deterministic seeks, true stereo, stage priority, old packets,
settings/storage/Copy and worker atomic transfers, then full cumulative tests and deployed UI.
Retain predecessor sources and identities. Rollback: zero Cosmos sliders or select Hybrid; retain
prior Pages tree for publication without force push. Stop after deployment for manual feedback.
