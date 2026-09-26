import type { BeatEvent, PerformanceAutomationPoint } from '../types';
import type { RhythmTexture } from './RhythmTypes';
import { GESTURE_ENTRY_TEXTURE, rhythmTexture } from './RhythmChoreography';

export interface RhythmPhrase {
    index: number;
    start: number;
    end: number;
    point?: PerformanceAutomationPoint;
    texture: RhythmTexture;
    pairTime?: number;
    beatSec: number;
}
const VOCABULARY: Record<RhythmTexture, readonly RhythmTexture[]> = {
    breath: ['breath', 'pulse', 'echo', 'weave'], pulse: ['pulse', 'weave', 'drive', 'echo'],
    drive: ['drive', 'weave', 'echo', 'pulse'], weave: ['weave', 'drive', 'pulse', 'echo'],
    build: ['build', 'pulse', 'weave', 'drive'], impact: ['impact', 'drive', 'weave', 'echo'],
    echo: ['echo', 'pulse', 'weave', 'drive']
};

/** Whole-track coverage without requiring a drop label, a high absolute intensity or a trusted grid.
 * Every populated phrase gets its own motor variation; accents use relative local salience.
 * Grid confidence controls the timing scaffold, never whether the player is allowed arrows/pairs.
 */
export function planRhythmPhrases(events: readonly BeatEvent[], points: readonly PerformanceAutomationPoint[],
    duration: number, beats: readonly number[], confidence: number): RhythmPhrase[] {
    const intervals = (confidence >= 0.5 ? beats.slice(1).map((t, i) => t - beats[i])
        : events.slice(1).map((e, i) => e.time - events[i].time)).filter(t => t >= 0.2 && t <= 1.5).sort((a, b) => a - b);
    const beatSec = Math.max(0.25, Math.min(1, intervals[Math.floor(intervals.length / 2)] ?? 0.5));
    const span = Math.max(4, Math.min(12, beatSec * 16));
    const phrases: RhythmPhrase[] = [];
    let cursor = 0, pointIndex = -1, previous: RhythmTexture | undefined;
    while (cursor < events.length) {
        const start = events[cursor].time;
        while (pointIndex + 1 < points.length && points[pointIndex + 1].time <= start) pointIndex++;
        const point = points[pointIndex];
        const end = Math.min(duration + 0.001, start + span, points[pointIndex + 1]?.time ?? Infinity);
        let next = cursor + 1;
        while (next < events.length && events[next].time < end) next++;
        const family = VOCABULARY[rhythmTexture(point?.meta)];
        // The automation's first phrase establishes its own family. Sustained scenes develop
        // rather than holding one layout for minutes; a new point forces an audible motor change.
        const previousPoint = phrases.at(-1)?.point;
        const phase = previousPoint === point ? phrases.length : 0;
        const gesture = point?.meta?.movementGesture;
        const preferred = gesture ? GESTURE_ENTRY_TEXTURE[gesture] : undefined;
        const entry = preferred && family.includes(preferred) ? family.indexOf(preferred) : 0;
        let texture = family[(entry + phase) % family.length];
        if (texture === previous) texture = family[(family.indexOf(texture) + 1) % family.length];
        let pairTime: number | undefined;
        if (next - cursor >= 6 && events[next - 1].time - start >= 2) {
            let best = -Infinity;
            for (let i = cursor; i < next; i++) {
                const event = events[i];
                // Leave an entry phrase before the accent and room to perceive its recovery.
                if (event.time < start + 1 || event.time > end - 0.5) continue;
                const score = event.intensity + (event.type === 2 ? 0.1 : 0) - (event.time - start) * 0.002;
                if (score > best) { best = score; pairTime = event.time; }
            }
        }
        phrases.push({ index: phrases.length, start, end, texture, point, pairTime, beatSec });
        previous = texture; cursor = next;
    }
    return phrases;
}
