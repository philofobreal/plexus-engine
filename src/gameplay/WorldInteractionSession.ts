// World Interaction Session (ADR-010): the player's bounded effect on the authored world. Pure and
// renderer-independent. It is fed only by `RhythmGameSession` through the resolution observer, so
// desktop clicks and headset swings produce identical world progress, and it never judges a note,
// reads a clock or touches the official score.
//
// Per run (every session reset starts one): each note applies once (idempotent by id), skipped
// notes (seek) count as unrewarded misses without moving coherence or causing reactions.

import type { RhythmResolutionObserver } from './RhythmGameSession';
import type { JudgementGrade, RhythmNote } from './RhythmTypes';
import {
    createEmptyWorldPlan, MAX_WORLD_REACTIONS, WORLD_NOTE_ROLE_KINDS, type WorldEncounterProgress, type WorldInteractionSnapshot,
    type WorldNoteRoleKind, type WorldOutcome, type WorldOutcomeClass, type WorldPlan, type WorldReaction, type WorldReactionKind,
    type WorldRoleStatus, type WorldRoleTally
} from './WorldTypes';

/** Contribution of a resolved note to its structure and to the field. */
export const WORLD_NOTE_CREDIT: Readonly<Record<JudgementGrade, number>> = { perfect: 1, good: 0.75 };
/** A structure starts at this quality and its notes pull it up or down. */
export const NEUTRAL_QUALITY = 0.6;
const QUALITY_PRIOR_WEIGHT = 2;
export const COHERENCE_START = 0.5;
const COHERENCE_RATE = 0.12;
const COHERENCE_TARGET: Readonly<Record<JudgementGrade, number>> = { perfect: 1, good: 0.8 };
export const STABILIZED_THRESHOLD = 0.75;
export const CONTAINED_THRESHOLD = 0.4;
const FORMED_THRESHOLD = 0.72;
const PARTIAL_THRESHOLD = 0.5;

const OUTCOME_TITLES: Readonly<Record<WorldOutcomeClass, string>> = {
    stabilized: 'Field stabilized', contained: 'Field contained', unstable: 'Field unstable',
    formed: 'World formed', partial: 'World partially formed', fragmented: 'World fragmented'
};

export class WorldInteractionSession implements RhythmResolutionObserver {
    private plan: WorldPlan = createEmptyWorldPlan(0);
    /** Structures with a contribution window, ordered by window (windows are contiguous and ascending). */
    private windows: { index: number; start: number; end: number }[] = [];
    private roleByNote = new Map<string, number>();
    private readonly applied = new Set<string>();
    private credit: number[] = [];
    private counted: number[] = [];
    private energizedAt: number[] = [];
    private faultAt: number[] = [];
    private roleStatus: WorldRoleStatus[] = [];
    private coherence = COHERENCE_START;
    private hits = 0;
    private misses = 0;
    private resolved = 0;
    private anchorsHit = 0;
    private anchorsMissed = 0;
    private stabilizeHit: boolean | null = null;
    private syncResolved = 0;
    private syncCredit = 0;
    private reactions: WorldReaction[] = [];
    private revision = 0;
    private snapshot: WorldInteractionSnapshot | null = null;

    constructor() { this.load(null); }

    /** Publishes the plan of a new chart (null: no track) and starts a fresh run. */
    load(plan: WorldPlan | null): void {
        this.plan = plan ?? createEmptyWorldPlan(0);
        this.windows = this.plan.structures
            .filter(s => s.scheduled && s.contributionEnd > s.contributionStart)
            .map(s => ({ index: s.index, start: s.contributionStart, end: s.contributionEnd }))
            .sort((a, b) => a.end - b.end || a.index - b.index);
        this.roleByNote = new Map(this.plan.roles.map((role, index) => [role.noteId, index]));
        this.onRunReset();
    }

    get worldPlan(): WorldPlan { return this.plan; }

    onRunReset(): void {
        const count = this.plan.structures.length;
        this.applied.clear();
        this.credit = new Array(count).fill(0);
        this.counted = new Array(count).fill(0);
        this.energizedAt = new Array(count).fill(-1);
        this.faultAt = new Array(count).fill(-1);
        this.roleStatus = this.plan.roles.map(() => 'pending');
        this.coherence = COHERENCE_START;
        this.hits = 0; this.misses = 0; this.resolved = 0;
        this.anchorsHit = 0; this.anchorsMissed = 0; this.stabilizeHit = null;
        this.syncResolved = 0; this.syncCredit = 0;
        this.reactions = [];
        this.changed();
    }

    onNoteResolved(note: RhythmNote, grade: JudgementGrade | null, songTime: number, skipped: boolean): void {
        if (!note || typeof note.id !== 'string' || !Number.isFinite(note.time) || this.applied.has(note.id)) return;
        this.applied.add(note.id);
        const time = Number.isFinite(songTime) ? songTime : note.time;
        const credit = grade ? WORLD_NOTE_CREDIT[grade] : 0;
        this.resolved++;
        if (grade) this.hits++; else this.misses++;
        if (!skipped) this.coherence += COHERENCE_RATE * ((grade ? COHERENCE_TARGET[grade] : 0) - this.coherence);
        const structure = this.structureFor(note.time);
        if (structure >= 0) { this.credit[structure] += credit; this.counted[structure]++; }
        const encounter = this.plan.encounter;
        if (encounter && note.time >= encounter.syncStart && note.time < encounter.syncEnd) { this.syncResolved++; this.syncCredit += credit; }

        let reaction: WorldReactionKind | null = skipped ? null : grade ? 'hit' : 'miss';
        let reactionStructure = structure;
        const roleIndex = this.roleByNote.get(note.id);
        if (roleIndex !== undefined && this.roleStatus[roleIndex] === 'pending') {
            const role = this.plan.roles[roleIndex];
            this.roleStatus[roleIndex] = grade ? 'hit' : 'missed';
            const target = role.structure >= 0 && role.structure < this.energizedAt.length ? role.structure : -1;
            if (role.role === 'energy' || role.role === 'signal') {
                if (grade && target >= 0) this.energizedAt[target] = time;
                else if (!grade && !skipped && target >= 0) this.faultAt[target] = time;
                if (!skipped) reaction = grade ? (role.role === 'energy' ? 'energize' : 'signal') : 'fault';
            } else if (role.role === 'sync') {
                if (grade) this.anchorsHit++; else this.anchorsMissed++;
                if (!skipped) reaction = grade ? 'sync' : 'disrupt';
            } else {
                this.stabilizeHit = grade !== null;
                if (!skipped) reaction = grade ? 'stabilize' : 'disrupt';
            }
            if (target >= 0) reactionStructure = target;
        }
        if (reaction) {
            this.reactions.push({ kind: reaction, time, structure: reactionStructure, grade });
            if (this.reactions.length > MAX_WORLD_REACTIONS) this.reactions.shift();
        }
        this.changed();
    }

    /** Frozen; the same object is handed out while nothing changed. */
    getSnapshot(): WorldInteractionSnapshot {
        if (this.snapshot) return this.snapshot;
        const quality = this.plan.structures.map((_, i) => this.qualityOf(i));
        const tally = {} as Record<WorldNoteRoleKind, WorldRoleTally>;
        for (const kind of WORLD_NOTE_ROLE_KINDS) tally[kind] = { total: 0, hit: 0, missed: 0 };
        this.plan.roles.forEach((role, i) => {
            const t = tally[role.role], status = this.roleStatus[i];
            tally[role.role] = { total: t.total + 1, hit: t.hit + (status === 'hit' ? 1 : 0), missed: t.missed + (status === 'missed' ? 1 : 0) };
        });
        this.snapshot = Object.freeze({
            revision: this.revision,
            formation: this.formation(quality),
            coherence: this.coherence,
            hits: this.hits, misses: this.misses, resolved: this.resolved,
            structureQuality: Object.freeze(quality),
            structureEnergizedAt: Object.freeze(this.energizedAt.slice()),
            structureFaultAt: Object.freeze(this.faultAt.slice()),
            roleStatus: Object.freeze(this.roleStatus.slice()),
            roleTally: Object.freeze(tally),
            encounter: this.encounterProgress(),
            reactions: Object.freeze(this.reactions.slice())
        });
        return this.snapshot;
    }

    /** The end-of-run world result (meaningful at any time; final once every note resolved). */
    getOutcome(): WorldOutcome {
        const snapshot = this.getSnapshot();
        const encounter = snapshot.encounter;
        let outcome: WorldOutcomeClass;
        if (encounter) outcome = encounter.stability >= STABILIZED_THRESHOLD ? 'stabilized' : encounter.stability >= CONTAINED_THRESHOLD ? 'contained' : 'unstable';
        else {
            const score = 0.6 * snapshot.formation + 0.4 * snapshot.coherence;
            outcome = score >= FORMED_THRESHOLD ? 'formed' : score >= PARTIAL_THRESHOLD ? 'partial' : 'fragmented';
        }
        return { outcome, title: OUTCOME_TITLES[outcome], formation: snapshot.formation, coherence: snapshot.coherence,
            stability: encounter ? encounter.stability : null, anchorsHit: encounter?.anchorsHit ?? 0, anchorsTotal: encounter?.anchorsTotal ?? 0 };
    }

    private changed(): void {
        this.revision++;
        this.snapshot = null;
    }

    /** The structure a note time contributes to, or -1 after the last window. */
    private structureFor(time: number): number {
        const windows = this.windows;
        let lo = 0, hi = windows.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (windows[mid].end < time) lo = mid + 1; else hi = mid; }
        const window = windows[lo];
        return window && time > window.start ? window.index : -1;
    }

    private qualityOf(index: number): number {
        return (QUALITY_PRIOR_WEIGHT * NEUTRAL_QUALITY + this.credit[index]) / (QUALITY_PRIOR_WEIGHT + this.counted[index]);
    }

    private formation(quality: readonly number[]): number {
        let sum = 0, count = 0;
        this.plan.structures.forEach((s, i) => { if (s.scheduled) { sum += quality[i]; count++; } });
        return count ? sum / count : 0;
    }

    private encounterProgress(): WorldEncounterProgress | null {
        const encounter = this.plan.encounter;
        if (!encounter) return null;
        const total = encounter.anchorCount;
        // Progress toward stabilization: grows as the field is aligned, reaches the final value once
        // every note of the window resolved. Without anchors, accuracy carries their weight.
        const accuracy = encounter.syncNoteCount ? this.syncCredit / encounter.syncNoteCount : 0;
        const lock = this.stabilizeHit ? 1 : 0;
        let stability = total > 0 ? 0.5 * this.anchorsHit / total + 0.3 * accuracy : 0.8 * accuracy;
        // Without a lock note the other terms carry its weight.
        stability = encounter.stabilizeNoteId ? stability + 0.2 * lock : stability / 0.8;
        return Object.freeze({ anchorsTotal: total, anchorsHit: this.anchorsHit, anchorsMissed: this.anchorsMissed, stabilizeHit: this.stabilizeHit,
            syncNotesResolved: this.syncResolved, syncCredit: this.syncCredit, stability: Math.min(1, Math.max(0, stability)) });
    }
}
