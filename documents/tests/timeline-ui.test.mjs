import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('dramaturgy timeline is mounted above the seek controls', () => {
  const main = read('src/main.ts');
  const css = read('src/style.css');

  assert.match(main, /id="dramaturgy-timeline"/);
  assert.match(main, /id="toggle-timeline-zoom"/);
  assert.match(main, /Track Dramaturgy/);
  assert.match(main, /class="timeline-wrapper"[\s\S]*class="seek-row"/);
  assert.match(css, /\.timeline-header-row/);
  assert.match(css, /\.timeline-wrapper/);
  assert.match(css, /\.timeline-wrapper\.is-expanded/);
  assert.match(css, /\.timeline-wrapper\.is-expanded[\s\S]*height:\s*220px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.timeline-wrapper\.is-expanded \{ height:\s*172px; \}/);
  assert.match(css, /\.dramaturgy-timeline/);
  assert.match(css, /\.seek-row/);
  assert.match(css, /flex-direction: column/);
});

test('automation size is a timeline-level non-destructive dynamic control', () => {
  const main = read('src/main.ts');
  const ui = read('src/ui/DashboardUI.ts');
  const state = read('src/state/store.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');
  assert.match(main, /id="automation-size-control"[\s\S]*Morph Scale[\s\S]*id="automation-morph-scale"/);
  assert.match(main, /id="automation-morph-scale"[^>]*min="0\.25"/);
  assert.match(state, /automationMorphScale: 1/);
  assert.match(ui, /computeMaxMorphScale\(plan\)/);
  assert.match(ui, /State\.automationMorphScale = clampMorphScale\(plan, State\.automationMorphScale\)/);
  assert.match(ui, /performancePlan: this\.getAutomationPlanView\(\)/);
  assert.match(ui, /private triggerPerformanceAutomation\(\)[\s\S]*const plan = this\.getAutomationPlanView\(\)/);
  assert.match(timeline, /state\.automationMorphScale/);
});

test('dashboard delegates timeline rendering to TimelineCanvas with declarative state', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');
  const types = read('src/types/index.ts');

  assert.match(ui, /import \{ TimelineCanvas \} from '\.\/TimelineCanvas'/);
  assert.match(ui, /this\.timelineCanvas = new TimelineCanvas\(canvas\)/);
  assert.match(ui, /this\.timelineCanvas\.render\(this\.getRenderState\(\)\)/);
  assert.match(ui, /private getRenderState\(\): RenderState/);
  assert.match(ui, /sections: State\.trackAnalysis\.sections/);
  assert.match(ui, /bars: State\.trackAnalysis\.bars/);
  assert.match(ui, /buildupConfidence: State\.trackAnalysis\.buildupConfidence/);
  assert.match(ui, /tensionTrends: State\.trackAnalysis\.tensionTrends/);
  assert.match(ui, /cues: State\.trackAnalysis\.cues/);
  assert.match(ui, /currentTime: State\.currentTime/);
  assert.match(types, /export interface RenderState/);
  assert.match(timeline, /private drawGridlines/);
  assert.match(timeline, /private drawWaveform/);
  assert.match(timeline, /private drawRms/);
  assert.match(timeline, /private drawBuildup/);
  assert.match(timeline, /private drawTrends/);
  assert.match(timeline, /private drawCueMarkers/);
  assert.match(timeline, /private drawPlayhead/);
  assert.doesNotMatch(ui, /private drawTimeline/);
});

test('dashboard wires GestureEngine and ResizeObserver around the timeline', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const gestures = read('src/ui/GestureEngine.ts');
  const main = read('src/main.ts');
  const css = read('src/style.css');

  assert.match(main, /id="timeline-resize-handle"/);
  assert.match(ui, /import \{ GestureEngine \} from '\.\/GestureEngine'/);
  assert.match(ui, /this\.gestureEngine = new GestureEngine\(canvas/);
  assert.match(ui, /onStart: \(focusX, focusY, button, shiftKey\) => this\.startTimelineInteraction\(focusX, focusY, button, shiftKey\)/);
  assert.match(ui, /onMove: \(focusX, focusY, deltaX\) => this\.moveTimelineInteraction\(focusX, focusY, deltaX\)/);
  assert.match(ui, /onEnd: \(\) => this\.endTimelineInteraction\(\)/);
  assert.match(ui, /onZoom: \(delta, focusX\) => this\.zoomTimeline\(delta, focusX\)/);
  assert.match(ui, /onHover: \(focusX, focusY\) => this\.hoverTimeline\(focusX, focusY\)/);
  assert.match(ui, /new ResizeObserver\(\(\) =>/);
  assert.match(ui, /this\.timelineCanvas\.resize\(\)/);
  assert.match(gestures, /this\.on\('wheel', this\.handleWheel, \{ passive: false \}\)/);
  assert.match(gestures, /this\.on\('touchmove', this\.handleTouchMove, \{ passive: false \}\)/);
  assert.match(gestures, /callbacks\.onStart/);
  assert.match(gestures, /callbacks\.onMove/);
  assert.match(gestures, /callbacks\.onHover/);
  assert.match(gestures, /callbacks\.onZoom/);
  assert.match(css, /\.timeline-resize-handle/);
  assert.match(css, /cursor: ns-resize/);
});

test('timeline supports fullscreen overlay, zoom viewport, and pan tracking through state', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');
  const state = read('src/state/store.ts');
  const css = read('src/style.css');

  assert.match(state, /zoom: 1/);
  assert.match(state, /pan: 0/);
  assert.match(ui, /toggleTimelineOverlay/);
  assert.match(ui, /is-fullscreen-overlay/);
  assert.match(ui, /private zoomTimeline\(delta: number, focusX: number\)/);
  assert.match(ui, /const maxZoom = Math\.max\(16, State\.duration \/ 5\.0\)/);
  assert.match(ui, /State\.zoom = this\.clamp\(State\.zoom \* zoomFactor, 1, maxZoom\)/);
  assert.match(timeline, /const maxZoom = Math\.max\(16, state\.duration \/ 5\.0\)/);
  assert.match(timeline, /const zoom = this\.clamp\(state\.zoom, 1, maxZoom\)/);
  assert.match(ui, /private panTimeline\(deltaX: number\)/);
  assert.match(ui, /State\.pan = this\.clampTimelinePan\(State\.pan - deltaSeconds\)/);
  assert.match(ui, /followTimelinePlayhead/);
  assert.match(ui, /relativePosition > 0\.75 \|\| relativePosition < 0\.15/);
  assert.doesNotMatch(ui, /canvas\.addEventListener\('wheel'/);
  assert.match(css, /\.seek-container\.timeline-overlay-active/);
  assert.match(css, /\.timeline-wrapper\.is-fullscreen-overlay/);
  assert.match(css, /body\.timeline-overlay-open/);
});

test('timeline and seekbar scrub through semantic callbacks and one audio seek path', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const playbackCtrl = read('src/ui/controllers/PlaybackController.ts');
  const gestures = read('src/ui/GestureEngine.ts');
  const timeline = read('src/ui/TimelineCanvas.ts');

  // DashboardUI owns the scrub state and the single engine.seek call
  assert.match(ui, /private scrubTime: number \| null = null/);
  assert.match(ui, /private setScrubTime\(time: number\)/);
  assert.match(ui, /this\.scrubTime = this\.clamp\(time, 0, State\.duration\)/);
  assert.match(ui, /private commitScrubTime\(\)/);
  assert.match(ui, /const targetTime = this\.scrubTime/);
  assert.match(ui, /this\.engine\.seek\(targetTime\)/);

  // PlaybackController owns the DOM binding and delegates scrub via callbacks
  assert.match(playbackCtrl, /seek\.addEventListener\('input'[\s\S]*this\.callbacks\.onSeekScrub\(seekTime\)[\s\S]*\}\);/);
  assert.doesNotMatch(playbackCtrl, /seek\.addEventListener\('input'[\s\S]{0,320}this\.engine\.seek/);
  assert.match(playbackCtrl, /seek\.addEventListener\('change'[\s\S]*this\.callbacks\.onSeekCommit\(\)/);

  assert.match(gestures, /this\.callbacks\.onStart\?\./);
  assert.match(gestures, /this\.callbacks\.onMove\?\./);
  assert.match(timeline, /const currentTimeToDraw = state\.scrubTime \?\? state\.currentTime/);

  // DashboardUI uses playbackCtrl.isDraggingSlider to guard the update
  assert.match(ui, /if \(!this\.playbackCtrl\.isDraggingSlider && this\.scrubTime === null\)/);
});

test('dashboard timeline redraw is throttled by visible playhead and layout changes', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /private requestDashboardTimelineDraw\(\)/);
  assert.match(ui, /private shouldDrawTimelineForDashboard\(rect: DOMRect\)/);
  assert.match(ui, /this\.lastTimelineAnalysisRef !== State\.trackAnalysis/);
  assert.match(ui, /this\.lastTimelineDrawWidth !== rect\.width/);
  assert.match(ui, /this\.lastTimelineDrawHeight !== rect\.height/);
  assert.match(ui, /this\.lastTimelineDrawZoom !== State\.zoom/);
  assert.match(ui, /this\.lastTimelineDrawScroll !== State\.pan/);
  assert.match(ui, /this\.lastTimelineDrawScrubTime !== this\.scrubTime/);
  assert.match(ui, /visibleSecondsPerPixel = this\.getTimelineVisibleDuration\(\) \/ Math\.max\(1, rect\.width\)/);
  assert.match(ui, /Math\.abs\(State\.currentTime - this\.lastTimelineDrawTime\) >= visibleSecondsPerPixel/);
  assert.match(ui, /this\.requestDashboardTimelineDraw\(\)/);
  const updateDashboardBody = ui.slice(ui.indexOf('    updateDashboard() {'));
  const updateDashboardEnd = updateDashboardBody.match(/\r?\n    \}\r?\n\}/);
  assert.doesNotMatch(updateDashboardBody.slice(0, updateDashboardEnd ? updateDashboardEnd.index : updateDashboardBody.length), /this\.drawDramaturgyTimeline\(\)/);
});
