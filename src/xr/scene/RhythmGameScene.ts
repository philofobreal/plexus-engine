import * as THREE from 'three';
import { DEFAULT_RHYTHM_GAME_CONFIG, type NoteRuntimeState, type RhythmGameConfig, type RhythmSessionSnapshot } from '../../gameplay';
import { RhythmNoteField } from './RhythmNoteField';
import { DEFAULT_STAGE_LAYOUT, SCENE_CONFIG, START_FRAME_HALF_WIDTH_METERS, type XrStageLayout } from './SceneConfig';
import { XrHud } from './XrHud';
import { XrRunway } from './XrRunway';
import { XrTrackPath } from './XrTrackPath';
import { XrSectionCallout, type SectionCue } from './XrSectionCallout';
import { WormholeBackdrop } from './WormholeBackdrop';
import { XrSongMap } from './XrSongMap';
import { XrProgressRing } from './XrProgressRing';
import { XrSectionGates } from './XrSectionGates';
import { XrSliceEffect } from './XrSliceEffect';
import type { XrNoteDesign } from '../XrAppearanceSettings';
import type { ScoreOverview } from './XrScoreOverview';
import type { CanvasVisualSourceFactory, VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';
import { backgroundFrameDivider, DEFAULT_XR_BACKGROUND_SETTINGS, MAX_BACKGROUND_SHARPEN, XR_BACKGROUND_RESOLUTION,
    type XrBackgroundSettings } from '../XrBackgroundSettings';

/** Desktop preview cadence (XrRuntime caps the desktop loop near 60 Hz). */
const DESKTOP_DISPLAY_HZ = 60;
/**
 * Score HUD beside the runway (Tall play space, Addendum M), in playfield meters: left of the start
 * frame, a meter past the hit plane, turned toward the player and scaled to keep its angular size.
 */
export const SIDE_HUD_POSE = { x: -(START_FRAME_HALF_WIDTH_METERS + 0.75), yAboveFrameCenter: 0.05, z: -1, yaw: 0.55, scale: 0.72 } as const;

export class RhythmGameScene {
    readonly root = new THREE.Group();
    readonly playfield = new THREE.Group();
    readonly noteField: RhythmNoteField;
    readonly hud: XrHud;
    /** Rebuilt when the stage layout changes (session-scope setting), never per frame. */
    runway: XrRunway;
    /** The single XR path projection shared by note rendering, the runway and XR hit testing. */
    readonly path = new XrTrackPath();
    /** Hit-gate section announcer (analyzer sections, song-time driven). */
    readonly sectionCallout: XrSectionCallout;
    /** Song structure + score strip under the start frame (Addendum K). */
    readonly songMap: XrSongMap;
    /** Floor progress ring at the player's origin (Addendum K). */
    readonly progressRing: XrProgressRing;
    /** Upcoming-section gates travelling down the runway (Addendum L). */
    readonly sectionGates: XrSectionGates;
    /** Halves and sparks of struck targets (Addendum Q). */
    readonly sliceEffect: XrSliceEffect;
    private config: RhythmGameConfig;
    private readonly lights = new THREE.Group();
    private wormhole: WormholeBackdrop | null = null;
    private wormholeAnalysis: VisualAnalysisSnapshot | null = null;
    private wormholeDirty = true;
    private readonly wormholeFactory?: CanvasVisualSourceFactory;
    private background: XrBackgroundSettings = DEFAULT_XR_BACKGROUND_SETTINGS;
    /** The background produced a frame asynchronously (idle hosts render one more frame). */
    onBackgroundFrame: (() => void) | null = null;
    /** The background failed after preparation; the host reports it and turns the background off. */
    onBackgroundError: ((message: string) => void) | null = null;
    private displayHz = DESKTOP_DISPLAY_HZ;
    // Last note-field inputs, compared field by field (no per-frame key string). NaN forces a refresh.
    private lastNoteTime = Number.NaN;
    private lastNoteRevision = -1;
    private lastNoteState = '';
    private lastNoteScore = -1;
    private lastNoteMisses = -1;
    private lastNoteTotal = -1;
    private eyeHeight: number = SCENE_CONFIG.defaultEyeHeightMeters;
    private layout: XrStageLayout = DEFAULT_STAGE_LAYOUT;
    /** Row spacing the current runway gate was built with (its row ticks). */
    private runwaySpacing: number;
    /** Last viewer placement, re-applied when the hit-plane distance changes. */
    private viewer = { x: 0, z: 0, yaw: 0 };
    constructor(scene: THREE.Scene, config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG, wormholeFactory?: CanvasVisualSourceFactory) {
        this.wormholeFactory = wormholeFactory;
        this.config = config;
        this.noteField = new RhythmNoteField(config);
        this.hud = new XrHud();
        // Decorative corridor, reticle and hit gate; never gameplay geometry (see XrRunway).
        this.runway = new XrRunway(config);
        this.runwaySpacing = config.rowSpacingMeters;
        this.root.add(this.runway.floor, this.runway.linework);
        this.playfield.add(this.runway.gate);
        this.sectionCallout = new XrSectionCallout();
        this.playfield.add(this.sectionCallout.root);
        this.songMap = new XrSongMap();
        this.playfield.add(this.songMap.root);
        this.progressRing = new XrProgressRing();
        this.root.add(this.progressRing.mesh);
        this.sectionGates = new XrSectionGates();
        this.playfield.add(this.sectionGates.root);
        this.playfield.add(this.noteField.mesh, this.noteField.markers, this.noteField.arrows, this.hud.mesh);
        this.sliceEffect = new XrSliceEffect(config.noteSizeMeters);
        this.playfield.add(this.sliceEffect.halves, this.sliceEffect.sparks);
        this.root.add(this.playfield);
        this.lights.add(new THREE.HemisphereLight(0xc4dfff, 0x182439, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(1, 3, 1); this.lights.add(key);
        scene.add(this.root, this.lights);
        this.placeForViewer(0, SCENE_CONFIG.defaultEyeHeightMeters, 0, 0);
    }
    /** Called once for each immersive entry/reference-space reset, never continuously recentered. */
    placeForViewer(x: number, eyeHeight: number, z: number, yaw: number): void {
        if (![x, eyeHeight, z, yaw].every(Number.isFinite)) return;
        this.viewer = { x, z, yaw };
        this.root.position.set(x, 0, z);
        this.root.rotation.y = yaw;
        const middleHeight = Math.max(0.7, eyeHeight - SCENE_CONFIG.hitHeightBelowEyesMeters);
        this.playfield.position.set(0, middleHeight, -this.layout.playfieldForwardMeters);
        if (this.layout.hudPlacement === 'side') {
            // The overhead row and the taller frame own the space above the runway.
            const pose = SIDE_HUD_POSE;
            this.hud.setPose(pose.x, this.layout.frameCenterYMeters + pose.yAboveFrameCenter, pose.z, pose.yaw, pose.scale);
        } else {
            // Raised above the hit gate's section caption so the two never overlap in view.
            this.hud.setPose(0, eyeHeight - middleHeight + 1.15, -2.8);
        }
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
        this.songMap.update(songTime, snapshot);
        this.sectionGates.update(songTime, this.config, this.path);
        this.progressRing.update(songTime, snapshot);
        if (songTime !== this.lastNoteTime || this.path.revision !== this.lastNoteRevision || snapshot.state !== this.lastNoteState
            || snapshot.score !== this.lastNoteScore || snapshot.missCount !== this.lastNoteMisses || snapshot.totalNotes !== this.lastNoteTotal) {
            this.noteField.update(activeNotes, songTime, this.config, this.path);
            this.sliceEffect.update(activeNotes, songTime, this.config, this.path);
            this.lastNoteTime = songTime; this.lastNoteRevision = this.path.revision; this.lastNoteState = snapshot.state;
            this.lastNoteScore = snapshot.score; this.lastNoteMisses = snapshot.missCount; this.lastNoteTotal = snapshot.totalNotes;
        }
        this.hud.update(snapshot, instruction);
    }
    /** Structure + score overview for the song map and the floor ring (null clears both). */
    setScoreOverview(overview: ScoreOverview | null): void {
        this.songMap.setOverview(overview);
        this.progressRing.setOverview(overview);
        this.sectionGates.setOverview(overview);
    }

    /** Target style (presentation only): the note field and the slice halves switch together. */
    setNoteDesign(design: XrNoteDesign): void {
        this.noteField.setDesign(design);
        this.sliceEffect.setDesign(design);
        this.lastNoteTime = Number.NaN;
    }

    /** Plain-data section timeline from the host (empty clears the callout). */
    setSectionTimeline(timeline: readonly SectionCue[]): void {
        this.sectionCallout.setTimeline(timeline);
    }
    async setWormholeEnabled(enabled: boolean): Promise<void> {
        if (enabled && !this.wormhole) {
            if (!this.wormholeFactory) throw new Error('Wormhole renderer is unavailable.');
            this.wormhole = new WormholeBackdrop(this.wormholeFactory(XR_BACKGROUND_RESOLUTION[this.background.quality]));
            this.root.add(this.wormhole.root);
            this.wormhole.onFrameReady = () => this.onBackgroundFrame?.();
            this.wormhole.onError = message => this.onBackgroundError?.(message);
            this.configureWormhole();
            this.wormhole.setEyeHeight(this.eyeHeight); this.root.updateMatrixWorld(true);
        }
        if (this.wormhole) this.wormhole.root.visible = enabled;
        if (enabled && this.wormholeDirty && this.wormhole) {
            this.wormholeDirty = false;
            try { await this.wormhole.prepare(this.wormholeAnalysis); }
            catch (error) { this.wormholeDirty = true; throw error; }
        }
    }
    /**
     * New stage (hit-plane distance, runway length, spawn fade) derived from the player's note speed
     * and saber length, and the play space's rows, start frame and HUD placement. The runway is
     * rebuilt once; the path re-aims; the playfield moves so the start frame sits at the new
     * distance; the callout, gates and song map follow the frame. Gameplay coordinates stay
     * relative to the hit plane.
     */
    setStageLayout(layout: XrStageLayout): void {
        const previous = this.layout;
        this.layout = layout;
        this.noteField.setSpawnFade(layout.spawnFadeMeters);
        this.sectionGates.setSpawnFade(layout.spawnFadeMeters);
        this.path.setLayout(layout);
        this.sectionCallout.setFrame(layout.frameCenterYMeters, layout.frameHalfHeightMeters);
        this.sectionGates.setFrame(layout.frameCenterYMeters, layout.frameHalfHeightMeters);
        this.songMap.setFrameBottom(layout.frameCenterYMeters - layout.frameHalfHeightMeters);
        if (layout.playfieldForwardMeters !== previous.playfieldForwardMeters || layout.runwayFrontZMeters !== previous.runwayFrontZMeters
            || layout.rowCount !== previous.rowCount || layout.frameCenterYMeters !== previous.frameCenterYMeters
            || layout.frameHalfHeightMeters !== previous.frameHalfHeightMeters) this.rebuildRunway();
        this.placeForViewer(this.viewer.x, this.eyeHeight, this.viewer.z, this.viewer.yaw);
        this.lastNoteTime = Number.NaN;
    }

    /** Rebuilds the runway and hit gate for the current layout and row spacing (setting changes only). */
    private rebuildRunway(): void {
        this.runway.dispose();
        this.runway = new XrRunway(this.config, this.layout);
        this.runwaySpacing = this.config.rowSpacingMeters;
        this.root.add(this.runway.floor, this.runway.linework);
        this.playfield.add(this.runway.gate);
        this.runway.applyPath(this.path);
    }

    get stageLayout(): XrStageLayout { return this.layout; }

    /**
     * New session-scope gameplay configuration: notes, judging space and floor travel follow it.
     * The note pool keeps its construction capacity (`maxActiveNotes` is not a player setting).
     */
    setGameConfig(config: RhythmGameConfig): void {
        this.config = config;
        // The gate's row ticks follow the play space's row spacing.
        if (config.rowSpacingMeters !== this.runwaySpacing) this.rebuildRunway();
        this.runway.setScrollSpeed(config.noteSpeedMps);
        this.lastNoteTime = Number.NaN;
    }

    /** Wall-clock cost of the background's last canvas redraw (diagnostics). */
    get backgroundRenderMs(): number { return this.wormhole?.lastRenderMs ?? 0; }

    /**
     * Player background presentation. Line stroke and rate apply in place; a quality change
     * rebuilds the single background plane at the new raster size (re-preparing it if shown).
     */
    async setBackgroundSettings(settings: XrBackgroundSettings): Promise<void> {
        const rebuild = settings.quality !== this.background.quality && this.wormhole !== null;
        this.background = settings;
        if (!rebuild) { this.configureWormhole(); return; }
        const visible = this.wormhole!.root.visible;
        this.wormhole!.dispose();
        this.wormhole = null;
        this.wormholeDirty = true;
        if (visible) await this.setWormholeEnabled(true);
    }

    /** Display cadence the background paces against (headset frame rate, or the desktop cap). */
    setDisplayFrameRate(hz: number | null | undefined): void {
        this.displayHz = hz && Number.isFinite(hz) && hz > 0 ? hz : DESKTOP_DISPLAY_HZ;
        this.configureWormhole();
    }

    private configureWormhole(): void {
        this.wormhole?.setSharpness(this.background.sharpness * MAX_BACKGROUND_SHARPEN);
        const divider = backgroundFrameDivider(this.displayHz, this.background.rateHz);
        // The source learns the effective rate (display cadence / divider), never above the request.
        this.wormhole?.configure({ lineStroke: this.background.lineStroke, maxFrameRateHz: this.displayHz / divider,
            ...(this.background.character ? { macros: this.background.character } : {}) }, divider);
    }

    async setWormholeAnalysis(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        this.wormholeAnalysis = analysis; this.wormholeDirty = true; this.lastNoteTime = Number.NaN;
        if (this.wormhole?.root.visible) await this.setWormholeEnabled(true);
    }
    dispose(): void {
        this.wormhole?.dispose();
        this.noteField.dispose(); this.hud.dispose(); this.runway.dispose(); this.sectionCallout.dispose();
        this.songMap.dispose(); this.progressRing.dispose(); this.sectionGates.dispose(); this.sliceEffect.dispose();
        this.playfield.remove(this.noteField.mesh, this.noteField.markers, this.noteField.arrows, this.hud.mesh);
        this.root.traverse(object => {
            if (object instanceof THREE.InstancedMesh) object.dispose();
            if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
        });
        this.root.removeFromParent(); this.lights.removeFromParent();
    }
}
