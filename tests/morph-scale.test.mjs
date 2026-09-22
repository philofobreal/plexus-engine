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

test('all current morph lengths grow proportionally until the first gap is exhausted, beyond 400 percent', () => {
  const current = { ...plan, points: [point('a', 0, 1), point('b', 20, 4), point('c', 100, 2)] };
  const options = { durationSec: 180 };
  const max = computeMaxMorphScale(current, options);
  assert.equal(max, 19.98);
  const scaled = applyMorphScale(current, max, options);
  for (let i = 0; i < current.points.length; i++) {
    assert.equal(scaled.points[i].morphDurationSec, current.points[i].morphDurationSec * max);
  }
  assert.ok(Math.abs(scaled.points[0].time + scaled.points[0].morphDurationSec + 0.02 - current.points[1].time) < 1e-9);
  assert.equal(computeMaxMorphScale(applyMorphScale(current, 2, options), options), max / 2,
    'remaining relative growth must agree with the currently displayed automation sizes');
  assert.equal(current.points[0].morphDurationSec, 1, 'base plan is not resized by projection');
});

test('longer morph can exhaust its gap before the pair with the smallest absolute empty gap', () => {
  const current = { ...plan, points: [point('a', 0, 1), point('b', 2, 10), point('c', 15, 1)] };
  // Gaps are 1s and 3s, but 10s * 1.3 exhausts 3s before 1s * 1.3 exhausts 1s.
  assert.equal(computeMaxMorphScale(current), 1.298);
});

test('track end constrains the common factor, including a single automation', () => {
  const current = { ...plan, points: [point('a', 0, 1), point('b', 20, 4)] };
  assert.equal(computeMaxMorphScale(current, { durationSec: 30 }), 2.495);
  assert.equal(clampMorphScale(current, 99, { durationSec: 30 }), 2.495);
  const single = { ...plan, points: [point('a', 10, 2)] };
  assert.equal(computeMaxMorphScale(single, { durationSec: 50 }), 19.99);
});

test('editing, adding, removing or reordering current points recomputes the limiting pair', () => {
  const current = { ...plan, points: [point('a', 0, 1), point('b', 20, 1), point('c', 50, 1)] };
  assert.equal(computeMaxMorphScale(current), 19.98);
  current.points[1].time = 10;
  assert.equal(computeMaxMorphScale(current), 9.98);
  current.points[0].morphDurationSec = 2;
  assert.equal(computeMaxMorphScale(current), 4.99);
  current.points.push(point('inserted', 5, 1));
  assert.equal(computeMaxMorphScale(current), 2.49);
  current.points = current.points.filter(p => p.id !== 'inserted');
  current.points.reverse();
  assert.equal(computeMaxMorphScale(current), 4.99);
});

test('scaled morphs cannot overlap the following point', () => {
  const scaled = applyMorphScale(plan, 4, { safetyMarginSec: 0.02 });
  assert.ok(scaled.points[0].morphDurationSec <= 4.98);
  assert.ok(scaled.points[1].morphDurationSec <= 6.98);
});

test('scaling short base morphs does not reapply the authoring minimum or exceed available room', () => {
  const current = { ...plan, points: [point('a', 0, .1), point('b', .12, .2)] };
  const scaled = applyMorphScale(current, .25, { durationSec: 1 });
  assert.equal(scaled.points[0].morphDurationSec, .025);
  assert.equal(scaled.points[1].morphDurationSec, .05);
  const legacy = { ...plan, points: [point('a', 0, .1), point('b', .064, .2)] };
  const bounded = applyMorphScale(legacy, 1, { durationSec: 1 });
  assert.ok(bounded.points[0].morphDurationSec <= .044 + 1e-9,
    'legacy dense geometry must still render inside its actual available window');
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
