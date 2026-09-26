import * as THREE from 'three';
import type { CanvasVisualSource, VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';

/** Shared MVP image behind gameplay in world space; XR head tracking stays natural. */
export class WormholeBackdrop {
    readonly root: THREE.Mesh;
    private readonly source: CanvasVisualSource;
    private readonly texture: THREE.CanvasTexture;
    private ready = false;
    private revision = 0;
    constructor(source: CanvasVisualSource) {
        this.source = source;
        this.texture = new THREE.CanvasTexture(source.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.root = new THREE.Mesh(new THREE.PlaneGeometry(106, 60),
            new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, depthWrite: false }));
        this.root.position.set(0, 1.65, -40);
        this.root.renderOrder = -100;
    }
    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision = ++this.revision;
        this.ready = false;
        try { await this.source.prepare(analysis); }
        catch (error) { if (revision === this.revision) throw error; }
        if (revision === this.revision) this.ready = true;
    }
    update(songTime: number, playing: boolean): void {
        if (this.ready && this.root.visible && this.source.render(songTime, playing)) this.texture.needsUpdate = true;
    }
    dispose(): void {
        ++this.revision; this.ready = false;
        this.source.dispose(); this.texture.dispose(); this.root.geometry.dispose();
        (this.root.material as THREE.Material).dispose(); this.root.removeFromParent();
    }
}
