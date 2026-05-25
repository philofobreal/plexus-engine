import type { VisualTuningConfig } from '../types';

export type VisualTuningKey = keyof VisualTuningConfig;

export interface VisualTuningControl {
    key: VisualTuningKey;
    label: string;
    group: 'Particles' | 'Circles' | 'Lines' | 'Polygons' | 'Temporal';
    min: number;
    max: number;
    step: number;
    unit?: string;
}

export const defaultVisualTuning: VisualTuningConfig = {
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
    { key: 'particleIdleSpeed', label: 'Idle speed', group: 'Particles', min: 0, max: 2, step: 0.05 },
    { key: 'particleEnergySpeed', label: 'Energy speed', group: 'Particles', min: 0, max: 20, step: 0.25 },
    { key: 'particleBeatSpeed', label: 'Beat impulse', group: 'Particles', min: 0, max: 50, step: 0.5 },
    { key: 'particleBoundaryPull', label: 'Center pull', group: 'Particles', min: 0, max: 0.2, step: 0.005 },
    { key: 'particleBassTurn', label: 'Bass turn', group: 'Particles', min: 0, max: 0.4, step: 0.01 },
    { key: 'shockwaveRadius', label: 'Circle size', group: 'Circles', min: 0.2, max: 3, step: 0.05, unit: 'x' },
    { key: 'shockwaveSpeed', label: 'Circle speed', group: 'Circles', min: 0.2, max: 3, step: 0.05, unit: 'x' },
    { key: 'shockwaveAlpha', label: 'Circle opacity', group: 'Circles', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'shockwaveThickness', label: 'Circle stroke', group: 'Circles', min: 0.2, max: 5, step: 0.05, unit: 'x' },
    { key: 'shockwaveExpansion', label: 'Circle expansion', group: 'Circles', min: 0, max: 0.12, step: 0.005 },
    { key: 'shockwaveDecay', label: 'Circle decay', group: 'Circles', min: 0.5, max: 14, step: 0.25 },
    { key: 'circleHue', label: 'Circle hue', group: 'Circles', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'circleAlpha', label: 'Core opacity', group: 'Circles', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'circleSize', label: 'Core size', group: 'Circles', min: 0.2, max: 3, step: 0.05, unit: 'x' },
    { key: 'circleLineWeight', label: 'Ring stroke', group: 'Circles', min: 0.2, max: 4, step: 0.05, unit: 'x' },
    { key: 'lineHue', label: 'Line hue', group: 'Lines', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'lineAlpha', label: 'Line opacity', group: 'Lines', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'lineDistance', label: 'Line distance', group: 'Lines', min: 0.4, max: 2.4, step: 0.05, unit: 'x' },
    { key: 'lineWeight', label: 'Line stroke', group: 'Lines', min: 0.1, max: 5, step: 0.05, unit: 'x' },
    { key: 'polygonHue', label: 'Polygon hue', group: 'Polygons', min: 0, max: 360, step: 1, unit: 'deg' },
    { key: 'polygonAlpha', label: 'Polygon opacity', group: 'Polygons', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'polygonSize', label: 'Polygon reach', group: 'Polygons', min: 0.2, max: 1.3, step: 0.05, unit: 'x' },
    { key: 'polygonFlash', label: 'Polygon flash', group: 'Polygons', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'temporalRingSize', label: 'Ring size', group: 'Temporal', min: 0.2, max: 2.5, step: 0.05, unit: 'x' },
    { key: 'temporalRingAlpha', label: 'Ring opacity', group: 'Temporal', min: 0, max: 2, step: 0.05, unit: 'x' },
    { key: 'temporalRingSpeed', label: 'Ring speed', group: 'Temporal', min: 0, max: 3, step: 0.05, unit: 'x' },
    { key: 'temporalNetworkDistance', label: 'Temporal links', group: 'Temporal', min: 0.4, max: 2.4, step: 0.05, unit: 'x' },
    { key: 'temporalPolygonAlpha', label: 'Temporal polys', group: 'Temporal', min: 0, max: 2, step: 0.05, unit: 'x' }
];

export function cloneDefaultVisualTuning(): VisualTuningConfig {
    return { ...defaultVisualTuning };
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
