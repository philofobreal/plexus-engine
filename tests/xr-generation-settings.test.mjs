import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';

const load = createLoader();
const { buildRhythmChart, notePosition, CUT_VECTORS, normalizeGenerationSettings, DEFAULT_RHYTHM_GENERATION_SETTINGS,
    HAND_PATTERNS, HAND_LEADS, DIFFICULTIES, HAND_ZONES, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const { difficultyProfile } = load('gameplay/RhythmGenerationProfile.ts');
const sources = chartSources();
const golden = JSON.parse(readFileSync('tests/fixtures/xr-chart-default-golden.json', 'utf8'));
const sha = chart => createHash('sha256').update(JSON.stringify(chart)).digest('hex');
const ACTIVITIES = ['macro', 'balanced', 'active'], VARIATIONS = ['stable', 'paired', 'expressive'];
const combos = ACTIVITIES.flatMap(activity => VARIATIONS.flatMap(variation => HAND_PATTERNS.flatMap(handPattern =>
    HAND_LEADS.map(handLead => ({ activity, variation, handPattern, handLead })))));
/** Every Difficulty x Zones pair against a representative spread of the other four axes. */
const physicalCombos = DIFFICULTIES.flatMap(difficulty => HAND_ZONES.flatMap(zones => combos
    .filter((_, i) => i % 9 === 0).map(c => ({ ...c, difficulty, zones }))));
const isCross = n => !n.pairId && Math.sign(n.xOffsetMeters) === (n.hand === 'left' ? 1 : -1);
const isCenter = n => n.xOffsetMeters === 0;
const chart = (name, settings) => buildRhythmChart(sources[name], config, settings);
const singles = c => c.filter(n => !n.pairId);
const pairs = c => c.filter(n => n.pairId).length / 2;
const alternation = c => { const s = singles(c); let a = 0; for (let i = 1; i < s.length; i++) if (s[i].hand !== s[i - 1].hand) a++; return a / (s.length - 1); };
const meanRun = c => { const s = singles(c), runs = []; let r = 1; for (let i = 1; i < s.length; i++) { if (s[i].hand === s[i - 1].hand) r++; else { runs.push(r); r = 1; } } runs.push(r); return runs.reduce((a, b) => a + b) / runs.length; };
const leftShare = c => { const s = singles(c); return s.filter(n => n.hand === 'left').length / s.length; };
const lag1 = c => { const x = singles(c).map(n => (n.hand === 'left' ? 1 : -1)), m = x.reduce((a, b) => a + b) / x.length;
    let num = 0, den = 0; x.forEach((v, i) => { den += (v - m) ** 2; if (i) num += (v - m) * (x[i - 1] - m); }); return num / den; };
const JOURNEYS = ['journey-128-confident', 'journey-100-unreliable'];

test('default settings reproduce the pre-settings chart byte-for-byte', () => {
    for (const [name, source] of Object.entries(sources)) {
        assert.equal(sha(buildRhythmChart(source)), golden[name].sha256, name);
        assert.equal(sha(buildRhythmChart(source, config, DEFAULT_RHYTHM_GENERATION_SETTINGS)), golden[name].sha256, name);
        assert.equal(sha(buildRhythmChart(source, config, {})), golden[name].sha256, name);
    }
    assert.equal(JSON.stringify(normalizeGenerationSettings({ activity: 'extreme', handPattern: 'juggle', handLead: 'right' })),
        JSON.stringify({ ...DEFAULT_RHYTHM_GENERATION_SETTINGS, handLead: 'right' }));
});

test('all setting combinations are deterministic, immutable-input and byte-equivalent on replay', () => {
    for (const [name, source] of Object.entries(sources)) {
        const before = JSON.stringify(source), clone = JSON.parse(before);
        for (const settings of [...combos, ...physicalCombos]) {
            const a = JSON.stringify(buildRhythmChart(source, config, settings));
            assert.equal(a, JSON.stringify(buildRhythmChart(clone, config, { ...settings })), `${name} ${JSON.stringify(settings)}`);
        }
        assert.equal(JSON.stringify(source), before, 'source is never mutated');
    }
});

test('every combination keeps spacing, reach, parity, pair, row, zone-safety and onset invariants', () => {
    for (const [name, source] of Object.entries(sources)) {
        const onsets = new Set(source.events.map(e => e.time));
        for (const settings of [...combos, ...physicalCombos]) {
            const c = buildRhythmChart(source, config, settings), label = `${name} ${JSON.stringify(settings)}`, last = {};
            const demand = difficultyProfile(settings.difficulty ?? 'normal');
            const minGlobal = config.minGlobalNoteSpacingSec * demand.globalSpacingScale;
            const minSame = config.minSameHandSpacingSec * demand.sameHandSpacingScale;
            const travel = config.maxHandTravelMps * demand.travelScale;
            for (let i = 0; i < c.length; i++) {
                const n = c[i];
                assert.ok(onsets.has(n.time), `${label}: only real onsets`);
                assert.ok([0, 1, 2].includes(n.row), label);
                if ((settings.zones ?? 'split') === 'split') assert.equal(n.hand === 'left', n.xOffsetMeters < 0, `${label}: own half`);
                if (settings.zones === 'shared') assert.ok(!isCross(n), `${label}: shared never crosses`);
                if (isCenter(n)) assert.ok(n.row <= 1 && !n.pairId, `${label}: center keeps the high view clear`);
                if (isCross(n) || isCenter(n)) for (const o of c) if (o.hand !== n.hand && Math.abs(o.time - n.time) < demand.crossClearSec - 1e-9) {
                    assert.ok(!isCross(n), `${label}: the other hand rests around a crossing (${n.time} vs ${o.time})`);
                    assert.ok(!isCenter(o), `${label}: the center lane is exclusive`);
                }
                if (n.pairId) assert.equal(n.hand === 'left', n.xOffsetMeters < 0, `${label}: pairs never cross`);
                if (i && !(n.pairId && n.pairId === c[i - 1].pairId))
                    assert.ok(n.time - c[i - 1].time >= minGlobal - 1e-7, `${label}: global spacing`);
                const p = last[n.hand];
                if (p) {
                    const dt = n.time - p.time, a = notePosition(n, n.time, {}), b = notePosition(p, p.time, {});
                    assert.ok(dt >= minSame - 1e-8, `${label}: same-hand spacing`);
                    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= dt * travel + 1e-8, `${label}: reach`);
                    if (!n.pairId && !p.pairId) assert.ok(Math.abs(n.row - p.row) <= demand.maxRowStep, `${label}: row step`);
                    if (p.cutDirection !== 'any' && n.cutDirection !== 'any' && dt < 1.5) {
                        const u = CUT_VECTORS[p.cutDirection], v = CUT_VECTORS[n.cutDirection];
                        assert.ok(u[0] * v[0] + u[1] * v[1] <= 0.1, `${label}: cut parity`);
                    }
                }
                last[n.hand] = n;
            }
            const byPair = new Map();
            for (const n of c.filter(n => n.pairId)) byPair.set(n.pairId, [...(byPair.get(n.pairId) ?? []), n]);
            for (const pair of byPair.values()) {
                assert.equal(pair.length, 2, label); assert.equal(pair[0].time, pair[1].time, label);
                assert.equal(pair.map(n => n.hand).sort().join(), 'left,right', label);
            }
        }
    }
    for (const settings of combos) {
        assert.equal(buildRhythmChart({ events: [], durationSec: 30, beats: [] }, config, settings).length, 0);
        assert.equal(buildRhythmChart({ events: [{ time: 5, intensity: 1, type: 2 }], durationSec: 30, beats: [] }, config, settings)
            .filter(n => n.pairId).length, 0, 'an isolated onset never becomes an invented pair');
    }
});

test('Activity is the density axis: Calm < Balanced <= Active', () => {
    for (const name of JOURNEYS) for (const handPattern of HAND_PATTERNS) {
        const [calm, balanced, active] = ACTIVITIES.map(activity => chart(name, { activity, handPattern }).length);
        // Call & Response is already thinned by one-hand calls, so Calm is strictly but less sparse there.
        assert.ok(calm < balanced * (handPattern === 'call-response' ? 1 : 0.85), `${name} ${handPattern}: ${calm} vs ${balanced}`);
        assert.ok(balanced <= active, `${name} ${handPattern}: ${balanced} vs ${active}`);
    }
});

test('Variation is the complexity axis: vocabulary, development and cut diversity grow', () => {
    for (const name of JOURNEYS) {
        const [stable, paired, expressive] = VARIATIONS.map(variation => chart(name, { variation }));
        const changes = c => c.filter((n, i) => i && n.texture !== c[i - 1].texture).length;
        const lateral = c => c.filter(n => n.cutDirection === 'left' || n.cutDirection === 'right').length;
        const perScene = c => { const m = new Map(); for (const n of c) m.set(n.automationId, (m.get(n.automationId) ?? new Set()).add(n.texture)); return [...m.values()].map(s => s.size); };
        assert.ok(perScene(stable).every(size => size <= 2), 'stable scenes use at most two textures');
        assert.ok(changes(stable) < changes(paired) && changes(paired) < changes(expressive), name);
        assert.equal(lateral(stable), 0, 'stable keeps vertical/diagonal cuts');
        assert.ok(lateral(expressive) > lateral(paired), name);
        assert.ok(new Set(stable.map(n => n.cutDirection)).size < new Set(paired.map(n => n.cutDirection)).size, name);
    }
});

test('hand patterns have distinct, measurable signatures', () => {
    for (const name of JOURNEYS) {
        const alternate = chart(name, { handPattern: 'alternate' });
        assert.ok(alternation(alternate) >= 0.8, name);
        const call = chart(name, { handPattern: 'call-response' });
        assert.ok(alternation(call) <= 0.5 && meanRun(call) >= 2, `${name}: calls hold one hand`);
        const together = chart(name, { handPattern: 'together' });
        assert.ok(pairs(together) >= pairs(alternate) * 1.25, `${name}: ${pairs(together)} vs ${pairs(alternate)}`);
        const independent = chart(name, { handPattern: 'independent' });
        assert.ok(Math.abs(lag1(independent)) <= Math.abs(lag1(alternate)) - 0.15, `${name}: streams decorrelate the hands`);
        assert.ok(leftShare(independent) > 0.3 && leftShare(independent) < 0.7, `${name}: both streams are played`);
    }
});

test('Lead shifts primary work to the chosen hand; Even stays balanced', () => {
    for (const name of JOURNEYS) for (const handPattern of ['alternate', 'call-response', 'together']) {
        const left = leftShare(chart(name, { handPattern, handLead: 'left' }));
        const right = leftShare(chart(name, { handPattern, handLead: 'right' }));
        const even = leftShare(chart(name, { handPattern, handLead: 'even' }));
        assert.ok(left >= 0.6, `${name} ${handPattern} left ${left}`);
        assert.ok(right <= 0.4, `${name} ${handPattern} right ${right}`);
        assert.ok(even > 0.4 && even < 0.6, `${name} ${handPattern} even ${even}`);
    }
});

test('automation modulates the chosen pattern without switching it', () => {
    const name = 'journey-128-confident', source = sources[name];
    const window = id => { const points = source.performancePlan.points, i = points.findIndex(p => p.id === id);
        return [points[i].time, points[i + 1]?.time ?? source.durationSec]; };
    const rate = (c, [from, to]) => c.filter(n => n.pairId && n.time >= from && n.time < to).length / 2 / (to - from);
    const together = chart(name, { handPattern: 'together' });
    assert.ok(rate(together, window('a-drop')) > rate(together, window('a-break')), 'impact scenes carry more two-hand accents');
    const call = chart(name, { handPattern: 'call-response' });
    for (const id of ['a-drop', 'a-break', 'a-orbit']) {
        const [from, to] = window(id), part = call.filter(n => n.time >= from && n.time < to);
        assert.ok(meanRun(part) >= 1.5, `${id}: call & response survives automation changes`);
    }
});

test('Difficulty is the physical demand axis: density, speed and free cuts change strongly and monotonically', () => {
    for (const name of [...JOURNEYS, 'journey-174-confident']) {
        const [easy, normal, hard, expert] = DIFFICULTIES.map(difficulty => chart(name, { difficulty }));
        assert.ok(easy.length < normal.length * 0.85, `${name}: easy ${easy.length} vs normal ${normal.length}`);
        assert.ok(hard.length >= normal.length && expert.length >= hard.length, `${name}: ${normal.length} ${hard.length} ${expert.length}`);
        assert.ok(expert.length > normal.length * 1.05, `${name}: expert ${expert.length} vs normal ${normal.length}`);
        const free = c => c.filter(n => n.cutDirection === 'any').length / c.length;
        assert.ok(free(easy) > free(normal) && free(hard) < free(normal), `${name}: free cuts shrink with difficulty`);
    }
    // Normal is the historical chart.
    assert.equal(sha(chart('journey-128-confident', { difficulty: 'normal' })), golden['journey-128-confident'].sha256);
});

test('Zones open the play space: shared adds a center lane, crossover adds musically placed crossings', () => {
    for (const name of JOURNEYS) {
        const split = chart(name, { zones: 'split', difficulty: 'hard' });
        const shared = chart(name, { zones: 'shared', difficulty: 'hard' });
        const cross = chart(name, { zones: 'cross', difficulty: 'hard' });
        assert.equal(split.filter(n => isCenter(n) || isCross(n)).length, 0);
        assert.ok(shared.filter(isCenter).length > 0 && shared.filter(isCross).length === 0, name);
        assert.ok(cross.filter(isCross).length >= 5, `${name}: ${cross.filter(isCross).length} crossings`);
        const crossings = difficulty => chart(name, { zones: 'cross', difficulty }).filter(isCross).length;
        assert.ok(crossings('normal') < crossings('hard') && crossings('hard') <= crossings('expert') + 2, name);
        // Crossed targets keep their hand: the color identity is the readability cue.
        for (const n of cross.filter(isCross)) assert.ok(['left', 'right'].includes(n.hand) && n.lane === (n.hand === 'left' ? 2 : 0));
    }
});

test('crossings follow the music: energetic scenes open the space, breathing and scene entries stay in-lane', () => {
    const name = 'journey-128-confident', source = sources[name], points = source.performancePlan.points;
    const window = id => { const i = points.findIndex(p => p.id === id); return [points[i].time, points[i + 1]?.time ?? source.durationSec]; };
    const mixed = chart(name, { zones: 'cross', difficulty: 'expert' });
    const rate = ([from, to]) => mixed.filter(n => (isCross(n) || isCenter(n)) && n.time >= from && n.time < to).length / (to - from);
    assert.ok(rate(window('a-drop')) > rate(window('a-intro')), 'drop mixes more than the intro');
    assert.ok(rate(window('a-drop')) > rate(window('a-break')), 'drop mixes more than the breakdown');
    const beat = 60 / 128;
    for (const p of points) assert.ok(!mixed.some(n => (isCross(n) || isCenter(n)) && n.time >= p.time && n.time < p.time + beat * 4 - 1e-9),
        `${p.id}: a new scene establishes in-lane first`);
});
