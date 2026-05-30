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

test('dashboard draws precomputed sections, bars, RMS, buildup, trends, cues, and playhead', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /dramaturgyTimeline: document\.getElementById\('dramaturgy-timeline'\)!/);
  assert.match(ui, /drawDramaturgyTimeline\(\)/);
  assert.match(ui, /State\.trackAnalysis\.sections/);
  assert.match(ui, /drawTimelineGridlines/);
  assert.match(ui, /drawTimelineRms/);
  assert.match(ui, /State\.trackAnalysis\.bars/);
  assert.match(ui, /State\.trackAnalysis\.buildupConfidence/);
  assert.match(ui, /State\.trackAnalysis\.tensionTrends\.segments/);
  assert.match(ui, /State\.trackAnalysis\.cues/);
  assert.match(ui, /State\.currentTime \/ State\.duration/);
  assert.match(ui, /seekTimelineFromPointer/);
  assert.match(ui, /commitScrubTime/);
  assert.doesNotMatch(ui, /seekTimelineFromPointer[\s\S]{0,420}this\.engine\.seek/);
  assert.match(ui, /window\.addEventListener\('resize'/);
  assert.match(ui, /this\.timelineScrollOffsetTime = this\.clampTimelineScroll/);
});

test('dramaturgy timeline resize handle and overlay control redraw during transitions', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const main = read('src/main.ts');
  const css = read('src/style.css');

  assert.match(main, /id="timeline-resize-handle"/);
  assert.match(ui, /toggleTimelineZoom: document\.getElementById\('toggle-timeline-zoom'\)!/);
  assert.match(ui, /timelineResizeHandle: document\.getElementById\('timeline-resize-handle'\)!/);
  assert.match(ui, /toggleTimelineOverlay/);
  assert.match(ui, /setTimelineHeight\(wrapper, this\.lastExpandedTimelineHeight, true\)/);
  assert.match(ui, /resizeHandle\.addEventListener\('pointerdown'/);
  assert.match(ui, /resizeHandle\.addEventListener\('pointermove'/);
  assert.match(ui, /requestTimelineDraw\(\)/);
  assert.match(ui, /zoomButton\.setAttribute\('aria-pressed'/);
  assert.match(ui, /animateTimelineResize\(\)/);
  assert.match(ui, /frames < 20/);
  assert.match(css, /\.timeline-resize-handle/);
  assert.match(css, /cursor: ns-resize/);
});

test('timeline supports fullscreen overlay, tooltip, zoom viewport, and pan tracking', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const css = read('src/style.css');

  assert.match(ui, /timelineZoomLevel = 1/);
  assert.match(ui, /timelineScrollOffsetTime = 0/);
  assert.match(ui, /createTimelineTooltip/);
  assert.match(ui, /timeline-tooltip/);
  assert.match(ui, /toggleTimelineOverlay/);
  assert.match(ui, /is-fullscreen-overlay/);
  assert.match(ui, /canvas\.addEventListener\('wheel'/);
  assert.match(ui, /zoomTimelineFromWheel/);
  assert.match(ui, /getTimelineXAtTime/);
  assert.match(ui, /followTimelinePlayhead/);
  assert.match(ui, /relativePosition > 0\.75 \|\| relativePosition < 0\.15/);
  assert.match(ui, /isPanningTimeline/);
  assert.match(ui, /const isPanAction = event\.button === 1 \|\| event\.shiftKey/);
  assert.match(ui, /if \(isPanAction\)[\s\S]*this\.isPanningTimeline = true/);
  assert.match(ui, /else if \(event\.button === 0\)[\s\S]*this\.isSeekingTimeline = true/);
  assert.doesNotMatch(ui, /if \(this\.timelineZoomLevel > 1\.05\)[\s\S]*this\.isPanningTimeline = true/);
  assert.match(css, /\.seek-container\.timeline-overlay-active/);
  assert.match(css, /\.timeline-wrapper\.is-fullscreen-overlay/);
  assert.match(css, /\.timeline-tooltip/);
  assert.match(css, /body\.timeline-overlay-open/);
});

test('timeline and seekbar scrub visually before committing a single audio seek', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /private scrubTime: number \| null = null/);
  assert.match(ui, /private setScrubTime\(time: number\)/);
  assert.match(ui, /this\.scrubTime = this\.clamp\(time, 0, State\.duration\)/);
  assert.match(ui, /this\.requestTimelineDraw\(\)/);
  assert.match(ui, /private commitScrubTime\(\)/);
  assert.match(ui, /const targetTime = this\.scrubTime/);
  assert.match(ui, /this\.engine\.seek\(targetTime\)/);
  assert.match(ui, /seek\.addEventListener\('input'[\s\S]*this\.setScrubTime\(seekTime\)[\s\S]*\}\);/);
  assert.doesNotMatch(ui, /seek\.addEventListener\('input'[\s\S]{0,320}this\.engine\.seek/);
  assert.match(ui, /seek\.addEventListener\('change'[\s\S]*this\.commitScrubTime\(\)/);
  assert.match(ui, /canvas\.addEventListener\('pointerup', endTimelinePointer\)/);
  assert.match(ui, /canvas\.addEventListener\('pointercancel', endTimelinePointer\)/);
  assert.match(ui, /const currentTimeToDraw = this\.scrubTime !== null \? this\.scrubTime : State\.currentTime/);
  assert.match(ui, /if \(!this\.isDraggingSlider && this\.scrubTime === null\)/);
});

test('dashboard timeline redraw is throttled by visible playhead and layout changes', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /private requestDashboardTimelineDraw\(\)/);
  assert.match(ui, /private shouldDrawTimelineForDashboard\(rect: DOMRect\)/);
  assert.match(ui, /this\.lastTimelineAnalysisRef !== State\.trackAnalysis/);
  assert.match(ui, /this\.lastTimelineDrawWidth !== rect\.width/);
  assert.match(ui, /this\.lastTimelineDrawHeight !== rect\.height/);
  assert.match(ui, /this\.lastTimelineDrawZoom !== this\.timelineZoomLevel/);
  assert.match(ui, /this\.lastTimelineDrawScroll !== this\.timelineScrollOffsetTime/);
  assert.match(ui, /this\.lastTimelineDrawScrubTime !== this\.scrubTime/);
  assert.match(ui, /visibleSecondsPerPixel = viewport\.duration \/ Math\.max\(1, rect\.width\)/);
  assert.match(ui, /Math\.abs\(State\.currentTime - this\.lastTimelineDrawTime\) >= visibleSecondsPerPixel/);
  assert.match(ui, /this\.requestDashboardTimelineDraw\(\)/);
  const updateDashboardBody = ui.slice(ui.indexOf('    updateDashboard() {'));
  assert.doesNotMatch(updateDashboardBody.slice(0, updateDashboardBody.indexOf('\n    }\n}')), /this\.drawDramaturgyTimeline\(\)/);
});
