// Deterministic mapping of published percussive events, without invented grid-only notes.
import type { BeatEvent, PerformanceAutomationPlan, TrackSection } from '../types';
import { choreographRhythmChart } from './RhythmScorePlanner';
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import type { RhythmNote } from './RhythmTypes';
import { normalizeGenerationSettings, playSpaceConfig, type RhythmGenerationSettings } from './RhythmGenerationProfile';
import { guardRhythmMovement, mirrorRhythmChart } from './RhythmMovement';
import { RhythmChartTrace, type RhythmChartDiagnostics } from './RhythmChartDiagnostics';

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
    return build(source, config, settings).chart;
}

/** Same pipeline and final chart, with one decision for every original source event. */
export function buildRhythmChartWithDiagnostics(source: RhythmChartSource,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, settings?: Partial<RhythmGenerationSettings>): {
        chart: RhythmNote[]; diagnostics: RhythmChartDiagnostics;
    } {
    const trace = new RhythmChartTrace(source.events);
    const result = build(source, config, settings, trace);
    return { chart: result.chart, diagnostics: trace.finish(result.chart, result.revoicedNotes) };
}

function build(source: RhythmChartSource, config: RhythmGameConfig, settings?: Partial<RhythmGenerationSettings>,
    trace?: RhythmChartTrace): { chart: RhythmNote[]; revoicedNotes: number } {
    if (!Number.isFinite(source.durationSec) || source.durationSec <= 0) {
        if (trace) source.events.forEach((_, index) => trace.reject(index, 'invalid-duration'));
        return { chart: [], revoicedNotes: 0 };
    }
    const normalized = normalizeGenerationSettings(settings);
    const mirrored = normalized.motionSafety === 'guarded' && normalized.handLead === 'right';
    const canonical = mirrored ? { ...normalized, handLead: 'left' as const } : normalized;
    const chart = choreographRhythmChart(source, playSpaceConfig(config, normalized.playSpace), canonical, trace);
    if (normalized.motionSafety !== 'guarded') return { chart, revoicedNotes: 0 };
    const guarded = guardRhythmMovement(chart, config, canonical,
        trace ? (notes, issues, revoiced) => trace.movementDecision(notes, issues, revoiced) : undefined);
    return { chart: mirrored ? mirrorRhythmChart(guarded.chart) : guarded.chart, revoicedNotes: guarded.revoicedNotes };
}

