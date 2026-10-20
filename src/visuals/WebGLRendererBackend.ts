// WebGL2 renderer backend for the Wormhole background (ADR-009 Addendum AF): the same
// `VisualRendererBackend` the identity draws through, rasterized by WebGL instead of Canvas2D.
//
// Why: a Chromium OffscreenCanvas 2D context records every stroke in the worker and replays it on
// the browser's GPU thread, one Skia operation per primitive. A Wormhole frame strokes thousands of
// lines, so each background redraw keeps that thread busy for a while, and in the headset that
// thread also submits the headset's frames. Here the strokes are batched: every line and filled
// circle in painter's order becomes one instance of one draw call, and a frame takes a handful of
// draw calls instead of thousands of operations.
//
// Fidelity to Canvas2D (the reference look):
// - Coordinates are canvas pixels, +y down; the image comes out top row first, like a 2D canvas.
// - Blending happens on the stored (sRGB-encoded) values, premultiplied, like Canvas2D.
// - Lines: the capsule / box coverage of `GrainLineRenderer` (round or square caps, a one-pixel
//   ramp, sub-pixel widths fading like a hairline). A filled circle is a zero-length round line.
// - Radial gradients interpolate their stops unpremultiplied (concentric, padded), like Canvas2D.
// - `compositeRingTint` blends with the W3C separable / non-separable formulas against a copy of the
//   frame so far (saturation, overlay, screen, soft-light), clipped to the angular sector.
// - Field rasters use the Canvas path's exact 8-bit pixels (`writeFieldRasterPixels`), filtered
//   bilinearly premultiplied.
// - Triangles and shapes (unused by the Wormhole) fill without antialiasing.
//
// The host calls `finish()` once the identity drew a frame; drawing commands are only queued before.

import type { FieldRasterBlendMode, RingTintCompositeMode, VisualRendererBackend } from './RendererBackend';
import { MAX_FIELD_RASTER_PIXELS, writeFieldRasterPixels } from './CanvasFieldRasterSurface';
import type { Canvas2DSurfaceFactory } from './Canvas2DRendererBackend';

/** Floats per batched primitive: segment (x1, y1, x2, y2), width, colour (r, g, b, a in 0-1), kind. */
export const WEBGL_PRIMITIVE_STRIDE = 10;
/** Primitive kinds: a round-capped line (also a filled circle), a square-capped line, a circle outline. */
export const PRIMITIVE_ROUND = 0;
export const PRIMITIVE_SQUARE = 1;
export const PRIMITIVE_RING = 2;
const INITIAL_PRIMITIVES = 4096;

const PRIMITIVE_VERTEX = /* glsl */ `#version 300 es
in vec2 aCorner;
in vec4 aSegment;
in float aWidth;
in vec4 aColor;
in float aKind;
uniform vec2 uSize;
out vec2 vLocal;
out float vHalfLength;
out float vHalfWidth;
out float vCoverage;
out float vRadius;
out vec4 vColor;
flat out int vKind;
void main() {
    // Sub-pixel strokes cover one pixel at proportionally lower opacity (like a hairline).
    float halfWidth = max(aWidth, 1.0) * 0.5;
    vHalfWidth = halfWidth;
    vCoverage = min(aWidth, 1.0);
    vColor = aColor;
    vKind = int(aKind + 0.5);
    vec2 p;
    if (vKind == ${PRIMITIVE_RING}) {
        float reach = aSegment.z + halfWidth + 1.0;
        vec2 corner = vec2(aCorner.x * 2.0 - 1.0, aCorner.y) * reach;
        vLocal = corner;
        vRadius = aSegment.z;
        vHalfLength = 0.0;
        p = aSegment.xy + corner;
    } else {
        vec2 p1 = aSegment.xy, delta = aSegment.zw - aSegment.xy;
        float len = length(delta);
        vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
        vec2 across = vec2(-dir.y, dir.x);
        float reach = halfWidth + 1.0;
        float along = mix(-reach, len + reach, aCorner.x);
        float side = aCorner.y * reach;
        p = p1 + dir * along + across * side;
        vLocal = vec2(along - 0.5 * len, side);
        vHalfLength = 0.5 * len;
        vRadius = 0.0;
    }
    // Canvas pixels (+y down) to clip space: the canvas's top row is the image's top row.
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`;

const PRIMITIVE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in float vHalfLength;
in float vHalfWidth;
in float vCoverage;
in float vRadius;
in vec4 vColor;
flat in int vKind;
out vec4 outColor;
void main() {
    float distanceOut;
    if (vKind == ${PRIMITIVE_RING}) {
        distanceOut = abs(length(vLocal) - vRadius) - vHalfWidth;
    } else if (vKind == ${PRIMITIVE_SQUARE}) {
        vec2 q = abs(vLocal) - vec2(vHalfLength + vHalfWidth, vHalfWidth);
        distanceOut = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    } else {
        distanceOut = length(vec2(max(abs(vLocal.x) - vHalfLength, 0.0), vLocal.y)) - vHalfWidth;
    }
    float alpha = vColor.a * clamp(0.5 - distanceOut, 0.0, 1.0) * vCoverage;
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb * alpha, alpha);
}`;

/** A rectangle in canvas pixels; the fragment receives its canvas pixel position and its 0-1 coordinate. */
const QUAD_VERTEX = /* glsl */ `#version 300 es
in vec2 aCorner;
uniform vec4 uRect;
uniform vec2 uSize;
out vec2 vPixel;
out vec2 vUv;
void main() {
    vec2 corner = vec2(aCorner.x, aCorner.y * 0.5 + 0.5);
    vec2 p = uRect.xy + corner * uRect.zw;
    vPixel = p;
    vUv = corner;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`;

/** Concentric radial gradient with up to four stops, interpolated unpremultiplied and padded. */
const GRADIENT_GLSL = /* glsl */ `
uniform vec2 uCenter;
uniform float uInner;
uniform float uOuter;
uniform int uStopCount;
uniform float uStopT[4];
uniform vec4 uStopColor[4];
vec4 gradientAt(vec2 pixel) {
    float t = clamp((length(pixel - uCenter) - uInner) / max(uOuter - uInner, 1e-6), 0.0, 1.0);
    vec4 color = uStopColor[0];
    for (int i = 1; i < 4; i++) {
        if (i >= uStopCount) break;
        float t0 = uStopT[i - 1], t1 = uStopT[i];
        if (t >= t0) color = mix(uStopColor[i - 1], uStopColor[i], t1 > t0 ? clamp((t - t0) / (t1 - t0), 0.0, 1.0) : 1.0);
    }
    return color;
}`;

const GRADIENT_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
${GRADIENT_GLSL}
void main() {
    vec4 c = gradientAt(vPixel);
    outColor = vec4(c.rgb * c.a, c.a);
}`;

/**
 * Ring tint: the gradient as the source, blended into a copy of the frame so far with a W3C blend
 * mode, written without fixed-function blending. Outside the angular sector the source is
 * transparent, so the destination stays exactly as it was.
 */
const RING_TINT_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBackdrop;
uniform int uMode;
uniform vec2 uSector;
uniform float uSectorOn;
${GRADIENT_GLSL}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
    float l = lum(c), n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
    if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
    if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
    return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
    float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
    return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
float softLight(float b, float s) {
    if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
    float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
    return b + (2.0 * s - 1.0) * (d - b);
}
float overlay(float b, float s) { return b <= 0.5 ? 2.0 * s * b : 1.0 - 2.0 * (1.0 - s) * (1.0 - b); }
vec3 blendColor(vec3 b, vec3 s) {
    if (uMode == 0) return setLum(setSat(b, sat(s)), lum(b));
    if (uMode == 1) return vec3(overlay(b.r, s.r), overlay(b.g, s.g), overlay(b.b, s.b));
    if (uMode == 2) return b + s - b * s;
    return vec3(softLight(b.r, s.r), softLight(b.g, s.g), softLight(b.b, s.b));
}
void main() {
    vec4 dst = texelFetch(uBackdrop, ivec2(gl_FragCoord.xy), 0);
    vec4 src = gradientAt(vPixel);
    if (uSectorOn > 0.5) {
        // Canvas angles grow clockwise on screen (+y down); the wedge runs from start to end.
        float angle = atan(vPixel.y - uCenter.y, vPixel.x - uCenter.x);
        float sweep = mod(angle - uSector.x, 6.28318530718);
        if (sweep > uSector.y) src.a = 0.0;
    }
    float as = src.a, ab = dst.a;
    vec3 cb = ab > 0.0 ? dst.rgb / ab : vec3(0.0);
    vec3 mixed = blendColor(clamp(cb, 0.0, 1.0), src.rgb);
    vec3 co = src.rgb * as * (1.0 - ab) + dst.rgb * (1.0 - as) + as * ab * mixed;
    outColor = vec4(co, as + ab * (1.0 - as));
}`;

/** A field raster (premultiplied RGBA8, bilinear), blended by the fixed function. */
const RASTER_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uRaster;
void main() { outColor = texture(uRaster, vUv); }`;

/** Solid premultiplied fill (triangles and shapes). */
const SOLID_VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
uniform vec2 uSize;
void main() { gl_Position = vec4(aPosition.x / uSize.x * 2.0 - 1.0, 1.0 - aPosition.y / uSize.y * 2.0, 0.0, 1.0); }`;
const SOLID_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = uColor; }`;

const RING_MODES: Readonly<Record<RingTintCompositeMode, number>> = { saturation: 0, overlay: 1, screen: 2, 'soft-light': 3 };

/** A 0-255 channel (CSS rounding and clamping) as 0-1. */
function channel(value: number): number {
    return Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) / 255 : 0;
}

/** An alpha in [0, 1] (CSS clamps; non-finite draws nothing). */
function unitAlpha(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

interface Program {
    readonly program: WebGLProgram;
    readonly uniforms: Record<string, WebGLUniformLocation | null>;
}

/** The 2D drawing surface the host's factory provides (an OffscreenCanvas in a worker). */
type WebGLSurface = HTMLCanvasElement & { getContext(type: 'webgl2', attributes?: WebGLContextAttributes): WebGL2RenderingContext | null };

export class WebGLRendererBackend implements VisualRendererBackend {
    readonly canvas: HTMLCanvasElement;
    readonly compactMaterialPreview = true;
    frameCount = 0;
    private readonly gl: WebGL2RenderingContext;
    private readonly primitiveProgram: Program;
    private readonly gradientProgram: Program;
    private readonly ringProgram: Program;
    private readonly rasterProgram: Program;
    private readonly solidProgram: Program;
    private readonly primitiveVao: WebGLVertexArrayObject;
    private readonly quadVao: WebGLVertexArrayObject;
    private readonly solidVao: WebGLVertexArrayObject;
    private readonly instanceBuffer: WebGLBuffer;
    private readonly solidBuffer: WebGLBuffer;
    private primitives = new Float32Array(INITIAL_PRIMITIVES * WEBGL_PRIMITIVE_STRIDE);
    private primitiveCount = 0;
    private backdrop: WebGLTexture | null = null;
    private backdropWidth = 0;
    private backdropHeight = 0;
    private readonly rasters: { texture: WebGLTexture | null; cols: number; rows: number; buffer: Float32Array | null; pixels: Uint8ClampedArray | null }[] =
        [0, 1, 2].map(() => ({ texture: null, cols: 0, rows: 0, buffer: null, pixels: null }));
    private strokeActive = true;
    private fillActive = true;
    private strokeR = 0; private strokeG = 0; private strokeB = 0; private strokeA = 1;
    private fillR = 1; private fillG = 1; private fillB = 1; private fillA = 1;
    private weight = 1;
    private shape: number[] = [];
    /** Gradient stop uniforms, reused (a frame may draw dozens of glows). */
    private readonly stopT = new Float32Array(4);
    private readonly stopColor = new Float32Array(16);
    /** Draw calls issued for the frames so far (diagnostics and tests). */
    drawCalls = 0;

    constructor(width: number, height: number, createSurface: Canvas2DSurfaceFactory) {
        this.canvas = createSurface(width, height);
        const gl = (this.canvas as WebGLSurface).getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false,
            depth: false, stencil: false, preserveDrawingBuffer: false });
        if (!gl) throw new Error('WebGL2 is unavailable for the Wormhole background.');
        this.gl = gl;
        this.primitiveProgram = this.link(PRIMITIVE_VERTEX, PRIMITIVE_FRAGMENT, ['uSize']);
        const gradientUniforms = ['uSize', 'uRect', 'uCenter', 'uInner', 'uOuter', 'uStopCount', 'uStopT', 'uStopColor'];
        this.gradientProgram = this.link(QUAD_VERTEX, GRADIENT_FRAGMENT, gradientUniforms);
        this.ringProgram = this.link(QUAD_VERTEX, RING_TINT_FRAGMENT, [...gradientUniforms, 'uBackdrop', 'uMode', 'uSector', 'uSectorOn']);
        this.rasterProgram = this.link(QUAD_VERTEX, RASTER_FRAGMENT, ['uSize', 'uRect', 'uRaster']);
        this.solidProgram = this.link(SOLID_VERTEX, SOLID_FRAGMENT, ['uSize', 'uColor']);
        // Corners of one quad (u along 0..1, v across -1..1), shared by the primitives and the rectangles.
        const corners = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
        this.instanceBuffer = gl.createBuffer()!;
        this.primitiveVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.primitiveVao);
        this.cornerAttribute(this.primitiveProgram, corners);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        const stride = WEBGL_PRIMITIVE_STRIDE * 4;
        this.instanceAttribute(this.primitiveProgram, 'aSegment', 4, stride, 0);
        this.instanceAttribute(this.primitiveProgram, 'aWidth', 1, stride, 16);
        this.instanceAttribute(this.primitiveProgram, 'aColor', 4, stride, 20);
        this.instanceAttribute(this.primitiveProgram, 'aKind', 1, stride, 36);
        this.quadVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.quadVao);
        this.cornerAttribute(this.gradientProgram, corners);
        this.solidBuffer = gl.createBuffer()!;
        this.solidVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.solidVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer);
        const position = gl.getAttribLocation(this.solidProgram.program, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        this.sourceOver();
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    get width(): number { return this.canvas.width; }
    get height(): number { return this.canvas.height; }
    /** Primitives waiting in the current batch (tests). */
    get pendingPrimitives(): number { return this.primitiveCount; }

    background(r: number, g: number, b: number, a = 255): void {
        // clearRect + fillRect of rgba(r, g, b, a / 255): the frame starts as that colour at that alpha.
        this.flush();
        const gl = this.gl, alpha = unitAlpha(a / 255);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(channel(r) * alpha, channel(g) * alpha, channel(b) * alpha, alpha);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    noStroke(): void { this.strokeActive = false; }
    noFill(): void { this.fillActive = false; }
    fill(r: number, g: number, b: number, a = 255): void {
        this.fillActive = true;
        this.fillR = channel(r); this.fillG = channel(g); this.fillB = channel(b); this.fillA = unitAlpha(a / 255);
    }
    stroke(r: number, g: number, b: number, a = 255): void {
        this.strokeActive = true;
        this.strokeR = channel(r); this.strokeG = channel(g); this.strokeB = channel(b); this.strokeA = unitAlpha(a / 255);
    }
    /** Like a 2D context's lineWidth: a non-finite or non-positive width keeps the previous one. */
    strokeWeight(weight: number): void { if (Number.isFinite(weight) && weight > 0) this.weight = weight; else if (weight <= 0) this.weight = 0.0001; }
    line(x1: number, y1: number, x2: number, y2: number, cap?: 'round' | 'square'): void {
        if (!this.strokeActive || !(this.strokeA > 0)) return;
        this.push(x1, y1, x2, y2, this.weight, this.strokeR, this.strokeG, this.strokeB, this.strokeA, cap === 'square' ? PRIMITIVE_SQUARE : PRIMITIVE_ROUND);
    }
    circle(x: number, y: number, diameter: number): void {
        const d = Math.max(0, diameter);
        // A filled disc is a zero-length round line as wide as the circle.
        if (this.fillActive && this.fillA > 0 && d > 0) this.push(x, y, x, y, d, this.fillR, this.fillG, this.fillB, this.fillA, PRIMITIVE_ROUND);
        if (this.strokeActive && this.strokeA > 0) this.push(x, y, d / 2, 0, this.weight, this.strokeR, this.strokeG, this.strokeB, this.strokeA, PRIMITIVE_RING);
    }
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        this.beginShape(); this.vertex(x1, y1); this.vertex(x2, y2); this.vertex(x3, y3); this.endShape(true);
    }
    beginShape(): void { this.shape.length = 0; }
    vertex(x: number, y: number): void { if (Number.isFinite(x) && Number.isFinite(y)) this.shape.push(x, y); }
    endShape(close = false): void {
        const points = this.shape;
        if (this.fillActive && this.fillA > 0 && points.length >= 6) {
            this.beginPass();
            const gl = this.gl, fan: number[] = [];
            for (let i = 2; i + 3 < points.length; i += 2) fan.push(points[0], points[1], points[i], points[i + 1], points[i + 2], points[i + 3]);
            gl.useProgram(this.solidProgram.program);
            gl.uniform2f(this.solidProgram.uniforms.uSize, this.width, this.height);
            gl.uniform4f(this.solidProgram.uniforms.uColor, this.fillR * this.fillA, this.fillG * this.fillA, this.fillB * this.fillA, this.fillA);
            gl.bindVertexArray(this.solidVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fan), gl.STREAM_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, fan.length / 2);
            this.drawCalls++;
        }
        // Like a 2D path: the outline is stroked (closed by the fill's implicit edge only when asked).
        if (this.strokeActive && points.length >= 4) {
            for (let i = 0; i + 3 < points.length; i += 2) this.line(points[i], points[i + 1], points[i + 2], points[i + 3]);
            if (close && points.length >= 6) this.line(points[points.length - 2], points[points.length - 1], points[0], points[1]);
        }
        points.length = 0;
    }

    radialGlow(cx: number, cy: number, radius: number, color: [number, number, number], alpha: number): void {
        if (!(radius > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return;
        const a = unitAlpha(alpha);
        this.gradient(cx - radius, cy - radius, 2 * radius, 2 * radius, cx, cy, 0, radius,
            [0, channel(color[0]), channel(color[1]), channel(color[2]), a, 1, 8 / 255, 5 / 255, 14 / 255, 0]);
    }
    radialDim(cx: number, cy: number, inner: number, outer: number, alpha: number): void {
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        const r0 = Math.max(0, inner), r1 = Math.max(r0 + 1, outer);
        this.gradient(0, 0, this.width, this.height, cx, cy, r0, r1, [0, 0, 0, 0, 0, 1, 0, 0, 0, unitAlpha(alpha)]);
    }
    compositeRingTint(cx: number, cy: number, inner: number, outer: number, color: [number, number, number], alpha: number,
        mode: RingTintCompositeMode, start?: number, end?: number): void {
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        this.beginPass();
        const gl = this.gl, w = this.width, h = this.height;
        const backdrop = this.copyFrame();
        const program = this.ringProgram;
        gl.useProgram(program.program);
        const r = channel(color[0]), g = channel(color[1]), b = channel(color[2]), a = unitAlpha(alpha);
        this.setGradient(program, 0, 0, w, h, cx, cy, Math.max(0, inner), Math.max(Math.max(0, inner) + 1, outer),
            [0, 0, 0, 0, 0, 0.38, r, g, b, a, 0.68, r, g, b, a, 1, 0, 0, 0, 0]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, backdrop);
        gl.uniform1i(program.uniforms.uBackdrop, 0);
        gl.uniform1i(program.uniforms.uMode, RING_MODES[mode] ?? 0);
        const sector = start !== undefined && end !== undefined && end > start && end - start < Math.PI * 2;
        gl.uniform2f(program.uniforms.uSector, sector ? start! : 0, sector ? end! - start! : 0);
        gl.uniform1f(program.uniforms.uSectorOn, sector ? 1 : 0);
        // The pass computes the blended result itself: no fixed-function blending.
        gl.disable(gl.BLEND);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.enable(gl.BLEND);
        this.drawCalls++;
    }

    beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null {
        const safeCols = Math.floor(cols), safeRows = Math.floor(rows);
        if (!(safeCols > 0) || !(safeRows > 0) || safeCols * safeRows > MAX_FIELD_RASTER_PIXELS) return null;
        const state = this.rasters[layer];
        if (!state.buffer || state.cols !== safeCols || state.rows !== safeRows) {
            state.buffer = new Float32Array(safeCols * safeRows * 4);
            state.pixels = new Uint8ClampedArray(safeCols * safeRows * 4);
            state.cols = safeCols; state.rows = safeRows;
        }
        return state.buffer;
    }
    drawFieldRaster(layer: 0 | 1 | 2, x: number, y: number, w: number, h: number, gain: number, blend: FieldRasterBlendMode): void {
        const state = this.rasters[layer];
        if (!state.buffer || !state.pixels || !(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this.beginPass();
        const gl = this.gl;
        writeFieldRasterPixels(state.buffer, state.cols, state.rows, gain, state.pixels);
        state.texture ??= this.createTexture(gl.LINEAR);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.texture);
        // Straight-alpha pixels, premultiplied on upload (as a 2D canvas stores them), then filtered.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.cols, state.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array(state.pixels.buffer, state.pixels.byteOffset, state.pixels.length));
        const program = this.rasterProgram;
        gl.useProgram(program.program);
        gl.uniform2f(program.uniforms.uSize, this.width, this.height);
        gl.uniform4f(program.uniforms.uRect, x, y, w, h);
        gl.uniform1i(program.uniforms.uRaster, 0);
        if (blend === 'lighter') gl.blendFunc(gl.ONE, gl.ONE);
        // screen: cs + cb - cs cb (premultiplied, exact); alpha as source-over.
        else if (blend === 'screen') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.sourceOver();
        this.drawCalls++;
    }

    /** Draws everything still batched; the frame is complete for `transferToImageBitmap` / upload. */
    finish(): void { this.flush(); this.gl.flush(); }

    /** Draws the batched lines and circles in their recorded order, as one instanced draw. */
    flush(): void {
        const count = this.primitiveCount;
        if (count === 0) return;
        this.primitiveCount = 0;
        const gl = this.gl, program = this.primitiveProgram;
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(program.program);
        gl.uniform2f(program.uniforms.uSize, this.width, this.height);
        gl.bindVertexArray(this.primitiveVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.primitives.subarray(0, count * WEBGL_PRIMITIVE_STRIDE), gl.STREAM_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        this.drawCalls++;
    }

    dispose(): void {
        const gl = this.gl;
        for (const state of this.rasters) if (state.texture) gl.deleteTexture(state.texture);
        if (this.backdrop) gl.deleteTexture(this.backdrop);
        for (const program of [this.primitiveProgram, this.gradientProgram, this.ringProgram, this.rasterProgram, this.solidProgram]) gl.deleteProgram(program.program);
        gl.deleteBuffer(this.instanceBuffer); gl.deleteBuffer(this.solidBuffer);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    private push(x1: number, y1: number, x2: number, y2: number, width: number, r: number, g: number, b: number, a: number, kind: number): void {
        if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
        if (this.primitiveCount * WEBGL_PRIMITIVE_STRIDE >= this.primitives.length) {
            const grown = new Float32Array(this.primitives.length * 2);
            grown.set(this.primitives);
            this.primitives = grown;
        }
        const out = this.primitives, i = this.primitiveCount++ * WEBGL_PRIMITIVE_STRIDE;
        out[i] = x1; out[i + 1] = y1; out[i + 2] = x2; out[i + 3] = y2; out[i + 4] = width;
        out[i + 5] = r; out[i + 6] = g; out[i + 7] = b; out[i + 8] = a; out[i + 9] = kind;
    }

    /** Before any non-batched pass: the batch is drawn first (painter's order) and the pass covers the canvas. */
    private beginPass(): void {
        this.flush();
        this.gl.viewport(0, 0, this.width, this.height);
    }

    /** A gradient over a rectangle, blended source-over (stops: t, r, g, b, a ... unpremultiplied). */
    private gradient(x: number, y: number, w: number, h: number, cx: number, cy: number, inner: number, outer: number, stops: readonly number[]): void {
        this.beginPass();
        const gl = this.gl;
        gl.useProgram(this.gradientProgram.program);
        this.setGradient(this.gradientProgram, x, y, w, h, cx, cy, inner, outer, stops);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.drawCalls++;
    }

    private setGradient(program: Program, x: number, y: number, w: number, h: number, cx: number, cy: number, inner: number, outer: number,
        stops: readonly number[]): void {
        const gl = this.gl, u = program.uniforms, count = Math.min(4, stops.length / 5);
        const t = this.stopT, colors = this.stopColor;
        t.fill(0); colors.fill(0);
        for (let i = 0; i < count; i++) {
            t[i] = stops[i * 5];
            for (let c = 0; c < 4; c++) colors[i * 4 + c] = stops[i * 5 + 1 + c];
        }
        gl.uniform2f(u.uSize, this.width, this.height);
        gl.uniform4f(u.uRect, x, y, w, h);
        gl.uniform2f(u.uCenter, cx, cy);
        gl.uniform1f(u.uInner, inner);
        gl.uniform1f(u.uOuter, outer);
        gl.uniform1i(u.uStopCount, count);
        gl.uniform1fv(u.uStopT, t);
        gl.uniform4fv(u.uStopColor, colors);
    }

    /** A copy of the frame drawn so far (the destination of a non-separable blend). */
    private copyFrame(): WebGLTexture {
        const gl = this.gl, w = this.width, h = this.height;
        if (!this.backdrop || this.backdropWidth !== w || this.backdropHeight !== h) {
            if (this.backdrop) gl.deleteTexture(this.backdrop);
            this.backdrop = this.createTexture(gl.NEAREST);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
            this.backdropWidth = w; this.backdropHeight = h;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.backdrop);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
        return this.backdrop;
    }

    private createTexture(filter: number): WebGLTexture {
        const gl = this.gl, texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    }

    /** Premultiplied source-over, the 2D context's default composite. */
    private sourceOver(): void { this.gl.blendFuncSeparate(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA); }

    private cornerAttribute(program: Program, corners: WebGLBuffer): void {
        const gl = this.gl, location = gl.getAttribLocation(program.program, 'aCorner');
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }

    private instanceAttribute(program: Program, name: string, size: number, stride: number, offset: number): void {
        const gl = this.gl, location = gl.getAttribLocation(program.program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
        gl.vertexAttribDivisor(location, 1);
    }

    private link(vertex: string, fragment: string, uniforms: readonly string[]): Program {
        const gl = this.gl;
        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Wormhole WebGL shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
            return shader;
        };
        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
        // Every quad program shares the corner attribute at location 0.
        gl.bindAttribLocation(program, 0, 'aCorner');
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Wormhole WebGL program: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
        const locations: Record<string, WebGLUniformLocation | null> = {};
        for (const name of uniforms) locations[name] = gl.getUniformLocation(program, name);
        return { program, uniforms: locations };
    }
}
