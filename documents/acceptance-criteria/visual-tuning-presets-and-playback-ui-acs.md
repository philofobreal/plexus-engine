# Visual Tuning, Presets, And Playback UI Acceptance Criteria

This document captures the accepted behavior for the current visual tuning and playback UI branch. It is additive to `../Usage ACs.md`.

## VT-1 Visual Tuning Panel

- **VT-1.1 Default visibility:** The visual tuning panel is closed by default.
- **VT-1.2 Toggle:** The `Tuning` control opens and closes the panel without resetting current tuning values.
- **VT-1.3 Dragging:** The panel can be repositioned by dragging its header, and normal slider/select interaction inside the panel must not start a drag.
- **VT-1.4 Responsive layout:** The panel uses responsive columns and avoids an awkward fixed internal scroll on common desktop widths.
- **VT-1.5 Extendable controls:** Adding a new numeric visual tuning parameter must require updating the typed default config and the control metadata, not duplicating slider UI code.

## VT-2 Tuning Parameters

- **VT-2.1 Defaults:** Existing visual defaults remain the baseline output.
- **VT-2.2 Expanded ranges:** All exposed panel parameters have materially larger but bounded ranges than the previous implementation.
- **VT-2.3 Large circle strokes:** Circle shockwave and ring stroke controls allow very large stroke values.
- **VT-2.4 Circle background:** Circle background hue and opacity can be adjusted independently from core circle hue and opacity.
- **VT-2.5 Global background:** Background red, green, and blue controls can produce black, the existing dark background, and pure white.
- **VT-2.6 Music sensitivity:** A single `Music sensitivity` slider scales the already-established audio and visual feature values up or down.
- **VT-2.7 Analyzer isolation:** Music sensitivity must not re-run or mutate offline audio analysis results.

## VT-3 Presets

- **VT-3.1 Preset folder:** Presets are stored as JSON files under `public/visual-tuning-presets/`.
- **VT-3.2 Manifest:** The app reads the preset list from `public/visual-tuning-presets/index.json`.
- **VT-3.3 File names as names:** Preset names are derived from JSON file names.
- **VT-3.4 Clean labels:** The preset selector does not show the `.json` suffix.
- **VT-3.5 Default selection:** The selector starts from `default.json` when it is present instead of showing a placeholder.
- **VT-3.6 Load on select:** Selecting a different preset immediately applies that preset's parameters.
- **VT-3.7 Backward compatibility:** Missing preset fields are filled from `defaultVisualTuning` during load.
- **VT-3.8 Stable state reference:** Loading a preset mutates the existing shared tuning object instead of replacing it with a new reference.
- **VT-3.9 Quiet success:** Successful preset loads do not display transient success text that shifts the UI.
- **VT-3.10 Error visibility:** Failed manifest or preset loads may show an error state long enough to diagnose the problem.

## VT-4 Header And Metrics

- **VT-4.1 Track metadata:** The header shows only the audio file title after load.
- **VT-4.2 No analysis chatter:** The header does not show completion text, sample count, section count, cue count, or similar analysis internals.
- **VT-4.3 BPM location:** BPM appears in the metrics panel as a normal metrics value.
- **VT-4.4 Metrics toggle:** A compact metrics toggle is placed above the seekbar, not in the top-right control group.
- **VT-4.5 Metrics layout:** Metrics use the original card-like grid layout and adapt by viewport width.
- **VT-4.6 Cue removal:** The cue metrics block is not displayed.
- **VT-4.7 Music block size:** `Music Block & Dynamics` occupies one metrics grid unit.

## VT-5 Seekbar

- **VT-5.1 Full width:** The seekbar spans the available window width responsively.
- **VT-5.2 Visual style:** The seekbar uses the same minimal rectangular visual language as metric value cards.
- **VT-5.3 Interaction:** Dragging or clicking the seekbar continues to seek accurately through the audio engine.

## VT-6 Playback Surface

- **VT-6.1 Center play:** A responsive translucent play affordance appears in the center when playback is available and stopped or paused.
- **VT-6.2 No pause overlay:** A separate pause overlay is not shown during playback.
- **VT-6.3 Double-click toggle:** Double-clicking the visual background toggles play and pause.
- **VT-6.4 Single-click behavior:** Single click on the visual background does not pause playback.
- **VT-6.5 Keyboard play/pause:** Pressing `Space` toggles play and pause when the visual surface is the active element.
- **VT-6.6 Keyboard seek:** `ArrowLeft` and `ArrowRight` seek backward and forward by five seconds when the visual surface is the active element.
- **VT-6.7 Focus scope:** Playback keyboard shortcuts must not hijack typing or control interaction outside the visual surface.

## VT-7 Looping

- **VT-7.1 Default loop:** Playback is in loop mode by default.
- **VT-7.2 Toggle:** The top control can switch between looped and one-shot playback.
- **VT-7.3 Natural end loop:** In loop mode, natural track end restarts playback from the beginning.
- **VT-7.4 Natural end once:** In one-shot mode, natural track end stops playback and emits the normal ended state.

## VT-8 Auto-Hide Chrome

- **VT-8.1 Idle hide:** Top controls, bottom playback chrome, and visible panels fade out after inactivity.
- **VT-8.2 Reveal:** Mouse, pointer, keyboard, or touch activity reveals the chrome.
- **VT-8.3 Hover persistence:** Hovering or focusing chrome keeps it visible even after the idle timer elapses.
- **VT-8.4 State preservation:** Collapsed panels stay collapsed after reveal; open panels return only if they were open.
- **VT-8.5 Cursor hide:** The mouse cursor is hidden while the chrome is in the idle-hidden state.

## VT-9 Regression Requirements

- **VT-9.1 File loading:** Audio file loading, analysis, play enablement, and seek enablement must continue to work after UI changes.
- **VT-9.2 Preset switching:** Switching presets after audio load must not reset playback state or require reloading the track.
- **VT-9.3 Contract tests:** The shared tuning and worker contracts must remain covered by automated tests.
- **VT-9.4 Build:** The TypeScript build must pass after changes to state, UI, audio, or visual contracts.

