import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMorphScale } from '../src/automation/morphScale.ts';
import {
  baseMorphDurationFromScaled,
  findAutomationPointById,
  removeAutomationPointById,
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
