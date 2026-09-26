import type { PerformanceAutomationPlan, PerformanceAutomationPoint, TrackAnalysis } from '../types';
import { cueContext, musicalCueAnchors } from '../semantics/cueEvidence.ts';

/** Final automatic placement gate. Choreography may propose evenly divided/bar-snapped times;
 * publication must resolve each proposal to actual musical evidence or omit it. Initial state
 * at zero is explicit. Manual/locked points remain user-owned. No artificial cue is invented.
 */
export function alignAutomationToCues(plan: PerformanceAutomationPlan, analysis: TrackAnalysis): PerformanceAutomationPlan {
    if (plan.source !== 'auto' || !plan.points.length) return plan;
    const anchors = musicalCueAnchors(analysis);
    const proposals = plan.points.slice().sort((a, b) => a.time - b.time);
    const result: PerformanceAutomationPoint[] = [];
    for (let i = 0; i < proposals.length; i++) {
        const point = proposals[i];
        if (point.locked || point.reason === 'manual') { result.push({ ...point }); continue; }
        const prior = cueContext(analysis, point.time);
        if (i === 0) {
            result.push({ ...point, time: 0, cueAnchor: { plannedTime: point.time, sourceTime: 0, kind: 'initial', confidence: 1,
                before: 0, after: cueContext(analysis, 0).after, plannedBefore: prior.before, plannedAfter: prior.after } });
            continue;
        }
        // Neighbour midpoints prevent a point from stealing another scene's cue. A bounded
        // search on BOTH sides replaces unconditional rounding to an unrelated bar line.
        const lower = Math.max((proposals[i - 1].time + point.time) / 2, point.time - 4);
        const upper = Math.min(proposals[i + 1] ? (point.time + proposals[i + 1].time) / 2 : analysis.duration, point.time + 4);
        const candidates = anchors.filter(a => a.time >= lower && a.time <= upper && a.time < analysis.duration - 0.12);
        candidates.sort((a, b) => (Math.abs(a.time - point.time) - a.confidence * 0.15) - (Math.abs(b.time - point.time) - b.confidence * 0.15));
        const anchor = candidates[0];
        if (!anchor) continue;
        const context = cueContext(analysis, anchor.time);
        result.push({ ...point, time: anchor.time, cueAnchor: { plannedTime: point.time, sourceTime: anchor.time,
            kind: anchor.kind, confidence: anchor.confidence, before: context.before, after: context.after,
            plannedBefore: prior.before, plannedAfter: prior.after } });
    }
    result.sort((a, b) => a.time - b.time);
    const protectedPoints = result.filter(p => p.locked || p.reason === 'manual');
    const unique: PerformanceAutomationPoint[] = [];
    for (const p of result) {
        if (!p.locked && p.reason !== 'manual' && protectedPoints.some(manual => Math.abs(manual.time - p.time) < 0.12)) continue;
        if (!unique.length || p.locked || p.reason === 'manual' || p.time - unique[unique.length - 1].time >= 0.12) unique.push(p);
    }
    return { ...plan, cueAlignmentReport: { proposedPoints: proposals.length, publishedPoints: unique.length,
        omittedTimes: proposals.filter(p => !unique.some(u => u.id === p.id)).map(p => p.time) },
        points: unique.map((p, i) => ({ ...p,
        morphDurationSec: p.locked || p.reason === 'manual' ? p.morphDurationSec
            : Math.max(0.1, Math.min(p.morphDurationSec, (unique[i + 1]?.time ?? analysis.duration) - p.time - 0.02)) })) };
}
