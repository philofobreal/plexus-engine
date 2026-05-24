import p5 from 'p5';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';

export function drawClassicPlexusEffect(p: p5, particles: Particle[], shockwaves: Shockwave[]) {
    let bgFlash = State.beatDecay * 12;
    p.background(8 + bgFlash, 5 + bgFlash, 14 + bgFlash);

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
    let glowRadius = Math.max(p.width, p.height) * (0.3 + State.currentFrame.b * 0.3);

    let ctx = p.drawingContext as CanvasRenderingContext2D;
    let bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    let hue = isLowMode ? 70 : 40;
    bgGlow.addColorStop(0, `rgba(${hue}, 25, 90, ${0.3 + State.currentFrame.b * 0.4})`);
    bgGlow.addColorStop(1, 'rgba(10, 7, 16, 0)');

    ctx.fillStyle = bgGlow;
    p.noStroke(); p.circle(cx, cy, glowRadius * 2);

    let coreRadius = 8 + State.beatDecay * 40;
    p.fill(255, 255, 255, 80 + State.beatDecay * 175);
    p.circle(cx, cy, coreRadius);
}

function drawPolygonalNetwork(p: p5, particles: Particle[]) {
    let maxDist = State.isPlaying ? 130 + (State.currentFrame.b * 50) : 80;
    let maxDistSq = maxDist * maxDist;

    for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i]; let linesDrawn = 0, polysDrawn = 0;
        for (let j = i + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dist12Sq = (p1.pos.x - p2.pos.x)**2 + (p1.pos.y - p2.pos.y)**2;

            if (dist12Sq < maxDistSq) {
                linesDrawn++; let d12 = Math.sqrt(dist12Sq);
                let lineAlpha = p.map(d12, 0, maxDist, 180, 0) + (State.beatDecay * 75);
                p.stroke(180 - State.currentFrame.t * 40, 220, 255, lineAlpha);
                p.strokeWeight(0.5 + State.beatDecay * 2);
                p.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);

                if (State.isPlaying && polysDrawn < 2 && dist12Sq < maxDistSq * 0.6) {
                    for (let k = j + 1; k < particles.length; k++) {
                        let p3 = particles[k];
                        if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < maxDistSq * 0.6 &&
                            (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < maxDistSq * 0.6) {
                            polysDrawn++;
                            let baseAlpha = Math.min(10 + (State.beatDecay * 40), 50);
                            let finalPolyAlpha = baseAlpha + (State.snareFlash * 150);
                            p.fill(220, 240, 255, finalPolyAlpha); p.noStroke();
                            p.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            break;
                        }
                    }
                }
            }
            if (linesDrawn > 6) break;
        }
        p.noStroke(); p.fill(255, 255, 255, 120 + State.beatDecay * 135);
        p.circle(p1.pos.x, p1.pos.y, 2 + State.beatDecay * 4);
    }
}
