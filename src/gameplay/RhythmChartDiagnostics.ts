// Offline, opt-in accounting of chart decisions. Intensity is not recognition confidence.
import type { BeatEvent } from '../types';
import type { RhythmNote } from './RhythmTypes';
import type { MovementIssueCode, RhythmMovementIssue } from './RhythmMovement';
import type { RhythmAttentionSummary } from './RhythmLocalAttention';

export type ChartRejectionReason = 'invalid-duration' | 'invalid-time' | 'before-approach' | 'after-duration'
    | 'invalid-intensity' | 'below-intensity-floor' | 'pair-preparation' | 'section-breath'
    | 'dense-run-limit' | 'echo-window' | 'phrase-breath' | 'spacing' | 'hand-policy' | 'overhead-rest' | 'movement-rejected' | 'local-attention';
export interface RhythmChartDecision {
    readonly sourceIndex: number;
    readonly time: number | null;
    readonly outcome: 'retained' | ChartRejectionReason;
    /** Before the final movement guard; pairs are one source event with two proposed notes. */
    readonly proposedNoteIds: readonly string[];
    readonly noteIds: readonly string[];
    readonly hands: readonly RhythmNote['hand'][];
    readonly revoiced: boolean;
    readonly spacing?: { readonly earliestTime: number; readonly requiredGapSec: number };
    readonly movementIssues: readonly MovementIssueCode[];
}
export interface RhythmChartDiagnostics {
    readonly version: 1;
    readonly source: 'accepted-beat-events';
    readonly sourceEvents: number;
    readonly retainedEvents: number;
    readonly skippedEvents: number;
    readonly notes: number;
    readonly hands: { readonly left: number; readonly right: number; readonly either: number };
    readonly revoicedNotes: number;
    readonly rejected: Readonly<Partial<Record<ChartRejectionReason, number>>>;
    /** Original source-array order, including invalid/filtered events. Never a second onset detector. */
    readonly decisions: readonly RhythmChartDecision[];
    readonly attention?: RhythmAttentionSummary;
}

/** A collector exists only for a detailed build; legacy builds allocate no decision records. */
export class RhythmChartTrace {
    attention?: RhythmAttentionSummary;
    private readonly decisions = new Map<number, RhythmChartDecision>();
    private readonly noteSources = new Map<string, number>();
    private readonly events: readonly BeatEvent[];
    constructor(events: readonly BeatEvent[]) { this.events = events; }

    reject(index: number, reason: ChartRejectionReason, spacing?: RhythmChartDecision['spacing']): void {
        this.record(index, reason, []);
        if (spacing) this.decisions.set(index, { ...this.decisions.get(index)!, spacing });
    }
    retain(index: number, notes: readonly RhythmNote[]): void {
        this.record(index, 'retained', notes.map(n => n.id));
        for (const note of notes) this.noteSources.set(note.id, index);
    }
    private record(index: number, outcome: RhythmChartDecision['outcome'], ids: readonly string[]): void {
        this.decisions.set(index, { sourceIndex: index, time: Number.isFinite(this.events[index].time) ? this.events[index].time : null,
            outcome, proposedNoteIds: ids, noteIds: ids, hands: [], revoiced: false, movementIssues: [] });
    }
    /** Committed overhead rest/parity drops precede the final movement guard. */
    overheadDropped(notes: readonly RhythmNote[]): void {
        for (const note of notes) {
            const index = this.noteSources.get(note.id);
            if (index === undefined) throw new Error('Missing overhead source provenance');
            this.decisions.set(index, { ...this.decisions.get(index)!, outcome: 'overhead-rest', noteIds: [] });
        }
    }
    /** Authoritative guard decisions only, never preview branches. */
    movementDecision(notes: readonly RhythmNote[], issues: readonly RhythmMovementIssue[], revoiced: boolean): void {
        if (!issues.length && !revoiced) return;
        const codes = [...new Set(issues.map(i => i.code))];
        for (const note of notes) {
            const index = this.noteSources.get(note.id);
            if (index === undefined) throw new Error('Missing chart source provenance');
            const decision = this.decisions.get(index)!;
            this.decisions.set(index, { ...decision, ...(issues.length ? { outcome: 'movement-rejected' as const, noteIds: [] } : {}), revoiced, movementIssues: codes });
        }
    }
    finish(chart: readonly RhythmNote[], revoicedNotes: number): RhythmChartDiagnostics {
        const retained = new Map(chart.map(n => [n.id, n]));
        const rejected: Partial<Record<ChartRejectionReason, number>> = {};
        let retainedEvents = 0;
        const decisions = this.events.map((_, index) => {
            const decision = this.decisions.get(index);
            if (!decision) throw new Error(`Missing chart decision for source ${index}`);
            const noteIds = decision.proposedNoteIds.filter(id => retained.has(id));
            if ((decision.outcome === 'retained') !== (noteIds.length > 0)) throw new Error('Chart decision disagrees with final notes');
            if (noteIds.length) retainedEvents++;
            else rejected[decision.outcome as ChartRejectionReason] = (rejected[decision.outcome as ChartRejectionReason] ?? 0) + 1;
            return { ...decision, noteIds, hands: noteIds.map(id => retained.get(id)!.hand) };
        });
        return { version: 1, source: 'accepted-beat-events', ...(this.attention ? { attention: this.attention } : {}), sourceEvents: this.events.length, retainedEvents,
            skippedEvents: this.events.length - retainedEvents, notes: chart.length,
            hands: { left: chart.filter(n => n.hand === 'left').length, right: chart.filter(n => n.hand === 'right').length,
                either: chart.filter(n => n.hand === 'either').length }, revoicedNotes, rejected, decisions };
    }
}
