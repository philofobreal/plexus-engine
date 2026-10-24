import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';

function harness() {
    const load = createLoader();
    const { State } = load('state/store.ts');
    const { CosmicWormholeIdentity } = load('visuals/CosmicWormholeIdentity.ts');
    const { cloneDefaultVisualTuning } = load('config/visualTuning.ts');
    const { WormholeSpiralAutomation } = load('automation/WormholeSpiralAutomation.ts');
    Object.assign(State, { bpm: 128, currentTime: 0, isExporting: false, exportTime: 0, playbackFade: 1 });
    Object.assign(State.visualTuning, cloneDefaultVisualTuning(), { wormholeWarp: 0, wormholeCurve: 0, wormholePathBend: 0,
        wormholePathBendVertical: 0, wormholeJitter: 0, wormholeSpiral: .3, wormholeSpiralArms: 2,
        wormholeNebulaAmount: .4, wormholeNebulaWeave: .7, wormholeGrainDensity: 0, transitionSpeed: .005 });
    const carriers = [], lines = [];
    const backend = new Proxy({ width: 640, height: 360, frameCount: 1, compactMaterialPreview: false,
        line(...args) { lines.push(args); }, beginFieldRaster() { return null; } }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
    const identity = new CosmicWormholeIdentity(State);
    identity.setMaterialSink({ begin() {}, carrier(c) { carriers.push({ ...c }); } });
    identity.setLineSink({ line() {} });
    const draw = (time, direction, exporting = false) => {
        State.currentTime = exporting ? 99 : time; State.exportTime = time; State.isExporting = exporting;
        State.visualTuning.wormholeSpiralDirection = direction;
        Object.assign(State.targetTuning, State.visualTuning);
        carriers.length = 0; lines.length = 0; identity.draw(backend, [], []);
        return { carriers: carriers.map(c => ({ ...c })), lines: lines.map(l => [...l]), drive: { ...identity.frameDrive } };
    };
    return { State, identity, draw, WormholeSpiralAutomation };
}
test('real grain and weave carriers are identical at one signed sample after live, backward seek and export histories', () => {
    const a = harness(), b = harness();
    const channel = new a.WormholeSpiralAutomation();
    const raw = { visualMode: 'cosmic-wormhole', visualTuning: { ...a.State.visualTuning } };
    const point = (time, direction) => ({ id: String(time), time, sectionId: 's', preset: 'a', confidence: 1, intensity: 1,
        reason: 'build', morphDurationSec: 2, morphCurve: 'linear', spiralDirection: direction });
    channel.configure({ version: 1, source: 'auto', points: [point(0, 1), point(2, -1)] }, () => raw);
    for (const time of [0, .2, 1.5, 2.3, 6]) { channel.apply(time, a.State.visualTuning); a.draw(time, a.State.visualTuning.wormholeSpiralDirection); }
    const at = 2.5;
    channel.apply(at, a.State.visualTuning); a.identity.syncPosition(at);
    const replay = a.draw(at, a.State.visualTuning.wormholeSpiralDirection);
    channel.apply(at, b.State.visualTuning); b.identity.syncPosition(at);
    const exported = b.draw(at, b.State.visualTuning.wormholeSpiralDirection, true);
    assert.ok(replay.carriers.filter(c => c.weave === 0).length > 50, 'actual grain geometry');
    assert.ok(replay.carriers.some(c => c.weave === 1), 'actual connective weave');
    assert.deepEqual(replay.carriers, exported.carriers, 'complete positions, phases, widths and arm-conditioned alpha');
    assert.equal(replay.drive.spiralTurns, exported.drive.spiralTurns);
});

test('real opposite-handed grain heads mirror around their unchanged local trajectory, without phase restart', () => {
    const h = harness(); h.identity.syncPosition(3);
    const base = h.draw(3, 0), right = h.draw(3, 1), left = h.draw(3, -1);
    const map = frame => new Map(frame.carriers.filter(c => c.weave === 0).map(c => [c.seed, c]));
    const r = map(right), l = map(left);
    let checked = 0;
    for (const [seed, b] of map(base)) {
        const a = r.get(seed), c = l.get(seed); if (!a || !c) continue;
        const angle = p => Math.atan2(p.headY - 180, p.headX - 320);
        assert.ok(Math.abs(Math.sin(angle(a) + angle(c) - 2 * angle(b))) < 1e-8);
        assert.equal(a.generation, c.generation); assert.equal(a.materialPhase, c.materialPhase);
        if (++checked === 150) break;
    }
    assert.equal(checked, 150);
    assert.equal(right.drive.spiralTurns, .3); assert.equal(left.drive.spiralTurns, -.3);
    assert.notDeepEqual(right.carriers, left.carriers, 'changing handedness actually changes the rendered geometry');
});

test('wall/lens strokes retain their own authored laws while coherent grain direction changes', () => {
    const h = harness();
    Object.assign(h.State.visualTuning, { wormholeOpticsEnabled: 1, wormholeWall: .6, wormholeLens: .7, wormholeLensSwirl: .8 });
    h.identity.syncPosition(3);
    const right = h.draw(3, 1), left = h.draw(3, -1);
    assert.ok(right.lines.length > 100, 'actual wall/lens and background strokes are exercised');
    assert.deepEqual(right.lines, left.lines, 'external grain strokes are excluded; optics do not get another mirror');
    assert.notDeepEqual(right.carriers, left.carriers);
    h.State.visualTuning.wormholeNebulaAmount = 0;
    assert.equal(h.draw(3, -1).drive.spiralTurns, 0, 'disabled material remains irrelevant');
});

test('a directional automation pulse uses its published origin after seek/export; other semantic pulses keep their owner', () => {
    const live = harness(), direct = harness();
    const current = live.State.visualTuning, target = { ...current, wormholeWarp: 2 };
    for (const h of [live, direct]) h.State.spiralTransitionAnchor = { id: 'automation:b', time: 2 };
    const envelope = (h, time, id = 'automation:b') => h.identity.transitionDisturbanceEnvelope(current, target, id, time);
    envelope(live, 2);
    const expected = envelope(live, 2.5);
    assert.ok(expected > 0, 'the real disturbance envelope is active, not a zero-only comparison');
    assert.equal(envelope(direct, 2.5), expected, 'first render at 2.5 already has the correct phase');
    assert.equal(envelope(live, 2.25), envelope(direct, 2.25));
    assert.equal(envelope(direct, 2.5, 'score:other'), 0, 'a separate semantic transition is not retimed by this anchor');
});
