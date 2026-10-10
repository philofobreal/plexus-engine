// Musical World Director (ADR-010): builds the authored World Plan once per chart from musical
// evidence that is already published -- analyzer sections and cues, timing confidence, the
// automation plan's renderer-independent meta and the accepted chart. Pure and deterministic:
// identical inputs give a byte-identical plan; variation comes only from a seed hashed from the
// inputs. It never derives beats or onsets, never reads preset names and never edits a note.
//
// Music decides WHEN and HOW the world evolves (eras, phases, build windows, events, the
// encounter); the player's accepted results only decide HOW WELL (WorldInteractionSession).

import type { MovementGesture, PerformanceAutomationMeta, TrackSectionLabel, VisualCueKind } from '../types';
import type { RhythmNote } from './RhythmTypes';
import {
    createEmptyWorldPlan, MAX_WORLD_EVENTS, MAX_WORLD_ROLES, WORLD_PLAN_VERSION, WORLD_PREBUILT_PYLONS, WORLD_STRUCTURE_COUNTS,
    type WorldCharacterMix, type WorldEncounter, type WorldEra, type WorldEraStart, type WorldEvent, type WorldMotion, type WorldNoteRole,
    type WorldNoteRoleKind, type WorldPhase, type WorldPlan, type WorldRole, type WorldStructure, type WorldStructureKind
} from './WorldTypes';

/** The subset of an analyzer `TrackSection` the director reads. */
export interface WorldSectionSource {
    readonly start: number;
    readonly end: number;
    readonly label: TrackSectionLabel;
    readonly energy?: number;
}

/** The subset of an analyzer `VisualCueEvent` the director reads. */
export interface WorldCueSource {
    readonly time: number;
    readonly intensity: number;
    readonly confidence: number;
    readonly kind: VisualCueKind;
}

export interface WorldSource {
    readonly durationSec: number;
    /** The accepted chart (read only; roles are a sidecar by note id). */
    readonly chart: readonly RhythmNote[];
    readonly sections?: readonly WorldSectionSource[];
    readonly cues?: readonly WorldCueSource[];
    /** Overall analyzer timing confidence, [0, 1]. */
    readonly timingConfidence?: number;
    /** Automation plan points (only `time` and the renderer-independent `meta` are read). */
    readonly planPoints?: readonly { readonly time: number; readonly meta?: PerformanceAutomationMeta }[];
}

// ---- Tunables (documented in ADR-010) ----------------------------------------------------
const MIN_SECTION_SEC = 0.5;
const MAX_SEGMENTS = 96;
const ROLE_SPACING_SEC = 1.5;
const ENCOUNTER_MIN_POSITION = 0.35;
const ENCOUNTER_MIN_SEC = 12;
const ENCOUNTER_MIN_NOTES = 8;
const ENCOUNTER_DETECTION_SEC = 8;
const ENCOUNTER_MAX_SYNC_SEC = 40;
const ENCOUNTER_RESOLUTION_SEC = 8;
const SCAN_MIN_GAP_SEC = 8;
const SCAN_MIN_CONFIDENCE = 0.6;
const SCAN_MIN_CONFIDENCE_WEAK_TIMING = 0.75;
const MAX_TRANSITION_SEC = 4;
const ACTIVATION_DURATION_SEC = 3;
const NEUTRAL_SECTION_ENERGY = 0.5;

const LABEL_ROLE: Readonly<Record<TrackSectionLabel, WorldRole>> = {
    intro: 'sparse', verse: 'groove', build: 'build', drop: 'peak', peak: 'peak', break: 'reflective', outro: 'outro'
};
const ENERGETIC: ReadonlySet<WorldRole> = new Set(['groove', 'build', 'peak']);
const ORDERED_GESTURES: ReadonlySet<MovementGesture> = new Set(['pulse', 'lock', 'slice', 'drive', 'tunnel']);
const ORGANIC_GESTURES: ReadonlySet<MovementGesture> = new Set(['orbit', 'ripple', 'swarm', 'bloom', 'fade', 'echo']);
const MECHANICAL_GESTURES: ReadonlySet<MovementGesture> = new Set(['expand', 'collapse', 'fragment', 'scatter']);
const CLIMAX_SITUATIONS: ReadonlySet<string> = new Set(['drop-short', 'drop-long', 'drop-after-build', 'peak-sustain']);

// ---- Deterministic hashing ----------------------------------------------------------------
function fnv1a(text: string, hash = 0x811c9dc5): number {
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
/** Order-independent unit value in [0, 1) for (seed, salt). */
function seededUnit(seed: number, salt: string): number {
    return fnv1a(salt, seed ^ 0x9e3779b9) / 4294967296;
}
const ms = (value: number) => Math.round(value * 1000);

interface Segment {
    start: number;
    end: number;
    label: TrackSectionLabel | null;
    role: WorldRole;
    energy: number;
    meta: PerformanceAutomationMeta | undefined;
}

interface IndexedNote { readonly note: RhythmNote; readonly index: number }

// ---- Input normalization ------------------------------------------------------------------
function normalizeNotes(chart: readonly RhythmNote[], duration: number): IndexedNote[] {
    return (Array.isArray(chart) ? chart : [])
        .map((note, index) => ({ note, index }))
        .filter(({ note }) => note && typeof note.id === 'string' && Number.isFinite(note.time) && note.time >= 0 && note.time <= duration)
        .sort((a, b) => a.note.time - b.note.time || a.index - b.index);
}

/**
 * Sorted, clipped, non-overlapping sections covering [0, duration]; gaps become unlabeled
 * segments. Without sections the whole song is one neutral segment.
 */
function normalizeSegments(source: WorldSource, duration: number): Segment[] {
    const raw = (source.sections ?? [])
        .filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.label in LABEL_ROLE)
        .map(s => ({ start: Math.max(0, s.start), end: Math.min(duration, s.end), label: s.label,
            energy: Number.isFinite(s.energy) && (s.energy as number) >= 0 ? (s.energy as number) : NEUTRAL_SECTION_ENERGY }))
        .filter(s => s.end - s.start >= MIN_SECTION_SEC)
        .sort((a, b) => a.start - b.start || a.end - b.end);
    const segments: Segment[] = [];
    let cursor = 0;
    for (const s of raw) {
        const start = Math.max(s.start, cursor);
        if (s.end - start < MIN_SECTION_SEC) continue;
        // A real gap becomes an unlabeled segment; a tiny one is absorbed by this section.
        const gap = start - cursor >= MIN_SECTION_SEC;
        if (gap) segments.push({ start: cursor, end: start, label: null, role: 'groove', energy: NEUTRAL_SECTION_ENERGY, meta: undefined });
        segments.push({ start: gap ? start : cursor, end: s.end, label: s.label, role: LABEL_ROLE[s.label], energy: s.energy, meta: undefined });
        cursor = s.end;
    }
    if (duration - cursor >= MIN_SECTION_SEC || !segments.length) {
        segments.push({ start: cursor, end: duration, label: null, role: segments.length ? 'outro' : 'groove', energy: NEUTRAL_SECTION_ENERGY, meta: undefined });
    } else segments[segments.length - 1].end = duration;
    if (segments.length > 1 && segments[0].label === null && segments[0].role === 'groove') segments[0].role = 'sparse';
    // Bound the phase count: merge the shortest segment into its shorter neighbour.
    while (segments.length > MAX_SEGMENTS) {
        let shortest = 0;
        for (let i = 1; i < segments.length; i++) if (segments[i].end - segments[i].start < segments[shortest].end - segments[shortest].start) shortest = i;
        const into = shortest === 0 ? 1 : shortest === segments.length - 1 ? shortest - 1
            : (segments[shortest - 1].end - segments[shortest - 1].start <= segments[shortest + 1].end - segments[shortest + 1].start ? shortest - 1 : shortest + 1);
        segments[into].start = Math.min(segments[into].start, segments[shortest].start);
        segments[into].end = Math.max(segments[into].end, segments[shortest].end);
        segments.splice(shortest, 1);
    }
    const maxEnergy = Math.max(...segments.map(s => s.energy), 1e-6);
    for (const s of segments) s.energy = Math.min(1, s.energy / maxEnergy);
    // The automation meta governing each segment: the last point at or before its start (+0.5 s),
    // otherwise the first point inside it.
    const points = (source.planPoints ?? []).filter(p => p && Number.isFinite(p.time)).slice().sort((a, b) => a.time - b.time);
    for (const s of segments) {
        let meta: PerformanceAutomationMeta | undefined;
        for (const p of points) {
            if (p.time <= s.start + 0.5) meta = p.meta ?? meta;
            else { if (!meta && p.time < s.end) meta = p.meta; break; }
        }
        s.meta = meta;
    }
    return segments;
}

// ---- Era planning -------------------------------------------------------------------------
interface EraPlan {
    activation: number;
    seederStart: number;
    networkStart: number;
    resolutionStart: number;
    encounter: { segment: number; detectionStart: number; syncStart: number; syncEnd: number; resolutionEnd: number } | null;
}

const isClimaxMeta = (meta: PerformanceAutomationMeta | undefined) =>
    meta?.globalArcRole === 'climax' || (meta?.automationSituation !== undefined && CLIMAX_SITUATIONS.has(meta.automationSituation));

function countNotes(notes: readonly IndexedNote[], from: number, to: number): number {
    let count = 0;
    for (const { note } of notes) if (note.time >= from && note.time < to) count++;
    return count;
}

function planEras(segments: readonly Segment[], notes: readonly IndexedNote[], duration: number): EraPlan {
    const minEra = Math.min(16, Math.max(4, duration * 0.06));
    const firstEnergetic = segments.find(s => ENERGETIC.has(s.role));
    // The first published onset that became a target is the first recognizable musical activity.
    const activation = notes.length ? notes[0].note.time : firstEnergetic ? firstEnergetic.start : duration * 0.1;
    const firstStartAfter = (time: number, accept: (s: Segment, i: number) => boolean) => {
        for (let i = 0; i < segments.length; i++) if (segments[i].start >= time && accept(segments[i], i)) return segments[i].start;
        return null;
    };
    // Construction starts with the first energetic music after the hall has had time to activate:
    // at that section's start, or inside it when it is already playing.
    const seederEarliest = activation + minEra;
    const energetic = segments.find(s => ENERGETIC.has(s.role) && s.end > seederEarliest + 1);
    const seederStart = Math.min(duration, energetic ? Math.max(energetic.start, seederEarliest)
        : firstStartAfter(seederEarliest, () => true) ?? activation + Math.max(minEra, 0.15 * duration));

    // The Fenom climax: a drop/peak late enough for the world to have formed, long and dense enough
    // to play an encounter in. Score: energy, position, a preceding build, the automation's climax role.
    let encounter: EraPlan['encounter'] = null, best = -Infinity;
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (s.role !== 'peak' || s.label === null) continue;
        if (s.start < ENCOUNTER_MIN_POSITION * duration || s.start < seederStart + 2 * minEra + ENCOUNTER_DETECTION_SEC) continue;
        if (s.end - s.start < ENCOUNTER_MIN_SEC) continue;
        const syncEnd = Math.min(s.end, s.start + ENCOUNTER_MAX_SYNC_SEC);
        if (countNotes(notes, s.start, syncEnd) < ENCOUNTER_MIN_NOTES) continue;
        // A returning peak (after a reflective section) lets the network form before the anomaly.
        const returning = segments.slice(0, i).some(p => p.role === 'reflective');
        const score = 0.5 * s.energy + 0.3 * (s.start / duration) + 0.1 * (segments[i - 1]?.role === 'build' ? 1 : 0)
            + 0.1 * (returning ? 1 : 0) + 0.1 * (isClimaxMeta(s.meta) ? 1 : 0);
        if (score >= best) {
            best = score;
            encounter = { segment: i, detectionStart: Math.max(seederStart + minEra, s.start - ENCOUNTER_DETECTION_SEC), syncStart: s.start,
                syncEnd, resolutionEnd: Math.min(duration, syncEnd + ENCOUNTER_RESOLUTION_SEC) };
        }
    }

    // The information network: after the first reflective section or the section after a peak,
    // late enough for construction to read; never after the encounter's detection.
    const networkEarliest = seederStart + Math.max(2 * minEra, 0.15 * duration);
    let networkStart = firstStartAfter(networkEarliest, (s, i) => s.role === 'reflective' || segments[i - 1]?.role === 'peak')
        ?? firstStartAfter(seederStart + 0.35 * (duration - seederStart), () => true)
        ?? seederStart + 0.4 * (duration - seederStart);
    if (encounter) networkStart = Math.max(seederStart + minEra, Math.min(networkStart, encounter.detectionStart));
    networkStart = Math.min(networkStart, duration);

    // The world settles in a published outro; otherwise only over the song's last seconds, so a
    // final peak still plays in the developed network. No sliver of an era in between.
    const last = segments[segments.length - 1];
    const settled = encounter ? encounter.resolutionEnd : networkStart + minEra;
    const tail = Math.max(settled, duration - Math.min(8, 0.08 * duration));
    let resolutionStart = last.role === 'outro' && last.end > settled + 1 ? Math.max(last.start, settled)
        : tail <= settled || tail - settled >= minEra ? tail : duration;
    if (resolutionStart >= duration - 1) resolutionStart = duration;
    return { activation, seederStart, networkStart, resolutionStart, encounter };
}

function eraStarts(eras: EraPlan, duration: number): WorldEraStart[] {
    const starts: WorldEraStart[] = [{ era: 'localhost', start: 0 }];
    const push = (era: WorldEra, start: number) => {
        if (!(start < duration)) return;
        const last = starts[starts.length - 1];
        if (start <= last.start) { if (last.start === start && starts.length > 1) starts[starts.length - 1] = { era, start }; return; }
        if (last.era !== era) starts.push({ era, start });
    };
    push('seeder', eras.seederStart);
    if (eras.encounter && eras.encounter.detectionStart <= eras.networkStart) {
        push('fenom', eras.encounter.detectionStart);
        push('network', eras.encounter.resolutionEnd);
    } else {
        push('network', eras.networkStart);
        if (eras.encounter) { push('fenom', eras.encounter.detectionStart); push('network', eras.encounter.resolutionEnd); }
    }
    push('resolution', eras.resolutionStart);
    return starts;
}

// ---- Phases -------------------------------------------------------------------------------
function motionOf(era: WorldEra, role: WorldRole, meta: PerformanceAutomationMeta | undefined): WorldMotion {
    if (era === 'fenom') return 'tense';
    if (era === 'resolution' || role === 'outro' || role === 'sparse') return 'calm';
    const gesture = meta?.movementGesture;
    if (gesture && ORGANIC_GESTURES.has(gesture)) return 'organic';
    if (gesture && ORDERED_GESTURES.has(gesture)) return era === 'localhost' || era === 'seeder' ? 'mechanical' : 'ordered';
    if (gesture && MECHANICAL_GESTURES.has(gesture)) return 'mechanical';
    if (role === 'reflective') return 'organic';
    return era === 'network' ? 'ordered' : 'mechanical';
}

const mix = (industry: number, construction: number, lattice: number, flow: number, anomaly: number): WorldCharacterMix =>
    Object.freeze({ industry: round3(industry), construction: round3(construction), lattice: round3(lattice), flow: round3(flow), anomaly: round3(anomaly) });
function round3(value: number): number { return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000; }

function characterOf(era: WorldEra, role: WorldRole, energy: number, beforeActivation: boolean, stage: string | null,
    encounterPlanned: boolean, afterEncounter: boolean): WorldCharacterMix {
    // After the encounter the contained (or still unstable) anomaly stays in view, so its outcome reads.
    const residual = afterEncounter ? 0.3 : 0;
    switch (era) {
        case 'localhost': return beforeActivation ? mix(0.18, 0, 0, 0, 0) : mix(0.55 + 0.45 * energy, 0.12, 0, 0, 0);
        case 'seeder': return mix(0.75 + 0.25 * energy, 0.6 + 0.4 * energy, 0.1, role === 'reflective' ? 0.15 : 0, 0);
        case 'network':
            if (role === 'reflective') return mix(0.4, 0.25, 0.55, 1, residual);
            if (role === 'peak') return mix(0.55, 0.45, 1, 0.65, residual);
            return mix(0.5, 0.35, 0.75 + 0.25 * energy, 0.35 + 0.2 * energy, residual);
        case 'fenom': return mix(0.4, 0.35, 0.85, 0.6, stage === 'detection' ? 0.55 : stage === 'resolution' ? 0.8 : 1);
        case 'resolution': return mix(0.45, 0.15, 0.75, 0.55, encounterPlanned ? 0.35 : 0);
    }
}

function buildPhases(segments: readonly Segment[], eras: EraPlan, starts: readonly WorldEraStart[], duration: number): WorldPhase[] {
    const cuts = new Set<number>([eras.activation, ...starts.map(e => e.start)]);
    if (eras.encounter) for (const t of [eras.encounter.syncStart, eras.encounter.syncEnd]) cuts.add(t);
    const sortedCuts = [...cuts].filter(t => t > 0 && t < duration).sort((a, b) => a - b);
    const phases: WorldPhase[] = [];
    const eraAtTime = (time: number) => { let era: WorldEra = 'localhost'; for (const e of starts) if (e.start <= time) era = e.era; return era; };
    for (const s of segments) {
        const bounds = [s.start, ...sortedCuts.filter(t => t > s.start + 1e-6 && t < s.end - 1e-6), s.end];
        for (let i = 0; i < bounds.length - 1; i++) {
            const start = bounds[i], end = bounds[i + 1];
            if (end - start < 1e-6) continue;
            const era = eraAtTime(start);
            const e = eras.encounter;
            const stage = era === 'fenom' && e ? (start < e.syncStart ? 'detection' : start < e.syncEnd ? 'synchronization' : 'resolution') : null;
            phases.push({ index: phases.length, start: round3s(start), end: round3s(end), era, role: s.role, label: s.label,
                energy: round3(s.energy), motion: motionOf(era, s.role, s.meta),
                character: characterOf(era, s.role, s.energy, start < eras.activation, stage, e !== null, e !== null && start >= e.resolutionEnd),
                transitionSec: round3s(Math.min(MAX_TRANSITION_SEC, Math.max(0.25, 0.5 * (end - start)))) });
        }
    }
    if (phases.length) { phases[0] = { ...phases[0], start: 0, transitionSec: 0 }; phases[phases.length - 1] = { ...phases[phases.length - 1], end: round3s(duration) }; }
    return phases;
}
function round3s(value: number): number { return Math.round(value * 1000) / 1000; }

// ---- Structures ---------------------------------------------------------------------------
/** Energy-weighted song progression: faster construction in energetic sections. */
class Progression {
    private readonly cumulative: number[] = [0];
    private readonly segments: readonly Segment[];
    constructor(segments: readonly Segment[]) {
        this.segments = segments;
        for (const s of segments) this.cumulative.push(this.cumulative[this.cumulative.length - 1] + (s.end - s.start) * this.weight(s));
    }
    private weight(s: Segment): number { return 0.35 + 0.65 * s.energy; }
    at(time: number): number {
        for (let i = 0; i < this.segments.length; i++) {
            const s = this.segments[i];
            if (time < s.end || i === this.segments.length - 1) return this.cumulative[i] + Math.max(0, Math.min(time, s.end) - s.start) * this.weight(s);
        }
        return 0;
    }
    /** Inverse of `at` (time at which the progression reaches `value`). */
    timeOf(value: number): number {
        for (let i = 0; i < this.segments.length; i++) {
            if (value <= this.cumulative[i + 1] || i === this.segments.length - 1) {
                const s = this.segments[i];
                return Math.min(s.end, s.start + Math.max(0, value - this.cumulative[i]) / this.weight(s));
            }
        }
        return 0;
    }
}

interface StructureDraft {
    kind: WorldStructureKind;
    slot: number;
    era: WorldEra;
    prebuilt: boolean;
    scheduled: boolean;
    buildStart: number;
    buildEnd: number;
}

/**
 * Spreads `items` over [from, to] along the energy-weighted progression: item k completes at the
 * (k + 1) / count point, construction lasting part of the spacing.
 */
function schedule(items: StructureDraft[], from: number, to: number, progression: Progression): void {
    if (!items.length) return;
    const span = Math.max(0, to - from);
    if (span <= 0.5) { for (const item of items) item.scheduled = false; return; }
    const p0 = progression.at(from), p1 = progression.at(to);
    let previous = from;
    items.forEach((item, k) => {
        const end = Math.max(previous + 0.25, Math.min(to, progression.timeOf(p0 + (p1 - p0) * (k + 1) / items.length)));
        const duration = Math.min(6, Math.max(1.5, 0.6 * (end - previous)));
        item.buildEnd = round3s(Math.min(to, end));
        item.buildStart = round3s(Math.max(from, item.buildEnd - duration));
        item.scheduled = true;
        previous = item.buildEnd;
    });
}

function buildStructures(eras: EraPlan, progression: Progression, duration: number, seed: number): StructureDraft[] {
    const draft = (kind: WorldStructureKind, slot: number, era: WorldEra): StructureDraft =>
        ({ kind, slot, era, prebuilt: false, scheduled: false, buildStart: 0, buildEnd: 0 });
    const pylons = Array.from({ length: WORLD_STRUCTURE_COUNTS.pylon }, (_, slot) => draft('pylon', slot, slot < WORLD_PREBUILT_PYLONS ? 'localhost' : 'seeder'));
    for (let slot = 0; slot < WORLD_PREBUILT_PYLONS; slot++) Object.assign(pylons[slot], { prebuilt: true, scheduled: true });
    const conduits = Array.from({ length: WORLD_STRUCTURE_COUNTS.conduit }, (_, slot) => draft('conduit', slot, 'seeder'));
    const ribs = Array.from({ length: WORLD_STRUCTURE_COUNTS.rib }, (_, slot) => draft('rib', slot, 'seeder'));
    const nodes = Array.from({ length: WORLD_STRUCTURE_COUNTS.node }, (_, slot) => draft('node', slot, 'network'));
    const rings = Array.from({ length: WORLD_STRUCTURE_COUNTS.ring }, (_, slot) => draft('ring', slot, 'fenom'));

    // Seeder sequence: reconnect the standing pylons, then raise each further pair (side order
    // seeded), wire it, and span it with a rib once both pylons stand.
    const sequence: StructureDraft[] = [];
    const depths = WORLD_STRUCTURE_COUNTS.pylon / 2;
    for (let depth = 0; depth < depths; depth++) {
        const leftFirst = seededUnit(seed, `side-${depth}`) < 0.5;
        const pair = leftFirst ? [2 * depth, 2 * depth + 1] : [2 * depth + 1, 2 * depth];
        if (2 * depth >= WORLD_PREBUILT_PYLONS) for (const slot of pair) sequence.push(pylons[slot]);
        for (const slot of pair) sequence.push(conduits[slot]);
        if (depth < ribs.length) sequence.push(ribs[depth]);
    }
    const seederEnd = Math.max(eras.seederStart, Math.min(eras.networkStart, eras.encounter?.detectionStart ?? Infinity));
    // A world without a network era still finishes its hall before the song ends.
    schedule(sequence, eras.seederStart, seederEnd > eras.seederStart + 4 ? seederEnd : Math.min(duration, eras.seederStart + Math.max(4, 0.6 * (duration - eras.seederStart))), progression);

    // Lattice nodes grow the network; a short network era borrows the following time.
    const nodesFrom = Math.min(eras.networkStart, duration);
    let nodesTo = eras.encounter && eras.encounter.detectionStart > nodesFrom ? eras.encounter.detectionStart : eras.resolutionStart;
    if (nodesTo - nodesFrom < 8) nodesTo = Math.min(duration, Math.max(nodesTo, nodesFrom + 8));
    if (nodesFrom < duration - 1) schedule(nodes, nodesFrom, nodesTo, progression);
    if (eras.encounter) schedule(rings, eras.encounter.detectionStart, eras.encounter.syncStart, progression);
    return [...pylons, ...conduits, ...ribs, ...nodes, ...rings];
}

// ---- Roles --------------------------------------------------------------------------------
class RoleBook {
    readonly roles: WorldNoteRole[] = [];
    private readonly taken = new Set<string>();
    private readonly times: number[] = [];
    clear(time: number): boolean {
        let lo = 0, hi = this.times.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.times[mid] < time) lo = mid + 1; else hi = mid; }
        return (lo === 0 || time - this.times[lo - 1] >= ROLE_SPACING_SEC) && (lo === this.times.length || this.times[lo] - time >= ROLE_SPACING_SEC);
    }
    /** Strongest eligible note in (from, to] (ties: earliest, then chart order). */
    pick(notes: readonly IndexedNote[], from: number, to: number, inclusiveStart = false): IndexedNote | null {
        let best: IndexedNote | null = null;
        for (const entry of notes) {
            const t = entry.note.time;
            if (t > to) break;
            if (inclusiveStart ? t < from : t <= from) continue;
            if (entry.note.pairId || this.taken.has(entry.note.id) || !this.clear(t)) continue;
            if (!best || entry.note.intensity > best.note.intensity) best = entry;
        }
        return best;
    }
    add(entry: IndexedNote, role: WorldNoteRoleKind, structure: number): boolean {
        if (this.roles.length >= MAX_WORLD_ROLES) return false;
        this.taken.add(entry.note.id);
        let lo = 0, hi = this.times.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.times[mid] < entry.note.time) lo = mid + 1; else hi = mid; }
        this.times.splice(lo, 0, entry.note.time);
        this.roles.push({ noteId: entry.note.id, noteIndex: entry.index, time: entry.note.time, role, structure });
        return true;
    }
}

// ---- Events -------------------------------------------------------------------------------
const EVENT_ORDER: Readonly<Record<WorldEvent['kind'], number>> = { activation: 0, transition: 1, reveal: 2, sync: 3, resolve: 4, surge: 5, scan: 6 };

function buildEvents(source: WorldSource, segments: readonly Segment[], eras: EraPlan, starts: readonly WorldEraStart[], duration: number,
    seed: number, timingReliable: boolean): WorldEvent[] {
    const events: WorldEvent[] = [];
    const add = (kind: WorldEvent['kind'], time: number, durationSec: number, strength: number, variant: number, era: WorldEra) =>
        events.push({ id: '', kind, time: round3s(time), duration: round3s(durationSec), strength: round3(strength), variant, era });
    if (eras.activation < duration) add('activation', eras.activation, ACTIVATION_DURATION_SEC, 0.6, 0, 'localhost');
    for (const e of starts) if (e.start > 0) add('transition', e.start, MAX_TRANSITION_SEC, 0.5, 0, e.era);
    const e = eras.encounter;
    if (e) {
        add('reveal', e.detectionStart, e.syncStart - e.detectionStart, 0.7, 0, 'fenom');
        add('sync', e.syncStart, e.syncEnd - e.syncStart, segments[e.segment].energy, 0, 'fenom');
        add('resolve', e.syncEnd, e.resolutionEnd - e.syncEnd, 0.6, 0, 'fenom');
    }
    // Surges at published drop/peak sections; repeated drops never repeat the previous variant,
    // and a peak returning after a reflective section arrives stronger.
    let previousVariant = -1;
    const surgeTimes: number[] = [];
    segments.forEach((s, i) => {
        if (s.role !== 'peak' || s.label === null) return;
        let variant = Math.floor(seededUnit(seed, `surge-${i}`) * 3);
        if (variant === previousVariant) variant = (variant + 1) % 3;
        previousVariant = variant;
        const returning = segments.slice(0, i).some(p => p.role === 'reflective');
        const era = [...starts].reverse().find(x => x.start <= s.start)?.era ?? 'localhost';
        add('surge', s.start, Math.min(6, s.end - s.start), Math.min(1, s.energy + (returning ? 0.15 : 0)), variant, era);
        surgeTimes.push(s.start);
    });
    // Drone scans at strong, confident cues (onset evidence; never snapped to a grid).
    const minConfidence = timingReliable ? SCAN_MIN_CONFIDENCE : SCAN_MIN_CONFIDENCE_WEAK_TIMING;
    let lastScan = -Infinity;
    const cues = (source.cues ?? []).filter(c => c && Number.isFinite(c.time) && c.time >= 0 && c.time < duration
        && Number.isFinite(c.confidence) && c.confidence >= minConfidence && Number.isFinite(c.intensity) && c.intensity >= 0.5)
        .slice().sort((a, b) => a.time - b.time);
    for (const cue of cues) {
        if (cue.time - lastScan < SCAN_MIN_GAP_SEC || surgeTimes.some(t => Math.abs(t - cue.time) < 2)) continue;
        lastScan = cue.time;
        const era = [...starts].reverse().find(x => x.start <= cue.time)?.era ?? 'localhost';
        add('scan', cue.time, 2.5, Math.min(1, cue.intensity), Math.floor(seededUnit(seed, `scan-${ms(cue.time)}`) * 4), era);
    }
    // Bounded: the weakest scans go first.
    while (events.length > MAX_WORLD_EVENTS) {
        let weakest = -1;
        for (let i = 0; i < events.length; i++) if (events[i].kind === 'scan' && (weakest < 0 || events[i].strength < events[weakest].strength)) weakest = i;
        events.splice(weakest < 0 ? events.length - 1 : weakest, 1);
    }
    events.sort((a, b) => a.time - b.time || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]);
    const counters: Partial<Record<WorldEvent['kind'], number>> = {};
    return events.map(event => ({ ...event, id: `${event.kind}-${(counters[event.kind] = (counters[event.kind] ?? -1) + 1)}` }));
}

// ---- Entry point --------------------------------------------------------------------------
export function worldSeed(source: WorldSource, notes: readonly IndexedNote[], duration: number): number {
    let hash = fnv1a(`world|${ms(duration)}|${notes.length}`);
    for (const { note } of notes) hash = fnv1a(`${note.id}@${ms(note.time)}`, hash);
    for (const s of source.sections ?? []) if (s && Number.isFinite(s.start)) hash = fnv1a(`${ms(s.start)}:${s.label}`, hash);
    return hash;
}

/**
 * Builds the World Plan. Always returns a valid plan: an unusable duration gives the dormant hall
 * (`createEmptyWorldPlan`), sparse or ambiguous music a calmer world without an encounter.
 */
export function buildWorldPlan(source: WorldSource): WorldPlan {
    const duration = source && Number.isFinite(source.durationSec) && source.durationSec > 0 ? source.durationSec : 0;
    if (duration <= 0) return createEmptyWorldPlan(0);
    const notes = normalizeNotes(source.chart, duration);
    const segments = normalizeSegments(source, duration);
    const timingReliable = Number.isFinite(source.timingConfidence) && (source.timingConfidence as number) >= 0.5;
    const seed = worldSeed(source, notes, duration);
    const eras = planEras(segments, notes, duration);
    const starts = eraStarts(eras, duration);
    const phases = buildPhases(segments, eras, starts, duration);
    const progression = new Progression(segments);
    const drafts = buildStructures(eras, progression, duration, seed);

    // Contribution windows: the standing pylons share the time up to construction; every built
    // structure takes the notes since the previous build end (notes after the last feed coherence only).
    const order = drafts.map((d, index) => ({ d, index })).filter(({ d }) => d.scheduled && !d.prebuilt)
        .sort((a, b) => a.d.buildEnd - b.d.buildEnd || a.index - b.index);
    const windows = new Map<number, [number, number]>();
    let cursor = -1;
    const prebuilt = drafts.map((d, index) => ({ d, index })).filter(({ d }) => d.prebuilt);
    const hallEnd = Math.max(eras.activation, Math.min(eras.seederStart, order[0]?.d.buildStart ?? eras.seederStart));
    prebuilt.forEach(({ index }, k) => {
        const end = round3s(prebuilt.length ? eras.activation + (hallEnd - eras.activation) * (k + 1) / prebuilt.length : hallEnd);
        windows.set(index, [cursor, end]); cursor = Math.max(cursor, end);
    });
    for (const { d, index } of order) { const end = Math.max(cursor, d.buildEnd); windows.set(index, [cursor, end]); cursor = end; }
    const structures: WorldStructure[] = drafts.map((d, index) => {
        const [from, to] = windows.get(index) ?? [0, 0];
        return { id: `${d.kind}-${d.slot}`, index, kind: d.kind, slot: d.slot, era: d.era, prebuilt: d.prebuilt, scheduled: d.scheduled,
            buildStart: d.scheduled ? d.buildStart : 0, buildEnd: d.scheduled ? d.buildEnd : 0,
            contributionStart: windows.has(index) ? from : 0, contributionEnd: windows.has(index) ? to : 0,
            noteCount: windows.has(index) ? notes.filter(({ note }) => note.time > from && note.time <= to).length : 0 };
    });

    // Special roles. Encounter roles first (they matter most), then energy (pylons and ribs) and
    // signal (lattice nodes) in their contribution windows; spacing and caps are global.
    const book = new RoleBook();
    let encounter: WorldEncounter | null = null;
    const e = eras.encounter;
    if (e) {
        const syncNotes = notes.filter(({ note }) => note.time >= e.syncStart && note.time < e.syncEnd).length;
        const anchorsTarget = Math.max(3, Math.min(8, Math.round(syncNotes / 6)));
        const lockFrom = e.syncStart + 0.8 * (e.syncEnd - e.syncStart);
        const lock = book.pick(notes, lockFrom, e.syncEnd - 1e-6, true);
        if (lock) book.add(lock, 'stabilize', -1);
        let anchors = 0;
        const rings = structures.filter(s => s.kind === 'ring');
        for (let k = 0; k < anchorsTarget; k++) {
            const from = e.syncStart + (lockFrom - e.syncStart) * k / anchorsTarget, to = e.syncStart + (lockFrom - e.syncStart) * (k + 1) / anchorsTarget;
            const anchor = book.pick(notes, from, to - 1e-6, true);
            if (anchor && book.add(anchor, 'sync', rings[k % rings.length]?.index ?? -1)) anchors++;
        }
        encounter = { detectionStart: round3s(e.detectionStart), syncStart: round3s(e.syncStart), syncEnd: round3s(e.syncEnd),
            resolutionEnd: round3s(e.resolutionEnd), phase: phases.findIndex(p => p.start >= e.syncStart - 1e-6),
            energy: round3(segments[e.segment].energy), anchorCount: anchors, stabilizeNoteId: lock?.note.id ?? null, syncNoteCount: syncNotes };
    }
    for (const s of structures) {
        if (!s.scheduled || s.prebuilt || !(s.kind === 'pylon' || s.kind === 'rib' || s.kind === 'node')) continue;
        const pick = book.pick(notes, s.contributionStart, s.contributionEnd);
        if (pick) book.add(pick, s.kind === 'node' ? 'signal' : 'energy', s.index);
    }
    const roles = book.roles.slice().sort((a, b) => a.time - b.time || a.noteIndex - b.noteIndex);

    return {
        version: WORLD_PLAN_VERSION, seed, durationSec: round3s(duration), timingReliable,
        eras: starts.map(x => ({ era: x.era, start: round3s(x.start) })),
        phases, structures, roles,
        events: buildEvents(source, segments, eras, starts, duration, seed, timingReliable),
        encounter
    };
}
