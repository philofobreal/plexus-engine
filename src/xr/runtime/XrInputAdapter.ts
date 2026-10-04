import * as THREE from 'three';
import type { RhythmHand, StrikeAttempt } from '../../gameplay';
import { SABER_CONFIG } from './SaberConfig';
export type ControllerHand = Extract<RhythmHand, 'left' | 'right'>;
const COLORS = { left: 0x4fd1ff, right: 0xff6fae };
/** Menu pointer length when the ray hits nothing, in meters. */
export const POINTER_DEFAULT_LENGTH_METERS = 2;

interface ControllerState {
    grip: THREE.Group;
    targetRay: THREE.Group;
    saber: THREE.Group;
    blade: THREE.Mesh;
    /** Menu laser on the target-ray space (hidden while playing). */
    pointer: THREE.Mesh;
    hand: ControllerHand | null;
    source: XRInputSource | null;
    tip: THREE.Vector3;
    previousTip: THREE.Vector3;
    base: THREE.Vector3;
    previousBase: THREE.Vector3;
    hasSample: boolean;
    validStrike: boolean;
    speed: number;
    previousSongTime: number;
    songTime: number;
    attempt: StrikeAttempt;
    cleanup: () => void;
}

export class XrInputAdapter {
    private readonly controllers: ControllerState[];
    /** Grip-space z of the blade tip; the strike samples and the drawn blade both follow it. */
    private bladeTipZ: number = SABER_CONFIG.bladeTipZMeters;
    onTriggerPress: ((hand: ControllerHand) => void) | null = null;
    onPausePress: (() => void) | null = null;
    private pointerMode = false;
    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
        this.controllers = [0, 1].map(index => {
            const grip = renderer.xr.getControllerGrip(index);
            const targetRay = renderer.xr.getController(index);
            const saber = new THREE.Group();
            const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, SABER_CONFIG.bladeLengthMeters, 8),
                new THREE.MeshBasicMaterial({ color: 0xffffff }));
            blade.rotation.x = -Math.PI / 2;
            blade.position.z = (SABER_CONFIG.bladeBaseZMeters + SABER_CONFIG.bladeTipZMeters) / 2;
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, SABER_CONFIG.handleLengthMeters, 8),
                new THREE.MeshStandardMaterial({ color: 0x273347, metalness: 0.7, roughness: 0.3 }));
            handle.rotation.x = -Math.PI / 2;
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.025),
                new THREE.MeshBasicMaterial({ color: 0xadbcd0 }));
            guard.position.z = SABER_CONFIG.bladeBaseZMeters;
            saber.add(blade, handle, guard);
            grip.add(saber);
            // Unit-length laser along -Z, scaled to the hit distance; additive so it reads as light.
            const pointer = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.5),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending,
                    depthWrite: false, toneMapped: false }));
            pointer.name = 'menuPointer';
            pointer.visible = false;
            pointer.scale.z = POINTER_DEFAULT_LENGTH_METERS;
            targetRay.add(pointer);
            scene.add(grip, targetRay);
            const state: ControllerState = {
                grip, targetRay, saber, blade, pointer, hand: null, source: null,
                tip: new THREE.Vector3(), previousTip: new THREE.Vector3(),
                base: new THREE.Vector3(), previousBase: new THREE.Vector3(),
                hasSample: false, validStrike: false, speed: 0, previousSongTime: 0, songTime: 0,
                attempt: { hand: 'left', songTime: 0, speed: 0, position: new THREE.Vector3(),
                    previousPosition: new THREE.Vector3(), basePosition: new THREE.Vector3(), previousBasePosition: new THREE.Vector3() },
                cleanup: () => {}
            };
            const connected = (event: { data: XRInputSource }) => {
                state.source = event.data;
                state.hand = event.data.handedness === 'left' || event.data.handedness === 'right' ? event.data.handedness : null;
                if (state.hand) {
                    (blade.material as THREE.MeshBasicMaterial).color.setHex(COLORS[state.hand]);
                    (pointer.material as THREE.MeshBasicMaterial).color.setHex(COLORS[state.hand]);
                }
                this.resetState(state);
            };
            const disconnected = () => { state.source = null; state.hand = null; this.resetState(state); };
            const select = () => { if (state.hand) this.onTriggerPress?.(state.hand); };
            const squeeze = () => { if (state.hand) this.onPausePress?.(); };
            targetRay.addEventListener('connected', connected);
            targetRay.addEventListener('disconnected', disconnected);
            targetRay.addEventListener('selectstart', select);
            targetRay.addEventListener('squeezestart', squeeze);
            state.cleanup = () => {
                targetRay.removeEventListener('connected', connected);
                targetRay.removeEventListener('disconnected', disconnected);
                targetRay.removeEventListener('selectstart', select);
                targetRay.removeEventListener('squeezestart', squeeze);
                grip.remove(saber);
                targetRay.remove(pointer);
                pointer.geometry.dispose(); (pointer.material as THREE.Material).dispose();
                scene.remove(grip, targetRay);
                saber.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        object.geometry.dispose();
                        (object.material as THREE.Material).dispose();
                    }
                });
            };
            return state;
        });
    }
    private resetState(state: ControllerState): void {
        state.hasSample = false;
        state.validStrike = false;
        state.speed = 0;
    }
    resetMotion(): void { for (const state of this.controllers) this.resetState(state); }

    update(deltaSec: number, songTime: number, trackingAvailable = true): void {
        for (const state of this.controllers) {
            if (!trackingAvailable || !state.source || !state.grip.visible ||
                !(deltaSec > 0 && deltaSec <= SABER_CONFIG.maxSampleGapSec)) {
                this.resetState(state);
                continue;
            }
            state.previousTip.copy(state.tip);
            state.previousBase.copy(state.base);
            state.previousSongTime = state.songTime;
            state.songTime = songTime;
            state.grip.updateWorldMatrix(true, false);
            state.tip.set(0, 0, this.bladeTipZ).applyMatrix4(state.grip.matrixWorld);
            state.base.set(0, 0, SABER_CONFIG.bladeBaseZMeters).applyMatrix4(state.grip.matrixWorld);
            state.validStrike = state.hasSample && songTime >= state.previousSongTime && songTime - state.previousSongTime <= 0.1;
            state.speed = state.validStrike ? Math.max(state.tip.distanceTo(state.previousTip), state.base.distanceTo(state.previousBase)) / deltaSec : 0;
            state.hasSample = true;
        }
    }
    /**
     * Saber blade length (session-scope setting). The judged blade samples (base -> tip) and the
     * drawn blade change together; motion history resets so no sample spans two lengths.
     */
    setBladeLength(lengthMeters: number): void {
        if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) return;
        this.bladeTipZ = SABER_CONFIG.bladeBaseZMeters - lengthMeters;
        for (const state of this.controllers) {
            state.blade.scale.y = lengthMeters / SABER_CONFIG.bladeLengthMeters;
            state.blade.position.z = (SABER_CONFIG.bladeBaseZMeters + this.bladeTipZ) / 2;
        }
        this.resetMotion();
    }

    getStrikeAttempt(hand: ControllerHand, songTime: number, worldToPlayfield: THREE.Matrix4): StrikeAttempt | null {
        const state = this.controllers.find(c => c.hand === hand && c.validStrike);
        if (!state) return null;
        const a = state.attempt;
        a.hand = hand; a.songTime = songTime; a.previousSongTime = state.previousSongTime; a.speed = state.speed;
        (a.position as THREE.Vector3).copy(state.tip).applyMatrix4(worldToPlayfield);
        (a.previousPosition as THREE.Vector3).copy(state.previousTip).applyMatrix4(worldToPlayfield);
        (a.basePosition as THREE.Vector3).copy(state.base).applyMatrix4(worldToPlayfield);
        (a.previousBasePosition as THREE.Vector3).copy(state.previousBase).applyMatrix4(worldToPlayfield);
        return a;
    }
    /**
     * Menu mode (ADR-009 Addendum O): sabers hide and controller lasers appear. Strike sampling
     * restarts on either change so no blade sample spans the menu.
     */
    setPointerMode(enabled: boolean): void {
        if (enabled === this.pointerMode) return;
        this.pointerMode = enabled;
        for (const state of this.controllers) {
            state.saber.visible = !enabled;
            state.pointer.visible = enabled;
            state.pointer.scale.z = POINTER_DEFAULT_LENGTH_METERS;
        }
        this.resetMotion();
    }

    get isPointerMode(): boolean { return this.pointerMode; }

    /** World-space pointing ray of a connected hand's controller; false when it is not tracked. */
    getPointerRay(hand: ControllerHand, target: THREE.Ray): boolean {
        const state = this.controllers.find(c => c.hand === hand);
        if (!state?.source || !state.targetRay.visible) return false;
        state.targetRay.updateWorldMatrix(true, false);
        target.origin.setFromMatrixPosition(state.targetRay.matrixWorld);
        target.direction.set(0, 0, -1).transformDirection(state.targetRay.matrixWorld);
        return true;
    }

    /** Laser length to what it points at (the default length when it hits nothing). */
    setPointerLength(hand: ControllerHand, meters: number | null): void {
        const state = this.controllers.find(c => c.hand === hand);
        if (state) state.pointer.scale.z = meters !== null && Number.isFinite(meters) && meters > 0 ? meters : POINTER_DEFAULT_LENGTH_METERS;
    }

    /** Thumbstick X axis of a hand in [-1, 1] (0 without a gamepad). xr-standard puts it at axes[2]. */
    getThumbstickX(hand: ControllerHand): number {
        const axes = this.controllers.find(c => c.hand === hand)?.source?.gamepad?.axes;
        const value = axes ? axes.length >= 4 ? axes[2] : axes[0] : 0;
        return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    }

    pulseHaptics(hand: ControllerHand, intensity: number, durationMs: number): void {
        const actuator = this.controllers.find(c => c.hand === hand)?.source?.gamepad?.hapticActuators?.[0];
        if (!actuator?.pulse) return;
        try { void actuator.pulse(intensity, durationMs).catch(error => console.debug('XR haptic unavailable', error)); }
        catch (error) { console.debug('XR haptic unavailable', error); }
    }
    dispose(): void { for (const state of this.controllers) state.cleanup(); }
}
