import * as THREE from 'three';
import type { CanvasVisualPresentation, CanvasVisualSource, VisualAnalysisSnapshot, VisualFocalPoint } from '../../types/CanvasVisualSource';
import { SCENE_CONFIG } from './SceneConfig';
import { GrainMaterialRenderer } from './GrainMaterialRenderer';

/** Diagnostic wall clock; absent in headless hosts, where timings read as 0. */
const clock: { now(): number } | null = typeof performance !== 'undefined' ? performance : null;

/**
 * Halo-limited unsharp mask for the magnified background (ADR-009 Addendum P): the centre texel
 * plus `gain` x (centre - mean of its four neighbours), clamped to the neighbourhood's range so
 * edges sharpen without bright/dark rings. Five texture fetches; 0 gain is the plain sample.
 */
const SHARPEN_MAP_FRAGMENT = `#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    if ( uSharpen > 0.0 ) {
        vec3 n = texture2D( map, vMapUv + vec2( 0.0, uTexel.y ) ).rgb;
        vec3 s = texture2D( map, vMapUv - vec2( 0.0, uTexel.y ) ).rgb;
        vec3 e = texture2D( map, vMapUv + vec2( uTexel.x, 0.0 ) ).rgb;
        vec3 w = texture2D( map, vMapUv - vec2( uTexel.x, 0.0 ) ).rgb;
        vec3 c = sampledDiffuseColor.rgb;
        vec3 lo = min( c, min( min( n, s ), min( e, w ) ) );
        vec3 hi = max( c, max( max( n, s ), max( e, w ) ) );
        sampledDiffuseColor.rgb = clamp( c + uSharpen * ( c - 0.25 * ( n + s + e + w ) ), lo, hi );
    }
    // GPU grain material (ADR-009 Addendum W): broad, medium and sharp layers added in sRGB space
    // and clamped, exactly what Canvas2D 'lighter' did when the worker composited them.
    if ( uMaterialOn > 0.5 ) {
        vec3 srgb = sRGBTransferOETF( vec4( sampledDiffuseColor.rgb, 1.0 ) ).rgb;
        vec4 broad = texture2D( uMaterial2, vMapUv );
        vec4 medium = texture2D( uMaterial1, vMapUv );
        vec3 sharp = texture2D( uMaterial0, vMapUv ).rgb;
        srgb = min( srgb + broad.rgb * broad.a + medium.rgb * medium.a + sharp, vec3( 1.0 ) );
        sampledDiffuseColor.rgb = sRGBTransferEOTF( vec4( srgb, 1.0 ) ).rgb;
    }
    diffuseColor *= sampledDiffuseColor;
#endif`;

export interface WormholeBackdropOptions {
    /**
     * The source hands its grain material over as carriers (`materialFrame`) and the backdrop renders
     * it on the GPU (ADR-009 Addendum W); requires a renderer that supports `supportsGpuGrainMaterial`.
     */
    readonly gpuMaterial?: boolean;
}

/** Scale of a plane at `distance` that subtends exactly the far plane's angles from the viewer. */
export function layerPlaneScale(distanceMeters: number): number {
    return distanceMeters / SCENE_CONFIG.backdropDistanceMeters;
}

/**
 * Shared MVP image behind gameplay in world space; XR head tracking stays natural. With a
 * multi-plane source the far plane (root) is joined by fixed mid/near planes at nearer distances,
 * each scaled so the composition is identical from the reference eye while stereo disparity and
 * head-motion parallax separate them in depth (bounded 2.5D; the simulation stays 2D).
 */
export class WormholeBackdrop {
    /** Far plane; mid/near planes (if any) are its children and share its visibility. */
    readonly root: THREE.Mesh;
    private readonly source: CanvasVisualSource;
    private readonly textures: THREE.CanvasTexture[];
    private readonly layerMeshes: THREE.Mesh[] = [];
    private ready = false;
    private revision = 0;
    /** Display frames between redraws while playing (1 = every frame the source accepts). */
    private frameDivider = 1;
    private framePhase = 0;
    private renderMs = 0;
    private shown = 0;
    /** Sharpening gain and texel size shared by every plane's shader (uniform objects, live). */
    private readonly sharpen = { value: 0 };
    private readonly texel = new THREE.Vector2();
    /** GPU grain material (Addendum W), or null when the source rasterizes it itself. */
    private readonly material: GrainMaterialRenderer | null;
    private readonly materialOn = { value: 0 };
    /** An asynchronous source finished a frame outside `update`; the host should schedule a frame. */
    onFrameReady: (() => void) | null = null;
    /** An asynchronous source failed after preparation. */
    onError: ((message: string) => void) | null = null;
    constructor(source: CanvasVisualSource, options: WormholeBackdropOptions = {}) {
        this.source = source;
        this.material = options.gpuMaterial ? new GrainMaterialRenderer() : null;
        source.onFrameReady = () => this.onFrameReady?.();
        source.onError = message => this.onError?.(message);
        const canvases = source.layers?.length ? source.layers : [source.canvas];
        this.textures = canvases.map(canvas => {
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            return texture;
        });
        this.texel.set(1 / Math.max(1, Number(canvases[0].width) || 1), 1 / Math.max(1, Number(canvases[0].height) || 1));
        const far = new THREE.MeshBasicMaterial({ map: this.textures[0], toneMapped: false, depthWrite: false });
        this.installSharpening(far);
        this.root = new THREE.Mesh(new THREE.PlaneGeometry(SCENE_CONFIG.backdropWidthMeters, SCENE_CONFIG.backdropHeightMeters), far);
        this.root.position.set(0, SCENE_CONFIG.backdropCenterYMeters, -SCENE_CONFIG.backdropDistanceMeters);
        this.root.renderOrder = -100;
        if (this.material) {
            // The material layers are rendered right before the plane that shows them (once per new frame).
            const material = this.material;
            this.root.frustumCulled = false;
            this.root.onBeforeRender = (renderer, _scene, camera) => material.render(renderer, camera);
        }
        // Nearer planes: additive over the far plane (content on black), drawn before the stage.
        const distances = SCENE_CONFIG.backdropLayerDistancesMeters;
        for (let i = 1; i < this.textures.length; i++) {
            const distance = distances[Math.min(i, distances.length - 1)];
            const scale = layerPlaneScale(distance);
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCENE_CONFIG.backdropWidthMeters * scale, SCENE_CONFIG.backdropHeightMeters * scale),
                new THREE.MeshBasicMaterial({ map: this.textures[i], toneMapped: false, depthWrite: false, transparent: true,
                    blending: THREE.AdditiveBlending }));
            mesh.name = `wormholeLayer${i}`;
            mesh.position.z = SCENE_CONFIG.backdropDistanceMeters - distance; // local to the far plane
            mesh.renderOrder = -100 + i;
            this.root.add(mesh);
            this.layerMeshes.push(mesh);
        }
    }
    /** GPU sharpening gain (0 = off); applies on the next drawn frame, no redraw or upload. */
    setSharpness(gain: number): void {
        this.sharpen.value = Number.isFinite(gain) ? Math.max(0, gain) : 0;
    }

    get sharpness(): number { return this.sharpen.value; }

    /** Number of stereo planes (1 for a single-canvas source). */
    get layerCount(): number { return this.textures.length; }
    /** The source's authoritative focal point for the displayed image, or null while not shown. */
    get focalPoint(): VisualFocalPoint | null {
        return this.ready && this.root.visible ? this.source.focalPoint ?? null : null;
    }
    /** Centers every plane on the viewer's eye line (sampled once per placement, never continuously). */
    setEyeHeight(eyeHeightMeters: number): void {
        if (Number.isFinite(eyeHeightMeters)) this.root.position.y = eyeHeightMeters;
    }
    /** Wall-clock cost of the last canvas redraw (diagnostics; CPU raster only, not the upload). */
    get lastRenderMs(): number { return this.renderMs; }
    /** Background frames put on screen so far (diagnostics). */
    get framesShown(): number { return this.shown; }
    /** The source's stage times for the frame on screen (diagnostics; null when it does not profile). */
    get stageTimes(): Readonly<Record<string, number>> | null { return this.source.stageTimes ?? null; }

    /**
     * Host presentation: forwarded to the source, plus a whole-frame divider so redraws land on a
     * fixed display-frame phase instead of drifting between 2- and 3-frame gaps.
     */
    configure(presentation: CanvasVisualPresentation, frameDivider: number): void {
        this.source.setPresentation?.(presentation);
        this.frameDivider = Number.isFinite(frameDivider) ? Math.max(1, Math.round(frameDivider)) : 1;
        this.framePhase = 0;
    }

    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision = ++this.revision;
        this.ready = false;
        try { await this.source.prepare(analysis); }
        catch (error) { if (revision === this.revision) throw error; }
        if (revision === this.revision) this.ready = true;
    }
    update(songTime: number, playing: boolean): void {
        if (!this.ready || !this.root.visible) return;
        // Pacing applies only while playing; paused/seek frames always reach the source, which
        // itself skips steady pauses (the desktop loop may submit just one frame then).
        if (!playing) this.framePhase = 0;
        else if (this.framePhase++ % this.frameDivider !== 0) return;
        const started = clock ? clock.now() : 0;
        if (this.source.render(songTime, playing)) {
            this.renderMs = this.source.lastRenderMs ?? (clock ? clock.now() - started : 0);
            this.shown++;
            for (const texture of this.textures) texture.needsUpdate = true;
            if (this.material) {
                this.material.setFrame(this.source.materialFrame ?? null);
                this.materialOn.value = this.material.active ? 1 : 0;
            }
        }
    }
    /** Swaps the basic material's map sample for the sharpening one (same lighting-free output path). */
    private installSharpening(material: THREE.MeshBasicMaterial): void {
        material.onBeforeCompile = shader => {
            shader.uniforms.uSharpen = this.sharpen;
            shader.uniforms.uTexel = { value: this.texel };
            shader.uniforms.uMaterialOn = this.materialOn;
            shader.uniforms.uMaterial0 = { value: this.material?.layer0 ?? null };
            shader.uniforms.uMaterial1 = { get value() { return grain?.layer1 ?? null; } };
            shader.uniforms.uMaterial2 = { get value() { return grain?.layer2 ?? null; } };
            shader.fragmentShader = `uniform float uSharpen;\nuniform vec2 uTexel;\nuniform float uMaterialOn;\n`
                + `uniform sampler2D uMaterial0;\nuniform sampler2D uMaterial1;\nuniform sampler2D uMaterial2;\n${shader.fragmentShader}`
                .replace('#include <map_fragment>', SHARPEN_MAP_FRAGMENT);
        };
        const grain = this.material;
        material.customProgramCacheKey = () => 'wormhole-sharpen';
    }

    dispose(): void {
        ++this.revision; this.ready = false;
        this.onFrameReady = null; this.onError = null;
        this.source.dispose();
        this.material?.dispose();
        for (const texture of this.textures) texture.dispose();
        for (const mesh of this.layerMeshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
        this.root.geometry.dispose();
        (this.root.material as THREE.Material).dispose(); this.root.removeFromParent();
    }
}
