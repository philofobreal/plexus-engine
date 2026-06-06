import type {
    AudioFrame,
    DirectorOutput,
    DirectorState,
    ModulationState,
    VisualFeatureFrame,
    VisualTuningConfig
} from '../types';

export class VisualDirectorFSM {
    private currentState: DirectorState = 'IDLE';
    private glitchIntensity = 0;
    private lastUpdateTime = 0;
    private lastStateTransitionTime = 0;
    
    // Állapotgép stabilitás
    private readonly MIN_STATE_DURATION = 0.15; // 150ms cooldown az állapotváltásokra
    private readonly HYSTERESIS_MARGIN = 0.03;   // Hiszterézis védősáv

    update(
        currentTime: number,
        frame: AudioFrame,
        features: VisualFeatureFrame,
        buildupValue: number,
        pivotValue: number,
        tuning: VisualTuningConfig,
        modulation: ModulationState,
        futureFrame?: AudioFrame
    ): DirectorOutput {
        // 1. Seek, Loop vagy lejátszás-visszaugrás kezelése: azonnali idő-visszaállítás
        if (currentTime < this.lastUpdateTime || currentTime < this.lastStateTransitionTime) {
            this.lastStateTransitionTime = currentTime;
            this.lastUpdateTime = currentTime;
            this.currentState = 'IDLE';
            this.glitchIntensity = 0;
        }

        // 2. Minden logikai réteg futtatása minden egyes frame-ben
        this.applyDynamicThresholds(currentTime, frame, buildupValue, pivotValue, tuning);
        this.applyStateDampening(frame, features, tuning, modulation);
        this.applyDropAnticipation(futureFrame, tuning, modulation);
        this.applyDramaturgyBoost(buildupValue, tuning, modulation);
        this.updateGlitchEnvelope(currentTime);

        return {
            state: this.currentState,
            centripetalOrbit: this.currentState === 'BUILDUP' ? this.clamp01(buildupValue) : 0,
            glitchIntensity: this.currentState === 'GLITCH_LOW_DROP' ? this.glitchIntensity : 0,
            invertBackground: false // JAVÍTVA: Fixen letiltva a háttér-inverzió a stroboszkóp-effekt ellen.
        };
    }

    private applyDynamicThresholds(
        currentTime: number,
        frame: AudioFrame,
        buildupValue: number,
        pivotValue: number,
        tuning: VisualTuningConfig
    ): void {
        const elapsedSinceTransition = currentTime - this.lastStateTransitionTime;
        
        // Ha szünetel a lejátszás, ne akadályozzuk meg az állapotgép működését a cooldown-nal
        if (elapsedSinceTransition < this.MIN_STATE_DURATION && this.currentState !== 'IDLE' && currentTime > this.lastStateTransitionTime) {
            if (this.currentState === 'GLITCH_LOW_DROP') frame.state = 'LOW_DROP';
            else if (this.currentState === 'DROP') frame.state = 'HIGH';
            else if (this.currentState === 'INTRO_BREAK') frame.state = 'LOW';
            return; 
        }

        const dynamicsThreshold = Number.isFinite(tuning.dynamicsThreshold) ? tuning.dynamicsThreshold : 0.45;
        const dropThreshold = Number.isFinite(tuning.dropThreshold) ? tuning.dropThreshold : 0.35;

        // JAVÍTVA: Felhasználjuk a pivotValue paramétert a hiszterézis sáv tágítására feszültség fázisokban
        const pivotStabilizer = pivotValue * 0.12; 
        const isCurrentlyLowDrop = this.currentState === 'GLITCH_LOW_DROP';
        const activeDynamicsThreshold = isCurrentlyLowDrop 
            ? dynamicsThreshold - this.HYSTERESIS_MARGIN - pivotStabilizer
            : dynamicsThreshold + pivotStabilizer;
        const activeDropThreshold = isCurrentlyLowDrop 
            ? dropThreshold + this.HYSTERESIS_MARGIN + pivotStabilizer
            : dropThreshold - pivotStabilizer;

        let nextState: DirectorState = 'IDLE';

        frame.state = frame.eRatio >= activeDynamicsThreshold ? 'HIGH' : 'LOW';
        nextState = frame.state === 'HIGH' ? 'DROP' : 'INTRO_BREAK';

        if (frame.state === 'HIGH') {
            // Csak akkor engedünk LOW_DROP állapotba lépni, ha a pillanatnyi energia bezuhan, 
            // de nem megy át teljes csendbe (abszolút zajzár).
            if (frame.e < activeDropThreshold && frame.e > 0.12 && frame.eRatio > 0.15) {
                frame.state = 'LOW_DROP';
                nextState = 'GLITCH_LOW_DROP';
            } else if (frame.e > 0.95) {
                frame.state = 'LOW_OVERLOAD';
                nextState = 'GLITCH_LOW_DROP';
            }
        }

        if (nextState !== 'GLITCH_LOW_DROP' && buildupValue > 0.5) {
            nextState = 'BUILDUP';
        }

        if (nextState !== this.currentState) {
            // Átmenetkor lementjük az utolsó stabil állapot energiáját
            if (nextState === 'GLITCH_LOW_DROP') {
                this.glitchIntensity = 1.0;
            }
            this.currentState = nextState;
            this.lastStateTransitionTime = currentTime;
        }
    }

    private applyStateDampening(
        frame: AudioFrame,
        features: VisualFeatureFrame,
        tuning: VisualTuningConfig,
        modulation: ModulationState
    ): void {
        if (!frame.state.startsWith('LOW')) return;

        const restraint = Number.isFinite(tuning.breakRestraint) ? tuning.breakRestraint : 1;
        modulation.densityDrive *= 0.15 * restraint;
        modulation.kineticTension *= 0.20 * restraint;
        modulation.macroMomentum *= 0.10 * restraint;

        features.melody *= 0.20 * restraint;
        features.vocal *= 0.20 * restraint;
        features.fx *= 0.15 * restraint;
    }

    private applyDropAnticipation(
        futureFrame: AudioFrame | undefined,
        tuning: VisualTuningConfig,
        modulation: ModulationState
    ): void {
        const anticipation = Number.isFinite(tuning.dropAnticipation) ? tuning.dropAnticipation : 0;
        if (anticipation <= 0 || !futureFrame) return;
        if (futureFrame.state !== 'LOW' && futureFrame.state !== 'LOW_DROP') return;

        const damp = Number.isFinite(tuning.dropDampening) ? tuning.dropDampening : 1;
        const scale = futureFrame.state === 'LOW_DROP' ? 0.72 * damp : 0.86 * damp;
        modulation.kineticTension *= scale;
        modulation.densityDrive *= scale;
    }

    private applyDramaturgyBoost(
        buildupValue: number,
        tuning: VisualTuningConfig,
        modulation: ModulationState
    ): void {
        const buildup = this.clamp01(buildupValue);
        const intensity = Number.isFinite(tuning.buildupIntensity) ? tuning.buildupIntensity : 1;
        modulation.kineticTension = Math.min(1, modulation.kineticTension + buildup * 0.18 * intensity);
        modulation.macroMomentum = Math.max(modulation.macroMomentum, buildup * 0.35 * intensity);
    }

    private updateGlitchEnvelope(currentTime: number): void {
        const elapsed = Math.max(0, currentTime - this.lastUpdateTime);
        this.lastUpdateTime = currentTime;

        // JAVÍTVA: Eltávolítva a blokkoló guard, hogy a glitch intenzitása 
        // a GLITCH_LOW_DROP állapot alatt is azonnal lecsenghessen,
        // így a fehér felvillanás tartós beégés helyett valódi, gyors vaku-villanássá válik.

        if (elapsed > 0) {
            this.glitchIntensity *= Math.exp(-elapsed * 4.0);
            if (this.glitchIntensity < 0.001) this.glitchIntensity = 0;
        }
    }

    private clamp01(value: number): number {
        return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    }
}