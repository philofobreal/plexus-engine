import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMorphScale, clampMorphScale, computeMaxMorphScale, getAutomationPlanViewSignature } from '../src/automation/morphScale.ts';

const point = (id, time, morphDurationSec) => ({ id, time, morphDurationSec, sectionId: id, preset: 'default.json', confidence: 1, intensity: 1, reason: 'manual', morphCurve: 'easeInOut' });
const plan = { version: 1, source: 'edited', points: [point('a', 0, 2), point('b', 5, 4), point('c', 12, 1)] };

test('max morph scale is governed by the narrowest safe point gap', () => {
  const max = (7 - 0.02) / 4;
  assert.equal(computeMaxMorphScale(plan, { safetyMarginSec: 0.02 }), max);
  assert.equal(clampMorphScale(plan, 4, { safetyMarginSec: 0.02 }), max, 'plan change clamps an excessive current scale');
});

test('scaled morphs cannot overlap the following point', () => {
  const scaled = applyMorphScale(plan, 4, { safetyMarginSec: 0.02 });
  assert.ok(scaled.points[0].morphDurationSec <= 4.98);
  assert.ok(scaled.points[1].morphDurationSec <= 6.98);
});

test('100 percent preserves values and output is deterministic', () => {
  assert.deepEqual(applyMorphScale(plan, 1), plan);
  assert.deepEqual(applyMorphScale(plan, 1.5), applyMorphScale(plan, 1.5));
});

test('empty and single-point plans are safe', () => {
  assert.equal(computeMaxMorphScale({ ...plan, points: [] }), 4);
  assert.equal(computeMaxMorphScale({ ...plan, points: [point('a', 0, 2)] }), 4);
  assert.equal(clampMorphScale({ ...plan, points: [] }, 9), 4);
  assert.equal(applyMorphScale(null, 2), null);
});

test('plan view signature tracks every point field used by the cached projection', () => {
  const fields = {
    id: 'changed-id',
    time: 0.5,
    preset: 'changed.json',
    intensity: 1.5,
    morphDurationSec: 2.5,
    morphCurve: 'linear',
    locked: true
  };
  const baseline = getAutomationPlanViewSignature(plan);

  for (const [field, value] of Object.entries(fields)) {
    const changed = structuredClone(plan);
    changed.points[0][field] = value;
    assert.notEqual(getAutomationPlanViewSignature(changed), baseline, `${field} must invalidate the plan view`);
  }
});

test('plan view signature tracks point order, insertion, and deletion', () => {
  const baseline = getAutomationPlanViewSignature(plan);
  const reordered = { ...plan, points: [plan.points[1], plan.points[0], plan.points[2]] };
  const inserted = { ...plan, points: [...plan.points, point('d', 16, 1)] };
  const deleted = { ...plan, points: plan.points.slice(0, -1) };

  assert.notEqual(getAutomationPlanViewSignature(reordered), baseline, 'point order must invalidate the plan view');
  assert.notEqual(getAutomationPlanViewSignature(inserted), baseline, 'point insertion must invalidate the plan view');
  assert.notEqual(getAutomationPlanViewSignature(deleted), baseline, 'point deletion must invalidate the plan view');
});
