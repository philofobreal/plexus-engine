// GPU grain trail lines for the XR Wormhole background (ADR-009 Addendum AA). With the option on,
// the background source records the grain crossfade strokes as a line list (`GrainLineFrame`)
// instead of stroking them on its Canvas2D raster. This renderer draws that list and lays it over
// the canvas, once per new background frame:
//
// 1. lines -> an RGBA8 target: one instanced quad per line, capsule (round cap) or box (square cap)
//    coverage with a one-pixel ramp, sub-pixel widths fading like a hairline, premultiplied
//    source-over in record order. The values stay sRGB-encoded, as Canvas2D blends them;
// 2. composite -> an sRGB target at canvas size: the canvas re-encoded, the lines over it, written
//    back linear (the hardware encodes, exactly like the canvas texture decodes).
//
// The backdrop plane samples the composite where it sampled the canvas, so sharpening and the GPU
// grain material apply on top of the lines exactly as they did on the CPU-stroked canvas. Rendering
// happens inside the plane's onBeforeRender, like `GrainMaterialRenderer` (XR camera handling off;
// render target, clear state and viewport restored).

import * as THREE from 'three';
import { GRAIN_LINE_STRIDE, type GrainLineFrame } from '../../types/GrainLineFrame';

const INITIAL_LINES = 2048;

const LINE_VERTEX = /* glsl */ `
in vec4 aSegment;
in float aWidth;
in vec4 aColor;
uniform vec2 uSize;
out vec2 vLocal;
out float vHalfLength;
out float vHalfWidth;
out float vCoverage;
out vec4 vColor;
void main() {
    vec2 p1 = aSegment.xy, delta = aSegment.zw - aSegment.xy;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 across = vec2(-dir.y, dir.x);
    // Sub-pixel strokes cover one pixel at proportionally lower opacity (like a hairline).
    float halfWidth = max(aWidth, 1.0) * 0.5;
    float reach = halfWidth + 1.0;
    float along = mix(-reach, len + reach, position.x);
    float side = position.y * reach;
    vec2 p = p1 + dir * along + across * side;
    vLocal = vec2(along - 0.5 * len, side);
    vHalfLength = 0.5 * len;
    vHalfWidth = halfWidth;
    vCoverage = min(aWidth, 1.0);
    vColor = aColor;
    // Raster pixels (+y down) to clip space; the target's top row is the canvas's top row.
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`;

const LINE_FRAGMENT = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform float uSquare;
in vec2 vLocal;
in float vHalfLength;
in float vHalfWidth;
in float vCoverage;
in vec4 vColor;
void main() {
    float distanceOut;
    if (uSquare > 0.5) {
        vec2 q = abs(vLocal) - vec2(vHalfLength + vHalfWidth, vHalfWidth);
        distanceOut = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    } else {
        distanceOut = length(vec2(max(abs(vLocal.x) - vHalfLength, 0.0), vLocal.y)) - vHalfWidth;
    }
    float alpha = vColor.a * clamp(0.5 - distanceOut, 0.0, 1.0) * vCoverage;
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb * alpha, alpha);
}`;

const PASS_VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uCanvas;
uniform sampler2D uLines;
uniform float uHasLines;
vec3 encodeSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 decodeSrgb(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec3 encoded = encodeSrgb(texelFetch(uCanvas, p, 0).rgb);
    if (uHasLines > 0.5) {
        vec4 lines = texelFetch(uLines, p, 0);
        encoded = lines.rgb + encoded * (1.0 - lines.a);
    }
    outColor = vec4(decodeSrgb(clamp(encoded, 0.0, 1.0)), 1.0);
}`;

export interface GrainLineRendererOptions {
    /** Trilinear mipmaps on the composite (the plane's texture; ADR-009 Addendum Z). */
    readonly mipmaps?: boolean;
}

export class GrainLineRenderer {
    /** The canvas with the lines laid over it: the texture the backdrop plane shows. */
    readonly output: THREE.WebGLRenderTarget;
    private readonly lines: THREE.WebGLRenderTarget;
    private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly lineScene = new THREE.Scene();
    private readonly passScene = new THREE.Scene();
    private readonly lineGeometry = new THREE.InstancedBufferGeometry();
    private lineBuffer: THREE.InstancedInterleavedBuffer;
    private readonly lineMaterial: THREE.ShaderMaterial;
    private readonly compositeMaterial: THREE.ShaderMaterial;
    private readonly passGeometry: THREE.BufferGeometry;
    private readonly clearColor = new THREE.Color();
    private count = 0;
    private dirty = false;
    private passes = 0;

    constructor(canvasTexture: THREE.Texture, width: number, height: number, options: GrainLineRendererOptions = {}) {
        const w = Math.max(1, Math.floor(width)), h = Math.max(1, Math.floor(height));
        this.lines = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
            minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
        const mipmaps = options.mipmaps === true;
        this.output = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
            colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter,
            minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, generateMipmaps: mipmaps,
            depthBuffer: false, stencilBuffer: false });
        // Line quads: corner (u along 0..1, v across -1..1) per vertex, the line per instance.
        this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
        this.lineGeometry.setIndex([0, 1, 2, 2, 1, 3]);
        this.lineBuffer = this.createLineBuffer(INITIAL_LINES);
        this.lineMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3, vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT,
            uniforms: { uSize: { value: new THREE.Vector2(w, h) }, uSquare: { value: 0 } },
            depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
            // Premultiplied source-over, colour and alpha alike (Canvas2D compositing of each stroke).
            blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
            blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
        });
        const lineMesh = new THREE.Mesh(this.lineGeometry, this.lineMaterial);
        lineMesh.frustumCulled = false;
        this.lineScene.add(lineMesh);
        this.compositeMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3, vertexShader: PASS_VERTEX, fragmentShader: COMPOSITE_FRAGMENT,
            uniforms: { uCanvas: { value: canvasTexture }, uLines: { value: this.lines.texture }, uHasLines: { value: 0 } },
            depthTest: false, depthWrite: false, blending: THREE.NoBlending
        });
        // One triangle covering the whole target.
        this.passGeometry = new THREE.BufferGeometry();
        this.passGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        const passMesh = new THREE.Mesh(this.passGeometry, this.compositeMaterial);
        passMesh.frustumCulled = false;
        this.passScene.add(passMesh);
    }

    /** Lines of the current frame. */
    get lineCount(): number { return this.count; }
    /** Composites rendered so far (diagnostics and tests). */
    get renderedFrames(): number { return this.passes; }

    /**
     * A new background frame: its lines (copied into the instance buffer), or null when it stroked
     * them itself. Either way the next render lays the new canvas into the output.
     */
    setFrame(frame: GrainLineFrame | null): void {
        const count = frame ? Math.max(0, Math.min(frame.count, Math.floor(frame.data.length / GRAIN_LINE_STRIDE))) : 0;
        if (count * GRAIN_LINE_STRIDE > this.lineBuffer.array.length) {
            this.lineBuffer = this.createLineBuffer(Math.max(count, this.lineBuffer.count * 2));
        }
        if (frame && count > 0) {
            (this.lineBuffer.array as Float32Array).set(frame.data.subarray(0, count * GRAIN_LINE_STRIDE));
            this.lineBuffer.clearUpdateRanges();
            this.lineBuffer.addUpdateRange(0, count * GRAIN_LINE_STRIDE);
            this.lineBuffer.needsUpdate = true;
            this.lineMaterial.uniforms.uSquare.value = frame.square ? 1 : 0;
        }
        this.lineGeometry.instanceCount = count;
        this.count = count;
        this.dirty = true;
    }

    /** Draws the pending frame (once per frame); called from the backdrop plane's onBeforeRender. */
    render(renderer: THREE.WebGLRenderer, camera?: THREE.Camera): void {
        if (!this.dirty) return;
        this.dirty = false;
        this.passes++;
        const previousTarget = renderer.getRenderTarget();
        const previousXr = renderer.xr.enabled;
        const previousAutoClear = renderer.autoClear;
        const previousClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this.clearColor);
        renderer.xr.enabled = false; // the passes use their own camera, never the headset's
        renderer.autoClear = false;
        renderer.setClearColor(0x000000, 0);
        try {
            if (this.count > 0) {
                renderer.setRenderTarget(this.lines);
                renderer.clear(true, false, false);
                renderer.render(this.lineScene, this.camera);
            }
            this.compositeMaterial.uniforms.uHasLines.value = this.count > 0 ? 1 : 0;
            renderer.setRenderTarget(this.output);
            renderer.render(this.passScene, this.camera);
        } finally {
            renderer.setClearColor(this.clearColor, previousClearAlpha);
            renderer.autoClear = previousAutoClear;
            renderer.xr.enabled = previousXr;
            renderer.setRenderTarget(previousTarget);
            const viewport = (camera as THREE.Camera & { viewport?: THREE.Vector4 } | undefined)?.viewport;
            if (viewport) renderer.state.viewport(viewport);
        }
    }

    dispose(): void {
        this.lines.dispose();
        this.output.dispose();
        this.lineGeometry.dispose();
        this.passGeometry.dispose();
        this.lineMaterial.dispose();
        this.compositeMaterial.dispose();
    }

    private createLineBuffer(capacity: number): THREE.InstancedInterleavedBuffer {
        const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * GRAIN_LINE_STRIDE), GRAIN_LINE_STRIDE, 1);
        buffer.setUsage(THREE.DynamicDrawUsage);
        this.lineGeometry.setAttribute('aSegment', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
        this.lineGeometry.setAttribute('aWidth', new THREE.InterleavedBufferAttribute(buffer, 1, 4));
        this.lineGeometry.setAttribute('aColor', new THREE.InterleavedBufferAttribute(buffer, 4, 5));
        return buffer;
    }
}
