import type { BeatEvent, PerformanceAutomationPoint, TrackSection } from '../types';
import type { RhythmTexture } from './RhythmTypes';
import { GESTURE_ENTRY_TEXTURE, rhythmTexture } from './RhythmChoreography';
import { DEFAULT_RHYTHM_GENERATION_SETTINGS, difficultyProfile, motorProfile, type RhythmGenerationSettings } from './RhythmGenerationProfile';

export interface RhythmPhrase {
    index: number;
    start: number;
    end: number;
    point?: PerformanceAutomationPoint;
    texture: RhythmTexture;
    /** Primary, most salient accent of the phrase (historical single pair candidate). */
    pairTime?: number;
    /** Every accent the hand pattern may realize as a two-hand pair, ascending. */
    pairTimes: number[];
    beatSec: number;
    /** Only the opt-in profile attaches context; the historical phrase shape stays unchanged. */
    character?: RhythmPhraseCharacter;
}
export interface RhythmPhraseCharacter {
    kind: 'calm' | 'build' | 'drive' | 'peak';
    energy: number;
    densityScale: number;
}
type CharacterSection = Pick<TrackSection, 'start' | 'end' | 'label'>;
const SECTION_LABELS = ['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro'];

/** Reject incomplete/ambiguous context as a whole; never guess across gaps or overlaps. */
export function rhythmCharacterSections(sections: readonly CharacterSection[] | undefined, duration: number): readonly CharacterSection[] {
    if (!sections?.length) return [];
    const sorted = sections.slice().sort((a, b) => a.start - b.start);
    if (sorted[0].start !== 0 || Math.abs(sorted.at(-1)!.end - duration) > 0.05) return [];
    for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        if (![s.start, s.end].every(Number.isFinite) || s.start < 0 || s.end <= s.start || s.end > duration + 0.05
            || !SECTION_LABELS.includes(s.label) || i > 0 && Math.abs(s.start - sorted[i - 1].end) > 1e-6) return [];
    }
    return sorted;
}

function sectionCharacter(section: CharacterSection, time: number): RhythmPhraseCharacter {
    if (section.label === 'intro' || section.label === 'break' || section.label === 'outro')
        return { kind: 'calm', energy: 0.25, densityScale: 1.4 };
    if (section.label === 'build') {
        const progress = Math.max(0, Math.min(1, (time - section.start) / (section.end - section.start)));
        return { kind: 'build', energy: 0.25 + progress * 0.7, densityScale: 1.3 - progress * 0.5 };
    }
    return section.label === 'drop' || section.label === 'peak'
        ? { kind: 'peak', energy: 0.9, densityScale: 0.85 } : { kind: 'drive', energy: 0.65, densityScale: 1 };
}
const CHARACTER_VOCABULARY: Record<RhythmPhraseCharacter['kind'], readonly RhythmTexture[]> = {
    calm: ['breath', 'pulse', 'echo'], build: ['build', 'pulse', 'build', 'weave'],
    drive: ['drive', 'weave', 'pulse', 'echo'], peak: ['impact', 'weave', 'drive', 'impact']
};
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
    duration: number, beats: readonly number[], confidence: number,
    settings: RhythmGenerationSettings = DEFAULT_RHYTHM_GENERATION_SETTINGS,
    sections?: readonly CharacterSection[]): RhythmPhrase[] {
    const profile = motorProfile(settings);
    const context = settings.chartProfile === 'musical-v1' ? rhythmCharacterSections(sections, duration) : [];
    const intervals = (confidence >= 0.5 ? beats.slice(1).map((t, i) => t - beats[i])
        : events.slice(1).map((e, i) => e.time - events[i].time)).filter(t => t >= 0.2 && t <= 1.5).sort((a, b) => a - b);
    const beatSec = Math.max(0.25, Math.min(1, intervals[Math.floor(intervals.length / 2)] ?? 0.5));
    // Variation owns phrase pacing: expressive phrases develop twice as often.
    const span = Math.max(profile.phraseMinSec, Math.min(profile.phraseMaxSec, beatSec * profile.phraseBeats));
    const phrases: RhythmPhrase[] = [];
    let cursor = 0, pointIndex = -1, sectionIndex = 0, sectionPhrases = 0, previousSection = -1;
    let previous: RhythmTexture | undefined, pointPhrases = 0;
    while (cursor < events.length) {
        const start = events[cursor].time;
        while (pointIndex + 1 < points.length && points[pointIndex + 1].time <= start) pointIndex++;
        const point = points[pointIndex];
        while (sectionIndex + 1 < context.length && context[sectionIndex + 1].start <= start) sectionIndex++;
        const section = context[sectionIndex];
        const end = Math.min(duration + 0.001, start + span, points[pointIndex + 1]?.time ?? Infinity, section?.end ?? Infinity);
        const character = section ? sectionCharacter(section, (start + end) / 2) : undefined;
        let next = cursor + 1;
        while (next < events.length && events[next].time < end) next++;
        const family = VOCABULARY[rhythmTexture(point?.meta)];
        // The automation's first phrase establishes its own family. Sustained scenes develop
        // rather than holding one layout for minutes; a new point forces an audible motor change.
        const previousPoint = phrases.at(-1)?.point;
        const phase = previousPoint === point ? phrases.length : 0;
        pointPhrases = previousPoint === point ? pointPhrases + 1 : 0;
        const gesture = point?.meta?.movementGesture;
        const preferred = gesture ? GESTURE_ENTRY_TEXTURE[gesture] : undefined;
        const entry = preferred && family.includes(preferred) ? family.indexOf(preferred) : 0;
        // Variation bounds the vocabulary a scene cycles through and how long each texture holds.
        const step = profile.phrasesPerTexture === 1 ? phase : Math.floor(pointPhrases / profile.phrasesPerTexture);
        let texture = family[(entry + step % profile.textureVocabulary) % family.length];
        if (texture === previous && (profile.phrasesPerTexture === 1 || pointPhrases === 0))
            texture = family[(family.indexOf(texture) + 1) % family.length];
        if (character) {
            sectionPhrases = previousSection === sectionIndex ? sectionPhrases + 1 : 0;
            const vocabulary = CHARACTER_VOCABULARY[character.kind];
            const member = Math.floor(sectionPhrases / profile.phrasesPerTexture) % Math.min(profile.textureVocabulary, vocabulary.length);
            const authoredEntry = preferred && vocabulary.includes(preferred) ? vocabulary.indexOf(preferred) : 0;
            texture = vocabulary[(authoredEntry + member) % vocabulary.length];
            // Early builds establish a pulse; later phrases develop upward into the accent.
            if (character.kind === 'build' && character.energy < 0.6) texture = 'pulse';
            previousSection = sectionIndex;
        }
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
        const pairTimes = pairTime === undefined ? [] : [pairTime];
        if (settings.handPattern === 'together') togetherAccents(events, cursor, next, start, end, beatSec, texture, point, pairTimes);
        // Ultra: more two-hand accents for every other pattern, on windows twice Together's length.
        else if (difficultyProfile(settings.difficulty).extraPairs) togetherAccents(events, cursor, next, start, end, beatSec, texture, point, pairTimes, 2);
        phrases.push({ index: phrases.length, start, end, texture, point, pairTime, pairTimes, beatSec,
            ...(character ? { character } : {}) });
        previous = texture; cursor = next;
    }
    return phrases;
}

/**
 * Together: one salient accent per musical window instead of one per phrase. The window is a
 * bar on impact/drive (or a strong build), two bars otherwise and four while breathing. Windows
 * with fewer than three real onsets stay singles: isolated events never become invented pairs.
 */
function togetherAccents(events: readonly BeatEvent[], from: number, to: number, start: number, end: number,
    beatSec: number, texture: RhythmTexture, point: PerformanceAutomationPoint | undefined, out: number[], barScale = 1): void {
    const energy = point?.meta?.behaviour?.energy ?? Math.min(1, (point?.intensity ?? 0) / 3);
    const bars = (texture === 'impact' || texture === 'drive' || (texture === 'build' && energy >= 0.65) ? 1
        : texture === 'breath' ? 4 : 2) * barScale;
    const window = beatSec * 4 * bars;
    for (let windowStart = start + 1; windowStart < end - 0.5; windowStart += window) {
        let best = -Infinity, bestTime: number | undefined, count = 0;
        for (let i = from; i < to; i++) {
            const event = events[i];
            if (event.time < windowStart || event.time >= Math.min(windowStart + window, end - 0.5)) continue;
            count++;
            const score = event.intensity + (event.type === 2 ? 0.1 : 0) - (event.time - start) * 0.002;
            if (score > best) { best = score; bestTime = event.time; }
        }
        if (bestTime !== undefined && count >= 3 && !out.includes(bestTime)) out.push(bestTime);
    }
    out.sort((a, b) => a - b);
}
