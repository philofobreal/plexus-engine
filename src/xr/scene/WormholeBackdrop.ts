import * as THREE from 'three';
import type { CanvasVisualSource, VisualAnalysisSnapshot, VisualFocalPoint } from '../../types/CanvasVisualSource';
import { SCENE_CONFIG } from './SceneConfig';

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
    constructor(source: CanvasVisualSource) {
        this.source = source;
        const canvases = source.layers?.length ? source.layers : [source.canvas];
        this.textures = canvases.map(canvas => {
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            return texture;
        });
        this.root = new THREE.Mesh(new THREE.PlaneGeometry(SCENE_CONFIG.backdropWidthMeters, SCENE_CONFIG.backdropHeightMeters),
            new THREE.MeshBasicMaterial({ map: this.textures[0], toneMapped: false, depthWrite: false }));
        this.root.position.set(0, SCENE_CONFIG.backdropCenterYMeters, -SCENE_CONFIG.backdropDistanceMeters);
        this.root.renderOrder = -100;
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
    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision = ++this.revision;
        this.ready = false;
        try { await this.source.prepare(analysis); }
        catch (error) { if (revision === this.revision) throw error; }
        if (revision === this.revision) this.ready = true;
    }
    update(songTime: number, playing: boolean): void {
        if (this.ready && this.root.visible && this.source.render(songTime, playing)) {
            for (const texture of this.textures) texture.needsUpdate = true;
        }
    }
    dispose(): void {
        ++this.revision; this.ready = false;
        this.source.dispose();
        for (const texture of this.textures) texture.dispose();
        for (const mesh of this.layerMeshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
        this.root.geometry.dispose();
        (this.root.material as THREE.Material).dispose(); this.root.removeFromParent();
    }
}
