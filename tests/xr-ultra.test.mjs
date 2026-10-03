import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { chartSources } from './helpers/xr-chart-sources.mjs';

const load = createLoader();
const { buildRhythmChart, DEFAULT_RHYTHM_GAME_CONFIG: config, DIFFICULTIES, HAND_PATTERNS } = load('gameplay/index.ts');
const { difficultyProfile } = load('gameplay/RhythmGenerationProfile.ts');
const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope, resolveGameConfig } = load('xr/XrSettings.ts');

const SECTIONS = [0, 12, 24, 36, 48, 64, 76, 86];
const journeys = chartSources();
/** The journey's plan over a sixteenth-note onset stream (hats), so density is not capped by the source. */
function sixteenths(bpm) {
    const base = journeys['journey-128-confident'], beat = 60 / bpm, events = [];
    for (let i = 0; i * beat / 4 < base.durationSec; i++) {
        events.push({ time: +(i * beat / 4).toFixed(6), intensity: i % 16 === 0 ? 0.95 : i % 4 === 0 ? 0.75 : i % 2 === 0 ? 0.55 : 0.4,
            type: i % 16 === 0 ? 2 : i % 2 ? 3 : 1 });
    }
    const beats = Array.from({ length: Math.floor(base.durationSec / beat) + 1 }, (_, i) => +(i * beat).toFixed(6));
    return { ...base, events, beats, barStarts: beats.filter((_, i) => i % 4 === 0), sectionStarts: SECTIONS };
}
const sources = { rich128: sixteenths(128), rich100: sixteenths(100), rich174: sixteenths(174),
    ...Object.fromEntries(Object.entries(journeys).map(([name, s]) => [name, { ...s, sectionStarts: SECTIONS }])) };
const count = (chart, from, to) => chart.filter(n => n.time >= from && n.time < to).length;

test('Ultra is the fifth Difficulty: chart scope, same judging windows', () => {
    assert.equal(DIFFICULTIES.at(-1), 'ultra');
    const descriptor = XR_SETTINGS.find(d => d.id === 'difficulty');
    assert.equal(descriptor.choices.at(-1).value, 'ultra'); assert.equal(descriptor.choices.at(-1).label, 'Ultra');
    const ultra = descriptor.write(DEFAULT_XR_SETTINGS, 'ultra');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, ultra), 'chart');
    assert.equal(resolveGameConfig(ultra), resolveGameConfig(DEFAULT_XR_SETTINGS), 'timing windows and judging are unchanged');
    const expert = difficultyProfile('expert'), profile = difficultyProfile('ultra');
    assert.ok(profile.globalSpacingScale < expert.globalSpacingScale && profile.sameHandSpacingScale < expert.sameHandSpacingScale
        && profile.travelScale > expert.travelScale && profile.ceilingScale < expert.ceilingScale && profile.hardChain > expert.hardChain);
    for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
        const p = difficultyProfile(difficulty);
        assert.equal(p.calmCeilingScale, p.ceilingScale, `${difficulty}: no structural change`);
        assert.ok(p.maxRunBeats === Infinity && p.sectionSilenceBeats === 0 && !p.directionalSingles && !p.extraPairs);
    }
});

test('where the music has the onsets, Ultra is about 55% denser than Expert; calm scenes do not densify', () => {
    // Sixteenths fit the physical floors up to ~133 BPM; at 128 BPM Ultra plays them where Expert cannot.
    for (const activity of ['balanced', 'active']) {
        const expert = buildRhythmChart(sources.rich128, config, { difficulty: 'expert', activity });
        const ultra = buildRhythmChart(sources.rich128, config, { difficulty: 'ultra', activity });
        assert.ok(ultra.length >= expert.length * 1.45, `${activity}: ${ultra.length} vs ${expert.length}`);
        assert.ok(count(ultra, 48, 64) >= count(expert, 48, 64) * 1.5, `${activity}: the drop drives harder`);
    }
    // Slower: Expert already reaches sixteenths; Ultra is still denser where it drives. Faster: no
    // onset fits the floors that Expert does not already use, so Ultra stays comparable (its demand is
    // hand speed, pairs, crossings and directional runs) while its structure keeps the pauses.
    const drop = (name, difficulty) => count(buildRhythmChart(sources[name], config, { difficulty }), 48, 64);
    assert.ok(drop('rich100', 'ultra') >= drop('rich100', 'expert') * 1.15);
    assert.ok(drop('rich174', 'ultra') >= drop('rich174', 'expert') * 0.9);
    for (const name of ['rich100', 'rich128', 'rich174']) {
        const intro = difficulty => count(buildRhythmChart(sources[name], config, { difficulty }), 0, 12);
        assert.ok(intro('ultra') < intro('expert'), `${name}: the intro breathes`);
    }
    // Eighth-only material is already saturated by Expert: Ultra adds structure there, not invented notes.
    const onsets = new Set(journeys['journey-128-confident'].events.map(e => e.time));
    assert.ok(buildRhythmChart(sources['journey-128-confident'], config, { difficulty: 'ultra' }).every(n => onsets.has(n.time)));
});

test('Ultra structure: dense runs end within four bars, a breath precedes every section change, singles are directional, more pairs', () => {
    for (const [name, source] of Object.entries(sources)) for (const handPattern of HAND_PATTERNS) for (const activity of ['macro', 'balanced', 'active']) {
        const settings = { difficulty: 'ultra', handPattern, activity }, label = `${name} ${JSON.stringify(settings)}`;
        const chart = buildRhythmChart(source, config, settings);
        assert.equal(JSON.stringify(chart), JSON.stringify(buildRhythmChart(source, config, { ...settings })), `${label}: deterministic`);
        const grid = (source.timingConfidence ?? 0) >= 0.5 && source.beats.length > 1;
        const beat = grid ? source.beats[1] - source.beats[0] : 0.5;
        // Runs: consecutive targets less than 0.9 beat apart (pairs count once).
        const times = [...new Set(chart.map(n => n.time))];
        let runStart = times[0];
        for (let i = 1; grid && i < times.length; i++) {
            if (times[i] - times[i - 1] >= beat * 0.9 - 1e-6) { runStart = times[i]; continue; }
            assert.ok(times[i] - runStart < 16 * beat + 1e-6, `${label}: a dense run longer than four bars at ${times[i]}`);
        }
        for (const boundary of SECTIONS.slice(1)) {
            // On a trusted grid: two beats at fast tempos, one at slow ones; otherwise at least half a second.
            const silence = grid ? beat * (beat <= 0.5 ? 2 : 1) : 0.5;
            assert.equal(count(chart, boundary - silence + 1e-6, boundary), 0, `${label}: silence before ${boundary}`);
        }
        assert.equal(chart.filter(n => !n.pairId && n.cutDirection === 'any').length, 0, `${label}: directional singles`);
    }
    const pairs = (difficulty, source) => buildRhythmChart(source, config, { difficulty }).filter(n => n.pairId).length / 2;
    for (const name of ['rich128', 'journey-128-confident', 'journey-174-confident'])
        assert.ok(pairs('ultra', sources[name]) > pairs('expert', sources[name]), `${name}: more two-hand accents`);
});

test('section starts only matter to Ultra: every other difficulty ignores them', () => {
    for (const [name, source] of Object.entries(journeys)) for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
        const plain = JSON.stringify(buildRhythmChart(source, config, { difficulty }));
        assert.equal(JSON.stringify(buildRhythmChart({ ...source, sectionStarts: SECTIONS }, config, { difficulty })), plain, `${name} ${difficulty}`);
    }
    const expert = buildRhythmChart(sources.rich128, config, { difficulty: 'expert' });
    assert.ok(count(expert, 48 - 0.9, 48) > 0, 'without Ultra the bar before a section change is played');
});
