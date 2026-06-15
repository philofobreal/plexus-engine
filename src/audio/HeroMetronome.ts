import { State } from '../state/store';
import type { TrackAnalysis } from '../types';

const STEM_COUNT = 4;
const BEEP_FREQUENCY_HZ = 600;
const BEEP_DURATION_SECONDS = 0.06;
const BEEP_BASE_GAIN = 0.35;

export class HeroMetronome {
    static getBeepModeAtTime(time: number): number {
        const plan = State.editedPerformancePlan || State.performancePlan;
        if (plan?.points.length) {
            let activePreset: string | null = null;
            let activeTime = -Infinity;
            for (const point of plan.points) {
                if (point.time <= time && point.time >= activeTime) {
                    activePreset = point.preset;
                    activeTime = point.time;
                }
            }
            if (activePreset) {
                const preset = State.preloadedPresets[activePreset] as ({ visualTuning?: unknown; heroBeepMode?: unknown } | undefined);
                const nested = preset?.visualTuning && typeof preset.visualTuning === 'object'
                    ? preset.visualTuning as { heroBeepMode?: unknown }
                    : null;
                const value = nested?.heroBeepMode ?? preset?.heroBeepMode;
                if (typeof value === 'number' && Number.isFinite(value)) {
                    return clampMode(value);
                }
            }
        }

        return clampMode(State.targetTuning.heroBeepMode);
    }

    static getBeepEventsInWindow(analysis: TrackAnalysis, startTime: number, endTime: number): Array<{ time: number; intensity: number }> {
        const duration = Math.max(0, analysis.duration || State.duration || 0);
        const windowStart = Math.max(0, startTime);
        const windowEnd = Math.min(Math.max(windowStart, endTime), duration);
        if (windowEnd <= windowStart) return [];

        const bpm = Number.isFinite(analysis.bpm) && analysis.bpm > 0 ? analysis.bpm : State.bpm || 120;
        const beatSeconds = 60 / bpm;
        const gridOffset = Number.isFinite(analysis.gridOffset) ? analysis.gridOffset : 0;
        const events: Array<{ time: number; intensity: number }> = [];

        this.collectPatternEvents(events, 1, gridOffset, beatSeconds, windowStart, windowEnd, [0], 1);
        this.collectPatternEvents(events, 2, gridOffset, beatSeconds, windowStart, windowEnd, [0.5], 1);
        this.collectPatternEvents(events, 3, gridOffset, beatSeconds, windowStart, windowEnd, [0, 1 / 3, 2 / 3], 1);
        this.collectPatternEvents(events, 4, gridOffset, beatSeconds, windowStart, windowEnd, [0, 1.5, 2.5, 3.75], 4);

        events.sort((a, b) => a.time - b.time);
        return events;
    }

    static generateStems(ctx: AudioContext, analysis: TrackAnalysis): AudioBuffer[] {
        const duration = Math.max(0, analysis.duration || 0);
        const sampleRate = ctx.sampleRate;
        const length = Math.max(1, Math.ceil(duration * sampleRate));
        const stems = Array.from({ length: STEM_COUNT }, () => ctx.createBuffer(1, length, sampleRate));
        const bpm = Number.isFinite(analysis.bpm) && analysis.bpm > 0 ? analysis.bpm : 120;
        const beatSeconds = 60 / bpm;
        const gridOffset = Number.isFinite(analysis.gridOffset) ? analysis.gridOffset : 0;

        this.renderPattern(stems[0], gridOffset, beatSeconds, duration, [0], 1);
        this.renderPattern(stems[1], gridOffset, beatSeconds, duration, [0.5], 1);
        this.renderPattern(stems[2], gridOffset, beatSeconds, duration, [0, 1 / 3, 2 / 3], 1);
        this.renderPattern(stems[3], gridOffset, beatSeconds, duration, [0, 1.5, 2.5, 3.75], 4);

        return stems;
    }

    private static collectPatternEvents(
        target: Array<{ time: number; intensity: number }>,
        mode: number,
        gridOffset: number,
        beatSeconds: number,
        startTime: number,
        endTime: number,
        beatOffsets: number[],
        beatsPerCycle: number
    ): void {
        if (beatSeconds <= 0) return;
        const firstCycle = Math.max(0, Math.floor((startTime - gridOffset) / (beatSeconds * beatsPerCycle)) - 1);
        for (let cycleStartBeat = firstCycle * beatsPerCycle; ; cycleStartBeat += beatsPerCycle) {
            let pastWindow = true;
            for (const beatOffset of beatOffsets) {
                const time = gridOffset + (cycleStartBeat + beatOffset) * beatSeconds;
                if (time < startTime) {
                    pastWindow = false;
                    continue;
                }
                if (time > endTime) continue;
                pastWindow = false;
                if (this.getBeepModeAtTime(time) === mode) {
                    target.push({ time, intensity: 1.0 });
                }
            }
            if (gridOffset + cycleStartBeat * beatSeconds > endTime && pastWindow) break;
        }
    }

    private static renderPattern(
        buffer: AudioBuffer,
        gridOffset: number,
        beatSeconds: number,
        duration: number,
        beatOffsets: number[],
        beatsPerCycle: number
    ): void {
        if (beatSeconds <= 0 || duration <= 0) return;
        for (let cycleStartBeat = 0; ; cycleStartBeat += beatsPerCycle) {
            let wroteAny = false;
            for (const beatOffset of beatOffsets) {
                const time = gridOffset + (cycleStartBeat + beatOffset) * beatSeconds;
                if (time < 0) continue;
                if (time >= duration) continue;
                this.addBeep(buffer, time);
                wroteAny = true;
            }
            if (gridOffset + cycleStartBeat * beatSeconds > duration && !wroteAny) break;
        }
    }

    private static addBeep(buffer: AudioBuffer, time: number): void {
        const data = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        const start = Math.max(0, Math.floor(time * sampleRate));
        const sampleCount = Math.max(1, Math.floor(BEEP_DURATION_SECONDS * sampleRate));
        const end = Math.min(data.length, start + sampleCount);
        const amplitude = BEEP_BASE_GAIN;
        for (let i = start; i < end; i++) {
            const t = (i - start) / sampleRate;
            const envelope = Math.exp(-8 * t / BEEP_DURATION_SECONDS);
            const sample = Math.sin(2 * Math.PI * BEEP_FREQUENCY_HZ * t) * envelope * amplitude;
            data[i] = clampAudio(data[i] + sample);
        }
    }
}

function clampAudio(value: number): number {
    return Math.max(-1, Math.min(1, value));
}

function clampMode(value: number): number {
    return Math.max(0, Math.min(4, Math.round(Number.isFinite(value) ? value : 0)));
}
