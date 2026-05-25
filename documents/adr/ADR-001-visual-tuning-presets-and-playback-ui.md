# ADR-001: Visual Tuning Presets And Playback UI Chrome

## Status

Accepted

## Date

2026-05-25

## Context

The visual tuning surface had grown from a small debugging panel into a user-facing performance tool. New requirements needed:

- Wider ranges for live visual experimentation.
- Editable circle background, circle opacity, stroke, and global background color.
- A single sensitivity control over the already-derived musical values.
- JSON presets that can be collected in a folder and loaded by name.
- Backward-compatible preset loading as the tuning schema evolves.
- A cleaner top control layout.
- VJ-style playback controls on the visual surface.
- Responsive metrics and seekbar chrome.
- Idle fading of UI chrome, including cursor hiding.

The app is a static Vite browser app, so it cannot enumerate files in a public directory without a manifest or a backend endpoint.

## Decision

Use typed visual tuning defaults plus metadata-driven controls as the source of truth.

Store preset files in `public/visual-tuning-presets/` and list them through `public/visual-tuning-presets/index.json`. Load presets through the browser fetch API and normalize every payload through `normalizeVisualTuningConfig`.

Keep the shared `State.visualTuning` object reference stable. Preset loads use assignment into the existing object so renderers and UI code keep reading the same shared object.

Implement music sensitivity as a render-time scale over accepted audio frames and visual feature frames. Do not change analyzer output or worker contracts for this UI-level tuning.

Keep playback ownership in `AudioEngine`. UI input dispatches play, pause, seek, and loop changes, while the engine owns source-node lifecycle and natural-end behavior.

Move VJ chrome behavior into `DashboardUI`: top controls, metrics toggle, panel visibility, dragging, keyboard shortcuts, and idle auto-hide are DOM concerns. Visual renderers only consume state and draw.

## Consequences

Positive:

- Presets remain backward-compatible when new tuning fields are added.
- The tuning panel can grow by adding defaults and control metadata instead of duplicating slider markup.
- Presets are simple static assets and work in the existing Vite deployment model.
- Renderers receive sensitivity-adjusted values without adding analyzer coupling.
- UI chrome can be refined independently from p5 visual effects.
- Loop mode stays aligned with audio source-node lifecycle.

Tradeoffs:

- `index.json` must be updated when adding or removing preset files.
- Preset names are file-name based; richer metadata would require extending the manifest or JSON schema.
- RGB background tuning is explicit and simple, but less compact than a color picker.
- Auto-hide behavior is intentionally owned by the UI layer, so new top-level chrome must opt into the same CSS/DOM classes.

## Alternatives Considered

- **Runtime directory listing:** Rejected because static browser deployments cannot reliably enumerate `public/` directory contents.
- **Replacing `State.visualTuning` on preset load:** Rejected because shared mutable state readers expect a stable object reference.
- **Changing analyzer output for sensitivity:** Rejected because sensitivity is a live visual preference, not a change to offline music analysis.
- **Persisting presets in local storage only:** Rejected because the user explicitly wanted named JSON files collected in a directory.

## Implementation References

- `src/config/visualTuning.ts`
- `src/types/index.ts`
- `src/state/store.ts`
- `src/ui/DashboardUI.ts`
- `src/audio/AudioEngine.ts`
- `src/visuals/ClassicPlexusEffect.ts`
- `src/visuals/TemporalMusicEffect.ts`
- `src/visuals/PlexusRenderer.ts`
- `public/visual-tuning-presets/`
- `branch_pr_snapshot.md`

