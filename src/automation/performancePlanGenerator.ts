import type {
    BarAnalysis,
    MusicPattern,
    PerformanceAutomationPlan,
    PerformanceAutomationPoint,
    PerformanceAutomationReason,
    TensionTrendSegment,
    TrackAnalysis,
    TrackSection,
    TrackSectionLabel,
    VisualCueEvent
} from '../types';

// ─── Constants & Configuration ────────────────────────────────────────────────

const LONG_SECTION_SEC = 16.0;
const BUILDUP_PEAK_THRESHOLD = 0.85;
const PATTERN_MIN_OCCURRENCES = 2;

const SECTION_INTENSITY: Record<TrackSectionLabel | 'default', number> = {
    intro: 0.6,
    outro: 0.6,
    verse: 0.7,
    build: 0.8,
    break: 0.6,
    drop: 1.5,
    peak: 2.0,
    default: 1.0
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratorOptions {
    strategy: 'dramaturgy' | 'hero' | 'strict';
    presetMetadata: Record<string, any>;
    strictPresets: string[];
    strictBars: number;
    strictMorph: number;
}

export async function generatePerformancePlan(
    trackAnalysis: TrackAnalysis,
    availablePresets: string[],
    duration: number,
    options: GeneratorOptions = { strategy: 'dramaturgy', presetMetadata: {}, strictPresets: [], strictBars: 8, strictMorph: 1.0 }
): Promise<PerformanceAutomationPlan> {
    if (options.strategy === 'strict') {
        return generateStrictPlan(trackAnalysis, duration, options);
    }

    const presets = availablePresets.filter(Boolean);
    const points: PerformanceAutomationPoint[] = [];

    // Pass 1: MACRO STRUCTURE (Absolute Anchors).
    const pass1Points = generatePass1SectionAnchors(trackAnalysis, presets, duration);
    mergePoints(points, pass1Points, 0);

    // Pass 2: DRAMATURGY (Tension & Buildups)
    const pass2Points = generatePass2Dramaturgy(trackAnalysis, presets, duration);
    mergePoints(points, pass2Points, makeDynamicGap(duration, 'build'));

    // Pass 3: PATTERNS (Recurring motifs)
    const pass3Points = generatePass3Patterns(trackAnalysis, presets, duration);
    mergePoints(points, pass3Points, makeDynamicGap(duration, 'build'));

    // Pass 4: MICRO-CUES (Impacts, FX)
    const pass4Points = generatePass4MicroCues(trackAnalysis, presets, duration);
    mergePoints(points, pass4Points, 2.0);

    if (options.strategy === 'hero') {
        await ensureHeroPresetsLoaded(presets, options.presetMetadata);
        remapPresetsForHero(trackAnalysis, points, presets, options.presetMetadata);
    }

    return finalizePlan(points);
}

// ─── Strategy: Strict Alternating ─────────────────────────────────────────────

function generateStrictPlan(
    trackAnalysis: TrackAnalysis,
    duration: number,
    options: GeneratorOptions
): PerformanceAutomationPlan {
    const activePresets = options.strictPresets.filter(Boolean);
    if (activePresets.length === 0) return { version: 1, source: 'auto', points: [] };

    const bpm = trackAnalysis.bpm > 0 ? trackAnalysis.bpm : 120;
    const secondsPerBar = (60 / bpm) * 4;
    const stepSeconds = options.strictBars * secondsPerBar;
    const gridOffset = trackAnalysis.gridOffset ?? 0;

    const points: PerformanceAutomationPoint[] = [];
    let i = 0;
    for (let time = gridOffset; time < duration; time += stepSeconds) {
        const t = Math.min(time, duration);
        points.push({
            id: `strict-${i}-${formatTimeForId(t)}`,
            time: t,
            sectionId: `manual:${formatTimeForId(t)}`,
            preset: activePresets[i % activePresets.length],
            confidence: 1,
            intensity: 1.0,
            reason: 'manual',
            morphDurationSec: options.strictMorph,
            morphCurve: 'easeInOut'
        });
        i++;
    }

    return finalizePlan(points);
}

// ─── Strategy: Hero Rhythm (preset remapping) ─────────────────────────────────

async function ensureHeroPresetsLoaded(presets: string[], metadata: Record<string, any>): Promise<void> {
    await Promise.all(presets.map(async (preset) => {
        if (metadata[preset]) return;
        try {
            const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
            const url = `${baseUrl}visual-tuning-presets/${encodeURIComponent(preset)}`;
            const response = await fetch(url);
            if (response.ok) metadata[preset] = await response.json();
        } catch { /* opportunistic */ }
    }));
}

function remapPresetsForHero(
    trackAnalysis: TrackAnalysis,
    points: PerformanceAutomationPoint[],
    presets: string[],
    metadata: Record<string, any>
): void {
    for (const point of points) {
        const section = getSectionAt(trackAnalysis.sections, point.time);
        if (!section) continue;
        const mode = sectionLabelToHeroMode(section.label);
        point.preset = getPresetForBeepMode(mode, presets, metadata);
    }
}

function sectionLabelToHeroMode(label: TrackSectionLabel): number {
    if (label === 'drop' || label === 'peak') return 4;
    if (label === 'build') return 3;
    if (label === 'verse') return 2;
    return 1; // intro, outro, break
}

function getPresetForBeepMode(mode: number, presets: string[], metadata: Record<string, any>): string {
    for (const preset of presets) {
        const data = metadata[preset];
        if (!data) continue;
        const nested = data?.visualTuning;
        const nestedMode = (nested && typeof nested === 'object') ? (nested as any).heroBeepMode : undefined;
        const actualMode = nestedMode ?? data?.heroBeepMode;
        if (typeof actualMode === 'number' && Math.round(actualMode) === mode) return preset;
    }
    return getFallbackPreset(presets);
}

// ─── Plan finalization (shared by all strategies) ─────────────────────────────

function finalizePlan(points: PerformanceAutomationPoint[]): PerformanceAutomationPlan {
    points.sort((a, b) => a.time - b.time);

    // STRICT DEDUPLICATION PASS: Prevent Visual Engine Race Conditions
    // If two points land on the exact same frame (< 0.05s apart), keep the one with higher intensity/priority.
    const cleanPoints: PerformanceAutomationPoint[] = [];
    for (const p of points) {
        if (cleanPoints.length === 0) {
            cleanPoints.push(p);
            continue;
        }
        const lastP = cleanPoints[cleanPoints.length - 1];
        if (p.time - lastP.time < 0.05) {
            // Keep the one with the higher intensity, or if equal, the macro reason (like 'drop' over 'harmonicShift')
            const pIsMacro = ['drop', 'peak', 'break', 'build'].includes(p.reason);
            const lastPIsMacro = ['drop', 'peak', 'break', 'build'].includes(lastP.reason);

            if (pIsMacro && !lastPIsMacro) {
                cleanPoints[cleanPoints.length - 1] = p; // Replace with macro
            } else if (!pIsMacro && lastPIsMacro) {
                // Ignore p, keep lastP
            } else if (p.intensity > lastP.intensity) {
                cleanPoints[cleanPoints.length - 1] = p; // Replace with higher intensity
            }
        } else {
            cleanPoints.push(p);
        }
    }

    // STRICT ANTI-OVERLAP PASS: Prevent Morph Engine Glitches
    for (let i = 0; i < cleanPoints.length - 1; i++) {
        const current = cleanPoints[i];
        const next = cleanPoints[i + 1];
        const availableTime = next.time - current.time;

        if (current.morphDurationSec > availableTime) {
            current.morphDurationSec = Math.max(0.01, availableTime - 0.01);
            if (current.morphDurationSec < 0.2) {
                current.morphCurve = 'linear';
            }
        }
    }

    return { version: 1, source: 'auto', points: cleanPoints };
}

// ─── Pass 1: Section Anchors (The Foundation) ─────────────────────────────────

function generatePass1SectionAnchors(
    trackAnalysis: TrackAnalysis,
    presets: string[],
    duration: number
): PerformanceAutomationPoint[] {
    const points: PerformanceAutomationPoint[] = [];

    for (let i = 0; i < trackAnalysis.sections.length; i++) {
        const section = trackAnalysis.sections[i];

        // STRICT VJ RULE: Every single section gets an anchor point.
        const time = clampTime(section.start, duration);
        points.push(createPoint(section, i, time, presets, duration, 100.0));

        if (section.end - section.start > LONG_SECTION_SEC) {
            const cues = getSignificantCuesInSection(trackAnalysis, section);
            for (let ci = 0; ci < cues.length; ci++) {
                const cueTime = clampTime(snapToNearestBeat(cues[ci].time, trackAnalysis.bars), duration);
                points.push(createCuePoint(section, i, { ...cues[ci], time: cueTime }, ci, presets, duration));
            }
        }
    }

    return points;
}

// ─── Pass 2: Dramaturgy (Tension) ─────────────────────────────────────────────

function generatePass2Dramaturgy(
    trackAnalysis: TrackAnalysis,
    presets: string[],
    duration: number
): PerformanceAutomationPoint[] {
    const points: PerformanceAutomationPoint[] = [];
    const { tensionTrends, buildupConfidence, sections } = trackAnalysis;

    for (let i = 0; i + 1 < tensionTrends.segments.length; i++) {
        const curr = tensionTrends.segments[i];
        const next = tensionTrends.segments[i + 1];
        
        if (curr.direction === 'rising' && next.direction !== 'rising' && curr.endValue >= 0.6) {
            const peakTime = clampTime(snapToNearestBeat(curr.end, trackAnalysis.bars), duration);
            const section = getSectionAt(sections, peakTime);
            
            if (!section || section.label === 'break' || section.label === 'intro' || section.label === 'outro') continue;

            const si = sections.indexOf(section);
            const point = createPoint(section, si, peakTime, presets, duration, scoreTensionPeak(curr));
            point.reason = 'harmonicShift';
            points.push(point);
        }
    }

    let inHighBuildup = false;
    let highBuildupStart = 0;
    const secPerFrame = buildupConfidence.length > 0 ? duration / buildupConfidence.length : 1;

    for (let fi = 0; fi < buildupConfidence.length; fi++) {
        const conf = buildupConfidence[fi];
        const t = fi * secPerFrame;
        
        if (!inHighBuildup && conf >= BUILDUP_PEAK_THRESHOLD) {
            inHighBuildup = true;
            highBuildupStart = t;
        } else if (inHighBuildup && conf < BUILDUP_PEAK_THRESHOLD) {
            inHighBuildup = false;
            const peakTime = clampTime(snapToNearestBeat(highBuildupStart, trackAnalysis.bars), duration);
            const section = getSectionAt(sections, peakTime);
            
            if (section) {
                const si = sections.indexOf(section);
                const point = createPoint(section, si, peakTime, presets, duration, 0.8);
                point.reason = 'build';
                points.push(point);
            }
        }
    }

    return points;
}

// ─── Pass 3: Pattern-based points ─────────────────────────────────────────────

function generatePass3Patterns(
    trackAnalysis: TrackAnalysis,
    presets: string[],
    duration: number
): PerformanceAutomationPoint[] {
    const points: PerformanceAutomationPoint[] = [];
    const patternPresetMap = new Map<string, string>();

    for (const pattern of trackAnalysis.patterns) {
        if (pattern.occurrences.length < PATTERN_MIN_OCCURRENCES) continue;

        if (!patternPresetMap.has(pattern.id)) {
            const hint = getPatternPresetHint(pattern);
            patternPresetMap.set(pattern.id, findPreset(presets, [hint]) ?? getFallbackPreset(presets));
        }
        const preset = patternPresetMap.get(pattern.id)!;

        for (const occ of pattern.occurrences) {
            const occTime = clampTime(snapToNearestBeat(occ.start, trackAnalysis.bars), duration);
            const section = getSectionAt(trackAnalysis.sections, occTime);
            if (!section) continue;

            const si = trackAnalysis.sections.indexOf(section);
            const profile = getMorphProfile(section);
            points.push({
                id: `pattern-${normalizeIdPart(pattern.id)}-${formatTimeForId(occTime)}`,
                time: occTime,
                sectionId: getSectionId(section, si),
                preset,
                confidence: clamp01(occ.confidence),
                intensity: computeIntensity(section),
                reason: 'harmonicShift',
                morphDurationSec: profile.morphDurationSec,
                morphCurve: profile.morphCurve
            });
        }
    }

    return points;
}

// ─── Pass 4: Micro-cues ────────────────────────────────────────────────────────

function generatePass4MicroCues(
    trackAnalysis: TrackAnalysis,
    presets: string[],
    duration: number
): PerformanceAutomationPoint[] {
    const points: PerformanceAutomationPoint[] = [];
    const cues = trackAnalysis.significantMoments.length > 0 
        ? trackAnalysis.significantMoments 
        : trackAnalysis.cues;

    for (const cue of cues) {
        if (cue.kind !== 'impact' && cue.kind !== 'fx') continue;
        if (cue.confidence < 0.75 && cue.intensity < 0.75) continue;

        const cueTime = clampTime(snapToNearestBeat(cue.time, trackAnalysis.bars), duration);
        const section = getSectionAt(trackAnalysis.sections, cueTime);
        
        if (!section || ['break', 'intro', 'outro', 'build'].includes(section.label)) continue;

        const si = trackAnalysis.sections.indexOf(section);
        const profile = getMorphProfile(section);
        const preset = choosePreset(section, presets);

        points.push({
            id: `micro-${normalizeIdPart(cue.kind)}-${formatTimeForId(cueTime)}`,
            time: cueTime,
            sectionId: getSectionId(section, si),
            preset,
            confidence: clamp01(cue.confidence),
            intensity: computeIntensity(section) * (cue.kind === 'impact' ? 1.2 : 1.0),
            reason: cue.kind === 'impact' ? 'drop' : 'harmonicShift',
            morphDurationSec: Math.min(profile.morphDurationSec, 1.5),
            morphCurve: 'exponential'
        });
    }

    return points;
}

// ─── Core Logic Helpers ────────────────────────────────────────────────────────

function mergePoints(target: PerformanceAutomationPoint[], candidates: PerformanceAutomationPoint[], minGap: number): void {
    const sorted = [...candidates].sort((a, b) => ((b as any)._score || 0) - ((a as any)._score || 0));
    for (const candidate of sorted) {
        if (minGap === 0) {
            target.push(candidate);
            continue;
        }
        const dynamicGap = (candidate.reason === 'drop' || candidate.reason === 'peak') ? 2.0 : minGap;
        const tooClose = target.some(existing => Math.abs(existing.time - candidate.time) < dynamicGap);
        if (!tooClose) target.push(candidate);
    }
}

function makeDynamicGap(duration: number, sectionContext: TrackSectionLabel | 'intro' | 'outro'): number {
    if (sectionContext === 'intro' || sectionContext === 'outro') return clamp(duration / 30, 8.0, 32.0);
    if (sectionContext === 'drop' || sectionContext === 'peak') return 2.0;
    return clamp(duration / 30, 6.0, 20.0);
}

function scoreTensionPeak(segment: TensionTrendSegment): number { return 0.5 + segment.confidence * 0.5; }

function getSectionAt(sections: TrackSection[], time: number): TrackSection | null {
    return sections.find(s => time >= s.start && time <= s.end) ?? null;
}

function getSignificantCuesInSection(trackAnalysis: TrackAnalysis, section: TrackSection): VisualCueEvent[] {
    const cues = trackAnalysis.significantMoments.length > 0 ? trackAnalysis.significantMoments : trackAnalysis.cues;
    return cues
        .filter(cue => (cue.kind === 'impact' || cue.kind === 'break' || cue.intensity >= 0.75) && cue.time >= section.start && cue.time <= section.end)
        .sort((a, b) => a.time - b.time);
}

// ─── Point Factories ───────────────────────────────────────────────────────────

function createPoint(section: TrackSection, sectionIndex: number, time: number, presets: string[], duration: number, score = 0): PerformanceAutomationPoint {
    void duration;
    const profile = getMorphProfile(section);
    const point = {
        id: `performance-${sectionIndex}-${normalizeIdPart(section.label)}-${formatTimeForId(time)}`,
        time: time,
        sectionId: getSectionId(section, sectionIndex),
        preset: choosePreset(section, presets),
        confidence: clamp01(Math.max(0.5, (section.energy + section.density) * 0.5)),
        intensity: computeIntensity(section),
        reason: getAutomationReason(section),
        morphDurationSec: profile.morphDurationSec,
        morphCurve: profile.morphCurve
    };
    (point as any)._score = score;
    return point;
}

function createCuePoint(section: TrackSection, sectionIndex: number, cue: VisualCueEvent, cueIndex: number, presets: string[], duration: number): PerformanceAutomationPoint {
    const point = createPoint(section, sectionIndex, cue.time, presets, duration, 5.0);
    return {
        ...point,
        id: `performance-${sectionIndex}-${normalizeIdPart(cue.kind)}-cue-${cueIndex}-${formatTimeForId(point.time)}`,
        confidence: clamp01(Math.max(point.confidence, cue.confidence)),
        reason: cue.kind === 'break' ? 'break' : point.reason
    };
}

// ─── Semantic Mapping ─────────────────────────────────────────────────────────

function computeIntensity(section: TrackSection): number {
    const base = SECTION_INTENSITY[section.label] ?? SECTION_INTENSITY.default;
    const energyScale = clamp01((section.energy + section.density) * 0.5);
    return clamp(base * (0.7 + energyScale * 0.3), 0.3, 3.0);
}

function choosePreset(section: TrackSection, availablePresets: string[]): string {
    const fallback = getFallbackPreset(availablePresets);
    switch (section.label) {
        case 'intro': case 'outro': return findPreset(availablePresets, ['default', 'temporal2']) ?? fallback;
        case 'build': return findPreset(availablePresets, ['temporal1', 'temporal4']) ?? fallback;
        case 'drop': return findPreset(availablePresets, ['temporal3', 'temporal4']) ?? fallback;
        case 'break': return findPreset(availablePresets, ['temporal5']) ?? fallback;
        case 'peak': return findPreset(availablePresets, ['temporal4']) ?? fallback;
        default: return findPreset(availablePresets, getDominantFeaturePresetHints(section)) ?? fallback;
    }
}

function getPatternPresetHint(pattern: MusicPattern): string {
    if (['melody', 'vocal'].includes(pattern.dominantFeature)) return 'temporal2';
    if (['fx', 'impact'].includes(pattern.dominantFeature)) return 'temporal3';
    return 'temporal1';
}

function getDominantFeaturePresetHints(section: TrackSection): string[] {
    if (['melody', 'vocal'].includes(section.dominantFeature)) return ['temporal2', 'default'];
    if (['fx', 'impact'].includes(section.dominantFeature)) return ['temporal3', 'temporal4'];
    if (section.dominantFeature === 'break') return ['temporal5'];
    return ['default'];
}

function findPreset(availablePresets: string[], hints: string[]): string | null {
    for (const hint of hints) {
        const match = availablePresets.find(p => p.toLowerCase().includes(hint));
        if (match) return match;
    }
    return null;
}

function getFallbackPreset(availablePresets: string[]): string { return availablePresets.find(p => p.toLowerCase() === 'default.json') ?? availablePresets[0] ?? 'default.json'; }

function getMorphProfile(section: TrackSection): Pick<PerformanceAutomationPoint, 'morphDurationSec' | 'morphCurve'> {
    if (['drop', 'peak'].includes(section.label)) return { morphDurationSec: 1.0, morphCurve: 'exponential' };
    if (['intro', 'outro'].includes(section.label)) return { morphDurationSec: 4.0, morphCurve: 'easeInOut' };
    if (['build', 'break'].includes(section.label)) return { morphDurationSec: 2.5, morphCurve: 'easeInOut' };
    return { morphDurationSec: 2.0, morphCurve: 'easeInOut' };
}

function getAutomationReason(section: TrackSection): PerformanceAutomationReason {
    if (['intro', 'verse', 'build', 'drop', 'break', 'peak', 'outro'].includes(section.label)) return section.label as PerformanceAutomationReason;
    return ['melody', 'vocal'].includes(section.dominantFeature) ? 'harmonicShift' : 'manual';
}

// ─── Mathematical Utilities ───────────────────────────────────────────────────

function snapToNearestBeat(time: number, bars: BarAnalysis[]): number {
    if (bars.length < 2) return time;
    const secondsPerBar = bars[1].start - bars[0].start;
    const secondsPerBeat = secondsPerBar / 4;
    const firstBar = bars[0].start;
    const beatIndex = Math.round((time - firstBar) / secondsPerBeat);
    return firstBar + beatIndex * secondsPerBeat;
}

function getSectionId(section: TrackSection, index: number): string { return `${index}:${normalizeIdPart(section.label)}:${formatTimeForId(section.start)}`; }
function normalizeIdPart(value: string): string { return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'section'; }
function formatTimeForId(time: number): string { return time.toFixed(3).replace('.', '-'); }
function clampTime(time: number, duration: number): number { return Math.max(0, Math.min(time, Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY)); }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
