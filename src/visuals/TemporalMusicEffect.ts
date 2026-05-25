import p5 from 'p5';
import { hueToRgb, tuneAudioValue } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { MusicPattern, PatternOccurrence, TrackSection } from '../types';

interface PatternResonance {
    pattern: MusicPattern | null;
    occurrence: PatternOccurrence | null;
    strength: number;
    phase: number;
}

export function drawTemporalMusicEffect(p: p5, particles: Particle[], shockwaves: Shockwave[]) {
    let cx = p.width / 2;
    let cy = p.height / 2;
    let section = getCurrentSection(State.currentTime);
    let resonance = getPatternResonance(State.currentTime);

    drawTemporalBackground(p, cx, cy, resonance, section);
    updateTemporalParticles(particles, resonance);
    drawTemporalPolygonNetwork(p, particles, resonance);
    drawCenterMechanisms(p, shockwaves, cx, cy, resonance, section);
}

function getCurrentSection(time: number): TrackSection | null {
    return State.trackAnalysis.sections.find(section => time >= section.start && time < section.end) || null;
}

function getPatternResonance(time: number): PatternResonance {
    let best: PatternResonance = { pattern: null, occurrence: null, strength: 0, phase: 0 };

    for (let pattern of State.trackAnalysis.patterns) {
        for (let occurrence of pattern.occurrences) {
            let duration = Math.max(0.001, occurrence.end - occurrence.start);
            if (time < occurrence.start || time > occurrence.end) continue;

            let phase = (time - occurrence.start) / duration;
            let recurrence = Math.min(pattern.occurrences.length / 5, 1);
            let strength = occurrence.confidence * occurrence.intensity * (0.62 + recurrence * 0.38);
            if (strength > best.strength) best = { pattern, occurrence, strength, phase };
        }
    }

    best.strength = tuneAudioValue(best.strength, State.visualTuning);
    if (State.activeCueKind === 'pattern') best.strength = Math.max(best.strength, State.cueDecay * 0.55);
    return best;
}

function drawTemporalBackground(p: p5, cx: number, cy: number, resonance: PatternResonance, section: TrackSection | null) {
    let bgPulse = State.beatDecay * 10 + State.cueDecay * 6;
    let sectionEnergy = section?.energy || State.currentFrame.eRatio;
    p.background(
        Math.min(State.visualTuning.backgroundRed + bgPulse + State.currentFeatures.fx * 10, 255),
        Math.min(State.visualTuning.backgroundGreen + bgPulse * 0.45 + resonance.strength * 12, 255),
        Math.min(State.visualTuning.backgroundBlue + bgPulse + State.currentFeatures.vocal * 10 + sectionEnergy * 10, 255)
    );

    let ctx = p.drawingContext as CanvasRenderingContext2D;
    let radius = Math.max(p.width, p.height) * (0.28 + State.currentFrame.b * 0.16 + State.currentFeatures.tension * 0.18) * State.visualTuning.circleSize;
    let glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    let [glowR, glowG, glowB] = hueToRgb(State.visualTuning.circleBackgroundHue + State.currentFeatures.vocal * 70);
    let glowAlpha = Math.min((0.22 + State.currentFeatures.density * 0.22 + resonance.strength * 0.12) * State.visualTuning.circleBackgroundAlpha, 1);
    glow.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowAlpha})`);
    glow.addColorStop(1, 'rgba(8, 5, 14, 0)');
    ctx.fillStyle = glow;
    p.noStroke();
    p.circle(cx, cy, radius * 2);
}

function updateTemporalParticles(particles: Particle[], resonance: PatternResonance) {
    let energy = State.currentFrame.e * 0.35 + State.currentFeatures.density * 0.38 + resonance.strength * 0.18;
    let movement = State.currentFrame.b * 0.35 + State.currentFeatures.tension * 0.32 + State.currentFeatures.fx * 0.24;
    let impulse = Math.max(State.beatDecay * 0.65, State.cueDecay * 0.45, resonance.strength * 0.35);
    for (let pt of particles) pt.update(energy, movement, impulse, State.isPlaying);
}

function drawTemporalPolygonNetwork(p: p5, particles: Particle[], resonance: PatternResonance) {
    let density = State.currentFeatures.density;
    let melody = State.currentFeatures.melody;
    let vocal = State.currentFeatures.vocal;
    let fx = State.currentFeatures.fx;
    let tension = State.currentFeatures.tension;

    let maxDist = (104 + State.currentFrame.b * 34 + density * 54 + resonance.strength * 24) * State.visualTuning.temporalNetworkDistance;
    let maxDistSq = maxDist * maxDist;
    let lineLimit = 4 + Math.floor(density * 3 + resonance.strength * 2);
    let polyLimit = 1 + Math.floor(Math.max(density, State.snareFlash) * 2);

    for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i];
        let linesDrawn = 0;
        let polysDrawn = 0;
        let connected = false;

        for (let j = i + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dx = p1.pos.x - p2.pos.x;
            let dy = p1.pos.y - p2.pos.y;
            let dist12Sq = dx * dx + dy * dy;

            if (dist12Sq < maxDistSq) {
                connected = true;
                linesDrawn++;
                let d12 = Math.sqrt(dist12Sq);
                let closeness = 1 - d12 / maxDist;
                let lineAlpha = (closeness * (92 + density * 54 + resonance.strength * 52) + State.beatDecay * 38) * State.visualTuning.lineAlpha;
                let [lineR, lineG, lineB] = hueToRgb(State.visualTuning.lineHue + melody * 45 + fx * 30, 0.68, 0.72);
                p.stroke(
                    lineR,
                    lineG,
                    lineB - tension * 18 + vocal * 18,
                    lineAlpha
                );
                p.strokeWeight((0.45 + tension * 0.85 + State.beatDecay * 0.8) * State.visualTuning.lineWeight);
                p.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);

                if (State.isPlaying && polysDrawn < polyLimit && dist12Sq < maxDistSq * (0.42 + density * 0.18) * State.visualTuning.polygonSize) {
                    for (let k = j + 1; k < particles.length; k++) {
                        let p3 = particles[k];
                        if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < maxDistSq * 0.55 * State.visualTuning.polygonSize &&
                            (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < maxDistSq * 0.55 * State.visualTuning.polygonSize) {
                            polysDrawn++;
                            let alpha = Math.min(8 + density * 28 + resonance.strength * 22 + State.snareFlash * 105 * State.visualTuning.polygonFlash, 135) * State.visualTuning.temporalPolygonAlpha * State.visualTuning.polygonAlpha;
                            let [polyR, polyG, polyB] = hueToRgb(State.visualTuning.polygonHue + vocal * 40 + fx * 70, 0.7, 0.68);
                            p.fill(polyR + melody * 24, polyG, polyB, alpha);
                            p.noStroke();
                            p.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            break;
                        }
                    }
                }
            }
            if (linesDrawn > lineLimit) break;
        }

        if (connected) {
            p.noStroke();
            let [nodeR, nodeG, nodeB] = hueToRgb(State.visualTuning.circleHue, 0.35, 0.9);
            p.fill(nodeR, nodeG, nodeB, (45 + density * 55 + State.beatDecay * 65) * State.visualTuning.circleAlpha);
            p.circle(p1.pos.x, p1.pos.y, (1.4 + density * 1.9) * State.visualTuning.circleSize);
        }
    }
}

function drawCenterMechanisms(
    p: p5,
    shockwaves: Shockwave[],
    cx: number,
    cy: number,
    resonance: PatternResonance,
    section: TrackSection | null
) {
    let sectionEnergy = section?.energy || State.currentFrame.eRatio;
    drawMechanismRing(p, cx, cy, {
        radius: (24 + State.currentFrame.b * 46 + State.beatDecay * 32) * State.visualTuning.temporalRingSize,
        deformation: State.beatDecay * 0.08,
        color: hueToRgb(State.visualTuning.circleHue),
        alpha: (48 + State.beatDecay * 125) * State.visualTuning.temporalRingAlpha,
        weight: (1.6 + State.beatDecay * 2.2) * State.visualTuning.circleLineWeight,
        lobes: 6,
        phase: p.frameCount * 0.02 * State.visualTuning.temporalRingSpeed
    });

    if (State.currentFeatures.melody > 0.08) {
        drawMechanismRing(p, cx, cy, {
            radius: (74 + State.currentFeatures.melody * 70) * State.visualTuning.temporalRingSize,
            deformation: State.currentFeatures.melody * 0.045,
            color: hueToRgb(State.visualTuning.circleHue + 25),
            alpha: (30 + State.currentFeatures.melody * 78) * State.visualTuning.temporalRingAlpha,
            weight: (0.9 + State.currentFeatures.melody * 1.2) * State.visualTuning.circleLineWeight,
            lobes: 5,
            phase: p.frameCount * 0.008 * State.visualTuning.temporalRingSpeed
        });
    }

    if (State.currentFeatures.vocal > 0.08) {
        drawMechanismRing(p, cx, cy, {
            radius: (106 + State.currentFeatures.vocal * 78) * State.visualTuning.temporalRingSize,
            deformation: State.currentFeatures.vocal * 0.03,
            color: hueToRgb(State.visualTuning.circleHue + 125),
            alpha: (24 + State.currentFeatures.vocal * 70) * State.visualTuning.temporalRingAlpha,
            weight: (1.2 + State.currentFeatures.vocal * 1.4) * State.visualTuning.circleLineWeight,
            lobes: 4,
            phase: p.frameCount * 0.006 * State.visualTuning.temporalRingSpeed
        });
    }

    if (State.currentFeatures.fx > 0.08) {
        drawMechanismRing(p, cx, cy, {
            radius: (52 + State.currentFeatures.fx * 82 + State.currentFeatures.brightness * 28) * State.visualTuning.temporalRingSize,
            deformation: State.currentFeatures.fx * 0.11,
            color: hueToRgb(State.visualTuning.circleHue + 80),
            alpha: (24 + State.currentFeatures.fx * 92) * State.visualTuning.temporalRingAlpha,
            weight: (0.8 + State.currentFeatures.fx * 1.6) * State.visualTuning.circleLineWeight,
            lobes: 9,
            phase: -p.frameCount * 0.018 * State.visualTuning.temporalRingSpeed
        });
    }

    if (resonance.strength > 0.05) {
        drawMechanismRing(p, cx, cy, {
            radius: (138 + resonance.strength * 96 + sectionEnergy * 32) * State.visualTuning.temporalRingSize,
            deformation: resonance.strength * 0.065,
            color: hueToRgb(State.visualTuning.circleHue + 160),
            alpha: (18 + resonance.strength * 86) * State.visualTuning.temporalRingAlpha,
            weight: (1 + resonance.strength * 1.6) * State.visualTuning.circleLineWeight,
            lobes: 3 + ((resonance.pattern?.occurrences.length || 0) % 4),
            phase: resonance.phase * Math.PI * 2 + p.frameCount * 0.004 * State.visualTuning.temporalRingSpeed
        });
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.update();
        sw.draw(cx, cy);
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
    }
}

function drawMechanismRing(
    p: p5,
    cx: number,
    cy: number,
    opts: { radius: number, deformation: number, color: number[], alpha: number, weight: number, lobes: number, phase: number }
) {
    p.noFill();
    p.stroke(opts.color[0], opts.color[1], opts.color[2], opts.alpha);
    p.strokeWeight(opts.weight);
    p.beginShape();
    for (let i = 0; i <= 96; i++) {
        let a = (i / 96) * Math.PI * 2;
        let deformation = 1 + Math.sin(a * opts.lobes + opts.phase) * opts.deformation;
        let r = opts.radius * deformation;
        p.vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    p.endShape();
}
