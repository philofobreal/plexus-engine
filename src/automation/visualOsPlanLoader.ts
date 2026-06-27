import type { PerformanceAutomationPlan, StylePacksFile, TrackAnalysis } from '../types';
import { buildVisualOsPerformancePlan, type VisualOsPlanOptions } from './visualOsPlanner';

// visualOsPlanLoader - the IO boundary for the Visual OS V2 pipeline (ADR-005, Phase 4).
// It loads public/visual-tuning-presets/style-packs.json (unless one is injected) and runs
// the pure planner. It FAILS SAFE: any error (network, parse, unresolvable pack) returns
// null so the caller falls back to the legacy generatePerformancePlan. Kept separate from
// visualOsPlanner so the planner stays pure and testable without fetch/import.meta.

export async function generateVisualOsPerformancePlan(
    trackAnalysis: TrackAnalysis,
    options: VisualOsPlanOptions = {}
): Promise<PerformanceAutomationPlan | null> {
    try {
        const file = options.stylePacksFile ?? await loadStylePacksFile();
        if (!file) return null;
        return buildVisualOsPerformancePlan(trackAnalysis, file, options);
    } catch {
        return null;
    }
}

export async function loadStylePacksFile(): Promise<StylePacksFile | null> {
    try {
        const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
        const response = await fetch(`${baseUrl}visual-tuning-presets/style-packs.json`);
        if (!response.ok) return null;
        const parsed = await response.json();
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.packs)) return null;
        return parsed as StylePacksFile;
    } catch {
        return null;
    }
}
