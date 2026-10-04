// Renderer-independent rhythm-game domain contracts (ADR-009). This module must not import
// Three.js, WebXR, DOM, AudioEngine, or src/state/. See documents/adr/ADR-009-xr-rhythm-game-host.md.

export type RhythmHand = 'left' | 'right' | 'either';
export type CutDirection = 'any' | 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
export type RhythmTexture = 'breath' | 'pulse' | 'drive' | 'weave' | 'build' | 'impact' | 'echo';

export interface RhythmNote {
    readonly id: string;
    readonly time: number;
    readonly lane: number;
    /** Low / middle / high body-relative target row (0..2); 3 is the Tall play space overhead row. */
    readonly row: number;
    readonly hand: RhythmHand;
    readonly intensity: number;
    readonly sourceType: number;
    readonly cutDirection?: CutDirection;
    readonly texture?: RhythmTexture;
    readonly phrase?: number;
    readonly automationId?: string;
    readonly pairId?: string;
    readonly pairLayout?: 'horizontal' | 'vertical' | 'diagonal';
    /** Vertical pairs keep separate hand corridors instead of crossing the centerline. */
    readonly xOffsetMeters?: number;
}

export type NoteStatus = 'pending' | 'hit' | 'missed';

export type JudgementGrade = 'perfect' | 'good';

export interface NoteRuntimeState {
    readonly note: RhythmNote;
    status: NoteStatus;
    judgement: JudgementGrade | null;
    resolvedAt?: number;
}

export interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

/** Plain numeric/vector-shaped strike sample. Never a Three.js vector instance. */
export interface StrikeAttempt {
    songTime: number;
    hand: 'left' | 'right';
    position: Vector3Like;
    previousPosition?: Vector3Like;
    basePosition?: Vector3Like;
    previousBasePosition?: Vector3Like;
    previousSongTime?: number;
    speed: number;
    /** Explicit desktop accessibility assist; still requires aim, color and song timing. */
    desktopTargetId?: string;
}

export interface StrikeResult {
    noteId: string;
    grade: JudgementGrade;
    timingErrorSec: number;
}

export type RhythmSessionState = 'idle' | 'ready' | 'playing' | 'paused' | 'finished';

/** Live result of one scoring section (ADR-009 Addendum J). Mutated in place by the session. */
export interface SectionResult {
    readonly index: number;
    hits: number;
    perfects: number;
    misses: number;
    /** Notes of this section resolved so far (hit or missed). */
    resolved: number;
    /** Points earned in this section, bonuses included. */
    points: number;
    /** Bonus awarded when the section completed (0 until then, or when a note was missed). */
    bonus: number;
    /** Song time at which the last note of the section resolved; null while incomplete. */
    completedAt: number | null;
}

export interface RhythmSessionSnapshot {
    readonly state: RhythmSessionState;
    readonly score: number;
    readonly combo: number;
    readonly maxCombo: number;
    readonly hitCount: number;
    readonly missCount: number;
    readonly totalNotes: number;
    /** Current combo multiplier (1, 2, 4 or 8). */
    readonly multiplier?: number;
    /** Score with every note perfect; accuracy = score / maxScore. */
    readonly maxScore?: number;
    /** Per-section results in section order (live objects owned by the session; read-only for consumers). */
    readonly sections?: readonly SectionResult[];
}
