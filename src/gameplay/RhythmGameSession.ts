// Pure rhythm-game session/state machine (ADR-009). Renderer-independent: driven purely by
// an externally supplied song-time number (the host reads it from AudioEngine.getCurrentTime()).
// Never imports Three.js, WebXR, DOM, AudioEngine, or src/state/.

import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import { attemptStrike as judgeStrike } from './RhythmJudge';
import {
    advanceMultiplier, buildScoringPlan, createMultiplierState, dropMultiplier, hitPoints, multiplierOf,
    type RhythmScoringPlan, type ScoringSectionSource
} from './RhythmScoring';
import type {
    JudgementGrade,
    NoteRuntimeState,
    RhythmNote,
    RhythmSessionSnapshot,
    RhythmSessionState,
    SectionResult,
    StrikeAttempt,
    StrikeResult
} from './RhythmTypes';

export class RhythmGameSession {
    private config: RhythmGameConfig;
    private chart: readonly RhythmNote[] = [];
    private scoring: RhythmScoringPlan = buildScoringPlan([]);
    private sectionResults: SectionResult[] = [];
    private readonly multiplier = createMultiplierState();
    /** Chart index by note id, so a resolved note finds its section without searching. */
    private noteIndex = new Map<string, number>();
    private noteStates: NoteRuntimeState[] = [];
    private state: RhythmSessionState = 'idle';
    private score = 0;
    private combo = 0;
    private maxCombo = 0;
    private hitCount = 0;
    private missCount = 0;
    /** Monotonic bounded cursor for the per-frame miss scan; reset explicitly on seek/restart/load. */
    private missScanCursor = 0;
    /** Monotonic bounded cursor for the active/visible-note window; reset explicitly on seek/restart/load. */
    private activeWindowStart = 0;
    private readonly activeNotes: NoteRuntimeState[] = [];
    /** Last snapshot handed out (reused while every field is unchanged). */
    private snapshot: RhythmSessionSnapshot | null = null;

    clear(): void {
        this.chart = [];
        this.scoring = buildScoringPlan([]);
        this.resetRuntimeState();
        this.state = 'idle';
    }

    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.config = config;
    }

    /**
     * Swaps the gameplay configuration between runs. Refused while playing; a loaded chart keeps
     * its notes, but every runtime state (score, cursors) is reset and the session is 'ready'.
     */
    setConfig(config: RhythmGameConfig): boolean {
        if (this.state === 'playing') return false;
        this.config = config;
        this.resetRuntimeState();
        if (this.state !== 'idle') this.state = 'ready';
        return true;
    }

    /**
     * Loads a freshly built chart and moves the session to 'ready'. Fully resets runtime state.
     * `sections` (the analyzer's published sections, plain data) weight the score by dramaturgy.
     */
    loadChart(chart: readonly RhythmNote[], sections: readonly ScoringSectionSource[] = []): void {
        this.chart = chart;
        this.scoring = buildScoringPlan(chart, sections);
        this.resetRuntimeState();
        this.state = 'ready';
    }

    private resetRuntimeState(): void {
        this.noteStates = this.chart.map((note) => ({ note, status: 'pending', judgement: null }));
        this.noteIndex = new Map(this.chart.map((note, index) => [note.id, index]));
        this.sectionResults = this.scoring.sections.map(section => ({ index: section.index, hits: 0, perfects: 0, misses: 0,
            resolved: 0, points: 0, bonus: 0, completedAt: null }));
        this.multiplier.tier = 0; this.multiplier.progress = 0;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hitCount = 0;
        this.missCount = 0;
        this.missScanCursor = 0;
        this.activeWindowStart = 0;
    }

    start(): void {
        if (this.state !== 'ready' && this.state !== 'finished') return;
        this.resetRuntimeState();
        this.state = 'playing';
    }

    pause(): void {
        if (this.state !== 'playing') return;
        this.state = 'paused';
    }

    resume(): void {
        if (this.state !== 'paused') return;
        this.state = 'playing';
    }

    /** Fully resynchronizes note state and cursors; the host pairs this with an AudioEngine seek(0)/play(0). */
    restart(): void {
        this.resetRuntimeState();
        this.state = 'playing';
    }

    finish(): void {
        if (this.state !== 'playing' && this.state !== 'paused') return;
        for (const entry of this.noteStates) {
            if (entry.status === 'pending') { entry.status = 'missed'; this.missCount++; this.recordMiss(entry, entry.note.time); }
        }
        this.combo = 0;
        this.state = 'finished';
    }

    getState(): RhythmSessionState {
        return this.state;
    }

    /**
     * Explicit resynchronization for a seek. Re-derives both bounded cursors and note status from
     * the new song time rather than assuming monotonic advance, and clears combo across the jump.
     * O(chart length); a discrete user action, not a per-frame call.
     */
    seek(songTime: number): void {
        if (!Number.isFinite(songTime)) return;
        // A seek starts a fresh practice score, so rewind cannot farm already-scored notes.
        this.resetRuntimeState();
        let cursor = 0;
        while (cursor < this.noteStates.length && this.noteStates[cursor].note.time + this.config.missWindowSec < songTime) {
            this.noteStates[cursor].status = 'missed';
            // Skipped notes count as missed for their section (no bonus), without touching the multiplier.
            this.recordMiss(this.noteStates[cursor], songTime, false);
            cursor++;
        }
        this.missScanCursor = cursor;
        this.activeWindowStart = cursor;
        this.combo = 0;
        this.missCount = cursor;
    }

    /**
     * Advances the bounded miss-detection cursor to `songTime`. Must be called with a
     * monotonically non-decreasing `songTime` during normal playback; call `seek()` first after any
     * discontinuity. Returns the ids of notes newly marked missed this call.
     */
    update(songTime: number): string[] {
        if (this.state !== 'playing') return [];
        const missedIds: string[] = [];
        while (this.missScanCursor < this.noteStates.length) {
            const entry = this.noteStates[this.missScanCursor];
            if (entry.note.time + this.config.missWindowSec >= songTime) break;
            if (entry.status === 'pending') {
                entry.status = 'missed';
                entry.judgement = null;
                entry.resolvedAt = songTime;
                this.missCount++;
                this.combo = 0;
                this.recordMiss(entry, songTime);
                missedIds.push(entry.note.id);
            }
            this.missScanCursor++;
        }
        return missedIds;
    }

    /** Resolves at most one note per call; a whiff (no valid candidate) never mutates state. */
    attemptStrike(attempt: StrikeAttempt): StrikeResult | null {
        if (this.state !== 'playing') return null;
        const result = judgeStrike(attempt, this.getActiveNotes(attempt.songTime), this.config);
        if (result) {
            this.hitCount++;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.recordHit(result.noteId, result.grade, attempt.songTime);
        }
        return result;
    }

    /**
     * Bounded window of notes relevant to rendering right now: from just behind the miss boundary
     * through the approach horizon. Advances a monotonic cursor rather than scanning the full chart.
     */
    getActiveNotes(songTime: number): readonly NoteRuntimeState[] {
        const lowerBound = songTime - this.config.missWindowSec - this.config.resolvedNoteLifetimeSec;
        const upperBound = songTime + this.config.approachTimeSec;
        while (
            this.activeWindowStart < this.noteStates.length &&
            this.noteStates[this.activeWindowStart].note.time < lowerBound
        ) {
            this.activeWindowStart++;
        }
        const active = this.activeNotes;
        active.length = 0;
        for (let i = this.activeWindowStart; i < this.noteStates.length; i++) {
            const entry = this.noteStates[i];
            if (entry.note.time > upperBound) break;
            active.push(entry);
            if (active.length >= this.config.maxActiveNotes) break;
        }
        return active;
    }

    /**
     * Immutable (frozen) view of the scalar session state. The host reads it every frame, so an
     * unchanged state returns the previous object instead of allocating a new one; any changed field
     * yields a new object. `sections` stays the session's live, read-only results array.
     */
    getSnapshot(): RhythmSessionSnapshot {
        const last = this.snapshot, multiplier = multiplierOf(this.multiplier);
        if (last && last.state === this.state && last.score === this.score && last.combo === this.combo && last.maxCombo === this.maxCombo
            && last.hitCount === this.hitCount && last.missCount === this.missCount && last.totalNotes === this.chart.length
            && last.multiplier === multiplier && last.maxScore === this.scoring.maxScore && last.sections === this.sectionResults) return last;
        this.snapshot = Object.freeze({
            state: this.state,
            score: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            hitCount: this.hitCount,
            missCount: this.missCount,
            totalNotes: this.chart.length,
            multiplier,
            maxScore: this.scoring.maxScore,
            sections: this.sectionResults
        });
        return this.snapshot;
    }

    /** The plan behind the score: section weights, bonuses and the maximum. */
    getScoringPlan(): RhythmScoringPlan {
        return this.scoring;
    }

    private recordHit(noteId: string, grade: JudgementGrade, songTime: number): void {
        const index = this.noteIndex.get(noteId);
        if (index === undefined) return;
        const section = this.scoring.sections[this.scoring.noteSection[index]];
        const result = this.sectionResults[section.index];
        const points = hitPoints(grade, multiplierOf(this.multiplier), section.weight);
        advanceMultiplier(this.multiplier);
        this.score += points;
        result.hits++;
        if (grade === 'perfect') result.perfects++;
        result.points += points;
        this.resolve(result, songTime);
    }

    private recordMiss(entry: NoteRuntimeState, songTime: number, breaksMultiplier = true): void {
        const index = this.noteIndex.get(entry.note.id);
        if (index === undefined) return;
        if (breaksMultiplier) dropMultiplier(this.multiplier);
        const result = this.sectionResults[this.scoring.noteSection[index]];
        result.misses++;
        this.resolve(result, songTime);
    }

    /** Completes a section once its last note resolves; a clean section earns its bonuses. */
    private resolve(result: SectionResult, songTime: number): void {
        const section = this.scoring.sections[result.index];
        if (++result.resolved < section.noteCount || result.completedAt !== null) return;
        result.completedAt = songTime;
        if (result.misses > 0) return;
        result.bonus = section.clearBonus + (result.perfects === section.noteCount ? section.flawlessBonus : 0);
        result.points += result.bonus;
        this.score += result.bonus;
    }
}
