// Minimal, renderer-independent role sidecar. Musical role selection and presentation are
// separate consumers; roles never change the accepted chart, judge, timing or score.
import type { RhythmNote } from './RhythmTypes';

export const RHYTHM_NOTE_ROLE_PLAN_VERSION = 1;
/** Offline sidecar bound, independent of the renderer's smaller visible-instance capacity. */
export const MAX_RHYTHM_NOTE_ROLES = 1024;
/** Legacy explicit assignments remain readable; the musical policy emits only the last three. */
export type RhythmNoteRoleKind = 'energy' | 'signal' | 'sync' | 'stabilize' | 'accent' | 'phrase' | 'section';
export const RHYTHM_NOTE_ROLE_KINDS: readonly RhythmNoteRoleKind[] = Object.freeze(['energy', 'signal', 'sync', 'stabilize', 'accent', 'phrase', 'section']);

export interface RhythmNoteRole {
    readonly noteId: string;
    readonly role: RhythmNoteRoleKind;
}

export interface RhythmNoteRolePlan {
    readonly version: typeof RHYTHM_NOTE_ROLE_PLAN_VERSION;
    readonly roles: readonly RhythmNoteRole[];
}

/**
 * Validates explicitly assigned roles against one accepted chart. No automatic musical meaning
 * is inferred here. First valid assignment per id wins; output follows chart order, capped at
 * 1024 roles. Unknown ids/kinds are ignored. Rebuild on chart publication, never per frame.
 */
export function buildRhythmNoteRolePlan(chart: readonly RhythmNote[], assignments: readonly RhythmNoteRole[] = []): RhythmNoteRolePlan {
    const chartIds = new Set(chart.map(note => note.id));
    const byId = new Map<string, RhythmNoteRoleKind>();
    for (const assignment of assignments) {
        if (assignment && chartIds.has(assignment.noteId) && !byId.has(assignment.noteId)
            && RHYTHM_NOTE_ROLE_KINDS.includes(assignment.role)) byId.set(assignment.noteId, assignment.role);
    }
    const roles: RhythmNoteRole[] = [];
    for (const note of chart) {
        const role = byId.get(note.id);
        if (!role) continue;
        roles.push(Object.freeze({ noteId: note.id, role }));
        byId.delete(note.id);
        if (roles.length >= MAX_RHYTHM_NOTE_ROLES) break;
    }
    return Object.freeze({ version: RHYTHM_NOTE_ROLE_PLAN_VERSION, roles: Object.freeze(roles) });
}
