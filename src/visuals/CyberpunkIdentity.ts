import { getBackgroundClearStyle, hueToRgbInto, tuneAudioValue } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';

class CyberpunkIdentity implements VisualIdentity {
    readonly id = 'cyberpunk';
    readonly name = 'Cyberpunk';

    private readonly magenta: [number, number, number] = [0, 0, 0];
    private readonly cyan: [number, number, number] = [0, 0, 0];
    private readonly violet: [number, number, number] = [0, 0, 0];

    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]) {
        const clear = getBackgroundClearStyle(State.visualTuning, State.modulation.rhythmicImpulse * 9 + State.cueDecay * 5);
        backend.background(Math.min(clear.r + 4, 18), Math.min(clear.g + 1, 9), Math.min(clear.b + 14, 34), clear.a);

        hueToRgbInto(this.magenta, 330, 1, 0.5);
        hueToRgbInto(this.cyan, 183, 1, 0.5);
        hueToRgbInto(this.violet, 276, 0.86, 0.62);

        this.updateParticles(particles);
        this.drawChromaticNetwork(backend, particles);
        this.drawNeonCore(backend, shockwaves);
    }

    private updateParticles(particles: Particle[]) {
        const energy = State.modulation.macroMomentum * 0.72 + State.cueDecay * 0.22;
        const movement = State.modulation.densityDrive * 0.62 + State.modulation.spectralChaos * 0.4;
        const impulse = Math.max(State.modulation.rhythmicImpulse, State.denseImpactFlash * 0.85);
        for (let pt of particles) {
            pt.update(energy, movement, impulse, State.isPlaying, State.directorOutput.centripetalOrbit);
        }
    }

    private drawChromaticNetwork(backend: VisualRendererBackend, particles: Particle[]) {
        const tension = Math.max(State.modulation.kineticTension, State.directorOutput.glitchIntensity);
        const melody = tuneAudioValue(State.currentFeatures.melody, State.visualTuning);
        const maxDist = (118 + State.modulation.densityDrive * 72 + tension * 38) * State.visualTuning.lineDistance;
        const maxDistSq = maxDist * maxDist;
        const offset = 1.2 + tension * 3.8;
        const polyLimit = 1 + Math.floor(Math.max(State.denseImpactFlash, tension) * 3);

        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            let linesDrawn = 0;
            let polygonsDrawn = 0;
            const glitchX1 = this.glitchOffset(i, 0, 0, tension);
            const glitchY1 = this.glitchOffset(i, 0, 1, tension);

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.pos.x - p2.pos.x;
                const dy = p1.pos.y - p2.pos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq >= maxDistSq) continue;

                const closeness = 1 - Math.sqrt(distSq) / maxDist;
                const alpha = (68 + closeness * 118 + State.modulation.rhythmicImpulse * 64) * State.visualTuning.lineAlpha;
                const glitchX2 = this.glitchOffset(j, i, 2, tension);
                const glitchY2 = this.glitchOffset(j, i, 3, tension);
                const x1 = p1.pos.x + glitchX1;
                const y1 = p1.pos.y + glitchY1;
                const x2 = p2.pos.x + glitchX2;
                const y2 = p2.pos.y + glitchY2;

                backend.stroke(this.magenta[0], this.magenta[1], this.magenta[2], alpha);
                backend.strokeWeight((0.75 + tension * 1.35) * State.visualTuning.lineWeight);
                backend.line(x1 - offset, y1, x2 - offset, y2);
                backend.stroke(this.cyan[0], this.cyan[1], this.cyan[2], alpha);
                backend.line(x1 + offset, y1 + offset * 0.45, x2 + offset, y2 + offset * 0.45);
                linesDrawn++;

                if (State.isPlaying && polygonsDrawn < polyLimit && distSq < maxDistSq * (0.43 + melody * 0.12)) {
                    for (let k = j + 1; k < particles.length; k++) {
                        const p3 = particles[k];
                        const d13x = p1.pos.x - p3.pos.x;
                        const d13y = p1.pos.y - p3.pos.y;
                        const d23x = p2.pos.x - p3.pos.x;
                        const d23y = p2.pos.y - p3.pos.y;
                        if (d13x * d13x + d13y * d13y < maxDistSq * 0.48 &&
                            d23x * d23x + d23y * d23y < maxDistSq * 0.48) {
                            const gx3 = this.glitchOffset(k, j, 4, tension);
                            const gy3 = this.glitchOffset(k, j, 5, tension);
                            const alphaPoly = (18 + State.denseImpactFlash * 90 + tension * 42) * State.visualTuning.polygonAlpha;
                            backend.noStroke();
                            backend.fill(this.violet[0], this.magenta[1], this.cyan[2], alphaPoly);
                            backend.triangle(x1, y1, x2, y2, p3.pos.x + gx3, p3.pos.y + gy3);
                            polygonsDrawn++;
                            break;
                        }
                    }
                }

                if (linesDrawn > 6) break;
            }

            backend.noStroke();
            backend.fill(this.cyan[0], this.cyan[1], this.cyan[2], 95 + tension * 100);
            backend.circle(p1.pos.x + glitchX1, p1.pos.y + glitchY1, 1.8 + State.modulation.rhythmicImpulse * 4.4);
        }
    }

    private drawNeonCore(backend: VisualRendererBackend, shockwaves: Shockwave[]) {
        const cx = backend.width / 2;
        const cy = backend.height / 2;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const sw = shockwaves[i];
            sw.update();
            sw.draw(backend, cx, cy);
            if (sw.alpha <= 0) shockwaves.splice(i, 1);
        }

        const pulse = Math.max(State.modulation.rhythmicImpulse, State.cueDecay * 0.72);
        backend.radialGlow(cx, cy, Math.max(backend.width, backend.height) * (0.14 + pulse * 0.1), this.magenta, 0.06 + pulse * 0.08);
        backend.noStroke();
        backend.fill(this.magenta[0], this.magenta[1], this.magenta[2], 90 + pulse * 150);
        backend.circle(cx - 2, cy, 9 + pulse * 34);
        backend.fill(this.cyan[0], this.cyan[1], this.cyan[2], 80 + pulse * 120);
        backend.circle(cx + 2, cy + 2, 7 + pulse * 26);
    }

    private glitchOffset(a: number, b: number, salt: number, tension: number) {
        if (tension < 0.18) return 0;
        const gate = Math.sin(a * 17.13 + b * 41.71 + salt * 9.37 + State.rotationPhase * 0.19);
        if (gate < 0.42) return 0;
        return Math.sin(a * 91.7 + b * 23.11 + salt * 63.4 + State.rotationPhase * 0.47) * tension * 14;
    }
}

export const cyberpunkIdentity: VisualIdentity = new CyberpunkIdentity();
