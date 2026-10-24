import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';

const load = createLoader();
const { cloneDefaultVisualTuning, normalizeVisualTuningConfig, normalizeSpiralDirection,
    effectiveWormholeSpiral, morphWormholeSpiral, applyTuningMorph } = load('config/visualTuning.ts');
const { applyMvpWormholePreset } = load('automation/applyMvpWormholePreset.ts');
const { wormholeGrainFlowAngle } = load('visuals/WormholeGrainField.ts');
const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
const { defaultAdvancedBoosts } = load('config/metaTuningBoost.ts');
const { parseDramaturgyPlan, serializeDramaturgyPlan } = load('automation/dramaturgyTransfer.ts');
const tuning = (magnitude, direction) => ({ ...cloneDefaultVisualTuning(), wormholeSpiral: magnitude, wormholeSpiralDirection: direction });
const point = (direction) => ({ id: 'p', time: 0, sectionId: 's', preset: 'p', confidence: 1, intensity: 1,
    reason: 'build', morphDurationSec: 2, morphCurve: 'linear', ...(direction === undefined ? {} : { spiralDirection: direction }) });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('coherent spiral keeps legacy magnitude/default and normalizes a separate bounded direction', () => {
    assert.equal(cloneDefaultVisualTuning().wormholeSpiralDirection, 1);
    assert.equal(effectiveWormholeSpiral({ wormholeSpiral: 2 }), 2);
    for (const value of [undefined, NaN, Infinity, 'left', null]) assert.equal(normalizeSpiralDirection(value), 1);
    assert.equal(normalizeSpiralDirection(-8), -1); assert.equal(normalizeSpiralDirection(8), 1);
    assert.equal(normalizeVisualTuningConfig({ wormholeSpiralDirection: -.4 }).wormholeSpiralDirection, -.4);
    assert.equal(normalizeVisualTuningConfig({ wormholeSpiralDirection: NaN }, tuning(2, -1)).wormholeSpiralDirection, 1);
});

test('signed morph interpolates the twist once with unequal magnitudes and passes continuously through zero', () => {
    const a = tuning(2, 1), b = tuning(4, -1);
    morphWormholeSpiral(a, b, .5); near(a.wormholeSpiral, 3); near(effectiveWormholeSpiral(a), -1);
    near(a.wormholeSpiralDirection, -1 / 3);
    for (const t of [0, .1, 1 / 3, .5, .9, 1]) {
        const current = tuning(2, 1); morphWormholeSpiral(current, b, t);
        near(effectiveWormholeSpiral(current), 2 - 6 * t);
        assert.ok(current.wormholeSpiral >= 0 && Math.abs(current.wormholeSpiralDirection) <= 1);
    }
    const zero = tuning(0, 1); morphWormholeSpiral(zero, tuning(0, -1), 1); assert.equal(effectiveWormholeSpiral(zero), 0);
});

test('shared live tuning morph has equal signed results at 30, 60 and 120 Hz; pause holds', () => {
    const target = tuning(3.5, -1), results = [];
    for (const hz of [30, 60, 120]) {
        const current = tuning(1.2, 1);
        for (let i = 0; i < hz * 2; i++) applyTuningMorph(current, target, .15, 1 / hz);
        results.push(effectiveWormholeSpiral(current));
        const before = effectiveWormholeSpiral(current); applyTuningMorph(current, target, .15, 0); near(effectiveWormholeSpiral(current), before);
    }
    near(results[0], results[1]); near(results[1], results[2]);
    const legacy = tuning(1, 1); morphWormholeSpiral(legacy, tuning(3, 1), .25);
    near(legacy.wormholeSpiral, 1.5); near(legacy.wormholeSpiralDirection, 1);
});

test('grain-flow handedness reverses coherent twist while retaining local current and phase', () => {
    const grain = { flowRate: .02, flowPhase: .8, flowDirection: -1 };
    for (const depth of [0, .15, .5, .9, 1]) {
        const at = turns => wormholeGrainFlowAngle(grain, depth, 1.2, .7, .2, turns);
        near(at(1.4) - at(0), (1 - depth) * 1.4 * Math.PI * 2);
        near(at(-1.4) - at(0), -(at(1.4) - at(0)));
        near(at(1.4) + at(-1.4), 2 * at(0));
        assert.equal(at(-1.4), at(-1.4), 'same explicit phase is history independent');
    }
});

test('absolute point direction is idempotent, independent of bendMirror, and a legacy preset returns to right', () => {
    const target = tuning(2, 1), payload = { visualTuning: { wormholeSpiral: 2, wormholePathBend: .7 } };
    const p = { ...point(-1), bendMirror: true };
    applyMvpWormholePreset(target, payload, p); assert.equal(target.wormholeSpiralDirection, -1); near(target.wormholePathBend, -.7);
    applyMvpWormholePreset(target, payload, p); assert.equal(target.wormholeSpiralDirection, -1); near(target.wormholePathBend, -.7);
    applyMvpWormholePreset(target, payload, point()); assert.equal(target.wormholeSpiralDirection, 1);
    applyMvpWormholePreset(target, { visualTuning: { wormholeSpiralDirection: -1 } }, point()); assert.equal(target.wormholeSpiralDirection, -1);
    applyMvpWormholePreset(target, { visualMode: 'temporal', visualTuning: { wormholeSpiralDirection: 1 } }, point(1));
    assert.equal(target.wormholeSpiralDirection, -1, 'foreign identity automation cannot reset or mirror this field');
});

test('direction is not multiplied by macros or Advanced gains', () => {
    for (const value of [0, .5, 1]) {
        const boosts = defaultAdvancedBoosts(); boosts.wormholeSpiralDirection = value;
        const out = resolveMetaTuning(tuning(1.2, -1), { intensity: value, motion: value, depth: value, detail: value }, boosts, cloneDefaultVisualTuning());
        assert.equal(out.wormholeSpiralDirection, -1);
        assert.ok(out.wormholeSpiral >= 0);
    }
});

test('preset config owns direction and survives serialization; inactive material and zero magnitude stay inactive', () => {
    const payload = JSON.parse(readFileSync('public/visual-tuning-presets/vos-wh-overdrive.json', 'utf8'));
    assert.equal(payload.visualTuning.wormholeSpiralDirection, 1, 'factory legacy appearance is explicit');
    for (const direction of [-1, 0, 1]) {
        const edited = JSON.parse(JSON.stringify({ ...payload, visualTuning: { ...payload.visualTuning, wormholeSpiralDirection: direction } }));
        const target = tuning(1, -direction);
        applyMvpWormholePreset(target, edited, point());
        assert.equal(target.wormholeSpiralDirection, direction, 'no point override follows authored preset');
        near(effectiveWormholeSpiral(target), payload.visualTuning.wormholeSpiral * direction);
        assert.equal(effectiveWormholeSpiral({ ...target, wormholeSpiral: 0 }), 0);
        assert.equal(target.wormholeNebulaAmount, payload.visualTuning.wormholeNebulaAmount, 'direction does not enable material');
        if (direction === 0) {
            applyMvpWormholePreset(target, edited, point(-1));
            assert.equal(target.wormholeSpiralDirection, 0, 'preset Straight disables automatic pair variation');
        }
    }
});

test('dramaturgy transfer preserves signed point direction; legacy fields are absent and invalid direction is rejected', () => {
    const plan = { version: 1, source: 'edited', points: [point(-1), { ...point(1), id: 'q', time: 4 }] };
    const result = parseDramaturgyPlan(serializeDramaturgyPlan(plan, 20));
    assert.ok(result.ok); assert.equal(result.plan.points.map(p => p.spiralDirection).join(), '-1,1');
    const legacy = parseDramaturgyPlan(JSON.stringify({ ...plan, points: [point()] }));
    assert.ok(legacy.ok); assert.equal(Object.hasOwn(legacy.plan.points[0], 'spiralDirection'), false);
    for (const value of [0, .5, 'left', null]) {
        const invalid = parseDramaturgyPlan(JSON.stringify({ ...plan, points: [point(value)] }));
        assert.ok(!invalid.ok || invalid.plan.points.length === 0);
    }
});
