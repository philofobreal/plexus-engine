import p5 from 'p5';
import { hueToRgb } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';

export function drawClassicPlexusEffect(p: p5, particles: Particle[], shockwaves: Shockwave[]) {
    let bgFlash = State.beatDecay * 12;
    p.background(
        Math.min(State.visualTuning.backgroundRed + bgFlash, 255),
        Math.min(State.visualTuning.backgroundGreen + bgFlash, 255),
        Math.min(State.visualTuning.backgroundBlue + bgFlash, 255)
    );

    drawCenterDynamics(p, shockwaves);
    for (let pt of particles) pt.update(State.currentFrame.e, State.currentFrame.b, State.beatDecay, State.isPlaying);
    drawPolygonalNetwork(p, particles);
}

function drawCenterDynamics(p: p5, shockwaves: Shockwave[]) {
    let cx = p.width / 2; let cy = p.height / 2;
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i]; sw.update(); sw.draw(cx, cy);
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
    }

    let isLowMode = State.currentFrame.state.startsWith('LOW');
    let glowRadius = Math.max(p.width, p.height) * (0.3 + State.currentFrame.b * 0.3) * State.visualTuning.circleSize;

    let ctx = p.drawingContext as CanvasRenderingContext2D;
    let bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    let [glowR, glowG, glowB] = hueToRgb(State.visualTuning.circleBackgroundHue + (isLowMode ? 105 : 0), 0.74, 0.5);
    let glowAlpha = Math.min((0.3 + State.currentFrame.b * 0.4) * State.visualTuning.circleBackgroundAlpha, 1);
    bgGlow.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowAlpha})`);
    bgGlow.addColorStop(1, 'rgba(10, 7, 16, 0)');

    ctx.fillStyle = bgGlow;
    p.noStroke(); p.circle(cx, cy, glowRadius * 2);

    let coreRadius = (8 + State.beatDecay * 40) * State.visualTuning.circleSize;
    let [coreR, coreG, coreB] = hueToRgb(State.visualTuning.circleHue, 0.28, 0.9);
    p.fill(coreR, coreG, coreB, (80 + State.beatDecay * 175) * State.visualTuning.circleAlpha);
    p.circle(cx, cy, coreRadius);
}

function drawPolygonalNetwork(p: p5, particles: Particle[]) {
    let maxDist = (State.isPlaying ? 130 + (State.currentFrame.b * 50) : 80) * State.visualTuning.lineDistance;
    let maxDistSq = maxDist * maxDist;
    let [lineR, lineG, lineB] = hueToRgb(State.visualTuning.lineHue);
    let [polyR, polyG, polyB] = hueToRgb(State.visualTuning.polygonHue, 0.58, 0.82);
    let [nodeR, nodeG, nodeB] = hueToRgb(State.visualTuning.circleHue, 0.35, 0.92);

    for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i]; let linesDrawn = 0, polysDrawn = 0;
        for (let j = i + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dist12Sq = (p1.pos.x - p2.pos.x)**2 + (p1.pos.y - p2.pos.y)**2;

            if (dist12Sq < maxDistSq) {
                linesDrawn++; let d12 = Math.sqrt(dist12Sq);
                let lineAlpha = (p.map(d12, 0, maxDist, 180, 0) + (State.beatDecay * 75)) * State.visualTuning.lineAlpha;
                p.stroke(lineR - State.currentFrame.t * 25, lineG, lineB, lineAlpha);
                p.strokeWeight((0.5 + State.beatDecay * 2) * State.visualTuning.lineWeight);
                p.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);

                if (State.isPlaying && polysDrawn < 2 && dist12Sq < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                    for (let k = j + 1; k < particles.length; k++) {
                        let p3 = particles[k];
                        if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize &&
                            (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 * State.visualTuning.polygonSize) {
                            polysDrawn++;
                            let baseAlpha = Math.min(10 + (State.beatDecay * 40), 50) * State.visualTuning.polygonAlpha;
                            let finalPolyAlpha = baseAlpha + (State.snareFlash * 150 * State.visualTuning.polygonFlash);
                            p.fill(polyR, polyG, polyB, finalPolyAlpha); p.noStroke();
                            p.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            break;
                        }
                    }
                }
            }
            if (linesDrawn > 6) break;
        }
        p.noStroke(); p.fill(nodeR, nodeG, nodeB, (120 + State.beatDecay * 135) * State.visualTuning.circleAlpha);
        p.circle(p1.pos.x, p1.pos.y, (2 + State.beatDecay * 4) * State.visualTuning.circleSize);
    }
}
