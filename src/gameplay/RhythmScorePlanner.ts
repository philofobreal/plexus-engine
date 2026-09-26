import type { RhythmChartSource } from './RhythmChartBuilder';
import { LANE_HAND, type RhythmGameConfig } from './RhythmGameConfig';
import { CUT_VECTORS } from './RhythmChoreography';
import type { CutDirection, RhythmNote, RhythmTexture } from './RhythmTypes';
import { planRhythmPhrases } from './RhythmPhrasePlanner';

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
export function choreographRhythmChart(source: RhythmChartSource, config: RhythmGameConfig): RhythmNote[] {
    const events = source.events.map((event, index) => ({ event, index })).filter(({ event }) =>
        Number.isFinite(event.time) && event.time >= config.approachTimeSec && event.time <= source.durationSec &&
        Number.isFinite(event.intensity) && event.intensity >= config.intensityFloor)
        .sort((a, b) => a.event.time - b.event.time || a.index - b.index);
    const beats = source.beats.filter(Number.isFinite).slice().sort((a, b) => a - b);
    const bars = (source.barStarts ?? []).filter(Number.isFinite).slice().sort((a, b) => a - b);
    const meter = bars.length ? bars : beats.filter((_, i) => i % 4 === 0);
    const points = (source.performancePlan?.points ?? []).filter(p => Number.isFinite(p.time)).slice().sort((a, b) => a.time - b.time);
    const reliable = (source.timingConfidence ?? 0) >= 0.5 && beats.length >= 2;
    const phrases = planRhythmPhrases(events.map(e => e.event), points, source.durationSec, beats, source.timingConfidence ?? 0);
    const accents = phrases.flatMap(p => p.pairTime === undefined ? [] : [p.pairTime]);
    const phraseTimes = phrases.map(p => p.start);
    const result: RhythmNote[] = [];
    const last: Partial<Record<'left' | 'right', RhythmNote>> = {};
    const direction: Partial<Record<'left' | 'right', CutDirection>> = {};
    let nextHand: 'left' | 'right' = 'left', nextAllowed = 0, lastPair = -Infinity;
    for (const { event, index } of events) {
        const time = event.time;
        // Reserve a preparation gap before authored two-hand accents; otherwise dense singles
        // would consume one hand just before every downbeat and make pairs unreachable.
        const nextAccent = accents[lastAt(accents, time) + 1];
        if (nextAccent !== undefined && nextAccent - time < Math.max(0.8, config.minSameHandSpacingSec)) continue;
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
        const accent = time === passage.pairTime;
        // Echo answers in the second half of alternate bars, with actual syncopated onsets
        // retained inside that window. Empty answers stay empty instead of inventing beats.
        if (!accent && texture === 'echo' && (phrase % 2 === 0 ? phase >= 2 : phase < 2)) continue;
        // A four-bar question/answer has a short breathing space at its tail.
        if (!accent && reliable && barIndex % 4 === 3 && phase >= 3 && event.intensity < 0.85 && texture !== 'build') continue;
        const density = texture === 'breath' ? 2 : texture === 'pulse' ? 1
            : texture === 'build' ? buildEnergy < 0.65 ? 1 : 0.5 : 0.5;
        const spacing = Math.max(config.minGlobalNoteSpacingSec, beatSec * density);
        const changedPoint = result.length > 0 && point?.id !== result.at(-1)?.automationId;
        const requiredGap = accent || changedPoint ? config.minSameHandSpacingSec : spacing;
        if ((!accent && !changedPoint && time < nextAllowed - 1e-7) || result.length && time - result[result.length - 1].time < requiredGap - 1e-7) continue;
        const hand: 'left' | 'right' = nextHand;
        if (last[hand] && time - last[hand]!.time < config.minSameHandSpacingSec) continue;

        const make = (side: 'left' | 'right', pairLayout?: RhythmNote['pairLayout']): RhythmNote => {
            const previous = last[side];
            const dt = previous ? time - previous.time : Infinity;
            const sideSign = side === 'left' ? -1 : 1;
            const oldCut = direction[side];
            const oldVector = oldCut && oldCut !== 'any' ? CUT_VECTORS[oldCut] : null;
            // Preserve hand parity across automation boundaries. A long rest permits a new downstroke.
            const up = dt < 1.5 && oldVector ? oldVector[1] < 0 : false;
            const diagonal = texture === 'weave' || texture === 'echo' || (texture === 'impact' && phrase % 2 === 1);
            let cutDirection: CutDirection = texture === 'breath' && index % 4 === 0 ? 'any'
                : diagonal ? up ? side === 'left' ? 'up-right' : 'up-left' : side === 'left' ? 'down-left' : 'down-right'
                : up ? 'up' : 'down';
            // Pulse/drive phrases include lateral call/return strokes as well as vertical ones.
            // Only singles use these inward returns; simultaneous pairs keep divergent corridors.
            if (!pairLayout && (texture === 'pulse' || texture === 'drive') && Math.floor(phase) % 2 === 0)
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
            // A required reversal that conflicts with the pair geometry becomes a free cut.
            if (oldVector && dt < 1.5 && cutDirection !== 'any') {
                const v = CUT_VECTORS[cutDirection];
                if (oldVector[0] * v[0] + oldVector[1] * v[1] > 0.1) cutDirection = 'any';
            }
            if (!pairLayout && previous) {
                const limit = dt * config.maxHandTravelMps;
                while (row !== previous.row && Math.hypot(x - xOf(previous), (row - previous.row) * config.rowSpacingMeters) > limit)
                    row += Math.sign(previous.row - row);
                if (Math.hypot(x - xOf(previous), (row - previous.row) * config.rowSpacingMeters) > limit) x = xOf(previous);
            }
            return { id: `note-${index}-${side}`, time, hand: side, lane: side === 'left' ? 0 : 2, row,
                xOffsetMeters: x, intensity: Math.min(1, event.intensity), sourceType: event.type,
                cutDirection, texture, phrase, automationId: point?.id,
                ...(pairLayout ? { pairId: `pair-${index}`, pairLayout } : {}) };
        };
        // Every populated phrase reserves a locally salient accent, regardless of grid confidence.
        const canPair = accent && time - lastPair >= Math.max(2, beatSec * 4) &&
            (['left', 'right'] as const).every(h => !last[h] || time - last[h]!.time >= Math.max(0.75, config.minSameHandSpacingSec));
        const layout = (['horizontal', 'diagonal', 'vertical'] as const)[phrase % 3];
        const pair = canPair ? [make('left', layout), make('right', layout)] : null;
        const reachable = pair?.every(n => !last[n.hand as 'left' | 'right'] ||
            Math.hypot(xOf(n) - xOf(last[n.hand as 'left' | 'right']!), (n.row - last[n.hand as 'left' | 'right']!.row) * config.rowSpacingMeters)
                <= (time - last[n.hand as 'left' | 'right']!.time) * config.maxHandTravelMps);
        const group = pair && reachable ? pair : [make(hand)];
        for (const note of group) {
            const h = note.hand as 'left' | 'right';
            result.push(note); last[h] = note;
            if (note.cutDirection !== 'any') direction[h] = note.cutDirection;
        }
        nextHand = hand === 'left' ? 'right' : 'left';
        nextAllowed = time + (group.length === 2 ? Math.max(0.5, config.minSameHandSpacingSec) : spacing);
        if (group.length === 2) lastPair = time;
    }
    return result;
}
