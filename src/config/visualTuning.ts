import type { AudioFrame, VisualFeatureFrame, VisualTuningConfig } from '../types';

export type VisualTuningKey = keyof VisualTuningConfig;

export interface VisualTuningControl {
    key: VisualTuningKey;
    label: string;
    group: 'Audio' | 'Background' | 'Particles' | 'Circles' | 'Lines' | 'Polygons' | 'Temporal';
    min: number;
    max: number;
    step: number;
    unit?: string;
}

export const defaultVisualTuning: VisualTuningConfig = {
    audioSensitivity: 1,
    backgroundRed: 8,
    backgroundGreen: 5,
    backgroundBlue: 14,
    particleIdleSpeed: 0.2,
    particleEnergySpeed: 8,
    particleBeatSpeed: 20,
    particleBoundaryPull: 0.05,
    particleBassTurn: 0.1,
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
    temporalPolygonAlpha: 1
};

export const visualTuningControls: VisualTuningControl[] = [
    { key: 'audioSensitivity', label: 'Music sensitivity', group: 'Audio', min: 0.1, max: 4, step: 0.05, unit: 'x' },
    { key: 'backgroundRed', label: 'Background red', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'backgroundGreen', label: 'Background green', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'backgroundBlue', label: 'Background blue', group: 'Background', min: 0, max: 255, step: 1 },
    { key: 'particleIdleSpeed', label: 'Idle speed', group: 'Particles', min: 0, max: 8, step: 0.05 },
    { key: 'particleEnergySpeed', label: 'Energy speed', group: 'Particles', min: 0, max: 80, step: 0.5 },
    { key: 'particleBeatSpeed', label: 'Beat impulse', group: 'Particles', min: 0, max: 180, step: 1 },
    { key: 'particleBoundaryPull', label: 'Center pull', group: 'Particles', min: 0, max: 1, step: 0.005 },
    { key: 'particleBassTurn', label: 'Bass turn', group: 'Particles', min: 0, max: 2, step: 0.01 },
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
    { key: 'temporalPolygonAlpha', label: 'Temporal polys', group: 'Temporal', min: 0, max: 5, step: 0.05, unit: 'x' }
];

export function cloneDefaultVisualTuning(): VisualTuningConfig {
    return { ...defaultVisualTuning };
}

export function normalizeVisualTuningConfig(payload: unknown): VisualTuningConfig {
    const source = getVisualTuningSource(payload);
    const next = cloneDefaultVisualTuning();

    for (const key of Object.keys(defaultVisualTuning) as VisualTuningKey[]) {
        const value = source?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            next[key] = value;
        }
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
        b: tuneAudioValue(frame.b, tuning),
        m: tuneAudioValue(frame.m, tuning),
        t: tuneAudioValue(frame.t, tuning),
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

function getAudioSensitivity(tuning: VisualTuningConfig): number {
    return Number.isFinite(tuning.audioSensitivity) ? tuning.audioSensitivity : 1;
}

export function hueToRgb(hue: number, saturation = 0.72, lightness = 0.68): [number, number, number] {
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

    return [
        Math.round(convert(h + 1 / 3) * 255),
        Math.round(convert(h) * 255),
        Math.round(convert(h - 1 / 3) * 255)
    ];
}
