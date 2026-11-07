// GPU grain material for the XR Wormhole background (ADR-009 Addendum W). The background worker
// sends the frame's grain and weave carriers (per-carrier constants, `GRAIN_CARRIER` layout); this
// renderer evaluates the exact per-pixel capsule law of `accumulateWormholeGrainCarrier` on the GPU
// (instanced quads, additive half-float accumulation), resolves it like
// `resolveWormholeGrainMaterial` (emission, colour lift, emission-weighted L1 / L2 bloom gathers)
// and smooths the bloom with separable Gaussians matching the CPU filters' spread. The backdrop
// composites the three layers additively in sRGB space, like Canvas2D 'lighter'.
//
// Rendering happens before the headset's eye pass (`WormholeBackdrop.prerender`; switching render
// targets inside it is costly on Quest's tiled GPU), with the backdrop plane's onBeforeRender as a
// fallback (the three.js Reflector pattern: XR camera handling off, render target and viewport
// restored), and only when a new frame arrived.

import * as THREE from 'three';
import { GRAIN_CARRIER_STRIDE, type GrainMaterialFrame } from '../../types/GrainMaterialFrame';

import { CARRIER_VERTEX, CARRIER_FRAGMENT, PASS_VERTEX, RESOLVE_FRAGMENT, GATHER_FRAGMENT, BLUR_FRAGMENT, BLOOM_SIGMA_L1, BLOOM_SIGMA_L2, MAX_BLUR_RADIUS } from '../../visuals/gpu/WormholeGpuShaders';
export { BLOOM_SIGMA_L1, BLOOM_SIGMA_L2 } from '../../visuals/gpu/WormholeGpuShaders';

const INITIAL_CARRIERS = 2048;

function halfFloatTarget(filter: THREE.MagnificationTextureFilter): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter,
        depthBuffer: false, stencilBuffer: false, generateMipmaps: false
    });
}

function passMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: PASS_VERTEX, fragmentShader, uniforms,
        depthTest: false, depthWrite: false, blending: THREE.NoBlending });
}

/**
 * True when the renderer can accumulate into half-float targets (WebGL2 with a colour-buffer
 * float extension), which the GPU material needs; otherwise the host keeps the CPU raster.
 */
export function supportsGpuGrainMaterial(renderer: { capabilities?: { isWebGL2?: boolean }; extensions?: { has(name: string): boolean } } | null | undefined): boolean {
    if (!renderer?.capabilities || !renderer.extensions) return false;
    // three.js r163+ is WebGL2-only; older capability objects still report it.
    if (renderer.capabilities.isWebGL2 === false) return false;
    try {
        return renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    } catch { return false; }
}

/** The layers the backdrop samples: resolved L0 and the smoothed L1 / L2 (each with its blur spare). */
interface MaterialLayers {
    readonly resolved: THREE.WebGLRenderTarget;
    readonly l1: readonly THREE.WebGLRenderTarget[];
    readonly l2: readonly THREE.WebGLRenderTarget[];
}

function materialLayers(): MaterialLayers {
    return { resolved: halfFloatTarget(THREE.LinearFilter),
        l1: [halfFloatTarget(THREE.LinearFilter), halfFloatTarget(THREE.LinearFilter)],
        l2: [halfFloatTarget(THREE.LinearFilter), halfFloatTarget(THREE.LinearFilter)] };
}

export interface GrainMaterialRendererOptions {
    /**
     * Two layer sets (ADR-009 Addendum AE): `render` draws into the set not shown and `present`
     * shows it, so a frame's material can be rendered ahead while the plane shows the previous one.
     */
    readonly doubleBuffered?: boolean;
}

export class GrainMaterialRenderer {
    /** Premultiplied resolved L0, and the smoothed L1 / L2 bloom (unpremultiplied); sampled bilinearly (the set shown). */
    get layer0(): THREE.Texture { return this.sets[this.front].resolved.texture; }
    get layer1(): THREE.Texture { return this.sets[this.front].l1[0].texture; }
    get layer2(): THREE.Texture { return this.sets[this.front].l2[0].texture; }
    private readonly accum = halfFloatTarget(THREE.NearestFilter);
    private readonly sets: readonly MaterialLayers[];
    private front = 0;
    /** A set was rendered since the last `present`; the last setFrame carried no material; the set shown has material. */
    private drawn = false;
    private cleared = true;
    private shownActive = false;
    private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly carrierScene = new THREE.Scene();
    private readonly passScene = new THREE.Scene();
    private readonly passMesh: THREE.Mesh;
    private readonly carrierGeometry = new THREE.InstancedBufferGeometry();
    private carrierBuffer: THREE.InstancedInterleavedBuffer;
    private readonly carrierMaterial: THREE.ShaderMaterial;
    private readonly resolveMaterial: THREE.ShaderMaterial;
    private readonly gatherMaterial: THREE.ShaderMaterial;
    private readonly blurMaterial: THREE.ShaderMaterial;
    private readonly clearColor = new THREE.Color();
    private frame: { cols: number; rows: number; amount: number; bloom: number; detail: number; count: number } | null = null;
    private dirty = false;
    private passes = 0;

    constructor(options: GrainMaterialRendererOptions = {}) {
        this.sets = options.doubleBuffered === true ? [materialLayers(), materialLayers()] : [materialLayers()];
        // Carrier quads: corner (u along 0..1, v across -1..1) per vertex, constants per instance.
        this.carrierGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
        this.carrierGeometry.setIndex([0, 1, 2, 2, 1, 3]);
        this.carrierBuffer = this.createCarrierBuffer(INITIAL_CARRIERS);
        this.carrierMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3, vertexShader: CARRIER_VERTEX, fragmentShader: CARRIER_FRAGMENT,
            uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uDetail: { value: 0 } },
            // The raster's +y-down mapping mirrors the quads, so both windings must rasterize.
            depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
            blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
            blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
        });
        const carriers = new THREE.Mesh(this.carrierGeometry, this.carrierMaterial);
        carriers.frustumCulled = false;
        this.carrierScene.add(carriers);
        this.resolveMaterial = passMaterial(RESOLVE_FRAGMENT, { uSource: { value: null }, uAmount: { value: 0 } });
        this.gatherMaterial = passMaterial(GATHER_FRAGMENT, { uSource: { value: null }, uSourceSize: { value: new THREE.Vector2(1, 1) },
            uTargetSize: { value: new THREE.Vector2(1, 1) }, uGain: { value: 1 }, uThreshold: { value: 0 }, uSourcePremultiplied: { value: true } });
        this.blurMaterial = passMaterial(BLUR_FRAGMENT, { uSource: { value: null }, uSize: { value: new THREE.Vector2(1, 1) },
            uDirection: { value: new THREE.Vector2(1, 0) }, uSigma: { value: 1 }, uRadius: { value: 1 } });
        // One triangle covering the whole target.
        const triangle = new THREE.BufferGeometry();
        triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        this.passMesh = new THREE.Mesh(triangle, this.resolveMaterial);
        this.passMesh.frustumCulled = false;
        this.passScene.add(this.passMesh);
    }

    /** Whether the frame shown carries material (the backdrop composites only then). */
    get active(): boolean { return this.sets.length > 1 ? this.shownActive : this.frame !== null; }

    /** Shows the set the last `render` drew, or none after a frame without material (double-buffered; else a no-op). */
    present(): void {
        if (this.sets.length < 2) return;
        if (this.drawn) { this.front = 1 - this.front; this.shownActive = true; this.drawn = false; }
        else if (this.cleared) this.shownActive = false;
    }
    /** GPU material passes run so far (diagnostics and tests). */
    get renderedFrames(): number { return this.passes; }
    /** Carriers of the current frame. */
    get carrierCount(): number { return this.frame?.count ?? 0; }

    /** Takes a frame's carriers (copied into the instance buffer); null = no material in that frame. */
    setFrame(frame: GrainMaterialFrame | null): void {
        if (!frame) { this.frame = null; this.dirty = false; this.drawn = false; this.cleared = true; return; }
        this.cleared = false;
        const count = Math.max(0, Math.min(frame.count, Math.floor(frame.data.length / GRAIN_CARRIER_STRIDE)));
        if (count * GRAIN_CARRIER_STRIDE > this.carrierBuffer.array.length) {
            this.carrierBuffer = this.createCarrierBuffer(Math.max(count, this.carrierBuffer.count * 2));
        }
        (this.carrierBuffer.array as Float32Array).set(frame.data.subarray(0, count * GRAIN_CARRIER_STRIDE));
        this.carrierBuffer.clearUpdateRanges();
        this.carrierBuffer.addUpdateRange(0, count * GRAIN_CARRIER_STRIDE);
        this.carrierBuffer.needsUpdate = true;
        this.carrierGeometry.instanceCount = count;
        this.frame = { cols: Math.max(1, Math.floor(frame.cols)), rows: Math.max(1, Math.floor(frame.rows)),
            amount: frame.amount, bloom: frame.bloom, detail: frame.detail, count };
        this.dirty = true;
    }

    /**
     * Renders the pending frame's layers (once per frame) into the set not shown when double-buffered
     * (else the one set); true when it rendered (then `present` shows it). Called by the backdrop when
     * a frame arrives, before the eye pass, or from its onBeforeRender; restores the render target, XR
     * camera handling, clear state and viewport.
     */
    render(renderer: THREE.WebGLRenderer, camera?: THREE.Camera): boolean {
        const frame = this.frame;
        if (!this.dirty || !frame) return false;
        this.dirty = false;
        this.passes++;
        this.drawn = true;
        const set = this.sets[(this.front + 1) % this.sets.length];
        const resolved = set.resolved, l1 = set.l1, l2 = set.l2;
        const l1Cols = Math.max(1, Math.round(frame.cols / 3)), l1Rows = Math.max(1, Math.round(frame.rows / 3));
        const l2Cols = Math.max(1, Math.round(frame.cols / 8)), l2Rows = Math.max(1, Math.round(frame.rows / 8));
        this.resize(this.accum, frame.cols, frame.rows);
        this.resize(resolved, frame.cols, frame.rows);
        for (const target of l1) this.resize(target, l1Cols, l1Rows);
        for (const target of l2) this.resize(target, l2Cols, l2Rows);

        const previousTarget = renderer.getRenderTarget();
        const previousXr = renderer.xr.enabled;
        const previousAutoClear = renderer.autoClear;
        const previousClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this.clearColor);
        renderer.xr.enabled = false; // the passes use their own camera, never the headset's
        renderer.autoClear = false;
        renderer.setClearColor(0x000000, 0);
        try {
            // 1. Carriers -> additive L0 accumulation.
            renderer.setRenderTarget(this.accum);
            renderer.clear(true, false, false);
            this.carrierMaterial.uniforms.uSize.value.set(frame.cols, frame.rows);
            this.carrierMaterial.uniforms.uDetail.value = frame.detail;
            if (frame.count > 0) renderer.render(this.carrierScene, this.camera);
            // 2. Resolve L0 (premultiplied).
            this.resolveMaterial.uniforms.uSource.value = this.accum.texture;
            this.resolveMaterial.uniforms.uAmount.value = frame.amount;
            this.pass(renderer, this.resolveMaterial, resolved);
            // 3. Bloom: gather L1 from L0, smooth; gather L2 from the smooth L1, smooth.
            const bloom = Math.min(1, Math.max(0, frame.bloom));
            const amount = Math.min(1, Math.max(0, frame.amount));
            if (amount > 0 && bloom > 0) {
                this.gather(renderer, resolved.texture, frame.cols, frame.rows, l1[0], l1Cols, l1Rows, bloom * 2.6, 0.004, true);
                this.blur(renderer, l1, l1Cols, l1Rows, BLOOM_SIGMA_L1);
                this.gather(renderer, l1[0].texture, l1Cols, l1Rows, l2[0], l2Cols, l2Rows, 1.5, 0, false);
                this.blur(renderer, l2, l2Cols, l2Rows, BLOOM_SIGMA_L2);
            } else {
                for (const target of [l1[0], l2[0]]) { renderer.setRenderTarget(target); renderer.clear(true, false, false); }
            }
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
        this.accum.dispose();
        for (const set of this.sets) for (const target of [set.resolved, ...set.l1, ...set.l2]) target.dispose();
        this.carrierGeometry.dispose();
        this.passMesh.geometry.dispose();
        for (const material of [this.carrierMaterial, this.resolveMaterial, this.gatherMaterial, this.blurMaterial]) material.dispose();
    }

    private createCarrierBuffer(capacity: number): THREE.InstancedInterleavedBuffer {
        const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * GRAIN_CARRIER_STRIDE), GRAIN_CARRIER_STRIDE, 1);
        buffer.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < 6; i++) this.carrierGeometry.setAttribute(`a${i}`, new THREE.InterleavedBufferAttribute(buffer, 4, i * 4));
        return buffer;
    }

    private resize(target: THREE.WebGLRenderTarget, width: number, height: number): void {
        if (target.width !== width || target.height !== height) target.setSize(width, height);
    }

    private pass(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
        this.passMesh.material = material;
        renderer.setRenderTarget(target);
        renderer.render(this.passScene, this.camera);
    }

    private gather(renderer: THREE.WebGLRenderer, source: THREE.Texture, sourceCols: number, sourceRows: number,
        target: THREE.WebGLRenderTarget, cols: number, rows: number, gain: number, threshold: number, premultiplied: boolean): void {
        const u = this.gatherMaterial.uniforms;
        u.uSource.value = source;
        u.uSourceSize.value.set(sourceCols, sourceRows);
        u.uTargetSize.value.set(cols, rows);
        u.uGain.value = gain; u.uThreshold.value = threshold; u.uSourcePremultiplied.value = premultiplied;
        this.pass(renderer, this.gatherMaterial, target);
    }

    /** Horizontal into the spare target, vertical back: the result lands in `targets[0]`. */
    private blur(renderer: THREE.WebGLRenderer, targets: readonly THREE.WebGLRenderTarget[], cols: number, rows: number, sigma: number): void {
        const u = this.blurMaterial.uniforms;
        u.uSize.value.set(cols, rows);
        u.uSigma.value = sigma;
        u.uRadius.value = Math.min(MAX_BLUR_RADIUS, Math.ceil(3 * sigma));
        u.uSource.value = targets[0].texture; u.uDirection.value.set(1, 0);
        this.pass(renderer, this.blurMaterial, targets[1]);
        u.uSource.value = targets[1].texture; u.uDirection.value.set(0, 1);
        this.pass(renderer, this.blurMaterial, targets[0]);
    }
}
