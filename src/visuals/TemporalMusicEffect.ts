import { getBackgroundClearStyle, hueToRgbInto, shouldUseExpensiveGlow, tuneAudioValue } from '../config/visualTuning';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import type { MusicPattern, PatternOccurrence, TrackSection } from '../types';
import type { VisualRendererBackend } from './RendererBackend';

interface PatternResonance {
    pattern: MusicPattern | null;
    occurrence: PatternOccurrence | null;
    strength: number;
    phase: number;
}

const glowColor: [number, number, number] = [0, 0, 0];
const lineColor: [number, number, number] = [0, 0, 0];
const polygonColor: [number, number, number] = [0, 0, 0];
const nodeColor: [number, number, number] = [0, 0, 0];
const mechanismRingColor: [number, number, number] = [0, 0, 0];

export function drawTemporalMusicEffect(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]) {
    let cx = backend.width / 2;
    let cy = backend.height / 2;
    let section = getCurrentSection(State.currentTime);
    let resonance = getPatternResonance(State.currentTime);

    drawTemporalBackground(backend, cx, cy, resonance, section);
    updateTemporalParticles(particles, resonance);
    drawTemporalPolygonNetwork(backend, particles, resonance);
    drawCenterMechanisms(backend, shockwaves, cx, cy, resonance, section);
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

function drawTemporalBackground(backend: VisualRendererBackend, cx: number, cy: number, resonance: PatternResonance, section: TrackSection | null) {
    let bgPulse = State.modulation.rhythmicImpulse * 10 + State.cueDecay * 6;
    let sectionEnergy = section?.energy || State.modulation.macroMomentum;
    const clear = getBackgroundClearStyle(State.visualTuning, bgPulse);
    backend.background(
        Math.min(clear.r + State.modulation.spectralChaos * 10, 255),
        Math.min(clear.g + resonance.strength * 12, 255),
        Math.min(clear.b + State.modulation.kineticTension * 10 + sectionEnergy * 10, 255),
        clear.a
    );

    let radius = Math.max(backend.width, backend.height) * (0.28 + State.modulation.lowFrequencyDrive * 0.16 + State.modulation.kineticTension * 0.18) * State.visualTuning.circleSize;
    hueToRgbInto(glowColor, State.visualTuning.circleBackgroundHue + State.modulation.kineticTension * 70);
    let glowAlpha = Math.min((0.22 + State.modulation.lowFrequencyDrive * 0.22 + resonance.strength * 0.12) * State.visualTuning.circleBackgroundAlpha, 1);
    if (State.isPlaying && shouldUseExpensiveGlow(State.visualTuning)) {
        backend.radialGlow(cx, cy, radius, glowColor, glowAlpha);
    }
}

function updateTemporalParticles(particles: Particle[], resonance: PatternResonance) {
    let energy = State.modulation.macroMomentum * 0.55 + resonance.strength * 0.18;
    let movement = State.modulation.lowFrequencyDrive * 0.35 + State.modulation.kineticTension * 0.32 + State.modulation.spectralChaos * 0.24;
    let impulse = Math.max(State.modulation.rhythmicImpulse * 0.65, State.cueDecay * 0.45, resonance.strength * 0.35);
    for (let pt of particles) pt.update(energy, movement, impulse, State.isPlaying);
}

function drawTemporalPolygonNetwork(backend: VisualRendererBackend, particles: Particle[], resonance: PatternResonance) {
    let density = State.modulation.lowFrequencyDrive;
    let melody = State.currentFeatures.melody;
    let vocal = State.currentFeatures.vocal;
    let fx = State.modulation.spectralChaos;
    let tension = State.modulation.kineticTension;

    let maxDist = (104 + State.modulation.lowFrequencyDrive * 34 + density * 54 + resonance.strength * 24) * State.visualTuning.temporalNetworkDistance;
    let maxDistSq = maxDist * maxDist;
    let lineLimit = 4 + Math.floor(density * 3 + resonance.strength * 2);
    let polyLimit = 1 + Math.floor(Math.max(density, State.denseImpactFlash) * 2);
    const polygonDistanceFactor = maxDistSq * 0.55 * State.visualTuning.polygonSize;
    hueToRgbInto(lineColor, State.visualTuning.lineHue + melody * 45 + fx * 30, 0.68, 0.72);
    hueToRgbInto(polygonColor, State.visualTuning.polygonHue + vocal * 40 + fx * 70, 0.7, 0.68);
    hueToRgbInto(nodeColor, State.visualTuning.circleHue, 0.35, 0.9);

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
                let lineAlpha = (closeness * (92 + density * 54 + resonance.strength * 52) + State.modulation.rhythmicImpulse * 38) * State.visualTuning.lineAlpha;
                backend.stroke(
                    lineColor[0],
                    lineColor[1],
                    lineColor[2] - tension * 18 + vocal * 18,
                    lineAlpha
                );
                backend.strokeWeight((0.45 + tension * 0.85 + State.modulation.rhythmicImpulse * 0.8) * State.visualTuning.lineWeight);
                backend.line(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y);

                if (State.isPlaying && polysDrawn < polyLimit && dist12Sq < maxDistSq * (0.42 + density * 0.18) * State.visualTuning.polygonSize) {
                    for (let k = j + 1; k < particles.length; k++) {
                        let p3 = particles[k];
                        if ((p1.pos.x - p3.pos.x)**2 + (p1.pos.y - p3.pos.y)**2 < polygonDistanceFactor &&
                            (p2.pos.x - p3.pos.x)**2 + (p2.pos.y - p3.pos.y)**2 < polygonDistanceFactor) {
                            polysDrawn++;
                            let alpha = Math.min(8 + density * 28 + resonance.strength * 22 + State.denseImpactFlash * 105 * State.visualTuning.polygonFlash, 135) * State.visualTuning.temporalPolygonAlpha * State.visualTuning.polygonAlpha;
                            backend.fill(polygonColor[0] + melody * 24, polygonColor[1], polygonColor[2], alpha);
                            backend.noStroke();
                            backend.triangle(p1.pos.x, p1.pos.y, p2.pos.x, p2.pos.y, p3.pos.x, p3.pos.y);
                            break;
                        }
                    }
                }
            }
            if (linesDrawn > lineLimit) break;
        }

        if (connected) {
            backend.noStroke();
            backend.fill(nodeColor[0], nodeColor[1], nodeColor[2], (45 + density * 55 + State.modulation.rhythmicImpulse * 65) * State.visualTuning.circleAlpha);
            backend.circle(p1.pos.x, p1.pos.y, (1.4 + density * 1.9) * State.visualTuning.circleSize);
        }
    }
}

function drawCenterMechanisms(
    backend: VisualRendererBackend,
    shockwaves: Shockwave[],
    cx: number,
    cy: number,
    resonance: PatternResonance,
    section: TrackSection | null
) {
    let sectionEnergy = section?.energy || State.modulation.macroMomentum;
    setMechanismRingColor(State.visualTuning.circleHue);
    drawMechanismRing(backend, cx, cy, {
        radius: (24 + State.modulation.lowFrequencyDrive * 46 + State.modulation.rhythmicImpulse * 32) * State.visualTuning.temporalRingSize,
        deformation: State.modulation.rhythmicImpulse * 0.08,
        colorR: mechanismRingColor[0],
        colorG: mechanismRingColor[1],
        colorB: mechanismRingColor[2],
        alpha: (48 + State.modulation.rhythmicImpulse * 125) * State.visualTuning.temporalRingAlpha,
        weight: (1.6 + State.modulation.rhythmicImpulse * 2.2) * State.visualTuning.circleLineWeight,
        lobes: 6,
        phase: backend.frameCount * 0.02 * State.visualTuning.temporalRingSpeed
    });

    if (State.currentFeatures.melody > 0.08) {
        let melodyDrive = Math.max(State.currentFeatures.melody, State.modulation.kineticTension);
        setMechanismRingColor(State.visualTuning.circleHue + 25);
        drawMechanismRing(backend, cx, cy, {
            radius: (74 + melodyDrive * 70) * State.visualTuning.temporalRingSize,
            deformation: melodyDrive * 0.085,
            colorR: mechanismRingColor[0],
            colorG: mechanismRingColor[1],
            colorB: mechanismRingColor[2],
            alpha: (30 + melodyDrive * 78) * State.visualTuning.temporalRingAlpha,
            weight: (0.9 + melodyDrive * 1.2) * State.visualTuning.circleLineWeight,
            lobes: 5,
            phase: backend.frameCount * 0.008 * State.visualTuning.temporalRingSpeed
        });
    }

    if (State.currentFeatures.vocal > 0.08) {
        let vocalDrive = Math.max(State.currentFeatures.vocal, State.modulation.kineticTension * 0.82);
        setMechanismRingColor(State.visualTuning.circleHue + 125);
        drawMechanismRing(backend, cx, cy, {
            radius: (106 + vocalDrive * 78) * State.visualTuning.temporalRingSize,
            deformation: vocalDrive * 0.055,
            colorR: mechanismRingColor[0],
            colorG: mechanismRingColor[1],
            colorB: mechanismRingColor[2],
            alpha: (24 + vocalDrive * 70) * State.visualTuning.temporalRingAlpha,
            weight: (1.2 + vocalDrive * 1.4) * State.visualTuning.circleLineWeight,
            lobes: 4,
            phase: backend.frameCount * 0.006 * State.visualTuning.temporalRingSpeed
        });
    }

    if (State.currentFeatures.fx > 0.08) {
        let fxDrive = Math.max(State.currentFeatures.fx, State.modulation.spectralChaos);
        setMechanismRingColor(State.visualTuning.circleHue + 80);
        drawMechanismRing(backend, cx, cy, {
            radius: (52 + fxDrive * 82 + State.modulation.spectralChaos * 28) * State.visualTuning.temporalRingSize,
            deformation: fxDrive * 0.15,
            colorR: mechanismRingColor[0],
            colorG: mechanismRingColor[1],
            colorB: mechanismRingColor[2],
            alpha: (24 + fxDrive * 92) * State.visualTuning.temporalRingAlpha,
            weight: (0.8 + fxDrive * 1.6) * State.visualTuning.circleLineWeight,
            lobes: 9,
            phase: -backend.frameCount * 0.018 * State.visualTuning.temporalRingSpeed
        });
    }

    if (resonance.strength > 0.05) {
        setMechanismRingColor(State.visualTuning.circleHue + 160);
        drawMechanismRing(backend, cx, cy, {
            radius: (138 + resonance.strength * 96 + sectionEnergy * 32) * State.visualTuning.temporalRingSize,
            deformation: resonance.strength * 0.065,
            colorR: mechanismRingColor[0],
            colorG: mechanismRingColor[1],
            colorB: mechanismRingColor[2],
            alpha: (18 + resonance.strength * 86) * State.visualTuning.temporalRingAlpha,
            weight: (1 + resonance.strength * 1.6) * State.visualTuning.circleLineWeight,
            lobes: 3 + ((resonance.pattern?.occurrences.length || 0) % 4),
            phase: resonance.phase * Math.PI * 2 + backend.frameCount * 0.004 * State.visualTuning.temporalRingSpeed
        });
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.update();
        sw.draw(backend, cx, cy);
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
    }
}

function drawMechanismRing(
    backend: VisualRendererBackend,
    cx: number,
    cy: number,
    opts: { radius: number, deformation: number, colorR: number, colorG: number, colorB: number, alpha: number, weight: number, lobes: number, phase: number }
) {
    backend.noFill();
    backend.stroke(opts.colorR, opts.colorG, opts.colorB, opts.alpha);
    backend.strokeWeight(opts.weight);
    backend.beginShape();
    for (let i = 0; i <= 96; i++) {
        let a = (i / 96) * Math.PI * 2;
        let deformation = 1 + Math.sin(a * opts.lobes + opts.phase) * opts.deformation;
        let r = opts.radius * deformation;
        backend.vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    backend.endShape();
}

function setMechanismRingColor(hue: number) {
    hueToRgbInto(mechanismRingColor, hue);
}
