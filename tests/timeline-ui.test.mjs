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

test('dashboard draws precomputed sections, buildup, trends, cues, and playhead', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /dramaturgyTimeline: document\.getElementById\('dramaturgy-timeline'\)!/);
  assert.match(ui, /drawDramaturgyTimeline\(\)/);
  assert.match(ui, /State\.trackAnalysis\.sections/);
  assert.match(ui, /State\.trackAnalysis\.buildupConfidence/);
  assert.match(ui, /State\.trackAnalysis\.tensionTrends\.segments/);
  assert.match(ui, /State\.trackAnalysis\.cues/);
  assert.match(ui, /State\.currentTime \/ State\.duration/);
  assert.match(ui, /this\.engine\.seek\(ratio \* State\.duration\)/);
  assert.match(ui, /window\.addEventListener\('resize', \(\) => this\.drawDramaturgyTimeline\(\)\)/);
});

test('dramaturgy timeline zoom button toggles expanded state and redraws during transition', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /toggleTimelineZoom: document\.getElementById\('toggle-timeline-zoom'\)!/);
  assert.match(ui, /wrapper\?\.classList\.toggle\('is-expanded'\)/);
  assert.match(ui, /zoomButton\.setAttribute\('aria-pressed'/);
  assert.match(ui, /animateTimelineResize\(\)/);
  assert.match(ui, /frames < 20/);
});
