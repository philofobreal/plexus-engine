import { getBackgroundClearStyle, hueToRgbInto, tuneAudioValue } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity, VisualIdentityDrawContext } from './VisualIdentity';

class OrganicAmbientIdentity implements VisualIdentity {
    readonly id = 'organic-ambient';
    readonly name = 'Organic Ambient';
    readonly usesSharedSimulation = true;

    private readonly mistColor: [number, number, number] = [0, 0, 0];
    private readonly earthColor: [number, number, number] = [0, 0, 0];
    private readonly bloomColor: [number, number, number] = [0, 0, 0];

    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[], context?: VisualIdentityDrawContext) {
        const clear = getBackgroundClearStyle(State.visualTuning, State.cueDecay * 3);
        backend.background(
            Math.min(clear.r + 2, 28),
            Math.min(clear.g + 8 + State.modulation.macroMomentum * 8, 38),
            Math.min(clear.b + 7 + State.modulation.kineticTension * 6, 42),
            clear.a
        );

        const advance = context?.advanceSharedSimulation !== false;
        if (advance) this.updateFlowingParticles(backend, particles);
        this.drawMistField(backend, particles);
        this.drawSoftCenter(backend, shockwaves, advance);
    }

    private updateFlowingParticles(backend: VisualRendererBackend, particles: Particle[]) {
        const energy = State.modulation.macroMomentum * 0.24 + tuneAudioValue(State.currentFeatures.melody, State.visualTuning) * 0.16;
        const movement = State.modulation.kineticTension * 0.14 + State.modulation.densityDrive * 0.1;
        const impulse = Math.max(State.cueDecay * 0.22, State.modulation.rhythmicImpulse * 0.12);
        for (let pt of particles) {
            pt.update(energy, movement, impulse, State.isPlaying, State.directorOutput.centripetalOrbit * 0.22, backend.width, backend.height);
        }
    }

    private drawMistField(backend: VisualRendererBackend, particles: Particle[]) {
        const melody = tuneAudioValue(State.currentFeatures.melody, State.visualTuning);
        const vocal = tuneAudioValue(State.currentFeatures.vocal, State.visualTuning);
        const radius = (34 + State.modulation.densityDrive * 46 + melody * 30) * State.visualTuning.circleSize;
        hueToRgbInto(this.mistColor, 142 + melody * 28, 0.34, 0.68);
        hueToRgbInto(this.earthColor, 84 + vocal * 20, 0.32, 0.55);

        for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            const phase = Math.sin(State.rotationPhase * 0.006 + i * 0.61) * 0.5 + 0.5;
            const color = phase > 0.5 ? this.mistColor : this.earthColor;
            const alpha = (0.035 + State.modulation.macroMomentum * 0.05 + phase * 0.035) * State.visualTuning.circleBackgroundAlpha;
            backend.radialGlow(pt.pos.x, pt.pos.y, radius * (0.72 + phase * 0.55), color, alpha);
        }
    }

    private drawSoftCenter(backend: VisualRendererBackend, shockwaves: Shockwave[], advance: boolean) {
        const cx = backend.width / 2;
        const cy = backend.height / 2;
        hueToRgbInto(this.bloomColor, 190 + State.modulation.kineticTension * 24, 0.38, 0.72);

        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const sw = shockwaves[i];
            if (advance) sw.update();
            if (advance && sw.alpha <= 0) shockwaves.splice(i, 1);
        }

        const bloomRadius = Math.max(backend.width, backend.height) * (0.18 + State.modulation.macroMomentum * 0.1);
        backend.radialGlow(cx, cy, bloomRadius, this.bloomColor, 0.05 + State.cueDecay * 0.08);
        backend.noStroke();
        backend.fill(this.bloomColor[0], this.bloomColor[1], this.bloomColor[2], 24 + State.modulation.rhythmicImpulse * 30);
        backend.circle(cx, cy, (20 + State.modulation.macroMomentum * 44) * State.visualTuning.circleSize);
    }
}

export const organicAmbientIdentity: VisualIdentity = new OrganicAmbientIdentity();
