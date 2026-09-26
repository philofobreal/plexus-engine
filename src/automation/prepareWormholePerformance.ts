import type { PerformanceAutomationPlan, TrackAnalysis } from '../types';
import { featureFlags } from '../config/featureFlags';
import { generateVisualOsPerformancePlan } from './visualOsPlanLoader';
import { generatePerformancePlan } from './performancePlanGenerator';

/** One offline plan shared by the XR score and its visual accompaniment. */
export async function prepareWormholePerformance(analysis: TrackAnalysis, duration: number): Promise<PerformanceAutomationPlan> {
    const plan = featureFlags.forceLegacyDramaturgy ? null : await generateVisualOsPerformancePlan(analysis,
        { duration, stylePackId: 'cosmic-wormhole', activityLevel: 'balanced', variantMode: 'paired' });
    if (plan?.points.length) return plan;
    const response = await fetch(`${import.meta.env.BASE_URL}visual-tuning-presets/index.json`);
    if (!response.ok) throw new Error('Could not load Wormhole presets.');
    const manifest = await response.json() as { presets?: string[] };
    const available = (manifest.presets ?? []).filter(name => /^[\w .-]+\.json$/i.test(name) && name !== 'index.json');
    return generatePerformancePlan(analysis, available, duration,
        { strategy: 'dramaturgy', presetMetadata: {}, strictPresets: [], strictBars: 8, strictMorph: 1 });
}
