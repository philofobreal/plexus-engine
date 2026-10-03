// Swept blade samples against the moving note volume. No renderer or runtime dependencies.
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import { notePosition } from './RhythmLayout';
import { matchesCut } from './RhythmChoreography';
import type { NoteRuntimeState, StrikeAttempt, StrikeResult, Vector3Like } from './RhythmTypes';

function finite(p: Vector3Like): boolean {
    return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

export function attemptStrike(attempt: StrikeAttempt, noteStates: readonly NoteRuntimeState[],
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): StrikeResult | null {
    if (!Number.isFinite(attempt.songTime) || !Number.isFinite(attempt.speed) ||
        attempt.speed < config.minStrikeSpeedMps || !finite(attempt.position)) return null;
    const before = attempt.previousPosition ?? attempt.position;
    const base = attempt.basePosition ?? attempt.position;
    const beforeBase = attempt.previousBasePosition ?? before;
    const beforeTime = attempt.previousSongTime ?? attempt.songTime;
    if (![before, base, beforeBase].every(finite) || !Number.isFinite(beforeTime) ||
        beforeTime > attempt.songTime || attempt.songTime - beforeTime > 0.1) return null;
    let best: NoteRuntimeState | null = null;
    let bestError = Infinity;
    let signedError = 0;
    const target = { x: 0, y: 0, z: 0 };
    const oldTarget = { x: 0, y: 0, z: 0 };
    for (const entry of noteStates) {
        if (entry.status !== 'pending' || (entry.note.hand !== 'either' && entry.note.hand !== attempt.hand)) continue;
        if (attempt.desktopTargetId && attempt.desktopTargetId !== entry.note.id) continue;
        if (attempt.songTime < entry.note.time - config.earlyGoodWindowSec || beforeTime > entry.note.time + config.goodWindowSec) continue;
        notePosition(entry.note, attempt.songTime, target, config);
        notePosition(entry.note, beforeTime, oldTarget, config);
        // Nine retained blade fractions cover the 0.9 m blade, including mid-blade contact.
        // Each fraction is swept relative to the note's own motion, avoiding tip tunneling.
        for (let sample = 0; sample <= 8; sample++) {
            const u = sample / 8;
            const ax = beforeBase.x + (before.x - beforeBase.x) * u - oldTarget.x;
            const ay = beforeBase.y + (before.y - beforeBase.y) * u - oldTarget.y;
            const az = beforeBase.z + (before.z - beforeBase.z) * u - oldTarget.z;
            const dx = base.x + (attempt.position.x - base.x) * u - target.x - ax;
            const dy = base.y + (attempt.position.y - base.y) * u - target.y - ay;
            const dz = base.z + (attempt.position.z - base.z) * u - target.z - az;
            if (!attempt.desktopTargetId && !matchesCut(entry.note.cutDirection, dx, dy, attempt.songTime - beforeTime, config)) continue;
            const lengthSq = dx * dx + dy * dy + dz * dz;
            const t = lengthSq === 0 ? 1 : Math.max(0, Math.min(1, -(ax * dx + ay * dy + az * dz) / lengthSq));
            const distanceSq = (ax + t * dx) ** 2 + (ay + t * dy) ** 2 + (az + t * dz) ** 2;
            if (distanceSq > config.hitRadiusMeters ** 2) continue;
            const error = beforeTime + (attempt.songTime - beforeTime) * t - entry.note.time;
            if (error < -config.earlyGoodWindowSec || error > config.goodWindowSec || Math.abs(error) >= bestError) continue;
            best = entry;
            bestError = Math.abs(error);
            signedError = error;
        }
    }
    if (!best) return null;
    const grade = bestError <= config.perfectWindowSec ? 'perfect' : 'good';
    best.status = 'hit';
    best.judgement = grade;
    best.resolvedAt = attempt.songTime;
    return { noteId: best.note.id, grade, timingErrorSec: signedError };
}

export function markExpiredNotesAsMissed(noteStates: readonly NoteRuntimeState[], songTime: number,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): string[] {
    const ids: string[] = [];
    for (const entry of noteStates) {
        if (entry.status === 'pending' && songTime > entry.note.time + config.missWindowSec) {
            entry.status = 'missed';
            entry.judgement = null;
            entry.resolvedAt = songTime;
            ids.push(entry.note.id);
        }
    }
    return ids;
}
