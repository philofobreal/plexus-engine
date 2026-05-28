import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('single click unpinning schedules fast chrome hide feedback', () => {
  const ui = read('src/ui/DashboardUI.ts');

  assert.match(ui, /this\.scheduleChromeHide\(400\)/);
  assert.match(ui, /private scheduleChromeHide\(delay = 2600\)/);
  assert.match(ui, /this\.scheduleChromeHide\(2600\)/);
  assert.match(ui, /}, delay\)/);
});
