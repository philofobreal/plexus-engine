import type {
    ChoreographyAction,
    ChoreographyFrame,
    TransitionBehavior,
    VisualMode,
    VisualMotif,
    VisualTuningConfig
} from '../types';
import {
    cloneDefaultVisualTuning,
    visualTuningControls,
    visualTuningKeys,
    type VisualTuningKey
} from '../config/visualTuning';

// SemanticResolver — resolves an abstract ChoreographyFrame into concrete tuning
// parameters for the renderer (ADR-003). Per the locked boundary it produces ONLY a
// VisualTuningConfig (the target the renderer morphs toward). It never touches the
// modulation bus or directorOutput, which remain owned by VisualDirectorFSM.
//
// This module is pure and deterministic: same (choreography, style, presets) -> same
// output. It is the one part of the semantic chain meant to run per frame, so it stays
// O(actions) with a single clamp pass and no allocation-heavy work.
//
// The point of the layer: each style reinterprets the SAME abstract action. `bloom`
// thickens cyberpunk lines and flashes polygons, but swells organic-ambient circles and
// warps the cosmic-wormhole tunnel. Style-agnostic deltas express the shared gesture;
// per-style deltas add the style's own vocabulary on top.

interface ParamDelta {
    key: VisualTuningKey;
    amount: number; // additive delta applied at action intensity 1.0
}

type ActionDeltas = Partial<Record<ChoreographyAction, ParamDelta[]>>;
type MotifDeltas = Record<VisualMotif, ParamDelta[]>;

// Shared interpretation applied for every style.
const BASE_DELTAS: ActionDeltas = {
    bloom: [{ key: 'polygonFlash', amount: 2.0 }, { key: 'lineAlpha', amount: 0.8 }],
    pulse: [{ key: 'polygonFlash', amount: 1.2 }, { key: 'circleAlpha', amount: 0.6 }],
    expand: [{ key: 'lineDistance', amount: 1.5 }, { key: 'polygonSize', amount: 0.8 }],
    collapse: [{ key: 'lineDistance', amount: -1.2 }, { key: 'polygonSize', amount: -0.5 }],
    densify: [{ key: 'particleEnergySpeed', amount: 25 }, { key: 'lineAlpha', amount: 0.5 }],
    thin: [{ key: 'particleEnergySpeed', amount: -15 }, { key: 'lineAlpha', amount: -0.4 }],
    accelerate: [{ key: 'particleBeatSpeed', amount: 60 }, { key: 'particleEnergySpeed', amount: 15 }],
    slow: [{ key: 'particleBeatSpeed', amount: -40 }, { key: 'particleEnergySpeed', amount: -10 }],
    orbit: [{ key: 'particleActivityTurn', amount: 0.4 }],
    scatter: [{ key: 'particleBoundaryPull', amount: -0.2 }, { key: 'lineDistance', amount: 0.8 }],
    focus: [{ key: 'particleBoundaryPull', amount: 0.3 }, { key: 'lineDistance', amount: -0.6 }],
    fragment: [{ key: 'polygonAlpha', amount: 0.8 }, { key: 'lineWeight', amount: 1.5 }],
    merge: [{ key: 'polygonAlpha', amount: -0.5 }, { key: 'lineDistance', amount: -0.5 }],
    freeze: [{ key: 'particleEnergySpeed', amount: -20 }, { key: 'particleBeatSpeed', amount: -50 }],
    echo: [{ key: 'shockwaveAlpha', amount: 0.5 }, { key: 'shockwaveExpansion', amount: 0.1 }]
};

const MOTIF_DELTAS: MotifDeltas = {
    'pulse-field': [{ key: 'circleAlpha', amount: 0.55 }, { key: 'shockwaveAlpha', amount: 0.35 }],
    'orbit-system': [{ key: 'wormholeCurve', amount: 0.25 }, { key: 'particleActivityTurn', amount: 0.45 }, { key: 'temporalRingSize', amount: 0.8 }, { key: 'lineDistance', amount: 0.35 }],
    'tunnel-drive': [{ key: 'wormholeSpeed', amount: 1.8 }, { key: 'wormholeDepth', amount: 0.7 }, { key: 'particleBeatSpeed', amount: 35 }],
    'network-bloom': [{ key: 'lineDistance', amount: 1.1 }, { key: 'circleSize', amount: 1.1 }, { key: 'polygonAlpha', amount: 0.75 }, { key: 'temporalPolygonAlpha', amount: 0.65 }, { key: 'audioSensitivity', amount: 0.35 }],
    'fragment-cloud': [{ key: 'polygonAlpha', amount: 0.95 }, { key: 'polygonFlash', amount: 0.7 }, { key: 'lineWeight', amount: 1.2 }, { key: 'temporalPolygonAlpha', amount: 0.8 }],
    'wave-ripple': [{ key: 'shockwaveRadius', amount: 1.2 }, { key: 'shockwaveExpansion', amount: 0.2 }, { key: 'temporalRingAlpha', amount: 0.5 }],
    'grid-scan': [{ key: 'temporalNetworkDistance', amount: 0.9 }, { key: 'lineAlpha', amount: 0.45 }, { key: 'particleActivityTurn', amount: 0.2 }],
    'halo-focus': [{ key: 'circleSize', amount: 0.65 }, { key: 'circleAlpha', amount: 0.7 }, { key: 'particleBoundaryPull', amount: 0.25 }],
    'swarm-motion': [{ key: 'particleEnergySpeed', amount: 18 }, { key: 'particleActivityTurn', amount: 0.55 }, { key: 'lineDistance', amount: 0.5 }],
    'void-minimal': [{ key: 'lineAlpha', amount: -0.75 }, { key: 'particleEnergySpeed', amount: -20 }, { key: 'particleBeatSpeed', amount: -30 }, { key: 'audioSensitivity', amount: -0.35 }]
};

const TRANSITION_DELTAS: Partial<Record<TransitionBehavior, ParamDelta[]>> = {
    morph: [{ key: 'transitionSpeed', amount: -0.05 }],
    handoff: [{ key: 'transitionSpeed', amount: -0.12 }],
    'echo-out': [{ key: 'shockwaveAlpha', amount: 0.45 }, { key: 'lineAlpha', amount: -0.35 }],
    dissolve: [{ key: 'lineAlpha', amount: -0.6 }, { key: 'polygonAlpha', amount: -0.4 }],
    overlay: [{ key: 'lineDistance', amount: 0.25 }, { key: 'circleAlpha', amount: 0.2 }],
    'freeze-cut': [{ key: 'particleEnergySpeed', amount: -18 }, { key: 'polygonFlash', amount: 1.2 }],
    snap: [{ key: 'transitionSpeed', amount: 0.7 }, { key: 'polygonFlash', amount: 0.9 }],
    'phase-shift': [{ key: 'particleActivityTurn', amount: 0.45 }, { key: 'temporalRingSpeed', amount: 1.1 }]
};

// Per-style reinterpretation layered on top of the shared deltas.
const STYLE_DELTAS: Partial<Record<VisualMode, ActionDeltas>> = {
    cyberpunk: {
        bloom: [{ key: 'lineWeight', amount: 4 }, { key: 'polygonFlash', amount: 1.5 }],
        fragment: [{ key: 'polygonFlash', amount: 1.0 }]
    },
    'organic-ambient': {
        bloom: [{ key: 'circleSize', amount: 1.5 }, { key: 'shockwaveRadius', amount: 2 }],
        expand: [{ key: 'shockwaveRadius', amount: 1.5 }]
    },
    'cosmic-wormhole': {
        expand: [{ key: 'wormholeRadius', amount: 0.8 }, { key: 'wormholeDepth', amount: 1 }],
        accelerate: [{ key: 'wormholeSpeed', amount: 3 }],
        densify: [{ key: 'wormholeStarfield', amount: 0.8 }],
        bloom: [{ key: 'wormholeWarp', amount: 1.5 }]
    }
};

// Control bounds, indexed once. Any key the resolver writes is clamped to these.
const CONTROL_BOUNDS: Map<VisualTuningKey, { min: number; max: number }> = new Map(
    visualTuningControls.map(control => [control.key, { min: control.min, max: control.max }])
);

export function resolveSemanticState(
    choreography: ChoreographyFrame | null,
    style: VisualMode,
    presets: Record<string, Partial<VisualTuningConfig>>
): VisualTuningConfig {
    const out = resolveBaseTuning(style, presets);

    // Empty / incomplete choreography is a valid steady state: return the clamped base.
    const actions = choreography?.actions ?? {};

    applyActionDeltas(out, BASE_DELTAS, actions);
    applyMotifDeltas(out, choreography);
    if (choreography?.transition) applyTransitionDeltas(out, choreography.transition.behavior, choreography.transition.progress);
    const styleDeltas = STYLE_DELTAS[style];
    if (styleDeltas) applyActionDeltas(out, styleDeltas, actions);

    clampToControls(out);
    return out;
}

function applyMotifDeltas(target: VisualTuningConfig, frame: ChoreographyFrame | null): void {
    if (!frame) return;
    const scale = motifScale(frame);
    const transition = frame.transition;
    if (transition?.fromMotif && transition.toMotif) {
        const progress = unit(transition.progress, 0);
        applyParamDeltas(target, MOTIF_DELTAS[transition.fromMotif], scale * (1 - progress));
        applyParamDeltas(target, MOTIF_DELTAS[transition.toMotif], scale * progress);
        return;
    }
    if (frame.motif) applyParamDeltas(target, MOTIF_DELTAS[frame.motif], scale);
}

function motifScale(frame: ChoreographyFrame): number {
    const intensity = unit(frame.motifIntensity, 1);
    const density = unit(frame.motifDensity, 0);
    const motion = unit(frame.motifMotion, 0);
    const novelty = unit(frame.novelty, 0);
    return intensity * 0.45 + density * 0.25 + motion * 0.2 + novelty * 0.1;
}

function unit(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;
}

function applyTransitionDeltas(target: VisualTuningConfig, behavior: TransitionBehavior, progress: number): void {
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    if (behavior === 'collapse-release') {
        if (p < 0.5) {
            applyParamDeltas(target, [
                { key: 'lineDistance', amount: -1.2 },
                { key: 'particleEnergySpeed', amount: -18 },
                { key: 'circleSize', amount: -0.5 }
            ], 1 - p * 2);
        } else {
            applyParamDeltas(target, [
                { key: 'lineDistance', amount: 1.4 },
                { key: 'circleSize', amount: 1.1 },
                { key: 'polygonFlash', amount: 1.5 },
                { key: 'particleEnergySpeed', amount: 22 }
            ], (p - 0.5) * 2);
        }
        return;
    }
    applyParamDeltas(target, TRANSITION_DELTAS[behavior], behavior === 'echo-out' || behavior === 'dissolve' ? 1 - p : p);
}

function applyParamDeltas(target: VisualTuningConfig, deltas: ParamDelta[] | undefined, scale: number): void {
    if (!deltas) return;
    for (const { key, amount } of deltas) target[key] += amount * scale;
}

// A complete, numeric base: start from engine defaults and overlay a provided preset for
// this style (or a generic default). This keeps the resolver safe even if `presets` is
// empty or a supplied preset is missing keys.
function resolveBaseTuning(style: VisualMode, presets: Record<string, Partial<VisualTuningConfig>>): VisualTuningConfig {
    const base = cloneDefaultVisualTuning();
    const provided = presets?.[style] ?? presets?.default ?? presets?.['default.json'];
    if (provided && typeof provided === 'object') {
        for (const key of visualTuningKeys) {
            const value = provided[key];
            if (typeof value === 'number' && Number.isFinite(value)) base[key] = value;
        }
    }
    return base;
}

function applyActionDeltas(
    target: VisualTuningConfig,
    deltas: ActionDeltas,
    actions: Partial<Record<ChoreographyAction, number>>
): void {
    for (const action of Object.keys(actions) as ChoreographyAction[]) {
        const intensity = actions[action];
        if (typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity <= 0) continue;
        const paramDeltas = deltas[action];
        if (!paramDeltas) continue;
        for (const { key, amount } of paramDeltas) {
            target[key] += amount * intensity;
        }
    }
}

function clampToControls(target: VisualTuningConfig): void {
    for (const key of visualTuningKeys) {
        const bounds = CONTROL_BOUNDS.get(key);
        const value = target[key];
        if (!Number.isFinite(value)) {
            target[key] = bounds ? bounds.min : 0;
            continue;
        }
        if (bounds) target[key] = Math.max(bounds.min, Math.min(bounds.max, value));
    }
}
