// Offline interpretation of existing measurements, not a new detector or instrument classifier.
import type { BarAnalysis, BeatEvent, TrackAnalysis, TrackSectionLabel, TrackStructureContext, TrackStructureDecision } from '../types';

const unit = (value: number) => Math.max(0, Math.min(1, value));
const quantile = (values: readonly number[], fraction: number) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
};
const LABELS: readonly TrackSectionLabel[] = ['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro'];

/** Called once at the AudioEngine publication boundary, after normalization, for every host.
 * Raw analyzer-v7 fixtures/worker output and every accepted event/grid timestamp stay untouched.
 * Unsupported legacy measurements fail closed; no missing band is interpreted as silence.
 */
export function interpretTrackStructure(analysis: TrackAnalysis, events: readonly BeatEvent[] = [], sourceBars: readonly BarAnalysis[] = analysis.bars): TrackAnalysis {
    const input = analysis, previousInterpretation = analysis.structureInterpretation;
    if (previousInterpretation !== undefined) { analysis = { ...analysis }; delete analysis.structureInterpretation; }
    const { bars, sections, duration } = analysis;
    if (!Number.isFinite(duration) || duration <= 0 || !bars?.length || bars.length < 4 || !sections?.length) return analysis;
    const complete = (intervals: readonly { start: number; end: number }[]) => intervals[0].start === 0
        && Math.abs(intervals.at(-1)!.end - duration) <= .05
        && intervals.every((s, i) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start
            && s.start >= 0 && s.end <= duration + .05 && (!i || Math.abs(s.start - intervals[i - 1].end) <= 1e-6));
    if (!complete(bars) || !complete(sections) || sections.some(s => !LABELS.includes(s.label))) return analysis;
    if (!sourceBars || sourceBars.length !== bars.length || sourceBars.some((b, i) => b.start !== bars[i].start || b.end !== bars[i].end)) return analysis;
    if (sourceBars.some(b => ![b.rmsAmplitude, b.energy, b.density, b.bass, b.mid, b.treble].every(v =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0))) return analysis;
    const rms = bars.map(b => b.rmsAmplitude!);
    const typicalRms = quantile(rms, .75);
    if (typicalRms <= 1e-5) return analysis;
    const fluxReference = Math.max(1e-6, quantile(bars.map(b => b.density), .75));
    const attacks = events.filter(e => Number.isFinite(e.time) && e.time >= 0 && e.time < duration
        && (e.type === 1 || e.type === 2) && Number.isFinite(e.intensity) && e.intensity >= .12)
        .slice().sort((a, b) => a.time - b.time);
    const barSec = quantile(bars.map(b => b.end - b.start), .5);
    let cursor = 0;
    const rates = bars.map(b => {
        while (cursor < attacks.length && attacks[cursor].time < b.start) cursor++;
        const first = cursor;
        while (cursor < attacks.length && attacks[cursor].time < b.end) cursor++;
        return (cursor - first) / (b.end - b.start);
    });
    const supportedRates = rates.map((rate, i) => rate * Math.min(1, (bars[i].end - bars[i].start) / barSec));
    const rateReference = quantile(supportedRates, .75);
    const varies = (values: readonly number[], floor: number) => quantile(values, 1) - quantile(values, 0) > floor;
    if (!varies(rms, 1e-5) && !varies(bars.map(b => b.density), .02) && !varies(supportedRates, .05)
        && !['bass', 'mid', 'treble'].some(k => varies(bars.map(b => b[k as 'bass' | 'mid' | 'treble']), .05))) return analysis;
    const contexts: TrackStructureContext[] = bars.map((b, i) => {
        // Magnitude shares are spectral composition, NOT independent source power or band RMS.
        const total = b.bass + b.mid + b.treble;
        const spectrum = total > 1e-6 ? { low: b.bass / total, mid: b.mid / total, high: b.treble / total } : null;
        return { start: b.start, end: b.end, rmsRatio: rms[i] / typicalRms,
            rhythm: unit(rateReference > 0 ? .5 * b.density / fluxReference + .5 * supportedRates[i] / rateReference : b.density / fluxReference),
            impactRate: rates[i], spectrum,
            activeBands: spectrum && rms[i] > 1e-5 ? (['low', 'mid', 'high'] as const).filter(k => spectrum[k] >= .18) : [] };
    });
    const average = (start: number, end: number) => {
        let support = 0, energy = 0, rhythm = 0, low = 0, spectrumSupport = 0;
        for (const c of contexts) {
            const weight = Math.max(0, Math.min(end, c.end) - Math.max(start, c.start));
            if (!weight) continue;
            support += weight; energy += weight * c.rmsRatio; rhythm += weight * c.rhythm;
            if (c.spectrum) { low += weight * c.spectrum.low; spectrumSupport += weight; }
        }
        return { energy: energy / Math.max(1e-9, support), rhythm: rhythm / Math.max(1e-9, support),
            low: support > 0 && spectrumSupport >= support * .8 ? low / spectrumSupport : null };
    };
    // Compare section means with other active SECTION means, not individual bar peaks.
    // The body-relative spread avoids a fixed loudness increment that compressed tracks cannot reach.
    const sectionMeans = sections.map(s => average(s.start, s.end));
    const body = sectionMeans.filter(s => s.energy >= .72 && s.rhythm >= .45);
    const bodyEnergy = body.map(s => s.energy), bodyRhythm = body.map(s => s.rhythm);
    const peakEnergy = quantile(bodyEnergy, .75), peakRhythm = quantile(bodyRhythm, .6);
    const energyMargin = Math.max(.015, (quantile(bodyEnergy, .75) - quantile(bodyEnergy, .25)) * .5);
    const rhythmMargin = Math.max(.04, (quantile(bodyRhythm, .75) - quantile(bodyRhythm, .25)) * .5);
    const decisions: TrackStructureDecision[] = [];
    const corrected = sections.map((section, index) => {
        const measured = average(section.start, section.end);
        const entry = average(section.start, Math.min(section.end, section.start + barSec * 2));
        const prior = average(Math.max(0, section.start - barSec * 4), section.start);
        const tail = average(Math.max(section.start, section.end - barSec * 2), section.end);
        const own = contexts.filter(c => c.start < section.end && c.end > section.start);
        const future = contexts.filter(c => c.end > section.end);
        const previous = decisions.at(-1);
        const energyRise = entry.energy - prior.energy, rhythmRise = entry.rhythm - prior.rhythm;
        const trend = tail.energy - entry.energy, rhythmTrend = tail.rhythm - entry.rhythm;
        const noLaterBody = future.every(c => c.rmsRatio < .72 || c.rhythm < .35 || Math.min(c.end, duration) - Math.max(c.start, section.end) < barSec * .5);
        const noEarlierBody = contexts.filter(c => c.start < section.start).every(c => c.rmsRatio < .72 || c.rhythm < .35 || Math.min(c.end, section.start) - c.start < barSec * .5);
        const bodyAfter = future.some(c => c.rmsRatio >= .72 && c.rhythm >= .35);
        const low = measured.energy < .72;
        const withdrawn = prior.energy - measured.energy >= .22 && prior.rhythm - measured.rhythm >= .15;
        const risingSteps = own.slice(1).filter((c, i) => c.rmsRatio >= own[i].rmsRatio - .025).length;
        const rising = own.length >= 3 && trend >= .15 && rhythmTrend >= .08 && risingSteps / (own.length - 1) >= .6;
        const spectralBreak = prior.low !== null && measured.low !== null && prior.low - measured.low >= .12
            && prior.rhythm - measured.rhythm >= .25 && measured.energy <= prior.energy * 1.15;
        const rhythmicArrival = prior.low !== null && entry.low !== null && entry.low - prior.low >= .12
            && rhythmRise >= .25 && energyRise >= -.05
            && (previous?.label === 'break' || previous?.label === 'build' || prior.rhythm < .45);
        const energyArrival = index > 0 && entry.energy >= .72 && entry.rhythm >= .45 && energyRise >= .2
            && (rhythmRise >= .15 || previous?.label === 'break' || previous?.label === 'build')
            && (prior.energy < .72 || prior.rhythm < .45 || previous?.label === 'break' || previous?.label === 'build');
        const arrival = energyArrival || index > 0 && entry.energy >= .65 && entry.rhythm >= .45 && rhythmicArrival;
        let label: TrackSectionLabel = 'verse';
        const reasons: string[] = [];
        if (section.start < duration * .2 && noEarlierBody && bodyAfter && low && !rising) {
            label = 'intro'; reasons.push('opening-before-body');
        } else if (index > 0 && section.start >= duration * .65 && noLaterBody && low) {
            label = 'outro'; reasons.push('terminal-without-body-return');
        } else if (arrival) {
            label = 'drop'; reasons.push(energyArrival ? 'energy-and-rhythm-arrival' : 'rhythm-arrival-and-spectral-rebalance');
        } else if (rising) {
            label = 'build'; reasons.push('measured-energy-and-rhythm-rise');
        } else if (spectralBreak || (low && withdrawn) || (previous?.label === 'break' && measured.energy < .65 && measured.rhythm < .55)) {
            label = 'break'; reasons.push(spectralBreak ? 'rhythm-withdrawal-and-spectral-rebalance' : 'energy-and-rhythm-withdrawal');
        } else if (body.length >= 3 && measured.energy >= Math.max(.72, peakEnergy) && measured.rhythm >= Math.max(.65, peakRhythm)
            && (measured.energy >= quantile(bodyEnergy, .5) + energyMargin || measured.rhythm >= quantile(bodyRhythm, .5) + rhythmMargin)) {
            label = 'peak'; reasons.push('sustained-upper-body-energy-and-rhythm');
        } else {
            reasons.push('continuing-body-or-ambiguous-role');
        }
        // The same evidence may retain a vivid mid/high texture during a low-energy break.
        const active = new Set(own.flatMap(c => c.activeBands));
        if (active.size > 1) reasons.push('coexisting-spectral-bands');
        if ((section.label === 'intro' || section.label === 'outro') && label !== section.label) reasons.push('position-label-rejected');
        decisions.push({ sourceSectionIndex: index, start: section.start, end: section.end,
            originalLabel: section.label, label, reasons, energyRatio: measured.energy, rhythm: measured.rhythm,
            entryEnergyRise: energyRise, entryRhythmRise: rhythmRise, energyTrend: trend, rhythmTrend,
            lowShare: measured.low, activeBands: [...active].sort() as TrackStructureContext['activeBands'] });
        return { ...section, label };
    });
    const interpretation: NonNullable<TrackAnalysis['structureInterpretation']> = { version: 1, source: 'published-bar-measurements',
        typicalRms, changedSections: decisions.filter(d => d.label !== d.originalLabel).length,
        limitations: ['boundaries-preserved', 'spectral-shares-not-source-identity', 'uncalibrated-structural-policy'],
        decisions, contexts };
    // Reuse only a complete report associated with the freshly recomputed evidence and labels.
    // Version alone never authenticates a stale or malformed sidecar.
    const same = (a: unknown, b: unknown) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };
    if (previousInterpretation?.version === 1 && Array.isArray(previousInterpretation.decisions)
        && previousInterpretation.decisions.length === decisions.length
        && previousInterpretation.decisions.every((d, i) => d && LABELS.includes(d.originalLabel)
            && d.label === corrected[i].label && d.label === sections[i].label)) {
        const retained = decisions.map((d, i) => {
            const originalLabel = previousInterpretation.decisions[i].originalLabel;
            const reasons = d.reasons.filter(r => r !== 'position-label-rejected');
            if ((originalLabel === 'intro' || originalLabel === 'outro') && originalLabel !== d.label) reasons.push('position-label-rejected');
            return { ...d, originalLabel, reasons };
        });
        const associated = { ...interpretation, decisions: retained, changedSections: retained.filter(d => d.label !== d.originalLabel).length };
        if (same(associated, previousInterpretation)) return input;
    }
    return { ...analysis, sections: corrected, structureInterpretation: interpretation };
}
