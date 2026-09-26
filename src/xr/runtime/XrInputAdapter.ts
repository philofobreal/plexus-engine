import * as THREE from 'three';
import type { RhythmHand, StrikeAttempt } from '../../gameplay';
import { SABER_CONFIG } from './SaberConfig';
export type ControllerHand = Extract<RhythmHand, 'left' | 'right'>;
const COLORS = { left: 0x4fd1ff, right: 0xff6fae };

interface ControllerState {
    grip: THREE.Group;
    targetRay: THREE.Group;
    saber: THREE.Group;
    blade: THREE.Mesh;
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
    onTriggerPress: ((hand: ControllerHand) => void) | null = null;
    onPausePress: (() => void) | null = null;
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
            scene.add(grip, targetRay);
            const state: ControllerState = {
                grip, targetRay, saber, blade, hand: null, source: null,
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
                if (state.hand) (blade.material as THREE.MeshBasicMaterial).color.setHex(COLORS[state.hand]);
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
            state.tip.set(0, 0, SABER_CONFIG.bladeTipZMeters).applyMatrix4(state.grip.matrixWorld);
            state.base.set(0, 0, SABER_CONFIG.bladeBaseZMeters).applyMatrix4(state.grip.matrixWorld);
            state.validStrike = state.hasSample && songTime >= state.previousSongTime && songTime - state.previousSongTime <= 0.1;
            state.speed = state.validStrike ? Math.max(state.tip.distanceTo(state.previousTip), state.base.distanceTo(state.previousBase)) / deltaSec : 0;
            state.hasSample = true;
        }
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
    pulseHaptics(hand: ControllerHand, intensity: number, durationMs: number): void {
        const actuator = this.controllers.find(c => c.hand === hand)?.source?.gamepad?.hapticActuators?.[0];
        if (!actuator?.pulse) return;
        try { void actuator.pulse(intensity, durationMs).catch(error => console.debug('XR haptic unavailable', error)); }
        catch (error) { console.debug('XR haptic unavailable', error); }
    }
    dispose(): void { for (const state of this.controllers) state.cleanup(); }
}
