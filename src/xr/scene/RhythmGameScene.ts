import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, type NoteRuntimeState, type RhythmGameConfig, type RhythmSessionSnapshot } from '../../gameplay';
import { RhythmNoteField } from './RhythmNoteField';
import { SCENE_CONFIG } from './SceneConfig';
import { XrHud } from './XrHud';
import { XrRunway } from './XrRunway';
import { XrTrackPath } from './XrTrackPath';
import { XrSectionCallout, type SectionCue } from './XrSectionCallout';
import { WormholeBackdrop } from './WormholeBackdrop';
import type { CanvasVisualSourceFactory, VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';

export class RhythmGameScene {
    readonly root = new THREE.Group();
    readonly playfield = new THREE.Group();
    readonly noteField: RhythmNoteField;
    readonly hud: XrHud;
    readonly runway: XrRunway;
    /** The single XR path projection shared by note rendering, the runway and XR hit testing. */
    readonly path = new XrTrackPath();
    /** Hit-gate section announcer (analyzer sections, song-time driven). */
    readonly sectionCallout: XrSectionCallout;
    private readonly config: RhythmGameConfig;
    private readonly lights = new THREE.Group();
    private wormhole: WormholeBackdrop | null = null;
    private wormholeAnalysis: VisualAnalysisSnapshot | null = null;
    private wormholeDirty = true;
    private readonly wormholeFactory?: CanvasVisualSourceFactory;
    // Last note-field inputs, compared field by field (no per-frame key string). NaN forces a refresh.
    private lastNoteTime = Number.NaN;
    private lastNoteRevision = -1;
    private lastNoteState = '';
    private lastNoteScore = -1;
    private lastNoteMisses = -1;
    private lastNoteTotal = -1;
    private eyeHeight: number = SCENE_CONFIG.defaultEyeHeightMeters;
    constructor(scene: THREE.Scene, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, wormholeFactory?: CanvasVisualSourceFactory) {
        this.wormholeFactory = wormholeFactory;
        this.config = config;
        this.noteField = new RhythmNoteField(config);
        this.hud = new XrHud();
        // Decorative corridor, reticle and hit gate; never gameplay geometry (see XrRunway).
        this.runway = new XrRunway(config);
        this.root.add(this.runway.floor, this.runway.linework);
        this.playfield.add(this.runway.gate);
        this.sectionCallout = new XrSectionCallout();
        this.playfield.add(this.sectionCallout.root);
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
        // Raised above the hit gate's section caption so the two never overlap in view.
        this.hud.setPosition(0, eyeHeight - middleHeight + 1.15, -2.8);
        this.eyeHeight = eyeHeight;
        this.wormhole?.setEyeHeight(eyeHeight);
        this.root.updateMatrixWorld(true);
    }
    getWorldToPlayfield(target: THREE.Matrix4): THREE.Matrix4 {
        this.playfield.updateWorldMatrix(true, false);
        return target.copy(this.playfield.matrixWorld).invert();
    }
    update(activeNotes: readonly NoteRuntimeState[], songTime: number, snapshot: RhythmSessionSnapshot, instruction: string): void {
        // The Wormhole renders first so the track follows the focal point of the displayed image.
        if (this.wormhole?.root.visible) this.wormhole.update(songTime, snapshot.state === 'playing');
        const focus = this.wormhole?.focalPoint;
        this.path.setFocus(focus ? focus.x : 0, focus ? focus.y : 0);
        this.runway.update(songTime);
        this.runway.applyPath(this.path);
        this.sectionCallout.update(songTime);
        if (songTime !== this.lastNoteTime || this.path.revision !== this.lastNoteRevision || snapshot.state !== this.lastNoteState
            || snapshot.score !== this.lastNoteScore || snapshot.missCount !== this.lastNoteMisses || snapshot.totalNotes !== this.lastNoteTotal) {
            this.noteField.update(activeNotes, songTime, this.config, this.path);
            this.lastNoteTime = songTime; this.lastNoteRevision = this.path.revision; this.lastNoteState = snapshot.state;
            this.lastNoteScore = snapshot.score; this.lastNoteMisses = snapshot.missCount; this.lastNoteTotal = snapshot.totalNotes;
        }
        this.hud.update(snapshot, instruction);
    }
    /** Plain-data section timeline from the host (empty clears the callout). */
    setSectionTimeline(timeline: readonly SectionCue[]): void {
        this.sectionCallout.setTimeline(timeline);
    }
    async setWormholeEnabled(enabled: boolean): Promise<void> {
        if (enabled && !this.wormhole) {
            if (!this.wormholeFactory) throw new Error('Wormhole renderer is unavailable.');
            this.wormhole = new WormholeBackdrop(this.wormholeFactory()); this.root.add(this.wormhole.root);
            this.wormhole.setEyeHeight(this.eyeHeight); this.root.updateMatrixWorld(true);
        }
        if (this.wormhole) this.wormhole.root.visible = enabled;
        if (enabled && this.wormholeDirty && this.wormhole) {
            this.wormholeDirty = false;
            try { await this.wormhole.prepare(this.wormholeAnalysis); }
            catch (error) { this.wormholeDirty = true; throw error; }
        }
    }
    async setWormholeAnalysis(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        this.wormholeAnalysis = analysis; this.wormholeDirty = true; this.lastNoteTime = Number.NaN;
        if (this.wormhole?.root.visible) await this.setWormholeEnabled(true);
    }
    dispose(): void {
        this.wormhole?.dispose();
        this.noteField.dispose(); this.hud.dispose(); this.runway.dispose(); this.sectionCallout.dispose();
        this.playfield.remove(this.noteField.mesh, this.noteField.markers, this.noteField.arrows, this.hud.mesh);
        this.root.traverse(object => {
            if (object instanceof THREE.InstancedMesh) object.dispose();
            if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
        });
        this.root.removeFromParent(); this.lights.removeFromParent();
    }
}
