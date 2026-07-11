import type { AudioFrame, BarAnalysis, DirectorOutput, VisualFeatureFrame } from '../types';
import { canonicalWormholeTravelSpeed, wormholeMusicalPhase } from './WormholeTimeline';

export interface WormholeMotionProfileInput {
    bpm: number;
    currentFrame: AudioFrame;
    currentFeatures: VisualFeatureFrame;
    perceptualSpectrum: readonly number[];
    beatDecay: number;
    denseImpactFlash: number;
    directorOutput: DirectorOutput;
    /** Overall confidence of the offline timing model. Unknown confidence is treated as neutral. */
    timingConfidence?: number;
    timeSec?: number;
    bars?: readonly BarAnalysis[];
    /** Preferred timestamp-derived kick envelope. Legacy callers may omit it. */
    kickEnvelope?: number;
    lowDropEnvelope?: number;
}

export interface WormholeMotionProfile {
    /** Multiplier applied to the authored preset speed. */
    travelSpeed: number;
    /** Short percussive push into the tunnel, independent from sustained bass. */
    depthPulse: number;
    /** Short impulse for selected dust cohorts; never a whole-camera transform. */
    kickJitter: number;
    /** Sustained low-frequency pressure used for curvature/spiral deformation. */
    bassWarp: number;
    /** Music-aware tunnel occupancy, separate from preset emission mode. */
    densityFill: number;
    /** Section/bass pressure that shortens the apparent horizon. */
    perspectiveCompression: number;
    /** Slow pure evolution layers. Multipliers remain tightly bounded around one. */
    breathing: number;
    depthEvolution: number;
    densityEvolution: number;
    perspectiveEvolution: number;
}

const DIRECTOR_ENERGY: Record<DirectorOutput['state'], number> = {
    IDLE: 0.12,
    INTRO_BREAK: 0.28,
    BUILDUP: 0.68,
    DROP: 1,
    GLITCH_LOW_DROP: 0.58
};

/**
 * Converts existing offline analysis into a renderer-local motion vocabulary.
 * It intentionally has no temporal state and performs no realtime FFT, keeping
 * seek, preview and offline export deterministic for the same analysis frame.
 */
export function computeWormholeMotionProfile(input: WormholeMotionProfileInput): WormholeMotionProfile {
    const spectrum = input.perceptualSpectrum;
    const sub = weightedBandMean(spectrum, 0, 3, true);
    const lowBass = weightedBandMean(spectrum, 0, 8, false);
    const upperBass = weightedBandMean(spectrum, 3, 8, false);
    const beat = clamp01(input.beatDecay);
    const denseImpact = clamp01(input.denseImpactFlash);
    const transient = input.kickEnvelope === undefined
        ? clamp01(Math.max(beat, denseImpact * 0.92))
        : clamp01(input.kickEnvelope);

    // A transient gets the depth impulse. The remaining low-band body becomes
    // slow warp pressure, so a sustained bass note cannot repeatedly fake kicks.
    // Beat events are instrument-agnostic. Require offline low-band support as
    // well, otherwise snares/high transients would incorrectly drive the kick swarm.
    const lowAttackSupport = clamp01(sub * 0.72 + lowBass * 0.28);
    const depthPulseRaw = clamp01(transient * lowAttackSupport);
    const sustainedGate = 1 - transient * 0.82;
    const bassWarpRaw = clamp01((lowBass * 0.72 + upperBass * 0.28) * sustainedGate);

    const sectionEnergy = DIRECTOR_ENERGY[input.directorOutput.state];
    const frameEnergy = clamp01(input.currentFrame.eRatio * 0.62 + input.currentFrame.e * 0.38);
    const featureDensity = clamp01(input.currentFeatures.density);
    const tension = clamp01(input.currentFeatures.tension);
    const densityFillRaw = clamp01(
        input.currentFrame.densityProj * 0.42 + featureDensity * 0.28 + frameEnergy * 0.18 + sectionEnergy * 0.12
    );

    const confidence = input.timingConfidence === undefined ? 1 : clamp01(input.timingConfidence);
    const travelSpeed = canonicalWormholeTravelSpeed(
        input.currentFrame,
        input.currentFeatures,
        input.bpm,
        confidence,
        transient
    );

    const transientAuthority = 0.42 + confidence * 0.58;
    const depthPulse = depthPulseRaw * transientAuthority;
    const kickJitter = clamp01(depthPulseRaw * (0.45 + denseImpact * 0.55) * transientAuthority);
    const bassWarp = bassWarpRaw * (0.72 + confidence * 0.28);
    const densityFill = densityFillRaw * (0.82 + confidence * 0.18);
    const perspectiveCompression = clamp01(
        (bassWarp * 0.46 + tension * 0.22 + sectionEnergy * 0.22 + input.directorOutput.centripetalOrbit * 0.1)
        * (0.76 + confidence * 0.24)
    );

    const timeSec = Math.max(0, Number.isFinite(input.timeSec) ? input.timeSec! : 0);
    const phase = wormholeMusicalPhase(timeSec, input.bars ?? [], confidence) * Math.PI * 2;
    const breathing = Math.sin(phase);
    const depthEvolution = 1 + breathing * 0.06;
    const densityEvolution = 1 + Math.sin(phase + 1.9) * 0.08;
    const perspectiveEvolution = 1 + Math.sin(phase * 0.73 + 3.1) * 0.04;

    return {
        travelSpeed,
        depthPulse,
        kickJitter,
        bassWarp,
        densityFill,
        perspectiveCompression,
        breathing,
        depthEvolution,
        densityEvolution,
        perspectiveEvolution
    };
}

function weightedBandMean(values: readonly number[], start: number, end: number, favorLow: boolean): number {
    let sum = 0;
    let weights = 0;
    const safeEnd = Math.min(end, values.length);
    for (let index = start; index < safeEnd; index++) {
        const weight = favorLow ? safeEnd - index : 1;
        sum += clamp01(values[index]) * weight;
        weights += weight;
    }
    return weights > 0 ? sum / weights : 0;
}

function clamp01(value: number): number {
    return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
