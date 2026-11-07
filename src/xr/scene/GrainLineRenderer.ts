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
// happens before the eye pass (`WormholeBackdrop.prerender`), with the plane's onBeforeRender as a
// fallback, like `GrainMaterialRenderer` (XR camera handling off; render target, clear state and
// viewport restored).

import * as THREE from 'three';
import { GRAIN_LINE_STRIDE, type GrainLineFrame } from '../../types/GrainLineFrame';

const INITIAL_LINES = 2048;

import { LINE_VERTEX, LINE_FRAGMENT, PASS_VERTEX, LINE_COMPOSITE_FRAGMENT as COMPOSITE_FRAGMENT } from '../../visuals/gpu/WormholeGpuShaders';

export interface GrainLineRendererOptions {
    /** Trilinear mipmaps on the composite (the plane's texture; ADR-009 Addendum Z). */
    readonly mipmaps?: boolean;
    /**
     * Two composites (ADR-009 Addendum AE): `render` draws into the one not shown and `present` shows
     * it, so a frame can be composited ahead, while the plane still shows the previous one.
     */
    readonly doubleBuffered?: boolean;
}

export class GrainLineRenderer {
    /** The composites (one, or two when double-buffered); `output` is the one shown. */
    private readonly outputs: readonly THREE.WebGLRenderTarget[];
    private front = 0;
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
        const composite = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
            colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter,
            minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, generateMipmaps: mipmaps,
            depthBuffer: false, stencilBuffer: false });
        this.outputs = options.doubleBuffered === true ? [composite(), composite()] : [composite()];
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
            uniforms: { uCanvas: { value: canvasTexture }, uLines: { value: this.lines.texture }, uHasLines: { value: 0 }, uCanvasAhead: { value: 0 } },
            depthTest: false, depthWrite: false, blending: THREE.NoBlending
        });
        // One triangle covering the whole target.
        this.passGeometry = new THREE.BufferGeometry();
        this.passGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        const passMesh = new THREE.Mesh(this.passGeometry, this.compositeMaterial);
        passMesh.frustumCulled = false;
        this.passScene.add(passMesh);
    }

    /** The canvas with the lines laid over it: the texture the backdrop plane shows. */
    get output(): THREE.WebGLRenderTarget { return this.outputs[this.front]; }
    /** Where the next `render` draws: the composite not shown when double-buffered, else the one. */
    private get drawTarget(): THREE.WebGLRenderTarget { return this.outputs[(this.front + 1) % this.outputs.length]; }

    /** Shows the composite the last `render` drew (double-buffered; a no-op with one composite). */
    present(): void { this.front = (this.front + 1) % this.outputs.length; }

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

    /**
     * The image the next composite lays under the lines: the canvas texture, or (`ahead`) the
     * worker's ImageBitmap uploaded ahead into a raw texture (ADR-009 Addendum AE).
     */
    setCanvas(texture: THREE.Texture, ahead: boolean): void {
        this.compositeMaterial.uniforms.uCanvas.value = texture;
        this.compositeMaterial.uniforms.uCanvasAhead.value = ahead ? 1 : 0;
    }

    /**
     * Draws the pending frame (once per frame) into `drawTarget`; true when it drew (then `present`
     * shows it). Called by the backdrop when a frame arrives, before the eye pass, or from the plane's
     * onBeforeRender.
     */
    render(renderer: THREE.WebGLRenderer, camera?: THREE.Camera): boolean {
        if (!this.dirty) return false;
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
            renderer.setRenderTarget(this.drawTarget);
            renderer.render(this.passScene, this.camera);
        } finally {
            renderer.setClearColor(this.clearColor, previousClearAlpha);
            renderer.autoClear = previousAutoClear;
            renderer.xr.enabled = previousXr;
            renderer.setRenderTarget(previousTarget);
            const viewport = (camera as THREE.Camera & { viewport?: THREE.Vector4 } | undefined)?.viewport;
            if (viewport) renderer.state.viewport(viewport);
        }
        return true;
    }

    dispose(): void {
        this.lines.dispose();
        for (const output of this.outputs) output.dispose();
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
