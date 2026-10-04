// GPU grain material for the XR Wormhole background (ADR-009 Addendum W). The background worker
// sends the frame's grain and weave carriers (per-carrier constants, `GRAIN_CARRIER` layout); this
// renderer evaluates the exact per-pixel capsule law of `accumulateWormholeGrainCarrier` on the GPU
// (instanced quads, additive half-float accumulation), resolves it like
// `resolveWormholeGrainMaterial` (emission, colour lift, emission-weighted L1 / L2 bloom gathers)
// and smooths the bloom with separable Gaussians matching the CPU filters' spread. The backdrop
// composites the three layers additively in sRGB space, like Canvas2D 'lighter'.
//
// Rendering happens inside the backdrop plane's onBeforeRender (the three.js Reflector pattern:
// XR camera handling off, render target and viewport restored) and only when a new frame arrived.

import * as THREE from 'three';
import { GRAIN_CARRIER_STRIDE, type GrainMaterialFrame } from '../../types/GrainMaterialFrame';

/** Bloom smoothing as Gaussian sigma (texels): the CPU's 3 x (keep 0.5) and 5 x (keep 0.4) passes. */
export const BLOOM_SIGMA_L1 = Math.sqrt(3 * 2 * 0.5 / 0.25);
export const BLOOM_SIGMA_L2 = Math.sqrt(5 * 2 * 0.6 / 0.16);
const MAX_BLUR_RADIUS = 20;
const INITIAL_CARRIERS = 2048;

const HASH_GLSL = /* glsl */ `
float hashUnit(uint a, uint b, uint c) {
    uint h = (a * 0x27d4eb2du) ^ (b * 0x165667b1u) ^ (c * 0x9e3779b1u);
    h = (h ^ (h >> 15u)) * 0x85ebca6bu;
    h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
    return float(h ^ (h >> 16u)) / 4294967296.0;
}
uint latticeIndex(float cell) { return uint(int(cell)); }
float valueNoise1(float x, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float cell = floor(safeX);
    float fraction = safeX - cell;
    float smoothed = fraction * fraction * (3.0 - 2.0 * fraction);
    uint c = latticeIndex(cell);
    float low = hashUnit(identity, c, 0u);
    float high = hashUnit(identity, c + 1u, 0u);
    return low + (high - low) * smoothed;
}
float valueNoise2(float x, float y, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float safeY = clamp(y, -1e6, 1e6);
    float cellX = floor(safeX);
    float cellY = floor(safeY);
    float fx = safeX - cellX;
    float fy = safeY - cellY;
    float sx = fx * fx * (3.0 - 2.0 * fx);
    float sy = fy * fy * (3.0 - 2.0 * fy);
    uint cx = latticeIndex(cellX);
    uint cy = latticeIndex(cellY);
    float lowLeft = hashUnit(identity, cx, cy);
    float lowRight = hashUnit(identity, cx + 1u, cy);
    float highLeft = hashUnit(identity, cx, cy + 1u);
    float highRight = hashUnit(identity, cx + 1u, cy + 1u);
    float low = lowLeft + (lowRight - lowLeft) * sx;
    float high = highLeft + (highRight - highLeft) * sx;
    return low + (high - low) * sy;
}`;

const CARRIER_VERTEX = /* glsl */ `
in vec4 a0;
in vec4 a1;
in vec4 a2;
in vec4 a3;
in vec4 a4;
in vec4 a5;
uniform vec2 uSize;
flat out vec4 v0;
flat out vec4 v1;
flat out vec4 v2;
flat out vec4 v3;
flat out vec4 v4;
flat out vec4 v5;
void main() {
    // A quad covering the capsule (plus one pixel) in carrier-local along / across coordinates.
    vec2 tangent = a0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float reach = a1.y + 1.0;
    float along = -reach + position.x * (a1.x + 2.0 * reach);
    float across = position.y * reach;
    vec2 p = a0.xy + tangent * along + normal * across;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
    v0 = a0; v1 = a1; v2 = a2; v3 = a3; v4 = a4; v5 = a5;
}`;

/** `accumulateWormholeGrainCarrier`'s per-pixel body, operation for operation. */
const CARRIER_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform vec2 uSize;
uniform float uDetail;
flat in vec4 v0;
flat in vec4 v1;
flat in vec4 v2;
flat in vec4 v3;
flat in vec4 v4;
flat in vec4 v5;
${HASH_GLSL}
void main() {
    vec2 tail = v0.xy;
    vec2 tangent = v0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float carrierLength = v1.x;
    float radius = v1.y;
    float coreRadius = v1.z;
    float fluxGain = v1.w;
    vec3 color = v2.xyz;
    float haloGain = v2.w;
    uint identity = (uint(v3.x) << 16u) | uint(v3.y);
    float phase = v3.z;
    float filamentPhase = v3.w;
    float fibrePhase = v4.x;
    float filamentFrequency = v4.y;
    float fibreAcross = v4.z;
    float fibreAlong = v4.w;
    float filamentBias = v5.x;
    float filamentFloor = v5.y;
    bool isWeave = mod(v5.z, 2.0) >= 0.5;
    bool filamented = v5.z >= 1.5;
    float negligible = v5.w;

    // Raster pixel centre, +y down from the top row (the CPU raster's convention).
    float relX = gl_FragCoord.x - tail.x;
    float relY = (uSize.y - gl_FragCoord.y) - tail.y;
    float along = relX * tangent.x + relY * tangent.y;
    float across = relX * normal.x + relY * normal.y;
    float beyond = along < 0.0 ? -along : (along > carrierLength ? along - carrierLength : 0.0);
    float distanceSq = across * across + beyond * beyond;
    float radiusSq = radius * radius;
    if (distanceSq > radiusSq) discard;

    float invCoreSq = 1.0 / max(1e-6, coreRadius * coreRadius);
    float invRadiusSq = 1.0 / max(1e-6, radiusSq);
    float coreFalloff = 1.0 - distanceSq * invCoreSq;
    float core = coreFalloff > 0.0 ? coreFalloff * coreFalloff : 0.0;
    float haloFalloff = 1.0 - distanceSq * invRadiusSq;
    float halo = haloFalloff * haloFalloff * haloFalloff * haloGain;
    float shape = core + halo;
    if (shape <= negligible) discard;

    float invLength = carrierLength > 1e-6 ? 1.0 / carrierLength : 0.0;
    float alongUnit = invLength > 0.0 ? clamp(along * invLength, 0.0, 1.0) : 1.0;
    float taper = filamented
        ? (isWeave ? 0.55 + 0.45 * sin(3.141592653589793 * alongUnit) : 0.24 + 0.76 * alongUnit * (0.42 + 0.58 * alongUnit))
        : 1.0;

    float filament = 1.0;
    if (filamented && !isWeave) {
        float coarse = valueNoise1(alongUnit * filamentFrequency + filamentPhase + phase * 0.31, identity);
        float fine = valueNoise1(alongUnit * filamentFrequency * 2.6 + filamentPhase * 1.7 + phase * 0.57, identity ^ 0x5bf03635u);
        float mixed = coarse * 0.63 + fine * 0.37;
        float shaped = clamp((mixed - filamentBias) * (0.9 + 1.15 * uDetail) + 0.5, 0.0, 1.0);
        filament = filamentFloor + (1.0 - filamentFloor) * shaped * shaped * (3.0 - 2.0 * shaped);
    }

    float fibreA = valueNoise2(along * fibreAlong + fibrePhase + phase * 0.44, across * fibreAcross, identity ^ 0x1b873593u);
    float textureValue;
    if (isWeave) {
        textureValue = 0.62 + 0.76 * fibreA;
    } else {
        float fibreB = valueNoise2(along * fibreAlong * 2.7 + fibrePhase * 1.3 + phase * 0.79, across * fibreAcross * 2.7, identity ^ 0x27d4eb2du);
        float micro = 0.86 + 0.28 * valueNoise2(along * 0.9 + phase * 1.13, across * 1.6, identity ^ 0x165667b1u);
        textureValue = (0.5 + 0.72 * (fibreA * 0.64 + fibreB * 0.36)) * micro;
    }

    float contribution = fluxGain * shape * taper * filament * textureValue;
    if (contribution <= 1e-6) discard;
    outColor = vec4(color * contribution, contribution);
}`;

const PASS_VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** `resolveWormholeGrainMaterial`'s per-pixel L0 resolve; written premultiplied for compositing. */
const RESOLVE_FRAGMENT = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform float uAmount;
void main() {
    vec4 accumulated = texelFetch(uSource, ivec2(gl_FragCoord.xy), 0);
    float density = max(0.0, accumulated.a);
    if (density <= 1e-8 || uAmount <= 0.0) { outColor = vec4(0.0); return; }
    float invDensity = 1.0 / density;
    float emission = clamp(1.0 - exp(-density * 1.75), 0.0, 1.0);
    float heat = emission * emission * emission;
    float gain = 0.78 + 0.5 * emission;
    vec3 rgb = accumulated.rgb * invDensity * gain;
    float peak = max(rgb.r, max(rgb.g, rgb.b));
    float whiten = heat * 0.12;
    float lift = peak > 1e-6 ? (1.0 - whiten) + whiten * (1.0 / peak) : 1.0;
    vec3 resolved = clamp(rgb * lift, 0.0, 1.0);
    float alpha = clamp(emission * uAmount, 0.0, 1.0);
    outColor = vec4(resolved * alpha, alpha);
}`;

/** `gatherBloomLayer`: emission-weighted area mean into a coarser layer (output unpremultiplied). */
const GATHER_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSourceSize;
uniform ivec2 uTargetSize;
uniform float uGain;
uniform float uThreshold;
uniform bool uSourcePremultiplied;
void main() {
    // Work in top-down rows like the CPU raster, then read GL (bottom-up) rows.
    int x = int(gl_FragCoord.x);
    int y = uTargetSize.y - 1 - int(gl_FragCoord.y);
    int sx0 = (x * uSourceSize.x) / uTargetSize.x;
    int sx1 = max(sx0 + 1, ((x + 1) * uSourceSize.x + uTargetSize.x - 1) / uTargetSize.x);
    int sy0 = (y * uSourceSize.y) / uTargetSize.y;
    int sy1 = max(sy0 + 1, ((y + 1) * uSourceSize.y + uTargetSize.y - 1) / uTargetSize.y);
    vec3 weighted = vec3(0.0);
    float emissionSum = 0.0;
    float samples = 0.0;
    for (int dy = 0; dy < 8; dy++) {
        int sy = sy0 + dy;
        if (sy >= sy1 || sy >= uSourceSize.y) break;
        for (int dx = 0; dx < 8; dx++) {
            int sx = sx0 + dx;
            if (sx >= sx1 || sx >= uSourceSize.x) break;
            vec4 s = texelFetch(uSource, ivec2(sx, uSourceSize.y - 1 - sy), 0);
            float emission = clamp(s.a, 0.0, 1.0);
            samples += 1.0;
            if (emission <= 0.0) continue;
            weighted += uSourcePremultiplied ? s.rgb : s.rgb * emission;
            emissionSum += emission;
        }
    }
    if (emissionSum <= 0.0 || samples <= 0.0) { outColor = vec4(0.0); return; }
    float averageEmission = emissionSum / samples;
    if (averageEmission <= uThreshold) { outColor = vec4(0.0); return; }
    float bloomEmission = clamp((averageEmission - uThreshold) * uGain, 0.0, 1.0);
    outColor = vec4(clamp(weighted / emissionSum, 0.0, 1.0), bloomEmission);
}`;

/** One separable Gaussian direction over all four channels (clamped edges, normalized weights). */
const BLUR_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSize;
uniform ivec2 uDirection;
uniform float uSigma;
uniform int uRadius;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 sum = vec4(0.0);
    float weightSum = 0.0;
    for (int i = -${MAX_BLUR_RADIUS}; i <= ${MAX_BLUR_RADIUS}; i++) {
        if (i < -uRadius || i > uRadius) continue;
        float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
        ivec2 q = clamp(p + uDirection * i, ivec2(0), uSize - 1);
        sum += w * texelFetch(uSource, q, 0);
        weightSum += w;
    }
    outColor = sum / weightSum;
}`;

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

export class GrainMaterialRenderer {
    /** Premultiplied resolved L0, and the smoothed L1 / L2 bloom (unpremultiplied); sampled bilinearly. */
    readonly layer0: THREE.Texture;
    get layer1(): THREE.Texture { return this.l1[0].texture; }
    get layer2(): THREE.Texture { return this.l2[0].texture; }
    private readonly accum = halfFloatTarget(THREE.NearestFilter);
    private readonly resolved = halfFloatTarget(THREE.LinearFilter);
    private readonly l1 = [halfFloatTarget(THREE.LinearFilter), halfFloatTarget(THREE.LinearFilter)];
    private readonly l2 = [halfFloatTarget(THREE.LinearFilter), halfFloatTarget(THREE.LinearFilter)];
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

    constructor() {
        this.layer0 = this.resolved.texture;
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

    /** Whether the last frame carried material (the backdrop composites only then). */
    get active(): boolean { return this.frame !== null; }
    /** GPU material passes run so far (diagnostics and tests). */
    get renderedFrames(): number { return this.passes; }
    /** Carriers of the current frame. */
    get carrierCount(): number { return this.frame?.count ?? 0; }

    /** Takes a frame's carriers (copied into the instance buffer); null = no material in that frame. */
    setFrame(frame: GrainMaterialFrame | null): void {
        if (!frame) { this.frame = null; this.dirty = false; return; }
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
     * Renders the pending frame's layers (once per frame). Called from the backdrop's
     * onBeforeRender; restores the render target, XR camera handling, clear state and viewport.
     */
    render(renderer: THREE.WebGLRenderer, camera?: THREE.Camera): void {
        const frame = this.frame;
        if (!this.dirty || !frame) return;
        this.dirty = false;
        this.passes++;
        const l1Cols = Math.max(1, Math.round(frame.cols / 3)), l1Rows = Math.max(1, Math.round(frame.rows / 3));
        const l2Cols = Math.max(1, Math.round(frame.cols / 8)), l2Rows = Math.max(1, Math.round(frame.rows / 8));
        this.resize(this.accum, frame.cols, frame.rows);
        this.resize(this.resolved, frame.cols, frame.rows);
        for (const target of this.l1) this.resize(target, l1Cols, l1Rows);
        for (const target of this.l2) this.resize(target, l2Cols, l2Rows);

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
            this.pass(renderer, this.resolveMaterial, this.resolved);
            // 3. Bloom: gather L1 from L0, smooth; gather L2 from the smooth L1, smooth.
            const bloom = Math.min(1, Math.max(0, frame.bloom));
            const amount = Math.min(1, Math.max(0, frame.amount));
            if (amount > 0 && bloom > 0) {
                this.gather(renderer, this.resolved.texture, frame.cols, frame.rows, this.l1[0], l1Cols, l1Rows, bloom * 2.6, 0.004, true);
                this.blur(renderer, this.l1, l1Cols, l1Rows, BLOOM_SIGMA_L1);
                this.gather(renderer, this.l1[0].texture, l1Cols, l1Rows, this.l2[0], l2Cols, l2Rows, 1.5, 0, false);
                this.blur(renderer, this.l2, l2Cols, l2Rows, BLOOM_SIGMA_L2);
            } else {
                for (const target of [this.l1[0], this.l2[0]]) { renderer.setRenderTarget(target); renderer.clear(true, false, false); }
            }
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
        for (const target of [this.accum, this.resolved, ...this.l1, ...this.l2]) target.dispose();
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
    private blur(renderer: THREE.WebGLRenderer, targets: THREE.WebGLRenderTarget[], cols: number, rows: number, sigma: number): void {
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
