import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeDramaturgyPlan,
  parseDramaturgyPlan,
  DRAMATURGY_CLIPBOARD_KIND
} from '../src/automation/dramaturgyTransfer.ts';

function makePoint(overrides = {}) {
  return {
    id: 'pt-1',
    time: 12,
    sectionId: 'sec-1',
    preset: 'temporal1.json',
    confidence: 0.8,
    intensity: 1.2,
    reason: 'drop',
    morphDurationSec: 2,
    morphCurve: 'easeInOut',
    ...overrides
  };
}

function makePlan(points = [makePoint()]) {
  return { version: 1, source: 'edited', points };
}

test('serialize produces a tagged envelope that round-trips back to the plan', () => {
  const plan = makePlan([makePoint({ id: 'a', time: 30 }), makePoint({ id: 'b', time: 5 })]);
  const text = serializeDramaturgyPlan(plan, 180);
  const envelope = JSON.parse(text);
  assert.equal(envelope.kind, DRAMATURGY_CLIPBOARD_KIND);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.duration, 180);

  const result = parseDramaturgyPlan(text);
  assert.ok(result.ok);
  assert.equal(result.pointCount, 2);
  // Points come back sorted by time.
  assert.deepEqual(result.plan.points.map(p => p.id), ['b', 'a']);
  assert.equal(result.plan.source, 'edited');
});

test('parse accepts a bare plan (no envelope)', () => {
  const result = parseDramaturgyPlan(JSON.stringify(makePlan()));
  assert.ok(result.ok);
  assert.equal(result.pointCount, 1);
});

test('parse accepts a full visual-config payload that embeds performancePlan', () => {
  const payload = {
    version: 2,
    name: 'Current Performance',
    visualMode: 'cosmic-wormhole',
    performancePlan: makePlan()
  };
  const result = parseDramaturgyPlan(JSON.stringify(payload));
  assert.ok(result.ok);
  assert.equal(result.pointCount, 1);
});

test('parse accepts an empty plan (cleared dramaturgy)', () => {
  const result = parseDramaturgyPlan(serializeDramaturgyPlan(makePlan([])));
  assert.ok(result.ok);
  assert.equal(result.pointCount, 0);
});

test('parse rejects empty and whitespace-only clipboard', () => {
  for (const text of ['', '   ', '\n\t']) {
    const result = parseDramaturgyPlan(text);
    assert.equal(result.ok, false);
    assert.match(result.error, /empty/i);
  }
});

test('parse rejects non-string input', () => {
  for (const value of [null, undefined, 42, {}]) {
    const result = parseDramaturgyPlan(value);
    assert.equal(result.ok, false);
  }
});

test('parse rejects invalid JSON', () => {
  const result = parseDramaturgyPlan('{ not json ]');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid JSON/i);
});

test('parse rejects JSON that is not a dramaturgy object', () => {
  for (const text of ['123', '"hello"', 'true', '[1,2,3]', '{"foo":1}']) {
    const result = parseDramaturgyPlan(text);
    assert.equal(result.ok, false);
  }
});

test('parse rejects wrong plan version', () => {
  const result = parseDramaturgyPlan(JSON.stringify({ version: 2, source: 'edited', points: [] }));
  assert.equal(result.ok, false);
});

test('parse rejects a malformed point and reports it', () => {
  const cases = [
    makePoint({ preset: undefined }),
    makePoint({ preset: '' }),
    makePoint({ id: '' }),
    makePoint({ time: -1 }),
    makePoint({ time: 'soon' }),
    makePoint({ time: Number.POSITIVE_INFINITY }),
    makePoint({ reason: 'chorus' }),
    makePoint({ morphCurve: 'bounce' }),
    makePoint({ morphDurationSec: 0 }),
    makePoint({ timingMode: 'random' }),
    makePoint({ locked: 'yes' })
  ];
  for (const point of cases) {
    const result = parseDramaturgyPlan(JSON.stringify(makePlan([point])));
    assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(point)}`);
    assert.match(result.error, /malformed/i);
  }
});

test('parse strips unknown fields and keeps valid optional fields', () => {
  const point = makePoint({
    analysisConfidence: 0.5,
    timingMode: 'novelty',
    locked: true,
    bogus: 'remove-me',
    nested: { x: 1 }
  });
  const result = parseDramaturgyPlan(JSON.stringify(makePlan([point])));
  assert.ok(result.ok);
  const out = result.plan.points[0];
  assert.equal(out.analysisConfidence, 0.5);
  assert.equal(out.timingMode, 'novelty');
  assert.equal(out.locked, true);
  assert.equal('bogus' in out, false);
  assert.equal('nested' in out, false);
});

test('parse clamps confidence into the 0..1 range but leaves intensity free', () => {
  const point = makePoint({ confidence: 5, analysisConfidence: -3, intensity: 2.5 });
  const result = parseDramaturgyPlan(JSON.stringify(makePlan([point])));
  assert.ok(result.ok);
  assert.equal(result.plan.points[0].confidence, 1);
  assert.equal(result.plan.points[0].analysisConfidence, 0);
  assert.equal(result.plan.points[0].intensity, 2.5);
});

test('serialize/parse round-trips Visual OS meta and normalizes behaviour', () => {
  const meta = {
    motif: 'tunnel-drive', palette: 'neon', evolutionPhase: 'peak',
    sceneId: 'vos:cyberpunk:2', stylePack: 'cyberpunk', substyle: 'glitch',
    targetStateReference: 'cyberpunk#glitch:peak',
    behaviour: { energy: 1.4, density: 0.5, motion: 0.3, volatility: -0.2, cohesion: 0.6 }
  };
  const result = parseDramaturgyPlan(serializeDramaturgyPlan(makePlan([makePoint({ meta })])));
  assert.ok(result.ok);
  const out = result.plan.points[0].meta;
  assert.equal(out.motif, 'tunnel-drive');
  assert.equal(out.stylePack, 'cyberpunk');
  assert.equal(out.substyle, 'glitch');
  assert.equal(out.evolutionPhase, 'peak');
  assert.equal(out.targetStateReference, 'cyberpunk#glitch:peak');
  // Behaviour fields are clamped into 0..1.
  assert.equal(out.behaviour.energy, 1);
  assert.equal(out.behaviour.volatility, 0);
});

test('meta sub-fields are enum-validated: out-of-vocabulary motif/palette/phase are dropped', () => {
  const meta = {
    motif: 'not-a-motif', palette: 'ultraviolet', evolutionPhase: 'apocalypse',
    sceneId: 'vos:cyberpunk:1', stylePack: 'cyberpunk'
  };
  const result = parseDramaturgyPlan(JSON.stringify(makePlan([makePoint({ meta })])));
  assert.ok(result.ok);
  const out = result.plan.points[0].meta;
  assert.ok(out, 'valid free-string fields keep meta alive');
  assert.equal('motif' in out, false, 'invalid motif dropped');
  assert.equal('palette' in out, false, 'invalid palette dropped');
  assert.equal('evolutionPhase' in out, false, 'invalid phase dropped');
  assert.equal(out.sceneId, 'vos:cyberpunk:1');
  assert.equal(out.stylePack, 'cyberpunk');
});

test('malformed meta is dropped without rejecting the point; legacy points keep no meta', () => {
  const withBadMeta = parseDramaturgyPlan(JSON.stringify(makePlan([makePoint({ meta: 'nope' })])));
  assert.ok(withBadMeta.ok);
  assert.equal('meta' in withBadMeta.plan.points[0], false);
  const legacy = parseDramaturgyPlan(JSON.stringify(makePlan([makePoint()])));
  assert.ok(legacy.ok);
  assert.equal('meta' in legacy.plan.points[0], false);
});

test('serialize/parse round-trips choreography meta fields', () => {
  const meta = {
    automationSituation: 'drop-long',
    vocabularyId: 'drop-drive-counterpulse',
    variantRole: 'secondary',
    movementGesture: 'slice',
    longScenePhase: 'intensify',
    globalArcRole: 'climax',
    targetStateReference: 'cyberpunk:drop.counter',
    motif: 'tunnel-drive',
    evolutionPhase: 'peak'
  };
  const result = parseDramaturgyPlan(serializeDramaturgyPlan(makePlan([makePoint({ meta })])));
  assert.ok(result.ok);
  const out = result.plan.points[0].meta;
  assert.equal(out.automationSituation, 'drop-long');
  assert.equal(out.vocabularyId, 'drop-drive-counterpulse');
  assert.equal(out.variantRole, 'secondary');
  assert.equal(out.movementGesture, 'slice');
  assert.equal(out.longScenePhase, 'intensify');
  assert.equal(out.globalArcRole, 'climax');
  assert.equal(out.targetStateReference, 'cyberpunk:drop.counter');
});

test('new behaviour roles (sparse, focus) survive the round-trip', () => {
  for (const role of ['sparse', 'focus']) {
    const result = parseDramaturgyPlan(serializeDramaturgyPlan(makePlan([makePoint({ meta: { variantRole: role } })])));
    assert.ok(result.ok);
    assert.equal(result.plan.points[0].meta.variantRole, role, `role ${role} kept`);
  }
});

test('invalid choreography meta enums are dropped but free-string ids survive', () => {
  const meta = { automationSituation: 'not-a-situation', variantRole: 'lead', movementGesture: 'explode', longScenePhase: 'middle', globalArcRole: 'finale', vocabularyId: 'x' };
  const result = parseDramaturgyPlan(JSON.stringify(makePlan([makePoint({ meta })])));
  assert.ok(result.ok);
  const out = result.plan.points[0].meta;
  assert.equal('automationSituation' in out, false, 'invalid situation dropped');
  assert.equal('variantRole' in out, false, 'invalid role dropped');
  assert.equal('movementGesture' in out, false, 'invalid movement gesture dropped');
  assert.equal('longScenePhase' in out, false, 'invalid long scene phase dropped');
  assert.equal('globalArcRole' in out, false, 'invalid global arc role dropped');
  assert.equal(out.vocabularyId, 'x', 'free-string vocabulary id kept');
});

test('serialize coerces an invalid duration to null and tolerates a malformed plan', () => {
  const text = serializeDramaturgyPlan({ version: 1, source: 'edited', points: [] }, Number.NaN);
  const envelope = JSON.parse(text);
  assert.equal(envelope.duration, null);
});
