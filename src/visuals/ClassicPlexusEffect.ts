import { getBackgroundClearStyle, hueToRgbInto, shouldUseExpensiveGlow } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { VisualRendererBackend } from './RendererBackend';

const glowColor: [number, number, number] = [0, 0, 0];
const coreColor: [number, number, number] = [0, 0, 0];
const lineColor: [number, number, number] = [0, 0, 0];
const polygonColor: [number, number, number] = [0, 0, 0];
const nodeColor: [number, number, number] = [0, 0, 0];

export function drawClassicPlexusEffect(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]) {
    let bgFlash = State.modulation.rhythmicImpulse * 12;
    const clear = getBackgroundClearStyle(State.visualTuning, bgFlash);
    backend.background(clear.r, clear.g, clear.b, clear.a);

    drawCenterDynamics(backend, shockwaves);
    for (let pt of particles) {
        pt.update(
            State.modulation.macroMomentum,
            State.modulation.lowFrequencyDrive,
            State.modulation.rhythmicImpulse,
            State.isPlaying
        );
    }
    drawPolygonalNetwork(backend, particles);
}

function drawCenterDynamics(backend: VisualRendererBackend, shockwaves: Shockwave[]) {
    let cx = backend.width / 2; let cy = backend.height / 2;
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i]; sw.update(); sw.draw(backend, cx, cy);
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
    }

    let isLowMode = State.currentFrame.state.startsWith('LOW');
    let glowRadius = Math.max(backend.width, backend.height) * (0.3 + State.modulation.lowFrequencyDrive * 0.3) * State.visualTuning.circleSize;

    hueToRgbInto(glowColor, State.visualTuning.circleBackgroundHue + (isLowMode ? 105 : 0), 0.74, 0.5);
    let glowAlpha = Math.min((0.3 + State.modulation.lowFrequencyDrive * 0.4) * State.visualTuning.circleBackgroundAlpha, 1);
    if (State.isPlaying && shouldUseExpensiveGlow(State.visualTuning)) {
        backend.radialGlow(cx, cy, glowRadius, glowColor, glowAlpha);
    }

    let coreRadius = (8 + State.modulation.rhythmicImpulse * 40) * State.visualTuning.circleSize;
    hueToRgbInto(coreColor, State.visualTuning.circleHue, 0.28, 0.9);
    backend.noStroke();
    backend.fill(coreColor[0], coreColor[1], coreColor[2], (80 + State.modulation.rhythmicImpulse * 175) * State.visualTuning.circleAlpha);
    backend.circle(cx, cy, coreRadius);
}

function drawPolygonalNetwork(backend: VisualRendererBackend, particles: Particle[]) {
    let maxDist = (State.isPlaying ? 130 + (State.modulation.lowFrequencyDrive * 50) : 80) * State.visualTuning.lineDistance;
    let maxDistSq = maxDist * maxDist;
    hueToRgbInto(lineColor, State.visualTuning.lineHue);
    hueToRgbInto(polygonColor, State.visualTuning.polygonHue, 0.58, 0.82);
    hueToRgbInto(nodeColor, State.visualTuning.circleHue, 0.35, 0.92);

    for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i]; let linesDrawn = 0, polysDrawn = 0;
        for (let j = i + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dist12Sq = (p1.pos.x - p2.pos.x)**2 + (p1.pos.y - p2.pos.y)**2;

            if (dist12Sq < maxDistSq) {
                linesDrawn++; let d12 = Math.sqrt(dist12Sq);
                let lineAlpha = (linearMap(d12, 0, maxDist, 180, 0) + (State.modulation.rhythmicImpulse * 75)) * State.visualTuning.lineAlpha;
                backend.stroke(lineColor[0] - State.modulation.spectralChaos * 25, lineColor[1], lineColor[2], lineAlpha);
                backend.strokeWeight((0.5 + State.modulation.rhythmicImpulse * 2) * State.visualTuning.lineWeight);
                backend.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);

                if (State.isPlaying && polysDrawn < 2 && dist12Sq < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                    for (let k = j + 1; k < particles.length; k++) {
                        let p3 = particles[k];
                        if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize &&
                            (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                            polysDrawn++;
                            let baseAlpha = Math.min(10 + (State.modulation.rhythmicImpulse * 40), 50) * State.visualTuning.polygonAlpha;
                            let finalPolyAlpha = baseAlpha + (State.denseImpactFlash * 150 * State.visualTuning.polygonFlash);
                            backend.fill(polygonColor[0], polygonColor[1], polygonColor[2], finalPolyAlpha); backend.noStroke();
                            backend.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            break;
                        }
                    }
                }
            }
            if (linesDrawn > 6) break;
        }
        backend.noStroke(); backend.fill(nodeColor[0], nodeColor[1], nodeColor[2], (120 + State.modulation.rhythmicImpulse * 135) * State.visualTuning.circleAlpha);
        backend.circle(p1.pos.x, p1.pos.y, (2 + State.modulation.rhythmicImpulse * 4) * State.visualTuning.circleSize);
    }
}

function linearMap(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
    if (inMax === inMin) return outMin;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
