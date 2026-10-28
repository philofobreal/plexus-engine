import { instrumentDesign, INSTRUMENT_TOKENS, type HudStyle, type InstrumentSurface } from '../../presentation/InstrumentDesign';
import * as THREE from 'three';
import type { ColoredPart } from './SceneGeometry';

// Bounded static descriptions, shared across redraws; never evaluated from the render tick.
const cache = new Map<string, ReturnType<typeof instrumentDesign>>();
export function paintInstrumentFrame(ctx: CanvasRenderingContext2D, style: HudStyle, width: number, height: number,
    surface: InstrumentSurface = 'panel', seed = 14, fill?: string, accent?: string): void {
    if (style === 'off' || style === 'classic') return;
    const key = `${style}:${width}:${height}:${surface}:${seed}`;
    let design = cache.get(key);
    if (!design) { design = instrumentDesign(style, width, height, surface, seed); if (cache.size >= 32) cache.delete(cache.keys().next().value!); cache.set(key, design); }
    const alpha = ctx.globalAlpha;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const path of design.paths) {
        ctx.beginPath(); ctx.moveTo(path.points[0][0], path.points[0][1]);
        for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i][0], path.points[i][1]);
        if (path.closed) ctx.closePath();
        if (fill && path.closed) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); }
        ctx.strokeStyle = accent && path.ink === 'cyan' ? accent : INSTRUMENT_TOKENS[path.ink]; ctx.globalAlpha = alpha * path.opacity; ctx.lineWidth = path.width; ctx.stroke();
    }
    ctx.restore();
}

/** Static merged parts inside the existing gate envelope. No new mesh/instance per segment. */
export function instrumentGateParts(style: HudStyle, halfWidth: number, halfHeight: number): ColoredPart[] {
    const width = 1024, height = width * halfHeight / halfWidth;
    const design = instrumentDesign(style, width, height, 'gate');
    const parts: ColoredPart[] = [];
    for (const path of design.paths) {
        const points = path.points.map(p => [(p[0] / width * 2 - 1) * halfWidth, (1 - p[1] / height * 2) * halfHeight]);
        const normals = points.slice(1).map((p, i) => { const dx = p[0] - points[i][0], dy = p[1] - points[i][1], len = Math.hypot(dx, dy); return [-dy / len, dx / len]; });
        const positions: number[] = [], indices: number[] = [];
        for (let i = 0; i < points.length; i++) {
            const a = normals[Math.max(0, i - 1)], b = normals[Math.min(normals.length - 1, i)];
            const length = Math.hypot(a[0] + b[0], a[1] + b[1]);
            const nx = (a[0] + b[0]) / length, ny = (a[1] + b[1]) / length;
            const half = .0045 / Math.max(.67, nx * b[0] + ny * b[1]);
            positions.push(points[i][0] + nx * half, points[i][1] + ny * half, 0,
                points[i][0] - nx * half, points[i][1] - ny * half, 0);
            if (i + 1 < points.length) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
        parts.push({ geometry, color: 0xffffff });
    }
    return parts;
}
