# Dashboard Tooltip Implementation Plan

This plan designs lightweight dashboard metric tooltips without implementing code. It audits the current metrics panel rendering and update path, then compares implementation options.

## Current Dashboard Structure

Files reviewed:

- `src/main.ts`
- `src/ui/DashboardUI.ts`
- `src/style.css`
- `documents/features/dashboard-metrics-metadata.md`

Current metrics panel:

- `src/main.ts` defines static `.metric-card` markup inside `#metrics-grid`.
- Each card contains `.m-label`, `.m-value`, `.m-bar-bg`, and `.m-bar-fill`.
- Current visible cards, in source order, are BPM, Dynamics State, Energy, Density, Melody Presence, FX Presence, Vocal, FX, Beat Impulse, and Progress.
- Tension and Buildup are currently timeline/analysis metrics, not visible metric cards.

Current update path:

- `DashboardUI.updateDashboard()` updates dashboard text and progress-bar widths.
- It runs only every fourth render frame from `PlexusRenderer.draw()`.
- It also calls `requestDashboardTimelineDraw()`, which throttles timeline redraws by visible state changes.
- The audio worker and Web Audio playback path do not depend on dashboard DOM updates.

Existing tooltip precedent:

- `DashboardUI.createTimelineTooltip()` creates one `#timeline-tooltip` DOM element once.
- Timeline pointer handlers update/reposition that element.
- This pattern is acceptable because it avoids per-frame DOM recreation.

## Requirements

- Zero impact on audio thread.
- No per-frame tooltip DOM recreation.
- No additional render loops.
- Mobile friendly.
- Desktop hover support.
- Keyboard accessible.
- Tooltip content should come from a metadata registry matching `documents/features/dashboard-metrics-metadata.md`.

## Implementation Options

### Option 1: Native `title` Attributes

Attach short tooltip text to each `.metric-card` with a `title` attribute and optional `aria-label`.

Complexity: Low

Maintenance cost: Low

Runtime cost: Near zero

Pros:

- No custom DOM.
- No event handling.
- No render-loop interaction.

Cons:

- Poor mobile support.
- Inconsistent browser styling/timing.
- Limited keyboard behavior.
- Cannot present structured two-line text reliably.
- Hard to style to match the existing UI.

Assessment: Too limited for the stated requirements.

### Option 2: CSS-Only Tooltips With Pseudo-Elements

Add `data-tooltip` attributes to `.metric-card` nodes and use `.metric-card:hover::after` / `.metric-card:focus-within::after`.

Complexity: Low to medium

Maintenance cost: Medium

Runtime cost: Near zero

Pros:

- No JavaScript runtime work beyond initial attributes.
- No additional render loops.
- Good desktop hover support.

Cons:

- Mobile tap behavior is awkward.
- Keyboard support requires cards to become focusable and careful CSS.
- Positioning near viewport edges is limited.
- Pseudo-element content is not always ideal for assistive technology.
- Multi-line behavior and collision handling are brittle.

Assessment: Good for simple static hover hints, not ideal for accessible cross-input tooltips.

### Option 3: One Shared DOM Tooltip With Event Delegation

Create a single dashboard tooltip element once, similar to the timeline tooltip. Attach metric metadata keys to metric cards, then use event delegation on `#metrics-grid` for `pointerenter`/`pointerleave`, `focusin`/`focusout`, `click`, and `keydown`.

Complexity: Medium

Maintenance cost: Medium

Runtime cost: Low

Runtime model:

- Create one tooltip node during `DashboardUI` construction or init.
- Add `data-metric-key` and focusability to each metric card once.
- Use one delegated listener set on `#metrics-grid`.
- On hover/focus/tap, read metadata and update tooltip text.
- On pointer move, either avoid continuous tracking by anchoring to the card rect, or throttle with `requestAnimationFrame` only while visible.
- On hide, add `.is-hidden`; do not remove/recreate the node.

Pros:

- No audio thread impact.
- No per-frame DOM creation.
- No new render loop.
- Works for desktop hover.
- Works for keyboard focus.
- Can support mobile tap to show and outside tap/Escape to close.
- Can reuse existing tooltip visual conventions.
- Allows viewport-aware positioning.

Cons:

- Requires careful event handling and ARIA attributes.
- Slightly more code than CSS-only.
- Needs a small amount of state for active metric key and tooltip visibility.

Assessment: Best fit.

### Option 4: Inline Expandable Help Rows

On click/focus, expand a small help row inside each metric card.

Complexity: Medium

Maintenance cost: Medium to high

Runtime cost: Low when inactive, but layout changes when active

Pros:

- Mobile and keyboard friendly.
- No absolute positioning.
- Can be accessible with standard DOM flow.

Cons:

- Changes dashboard layout.
- Metric grid height shifts can disturb the presentation surface.
- More visual weight than lightweight tooltips.
- Harder to keep compact during performance use.

Assessment: Accessible, but not lightweight enough for the current dashboard.

## Recommended Solution

Recommend Option 3: **one shared DOM tooltip with event delegation**.

This matches the existing timeline tooltip pattern while keeping dashboard tooltip logic outside the render/update loop. It satisfies desktop hover, mobile tap, and keyboard focus without per-card tooltip nodes or layout shifts.

## Proposed Architecture

### Metadata Registry

Create a static metadata registry in a UI-safe module. It can follow the design in `documents/features/dashboard-metrics-metadata.md`:

```ts
interface MetricMetadata {
  name: string;
  description: string;
  source: string;
  range: string;
  tooltip: string;
}
```

Initial keys should cover:

- `bpm`
- `energy`
- `density`
- `melodyPresence`
- `fxPresence`
- `vocal`
- `fx`
- `beatImpulse`
- `progress`
- `dynamicsState`

Additional metadata can exist for non-card metrics:

- `tension`
- `buildup`

Those can later be used by the dramaturgy timeline or an advanced metrics view.

### Markup

Add stable data attributes to cards in `src/main.ts`:

```html
<div class="metric-card" data-metric-key="energy" tabindex="0" aria-describedby="dashboard-metric-tooltip">
```

Recommended attributes:

- `data-metric-key`: metadata lookup key.
- `tabindex="0"`: keyboard focus target if the card remains a `div`.
- `aria-describedby="dashboard-metric-tooltip"` while tooltip exists.
- Optional `role="button"` is not recommended unless the card performs an action. A focusable `group` or plain focusable region is more accurate.

### Tooltip Node

Create one node once:

```html
<div id="dashboard-metric-tooltip" class="metric-tooltip is-hidden" role="tooltip"></div>
```

Creation can happen in `DashboardUI` initialization, similar to `createTimelineTooltip()`.

The tooltip should contain only the short two-line text from metadata. Longer descriptions remain in docs or future help panels.

### Event Handling

Attach listeners once to `this.els.metricsGrid`:

- `pointerover`: if target is inside `[data-metric-key]`, show tooltip.
- `pointerout`: hide when pointer leaves the active card.
- `focusin`: show tooltip for keyboard focus.
- `focusout`: hide tooltip.
- `click`: on coarse pointers/mobile, toggle tooltip for the tapped card.
- `keydown`: hide on `Escape`.
- document-level `pointerdown` only while tooltip is visible, or a single permanent listener that hides if the tap is outside the active card and tooltip.

Avoid:

- Updating tooltip from `updateDashboard()`.
- Creating or removing tooltip nodes on every interaction.
- Running `requestAnimationFrame` continuously.
- Listening to audio events or worker messages.

### Positioning

Use card-anchored positioning:

1. Read the active card's `getBoundingClientRect()` when showing the tooltip.
2. Position above the card by default.
3. If there is not enough space above, position below.
4. Clamp left/right within viewport padding.

This avoids pointermove tracking and keeps runtime cost fixed per show event.

For mobile:

- On coarse pointers, position below the card when possible.
- Keep tooltip max width to `min(320px, calc(100vw - 24px))`.
- Dismiss on outside tap, Escape, metric collapse, or playback/timeline overlay open.

### Accessibility

Keyboard:

- Metric cards must be reachable by Tab.
- `focusin` shows the tooltip.
- `focusout` hides it.
- Escape hides it.

Screen readers:

- Tooltip node should use `role="tooltip"`.
- Cards should reference it via `aria-describedby`.
- Tooltip text should be concise and should not duplicate the visible metric label unnecessarily.

Reduced motion:

- Tooltip fade transitions should be short.
- Honor `prefers-reduced-motion` by removing transition if needed.

### Styling

Use a new `.metric-tooltip` class or share base styling with `.timeline-tooltip` if the visual design should match.

Suggested CSS properties:

- `position: fixed`
- `z-index` above UI chrome but below fullscreen timeline overlay controls if needed
- `pointer-events: none` for hover/focus display
- compact padding and 0.75rem text
- max width clamped to viewport
- background and border consistent with `.timeline-tooltip`

For mobile tap mode, if the tooltip needs clickable dismissal or a close control later, switch `pointer-events` only for that mode. Initial design can keep outside-tap dismissal and no close button.

## Runtime Cost Analysis

Recommended approach cost:

- Audio thread: zero. No Web Audio or worker interaction.
- Render loop: zero direct cost. Tooltip code does not run from `draw()` or `updateDashboard()`.
- DOM creation: one tooltip node at initialization.
- Event listeners: one delegated listener set on `#metrics-grid`; optional document listener for dismissal.
- Show/hide cost: one metadata lookup, one text update, one `getBoundingClientRect()`, and class/style changes per interaction.
- Per-frame cost: none.

## Maintenance Cost Analysis

Metadata maintenance:

- Add/update one registry entry per metric.
- Dashboard card `data-metric-key` must match registry keys.
- Tests should verify all metric cards have metadata and no duplicate/missing keys.

UI maintenance:

- One tooltip implementation path.
- No per-card tooltip duplication.
- No repeated tooltip markup in `main.ts`.

Potential edge cases:

- Metrics grid hidden via `.metrics-grid.is-hidden`: hide active tooltip.
- Timeline overlay open: hide active tooltip.
- Chrome idle: hide active tooltip or let focus/hover reveal logic clear idle state.
- Mobile tap on a metric while playback controls are visible: ensure outside tap dismissal does not interfere with metric toggle button.

## Implementation Steps

1. Add a metadata registry module or local constant with `MetricMetadata`.
2. Add `data-metric-key` and keyboard focus attributes to metric cards.
3. Add `createDashboardMetricTooltip()` to create one tooltip node.
4. Add `initDashboardMetricTooltips()` with delegated event handling on `metricsGrid`.
5. Add `showMetricTooltip(card, key)` and `hideMetricTooltip()`.
6. Add viewport-aware card-anchored positioning.
7. Add CSS for `.metric-tooltip`.
8. Add tests for:
   - every visible metric card has `data-metric-key`
   - every key exists in the metadata registry
   - tooltip node is created once
   - `updateDashboard()` does not create tooltip DOM
   - keyboard/focus and Escape handlers exist
   - no new render-loop scheduling is introduced

## Non-Goals

- Do not compute tooltip content from live audio values.
- Do not add timeline redraws.
- Do not call worker or audio APIs.
- Do not show long documentation text in the tooltip.
- Do not add per-card tooltip nodes.
- Do not make dashboard cards behave like buttons unless they gain a real action.

## Final Recommendation

Implement a single shared dashboard metric tooltip managed by `DashboardUI` with event delegation on `#metrics-grid`, backed by a static `MetricMetadata` registry.

This is the best balance of accessibility, mobile support, maintainability, and performance. It keeps tooltip behavior entirely outside the audio thread and render loop, creates no per-frame DOM, and follows the existing one-tooltip precedent already used by the dramaturgy timeline.
