// Presentation metadata derived once from the accepted chart and published sections.
// This is a salience proxy, not new audio analysis, event timing, judging or scoring.
import type { RhythmNote } from './RhythmTypes';
import { buildRhythmNoteRolePlan, MAX_RHYTHM_NOTE_ROLES, type RhythmNoteRole, type RhythmNoteRolePlan } from './RhythmNoteRoles';

export const MUSICAL_ROLE_GAP_SEC = 1.5;
export interface RhythmRoleSection { readonly start: number; readonly end: number; }

/**
 * Section > phrase > accent. One assignment per accepted note, at least 1.5 seconds apart.
 * Section: first note inside an actual published interval; phrase: first note of an authored
 * phrase; accent: strongest onset intensity in that phrase, >= .65 and >= local median + .10.
 * Simultaneous pair ties choose chart order. Higher-priority collisions suppress lower roles;
 * they never move a marker to an unrelated second note. No phrase/section data => no invention.
 * Offline overflow keeps section, then phrase, then accent, each in chronological order.
 */
export function buildRhythmMusicalRolePlan(chart: readonly RhythmNote[], sections: readonly RhythmRoleSection[] = []): RhythmNoteRolePlan {
    const notes = chart.filter(n => Number.isFinite(n.time)).slice().sort((a, b) => a.time - b.time);
    const candidates: RhythmNoteRole[][] = [[], [], []];
    const noteById = new Map(notes.map(n => [n.id, n]));
    const intervals = sections.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
        .slice().sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const section of intervals) {
        while (cursor < notes.length && notes[cursor].time < section.start) cursor++;
        const first = notes[cursor];
        if (first && first.time < section.end) candidates[0].push({ noteId: first.id, role: 'section' });
    }
    const phrases = new Map<number, RhythmNote[]>();
    for (const note of notes) if (Number.isInteger(note.phrase) && note.phrase! >= 0) {
        const group = phrases.get(note.phrase!) ?? [];
        group.push(note); phrases.set(note.phrase!, group);
    }
    for (const group of phrases.values()) {
        candidates[1].push({ noteId: group[0].id, role: 'phrase' });
        const intensities = group.map(n => n.intensity).filter(Number.isFinite).sort((a, b) => a - b);
        if (!intensities.length) continue;
        const middle = Math.floor(intensities.length / 2);
        const median = (intensities[middle] + intensities[Math.floor((intensities.length - 1) / 2)]) / 2;
        const strongest = group.reduce((best, n) => Number.isFinite(n.intensity) && n.intensity > best.intensity ? n : best,
            group.find(n => Number.isFinite(n.intensity))!);
        if (strongest.intensity >= .65 && strongest.intensity >= median + .10)
            candidates[2].push({ noteId: strongest.id, role: 'accent' });
    }
    const assignments: RhythmNoteRole[] = [], times: number[] = [], ids = new Set<string>();
    for (const level of candidates) for (const role of level.sort((a, b) => noteById.get(a.noteId)!.time - noteById.get(b.noteId)!.time)) {
        const time = noteById.get(role.noteId)!.time;
        if (ids.has(role.noteId) || times.some(t => Math.abs(t - time) < MUSICAL_ROLE_GAP_SEC)) continue;
        assignments.push(role); ids.add(role.noteId); times.push(time);
        if (assignments.length === MAX_RHYTHM_NOTE_ROLES) return buildRhythmNoteRolePlan(chart, assignments);
    }
    return buildRhythmNoteRolePlan(chart, assignments);
}
