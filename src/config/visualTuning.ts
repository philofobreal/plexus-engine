import type { AudioFrame, ModulationState, VisualFeatureFrame, VisualTuningConfig } from '../types';
import { featureFlags } from './featureFlags';

export type VisualTuningKey = keyof VisualTuningConfig;

export interface VisualTuningControl {
    key: VisualTuningKey;
    label: string;
    group: 'Audio' | 'Background' | 'Particles' | 'Circles' | 'Lines' | 'Polygons' | 'Temporal' | 'Wormhole' | 'Hero';
    min: number;
    max: number;
    step: number;
    unit?: string;
    options?: Array<{ value: number; label: string }>;
}

export const defaultVisualTuning: VisualTuningConfig = {
    audioSensitivity: 1,
    transitionSpeed: 0.08,
    dynamicsThreshold: 0.45,
    dropThreshold: 0.35,
    dropAnticipation: 0.0,
    phraseSize: 4,
    chromaKeyMode: 0,
    performanceMode: 0,
    backgroundRed: 8,
    backgroundGreen: 5,
    backgroundBlue: 14,
    particleIdleSpeed: 0.2,
    particleEnergySpeed: 8,
    particleBeatSpeed: 20,
    particleBoundaryPull: 0.05,
    particleActivityTurn: 0.1,
    shockwaveRadius: 1,
    shockwaveSpeed: 1,
    shockwaveAlpha: 1,
    shockwaveThickness: 1,
    shockwaveExpansion: 0.05,
    shockwaveDecay: 5,
    circleBackgroundHue: 205,
    circleBackgroundAlpha: 1,
    circleHue: 205,
    circleAlpha: 1,
    circleSize: 1,
    circleLineWeight: 1,
    lineHue: 200,
    lineAlpha: 1,
    lineDistance: 1,
    lineWeight: 1,
    polygonHue: 210,
    polygonAlpha: 1,
    polygonSize: 1,
    polygonFlash: 1,
    temporalRingSize: 1,
    temporalRingAlpha: 1,
    temporalRingSpeed: 1,
    temporalNetworkDistance: 1,
    temporalPolygonAlpha: 1,
    heroLaneBottomOffset: 0.2,
    heroBeepVolume: 0.5,
    heroBeepMode: 0,
    heroEventMode: 2,
    morphDurationSec: 3.0,
    morphCurveValue: 1,
    buildupIntensity: 1.0,
    dropDampening: 1.0,
    breakRestraint: 1.0,
    vocalHighlight: 1.0,
    fxChaos: 1.0,
    wormholeRadius: 1,
    wormholeDepth: 1,
    wormholeSpeed: 1,
    wormholeWarp: 1
};

export const visualTuningKeys = Object.keys(defaultVisualTuning) as VisualTuningKey[];

const allVisualTuningControls: VisualTuningControl[] = [
    { key: 'audioSensitivity', label: 'Music sensitivity', group: 'Audio', min: 0.1, max: 4, step: 0.05, unit: 'x' },
    { key: 'transitionSpeed', label: 'Morph speed', group: 'Audio', min: 0.01, max: 1, step: 0.01, unit: 'x' },
    { key: 'dynamicsThreshold', label: 'Dynamics Threshold', group: 'Audio', min: 0.1, max: 0.9, step: 0.02 },
    { key: 'dropThreshold', label: 'Drop Threshold', group: 'Audio', min: 0.1, max: 0.9, step: 0.02 },
    { key: 'dropAnticipation', label: 'Drop Anticipation', group: 'Audio', min: 0.0, max: 5.0, step: 0.1, unit: 's' },
    { key: 'phraseSize', label: 'Phrase Size', group: 'Audio', min: 4, max: 32, step: 4, unit: ' bars' },
    { key: 'morphDurationSec', label: 'Morph duration', group: 'Audio', min: 0.2, max: 30, step: 0.2, unit: 's' },
    {
        key: 'morphCurveValue',
        label: 'Morph curve',
        group: 'Audio',
        min: 0,
        max: 2,
        step: 1,
        options: [
            { value: 0, label: 'Linear' },
            { value: 1, label: 'Ease In Out' },
            { value: 2, label: 'Exponential' }
        ]
    },
    { key: 'buildupIntensity', label: 'Buildup reaction', group: 'Audio', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'dropDampening', label: 'Drop dampening', group: 'Audio', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'breakRestraint', label: 'Break restraint', group: 'Audio', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'vocalHighlight', label: 'Vocal highlight', group: 'Audio', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'fxChaos', label: 'FX chaos', group: 'Audio', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'chromaKeyMode', label: 'Chroma mode', group: 'Background', min: 0, max: 2, step: 1 },
    { key: 'performanceMode', label: 'Low latency', group: 'Background', min: 0, max: 1, step: 1 },
    { key: 'backgroundRed', label: 'Background red', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'backgroundGreen', label: 'Background green', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'backgroundBlue', label: 'Background blue', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'particleIdleSpeed', label: 'Idle speed', group: 'Particles', min: 0, max: 8, step: 0.05 },
    { key: 'particleEnergySpeed', label: 'Energy speed', group: 'Particles', min: 0, max: 80, step: 0.5 },
    { key: 'particleBeatSpeed', label: 'Beat impulse', group: 'Particles', min: 0, max: 180, step: 1 },
    { key: 'particleBoundaryPull', label: 'Center pull', group: 'Particles', min: 0, max: 1, step: 0.005 },
    { key: 'particleActivityTurn', label: 'Activity Turn', group: 'Particles', min: 0, max: 2, step: 0.01 },
    { key: 'shockwaveRadius', label: 'Circle size', group: 'Circles', min: 0.05, max: 12, step: 0.05, unit: 'x' },
    { key: 'shockwaveSpeed', label: 'Circle speed', group: 'Circles', min: 0, max: 12, step: 0.05, unit: 'x' },
    { key: 'shockwaveAlpha', label: 'Circle opacity', group: 'Circles', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'shockwaveThickness', label: 'Circle stroke', group: 'Circles', min: 0.05, max: 40, step: 0.05, unit: 'x' },
    { key: 'shockwaveExpansion', label: 'Circle expansion', group: 'Circles', min: 0, max: 0.5, step: 0.005 },
    { key: 'shockwaveDecay', label: 'Circle decay', group: 'Circles', min: 0.05, max: 50, step: 0.05 },
    { key: 'circleBackgroundHue', label: 'Circle bg hue', group: 'Circles', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'circleBackgroundAlpha', label: 'Circle bg opacity', group: 'Circles', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'circleHue', label: 'Circle hue', group: 'Circles', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'circleAlpha', label: 'Core opacity', group: 'Circles', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'circleSize', label: 'Core size', group: 'Circles', min: 0.05, max: 12, step: 0.05, unit: 'x' },
    { key: 'circleLineWeight', label: 'Ring stroke', group: 'Circles', min: 0.05, max: 40, step: 0.05, unit: 'x' },
    { key: 'lineHue', label: 'Line hue', group: 'Lines', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'lineAlpha', label: 'Line opacity', group: 'Lines', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'lineDistance', label: 'Line distance', group: 'Lines', min: 0.05, max: 8, step: 0.05, unit: 'x' },
    { key: 'lineWeight', label: 'Line stroke', group: 'Lines', min: 0.05, max: 30, step: 0.05, unit: 'x' },
    { key: 'polygonHue', label: 'Polygon hue', group: 'Polygons', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'polygonAlpha', label: 'Polygon opacity', group: 'Polygons', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'polygonSize', label: 'Polygon reach', group: 'Polygons', min: 0.05, max: 5, step: 0.05, unit: 'x' },
    { key: 'polygonFlash', label: 'Polygon flash', group: 'Polygons', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'temporalRingSize', label: 'Ring size', group: 'Temporal', min: 0.05, max: 10, step: 0.05, unit: 'x' },
    { key: 'temporalRingAlpha', label: 'Ring opacity', group: 'Temporal', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'temporalRingSpeed', label: 'Ring speed', group: 'Temporal', min: 0, max: 12, step: 0.05, unit: 'x' },
    { key: 'temporalNetworkDistance', label: 'Temporal links', group: 'Temporal', min: 0.05, max: 8, step: 0.05, unit: 'x' },
    { key: 'temporalPolygonAlpha', label: 'Temporal polys', group: 'Temporal', min: 0, max: 5, step: 0.05, unit: 'x' },
    { key: 'wormholeRadius', label: 'Tunnel radius', group: 'Wormhole', min: 0.1, max: 3, step: 0.1, unit: 'x' },
    { key: 'wormholeDepth', label: 'Tunnel depth', group: 'Wormhole', min: 0.1, max: 5, step: 0.1, unit: 'x' },
    { key: 'wormholeSpeed', label: 'Flight speed', group: 'Wormhole', min: 0.1, max: 10, step: 0.1, unit: 'x' },
    { key: 'wormholeWarp', label: 'Spiral warp', group: 'Wormhole', min: 0, max: 5, step: 0.1, unit: 'x' },
    { key: 'heroLaneBottomOffset', label: 'Lane from bottom', group: 'Hero', min: 0.05, max: 0.9, step: 0.01, unit: 'h' },
    { key: 'heroBeepVolume', label: 'Hero beep volume', group: 'Hero', min: 0, max: 1, step: 0.05 },
    {
        key: 'heroBeepMode',
        label: 'Hero beep mode',
        group: 'Hero',
        min: 0,
        max: 4,
        step: 1,
        options: [
            { value: 0, label: 'Off' },
            { value: 1, label: 'Quarter notes' },
            { value: 2, label: 'Off-beats' },
            { value: 3, label: 'Triplets' },
            { value: 4, label: 'Syncopated' }
        ]
    },
    {
        key: 'heroEventMode',
        label: 'Hero event mode',
        group: 'Hero',
        min: 0,
        max: 2,
        step: 1,
        options: [
            { value: 0, label: 'All audio events' },
            { value: 1, label: 'Audio drums only' },
            { value: 2, label: 'Metronome beeps only' }
        ]
    }
];

export const visualTuningControls: VisualTuningControl[] = featureFlags.heroEffect
    ? allVisualTuningControls
    : allVisualTuningControls.filter(control => control.group !== 'Hero');

export function cloneDefaultVisualTuning(): VisualTuningConfig {
    return { ...defaultVisualTuning };
}

export function normalizeVisualTuningConfig(payload: unknown, current?: VisualTuningConfig): VisualTuningConfig {
    const source = getVisualTuningSource(payload);
    const next = current ? { ...current } : cloneDefaultVisualTuning();
    const legacySource = source as (Partial<VisualTuningConfig> & { particleBassTurn?: unknown; heroDrumsOnly?: unknown }) | null;

    for (const key of visualTuningKeys) {
        const value = source?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            next[key] = value;
        }
    }

    if (source?.particleActivityTurn === undefined) {
        const legacyParticleActivityTurn = legacySource?.particleBassTurn;
        if (typeof legacyParticleActivityTurn === 'number' && Number.isFinite(legacyParticleActivityTurn)) {
            next.particleActivityTurn = legacyParticleActivityTurn;
        }
    }

    if (source?.heroEventMode === undefined) {
        const legacyHeroDrumsOnly = legacySource?.heroDrumsOnly;
        if (legacyHeroDrumsOnly === 0) next.heroEventMode = 0;
        else if (legacyHeroDrumsOnly === 1) next.heroEventMode = 1;
    }

    return next;
}

function getVisualTuningSource(payload: unknown): Partial<VisualTuningConfig> | null {
    if (!payload || typeof payload !== 'object') return null;

    const candidate = payload as { visualTuning?: unknown };
    const source = candidate.visualTuning && typeof candidate.visualTuning === 'object'
        ? candidate.visualTuning
        : payload;

    return source as Partial<VisualTuningConfig>;
}

export function tuneAudioValue(value: number, tuning: VisualTuningConfig): number {
    return Math.max(0, value * getAudioSensitivity(tuning));
}

export function tuneAudioFrame(frame: AudioFrame, tuning: VisualTuningConfig): AudioFrame {
    return {
        ...frame,
        e: tuneAudioValue(frame.e, tuning),
        densityProj: tuneAudioValue(frame.densityProj, tuning),
        melodyProj: tuneAudioValue(frame.melodyProj, tuning),
        fxProj: tuneAudioValue(frame.fxProj, tuning),
        eRatio: tuneAudioValue(frame.eRatio, tuning)
    };
}

export function tuneVisualFeatures(features: VisualFeatureFrame, tuning: VisualTuningConfig): VisualFeatureFrame {
    return {
        melody: tuneAudioValue(features.melody, tuning),
        vocal: tuneAudioValue(features.vocal, tuning),
        fx: tuneAudioValue(features.fx, tuning),
        density: tuneAudioValue(features.density, tuning),
        brightness: tuneAudioValue(features.brightness, tuning),
        tension: tuneAudioValue(features.tension, tuning)
    };
}

export function computeModulationBus(
    frame: AudioFrame,
    features: VisualFeatureFrame,
    beatDecay: number,
    cueDecay: number,
    tuning: VisualTuningConfig
): ModulationState {
    return writeModulationBus(
        {
            kineticTension: 0,
            densityDrive: 0,
            spectralChaos: 0,
            rhythmicImpulse: 0,
            macroMomentum: 0
        },
        frame,
        features,
        beatDecay,
        cueDecay,
        tuning
    );
}

export function writeModulationBus(
    target: ModulationState,
    frame: AudioFrame,
    features: VisualFeatureFrame,
    beatDecay: number,
    cueDecay: number,
    tuning: VisualTuningConfig
): ModulationState {
    const sensitivity = getAudioSensitivity(tuning);
    const vocalHighlight = getProfileScale(tuning.vocalHighlight);
    const fxChaos = getProfileScale(tuning.fxChaos);

    target.kineticTension = scaleUnit(
        features.vocal * 0.28 * vocalHighlight +
        features.melody * 0.22 +
        features.tension * 0.32 +
        cueDecay * 0.18,
        sensitivity
    );
    target.densityDrive = scaleUnit(
        frame.densityProj * 0.62 +
        features.density * 0.24 +
        frame.e * 0.14,
        sensitivity
    );
    target.spectralChaos = scaleUnit(
        frame.fxProj * 0.42 +
        features.fx * 0.36 * fxChaos +
        features.brightness * 0.22,
        sensitivity
    );
    target.rhythmicImpulse = scaleUnit(
        Math.max(beatDecay, cueDecay * 0.65),
        sensitivity
    );
    target.macroMomentum = scaleUnit(
        frame.eRatio * 0.58 +
        frame.e * 0.24 +
        features.density * 0.18,
        sensitivity
    );
    return target;
}

export function applyTuningMorph(
    current: VisualTuningConfig,
    target: VisualTuningConfig,
    transitionSpeed = target.transitionSpeed
): VisualTuningConfig {
    const speed = getCurvedMorphStep(target, transitionSpeed);

    for (const key of visualTuningKeys) {
        const currentValue = current[key];
        const targetValue = target[key];
        if (typeof currentValue !== 'number' || typeof targetValue !== 'number') continue;

        // JAVÍTVA: A diszkrét (egész) beállításokat ne interpoláljuk, hanem azonnal pattintsuk be,
        // különben a lebegőpontos értékek érvénytelenítik a háttér és a teljesítmény-mód feltételeit.
        if (key === 'chromaKeyMode' || key === 'performanceMode' || key === 'phraseSize'
            || key === 'morphCurveValue' || key === 'heroEventMode' || key === 'heroBeepMode') {
            current[key] = targetValue;
            continue;
        }

        if (speed >= 1) {
            current[key] = targetValue;
            continue;
        }

        const next = currentValue + (targetValue - currentValue) * speed;
        current[key] = clampBetween(next, currentValue, targetValue);
    }

    return current;
}

function getCurvedMorphStep(target: VisualTuningConfig, transitionSpeed: number): number {
    const rawSpeed = Number.isFinite(transitionSpeed) ? transitionSpeed : defaultVisualTuning.transitionSpeed;
    const duration = Number.isFinite(target.morphDurationSec) ? Math.max(0.2, target.morphDurationSec) : defaultVisualTuning.morphDurationSec;
    const durationScale = defaultVisualTuning.morphDurationSec / duration;
    const normalized = clamp01(rawSpeed * durationScale);
    return applyMorphCurve(normalized, target.morphCurveValue);
}

function applyMorphCurve(t: number, curveValue: number): number {
    const curve = Math.round(Number.isFinite(curveValue) ? curveValue : defaultVisualTuning.morphCurveValue);
    if (curve <= 0) return t;
    if (curve >= 2) return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export interface BackgroundClearStyle {
    r: number;
    g: number;
    b: number;
    a: number;
}

export function getBackgroundClearStyle(tuning: VisualTuningConfig, flash = 0): BackgroundClearStyle {
    if (tuning.chromaKeyMode === 2) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (tuning.chromaKeyMode === 1) {
        return { r: 0, g: 255, b: 0, a: 255 };
    }

    return {
        r: Math.min(tuning.backgroundRed + flash, 255),
        g: Math.min(tuning.backgroundGreen + flash, 255),
        b: Math.min(tuning.backgroundBlue + flash, 255),
        a: 255
    };
}

export function shouldUseExpensiveGlow(tuning: VisualTuningConfig): boolean {
    return tuning.performanceMode < 0.5 && tuning.chromaKeyMode === 0;
}

function getAudioSensitivity(tuning: VisualTuningConfig): number {
    return Number.isFinite(tuning.audioSensitivity) ? tuning.audioSensitivity : 1;
}

function getProfileScale(value: number): number {
    return Number.isFinite(value) ? value : 1;
}

function scaleUnit(value: number, sensitivity: number): number {
    return clamp01(value * sensitivity);
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampBetween(value: number, a: number, b: number): number {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return Math.min(max, Math.max(min, value));
}

export function hueToRgb(hue: number, saturation = 0.72, lightness = 0.68): [number, number, number] {
    return hueToRgbInto([0, 0, 0], hue, saturation, lightness);
}

export function hueToRgbInto(target: [number, number, number], hue: number, saturation = 0.72, lightness = 0.68): [number, number, number] {
    let h = ((hue % 360) + 360) % 360 / 360;
    let q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    let p = 2 * lightness - q;
    let convert = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    target[0] = Math.round(convert(h + 1 / 3) * 255);
    target[1] = Math.round(convert(h) * 255);
    target[2] = Math.round(convert(h - 1 / 3) * 255);
    return target;
}
