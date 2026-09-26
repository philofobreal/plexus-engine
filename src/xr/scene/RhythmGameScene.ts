import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, LANE_HAND, type NoteRuntimeState, type RhythmGameConfig, type RhythmSessionSnapshot } from '../../gameplay';
import { RhythmNoteField } from './RhythmNoteField';
import { SCENE_CONFIG } from './SceneConfig';
import { XrHud } from './XrHud';
import { WormholeBackdrop } from './WormholeBackdrop';
import type { CanvasVisualSourceFactory, VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';

export class RhythmGameScene {
    readonly root = new THREE.Group();
    readonly playfield = new THREE.Group();
    readonly noteField: RhythmNoteField;
    readonly hud: XrHud;
    private readonly config: RhythmGameConfig;
    private readonly lights = new THREE.Group();
    private wormhole: WormholeBackdrop | null = null;
    private wormholeAnalysis: VisualAnalysisSnapshot | null = null;
    private wormholeDirty = true;
    private readonly wormholeFactory?: CanvasVisualSourceFactory;
    private lastNotesKey = '';
    constructor(scene: THREE.Scene, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, wormholeFactory?: CanvasVisualSourceFactory) {
        this.wormholeFactory = wormholeFactory;
        this.config = config;
        this.noteField = new RhythmNoteField(config);
        this.hud = new XrHud();
        const front = SCENE_CONFIG.runwayFrontZMeters;
        const back = SCENE_CONFIG.runwayBackZMeters;
        const length = back - front;
        const center = (front + back) / 2;
        const boxes: { matrix: THREE.Matrix4; color: number }[] = [];
        const dummy = new THREE.Object3D();
        const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
            dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.updateMatrix();
            boxes.push({ matrix: dummy.matrix.clone(), color });
        };
        // Continuous stage extends underneath and two meters behind the starting player.
        box(SCENE_CONFIG.runwayWidthMeters, 0.06, length, 0x0b1424, 0, -0.04, center);
        for (const side of [-1, 1]) {
            box(0.035, 0.018, length, side < 0 ? 0x248daa : 0xa43f79, side * 1.7, 0.002, center);
            box(0.1, 0.12, length, 0x18243b, side * 1.83, -0.06, center);
        }
        for (let z = front; z <= back; z++) box(3.4, 0.008, 0.012, 0x1b3046, 0, -0.002, z);
        for (const lane of LANE_HAND) box(0.012, 0.008, length, 0x233a4f, lane.xOffsetMeters, 0, center);
        box(1.55, 0.012, 0.035, 0x85adc0, 0, 0.008, -SCENE_CONFIG.playfieldForwardMeters);
        const runway = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), boxes.length);
        runway.name = 'runway';
        boxes.forEach((entry, i) => { runway.setMatrixAt(i, entry.matrix); runway.setColorAt(i, new THREE.Color(entry.color)); });
        this.root.add(runway);
        // Starting-position ring remains on the floor, clear of the swing and sight corridor.
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.38, 48),
            new THREE.MeshBasicMaterial({ color: 0x637f93, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.008; this.root.add(ring);
        // Small side ticks indicate the three rows without a solid plane covering incoming notes.
        for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
            const tick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.018),
                new THREE.MeshBasicMaterial({ color: side < 0 ? 0x248daa : 0xa43f79 }));
            tick.position.set(side * 0.78, (row - 1) * config.rowSpacingMeters, 0);
            this.playfield.add(tick);
        }
        this.playfield.add(this.noteField.mesh, this.noteField.markers, this.noteField.arrows, this.hud.mesh);
        this.root.add(this.playfield);
        this.lights.add(new THREE.HemisphereLight(0xc4dfff, 0x182439, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(1, 3, 1); this.lights.add(key);
        scene.add(this.root, this.lights);
        this.placeForViewer(0, SCENE_CONFIG.defaultEyeHeightMeters, 0, 0);
    }
    /** Called once for each immersive entry/reference-space reset, never continuously recentered. */
    placeForViewer(x: number, eyeHeight: number, z: number, yaw: number): void {
        if (![x, eyeHeight, z, yaw].every(Number.isFinite)) return;
        this.root.position.set(x, 0, z);
        this.root.rotation.y = yaw;
        const middleHeight = Math.max(0.7, eyeHeight - SCENE_CONFIG.hitHeightBelowEyesMeters);
        this.playfield.position.set(0, middleHeight, -SCENE_CONFIG.playfieldForwardMeters);
        this.hud.setPosition(0, eyeHeight - middleHeight + 0.65, -2.8);
        this.root.updateMatrixWorld(true);
    }
    getWorldToPlayfield(target: THREE.Matrix4): THREE.Matrix4 {
        this.playfield.updateWorldMatrix(true, false);
        return target.copy(this.playfield.matrixWorld).invert();
    }
    update(activeNotes: readonly NoteRuntimeState[], songTime: number, snapshot: RhythmSessionSnapshot, instruction: string): void {
        const key = `${songTime}:${snapshot.state}:${snapshot.score}:${snapshot.missCount}:${snapshot.totalNotes}`;
        if (key !== this.lastNotesKey) {
            this.noteField.update(activeNotes, songTime, this.config);
            this.lastNotesKey = key;
        }
        if (this.wormhole?.root.visible) this.wormhole.update(songTime, snapshot.state === 'playing');
        this.hud.update(snapshot, instruction);
    }
    async setWormholeEnabled(enabled: boolean): Promise<void> {
        if (enabled && !this.wormhole) {
            if (!this.wormholeFactory) throw new Error('Wormhole renderer is unavailable.');
            this.wormhole = new WormholeBackdrop(this.wormholeFactory()); this.root.add(this.wormhole.root);
        }
        if (this.wormhole) this.wormhole.root.visible = enabled;
        if (enabled && this.wormholeDirty && this.wormhole) {
            this.wormholeDirty = false;
            try { await this.wormhole.prepare(this.wormholeAnalysis); }
            catch (error) { this.wormholeDirty = true; throw error; }
        }
    }
    async setWormholeAnalysis(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        this.wormholeAnalysis = analysis; this.wormholeDirty = true; this.lastNotesKey = '';
        if (this.wormhole?.root.visible) await this.setWormholeEnabled(true);
    }
    dispose(): void {
        this.wormhole?.dispose();
        this.noteField.dispose(); this.hud.dispose();
        this.playfield.remove(this.noteField.mesh, this.noteField.markers, this.noteField.arrows, this.hud.mesh);
        this.root.traverse(object => {
            if (object instanceof THREE.InstancedMesh) object.dispose();
            if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
        });
        this.root.removeFromParent(); this.lights.removeFromParent();
    }
}
