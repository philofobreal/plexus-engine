import * as THREE from 'three';
import type { CanvasVisualFrame, CanvasVisualPresentation, CanvasVisualSource, VisualAnalysisSnapshot, VisualFocalPoint } from '../../types/CanvasVisualSource';
import { SCENE_CONFIG } from './SceneConfig';
import { blendKeyframes, flowCoefficient, KeyframeGovernor, keyframeGrid, NO_KEYFRAME_GRID, type KeyframeGrid } from './BackgroundKeyframes';

/** Diagnostic wall clock; absent in headless hosts, where timings read as 0. */
const clock: { now(): number } | null = typeof performance !== 'undefined' ? performance : null;

/**
 * Keyframe blend with halo-limited sharpening (ADR-009 Addenda P, U). Up to three keyframe slots
 * (`map`, `uMap1`, `uMap2`) are weighted by `uWeights`; each is sampled through a mild radial
 * flight shift around its own focal point (`uFlow`, CPU reference: `flowSampleScale`), then
 * sharpened: centre + gain x (centre - mean of four neighbours), clamped to the neighbourhood's
 * range so edges sharpen without rings. Direct motion uses slot 0 alone with no shift, which is the
 * former single-frame sample exactly.
 */
const BLEND_HEADER = `uniform float uSharpen;
uniform vec2 uTexel;
uniform sampler2D uMap1;
uniform sampler2D uMap2;
uniform vec3 uWeights;
uniform vec3 uFlow;
uniform vec2 uFocal0;
uniform vec2 uFocal1;
uniform vec2 uFocal2;
uniform float uAspect;
vec3 wormholeSample( sampler2D tex, vec2 uv ) {
    vec3 c = texture2D( tex, uv ).rgb;
    if ( uSharpen <= 0.0 ) return c;
    vec3 n = texture2D( tex, uv + vec2( 0.0, uTexel.y ) ).rgb;
    vec3 s = texture2D( tex, uv - vec2( 0.0, uTexel.y ) ).rgb;
    vec3 e = texture2D( tex, uv + vec2( uTexel.x, 0.0 ) ).rgb;
    vec3 w = texture2D( tex, uv - vec2( uTexel.x, 0.0 ) ).rgb;
    vec3 lo = min( c, min( min( n, s ), min( e, w ) ) );
    vec3 hi = max( c, max( max( n, s ), max( e, w ) ) );
    return clamp( c + uSharpen * ( c - 0.25 * ( n + s + e + w ) ), lo, hi );
}
vec2 wormholeFlowUv( vec2 uv, vec2 focal, float flow ) {
    if ( flow == 0.0 ) return uv;
    vec2 d = uv - focal;
    float r = length( d * vec2( 2.0 * uAspect, 2.0 ) );
    return focal + d / max( 0.2, 1.0 + flow * r );
}
`;
const BLEND_MAP_FRAGMENT = `#ifdef USE_MAP
    vec4 sampledDiffuseColor = vec4( 0.0, 0.0, 0.0, 1.0 );
    if ( uWeights.x > 0.0 ) sampledDiffuseColor.rgb += uWeights.x * wormholeSample( map, wormholeFlowUv( vMapUv, uFocal0, uFlow.x ) );
    if ( uWeights.y > 0.0 ) sampledDiffuseColor.rgb += uWeights.y * wormholeSample( uMap1, wormholeFlowUv( vMapUv, uFocal1, uFlow.y ) );
    if ( uWeights.z > 0.0 ) sampledDiffuseColor.rgb += uWeights.z * wormholeSample( uMap2, wormholeFlowUv( vMapUv, uFocal2, uFlow.z ) );
    diffuseColor *= sampledDiffuseColor;
#endif`;

/** `beat`: keyframes on the beat grid blended on the GPU (Addendum U); `direct`: every redraw shown. */
export type BackdropMotion = 'beat' | 'direct';

export interface BackdropPacing {
    readonly motion: BackdropMotion;
    /** Upper bound of keyframes per second (the player's update rate). */
    readonly maxKeyframeRateHz: number;
}

/** Past, next and the one being rendered. */
const KEYFRAME_SLOTS = 3;
/** Requests unanswered for this many updates are released (the source dropped them). */
const REQUEST_TIMEOUT_UPDATES = 360;
/** Updates without a draw after which a slot upload is assumed lost (hidden pane, headless host). */
const UPLOAD_WAIT_UPDATES = 4;
/** A forward jump of song time larger than this is a seek, not playback. */
const SEEK_GAP_SEC = 1;
const TIME_EPSILON = 1e-6;

interface KeyframeSlot {
    time: number;
    focalX: number;
    focalY: number;
    travel: number;
    valid: boolean;
}

interface KeyframeRequest {
    readonly slot: number;
    /** A paused / seek frame of exactly the shown time: it replaces every other keyframe. */
    readonly exact: boolean;
    age: number;
    /** Superseded by a seek; the result is dropped when it arrives. */
    stale: boolean;
}

/** Scale of a plane at `distance` that subtends exactly the far plane's angles from the viewer. */
export function layerPlaneScale(distanceMeters: number): number {
    return distanceMeters / SCENE_CONFIG.backdropDistanceMeters;
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Shared MVP image behind gameplay in world space; XR head tracking stays natural. With a
 * multi-plane source the far plane (root) is joined by fixed mid/near planes at nearer distances,
 * each scaled so the composition is identical from the reference eye while stereo disparity and
 * head-motion parallax separate them in depth (bounded 2.5D; the simulation stays 2D).
 *
 * Beat blend (ADR-009 Addendum U): a single-plane source that supports keyframes renders only at
 * beat-grid keyframe times, one or two ahead of playback, into three texture slots that all read
 * the source canvas (each uploads only when it receives a new keyframe). Every display frame blends
 * the two keyframes around the song time on the GPU, so the expensive raster runs a few times per
 * beat while the image moves continuously; beats always land exactly on a keyframe.
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
    /** Sharpening gain and texel size shared by every plane's shader (uniform objects, live). */
    private readonly sharpen = { value: 0 };
    private readonly texel = new THREE.Vector2();
    // Keyframe blend state (Addendum U).
    private readonly keyframeCapable: boolean;
    private motion: BackdropMotion = 'direct';
    private maxKeyframeRateHz = 36;
    private readonly slotTextures: THREE.CanvasTexture[];
    private readonly slots: KeyframeSlot[] = [];
    private request: KeyframeRequest | null = null;
    /** A slot texture waits for its upload; the canvas must not change (no `takeFrame`) until it happened. */
    private uploadPending = false;
    private uploadWait = 0;
    private exactPending = true;
    private lastTime = Number.NaN;
    private grid: KeyframeGrid = NO_KEYFRAME_GRID;
    private readonly governor = new KeyframeGovernor();
    private readonly displayFocus = { x: 0, y: 0 };
    private displaying = false;
    private keyframes = 0;
    private readonly weights = { value: new THREE.Vector3(1, 0, 0) };
    private readonly flow = { value: new THREE.Vector3() };
    private readonly focals = [0, 1, 2].map(() => ({ value: new THREE.Vector2(0.5, 0.5) }));
    private readonly maps: { value: THREE.Texture }[];
    private readonly aspect: { value: number };
    /** An asynchronous source finished a frame outside `update`; the host should schedule a frame. */
    onFrameReady: (() => void) | null = null;
    /** An asynchronous source failed after preparation. */
    onError: ((message: string) => void) | null = null;
    constructor(source: CanvasVisualSource) {
        this.source = source;
        source.onFrameReady = () => this.onFrameReady?.();
        source.onError = message => this.onError?.(message);
        const canvases = source.layers?.length ? source.layers : [source.canvas];
        this.keyframeCapable = canvases.length === 1 && typeof source.requestFrame === 'function' && typeof source.takeFrame === 'function';
        this.textures = canvases.map(canvasTexture);
        // Slot 0 is the plane's map; slots 1-2 read the same canvas and upload only on their own keyframe.
        this.slotTextures = this.keyframeCapable ? [this.textures[0], canvasTexture(canvases[0]), canvasTexture(canvases[0])] : [];
        for (let i = 0; i < KEYFRAME_SLOTS; i++) this.slots.push({ time: 0, focalX: 0, focalY: 0, travel: 0, valid: false });
        this.maps = [{ value: this.slotTextures[1] ?? this.textures[0] }, { value: this.slotTextures[2] ?? this.textures[0] }];
        const width = Math.max(1, Number(canvases[0].width) || 1), height = Math.max(1, Number(canvases[0].height) || 1);
        this.texel.set(1 / width, 1 / height);
        this.aspect = { value: width / height };
        const far = new THREE.MeshBasicMaterial({ map: this.textures[0], toneMapped: false, depthWrite: false });
        this.installBlend(far);
        this.root = new THREE.Mesh(new THREE.PlaneGeometry(SCENE_CONFIG.backdropWidthMeters, SCENE_CONFIG.backdropHeightMeters), far);
        this.root.position.set(0, SCENE_CONFIG.backdropCenterYMeters, -SCENE_CONFIG.backdropDistanceMeters);
        this.root.renderOrder = -100;
        // Uploads happen in the draw call: never cull the plane, and learn when it was drawn.
        this.root.frustumCulled = false;
        this.root.onBeforeRender = () => { this.uploadPending = false; };
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
    /** The active motion: Beat blend needs a single-plane source that supports keyframes. */
    get activeMotion(): BackdropMotion { return this.keyframeMode ? 'beat' : 'direct'; }
    /** Gap between scheduled keyframes in seconds (diagnostics; 0 before the first). */
    get keyframeIntervalSec(): number { return this.keyframeMode ? this.governor.intervalSec : 0; }
    /** Keyframes received so far (diagnostics and tests). */
    get keyframeCount(): number { return this.keyframes; }
    /** The source's authoritative focal point for the displayed image, or null while not shown. */
    get focalPoint(): VisualFocalPoint | null {
        if (!this.ready || !this.root.visible) return null;
        if (this.keyframeMode) return this.displaying ? this.displayFocus : null;
        return this.source.focalPoint ?? null;
    }
    /** Centers every plane on the viewer's eye line (sampled once per placement, never continuously). */
    setEyeHeight(eyeHeightMeters: number): void {
        if (Number.isFinite(eyeHeightMeters)) this.root.position.y = eyeHeightMeters;
    }
    /** Raster cost of the last background frame (diagnostics; CPU raster only, not the upload). */
    get lastRenderMs(): number { return this.renderMs; }

    /**
     * Host presentation: forwarded to the source, plus a whole-frame divider so direct redraws land
     * on a fixed display-frame phase, and the motion mode with its keyframe-rate bound.
     */
    configure(presentation: CanvasVisualPresentation, frameDivider: number, pacing?: BackdropPacing): void {
        this.source.setPresentation?.(presentation);
        this.frameDivider = Number.isFinite(frameDivider) ? Math.max(1, Math.round(frameDivider)) : 1;
        this.framePhase = 0;
        const motion = pacing?.motion === 'beat' ? 'beat' : 'direct';
        const rate = pacing?.maxKeyframeRateHz;
        this.maxKeyframeRateHz = rate !== undefined && Number.isFinite(rate) && rate > 0 ? rate : 36;
        if (motion !== this.motion) {
            this.motion = motion;
            this.resetKeyframes();
            this.showSingle(0, 0, 0, false);
        }
        // A paused image redraws with the new presentation; playback picks it up with the next keyframes.
        this.exactPending = true;
    }

    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision = ++this.revision;
        this.ready = false;
        this.grid = keyframeGrid(analysis);
        this.governor.reset();
        this.resetKeyframes();
        try { await this.source.prepare(analysis); }
        catch (error) { if (revision === this.revision) throw error; }
        if (revision === this.revision) this.ready = true;
    }

    update(songTime: number, playing: boolean): void {
        if (!this.ready || !this.root.visible) return;
        if (this.keyframeMode) { this.updateKeyframes(songTime, playing); return; }
        // Pacing applies only while playing; paused/seek frames always reach the source, which
        // itself skips steady pauses (the desktop loop may submit just one frame then).
        if (!playing) this.framePhase = 0;
        else if (this.framePhase++ % this.frameDivider !== 0) return;
        const started = clock ? clock.now() : 0;
        if (this.source.render(songTime, playing)) {
            this.renderMs = this.source.lastRenderMs ?? (clock ? clock.now() - started : 0);
            for (const texture of this.textures) texture.needsUpdate = true;
        }
    }

    private get keyframeMode(): boolean { return this.keyframeCapable && this.motion === 'beat'; }

    private updateKeyframes(time: number, playing: boolean): void {
        if (!Number.isFinite(time)) return;
        if (this.uploadPending && ++this.uploadWait > UPLOAD_WAIT_UPDATES) this.uploadPending = false;
        // 1. A finished keyframe goes to its slot once the previous slot upload has happened.
        if (this.request && !this.uploadPending) {
            const frame = this.source.takeFrame!();
            if (frame) this.accept(frame);
            else if (++this.request.age > REQUEST_TIMEOUT_UPDATES) this.request = null;
        }
        // 2. A seek (backwards, or a large jump forwards) invalidates every keyframe.
        const previous = this.lastTime;
        this.lastTime = time;
        if (Number.isFinite(previous) && (time < previous - 1e-3 || time - previous > SEEK_GAP_SEC)) this.invalidate();
        // 3. Show the blend of the keyframes around the song time.
        const a = this.latestAtOrBefore(time), b = this.earliestAfter(time);
        if (!playing && !(a >= 0 && (b >= 0 || Math.abs(this.slots[a].time - time) <= TIME_EPSILON))) this.exactPending = true;
        this.display(a, b, time);
        // 4. Keep the renderer busy: the exact frame when paused, else up to two keyframes ahead. A
        // request never touches the canvas (only taking does), so it may start during an upload.
        if (!this.request) this.requestNext(time, playing, a, b);
    }

    private accept(frame: CanvasVisualFrame): void {
        const request = this.request!;
        this.request = null;
        if (request.stale) return;
        const slot = this.slots[request.slot];
        slot.time = frame.time; slot.focalX = frame.focalX; slot.focalY = frame.focalY; slot.travel = frame.travel; slot.valid = true;
        this.slotTextures[request.slot].needsUpdate = true;
        this.uploadPending = true; this.uploadWait = 0;
        this.keyframes++;
        this.renderMs = frame.renderMs;
        this.governor.sample(frame.renderMs);
        if (request.exact) {
            for (let i = 0; i < KEYFRAME_SLOTS; i++) if (i !== request.slot) this.slots[i].valid = false;
            this.exactPending = false;
        }
    }

    private requestNext(time: number, playing: boolean, a: number, b: number): void {
        const slot = this.freeSlot(a, b);
        if (slot < 0) return;
        let target: number;
        let exact = false;
        if (!playing) {
            if (!this.exactPending) return;
            target = time; exact = true;
        } else {
            let newest = Number.NEGATIVE_INFINITY, ahead = 0;
            for (const s of this.slots) if (s.valid) { newest = Math.max(newest, s.time); if (s.time > time + TIME_EPSILON) ahead++; }
            if (ahead >= 2) return;
            // Nothing usable yet (start, seek): render the current time, then run ahead of it.
            target = Number.isFinite(newest) ? this.governor.nextKeyframe(this.grid, Math.max(newest, time), this.maxKeyframeRateHz) : time;
        }
        if (!this.source.requestFrame!(target, playing)) return;
        this.slots[slot].valid = false;
        this.request = { slot, exact, age: 0, stale: false };
    }

    /** A slot that is neither displayed nor reserved: an empty one first, else the oldest. */
    private freeSlot(a: number, b: number): number {
        let best = -1;
        for (let i = 0; i < KEYFRAME_SLOTS; i++) {
            if (i === a || i === b) continue;
            if (!this.slots[i].valid) return i;
            if (best < 0 || this.slots[i].time < this.slots[best].time) best = i;
        }
        return best;
    }

    private latestAtOrBefore(time: number): number {
        let found = -1;
        this.slots.forEach((s, i) => { if (s.valid && s.time <= time + TIME_EPSILON && (found < 0 || s.time > this.slots[found].time)) found = i; });
        return found;
    }

    private earliestAfter(time: number): number {
        let found = -1;
        this.slots.forEach((s, i) => { if (s.valid && s.time > time + TIME_EPSILON && (found < 0 || s.time < this.slots[found].time)) found = i; });
        return found;
    }

    private display(a: number, b: number, time: number): void {
        if (a >= 0 && b >= 0) {
            const A = this.slots[a], B = this.slots[b];
            const blend = blendKeyframes(A.time, B.time, time, flowCoefficient(A.travel, B.travel));
            this.weights.value.set(0, 0, 0); this.flow.value.set(0, 0, 0);
            this.weights.value.setComponent(a, blend.weightA); this.weights.value.setComponent(b, blend.weightB);
            this.flow.value.setComponent(a, blend.flowA); this.flow.value.setComponent(b, blend.flowB);
            this.setFocal(a, A); this.setFocal(b, B);
            this.displayFocus.x = A.focalX * blend.weightA + B.focalX * blend.weightB;
            this.displayFocus.y = A.focalY * blend.weightA + B.focalY * blend.weightB;
            this.displaying = true;
        } else if (a >= 0 || b >= 0) {
            const i = a >= 0 ? a : b, slot = this.slots[i];
            this.showSingle(i, slot.focalX, slot.focalY, true);
            this.setFocal(i, slot);
        }
        // Nothing rendered yet: keep the previous image.
    }

    private showSingle(index: number, focalX: number, focalY: number, displaying: boolean): void {
        this.weights.value.set(0, 0, 0); this.weights.value.setComponent(index, 1);
        this.flow.value.set(0, 0, 0);
        this.displayFocus.x = focalX; this.displayFocus.y = focalY;
        this.displaying = displaying;
    }

    private setFocal(index: number, slot: KeyframeSlot): void {
        this.focals[index].value.set(0.5 + slot.focalX / 2, 0.5 + slot.focalY / 2);
    }

    /** Seek: every keyframe and the request in flight are outdated (the image stays until replaced). */
    private invalidate(): void {
        for (const slot of this.slots) slot.valid = false;
        if (this.request) this.request.stale = true;
        this.exactPending = true;
    }

    /** New analysis or motion mode: forget keyframes; the source drops its own request on prepare. */
    private resetKeyframes(): void {
        for (const slot of this.slots) slot.valid = false;
        this.request = null;
        this.exactPending = true;
        this.lastTime = Number.NaN;
        this.displaying = false;
    }

    /** Swaps the basic material's map sample for the keyframe blend (same lighting-free output path). */
    private installBlend(material: THREE.MeshBasicMaterial): void {
        material.onBeforeCompile = shader => {
            Object.assign(shader.uniforms, {
                uSharpen: this.sharpen, uTexel: { value: this.texel }, uMap1: this.maps[0], uMap2: this.maps[1],
                uWeights: this.weights, uFlow: this.flow, uFocal0: this.focals[0], uFocal1: this.focals[1], uFocal2: this.focals[2],
                uAspect: this.aspect
            });
            shader.fragmentShader = `${BLEND_HEADER}${shader.fragmentShader}`.replace('#include <map_fragment>', BLEND_MAP_FRAGMENT);
        };
        material.customProgramCacheKey = () => 'wormhole-keyframe-blend';
    }

    dispose(): void {
        ++this.revision; this.ready = false;
        this.onFrameReady = null; this.onError = null;
        this.request = null;
        this.source.dispose();
        for (const texture of new Set([...this.textures, ...this.slotTextures])) texture.dispose();
        for (const mesh of this.layerMeshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
        this.root.geometry.dispose();
        (this.root.material as THREE.Material).dispose(); this.root.removeFromParent();
    }
}
