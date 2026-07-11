import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('single click unpinning schedules fast chrome hide feedback', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /private readonly autoHideTime = 400/);
  assert.match(ui, /this\.scheduleChromeHide\(this\.autoHideTime\)/);
  assert.match(ui, /private scheduleChromeHide\(delay = this\.autoHideTime\+1000\)/);
  assert.match(ui, /if \(this\.isChromeHovered\(\)\) \{ this\.scheduleChromeHide\(this\.autoHideTime\); return; \}/);
  assert.match(ui, /}, delay\)/);
});

test('analyzer confidence tooltip is gated behind debug overlay flag', () => {
  const ui = read('src/ui/DashboardUI.ts');
  const flags = read('src/config/featureFlags.ts');

  assert.match(flags, /analyzerDebugOverlay: false/);
  assert.match(ui, /featureFlags\.analyzerDebugOverlay && \(analysis\.bpmConfidence > 0/);
  assert.match(ui, /BPM conf:/);
});
