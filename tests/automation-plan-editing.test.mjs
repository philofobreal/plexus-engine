import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMorphScale } from '../src/automation/morphScale.ts';
import {
  baseMorphDurationFromScaled,
  constrainAutomationPointTime,
  constrainMorphDuration,
  createAutomationPointAtTime,
  findAutomationPointById,
  nudgeAutomationPointTime,
  removeAutomationPointById,
  snapTimeToNearestGrid,
  updateAutomationPointById
} from '../src/automation/automationPlanEditing.ts';

const point = (id, time, morphDurationSec) => ({
  id, time, morphDurationSec, sectionId: id, preset: 'default.json', confidence: 1,
  intensity: 1, reason: 'manual', morphCurve: 'easeInOut'
});

const createPlan = () => ({
  version: 1,
  source: 'edited',
  points: [point('a', 0, 2), point('b', 8, 2)]
});

test('selecting a scaled point and changing preset mutates the base edited plan', () => {
  const editedPlan = createPlan();
  const scaledPoint = applyMorphScale(editedPlan, 2).points[0];
  const basePoint = findAutomationPointById(editedPlan, scaledPoint.id);

  updateAutomationPointById(editedPlan, scaledPoint.id, { preset: 'changed.json' });

  assert.equal(editedPlan.points[0].preset, 'changed.json');
  assert.notStrictEqual(basePoint, scaledPoint);
});

test('deleting a selected scaled point removes the base point by id', () => {
  const editedPlan = createPlan();
  const scaledPoint = applyMorphScale(editedPlan, 2).points[0];

  assert.equal(removeAutomationPointById(editedPlan, scaledPoint.id), true);
  assert.deepEqual(editedPlan.points.map((candidate) => candidate.id), ['b']);
});

test('dragging a scaled point persists after rebuilding the plan view', () => {
  const editedPlan = createPlan();
  const scaledPoint = applyMorphScale(editedPlan, 2).points[0];
  updateAutomationPointById(editedPlan, scaledPoint.id, { time: 3 });

  const rebuiltView = applyMorphScale(editedPlan, 2);

  assert.equal(editedPlan.points[0].time, 3);
  assert.equal(findAutomationPointById(rebuiltView, scaledPoint.id).time, 3);
});

test('resizing a scaled morph writes the corresponding base duration', () => {
  const editedPlan = createPlan();
  const scaledPoint = applyMorphScale(editedPlan, 2).points[0];
  const basePoint = findAutomationPointById(editedPlan, scaledPoint.id);

  updateAutomationPointById(editedPlan, scaledPoint.id, {
    morphDurationSec: baseMorphDurationFromScaled(6, 2)
  });

  assert.equal(basePoint.morphDurationSec, 3);
  assert.equal(findAutomationPointById(applyMorphScale(editedPlan, 2), basePoint.id).morphDurationSec, 6);
});

test('complete scaled editor workflow persists in the base plan after projection reload', () => {
  const editedPlan = createPlan();
  let projection = applyMorphScale(editedPlan, 2);
  const selectedScaledPoint = findAutomationPointById(projection, 'a');

  updateAutomationPointById(editedPlan, selectedScaledPoint.id, { preset: 'edited.json' });
  updateAutomationPointById(editedPlan, selectedScaledPoint.id, {
    morphDurationSec: baseMorphDurationFromScaled(6, 2)
  });
  updateAutomationPointById(editedPlan, selectedScaledPoint.id, { time: 1 });
  removeAutomationPointById(editedPlan, 'b');

  projection = null; // Mirrors invalidateAutomationPlanView().
  projection = applyMorphScale(editedPlan, 2);
  const reloadedPoint = findAutomationPointById(projection, selectedScaledPoint.id);

  assert.deepEqual(editedPlan.points.map((candidate) => candidate.id), ['a']);
  assert.equal(editedPlan.points[0].preset, 'edited.json');
  assert.equal(editedPlan.points[0].morphDurationSec, 3);
  assert.equal(editedPlan.points[0].time, 1);
  assert.equal(reloadedPoint.preset, 'edited.json');
  assert.equal(reloadedPoint.morphDurationSec, 6);
  assert.equal(reloadedPoint.time, 1);
});

// ─── constrainAutomationPointTime / constrainMorphDuration / snapTimeToNearestGrid /
// nudgeAutomationPointTime / createAutomationPointAtTime: shared helpers extracted for reuse by
// both the advanced dashboard's timeline drag handler and the MVP surface's simplified editor. ─

test('constrainAutomationPointTime keeps a moved point out of a neighbour morph span', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0, 2), point('b', 10, 2)] };
  const result = constrainAutomationPointTime(plan, 'a', 2, 10.5, 20);

  assert.ok(result < 10 || result >= 12, `expected ${result} to land outside [10, 12)`);
  assert.ok(result >= 0 && result <= 20);
});

test('constrainAutomationPointTime clamps to [0, total - duration] with no other points', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 5, 2)] };
  assert.equal(constrainAutomationPointTime(plan, 'a', 2, -5, 20), 0);
  assert.equal(constrainAutomationPointTime(plan, 'a', 2, 100, 20), 18);
});

test('constrainAutomationPointTime falls back to a plain clamp for a null/empty plan', () => {
  assert.equal(constrainAutomationPointTime(null, 'a', 2, 100, 20), 18);
  assert.equal(constrainAutomationPointTime({ version: 1, source: 'edited', points: [] }, 'a', 2, -5, 20), 0);
});

test('constrainMorphDuration caps a proposed duration at the next point start and floors at 0.1', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0, 2), point('b', 8, 2)] };

  assert.equal(constrainMorphDuration(plan, 'a', 0, 20, 40), 8);
  assert.equal(constrainMorphDuration(plan, 'a', 0, -5, 40), 0.1);
});

test('constrainMorphDuration ignores a point that starts before the one being resized', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0, 2), point('b', 12, 2)] };
  assert.equal(constrainMorphDuration(plan, 'b', 12, 20, 40), 20);
});

test('snapTimeToNearestGrid rounds to the nearest beat on the bar grid', () => {
  const bars = [{ start: 0 }, { start: 2 }];
  assert.equal(snapTimeToNearestGrid(1.3, bars, 100), 1.5);
  assert.equal(snapTimeToNearestGrid(1.7, bars, 100), 1.5);
  assert.equal(snapTimeToNearestGrid(1.8, bars, 100), 2);
});

test('snapTimeToNearestGrid is a no-op with fewer than two bars', () => {
  assert.equal(snapTimeToNearestGrid(1.3, [{ start: 0 }], 100), 1.3);
  assert.equal(snapTimeToNearestGrid(1.3, [], 100), 1.3);
});

test('nudgeAutomationPointTime moves a point by whole beats derived from the bar grid', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 4, 1)] };
  const bars = [{ start: 0 }, { start: 2 }]; // secondsPerBeat = 0.5
  const moved = nudgeAutomationPointTime(plan, 'a', 4, bars, 100); // +1 bar (4 beats)
  assert.equal(moved.time, 6);
});

test('nudgeAutomationPointTime clamps at the timeline start and returns null for an unknown id', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0.2, 1)] };
  const bars = [{ start: 0 }, { start: 2 }];
  const moved = nudgeAutomationPointTime(plan, 'a', -100, bars, 100);
  assert.equal(moved.time, 0);
  assert.equal(nudgeAutomationPointTime(plan, 'missing', 1, bars, 100), null);
});

test('createAutomationPointAtTime refuses a time inside an existing point morph span', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0, 4)] };
  const created = createAutomationPointAtTime(plan, 2, 100, [], {
    preset: 'default.json', intensity: 1, morphCurve: 'easeInOut', defaultMorphDurationSec: 2
  });
  assert.equal(created, null);
  assert.equal(plan.points.length, 1);
});

test('createAutomationPointAtTime refuses when the track has no duration', () => {
  const plan = { version: 1, source: 'edited', points: [] };
  assert.equal(createAutomationPointAtTime(plan, 2, 0, [], {
    preset: 'default.json', intensity: 1, morphCurve: 'easeInOut', defaultMorphDurationSec: 2
  }), null);
});

test('createAutomationPointAtTime inserts a sorted point, capped by the next point start', () => {
  const plan = { version: 1, source: 'edited', points: [point('a', 0, 2), point('b', 20, 2)] };
  const created = createAutomationPointAtTime(plan, 10, 100, [], {
    preset: 'new.json', intensity: 0.5, morphCurve: 'linear', defaultMorphDurationSec: 15
  });

  assert.ok(created);
  assert.equal(created.time, 10);
  assert.equal(created.preset, 'new.json');
  assert.equal(created.reason, 'manual');
  assert.equal(created.morphDurationSec, 10); // capped by b.time(20) - time(10)
  assert.deepEqual(plan.points.map((p) => p.id), ['a', created.id, 'b']);
});

test('createAutomationPointAtTime tags the inserted point with its containing section', () => {
  const plan = { version: 1, source: 'edited', points: [] };
  const sections = [{ start: 0, end: 5, label: 'intro' }, { start: 5, end: 20, label: 'build' }];
  const created = createAutomationPointAtTime(plan, 8, 100, sections, {
    preset: 'default.json', intensity: 1, morphCurve: 'easeInOut', defaultMorphDurationSec: 2
  });

  assert.ok(created.sectionId.startsWith('1:build:'));
});
