import type {
    ChoreographyAction,
    NarrativeState,
    PatternPrimitive,
    VisualTuningConfig
} from '../types';

export interface SemanticStyleInput {
    narrativeState: NarrativeState;
    primaryPattern: PatternPrimitive;
    actions: Readonly<Record<ChoreographyAction, number>>;
    motion: Readonly<{ speed: number; complexity: number }>;
    confidence: number;
}

export interface SemanticStyleMapper {
    map(input: SemanticStyleInput): Partial<VisualTuningConfig>;
}

type TuningDeltas = Partial<VisualTuningConfig>;

const NARRATIVE_DELTAS: Record<NarrativeState, TuningDeltas> = {
    EXPOSITION: { lineAlpha: -0.25, particleEnergySpeed: -8 },
    DEVELOPMENT: { lineDistance: 0.25, particleEnergySpeed: 4 },
    TENSION_PEAK: { audioSensitivity: 0.35, lineWeight: 0.6, particleBeatSpeed: 18 },
    RELEASE_VALLEY: { shockwaveRadius: 0.7, lineAlpha: -0.15, particleEnergySpeed: -5 },
    CODA: { lineAlpha: -0.4, circleAlpha: -0.25, particleEnergySpeed: -10 }
};

const ACTION_DELTAS: Record<ChoreographyAction, TuningDeltas> = {
    PULSE: { shockwaveAlpha: 0.7, circleAlpha: 0.45 },
    EXPAND: { lineDistance: 1.2, polygonSize: 0.65 },
    COLLAPSE: { lineDistance: -1, polygonSize: -0.45 },
    ORBIT: { particleActivityTurn: 0.4, temporalRingSpeed: 0.7 },
    JITTER: { particleBeatSpeed: 24, fxChaos: 0.45 },
    FLOW: { particleEnergySpeed: 14, wormholeCurve: 0.2 },
    GRID_LOCK: { temporalNetworkDistance: 0.8, particleBoundaryPull: 0.25 }
};

/** Default style-neutral projection from semantic intent to additive tuning deltas. */
export class NeutralSemanticStyleMapper implements SemanticStyleMapper {
    map(input: SemanticStyleInput): Partial<VisualTuningConfig> {
        const output: TuningDeltas = { ...NARRATIVE_DELTAS[input.narrativeState] };
        for (const action of Object.keys(input.actions) as ChoreographyAction[]) {
            const intensity = finiteOrZero(input.actions[action]);
            if (intensity === 0) continue;
            mergeScaled(output, ACTION_DELTAS[action], intensity);
        }

        const confidence = clamp01(input.confidence);
        add(output, 'transitionSpeed', finiteOrZero(input.motion.speed) * 0.04 * confidence);
        add(output, 'particleActivityTurn', finiteOrZero(input.motion.complexity) * 0.08 * confidence);
        return output;
    }
}

function mergeScaled(target: TuningDeltas, source: TuningDeltas, scale: number): void {
    for (const key of Object.keys(source) as Array<keyof VisualTuningConfig>) {
        add(target, key, (source[key] ?? 0) * scale);
    }
}

function add(target: TuningDeltas, key: keyof VisualTuningConfig, value: number): void {
    target[key] = (target[key] ?? 0) + value;
}

function finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, finiteOrZero(value)));
}
