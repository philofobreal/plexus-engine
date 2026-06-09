import { getBackgroundClearStyle } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';

class DarkTechnoIdentity implements VisualIdentity {
    readonly id = 'dark-techno';
    readonly name = 'Dark Techno';

    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]) {
        const clear = getBackgroundClearStyle(State.visualTuning, State.modulation.rhythmicImpulse * 4);
        backend.background(Math.min(clear.r, 8), Math.min(clear.g, 8), Math.min(clear.b, 8), clear.a);

        this.updateParticles(backend, particles);
        this.drawIndustrialNetwork(backend, particles);
        this.drawStrobeCore(backend, shockwaves);
    }

    private updateParticles(backend: VisualRendererBackend, particles: Particle[]) {
        const impulse = Math.max(State.modulation.rhythmicImpulse * 1.45, State.denseImpactFlash);
        const movement = State.modulation.densityDrive * 0.55 + State.modulation.spectralChaos * 0.32;
        for (let pt of particles) {
            pt.update(State.modulation.macroMomentum * 0.25, movement, impulse, State.isPlaying, 0, backend.width, backend.height);
        }
    }

    private drawIndustrialNetwork(backend: VisualRendererBackend, particles: Particle[]) {
        const maxDist = 92 + State.modulation.densityDrive * 46;
        const maxDistSq = maxDist * maxDist;
        const flashAlpha = Math.min(State.denseImpactFlash * 260 + State.modulation.rhythmicImpulse * 70, 255);
        const polygonLimit = State.denseImpactFlash > 0.28 ? 3 : 1;

        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            let linesDrawn = 0;
            let polygonsDrawn = 0;

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.pos.x - p2.pos.x;
                const dy = p1.pos.y - p2.pos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq >= maxDistSq) continue;

                const closeness = 1 - Math.sqrt(distSq) / maxDist;
                const alpha = 35 + closeness * 125 + flashAlpha * 0.28;
                backend.stroke(225, 225, 225, alpha);
                backend.strokeWeight((0.55 + State.modulation.rhythmicImpulse * 1.65) * State.visualTuning.lineWeight);
                backend.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);
                linesDrawn++;

                if (State.isPlaying && polygonsDrawn < polygonLimit && distSq < maxDistSq * 0.38) {
                    for (let k = j + 1; k < particles.length; k++) {
                        const p3 = particles[k];
                        const d13x = p1.pos.x - p3.pos.x;
                        const d13y = p1.pos.y - p3.pos.y;
                        const d23x = p2.pos.x - p3.pos.x;
                        const d23y = p2.pos.y - p3.pos.y;
                        if (d13x * d13x + d13y * d13y < maxDistSq * 0.34 &&
                            d23x * d23x + d23y * d23y < maxDistSq * 0.34) {
                            backend.noStroke();
                            backend.fill(245, 245, 245, flashAlpha * State.visualTuning.polygonFlash);
                            backend.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            polygonsDrawn++;
                            break;
                        }
                    }
                }

                if (linesDrawn > 4) break;
            }

            backend.noStroke();
            backend.fill(190, 190, 190, 80 + flashAlpha * 0.35);
            backend.circle(p1.pos.x, p1.pos.y, 1.4 + State.modulation.rhythmicImpulse * 3.2);
        }
    }

    private drawStrobeCore(backend: VisualRendererBackend, shockwaves: Shockwave[]) {
        const cx = backend.width / 2;
        const cy = backend.height / 2;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const sw = shockwaves[i];
            sw.update();
            sw.draw(backend, cx, cy);
            if (sw.alpha <= 0) shockwaves.splice(i, 1);
        }

        const strobe = Math.max(State.denseImpactFlash, State.modulation.rhythmicImpulse * 0.75);
        backend.noStroke();
        backend.fill(255, 255, 255, strobe * 230);
        backend.circle(cx, cy, 5 + strobe * 28);
    }
}

export const darkTechnoIdentity: VisualIdentity = new DarkTechnoIdentity();
