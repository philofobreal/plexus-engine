import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const ROOT = process.cwd();
const PRESET_ROOT = join(ROOT, 'public', 'visual-tuning-presets');
const FPS = 60;
const DRAW_INTERVAL = 4;
const LONG_RUN_SECONDS = 30 * 60;
const STAR_SAMPLE_SIZE = 12;
const ROUTE_HISTORY_CAPACITY = 360;
const BACKEND_WIDTH = 960;
const BACKEND_HEIGHT = 540;
const MAX_STAR_DELTA_60_FPS = Math.max(8, BACKEND_WIDTH * 0.015);
const VISIBLE_ALPHA_FLOOR = 0.05;

function createSourceLoader() {
    const cache = new Map();
    function load(path) {
        if (cache.has(path)) return cache.get(path).exports;
        const source = readFileSync(path, 'utf8');
        const output = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText;
        const module = { exports: {} };
        cache.set(path, module);
        const require = request => {
            const base = normalize(join(dirname(path), request));
            return load(base.endsWith('.ts') ? base : `${base}.ts`);
        };
        vm.runInNewContext(output, {
            module, exports: module.exports, require, Math, Number, Array, Object, Map, Set,
            Uint16Array, Float64Array
        });
        return module.exports;
    }
    return relative => load(join(ROOT, 'src', relative));
}

function syntheticFrame() {
    return {
        e: 0.6, eRatio: 0.7, densityProj: 0.6, melodyProj: 0, fxProj: 0,
        perceptualSpectrum: [...new Array(8).fill(0.9), ...new Array(16).fill(0.1)], state: 'HIGH'
    };
}

function setupState(State) {
    State.sampleRate = 1000;
    State.hopSize = 100;
    State.frames = Array.from({ length: 400 }, syntheticFrame);
    State.events = [];
    State.bpm = 128;
    State.trackAnalysis.features = [];
    State.trackAnalysis.bars = [];
    State.trackAnalysis.timingConfidence.overall = 0.9;
    State.currentFrame = syntheticFrame();
    State.currentFeatures = { melody: 0, vocal: 0, fx: 0, density: 0.6, brightness: 0.5, tension: 0.5 };
    State.isExporting = false;
    State.exportTime = 0;
    State.playbackFade = 1;
    State.isPlaying = true;
    State.beatDecay = 0;
    State.denseImpactFlash = 0;
    State.activeVisualTransitionId = null;
}

function makeBackend() {
    let alpha = 0;
    const lines = [];
    return {
        width: BACKEND_WIDTH,
        height: BACKEND_HEIGHT,
        frameCount: 1,
        lines,
        background() {}, noStroke() {}, noFill() {}, fill() {}, strokeWeight() {}, circle() {}, triangle() {},
        beginShape() {}, vertex() {}, endShape() {}, radialGlow() {},
        stroke(_r, _g, _b, value) { alpha = value; },
        line(x1, y1, x2, y2) { lines.push([x1, y1, x2, y2, alpha]); }
    };
}

const load = createSourceLoader();
const { CosmicWormholeIdentity, IntegratedWormholeRoute } = load('visuals/CosmicWormholeIdentity.ts');
const { State } = load('state/store.ts');
const { applyTuningMorph } = load('config/visualTuning.ts');
const defaultTuning = { ...State.visualTuning };
const allPresets = readdirSync(PRESET_ROOT)
    .filter(name => /^vos-wh-.*\.json$/.test(name))
    .sort()
    .map(name => ({ name, ...JSON.parse(readFileSync(join(PRESET_ROOT, name), 'utf8')).visualTuning }));

assert.equal(allPresets.length, 10, 'the closing harness must cover every factory wormhole preset');

function completePreset(preset) {
    return {
        ...defaultTuning,
        ...preset,
        morphDurationSec: 2,
        wormholeStarfield: 1,
        wormholeGalaxy: 0,
        wormholeSkybox: 0,
        performanceMode: 0,
        chromaKeyMode: 0
    };
}

function trimForHarness(identity) {
    // The assertions exercise the real renderer and route history.  A fixed representative star
    // sample keeps the required 30-minute / 1/60-second run below one minute on CI.
    identity.pool.length = 0;
    identity.starPool.length = STAR_SAMPLE_SIZE;
    identity.galaxyPool.length = 0;
    identity.skyPool.length = 0;
}

function assertFiniteFrame(frame, label) {
    for (const [index, line] of frame.lines.entries()) {
        for (const value of line) assert.ok(Number.isFinite(value), `${label}: non-finite line ${index}`);
    }
}

function mirroredPreset(preset, activation) {
    const result = completePreset(preset);
    // This is the renderer-side result of the Task 09 bendMirror flag.  Only the mirrorable hero
    // turns are mirrored; all other factory roles retain their authored direction.
    if ((preset.name.includes('spiral') || preset.name.includes('overdrive')) && activation % 2 === 1) {
        result.wormholePathBend = -result.wormholePathBend;
        result.wormholePathBendVertical = -(result.wormholePathBendVertical ?? 0);
    }
    return result;
}

test('Task12: 30-minute cyclic preset run preserves route, travel, coordinate, and capacity invariants', () => {
    setupState(State);
    const identity = new CosmicWormholeIdentity();
    trimForHarness(identity);
    const first = mirroredPreset(allPresets[0], 0);
    Object.assign(State.visualTuning, first);
    Object.assign(State.targetTuning, first);
    identity.syncPosition(0);

    let previousTravel = -Infinity;
    let previousStars = null;
    let maxDeltaPx = 0;
    for (let frame = 0; frame <= LONG_RUN_SECONDS * FPS; frame++) {
        const timeSec = frame / FPS;
        const activation = Math.floor(timeSec / 20);
        if (frame > 0 && frame % (20 * FPS) === 0) Object.assign(State.targetTuning, mirroredPreset(allPresets[activation % allPresets.length], activation));
        State.currentTime = timeSec;
        applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed, 1 / FPS);
        const travel = identity.travelDistanceAt(timeSec);
        assert.ok(travel >= previousTravel - 1e-9, `travel regressed at ${timeSec.toFixed(3)}s: ${travel} < ${previousTravel}`);
        previousTravel = travel;

        if (frame % DRAW_INTERVAL !== 0) continue;
        const backend = makeBackend();
        identity.draw(backend, [], []);
        assert.equal(backend.lines.length, STAR_SAMPLE_SIZE, 'the fixed star sample must render every draw');
        assertFiniteFrame(backend, `t=${timeSec.toFixed(3)}`);
        for (const route of [identity.baseRouteNow, identity.baseRouteNowV]) {
            assert.ok(Math.abs(route.headingAngle) <= 0.88 + 1e-9, `route heading escaped bound at ${timeSec.toFixed(3)}s`);
            assert.ok(route.turnIntensity >= 0 && route.turnIntensity <= 1, `invalid turn intensity at ${timeSec.toFixed(3)}s`);
            for (const value of Object.values(route)) assert.ok(Number.isFinite(value), `non-finite route frame at ${timeSec.toFixed(3)}s`);
        }
        if (previousStars) {
            for (let index = 0; index < STAR_SAMPLE_SIZE; index++) {
                const before = previousStars[index], after = backend.lines[index];
                if (before[4] < VISIBLE_ALPHA_FLOOR || after[4] < VISIBLE_ALPHA_FLOOR) continue;
                maxDeltaPx = Math.max(maxDeltaPx, Math.hypot(after[2] - before[2], after[3] - before[3]));
            }
        }
        previousStars = backend.lines;
    }

    assert.ok(maxDeltaPx <= MAX_STAR_DELTA_60_FPS * DRAW_INTERVAL, `30-minute maximum ${maxDeltaPx.toFixed(3)}px exceeded draw-interval threshold`);
    assert.ok(identity.routePath.historyCount <= ROUTE_HISTORY_CAPACITY, `horizontal route history exceeded capacity: ${identity.routePath.historyCount}`);
    assert.ok(identity.routePathVertical.historyCount <= ROUTE_HISTORY_CAPACITY, `vertical route history exceeded capacity: ${identity.routePathVertical.historyCount}`);
    assert.ok(identity.authoredSpeedTimeline.anchorCount() <= 256, `speed anchors exceeded capacity: ${identity.authoredSpeedTimeline.anchorCount()}`);
    console.log(`[wormhole-long-run] maxVisibleDeltaPx=${maxDeltaPx.toFixed(6)}, routeHistory=${identity.routePath.historyCount}/${ROUTE_HISTORY_CAPACITY}, speedAnchors=${identity.authoredSpeedTimeline.anchorCount()}/256`);
});

function renderAtEnd({ exporting, seek }) {
    setupState(State);
    const identity = new CosmicWormholeIdentity();
    trimForHarness(identity);
    const preset = completePreset(allPresets.find(item => item.name.includes('spiral')));
    // A static authored rate makes playback, export, and a direct seek the same canonical plan;
    // changing it would deliberately create different pre-seek authored-speed anchor histories.
    preset.wormholeSpeed = 1;
    Object.assign(State.visualTuning, preset);
    Object.assign(State.targetTuning, preset);
    const endTime = 36;
    if (seek) {
        identity.syncPosition(endTime);
        State.currentTime = endTime;
        State.exportTime = endTime;
    } else {
        identity.syncPosition(0);
        for (let frame = 0; frame <= endTime * FPS; frame++) {
            const timeSec = frame / FPS;
            State.currentTime = timeSec;
            State.exportTime = timeSec;
            State.isExporting = exporting;
            identity.draw(makeBackend(), [], []);
        }
    }
    State.isExporting = exporting;
    const backend = makeBackend();
    identity.draw(backend, [], []);
    return { heading: identity.baseRouteNow.headingAngle, lines: backend.lines };
}

test('Task12: playback, export, and seek agree; repeated export draw lists are byte deterministic', () => {
    const playback = renderAtEnd({ exporting: false, seek: false });
    const exportA = renderAtEnd({ exporting: true, seek: false });
    const exportB = renderAtEnd({ exporting: true, seek: false });
    const seek = renderAtEnd({ exporting: false, seek: true });

    assert.equal(exportA.heading, playback.heading, 'export and playback heading must agree exactly');
    assert.equal(JSON.stringify(exportA.lines), JSON.stringify(playback.lines), 'export and playback star draw lists must agree exactly');
    assert.equal(JSON.stringify(exportA.lines), JSON.stringify(exportB.lines), 'identical export runs must be byte deterministic');
    assert.ok(Math.abs(seek.heading - playback.heading) <= 0.05, `seek heading delta ${Math.abs(seek.heading - playback.heading)} exceeded 0.05rad`);
    assertFiniteFrame({ lines: seek.lines }, 'seek');
    console.log(`[wormhole-equivalence] seekHeadingDeltaRad=${Math.abs(seek.heading - playback.heading).toFixed(9)}, exportExact=true`);
});

function measuredMotionAtFps(fps) {
    setupState(State);
    const identity = new CosmicWormholeIdentity();
    trimForHarness(identity);
    const spiral = completePreset(allPresets.find(item => item.name.includes('spiral')));
    const drive = completePreset(allPresets.find(item => item.name.includes('drive')));
    Object.assign(State.visualTuning, spiral);
    Object.assign(State.targetTuning, spiral);
    identity.syncPosition(0);
    let previous = null;
    let maxDelta = 0;
    for (let frame = 0; frame <= fps * 4; frame++) {
        if (frame === fps * 2) Object.assign(State.targetTuning, drive);
        const timeSec = frame / fps;
        State.currentTime = timeSec;
        applyTuningMorph(State.visualTuning, State.targetTuning, State.targetTuning.transitionSpeed, 1 / fps);
        const backend = makeBackend();
        identity.draw(backend, [], []);
        if (previous) {
            for (let index = 0; index < STAR_SAMPLE_SIZE; index++) {
                if (backend.lines[index][4] < VISIBLE_ALPHA_FLOOR || previous[index][4] < VISIBLE_ALPHA_FLOOR) continue;
                maxDelta = Math.max(maxDelta, Math.hypot(backend.lines[index][2] - previous[index][2], backend.lines[index][3] - previous[index][3]));
            }
        }
        previous = backend.lines;
    }
    return maxDelta;
}

test('Task12: representative preset continuity respects FPS-scaled frame thresholds', () => {
    const at30 = measuredMotionAtFps(30);
    const at120 = measuredMotionAtFps(120);
    assert.ok(at30 <= MAX_STAR_DELTA_60_FPS * 2, `30fps delta ${at30.toFixed(3)}px exceeded scaled limit`);
    assert.ok(at120 <= MAX_STAR_DELTA_60_FPS / 2, `120fps delta ${at120.toFixed(3)}px exceeded scaled limit`);
    console.log(`[wormhole-fps] delta30=${at30.toFixed(6)}px/${(MAX_STAR_DELTA_60_FPS * 2).toFixed(3)}, delta120=${at120.toFixed(6)}px/${(MAX_STAR_DELTA_60_FPS / 2).toFixed(3)}`);
});

test('Task12: route samples are bounded per draw and the vertical/smoothed paths retain preallocated scratch state', () => {
    setupState(State);
    const originalSample = IntegratedWormholeRoute.prototype.sample;
    let sampleCount = 0;
    IntegratedWormholeRoute.prototype.sample = function (...args) {
        sampleCount++;
        return originalSample.apply(this, args);
    };
    try {
        const identity = new CosmicWormholeIdentity();
        trimForHarness(identity);
        const preset = completePreset(allPresets.find(item => item.name.includes('spiral')));
        Object.assign(State.visualTuning, preset);
        Object.assign(State.targetTuning, preset);
        identity.syncPosition(1);
        State.currentTime = 1;
        identity.draw(makeBackend(), [], []);
    } finally {
        IntegratedWormholeRoute.prototype.sample = originalSample;
    }
    // Measured current count is 58; this 10% headroom guards accidental per-grain O(N) sampling.
    assert.ok(sampleCount <= 64, `route sample count ${sampleCount} exceeded 58 + 10% headroom`);

    const source = readFileSync(join(ROOT, 'src', 'visuals', 'CosmicWormholeIdentity.ts'), 'utf8');
    const drawBody = source.slice(source.indexOf('    draw('), source.indexOf('    private travelDistanceAt'));
    assert.doesNotMatch(drawBody, /new IntegratedWormholeRoute|createRouteFrame\(\)/);
    assert.match(source, /private readonly routePathVertical = new IntegratedWormholeRoute\(\);/);
    assert.match(source, /smoothedTurnIntensity\([\s\S]*?this\.turnNow[\s\S]*?this\.turnPast/);
});
