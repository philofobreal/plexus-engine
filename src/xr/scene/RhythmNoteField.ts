import * as THREE from 'three';
import { CUT_VECTORS, DEFAULT_RHYTHM_GAME_CONFIG, notePosition, type NoteRuntimeState, type RhythmGameConfig } from '../../gameplay';
const COLORS = { left: new THREE.Color(0x4fd1ff), right: new THREE.Color(0xff6fae), either: new THREE.Color(0xffe066) };
const WHITE = new THREE.Color(0xffffff);
const MISSED = new THREE.Color(0x553047);
const PAIRED = new THREE.Color(0xffdf80);
export class RhythmNoteField {
    readonly mesh: THREE.InstancedMesh;
    readonly markers: THREE.InstancedMesh;
    readonly arrows: THREE.InstancedMesh;
    private readonly dummy = new THREE.Object3D();
    private readonly capacity: number;
    constructor(config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG) {
        this.capacity = config.maxActiveNotes;
        const size = config.noteSizeMeters;
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size),
            new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }), this.capacity);
        // Separate reusable glyph batches: dots are free cuts, arrows show blade travel direction.
        this.markers = new THREE.InstancedMesh(new THREE.CircleGeometry(size * 0.13, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff }), this.capacity);
        const arrow = new THREE.Shape();
        arrow.moveTo(-size * 0.09, -size * 0.28); arrow.lineTo(size * 0.09, -size * 0.28);
        arrow.lineTo(size * 0.09, 0); arrow.lineTo(size * 0.28, 0);
        arrow.lineTo(0, size * 0.3); arrow.lineTo(-size * 0.28, 0);
        arrow.lineTo(-size * 0.09, 0); arrow.closePath();
        this.arrows = new THREE.InstancedMesh(new THREE.ShapeGeometry(arrow),
            new THREE.MeshBasicMaterial({ color: 0xffffff }), this.capacity);
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.count = 0; mesh.frustumCulled = false; }
    }
    update(notes: readonly NoteRuntimeState[], songTime: number, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): void {
        let count = 0, dots = 0, arrows = 0;
        for (const entry of notes) {
            if (count >= this.capacity) break;
            const age = songTime - (entry.resolvedAt ?? entry.note.time);
            if (entry.status !== 'pending' && age > config.resolvedNoteLifetimeSec) continue;
            notePosition(entry.note, entry.status === 'hit' ? entry.resolvedAt ?? entry.note.time : songTime, this.dummy.position, config);
            const scale = entry.status === 'hit' ? Math.max(0, 1 - age / config.resolvedNoteLifetimeSec) : 1;
            this.dummy.scale.setScalar(scale);
            this.dummy.rotation.z = 0;
            this.dummy.updateMatrix(); this.mesh.setMatrixAt(count, this.dummy.matrix);
            this.mesh.setColorAt(count, entry.status === 'hit' ? WHITE : entry.status === 'missed' ? MISSED : COLORS[entry.note.hand]);
            this.dummy.position.z += config.noteSizeMeters * scale / 2 + 0.002;
            const cut = entry.note.cutDirection;
            const directed = cut && cut !== 'any';
            if (directed) { const [x, y] = CUT_VECTORS[cut]; this.dummy.rotation.z = Math.atan2(y, x) - Math.PI / 2; }
            const glyph = directed ? this.arrows : this.markers;
            const glyphIndex = directed ? arrows++ : dots++;
            this.dummy.updateMatrix(); glyph.setMatrixAt(glyphIndex, this.dummy.matrix);
            glyph.setColorAt(glyphIndex, entry.note.pairId ? PAIRED : WHITE);
            count++;
        }
        this.mesh.count = count; this.markers.count = dots; this.arrows.count = arrows;
        for (const mesh of [this.mesh, this.markers, this.arrows]) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    dispose(): void {
        for (const mesh of [this.mesh, this.markers, this.arrows]) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    }
}
