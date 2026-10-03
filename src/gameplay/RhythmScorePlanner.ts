import type { RhythmChartSource } from './RhythmChartBuilder';
import { LANE_HAND, type RhythmGameConfig } from './RhythmGameConfig';
import { CUT_VECTORS, rhythmTexture } from './RhythmChoreography';
import type { CutDirection, RhythmNote, RhythmTexture } from './RhythmTypes';
import { planRhythmPhrases, type RhythmPhrase } from './RhythmPhrasePlanner';
import { DEFAULT_RHYTHM_GENERATION_SETTINGS, difficultyProfile, motorProfile, type RhythmGenerationSettings } from './RhythmGenerationProfile';
import { isOnBeat, RhythmHandPolicy } from './RhythmHandPolicy';
import { zonePreference } from './RhythmZonePolicy';
import { liftOverheadTargets } from './RhythmOverheadPolicy';

const REVERSED: Readonly<Record<Exclude<CutDirection, 'any'>, Exclude<CutDirection, 'any'>>> = {
    up: 'down', down: 'up', left: 'right', right: 'left',
    'up-left': 'down-right', 'down-right': 'up-left', 'up-right': 'down-left', 'down-left': 'up-right'
};
const laneOf = (x: number) => (x < -0.2 ? 0 : x > 0.2 ? 2 : 1);

function lastAt(times: readonly number[], time: number): number {
    let lo = 0, hi = times.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (times[mid] <= time) lo = mid + 1; else hi = mid; }
    return lo - 1;
}
const xOf = (note: RhythmNote) => note.xOffsetMeters ?? LANE_HAND[note.lane].xOffsetMeters;
const DOWNBEAT_TOLERANCE_SEC = 0.06;
function barAt(times: readonly number[], time: number): number {
    const preceding = lastAt(times, time);
    return times[preceding + 1] - time <= DOWNBEAT_TOLERANCE_SEC ? preceding + 1 : Math.max(0, preceding);
}

/** Offline motor score: Visual OS supplies meaning; only published onsets supply note times.
 * Meter shapes repetition and accent placement, never generates a silent grid-only target.
 */
export function choreographRhythmChart(source: RhythmChartSource, config: RhythmGameConfig,
    settings: RhythmGenerationSettings = DEFAULT_RHYTHM_GENERATION_SETTINGS): RhythmNote[] {
    const profile = motorProfile(settings);
    // Difficulty owns the physical envelope. Normal multiplies by exactly 1 (historical chart).
    const demand = difficultyProfile(settings.difficulty);
    const minGlobal = config.minGlobalNoteSpacingSec * demand.globalSpacingScale;
    const minSame = config.minSameHandSpacingSec * demand.sameHandSpacingScale;
    const travel = config.maxHandTravelMps * demand.travelScale;
    // A crossing/center move needs the other hand clear of the space before and after it.
    const clearSec = demand.crossClearSec;
    const events = source.events.map((event, index) => ({ event, index })).filter(({ event }) =>
        Number.isFinite(event.time) && event.time >= config.approachTimeSec && event.time <= source.durationSec &&
        Number.isFinite(event.intensity) && event.intensity >= config.intensityFloor)
        .sort((a, b) => a.event.time - b.event.time || a.index - b.index);
    const beats = source.beats.filter(Number.isFinite).slice().sort((a, b) => a - b);
    const bars = (source.barStarts ?? []).filter(Number.isFinite).slice().sort((a, b) => a - b);
    const meter = bars.length ? bars : beats.filter((_, i) => i % 4 === 0);
    const points = (source.performancePlan?.points ?? []).filter(p => Number.isFinite(p.time)).slice().sort((a, b) => a.time - b.time);
    const reliable = (source.timingConfidence ?? 0) >= 0.5 && beats.length >= 2;
    // Ultra structure: silences before section changes (sorted starts; the first section has none).
    const silenceStarts = demand.sectionSilenceBeats > 0
        ? (source.sectionStarts ?? []).filter(t => Number.isFinite(t) && t > 0).slice().sort((a, b) => a - b) : [];
    let runStart = -Infinity;
    const phrases = planRhythmPhrases(events.map(e => e.event), points, source.durationSec, beats, source.timingConfidence ?? 0, settings);
    const accents = phrases.flatMap(p => p.pairTimes);
    const phraseTimes = phrases.map(p => p.start);
    const result: RhythmNote[] = [];
    const last: Partial<Record<'left' | 'right', RhythmNote>> = {};
    const direction: Partial<Record<'left' | 'right', CutDirection>> = {};
    const hands = new RhythmHandPolicy(settings.handPattern, settings.handLead, demand.strictSequences);
    let nextAllowed = 0, lastPair = -Infinity;
    // Zone safety state: a crossing blocks the other hand; the center lane is exclusive; hard-move chains.
    let crossBlock: { hand: 'left' | 'right'; until: number } | null = null;
    let centerUse: { hand: 'left' | 'right'; time: number } | null = null;
    const hardRun: Record<'left' | 'right', number> = { left: 0, right: 0 };
    // Position inside the bar in beats, from the trusted meter or the phrase's own scaffold.
    const beatSecAt = (time: number, passage: RhythmPhrase) => {
        if (!reliable) return passage.beatSec;
        const beatIndex = Math.max(0, lastAt(beats, time));
        return Math.max(0.25, Math.min(1, (beats[beatIndex + 1] ?? beats[beatIndex] + 0.5) - beats[beatIndex] || 0.5));
    };
    const phaseAt = (time: number, passage: RhythmPhrase, beatSec: number) =>
        Math.max(0, (time - (reliable ? meter[barAt(meter, time)] ?? 0 : passage.start)) / beatSec) % 4;
    // Per-phrase median onset intensity: "strong" onsets for zones, Easy free cuts and Independent.
    const byPhrase = phrases.map(() => [] as typeof events);
    for (const entry of events) byPhrase[phrases[lastAt(phraseTimes, entry.event.time)].index].push(entry);
    const phraseMedian = byPhrase.map(members => {
        const sorted = members.map(m => m.event.intensity).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)] ?? 0;
    });
    // Independent hand pattern: per-phrase primary/secondary stream membership and sizes. Primary
    // onsets are dense impacts or above-median onsets on the strong beats (1 and 3) of the bar.
    const primaryStream = new Set<number>();
    const primaryCount = new Array<number>(phrases.length).fill(0), secondaryCount = new Array<number>(phrases.length).fill(0);
    if (settings.handPattern === 'independent') {
        byPhrase.forEach((members, phraseIndex) => {
            const median = phraseMedian[phraseIndex];
            for (const { event, index } of members) {
                const passage = phrases[phraseIndex], phase = phaseAt(event.time, passage, beatSecAt(event.time, passage));
                const primary = event.type === 2 || (isOnBeat(phase) && Math.round(phase) % 2 === 0 && event.intensity >= median);
                if (primary) { primaryStream.add(index); primaryCount[phraseIndex]++; } else secondaryCount[phraseIndex]++;
            }
        });
    }
    for (const { event, index } of events) {
        const time = event.time;
        // Reserve a preparation gap before authored two-hand accents; otherwise dense singles
        // would consume one hand just before every downbeat and make pairs unreachable.
        const nextAccent = accents[lastAt(accents, time) + 1];
        if (nextAccent !== undefined && nextAccent - time < Math.max(demand.pairPrepSec, minSame)) continue;
        const passage = phrases[lastAt(phraseTimes, time)];
        const point = passage.point;
        const texture: RhythmTexture = passage.texture;
        // Automation intensity is a 0.3..3 gain, while behaviour energy is normalized.
        const buildEnergy = point?.meta?.behaviour?.energy ?? Math.min(1, (point?.intensity ?? 0) / 3);
        const beatIndex = Math.max(0, lastAt(beats, time));
        const beatSec = reliable ? Math.max(0.25, Math.min(1, (beats[beatIndex + 1] ?? beats[beatIndex] + 0.5) - beats[beatIndex] || 0.5)) : passage.beatSec;
        const barIndex = barAt(meter, time);
        const barStart = meter[barIndex] ?? 0;
        const phase = Math.max(0, (time - (reliable ? barStart : passage.start)) / beatSec) % 4;
        const phrase = passage.index;
        const accent = passage.pairTimes.includes(time);
        if (silenceStarts.length) {
            // A breath before the next section change: two beats at fast tempos, one at slow ones.
            const boundary = silenceStarts[lastAt(silenceStarts, time) + 1];
            const silence = beatSec * (beatSec <= 0.5 ? demand.sectionSilenceBeats : Math.max(1, demand.sectionSilenceBeats - 1));
            if (boundary !== undefined && boundary - time < silence - 1e-7) continue;
        }
        // Dense runs (gaps under 0.9 beat) last at most `maxRunBeats`, then breathe for a beat.
        const previousTime = result.length ? result[result.length - 1].time : -Infinity;
        const dense = time - previousTime < beatSec * 0.9;
        if (dense && time - runStart >= demand.maxRunBeats * beatSec - 1e-7) continue;
        // Echo answers in the second half of alternate bars, with actual syncopated onsets
        // retained inside that window. Empty answers stay empty instead of inventing beats.
        if (!accent && texture === 'echo' && (phrase % 2 === 0 ? phase >= 2 : phase < 2)) continue;
        // A four-bar question/answer has a short breathing space at its tail.
        // Active keeps playing through it; the other activity levels leave the breath.
        if (!accent && reliable && profile.densityScale >= 1 && barIndex % 4 === 3 && phase >= 3 && event.intensity < 0.85 && texture !== 'build') continue;
        const density = texture === 'breath' ? 2 : texture === 'pulse' ? 1
            : texture === 'build' ? buildEnergy < 0.65 ? 1 : 0.5 : 0.5;
        // Calm scenes (the breath family) may keep a gentler ceiling than the driving ones (Ultra).
        const ceilingScale = rhythmTexture(point?.meta) === 'breath' ? demand.calmCeilingScale : demand.ceilingScale;
        // Activity owns total density: it scales every texture's ceiling, never below the global floor.
        // Calm also widens the global floor; Active can never go below it.
        // Difficulty scales the ceiling and the floors on top of that.
        const spacing = Math.max(minGlobal * Math.max(1, profile.densityScale), beatSec * density * profile.densityScale * ceilingScale);
        const changedPoint = result.length > 0 && point?.id !== result.at(-1)?.automationId;
        const requiredGap = accent || changedPoint ? minSame : spacing;
        if ((!accent && !changedPoint && time < nextAllowed - 1e-7) || result.length && time - result[result.length - 1].time < requiredGap - 1e-7) continue;
        const ready = (side: 'left' | 'right') => (!last[side] || time - last[side]!.time >= minSame)
            && !(crossBlock && crossBlock.hand !== side && time < crossBlock.until);
        const strong = event.intensity >= phraseMedian[phrase];
        const chosen = hands.choose({ time, eventIndex: index, eventType: event.type, beatPhase: phase, beatSec,
            phraseIndex: phrase, phraseStart: passage.start, texture, energy: buildEnergy, pointChanged: changedPoint,
            primaryStream: primaryStream.has(index), phrasePrimary: primaryCount[phrase], phraseSecondary: secondaryCount[phrase] }, { ready });
        if (!chosen) continue;
        const hand: 'left' | 'right' = chosen;

        const make = (side: 'left' | 'right', pairLayout?: RhythmNote['pairLayout']): RhythmNote => {
            const previous = last[side];
            const dt = previous ? time - previous.time : Infinity;
            const sideSign = side === 'left' ? -1 : 1;
            const oldCut = direction[side];
            const oldVector = oldCut && oldCut !== 'any' ? CUT_VECTORS[oldCut] : null;
            // Preserve hand parity across automation boundaries. A long rest permits a new downstroke.
            const up = dt < 1.5 && oldVector ? oldVector[1] < 0 : false;
            // Variation owns cut-direction diversity; parity and pair divergence still apply below.
            const diagonal = texture === 'weave' || texture === 'echo'
                || (profile.cutDiversity >= 1 && texture === 'impact' && phrase % 2 === 1)
                || (profile.cutDiversity === 2 && texture === 'drive' && phrase % 2 === 1);
            let cutDirection: CutDirection = texture === 'breath' && index % 4 === 0 && !demand.directionalSingles ? 'any'
                : diagonal ? up ? side === 'left' ? 'up-right' : 'up-left' : side === 'left' ? 'down-left' : 'down-right'
                : up ? 'up' : 'down';
            // Pulse/drive phrases include lateral call/return strokes as well as vertical ones.
            // Only singles use these inward returns; simultaneous pairs keep divergent corridors.
            const lateral = profile.cutDiversity === 0 ? false : profile.cutDiversity === 2
                ? texture === 'pulse' || texture === 'drive' || texture === 'build' || texture === 'impact'
                : texture === 'pulse' || texture === 'drive';
            if (!pairLayout && lateral && Math.floor(phase) % 2 === 0)
                cutDirection = oldVector?.[0] ? oldVector[0] > 0 ? 'left' : 'right' : side === 'left' ? 'left' : 'right';
            let row = texture === 'breath' ? 1 : up ? 0 : 1;
            if (texture === 'weave') row = [0, 1, 2, 1][Math.floor(phase) % 4];
            if (texture === 'build' && !up && buildEnergy > 0.65) row = 2;
            if (event.type === 3 && event.intensity >= 0.65 && index % 4 === 0) row = 2;
            let x = sideSign * 0.45;
            if (pairLayout === 'horizontal') row = 1;
            if (pairLayout === 'vertical' || pairLayout === 'diagonal') {
                row = side === (barIndex % 2 ? 'right' : 'left') ? 2 : 0;
                if (pairLayout === 'vertical') x = sideSign * 0.22;
                // Divergent strokes leave each hand on its own side after the accent.
                cutDirection = row === 2 ? side === 'left' ? 'up-left' : 'up-right'
                    : side === 'left' ? 'down-left' : 'down-right';
            }
            if (!pairLayout) {
                // Easy keeps consecutive targets of one hand within one row step.
                if (previous && Math.abs(row - previous.row) > demand.maxRowStep)
                    row = previous.row + Math.sign(row - previous.row) * demand.maxRowStep;
                // Zones: musical context proposes; physical safety decides (first feasible zone).
                const other: 'left' | 'right' = side === 'left' ? 'right' : 'left';
                const reach = (cx: number, cr: number) => !previous || Math.hypot(cx - xOf(previous), (cr - previous.row) * config.rowSpacingMeters) <= dt * travel;
                const preference = zonePreference({ zones: settings.zones, crossRate: demand.crossRate, eventIndex: index, texture,
                    energy: buildEnergy, strong, gesture: point?.meta?.movementGesture,
                    beatsIntoScene: point ? (time - point.time) / beatSec : Infinity, fill: passage.end - time <= beatSec * 4 });
                for (const candidate of preference) {
                    if (candidate === 'center') {
                        const centerRow = Math.min(row, 1); // the high center stays clear for the incoming view
                        if (centerUse && centerUse.hand !== side && time - centerUse.time < clearSec) continue;
                        if (!reach(0, centerRow)) continue;
                        x = 0; row = centerRow; break;
                    }
                    if (candidate === 'cross') {
                        const cx = -sideSign * 0.45;
                        const previousCrossed = previous !== undefined && Math.sign(xOf(previous)) === -sideSign;
                        if (hardRun[side] >= demand.hardChain || previousCrossed) continue;
                        if (last[other] && time - last[other]!.time < clearSec) continue;
                        if (!reach(cx, row)) continue;
                        x = cx;
                        // Sweep outward through the far half; parity below may still reverse or free it.
                        cutDirection = diagonal ? up ? side === 'left' ? 'up-right' : 'up-left' : side === 'left' ? 'down-right' : 'down-left'
                            : side === 'left' ? 'right' : 'left';
                        break;
                    }
                    break; // own
                }
                if (demand.freeCutsOnWeakOnsets && !strong) cutDirection = 'any';
            }
            // A required reversal that conflicts with the pair geometry becomes a free cut
            // (Hard and Expert singles reverse it instead, keeping the sequence directional).
            if (oldVector && dt < 1.5 && cutDirection !== 'any') {
                const v = CUT_VECTORS[cutDirection];
                if (oldVector[0] * v[0] + oldVector[1] * v[1] > 0.1)
                    cutDirection = demand.strictSequences && !pairLayout ? REVERSED[cutDirection] : 'any';
            }
            if (!pairLayout && previous) {
                const limit = dt * travel;
                while (row !== previous.row && Math.hypot(x - xOf(previous), (row - previous.row) * config.rowSpacingMeters) > limit)
                    row += Math.sign(previous.row - row);
                if (Math.hypot(x - xOf(previous), (row - previous.row) * config.rowSpacingMeters) > limit) x = xOf(previous);
            }
            return { id: `note-${index}-${side}`, time, hand: side, lane: laneOf(x), row,
                xOffsetMeters: x, intensity: Math.min(1, event.intensity), sourceType: event.type,
                cutDirection, texture, phrase, automationId: point?.id,
                ...(pairLayout ? { pairId: `pair-${index}`, pairLayout } : {}) };
        };
        // Every populated phrase reserves a locally salient accent, regardless of grid confidence.
        const pairGap = settings.handPattern === 'together' || demand.extraPairs ? Math.max(1.5, beatSec * 2) : Math.max(2, beatSec * 4);
        const canPair = accent && time - lastPair >= pairGap &&
            (['left', 'right'] as const).every(h => !last[h] || time - last[h]!.time >= Math.max(demand.pairClearSec, minSame));
        const layout = (['horizontal', 'diagonal', 'vertical'] as const)[phrase % 3];
        const pair = canPair ? [make('left', layout), make('right', layout)] : null;
        const reachable = pair?.every(n => !last[n.hand as 'left' | 'right'] ||
            Math.hypot(xOf(n) - xOf(last[n.hand as 'left' | 'right']!), (n.row - last[n.hand as 'left' | 'right']!.row) * config.rowSpacingMeters)
                <= (time - last[n.hand as 'left' | 'right']!.time) * travel);
        const group = pair && reachable ? pair : [make(hand)];
        for (const note of group) {
            const h = note.hand as 'left' | 'right';
            const previous = last[h], x = xOf(note);
            const crossed = Math.sign(x) === (h === 'left' ? 1 : -1);
            const rowJump = previous !== undefined && Math.abs(note.row - previous.row) >= 2;
            hardRun[h] = crossed || rowJump ? hardRun[h] + 1 : 0;
            if (crossed) crossBlock = { hand: h, until: time + clearSec };
            if (x === 0) centerUse = { hand: h, time };
            result.push(note); last[h] = note;
            if (note.cutDirection !== 'any') direction[h] = note.cutDirection;
        }
        hands.commit(hand, group.length === 2);
        if (!dense) runStart = time;
        nextAllowed = time + (group.length === 2 ? Math.max(0.5, minSame) : spacing);
        if (group.length === 2) lastPair = time;
    }
    if (settings.playSpace !== 'tall') return result;
    // Tall play space: a few big moments move up to the overhead row (rows only, Addendum M). A big
    // scene is judged by its texture FAMILY (drop / peak = impact, a build above 0.65 energy), not by
    // the member a phrase developed into.
    const phraseAt = (time: number) => phrases[Math.max(0, lastAt(phraseTimes, time))];
    const bigPhrase = phrases.map(passage => {
        const family = rhythmTexture(passage.point?.meta);
        const energy = passage.point?.meta?.behaviour?.energy ?? Math.min(1, (passage.point?.intensity ?? 0) / 3);
        return family === 'impact' || (family === 'build' && energy > 0.65);
    });
    return liftOverheadTargets(result, { demand, minSameHandSpacingSec: minSame, maxHandTravelMps: travel,
        rowSpacingMeters: config.rowSpacingMeters, reliable, bigScene: time => bigPhrase[phraseAt(time).index],
        beatPhase: time => { const passage = phraseAt(time); return phaseAt(time, passage, beatSecAt(time, passage)); },
        beatSec: time => beatSecAt(time, phraseAt(time)) });
}
