// Deterministic mapping of published percussive events, without invented grid-only notes.
import type { BeatEvent, PerformanceAutomationPlan } from '../types';
import { choreographRhythmChart } from './RhythmScorePlanner';
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import type { RhythmNote } from './RhythmTypes';
import { normalizeGenerationSettings, type RhythmGenerationSettings } from './RhythmGenerationProfile';

export interface RhythmChartSource {
    readonly events: readonly BeatEvent[];
    readonly durationSec: number;
    /** Retained source contract; a grid alone is not evidence of an audible onset. */
    readonly beats: readonly number[];
    readonly barStarts?: readonly number[];
    readonly timingConfidence?: number;
    readonly performancePlan?: PerformanceAutomationPlan;
}

/** Same source, config and settings always yield a byte-identical chart. */
export function buildRhythmChart(source: RhythmChartSource,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, settings?: Partial<RhythmGenerationSettings>): RhythmNote[] {
    if (!Number.isFinite(source.durationSec) || source.durationSec <= 0) return [];
    return choreographRhythmChart(source, config, normalizeGenerationSettings(settings));
}

