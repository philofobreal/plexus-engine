import type { PerformanceAutomationPlan, PerformanceAutomationPoint, TrackAnalysis } from '../types';
import { cueContext, musicalCueAnchors } from '../semantics/cueEvidence.ts';
import { preferredAutomationAnchors } from '../semantics/automationCueRoles.ts';

/** Offline publication gate. Typed generated purposes require matching accepted evidence in
 * their originating scene. Untyped legacy plans retain their placement policy; manual/locked
 * points remain user-owned. A cue is a morph START here, not a target-arrival deadline.
 */
export function alignAutomationToCues(plan: PerformanceAutomationPlan, analysis: TrackAnalysis): PerformanceAutomationPlan {
    if (plan.source !== 'auto' || !plan.points.length) return plan;
    const experimental = analysis.eventTiming?.policy === 'experimental-opt-in';
    const anchors = musicalCueAnchors(analysis, experimental || plan.points.some(p => p.cuePlacement !== undefined));
    const proposals = plan.points.map((point, index) => ({ point, index })).sort((a, b) => a.point.time - b.point.time || a.index - b.index);
    type Decision = NonNullable<NonNullable<PerformanceAutomationPlan['cueAlignmentReport']>['decisions']>[number];
    const decisions: Decision[] = plan.points.map((p, proposalIndex) => ({ proposalIndex, pointId: p.id,
        plannedTime: p.time, ...(p.cuePlacement ? { placement: { ...p.cuePlacement } } : {}), status: 'omitted', reason: p.cuePlacement ? 'no-role-evidence' : 'no-evidence' }));
    const result: Array<{ point: PerformanceAutomationPoint; index: number }> = [];
    for (let i = 0; i < proposals.length; i++) {
        const { point, index } = proposals[i], decision = decisions[index];
        if (point.locked || point.reason === 'manual') {
            result.push({ point: { ...point }, index });
            decision.status = 'protected'; decision.selectedTime = point.time; delete decision.reason; continue;
        }
        const placement = point.cuePlacement;
        if (placement !== undefined && (!placement || !['scene-entry', 'attack', 'release', 'structure', 'melody', 'fx'].includes(placement.role)
            || !Number.isFinite(placement.start) || !Number.isFinite(placement.end)
            || placement.start < 0 || placement.end <= placement.start || placement.start >= analysis.duration
            || point.time < placement.start || point.time >= placement.end)) {
            decision.reason = 'invalid-window'; continue;
        }
        const prior = cueContext(analysis, point.time);
        // Only the real opening scene may bypass evidence; a first surviving late attack is not an initial state.
        if (i === 0 && (!placement || placement.role === 'scene-entry' && placement.start === 0 && point.time === 0)) {
            result.push({ index, point: { ...point, time: 0, cueAnchor: { plannedTime: point.time, sourceTime: 0,
                kind: 'initial', confidence: 1, before: 0, after: cueContext(analysis, 0).after,
                plannedBefore: prior.before, plannedAfter: prior.after } } });
            decision.status = 'initial'; decision.selectedTime = 0; delete decision.reason; continue;
        }
        // Original neighbours bound cue ownership even if an unsupported proposal is later omitted.
        const lower = Math.max(i ? (proposals[i - 1].point.time + point.time) / 2 : 0,
            point.time - 4, placement?.start ?? 0);
        const upper = Math.min(proposals[i + 1] ? (point.time + proposals[i + 1].point.time) / 2 : analysis.duration,
            point.time + 4, placement?.end ?? analysis.duration);
        const bounded = anchors.filter(a => a.time >= lower && a.time <= upper
            && (!placement || a.time < placement.end) && a.time < analysis.duration - 0.12);
        const selection = placement || experimental ? preferredAutomationAnchors(point, bounded) : { candidates: bounded, role: undefined };
        selection.candidates.sort((a, b) => (Math.abs(a.time - point.time) - a.confidence * 0.15)
            - (Math.abs(b.time - point.time) - b.confidence * 0.15));
        const anchor = selection.candidates[0];
        if (!anchor) continue;
        const context = cueContext(analysis, anchor.time);
        const published = { ...point, time: anchor.time, cueAnchor: { plannedTime: point.time, sourceTime: anchor.time,
            kind: anchor.kind, confidence: anchor.confidence, before: context.before, after: context.after,
            plannedBefore: prior.before, plannedAfter: prior.after, ...(selection.role ? { role: selection.role } : {}) } };
        result.push({ point: published, index });
        decision.status = 'anchored'; decision.selectedTime = anchor.time; decision.role = selection.role; delete decision.reason;
    }
    result.sort((a, b) => a.point.time - b.point.time || a.index - b.index);
    const protectedPoints = result.filter(({ point: p }) => p.locked || p.reason === 'manual');
    const unique: typeof result = [];
    const omit = (index: number, reason: Decision['reason']) => {
        decisions[index].status = 'omitted'; decisions[index].reason = reason;
        delete decisions[index].selectedTime; delete decisions[index].role;
    };
    for (const item of result) {
        const p = item.point, protectedPoint = p.locked || p.reason === 'manual';
        if (!protectedPoint && protectedPoints.some(({ point: manual }) => Math.abs(manual.time - p.time) < 0.12)) {
            omit(item.index, 'collision'); continue;
        }
        if (!protectedPoint && analysis.duration - p.time < 0.12) { omit(item.index, 'insufficient-space'); continue; }
        const last = unique.at(-1);
        if (!last || protectedPoint || p.time - last.point.time >= 0.12) { unique.push(item); continue; }
        // A preceding micro accent must not suppress the next scene's accepted entry boundary.
        if (p.cuePlacement?.role === 'scene-entry' && last.point.cuePlacement
            && last.point.cuePlacement.start < p.cuePlacement.start && !last.point.locked && last.point.reason !== 'manual') {
            omit(last.index, 'collision'); unique[unique.length - 1] = item;
        } else omit(item.index, 'collision');
    }
    return { ...plan, cueAlignmentReport: { proposedPoints: proposals.length, publishedPoints: unique.length,
        omittedTimes: decisions.filter(d => d.status === 'omitted').map(d => d.plannedTime), decisions },
        points: unique.map(({ point: p }, i) => ({ ...p,
            morphDurationSec: p.locked || p.reason === 'manual' ? p.morphDurationSec
                : Math.max(0.1, Math.min(p.morphDurationSec, (unique[i + 1]?.point.time ?? analysis.duration) - p.time - 0.02)) })) };
}
