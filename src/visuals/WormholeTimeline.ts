import type { AudioFrame, BarAnalysis, BeatEvent, VisualFeatureFrame } from '../types';

const REFERENCE_DISTANCE_PER_SEC = 240;
const AUTHORED_SPEED_DISTANCE_PER_SEC = 96;
const SPEED_TIMELINE_CAPACITY = 256;
/** Smaller changes are render/control noise, not authored speed events. */
const AUTHORED_SPEED_QUANTUM = 0.05;

/** Canonical render clock shared by live playback and offline export. */
export function canonicalWormholeTime(currentTime: number, isExporting: boolean, exportTime: number): number {
    const value = isExporting ? exportTime : currentTime;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Timestamp-derived kick envelope. High-only transients never qualify. */
export function wormholeKickEnvelopeAtTime(
    events: readonly BeatEvent[],
    frames: readonly AudioFrame[],
    timeSec: number,
    sampleRate: number,
    hopSize: number
): number {
    let low = 0;
    let high = events.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (events[middle].time <= timeSec) low = middle + 1;
        else high = middle;
    }
    for (let index = low - 1; index >= 0; index--) {
        const event = events[index];
        const age = timeSec - event.time;
        if (age < 0) continue;
        if (age > 0.3) break;
        if (event.type === 3) continue;
        const frameIndex = Math.max(0, Math.min(frames.length - 1, Math.round(event.time * sampleRate / Math.max(1, hopSize))));
        const spectrum = frames[frameIndex]?.perceptualSpectrum ?? [];
        const lowSupport = weightedLowSupport(spectrum);
        if (lowSupport < 0.12) continue;
        const decay = Math.exp(-age / 0.085);
        return clamp01(event.intensity * lowSupport * decay * 2.4);
    }
    return 0;
}

export interface WormholeLowDropEvent {
    id: number;
    ageSec: number;
    envelope: number;
    variant: number;
}

/** Reconstructs the current LOW_DROP event from immutable analysis frames. */
export function wormholeLowDropAtTime(
    frames: readonly AudioFrame[],
    timeSec: number,
    sampleRate: number,
    hopSize: number
): WormholeLowDropEvent | null {
    if (frames.length === 0) return null;
    const hopsPerSecond = sampleRate / Math.max(1, hopSize);
    let frameIndex = Math.max(0, Math.min(frames.length - 1, Math.floor(timeSec * hopsPerSecond)));
    if (frames[frameIndex]?.state !== 'LOW_DROP') return null;
    while (frameIndex > 0 && frames[frameIndex - 1]?.state === 'LOW_DROP') frameIndex--;
    const eventTime = frameIndex / hopsPerSecond;
    const ageSec = Math.max(0, timeSec - eventTime);
    if (ageSec > 2) return null;
    const attack = Math.min(1, ageSec / 0.08);
    const release = Math.exp(-ageSec / 0.62);
    return {
        id: frameIndex,
        ageSec,
        envelope: clamp01(attack * release),
        variant: deterministicVariant(frameIndex, 6)
    };
}

/** Stable hash selection for the six local LOW_DROP behaviours. */
export function deterministicVariant(eventId: number, count: number): number {
    const safeCount = Math.max(1, Math.floor(count));
    let hash = (eventId | 0) ^ 0x9e3779b9;
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash = (hash ^ (hash >>> 16)) >>> 0;
    return hash % safeCount;
}

/**
 * Fixed-hop travel integrator. Its prefix table is rebuilt only when analysis identity changes;
 * render history and frame rate cannot affect the resulting coordinate.
 */
export class WormholeTransport {
    private frames: readonly AudioFrame[] | null = null;
    private events: readonly BeatEvent[] | null = null;
    private features: readonly VisualFeatureFrame[] | null = null;
    private sampleRate = 1;
    private hopSize = 1;
    private bpm = 120;
    private timingConfidence = 1;
    private prefix = new Float64Array(1);

    sync(
        frames: readonly AudioFrame[],
        sampleRate: number,
        hopSize: number,
        events: readonly BeatEvent[] = [],
        features: readonly VisualFeatureFrame[] = [],
        bpm = 120,
        timingConfidence = 1
    ): boolean {
        const safeRate = Math.max(1, finiteOr(sampleRate, 1));
        const safeHop = Math.max(1, finiteOr(hopSize, 1));
        const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
        const safeConfidence = clamp01(timingConfidence);
        if (this.frames === frames && this.events === events && this.features === features
            && this.sampleRate === safeRate && this.hopSize === safeHop
            && this.bpm === safeBpm && this.timingConfidence === safeConfidence) return false;
        this.frames = frames;
        this.events = events;
        this.features = features;
        this.sampleRate = safeRate;
        this.hopSize = safeHop;
        this.bpm = safeBpm;
        this.timingConfidence = safeConfidence;
        this.prefix = new Float64Array(frames.length + 1);
        const hopSec = safeHop / safeRate;
        for (let index = 0; index < frames.length; index++) {
            const timeSec = index * hopSec;
            const kickEnvelope = wormholeKickEnvelopeAtTime(events, frames, timeSec, safeRate, safeHop);
            const motionSpeed = canonicalWormholeTravelSpeed(
                frames[index],
                features[index],
                safeBpm,
                safeConfidence,
                kickEnvelope
            );
            this.prefix[index + 1] = this.prefix[index]
                + travelRate(frames[index]) * motionSpeed * REFERENCE_DISTANCE_PER_SEC * hopSec;
        }
        return true;
    }

    distanceAt(timeSec: number): number {
        if (!this.frames || this.frames.length === 0) return Math.max(0, finiteOr(timeSec, 0)) * REFERENCE_DISTANCE_PER_SEC;
        const position = Math.max(0, finiteOr(timeSec, 0)) * this.sampleRate / this.hopSize;
        const frameCount = this.frames.length;
        if (position >= frameCount) {
            // Beyond the analyzed range the LUT has no more hops to look up. Extrapolate at the
            // last known hop rate instead of freezing, so travel never stalls at track end/export tail.
            const hopSec = this.hopSize / this.sampleRate;
            const lastHopRate = (this.prefix[frameCount] - this.prefix[frameCount - 1]) / hopSec;
            return this.prefix[frameCount] + lastHopRate * (position - frameCount) * hopSec;
        }
        const index = Math.floor(position);
        const fraction = clamp01(position - index);
        return this.prefix[index] + (this.prefix[index + 1] - this.prefix[index]) * fraction;
    }

    /** Local slope of the prefix LUT at `timeSec` -- the instantaneous canonical distance rate. */
    rateAt(timeSec: number): number {
        if (!this.frames || this.frames.length === 0) return REFERENCE_DISTANCE_PER_SEC;
        const hopSec = this.hopSize / this.sampleRate;
        const position = Math.max(0, finiteOr(timeSec, 0)) * this.sampleRate / this.hopSize;
        const frameCount = this.frames.length;
        if (position >= frameCount) {
            // Same last-hop extrapolation rate `distanceAt` falls back to beyond the analyzed range.
            return (this.prefix[frameCount] - this.prefix[frameCount - 1]) / hopSec;
        }
        const index = Math.floor(position);
        return (this.prefix[index + 1] - this.prefix[index]) / hopSec;
    }
}

/** Shared pure travel-speed model used by both the motion profile and fixed-hop transport. */
export function canonicalWormholeTravelSpeed(
    frame: AudioFrame,
    features: VisualFeatureFrame | undefined,
    bpm: number,
    timingConfidence: number,
    kickEnvelope = 0
): number {
    const frameEnergy = clamp01(frame.eRatio * 0.62 + frame.e * 0.38);
    const featureDensity = clamp01(features?.density ?? frame.densityProj);
    const stateEnergy = frame.state === 'HIGH' ? 1 : frame.state === 'LOW_DROP' ? 0.58 : frame.state === 'LOW' ? 0.28 : 0.12;
    const density = clamp01(frame.densityProj * 0.6 + featureDensity * 0.4);
    const lowSupport = weightedLowSupport(frame.perceptualSpectrum ?? []);
    const depthPulse = clamp01(kickEnvelope * lowSupport);
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    const tempoScale = clamp(Math.sqrt(safeBpm / 120), 0.72, 1.38);
    const confidence = clamp01(timingConfidence);
    const trustedTempoScale = 1 + (tempoScale - 1) * (0.35 + confidence * 0.65);
    const movementEnergy = clamp01(frameEnergy * 0.48 + stateEnergy * 0.32 + density * 0.2);
    return clamp(
        trustedTempoScale * (0.62 + movementEnergy * 0.58 + depthPulse * 0.22) * (0.82 + confidence * 0.18),
        0.48,
        1.72
    );
}

/**
 * Bounded authored-speed timeline. Target changes create song-time anchors whose
 * distance is continuous; a speed change therefore affects only future travel.
 * Smoothstep integration is analytic, so render FPS does not affect the result.
 */
export class WormholeAuthoredSpeedTimeline {
    private readonly times = new Float64Array(SPEED_TIMELINE_CAPACITY);
    private readonly offsets = new Float64Array(SPEED_TIMELINE_CAPACITY);
    private readonly startSpeeds = new Float64Array(SPEED_TIMELINE_CAPACITY);
    private readonly targetSpeeds = new Float64Array(SPEED_TIMELINE_CAPACITY);
    private readonly durations = new Float64Array(SPEED_TIMELINE_CAPACITY);
    private count = 0;

    reset(timeSec: number, speed: number): void {
        const time = safeTime(timeSec);
        const value = quantizedSpeed(speed);
        this.count = 1;
        this.times[0] = time;
        this.offsets[0] = 0;
        this.startSpeeds[0] = value;
        this.targetSpeeds[0] = value;
        this.durations[0] = 0.2;
    }

    offsetAt(timeSec: number, targetSpeed: number, durationSec: number): number {
        const time = safeTime(timeSec);
        const requestedTarget = safeSpeed(targetSpeed);
        const duration = Math.max(0.2, finiteOr(durationSec, 0.2));
        if (this.count === 0) this.reset(time, requestedTarget);
        if (time < this.times[0]) {
            this.reset(time, requestedTarget);
            return 0;
        }

        let segment = this.segmentAt(time);
        if (time < this.times[this.count - 1]) this.count = segment + 1;

        const previousTarget = this.targetSpeeds[segment];
        // Quantization bounds the total number of possible anchors; the full-quantum hysteresis
        // prevents values oscillating around a bin boundary from flipping anchors every frame.
        const target = Math.abs(requestedTarget - previousTarget) < AUTHORED_SPEED_QUANTUM
            ? previousTarget
            : quantizedSpeed(requestedTarget);
        if (Math.abs(target - previousTarget) >= AUTHORED_SPEED_QUANTUM - 1e-9) {
            const offset = this.offsetForSegment(segment, time);
            const speed = this.speedForSegment(segment, time);
            segment = this.appendAnchor(time, offset, speed, target, duration);
        }
        return this.offsetForSegment(segment, time);
    }

    /** Read-only instrumentation used by determinism/anchor-spam regressions. */
    anchorCount(): number {
        return this.count;
    }

    /**
     * Instantaneous authored-offset rate at `timeSec`: purely reads the current segment's
     * smoothstep speed, never creates an anchor or mutates state.
     */
    rateAt(timeSec: number): number {
        if (this.count === 0) return 0;
        const time = safeTime(timeSec);
        const segment = this.segmentAt(time);
        return (this.speedForSegment(segment, time) - 1) * AUTHORED_SPEED_DISTANCE_PER_SEC;
    }

    private appendAnchor(time: number, offset: number, startSpeed: number, targetSpeed: number, duration: number): number {
        let index = this.count;
        if (index > 0 && Math.abs(time - this.times[index - 1]) <= 1e-9) index--;
        else if (index < SPEED_TIMELINE_CAPACITY) this.count++;
        else index = SPEED_TIMELINE_CAPACITY - 1;
        this.times[index] = time;
        this.offsets[index] = offset;
        this.startSpeeds[index] = startSpeed;
        this.targetSpeeds[index] = targetSpeed;
        this.durations[index] = duration;
        return index;
    }

    private segmentAt(time: number): number {
        let low = 0;
        let high = this.count;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (this.times[middle] <= time) low = middle + 1;
            else high = middle;
        }
        return Math.max(0, low - 1);
    }

    private offsetForSegment(index: number, time: number): number {
        const elapsed = Math.max(0, time - this.times[index]);
        const speedIntegral = integratedSmoothSpeed(
            elapsed,
            this.startSpeeds[index],
            this.targetSpeeds[index],
            this.durations[index]
        );
        return this.offsets[index] + (speedIntegral - elapsed) * AUTHORED_SPEED_DISTANCE_PER_SEC;
    }

    private speedForSegment(index: number, time: number): number {
        const duration = this.durations[index];
        const progress = clamp01((time - this.times[index]) / duration);
        const mix = progress * progress * (3 - 2 * progress);
        return this.startSpeeds[index] + (this.targetSpeeds[index] - this.startSpeeds[index]) * mix;
    }
}

function integratedSmoothSpeed(elapsed: number, start: number, target: number, duration: number): number {
    if (elapsed >= duration) return duration * (start + target) * 0.5 + (elapsed - duration) * target;
    const progress = elapsed / duration;
    const integratedMix = progress * progress * progress - 0.5 * progress * progress * progress * progress;
    return start * elapsed + (target - start) * duration * integratedMix;
}

function safeTime(value: number): number {
    return Math.max(0, finiteOr(value, 0));
}

function safeSpeed(value: number): number {
    return Math.min(10, Math.max(0.1, finiteOr(value, 1)));
}

function quantizedSpeed(value: number): number {
    return safeSpeed(Math.round(safeSpeed(value) / AUTHORED_SPEED_QUANTUM) * AUTHORED_SPEED_QUANTUM);
}

export function wormholeMusicalPhase(timeSec: number, bars: readonly BarAnalysis[], confidence: number): number {
    if (confidence >= 0.55 && bars.length > 0) {
        let active = bars[0];
        for (let index = 1; index < bars.length && bars[index].start <= timeSec; index++) active = bars[index];
        const progress = clamp01((timeSec - active.start) / Math.max(0.001, active.end - active.start));
        return ((active.index % 6) + progress) / 6;
    }
    // Incommensurate seeded periods avoid a guessed beat grid at low confidence.
    return wrap01(timeSec / 13 + Math.sin(timeSec * Math.PI * 2 / 19) * 0.07);
}

function travelRate(frame: AudioFrame | undefined): number {
    if (!frame) return 1;
    const stateScale = frame.state === 'HIGH' ? 1.2 : frame.state === 'LOW_DROP' ? 0.72 : frame.state === 'LOW' ? 0.84 : 0.65;
    return stateScale * (0.72 + clamp01(frame.eRatio * 0.62 + frame.e * 0.38) * 0.56);
}

function weightedLowSupport(spectrum: readonly number[]): number {
    let sum = 0;
    let weights = 0;
    for (let index = 0; index < Math.min(8, spectrum.length); index++) {
        const weight = 8 - index;
        sum += clamp01(spectrum[index]) * weight;
        weights += weight;
    }
    return weights > 0 ? sum / weights : 0;
}

function wrap01(value: number): number {
    return ((value % 1) + 1) % 1;
}

function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
