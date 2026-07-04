import { getBackgroundClearStyle, hueToRgbInto, shouldUseExpensiveGlow } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';
import type { VisualIdentity, VisualIdentityDrawContext } from './VisualIdentity';

class ClassicPlexusIdentity implements VisualIdentity {
    readonly id = 'classic';
    readonly name = 'Classic';
    readonly usesSharedSimulation = true;

    private readonly glowColor: [number, number, number] = [0, 0, 0];
    private readonly coreColor: [number, number, number] = [0, 0, 0];
    private readonly lineColor: [number, number, number] = [0, 0, 0];
    private readonly polygonColor: [number, number, number] = [0, 0, 0];
    private readonly nodeColor: [number, number, number] = [0, 0, 0];

    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[], context?: VisualIdentityDrawContext) {
        let bgFlash = State.modulation.rhythmicImpulse * 12;
        const clear = getBackgroundClearStyle(State.visualTuning, bgFlash);

        backend.background(clear.r, clear.g, clear.b, clear.a);

        const advance = context?.advanceSharedSimulation !== false;
        this.drawCenterDynamics(backend, shockwaves, advance);
        for (let pt of particles) {
            if (advance) pt.update(
                State.modulation.macroMomentum,
                State.modulation.densityDrive,
                State.modulation.rhythmicImpulse,
                State.isPlaying,
                State.directorOutput.centripetalOrbit,
                backend.width,
                backend.height
            );
        }
        this.drawPolygonalNetwork(backend, particles);
    }

    private drawCenterDynamics(backend: VisualRendererBackend, shockwaves: Shockwave[], advance: boolean) {
        let cx = backend.width / 2; let cy = backend.height / 2;
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            let sw = shockwaves[i];
            if (advance) sw.update();
            sw.draw(backend, cx, cy);
            if (advance && sw.alpha <= 0) shockwaves.splice(i, 1);
        }

        let isLowMode = State.currentFrame.state.startsWith('LOW');
        let glowRadius = Math.max(backend.width, backend.height) * (0.3 + State.modulation.densityDrive * 0.3) * State.visualTuning.circleSize;

        hueToRgbInto(this.glowColor, State.visualTuning.circleBackgroundHue + (isLowMode ? 105 : 0), 0.74, 0.5);
        let glowAlpha = Math.min((0.3 + State.modulation.densityDrive * 0.4) * State.visualTuning.circleBackgroundAlpha, 1);
        if (State.isPlaying && shouldUseExpensiveGlow(State.visualTuning)) {
            backend.radialGlow(cx, cy, glowRadius, this.glowColor, glowAlpha);
        }

        let coreRadius = (8 + State.modulation.rhythmicImpulse * 40) * State.visualTuning.circleSize;
        hueToRgbInto(this.coreColor, State.visualTuning.circleHue, 0.28, 0.9);
        backend.noStroke();
        backend.fill(this.coreColor[0], this.coreColor[1], this.coreColor[2], (80 + State.modulation.rhythmicImpulse * 175) * State.visualTuning.circleAlpha);
        backend.circle(cx, cy, coreRadius);
    }

    private drawPolygonalNetwork(backend: VisualRendererBackend, particles: Particle[]) {
        let maxDist = (State.isPlaying ? 130 + (State.modulation.densityDrive * 50) : 80) * State.visualTuning.lineDistance;
        let maxDistSq = maxDist * maxDist;
        hueToRgbInto(this.lineColor, State.visualTuning.lineHue);
        hueToRgbInto(this.polygonColor, State.visualTuning.polygonHue, 0.58, 0.82);
        hueToRgbInto(this.nodeColor, State.visualTuning.circleHue, 0.35, 0.92);

        for (let i = 0; i < particles.length; i++) {
            let p1 = particles[i]; let linesDrawn = 0, polysDrawn = 0;
            for (let j = i + 1; j < particles.length; j++) {
                let p2 = particles[j];
                let dist12Sq = (p1.pos.x - p2.pos.x)**2 + (p1.pos.y - p2.pos.y)**2;

                if (dist12Sq < maxDistSq) {
                    linesDrawn++; let d12 = Math.sqrt(dist12Sq);
                    let lineAlpha = (linearMap(d12, 0, maxDist, 180, 0) + (State.modulation.rhythmicImpulse * 75)) * State.visualTuning.lineAlpha;
                    backend.stroke(this.lineColor[0] - State.modulation.spectralChaos * 25, this.lineColor[1], this.lineColor[2], lineAlpha);
                    backend.strokeWeight((0.5 + State.modulation.rhythmicImpulse * 2) * State.visualTuning.lineWeight);
                    let glitch = State.directorOutput.glitchIntensity;
                    let glitchX1 = glitch > 0 ? this.getGlitchOffset(i, j, 0) * glitch : 0;
                    let glitchY1 = glitch > 0 ? this.getGlitchOffset(i, j, 1) * glitch : 0;
                    let glitchX2 = glitch > 0 ? this.getGlitchOffset(j, i, 2) * glitch : 0;
                    let glitchY2 = glitch > 0 ? this.getGlitchOffset(j, i, 3) * glitch : 0;
                    backend.line(p1.pos.x + glitchX1, p1.pos.y + glitchY1, p2.pos.x + glitchX2, p2.pos.y + glitchY2);

                    if (State.isPlaying && polysDrawn < 2 && dist12Sq < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                        for (let k = j + 1; k < particles.length; k++) {
                            let p3 = particles[k];
                            if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize &&
                                (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                                polysDrawn++;
                                let baseAlpha = Math.min(10 + (State.modulation.rhythmicImpulse * 40), 50) * State.visualTuning.polygonAlpha;
                                let finalPolyAlpha = baseAlpha + (State.denseImpactFlash * 150 * State.visualTuning.polygonFlash);
                                backend.fill(this.polygonColor[0], this.polygonColor[1], this.polygonColor[2], finalPolyAlpha); backend.noStroke();
                                backend.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                                break;
                            }
                        }
                    }
                }
                if (linesDrawn > 6) break;
            }
            let nodeGlitch = State.directorOutput.glitchIntensity;
            backend.noStroke(); backend.fill(this.nodeColor[0], this.nodeColor[1], this.nodeColor[2], (120 + State.modulation.rhythmicImpulse * 135) * State.visualTuning.circleAlpha);
            backend.circle(
                p1.pos.x + (nodeGlitch > 0 ? this.getGlitchOffset(i, 0, 4) * nodeGlitch : 0),
                p1.pos.y + (nodeGlitch > 0 ? this.getGlitchOffset(i, 0, 5) * nodeGlitch : 0),
                (2 + State.modulation.rhythmicImpulse * 4) * State.visualTuning.circleSize
            );
        }
    }

    private getGlitchOffset(a: number, b: number, salt: number) {
        return Math.sin(a * 12.9898 + b * 78.233 + salt * 37.719 + State.rotationPhase * 0.43) * 5.0;
    }
}

export const classicPlexusIdentity: VisualIdentity = new ClassicPlexusIdentity();

function linearMap(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
    if (inMax === inMin) return outMin;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
