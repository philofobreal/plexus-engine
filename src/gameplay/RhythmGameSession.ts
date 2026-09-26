// Pure rhythm-game session/state machine (ADR-009). Renderer-independent: driven purely by
// an externally supplied song-time number (the host reads it from AudioEngine.getCurrentTime()).
// Never imports Three.js, WebXR, DOM, AudioEngine, or src/state/.

import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import { attemptStrike as judgeStrike } from './RhythmJudge';
import type {
    JudgementGrade,
    NoteRuntimeState,
    RhythmNote,
    RhythmSessionSnapshot,
    RhythmSessionState,
    StrikeAttempt,
    StrikeResult
} from './RhythmTypes';

function scoreForGrade(grade: JudgementGrade): number {
    return grade === 'perfect' ? 100 : 50;
}

export class RhythmGameSession {
    private readonly config: RhythmGameConfig;
    private chart: readonly RhythmNote[] = [];
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

    clear(): void {
        this.chart = [];
        this.resetRuntimeState();
        this.state = 'idle';
    }

    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.config = config;
    }

    /** Loads a freshly built chart and moves the session to 'ready'. Fully resets runtime state. */
    loadChart(chart: readonly RhythmNote[]): void {
        this.chart = chart;
        this.resetRuntimeState();
        this.state = 'ready';
    }

    private resetRuntimeState(): void {
        this.noteStates = this.chart.map((note) => ({ note, status: 'pending', judgement: null }));
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
            if (entry.status === 'pending') { entry.status = 'missed'; this.missCount++; }
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
            this.score += scoreForGrade(result.grade);
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

    getSnapshot(): RhythmSessionSnapshot {
        return {
            state: this.state,
            score: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            hitCount: this.hitCount,
            missCount: this.missCount,
            totalNotes: this.chart.length
        };
    }
}
