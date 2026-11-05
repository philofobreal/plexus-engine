export type CaptionStyle = 'normal' | 'small' | 'title';
export type CaptionRun = Readonly<{ text: string; emphasis: 'none' | 'bold' | 'italic' }>;
export type CaptionCue = Readonly<{ startMs: number; endMs: number; style: CaptionStyle;
    lines: readonly (readonly CaptionRun[])[] }>;
export type CaptionPlan = readonly CaptionCue[];
export type CaptionDiagnostic = Readonly<{ line: number; code: 'source-size' | 'duration' | 'header' | 'outside-cue'
    | 'interval' | 'track-range' | 'empty' | 'line-size' | 'line-count' | 'cue-count' | 'overlap' }>;
export type CaptionParseResult = Readonly<{ ok: true; plan: CaptionPlan }> |
    Readonly<{ ok: false; diagnostics: readonly CaptionDiagnostic[] }>;

export const captionLimits = Object.freeze({ sourceUnits: 64000, cues: 256, linesPerCue: 8, codePointsPerLine: 200, diagnostics: 24 });
const HEADER = /^## (\d{2,3}:[0-5]\d\.\d{3}) --> (\d{2,3}:[0-5]\d\.\d{3})(?: \[(normal|small|title)\])?$/;
const EMPHASIS = /(?<!\*)\*\*([^*\n]+)\*\*(?!\*)|(?<![\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu;

function milliseconds(stamp: string): number {
    const [min, sec, ms] = stamp.split(/[:.]/).map(Number);
    return min * 60000 + sec * 1000 + ms;
}

/** Markup is always projected as text. The subset has no HTML, URLs, or recursive parsing. */
function runsForLine(line: string): readonly CaptionRun[] {
    const runs: CaptionRun[] = [];
    const add = (text: string, emphasis: CaptionRun['emphasis']) => {
        if (text) runs.push(Object.freeze({ text, emphasis }));
    };
    let offset = 0;
    for (const match of line.matchAll(EMPHASIS)) {
        const start = match.index;
        add(line.slice(offset, start), 'none');
        add(match[1] ?? match[2], match[1] !== undefined ? 'bold' : 'italic');
        offset = start + match[0].length;
    }
    add(line.slice(offset), 'none');
    return Object.freeze(runs);
}

/** Parse once on editing/import. Invalid input never publishes a partial cue plan. */
export function parseTimedCaptions(source: string, durationMs?: number): CaptionParseResult {
    const diagnostics: CaptionDiagnostic[] = [];
    const issue = (line: number, code: CaptionDiagnostic['code']) => {
        if (diagnostics.length < captionLimits.diagnostics) diagnostics.push(Object.freeze({ line, code }));
    };
    const rejected = () => Object.freeze({ ok: false as const, diagnostics: Object.freeze(diagnostics) });
    if (source.length > captionLimits.sourceUnits) { issue(1, 'source-size'); return rejected(); }
    if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0)) { issue(1, 'duration'); return rejected(); }

    type Draft = { line: number; startMs: number; endMs: number; style: CaptionStyle; lines: string[] };
    const drafts: Draft[] = [];
    let active: Draft | undefined;
    let blockCount = 0, inInvalidBlock = false;
    const finish = () => {
        if (!active) return;
        while (active.lines.at(-1) === '') active.lines.pop();
        if (!active.lines.length) issue(active.line, 'empty');
        else if (active.lines.length > captionLimits.linesPerCue) issue(active.line, 'line-count');
        drafts.push(active);
        active = undefined;
    };
    const rows = source.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
    for (const [index, row] of rows.entries()) {
        const line = index + 1, content = row.trim();
        if (/^##(?:\s|$)/.test(content)) {
            finish();
            if (++blockCount > captionLimits.cues) { issue(line, 'cue-count'); break; }
            inInvalidBlock = true;
            const parsed = HEADER.exec(content);
            if (!parsed) { issue(line, 'header'); continue; }
            const startMs = milliseconds(parsed[1]), endMs = milliseconds(parsed[2]);
            if (startMs >= endMs) { issue(line, 'interval'); continue; }
            if (durationMs !== undefined && endMs > durationMs) { issue(line, 'track-range'); continue; }
            inInvalidBlock = false;
            active = { line, startMs, endMs, style: (parsed[3] ?? 'normal') as CaptionStyle, lines: [] };
        } else if (active) {
            if (content || active.lines.length) active.lines.push(content);
            if ([...content].length > captionLimits.codePointsPerLine) issue(line, 'line-size');
        } else if (content && !inInvalidBlock) {
            issue(line, 'outside-cue');
        }
    }
    finish();
    drafts.sort((a, b) => a.startMs - b.startMs || a.line - b.line);
    let occupiedUntil = 0;
    for (const cue of drafts) {
        if (cue.startMs < occupiedUntil) issue(cue.line, 'overlap');
        occupiedUntil = Math.max(occupiedUntil, cue.endMs);
    }
    if (diagnostics.length) return rejected();
    const plan = Object.freeze(drafts.map(({ startMs, endMs, style, lines }) =>
        Object.freeze({ startMs, endMs, style, lines: Object.freeze(lines.map(runsForLine)) })));
    return Object.freeze({ ok: true as const, plan });
}

/** Stateless lookup for forward playback, backward seeks and arbitrary export frames. */
export function captionAtTime(plan: CaptionPlan, timeMs: number): CaptionCue | undefined {
    if (!Number.isFinite(timeMs) || timeMs < 0) return undefined;
    let left = 0, right = plan.length;
    while (left < right) {
        const middle = (left + right) >>> 1;
        if (plan[middle].startMs <= timeMs) left = middle + 1;
        else right = middle;
    }
    const candidate = plan[left - 1];
    return candidate && timeMs < candidate.endMs ? candidate : undefined;
}
