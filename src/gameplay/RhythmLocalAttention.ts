// Offline ranking of ALREADY accepted events. No onset, source or instrument recognition.
import type { AudioFrame, BeatEvent } from '../types';
import type { RhythmGenerationSettings } from './RhythmGenerationProfile';
import type { RhythmTexture } from './RhythmTypes';

type Bands = [number, number, number];
export interface RhythmAttentionRecord {
    readonly time: number; readonly intensity: number; readonly type: BeatEvent['type'];
    readonly frame: number; readonly energy: number; readonly change: readonly number[];
}
/** Compact projection of the existing explicit frame clock, not another analyzer sidecar. */
export interface RhythmAttentionEvidence {
    readonly version: 1; readonly source: 'published-frame-change';
    readonly sampleRate: number; readonly hopSize: number; readonly frameCount: number;
    readonly records: readonly RhythmAttentionRecord[];
}
export interface RhythmAttentionSummary {
    readonly version: 1; readonly mode: 'frame-change' | 'events-only';
    readonly fallbackReason?: 'missing-or-invalid-frame-evidence';
    readonly candidates: number; readonly selected: number; readonly windows: number;
    readonly bands: Readonly<Record<'low' | 'mid' | 'high' | 'mixed', number>>;
}
export interface RhythmAttentionWindow {
    start: number; end: number; texture: RhythmTexture;
    kind: 'calm' | 'build' | 'drive' | 'peak'; energy: number;
    primaryBand: 'low' | 'mid' | 'high' | 'mixed';
    accents: number[];
}
export interface RhythmAttentionPlan {
    readonly selected: ReadonlySet<number>; readonly scores: readonly number[];
    readonly windows: readonly RhythmAttentionWindow[]; readonly summary: RhythmAttentionSummary;
}
export interface RhythmAttentionCandidate { readonly event: BeatEvent; readonly index: number }
const unit = (v: number) => Math.max(0, Math.min(1, v));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const total = (v: readonly number[]) => v.reduce((a, b) => a + b, 0);

/** Derive bounded local change from published frames once per chart preparation, no FFT/audio IO.
 * Three groups describe relative spectral CHANGE, never isolated source power or identity.
 */
export function measureRhythmAttention(events: readonly BeatEvent[], duration: number,
    frames: readonly AudioFrame[], sampleRate: number, hopSize: number): RhythmAttentionEvidence | undefined {
    if (!Array.isArray(frames) || !validClock(duration, frames.length, sampleRate, hopSize)) return undefined;
    const records: RhythmAttentionRecord[] = [];
    for (const event of events) {
        const index = Math.floor(Math.round(event.time * sampleRate) / hopSize);
        const frame = frames[index], previous = frames[Math.max(0, index - 1)];
        if (!frame || !previous || !finite(frame.e) || !finite(previous.e)
            || !Array.isArray(frame.perceptualSpectrum) || !Array.isArray(previous.perceptualSpectrum)
            || frame.perceptualSpectrum.length !== 24 || previous.perceptualSpectrum.length !== 24
            || !frame.perceptualSpectrum.every(finite) || !previous.perceptualSpectrum.every(finite)) return undefined;
        const change: Bands = [0, 0, 0];
        for (let band = 0; band < 24; band++) change[Math.floor(band / 8)] +=
            Math.max(0, frame.perceptualSpectrum[band] - previous.perceptualSpectrum[band]) / 8;
        records.push({ time: event.time, intensity: event.intensity, type: event.type, frame: index,
            energy: frame.e, change });
    }
    return { version: 1, source: 'published-frame-change', sampleRate, hopSize, frameCount: frames.length, records };
}

function validClock(duration: number, frameCount: number, sampleRate: number, hopSize: number): boolean {
    return Number.isFinite(duration) && duration > 0 && Number.isSafeInteger(frameCount) && frameCount > 0
        && Number.isSafeInteger(sampleRate) && sampleRate >= 1000 && sampleRate <= 384000
        && Number.isSafeInteger(hopSize) && hopSize >= 4 && hopSize <= 65536 && Number.isInteger(Math.log2(hopSize))
        && Math.abs(frameCount - Math.ceil(duration * sampleRate / hopSize)) <= 1;
}
function validEvidence(evidence: RhythmAttentionEvidence | undefined, events: readonly BeatEvent[], duration: number): evidence is RhythmAttentionEvidence {
    return !!evidence && evidence.version === 1 && evidence.source === 'published-frame-change'
        && validClock(duration, evidence.frameCount, evidence.sampleRate, evidence.hopSize)
        && Array.isArray(evidence.records) && evidence.records.length === events.length
        && evidence.records.every((r, i) => r && r.time === events[i].time && r.intensity === events[i].intensity && r.type === events[i].type
            && r.frame === Math.floor(Math.round(r.time * evidence.sampleRate) / evidence.hopSize)
            && r.frame >= 0 && r.frame < evidence.frameCount && finite(r.energy)
            && Array.isArray(r.change) && r.change.length === 3 && r.change.every(finite));
}

/** Activity sets a local event budget; measured salience chooses WHICH original events survive.
 * Windows use the trusted musical meter, never visual points or section labels. Missing frame
 * evidence explicitly degrades to event-intensity/IOI evidence, not a guessed instrument stream.
 */
export function planRhythmAttention(candidates: readonly RhythmAttentionCandidate[], events: readonly BeatEvent[],
    duration: number, beatSec: number, bars: readonly number[], reliable: boolean,
    settings: RhythmGenerationSettings, minimumSpacing: number, difficultyScale: number,
    evidence?: RhythmAttentionEvidence): RhythmAttentionPlan {
    const measured = validEvidence(evidence, events, duration);
    const selected = new Set<number>(), scores = new Array<number>(events.length).fill(0);
    const windows: RhythmAttentionWindow[] = [], bands = { low: 0, mid: 0, high: 0, mixed: 0 };
    const fraction = (settings.activity === 'active' ? .8 : settings.activity === 'macro' ? .5 : 2 / 3)
        * Math.min(1, 1 / difficultyScale);
    let cursor = 0, bar = 0, lastAccent = -Infinity;
    while (cursor < candidates.length) {
        const first = candidates[cursor].event.time;
        while (bar + 1 < bars.length && bars[bar + 1] <= first) bar++;
        const meterEnd = bars[bar + 1] ?? (bars[bar] ?? 0) + beatSec * 4;
        const onMeter = reliable && bars.length > 0 && bars[bar] <= first && first < meterEnd;
        const fallbackOrigin = reliable && bars.length && first >= meterEnd ? meterEnd : 0;
        const start = onMeter ? bars[bar] : fallbackOrigin + Math.floor((first - fallbackOrigin) / (beatSec * 4)) * beatSec * 4;
        const end = Math.min(duration + 1e-6, onMeter ? bars[bar + 1] ?? start + beatSec * 4
            : Math.min(start + beatSec * 4, reliable && bars[bar] > first ? bars[bar] : Infinity));
        let next = cursor + 1;
        while (next < candidates.length && candidates[next].event.time < end) next++;
        const members = candidates.slice(cursor, next), changes: Bands = [0, 0, 0];
        const intensities = members.map(m => m.event.intensity);
        const meanIntensity = total(intensities) / members.length;
        for (const m of members) if (measured) for (let b = 0; b < 3; b++) changes[b] += evidence.records[m.index].change[b];
        const flux = total(changes), meanFlux = flux / members.length;
        for (const m of members) {
            const record = measured ? evidence.records[m.index] : undefined, own = record ? total(record.change) : 0;
            const alignment = own > 1e-9 && flux > 1e-9 ? total(changes.map((v, b) => v / flux * record!.change[b] / own)) : 0;
            scores[m.index] = .2 + .5 * Math.min(2, m.event.intensity / Math.max(1e-9, meanIntensity))
                + (record ? .6 * Math.min(2, own / Math.max(1e-9, meanFlux)) + .5 * alignment : 0);
        }
        const maximum = Math.max(...changes), primary = flux > 1e-9 && maximum / flux >= .5 ? changes.indexOf(maximum) : -1;
        const primaryBand = (['low', 'mid', 'high'] as const)[primary] ?? 'mixed'; bands[primaryBand]++;
        const gaps = members.slice(1).map((m, i) => m.event.time - members[i].event.time);
        const meanGap = gaps.length ? total(gaps) / gaps.length : beatSec * 4;
        const deviation = gaps.length ? Math.sqrt(total(gaps.map(g => (g - meanGap) ** 2)) / gaps.length) : 0;
        const regularity = unit(1 - deviation / Math.max(.01, meanGap));
        const energies = measured ? members.map(m => evidence.records[m.index].energy) : intensities;
        const energy = unit(total(energies) / energies.length);
        const trend = energies.at(-1)! - energies[0];
        const sparse = members.length * beatSec / Math.max(beatSec, end - start) < .7;
        const contrast = intensities.reduce((a, b) => Math.max(a, b), 0) / Math.max(1e-9, meanIntensity);
        const texture: RhythmTexture = sparse && energy < .4 ? 'breath' : trend > .18 && members.length >= 4 ? 'build'
            : contrast > 1.45 ? 'impact' : regularity > .8 ? 'pulse' : primary === 1 || primary === 2 ? 'weave' : 'drive';
        const kind = texture === 'breath' ? 'calm' : texture === 'build' ? 'build' : texture === 'impact' ? 'peak' : 'drive';
        const budget = Math.min(128, members.length <= 2 ? members.length : Math.max(1, Math.ceil(members.length * fraction)),
            Math.max(1, Math.ceil((end - start) / minimumSpacing)));
        const choices = select(members, scores, budget, minimumSpacing);
        for (const i of choices) selected.add(i);
        const ordered = choices.slice().sort((a, b) => scores[b] - scores[a] || events[a].time - events[b].time);
        const meanScore = total(members.map(m => scores[m.index])) / members.length;
        const together = settings.handPattern === 'together';
        const bestTime = ordered.length ? events[ordered[0]].time : -Infinity;
        const accents = ordered.length && (together ? members.length >= 3
            : scores[ordered[0]] > meanScore * 1.15 && bestTime - lastAccent >= beatSec * 8)
            ? [bestTime] : [];
        if (accents.length) lastAccent = bestTime;
        windows.push({ start, end, texture, kind, energy, primaryBand, accents });
        cursor = next;
    }
    // Reconcile only the physical spacing across window edges, preferring the stronger event.
    let previous: RhythmAttentionCandidate | undefined;
    for (const c of candidates) if (selected.has(c.index)) {
        if (previous && c.event.time - previous.event.time < minimumSpacing - 1e-9) {
            if (scores[c.index] > scores[previous.index]) { selected.delete(previous.index); previous = c; }
            else selected.delete(c.index);
        } else previous = c;
    }
    return { selected, scores, windows, summary: { version: 1, mode: measured ? 'frame-change' : 'events-only',
        ...(!measured ? { fallbackReason: 'missing-or-invalid-frame-evidence' as const } : {}),
        candidates: candidates.length, selected: selected.size, windows: windows.length, bands } };
}

/** Maximum-weight feasible subset with a fixed local budget. Equal scores prefer earlier events.
 * Two score rows plus one byte per decision; no per-sample render/runtime work.
 */
function select(members: readonly RhythmAttentionCandidate[], scores: readonly number[], budget: number, spacing: number): number[] {
    const width = members.length + 1, take = new Uint8Array((budget + 1) * width), preceding = new Int32Array(members.length);
    for (let i = 0, left = -1; i < members.length; i++) {
        while (left + 1 < i && members[left + 1].event.time <= members[i].event.time - spacing + 1e-9) left++;
        preceding[i] = left;
    }
    let previous = new Float64Array(width), current = new Float64Array(width);
    for (let k = 1; k <= budget; k++) {
        current[0] = 0;
        for (let i = 1; i < width; i++) {
            const include = previous[preceding[i - 1] + 1] + scores[members[i - 1].index];
            if (include > current[i - 1] + 1e-12) { current[i] = include; take[k * width + i] = 1; }
            else current[i] = current[i - 1];
        }
        [previous, current] = [current, previous];
    }
    const out: number[] = [];
    for (let i = members.length, k = budget; i > 0 && k > 0;) {
        if (take[k * width + i]) { out.push(members[i - 1].index); i = preceding[i - 1] + 1; k--; } else i--;
    }
    return out.reverse();
}
