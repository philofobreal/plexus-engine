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
    RhythmResolutionObserver,
    RhythmResolutionObserverFailure,
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
    private resolutionObserver: RhythmResolutionObserver | null = null;
    private observerFailure: RhythmResolutionObserverFailure | null = null;
    private notifying = false;
    private resetNotificationPending = false;
    /** At most one notification per chart note in an operation; empty without an observer. */
    private pendingResolutions: { note: RhythmNote; grade: JudgementGrade | null; songTime: number; skipped: boolean }[] = [];

    /** Attach before load/start. No replay; replacing/detaching clears pending work and faults. */
    setResolutionObserver(observer: RhythmResolutionObserver | null): void {
        this.assertNotNotifying();
        this.resolutionObserver = observer;
        this.observerFailure = null;
        this.resetNotificationPending = false;
        this.pendingResolutions.length = 0;
    }

    getResolutionObserverFailure(): RhythmResolutionObserverFailure | null { return this.observerFailure; }

    clear(): void {
        this.assertNotNotifying();
        this.chart = [];
        this.scoring = buildScoringPlan([]);
        this.resetRuntimeState();
        this.state = 'idle';
        this.flushNotifications();
    }

    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.config = config;
    }

    /**
     * Swaps the gameplay configuration between runs. Refused while playing; a loaded chart keeps
     * its notes, but every runtime state (score, cursors) is reset and the session is 'ready'.
     */
    setConfig(config: RhythmGameConfig): boolean {
        this.assertNotNotifying();
        if (this.state === 'playing') return false;
        this.config = config;
        this.resetRuntimeState();
        if (this.state !== 'idle') this.state = 'ready';
        this.flushNotifications();
        return true;
    }

    /**
     * Loads a freshly built chart and moves the session to 'ready'. Fully resets runtime state.
     * `sections` (the analyzer's published sections, plain data) weight the score by dramaturgy.
     */
    loadChart(chart: readonly RhythmNote[], sections: readonly ScoringSectionSource[] = []): void {
        this.assertNotNotifying();
        this.chart = chart;
        this.scoring = buildScoringPlan(chart, sections);
        this.resetRuntimeState();
        this.state = 'ready';
        this.flushNotifications();
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
        this.pendingResolutions.length = 0;
        this.resetNotificationPending = this.resolutionObserver !== null;
    }

    start(): void {
        this.assertNotNotifying();
        if (this.state !== 'ready' && this.state !== 'finished') return;
        this.resetRuntimeState();
        this.state = 'playing';
        this.flushNotifications();
    }

    pause(): void {
        this.assertNotNotifying();
        if (this.state !== 'playing') return;
        this.state = 'paused';
    }

    resume(): void {
        this.assertNotNotifying();
        if (this.state !== 'paused') return;
        this.state = 'playing';
    }

    /** Fully resynchronizes note state and cursors; the host pairs this with an AudioEngine seek(0)/play(0). */
    restart(): void {
        this.assertNotNotifying();
        this.resetRuntimeState();
        this.state = 'playing';
        this.flushNotifications();
    }

    finish(): void {
        this.assertNotNotifying();
        if (this.state !== 'playing' && this.state !== 'paused') return;
        for (const entry of this.noteStates) {
            if (entry.status === 'pending') { entry.status = 'missed'; this.missCount++; this.recordMiss(entry, entry.note.time); }
        }
        this.combo = 0;
        this.state = 'finished';
        this.flushNotifications();
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
        this.assertNotNotifying();
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
        this.flushNotifications();
    }

    /**
     * Advances the bounded miss-detection cursor to `songTime`. Must be called with a
     * monotonically non-decreasing `songTime` during normal playback; call `seek()` first after any
     * discontinuity. Returns the ids of notes newly marked missed this call.
     */
    update(songTime: number): string[] {
        this.assertNotNotifying();
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
        this.flushNotifications();
        return missedIds;
    }

    /** Resolves at most one note per call; a whiff (no valid candidate) never mutates state. */
    attemptStrike(attempt: StrikeAttempt): StrikeResult | null {
        this.assertNotNotifying();
        if (this.state !== 'playing') return null;
        const result = judgeStrike(attempt, this.getActiveNotes(attempt.songTime), this.config);
        if (result) {
            this.hitCount++;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.recordHit(result.noteId, result.grade, attempt.songTime);
        }
        this.flushNotifications();
        return result;
    }

    /**
     * Bounded window of notes relevant to rendering right now: from just behind the miss boundary
     * through the approach horizon. Advances a monotonic cursor rather than scanning the full chart.
     */
    getActiveNotes(songTime: number): readonly NoteRuntimeState[] {
        // This accessor advances a cursor/scratch array; it is not a read-only observer API.
        this.assertNotNotifying();
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
        this.queueResolution(this.chart[index], grade, songTime, false);
    }

    private recordMiss(entry: NoteRuntimeState, songTime: number, breaksMultiplier = true): void {
        const index = this.noteIndex.get(entry.note.id);
        if (index === undefined) return;
        if (breaksMultiplier) dropMultiplier(this.multiplier);
        const result = this.sectionResults[this.scoring.noteSection[index]];
        result.misses++;
        this.resolve(result, songTime);
        this.queueResolution(entry.note, null, songTime, !breaksMultiplier);
    }

    private assertNotNotifying(): void {
        if (this.notifying) throw new Error('Resolution observers cannot mutate or advance the session');
    }

    private queueResolution(note: RhythmNote, grade: JudgementGrade | null, songTime: number, skipped: boolean): void {
        if (this.resolutionObserver) this.pendingResolutions.push({ note: Object.freeze({ ...note }), grade, songTime, skipped });
    }

    /** Dispatch only after the entire public operation commits, including seek/finish counters. */
    private flushNotifications(): void {
        const observer = this.resolutionObserver;
        if (!observer || (!this.resetNotificationPending && !this.pendingResolutions.length)) return;
        let phase: RhythmResolutionObserverFailure['phase'] = 'reset';
        let reason: RhythmResolutionObserverFailure['reason'] = 'callback-threw';
        // TypeScript's void callbacks can still return a Promise. Reject async consumers and
        // consume its rejection so it cannot escape as an unhandled rejection.
        const synchronous = (result: unknown) => {
            if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
                reason = 'async-callback';
                void Promise.resolve(result).catch(() => undefined);
                throw new Error('Resolution observers must be synchronous');
            }
        };
        this.notifying = true;
        try {
            if (this.resetNotificationPending) synchronous(observer.onRunReset());
            phase = 'resolved';
            for (const event of this.pendingResolutions) synchronous(observer.onNoteResolved(event.note, event.grade, event.songTime, event.skipped));
        } catch {
            this.resolutionObserver = null;
            this.observerFailure = Object.freeze({ phase, reason });
        } finally {
            this.notifying = false;
            this.resetNotificationPending = false;
            this.pendingResolutions.length = 0;
        }
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
