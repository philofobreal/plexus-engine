// Deterministic synthetic chart sources shared by the XR generation tests and the default-chart
// golden fixture (tests/fixtures/xr-chart-default-golden.json). Pure data; no randomness.

const point = (id, time, meta, intensity = 1) => ({ id, time, sectionId: 's', preset: 'opaque.json', confidence: 0.9,
    intensity, reason: 'section', morphDurationSec: 1, morphCurve: 'linear', meta });

function grid(durationSec, beatSec) {
    const beats = Array.from({ length: Math.floor(durationSec / beatSec) + 1 }, (_, i) => +(i * beatSec).toFixed(6));
    return { beats, barStarts: beats.filter((_, i) => i % 4 === 0) };
}

/** Quarter/eighth onsets with accents, dense impacts and FX hits over a multi-section journey. */
function journey(name, beatSec, confidence) {
    const durationSec = 96;
    const { beats, barStarts } = grid(durationSec, beatSec);
    const events = [];
    for (let i = 0; i * beatSec / 2 < durationSec; i++) {
        const time = +(i * beatSec / 2).toFixed(6);
        const onBeat = i % 2 === 0, downbeat = i % 8 === 0;
        if (!onBeat && i % 6 === 3) continue; // syncopated gaps
        events.push({ time, intensity: downbeat ? 0.95 : onBeat ? 0.7 - (i % 5) * 0.03 : 0.45 + (i % 3) * 0.05,
            type: downbeat && i % 16 === 0 ? 2 : !onBeat && i % 5 === 1 ? 3 : 1 });
    }
    const points = [
        point(`${name}-intro`, 0, { automationSituation: 'intro-establish', movementGesture: 'fade', variantRole: 'primary' }, 0.6),
        point(`${name}-pulse`, 12, { movementGesture: 'pulse', variantRole: 'primary' }),
        point(`${name}-orbit`, 24, { movementGesture: 'orbit', variantRole: 'primary' }),
        point(`${name}-build`, 36, { automationSituation: 'buildup-ramp', movementGesture: 'drive', behaviour: { energy: 0.8 } }, 2),
        point(`${name}-drop`, 48, { automationSituation: 'drop-long', movementGesture: 'fragment', variantRole: 'primary' }, 2.6),
        point(`${name}-echo`, 64, { movementGesture: 'echo', variantRole: 'secondary' }),
        point(`${name}-break`, 76, { automationSituation: 'breakdown-long', movementGesture: 'ripple', variantRole: 'sparse' }, 0.5),
        point(`${name}-peak`, 86, { automationSituation: 'peak-sustain', movementGesture: 'tunnel' }, 2.4)
    ];
    return { durationSec, events, beats, barStarts, timingConfidence: confidence,
        performancePlan: { version: 1, source: 'auto', points } };
}

/** Sparse irregular FX material with no plan. */
function sparse() {
    const events = Array.from({ length: 70 }, (_, i) => ({ time: 2.2 + i * 0.83 + (i % 4) * 0.07, intensity: 0.2 + (i % 9) * 0.07, type: 3 }));
    return { durationSec: 62, events, beats: [], timingConfidence: 0.1 };
}

export function chartSources() {
    return {
        'journey-128-confident': journey('a', 60 / 128, 0.9),
        'journey-174-confident': journey('b', 60 / 174, 0.85),
        'journey-100-unreliable': journey('c', 0.6, 0.2),
        'sparse-no-plan': sparse()
    };
}
