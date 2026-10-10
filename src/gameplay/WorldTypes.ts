// World Formation contracts (ADR-010). Pure, renderer-independent, JSON-serializable data: no
// functions, Maps, Sets, Three.js types or runtime handles. The World Plan is authored once per
// chart from musical evidence; the interaction snapshot is the player's bounded effect on it.

import type { TrackSectionLabel } from '../types';
import type { JudgementGrade } from './RhythmTypes';

export const WORLD_PLAN_VERSION = 1;

/**
 * Macro stages of the world, in order: the Localhost hall activates, Seeder units construct, the
 * structures become the Tudatter information network, the Fenom anomaly is engaged (optional),
 * and the world settles.
 */
export type WorldEra = 'localhost' | 'seeder' | 'network' | 'fenom' | 'resolution';

/** Musical role of a phase, read from analyzer section labels (never from preset names). */
export type WorldRole = 'sparse' | 'groove' | 'build' | 'peak' | 'reflective' | 'outro';

/** Motion vocabulary of a phase: Seeder mechanics, Max order, Egis flow, Fenom tension, rest. */
export type WorldMotion = 'mechanical' | 'ordered' | 'organic' | 'tense' | 'calm';

/** Visual character channels, each in [0, 1]. The runtime crossfades between phase targets. */
export interface WorldCharacterMix {
    readonly industry: number;
    readonly construction: number;
    readonly lattice: number;
    readonly flow: number;
    readonly anomaly: number;
}

export interface WorldPhase {
    readonly index: number;
    readonly start: number;
    readonly end: number;
    readonly era: WorldEra;
    readonly role: WorldRole;
    readonly label: TrackSectionLabel | null;
    /** Section energy relative to the track's most energetic section, [0, 1]. */
    readonly energy: number;
    readonly motion: WorldMotion;
    readonly character: WorldCharacterMix;
    /** Crossfade from the previous phase's character, seconds. */
    readonly transitionSec: number;
}

export type WorldStructureKind = 'pylon' | 'conduit' | 'rib' | 'node' | 'ring';
/** Fixed structure slots per kind (the renderer owns their placement). */
export const WORLD_STRUCTURE_COUNTS: Readonly<Record<WorldStructureKind, number>> = { pylon: 12, conduit: 12, rib: 6, node: 8, ring: 3 };
/** Pylons standing (dim) before the music starts: the two nearest on each side. */
export const WORLD_PREBUILT_PYLONS = 4;

export interface WorldStructure {
    /** Stable id, e.g. "pylon-3". */
    readonly id: string;
    /** Index in `WorldPlan.structures`. */
    readonly index: number;
    readonly kind: WorldStructureKind;
    /** Index within its kind (renderer layout slot). */
    readonly slot: number;
    /** Era in which the structure is built. */
    readonly era: WorldEra;
    /** Stands from the start (dim until activation); its build window is empty. */
    readonly prebuilt: boolean;
    /**
     * Built during this song. Unscheduled structures (e.g. the Fenom rings of a song without an
     * encounter) never appear and do not count toward formation.
     */
    readonly scheduled: boolean;
    /** Authored construction window, song seconds (equal for prebuilt structures). */
    readonly buildStart: number;
    readonly buildEnd: number;
    /** Notes with contributionStart < time <= contributionEnd energize this structure. */
    readonly contributionStart: number;
    readonly contributionEnd: number;
    readonly noteCount: number;
}

/** Contextual world meaning of a special note (sidecar; the note itself is unchanged). */
export type WorldNoteRoleKind = 'energy' | 'signal' | 'sync' | 'stabilize';
export const WORLD_NOTE_ROLE_KINDS: readonly WorldNoteRoleKind[] = ['energy', 'signal', 'sync', 'stabilize'];

export interface WorldNoteRole {
    readonly noteId: string;
    /** Chart index at plan time (the session maps by id; this is for fixtures and diagnostics). */
    readonly noteIndex: number;
    readonly time: number;
    readonly role: WorldNoteRoleKind;
    /** Structure the role activates (-1 for encounter roles without one). */
    readonly structure: number;
}

export type WorldEventKind = 'activation' | 'transition' | 'surge' | 'scan' | 'reveal' | 'sync' | 'resolve';

export interface WorldEvent {
    /** Stable id, e.g. "surge-2". */
    readonly id: string;
    readonly kind: WorldEventKind;
    readonly time: number;
    readonly duration: number;
    /** [0, 1] */
    readonly strength: number;
    /** Choreography variant (0..3); consecutive surges never share one. */
    readonly variant: number;
    /** Era the event belongs to (for transitions: the era entered). */
    readonly era: WorldEra;
}

export type WorldEncounterStage = 'detection' | 'synchronization' | 'resolution';

/** The Fenom stabilization encounter: three consecutive stages on the song's own timeline. */
export interface WorldEncounter {
    readonly detectionStart: number;
    readonly syncStart: number;
    readonly syncEnd: number;
    readonly resolutionEnd: number;
    /** Phase index of the climax section. */
    readonly phase: number;
    readonly energy: number;
    /** Number of `sync` roles (field anchors). */
    readonly anchorCount: number;
    /** The lock note (`stabilize` role), or null when the window had no eligible note. */
    readonly stabilizeNoteId: string | null;
    /** Chart notes inside the synchronization window (their accuracy weighs into stability). */
    readonly syncNoteCount: number;
}

export interface WorldEraStart {
    readonly era: WorldEra;
    readonly start: number;
}

export interface WorldPlan {
    readonly version: typeof WORLD_PLAN_VERSION;
    /** Stable seed derived from the chart and sections (deterministic variation only). */
    readonly seed: number;
    readonly durationSec: number;
    /** Beat-level timing was trusted (>= 0.5 confidence); events are never snapped either way. */
    readonly timingReliable: boolean;
    /** Era starts, ascending; the first is always localhost at 0. */
    readonly eras: readonly WorldEraStart[];
    /** Contiguous cover of [0, durationSec]. */
    readonly phases: readonly WorldPhase[];
    readonly structures: readonly WorldStructure[];
    /** Sorted by time; at most `MAX_WORLD_ROLES`. */
    readonly roles: readonly WorldNoteRole[];
    /** Sorted by time; at most `MAX_WORLD_EVENTS`. */
    readonly events: readonly WorldEvent[];
    readonly encounter: WorldEncounter | null;
}

export const MAX_WORLD_ROLES = 48;
export const MAX_WORLD_EVENTS = 64;
/** Reactions kept in a snapshot (newest last) for short visual responses. */
export const MAX_WORLD_REACTIONS = 16;

export type WorldRoleStatus = 'pending' | 'hit' | 'missed';

export type WorldReactionKind = 'hit' | 'miss' | 'energize' | 'fault' | 'signal' | 'sync' | 'stabilize' | 'disrupt';

export interface WorldReaction {
    readonly kind: WorldReactionKind;
    /** Song time at which the note resolved. */
    readonly time: number;
    /** Structure affected (-1 none). */
    readonly structure: number;
    readonly grade: JudgementGrade | null;
}

export interface WorldEncounterProgress {
    readonly anchorsTotal: number;
    readonly anchorsHit: number;
    readonly anchorsMissed: number;
    /** null while the stabilize note is pending or absent. */
    readonly stabilizeHit: boolean | null;
    readonly syncNotesResolved: number;
    /** Accuracy credit summed over resolved notes inside the sync window. */
    readonly syncCredit: number;
    /** Field stability so far, [0, 1]. */
    readonly stability: number;
}

export interface WorldRoleTally {
    readonly total: number;
    readonly hit: number;
    readonly missed: number;
}

/** Frozen, reused while unchanged. Every array is a fresh copy per change (never live). */
export interface WorldInteractionSnapshot {
    /** Increments on every change within a run and on every reset. */
    readonly revision: number;
    /** Mean structure quality over all structures, [0, 1]. */
    readonly formation: number;
    /** Recent accuracy, [0, 1]; 0.5 at a run reset. */
    readonly coherence: number;
    readonly hits: number;
    readonly misses: number;
    readonly resolved: number;
    readonly structureQuality: readonly number[];
    /** Song time an energy role completed the structure early (-1 none). */
    readonly structureEnergizedAt: readonly number[];
    /** Song time an energy or signal role was missed (-1 none). */
    readonly structureFaultAt: readonly number[];
    readonly roleStatus: readonly WorldRoleStatus[];
    readonly roleTally: Readonly<Record<WorldNoteRoleKind, WorldRoleTally>>;
    readonly encounter: WorldEncounterProgress | null;
    readonly reactions: readonly WorldReaction[];
}

export type WorldOutcomeClass = 'stabilized' | 'contained' | 'unstable' | 'formed' | 'partial' | 'fragmented';

/** The end-of-run world result, always available (with or without an encounter). */
export interface WorldOutcome {
    readonly outcome: WorldOutcomeClass;
    readonly title: string;
    readonly formation: number;
    readonly coherence: number;
    /** Field stability when the song had an encounter, else null. */
    readonly stability: number | null;
    readonly anchorsHit: number;
    readonly anchorsTotal: number;
}

export const NEUTRAL_CHARACTER: WorldCharacterMix = Object.freeze({ industry: 1, construction: 0, lattice: 0, flow: 0, anomaly: 0 });

/**
 * A valid plan for no music (or an unusable track): the dormant Localhost hall -- one quiet phase,
 * only the prebuilt pylons, no roles, events or encounter.
 */
export function createEmptyWorldPlan(durationSec = 0): WorldPlan {
    const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const structures: WorldStructure[] = Array.from({ length: WORLD_PREBUILT_PYLONS }, (_, slot) => ({
        id: `pylon-${slot}`, index: slot, kind: 'pylon', slot, era: 'localhost', prebuilt: true, scheduled: true, buildStart: 0, buildEnd: 0,
        contributionStart: 0, contributionEnd: 0, noteCount: 0 }));
    return {
        version: WORLD_PLAN_VERSION, seed: 0, durationSec: duration, timingReliable: false,
        eras: [{ era: 'localhost', start: 0 }],
        phases: [{ index: 0, start: 0, end: duration, era: 'localhost', role: 'sparse', label: null, energy: 0, motion: 'calm',
            character: NEUTRAL_CHARACTER, transitionSec: 0 }],
        structures, roles: [], events: [], encounter: null
    };
}
