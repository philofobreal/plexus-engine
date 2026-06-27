export type NarrativeState = 'EXPOSITION' | 'DEVELOPMENT' | 'TENSION_PEAK' | 'RELEASE_VALLEY' | 'CODA';
export type VisualIntentType = 'AGGRESSIVE_EXPANSION' | 'CONTROLLED_STASIS' | 'TENSION_COMPRESSION' | 'ENTROPIC_RELEASE' | 'FLOWING_CONTINUITY';
export type PatternPrimitive = 'CLUSTER' | 'FLOW' | 'EXPLOSION' | 'ORBIT' | 'GRID';
export type ChoreographyAction = 'PULSE' | 'EXPAND' | 'COLLAPSE' | 'ORBIT' | 'JITTER' | 'FLOW' | 'GRID_LOCK';

export interface VariationModel {
    seed: number;
    phraseIndex: number;
    variationIndex: number;
}

export interface ChoreographyFrame {
    timeSec: number;
    durationSec: number;
    beatIndex?: number;
    narrativeState: NarrativeState;
    primaryPattern: PatternPrimitive;
    actions: Partial<Record<ChoreographyAction, number>>;
    motion: { speed: number; complexity: number; variation: VariationModel };
    rhythmicLink?: {
        source: 'KICK' | 'SNARE' | 'OFFBEAT' | 'BAR' | 'NONE';
        reaction: 'IMPULSE' | 'IMPULSE_REVERSE' | 'ACCENT' | 'SUPPRESS';
        strength: number;
    };
    transition?: { type: 'CUT' | 'MORPH' | 'DISSOLVE' | 'INVERT'; durationSec: number };
    confidence: number;
}

export interface VisualScorePlan {
    version: '1.0';
    trackHash: string;
    frames: ChoreographyFrame[];
}
