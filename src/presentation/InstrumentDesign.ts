// Shared, renderer-independent instrument vocabulary. No clock, track inference or mutable state.
export type HudStyle = 'classic' | 'angular' | 'orbital' | 'off';
export type InstrumentSurface = 'panel' | 'menu' | 'control' | 'strip' | 'gate';
export const INSTRUMENT_TOKENS = Object.freeze({ font: '"Segoe UI", "Roboto", system-ui, sans-serif',
    ink: '#eef8ff', cyan: '#4fd8ff', magenta: '#ff5fb4', muted: '#8ba6c4', glass: 'rgba(2,6,16,0.78)',
    angularDivisions: 12, orbitalDivisions: 8 });
export interface InstrumentPath { readonly points: readonly (readonly [number, number])[];
    readonly ink: 'cyan' | 'magenta' | 'muted'; readonly opacity: number; readonly width: number; readonly closed?: boolean }
export interface InstrumentDesign { readonly width: number; readonly height: number; readonly paths: readonly InstrumentPath[] }
export function normalizeHudStyle(value: unknown): HudStyle {
    return value === 'angular' || value === 'orbital' || value === 'off' ? value : 'classic';
}
function hash(seed: number): number {
    let h = Math.imul(seed | 0, 0x85ebca6b); h ^= h >>> 13; return (Math.imul(h, 0xc2b2ae35) >>> 0);
}

/** Pixel-space border geometry. The middle 78% is reserved for explicit data/text.
 * Fixed complexity: <=12 paths, <=192 vertices, no subpixel strokes or animated noise.
 */
export function instrumentDesign(style: HudStyle, width: number, height: number,
    surface: InstrumentSurface = 'panel', seed = 14): InstrumentDesign {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8 || width > 8192 || height > 8192)
        throw new Error('Invalid instrument layout');
    if (!Number.isSafeInteger(seed)) throw new Error('Invalid instrument seed');
    const paths: InstrumentPath[] = [], inset = surface === 'panel' ? Math.min(20, width * .05, height * .05) : 3;
    const l = inset, t = inset, r = width - inset, b = height - inset;
    const radius = Math.min((r - l) * .12, (b - t) * .2, style === 'orbital' ? 64 : 26);
    const line = (points: readonly (readonly [number, number])[], ink: InstrumentPath['ink'] = 'cyan', opacity = .65, closed = false) =>
        paths.push({ points, ink, opacity, width: surface === 'strip' ? 2 : 3, ...(closed ? { closed: true } : {}) });
    if (style === 'off') return { width, height, paths };
    if (surface === 'gate') {
        const arm = Math.min(width, height) * .24;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
            const x = sx < 0 ? l : r, y = sy < 0 ? t : b, dx = -sx, dy = -sy;
            const points: [number, number][] = [[x + dx * arm, y], [x + dx * radius, y]];
            if (style === 'orbital') for (let i = 1; i <= 12; i++) {
                const a = i / 12 * Math.PI / 2;
                points.push([x + dx * radius * (1 - Math.sin(a)), y + dy * radius * (1 - Math.cos(a))]);
            } else points.push([x, y + dy * radius]);
            points.push([x, y + dy * arm]); line(points);
        }
    } else {
        const points: [number, number][] = [];
        if (style === 'orbital') {
            for (const [cx, cy, begin] of [[r - radius, t + radius, -Math.PI / 2], [r - radius, b - radius, 0],
                [l + radius, b - radius, Math.PI / 2], [l + radius, t + radius, Math.PI]])
                for (let i = 0; i <= 12; i++) { const a = begin + i / 12 * Math.PI / 2; points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]); }
        } else points.push([l + radius, t], [r - radius, t], [r, t + radius], [r, b - radius],
            [r - radius, b], [l + radius, b], [l, b - radius], [l, t + radius]);
        line(points, 'cyan', .48, true);
        if ((surface === 'panel' || surface === 'menu') && r - l - 2 * radius > 48) {
            const h = hash(seed), count = 4 + h % 3, span = Math.min(width * .2, 160, r - l - 2 * radius - 24);
            for (let i = 0; i < count; i++) {
                const x = l + radius + 12 + i * span / count;
                line([[x, t], [x + Math.max(4, span / count - 8), t]], i === count - 1 ? 'magenta' : 'cyan', .95);
            }
            line([[r - radius - span, b], [r - radius - 12, b]], 'magenta', .85);
        }
    }
    return { width, height, paths };
}

/** Same description for a DOM background; never contains user text, events or external assets. */
export function instrumentSvg(style: HudStyle, width = 1024, height = 768, seed = 14): string {
    const d = instrumentDesign(style, width, height, 'panel', seed);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">` + d.paths.map(p =>
        `<path d="M${p.points.map(v => v.map(n => n.toFixed(2)).join(',')).join('L')}${p.closed ? 'Z' : ''}" stroke="${INSTRUMENT_TOKENS[p.ink]}" stroke-opacity="${p.opacity}" stroke-width="${p.width}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('') + '</svg>';
}
