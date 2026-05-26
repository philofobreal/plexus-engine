# Visual Tuning, Presets, And Playback UI

This feature document records the visual tuning and player-surface behavior in the active TypeScript implementation.

## Feature Scope

The app now exposes a broader, reusable visual tuning system, persistent JSON presets, a cleaner responsive playback UI, and industry-standard visual-surface playback controls.

## Visual Tuning

The visual tuning model is centralized in `src/config/visualTuning.ts`.

Implemented capabilities:

- Visual tuning is hidden by default and can be opened with the `Tuning` top-control button.
- The tuning panel can be dragged by its header.
- The panel uses a responsive grid that fills available space more effectively.
- All visible tuning ranges were expanded to support stronger experimentation while preserving the previous default values.
- Circle and ring stroke parameters support very large values.
- Circle background hue and opacity can be tuned independently from the circle core/ring styling.
- Global background color is tunable through RGB controls and can reach pure white.
- A single `Music sensitivity` slider scales already-computed audio and visual feature values up or down without changing the analyzer.
- Tuning controls are grouped through metadata so new parameters can be added by extending the config object and the control list.

The default tuning values remain the baseline behavior. New or old preset payloads are normalized through `normalizeVisualTuningConfig`, which merges valid numeric values onto `defaultVisualTuning`.

## Preset Management

Visual tuning presets are loaded from `public/visual-tuning-presets/`.

Implemented capabilities:

- Presets are plain JSON files.
- `public/visual-tuning-presets/index.json` is the browser-readable manifest because static web apps cannot safely list a directory at runtime.
- Preset names come from file names.
- The preset selector is placed in the top controls next to the visual effect mode selector.
- The selector display strips the `.json` suffix.
- The selector defaults to `default.json` when available instead of showing a placeholder.
- Selecting a preset immediately loads its tuning values.
- Old preset files remain valid because missing parameters are filled from defaults.
- Preset loading does not show transient success messages that would resize or shift the panel.
- The `Copy config` button exports the current tuning state as preset-compatible JSON with a `version` field and a `visualTuning` payload.
- Copy feedback is intentionally transient and confined to the tuning panel status area so it does not shift layout. Preset-load failures may use the same status area for short-lived diagnostic text.

Preset JSON can be stored either as the raw tuning object or under a `visualTuning` property. Invalid or unknown fields are ignored.

## Playback Controls

The central visual surface now behaves as the primary playback target.

Implemented capabilities:

- A translucent center play button is shown when playback can be started and is not currently running.
- Double-clicking the visual background toggles play and pause.
- Pressing `Space` toggles play and pause when the visual surface is focused.
- `ArrowLeft` and `ArrowRight` seek backward and forward by five seconds when the visual surface is focused.
- Single-clicking the visual background pins or unpins the UI chrome after the double-click detection delay. Pinned chrome remains visible and does not idle-hide.
- The fullscreen button toggles browser fullscreen mode for presentation use.
- Playback loops by default.
- A `Loop` / `Once` top-control toggle switches between endless repeat and one-shot playback.
- The audio engine restarts from the beginning on natural end when loop mode is active.

Single click no longer pauses playback. Pause follows the same double-click behavior as play.

## Metrics And Chrome

The dashboard chrome was simplified for performance use and VJ-style presentation.

Implemented capabilities:

- The top panel shows the loaded audio file name only.
- Analysis-completion details such as sample count, section count, or cue count are not shown in the header.
- BPM is shown as a metrics value instead of in the title panel.
- The legacy `Bass`, `Mid`, and `Treble` metric labels display the render-facing `AudioFrame.b`, `AudioFrame.m`, and `AudioFrame.t` values. In the current worker contract those values are smoothed density, melody-presence, and fx-presence projections, not raw crossover bands.
- The metrics panel can be expanded or collapsed from a compact control above the seekbar.
- The metrics grid uses the original card-style layout and responds to viewport width.
- The cue metric card was removed.
- `Music Block & Dynamics` was renamed to English and occupies one grid unit.
- The seekbar is a minimal rectangular full-width control aligned with the metrics visual style.
- The top controls, bottom playback section, and open panels fade out after user inactivity.
- Pointer, keyboard, touch, and mouse activity reveal the chrome again.
- Hovering or focusing visible chrome keeps it visible.
- The cursor is hidden while the chrome is in the idle-hidden state.

## Implementation Notes

The feature is split across these runtime layers:

- `src/config/visualTuning.ts`: defaults, control metadata, preset normalization, audio-sensitivity helpers.
- `src/types/index.ts`: persisted tuning and playback state contracts.
- `src/state/store.ts`: shared runtime state for tuning, visual mode, playback loop mode, and chrome behavior.
- `src/ui/DashboardUI.ts`: DOM controls, preset loading, panel visibility, dragging, playback shortcuts, metrics projection, and auto-hide behavior.
- `src/audio/AudioEngine.ts`: loop-on-end playback behavior.
- `src/visuals/`: render usage of tuning values, background color, and sensitivity-scaled audio data.

## Analysis And Error Handling Details

Browser-level file loading and `AudioContext.decodeAudioData` failures are surfaced through the dashboard as file-load errors. In that state playback and seek remain disabled, while file selection is re-enabled so the user can choose another track.

Beat event types are assigned by the analyzer worker from smoothed visual-feature context after spectral-flux peak picking:

- Type 3 is emitted when smoothed fx presence is greater than `0.6`.
- Type 2 is emitted when fx does not pass that threshold and smoothed density is greater than `0.7`.
- Type 1 is the fallback for all other accepted beat peaks.
