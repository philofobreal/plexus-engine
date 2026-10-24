// Offline motor envelope, independent of rendering/input/audio. Metres and song seconds only.
// This conservative model is a chart-quality contract, not a measurement of a player's body.
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import { CUT_VECTORS } from './RhythmChoreography';
import { difficultyProfile, normalizeGenerationSettings, playSpaceConfig, type RhythmGenerationSettings } from './RhythmGenerationProfile';
import { notePosition } from './RhythmLayout';
import type { CutDirection, RhythmHand, RhythmNote } from './RhythmTypes';

export const MOVEMENT_MODEL_VERSION = 1;
export const MOVEMENT_CUT_SEC = .10;
export const MOVEMENT_STROKE_HALF_METERS = .08;
export const MOVEMENT_HAND_CLEARANCE_METERS = .16;
export const MAX_MOVEMENT_ISSUES = 256;
type Hand = Exclude<RhythmHand, 'either'>;
type Point = { x: number; y: number };
interface Segment { start: number; end: number; a: Point; b: Point; id: string; }
export type MovementIssueCode = 'invalid-target' | 'duplicate-id' | 'unordered' | 'unreachable-target' | 'invalid-pair'
    | 'global-density' | 'same-hand-density' | 'row-step' | 'return-speed' | 'cross-clearance' | 'hand-collision' | 'overhead-rest';
export interface RhythmMovementIssue {
    readonly code: MovementIssueCode;
    readonly noteIds: readonly string[];
    readonly actual: number;
    readonly limit: number;
}
export interface RhythmMovementReport {
    readonly version: typeof MOVEMENT_MODEL_VERSION;
    readonly valid: boolean;
    readonly noteCount: number;
    readonly issueCount: number;
    /** Bounded diagnostic sample; issueCount still counts every detected violation. */
    readonly issues: readonly RhythmMovementIssue[];
}
export interface GuardedRhythmChart {
    readonly chart: RhythmNote[];
    readonly removedNotes: number;
    readonly rejectedGroups: number;
    readonly revoicedNotes: number;
}
const opposite = (hand: Hand): Hand => hand === 'left' ? 'right' : 'left';
const EPS = 1e-8;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sameTime = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** Blade entry/exit, not just target centres. Free cuts carry no invented stroke direction. */
export function rhythmStroke(note: RhythmNote, config: RhythmGameConfig): { entry: Point; exit: Point } {
    const p = notePosition(note, note.time, { x: 0, y: 0, z: 0 }, config);
    const v = note.cutDirection && note.cutDirection !== 'any' ? CUT_VECTORS[note.cutDirection] : [0, 0];
    return { entry: { x: p.x - v[0] * MOVEMENT_STROKE_HALF_METERS, y: p.y - v[1] * MOVEMENT_STROKE_HALF_METERS },
        exit: { x: p.x + v[0] * MOVEMENT_STROKE_HALF_METERS, y: p.y + v[1] * MOVEMENT_STROKE_HALF_METERS } };
}
const at = (segment: Segment, time: number): Point => {
    const u = segment.end > segment.start ? (time - segment.start) / (segment.end - segment.start) : 0;
    return { x: segment.a.x + (segment.b.x - segment.a.x) * u, y: segment.a.y + (segment.b.y - segment.a.y) * u };
};
/** Exact closest distance between two linearly moving hands during their overlapping song interval. */
export function movingHandDistance(a: Segment, b: Segment): number {
    const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
    if (end < start - EPS) return Infinity;
    const p = at(a, start), q = at(b, start), r = at(a, end), s = at(b, end);
    const x = p.x - q.x, y = p.y - q.y, dx = r.x - s.x - x, dy = r.y - s.y - y;
    const length = dx * dx + dy * dy;
    const u = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
    return Math.hypot(x + dx * u, y + dy * u);
}

class MovementState {
    private readonly settings: RhythmGenerationSettings;
    private readonly config: RhythmGameConfig;
    private readonly last: Partial<Record<Hand, RhythmNote>> = {};
    private readonly segments: Record<Hand, Segment[]> = { left: [], right: [] };
    private readonly blockedUntil: Record<Hand, number> = { left: -Infinity, right: -Infinity };
    private lastTime = -Infinity;
    private readonly ids = new Set<string>();

    constructor(config: RhythmGameConfig, settings: Partial<RhythmGenerationSettings>) {
        this.settings = normalizeGenerationSettings(settings);
        this.config = playSpaceConfig(config, this.settings.playSpace);
    }
    /** Prefer a simpler own-hand corridor/row before losing an audible onset; never change a cut or time. */
    revoice(group: readonly RhythmNote[], keepRows: boolean): RhythmNote[] {
        return group.map(note => {
            if (note.hand === 'either') return note;
            const sign = note.hand === 'left' ? -1 : 1;
            return { ...note, lane: sign < 0 ? 0 : 2,
                xOffsetMeters: sign * (note.pairLayout === 'vertical' ? .22 : .45),
                row: keepRows || note.pairId ? note.row : Math.min(2, this.last[note.hand]?.row ?? 1) };
        });
    }
    inspect(group: readonly RhythmNote[]): { issues: RhythmMovementIssue[]; commit(): void } {
        if (group.length <= 2 && group.some(n => n.hand === 'either')) {
            let variants: RhythmNote[][] = [[]];
            for (const note of group) variants = variants.flatMap(prefix => note.hand === 'either'
                ? (['left', 'right'] as const).map(hand => [...prefix, { ...note, hand }]) : [[...prefix, note]]);
            const options = variants.map(variant => this.inspect(variant));
            return options.find(option => option.issues.length === 0) ?? options.sort((a, b) => a.issues.length - b.issues.length)[0];
        }
        const issues: RhythmMovementIssue[] = [], staged: { note: RhythmNote; hand: Hand; segments: Segment[]; shared: boolean }[] = [];
        const fail = (code: MovementIssueCode, noteIds: string[], actual: number, limit: number) => issues.push({ code, noteIds, actual, limit });
        const cfg = this.config, demand = difficultyProfile(this.settings.difficulty), time = group[0].time;
        if (time < this.lastTime) fail('unordered', [group[0].id], time, this.lastTime);
        if (time - this.lastTime < cfg.minGlobalNoteSpacingSec * demand.globalSpacingScale - EPS)
            fail('global-density', [group[0].id], time - this.lastTime, cfg.minGlobalNoteSpacingSec * demand.globalSpacingScale);
        if (group.length > 2 || group.some(n => n.pairId && (group.length !== 2 || group.some(p => p.pairId !== n.pairId))))
            fail('invalid-pair', group.map(n => n.id), group.length, 2);
        const used = new Set<Hand>(), groupIds = new Set<string>();
        for (const note of group) {
            if (!Number.isFinite(note.time) || note.time < 0 || !Number.isInteger(note.row) || !Number.isInteger(note.lane)
                || !['left', 'right', 'either'].includes(note.hand) || !['any', ...Object.keys(CUT_VECTORS)].includes(note.cutDirection ?? 'any')
                || (note.xOffsetMeters !== undefined && !Number.isFinite(note.xOffsetMeters))) {
                fail('invalid-target', [note.id], 0, 1); continue;
            }
            if (this.ids.has(note.id) || groupIds.has(note.id)) fail('duplicate-id', [note.id], 2, 1);
            groupIds.add(note.id);
            const p = notePosition(note, time, { x: 0, y: 0, z: 0 }, cfg);
            if (note.lane < 0 || note.lane >= cfg.laneCount || note.row < 0 || note.row > (this.settings.playSpace === 'tall' ? 3 : 2)
                || Math.abs(p.x) > .55 + EPS) fail('unreachable-target', [note.id], Math.abs(p.x), .55);
            // Either stays an either-hand target; this is a deterministic feasibility witness only.
            const hands: Hand[] = note.hand === 'either' ? ['left', 'right'] : [note.hand];
            const hand = hands.filter(h => !used.has(h)).sort((a, b) =>
                (this.last[a]?.time ?? -Infinity) - (this.last[b]?.time ?? -Infinity))[0] ?? hands[0];
            if (used.has(hand)) fail('same-hand-density', [note.id], 0, cfg.minSameHandSpacingSec * demand.sameHandSpacingScale);
            used.add(hand);
            const previous = this.last[hand], other = opposite(hand), oldOther = this.last[other];
            const stroke = rhythmStroke(note, cfg), shared = (hand === 'left' ? p.x >= -.05 : p.x <= .05)
                || Math.min(Math.abs(stroke.entry.x), Math.abs(stroke.exit.x)) < MOVEMENT_HAND_CLEARANCE_METERS / 2;
            if (time < this.blockedUntil[hand] - EPS) fail('cross-clearance', [note.id], time, this.blockedUntil[hand]);
            if (shared && oldOther && time - oldOther.time < demand.crossClearSec - EPS)
                fail('cross-clearance', [oldOther.id, note.id], time - oldOther.time, demand.crossClearSec);
            const motion: Segment[] = [];
            if (previous) {
                const dt = time - previous.time, previousStroke = rhythmStroke(previous, cfg);
                const minSame = cfg.minSameHandSpacingSec * demand.sameHandSpacingScale;
                if (dt < minSame - EPS) fail('same-hand-density', [previous.id, note.id], dt, minSame);
                const rest = note.row === 3 ? Math.max(.5, minSame) : previous.row === 3 ? Math.max(.75, minSame) : 0;
                if (dt < rest - EPS) fail('overhead-rest', [previous.id, note.id], dt, rest);
                const rows = Math.abs(note.row - previous.row);
                // Overhead has its own authored preparation/rest policy; physical distance still applies below.
                if (note.row !== 3 && previous.row !== 3 && dt < 1.5 && rows > demand.maxRowStep)
                    fail('row-step', [previous.id, note.id], rows, demand.maxRowStep);
                const needed = distance(previousStroke.exit, stroke.entry);
                const available = Math.max(0, dt - MOVEMENT_CUT_SEC) * cfg.maxHandTravelMps * demand.travelScale;
                if (needed > available + EPS) fail('return-speed', [previous.id, note.id], needed, available);
                if (dt > MOVEMENT_CUT_SEC) motion.push({ start: previous.time + MOVEMENT_CUT_SEC / 2,
                    end: time - MOVEMENT_CUT_SEC / 2, a: previousStroke.exit, b: stroke.entry, id: note.id });
            }
            motion.push({ start: time - MOVEMENT_CUT_SEC / 2, end: time + MOVEMENT_CUT_SEC / 2, a: stroke.entry, b: stroke.exit, id: note.id });
            for (const segment of motion) {
                // Per-hand segment end times are ordered; binary-search the potentially overlapping suffix.
                const existing = this.segments[other]; let lo = 0, hi = existing.length;
                while (lo < hi) { const mid = (lo + hi) >>> 1; if (existing[mid].end < segment.start) lo = mid + 1; else hi = mid; }
                const check = (candidate: Segment) => {
                    const d = movingHandDistance(segment, candidate);
                    if (d < MOVEMENT_HAND_CLEARANCE_METERS - EPS) fail('hand-collision', [candidate.id, note.id], d, MOVEMENT_HAND_CLEARANCE_METERS);
                };
                for (let i = lo; i < existing.length && existing[i].start <= segment.end; i++) check(existing[i]);
                for (const entry of staged) if (entry.hand === other) for (const s of entry.segments) check(s);
            }
            staged.push({ note, hand, segments: motion, shared });
        }
        return { issues, commit: () => {
            this.lastTime = time;
            for (const entry of staged) {
                this.last[entry.hand] = entry.note; this.ids.add(entry.note.id);
                this.segments[entry.hand].push(...entry.segments);
                if (entry.shared) this.blockedUntil[opposite(entry.hand)] = time + demand.crossClearSec;
            }
        } };
    }
}

function groups(chart: readonly RhythmNote[]): RhythmNote[][] {
    const out: RhythmNote[][] = [];
    for (const note of chart) {
        const last = out.at(-1);
        if (last && sameTime(last[0].time, note.time)) last.push(note); else out.push([note]);
    }
    return out;
}
/** Validates the actual chart, including all transitions and temporally overlapping hand paths. */
export function validateRhythmMovement(chart: readonly RhythmNote[], config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG,
    settings: Partial<RhythmGenerationSettings> = {}): RhythmMovementReport {
    const state = new MovementState(config, settings), issues: RhythmMovementIssue[] = []; let count = 0;
    for (const group of groups(chart)) {
        const checked = state.inspect(group); count += checked.issues.length;
        for (const issue of checked.issues) if (issues.length < MAX_MOVEMENT_ISSUES) issues.push(Object.freeze({ ...issue, noteIds: Object.freeze(issue.noteIds) }));
        checked.commit();
    }
    return Object.freeze({ version: MOVEMENT_MODEL_VERSION, valid: count === 0, noteCount: chart.length, issueCount: count, issues: Object.freeze(issues) });
}
/** Keeps source times/hands/cuts. Simplifies unsafe placement, then rejects an infeasible onset atomically. */
export function guardRhythmMovement(chart: readonly RhythmNote[], config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG,
    settings: Partial<RhythmGenerationSettings> = {}): GuardedRhythmChart {
    const state = new MovementState(config, settings), accepted: RhythmNote[] = []; let rejected = 0, revoiced = 0;
    for (const group of groups(chart)) {
        let selected = group, checked = state.inspect(group);
        if (checked.issues.length && checked.issues.every(i => ['return-speed', 'row-step', 'cross-clearance', 'hand-collision'].includes(i.code))) {
            for (const keepRows of [true, false]) {
                const candidate = state.revoice(group, keepRows), inspected = state.inspect(candidate);
                if (!inspected.issues.length) { selected = candidate; checked = inspected; revoiced += group.length; break; }
            }
        }
        if (checked.issues.length) { rejected++; continue; }
        checked.commit(); accepted.push(...selected);
    }
    return { chart: accepted, removedNotes: chart.length - accepted.length, rejectedGroups: rejected, revoicedNotes: revoiced };
}

const MIRROR_CUT: Readonly<Record<CutDirection, CutDirection>> = { any: 'any', up: 'up', down: 'down', left: 'right', right: 'left',
    'up-left': 'up-right', 'up-right': 'up-left', 'down-left': 'down-right', 'down-right': 'down-left' };
/** Rigid reflection: preserves timing, identities, pair grouping, physical demand and score. */
export function mirrorRhythmChart(chart: readonly RhythmNote[]): RhythmNote[] {
    return chart.map(note => ({ ...note, hand: note.hand === 'either' ? 'either' : opposite(note.hand), lane: 2 - note.lane,
        ...(note.xOffsetMeters !== undefined ? { xOffsetMeters: note.xOffsetMeters === 0 ? 0 : -note.xOffsetMeters } : {}),
        ...(note.cutDirection ? { cutDirection: MIRROR_CUT[note.cutDirection] } : {}) }));
}
