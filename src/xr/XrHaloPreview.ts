// Opt-in integration preview, not the production musical-role policy (T08).
import { buildRhythmNoteRolePlan, MAX_RHYTHM_NOTE_ROLES, type RhythmNote, type RhythmNoteRolePlan } from '../gameplay';

/** Mark the first accepted note of existing phrases, at least 1.5 song seconds apart. */
export function buildHaloPreviewPlan(chart: readonly RhythmNote[]): RhythmNoteRolePlan {
    const phrases = new Set<number>();
    const assignments: { noteId: string; role: 'signal' }[] = [];
    let lastTime = -Infinity;
    for (const note of chart) {
        if (!Number.isInteger(note.phrase) || phrases.has(note.phrase!) || !Number.isFinite(note.time)) continue;
        phrases.add(note.phrase!);
        if (note.time - lastTime < 1.5) continue;
        assignments.push({ noteId: note.id, role: 'signal' });
        lastTime = note.time;
        if (assignments.length >= MAX_RHYTHM_NOTE_ROLES) break;
    }
    return buildRhythmNoteRolePlan(chart, assignments);
}
