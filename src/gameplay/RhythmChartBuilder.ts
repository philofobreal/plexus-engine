// Deterministic mapping of published percussive events, without invented grid-only notes.
import type { BeatEvent, PerformanceAutomationPlan, TrackSection } from '../types';
import { choreographRhythmChart } from './RhythmScorePlanner';
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import type { RhythmNote } from './RhythmTypes';
import { normalizeGenerationSettings, playSpaceConfig, type RhythmGenerationSettings } from './RhythmGenerationProfile';
import { guardRhythmMovement, mirrorRhythmChart } from './RhythmMovement';

export interface RhythmChartSource {
    readonly events: readonly BeatEvent[];
    readonly durationSec: number;
    /** Retained source contract; a grid alone is not evidence of an audible onset. */
    readonly beats: readonly number[];
    readonly barStarts?: readonly number[];
    readonly timingConfidence?: number;
    readonly performancePlan?: PerformanceAutomationPlan;
    /**
     * Published section start times (analyzer sections, plain data). Only Ultra reads them: it
     * leaves a short silence before every section change, together with the section gate.
     */
    readonly sectionStarts?: readonly number[];
    /** Published intervals shape the opt-in musical profile; they never supply note times. */
    readonly sections?: readonly Pick<TrackSection, 'start' | 'end' | 'label'>[];
}

/**
 * Same source, config and settings always yield a byte-identical chart. The play space adapts the
 * row spacing the planner reasons with (Standard leaves `config` untouched).
 */
export function buildRhythmChart(source: RhythmChartSource,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, settings?: Partial<RhythmGenerationSettings>): RhythmNote[] {
    if (!Number.isFinite(source.durationSec) || source.durationSec <= 0) return [];
    const normalized = normalizeGenerationSettings(settings);
    const mirrored = normalized.motionSafety === 'guarded' && normalized.handLead === 'right';
    const canonical = mirrored ? { ...normalized, handLead: 'left' as const } : normalized;
    const chart = choreographRhythmChart(source, playSpaceConfig(config, normalized.playSpace), canonical);
    if (normalized.motionSafety !== 'guarded') return chart;
    const guarded = guardRhythmMovement(chart, config, canonical).chart;
    return mirrored ? mirrorRhythmChart(guarded) : guarded;
}

