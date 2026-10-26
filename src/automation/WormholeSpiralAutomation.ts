import type { PerformanceAutomationPlan, VisualTransitionAnchor, VisualTuningConfig } from '../types';
import { cloneDefaultVisualTuning, effectiveWormholeSpiral, normalizeSpiralDirection, tuningMorphAmount } from '../config/visualTuning';
import { automationMorphProgress } from './performanceAutomationRuntime';
import { applyMvpWormholePreset } from './applyMvpWormholePreset';

type SpiralTuning = Pick<VisualTuningConfig, 'wormholeSpiral' | 'wormholeSpiralDirection'>;
type ResolveTuning = (raw: VisualTuningConfig, out: VisualTuningConfig) => VisualTuningConfig;
interface Anchor {
    transition: VisualTransitionAnchor;
    time: number;
    point: import('../types').PerformanceAutomationPoint;
    owned: boolean;
    startMagnitude: number;
    startSigned: number;
    targetMagnitude: number;
    targetSigned: number;
    transitionSpeed: number;
    morphDurationSec: number;
    morphCurveValue: number;
}

/**
 * The signed spiral channel of an already published plan, not another planner or clock.
 * Prepare absolute anchors only when the immutable plan view, preset publication or host gains
 * change. Sampling is O(log points), allocation-free and independent of render/seek history.
 * Legacy all-right plans keep the existing tuning path byte-for-byte; only directional plans
 * use this channel. Other tuning, director, events, route and material gates retain their owners.
 */
export class WormholeSpiralAutomation {
    private plan: PerformanceAutomationPlan | null = null;
    private policy: unknown;
    private seed: Readonly<VisualTuningConfig> | undefined;
    private payloads: unknown[] = [];
    private anchors: Anchor[] = [];
    private ordered: import('../types').PerformanceAutomationPoint[] = [];
    private directional = false;
    /** The last applied sample's authored transition origin; immutable until anchors are rebuilt. */
    transitionAnchor: VisualTransitionAnchor | null = null;

    invalidate(): void { this.plan = null; this.payloads = []; this.anchors = []; this.directional = false; this.transitionAnchor = null; }

    configure(plan: PerformanceAutomationPlan | null, preset: (name: string) => unknown,
        policy: unknown = 0, resolve: ResolveTuning = copyTuning, seed?: Readonly<VisualTuningConfig>): void {
        const points = plan?.points ?? [];
        if (this.plan === plan && this.policy === policy && this.seed === seed && points.length === this.payloads.length
            && points.every((point, i) => preset(point.preset) === this.payloads[i])) return;
        this.plan = plan; this.policy = policy; this.seed = seed;
        this.payloads = points.map(point => preset(point.preset));
        this.anchors = []; this.directional = false; this.transitionAnchor = null;
        // A partially preloaded plan has no authoritative timeline. Retry when a payload arrives.
        if (!points.length) return;
        const raw = seed ? { ...seed } : cloneDefaultVisualTuning(), resolved = cloneDefaultVisualTuning();
        const previous: SpiralTuning = { wormholeSpiral: 0, wormholeSpiralDirection: 1 };
        resolve(raw, resolved);
        previous.wormholeSpiral = resolved.wormholeSpiral;
        previous.wormholeSpiralDirection = resolved.wormholeSpiralDirection;
        let owned = false;
        this.ordered = [...points].filter(p => Number.isFinite(p.time) && p.time >= 0).sort((a,b) => a.time - b.time);
        for (const point of this.ordered) {
            if (!Number.isFinite(point.time) || point.time < 0) continue;
            const asset = preset(point.preset);
            if (!asset || typeof asset !== 'object') break;
            const payload = asset as { visualMode?: unknown; visualTuning?: unknown; wormholeSpiral?: unknown; wormholeSpiralDirection?: unknown };
            const tuning = payload.visualTuning && typeof payload.visualTuning === 'object'
                ? payload.visualTuning as Partial<VisualTuningConfig> : payload;
            const relevant = typeof payload.visualMode !== 'string' || payload.visualMode === 'cosmic-wormhole';
            if (point.spiralDirection !== undefined || relevant && (typeof tuning.wormholeSpiral === 'number' || typeof tuning.wormholeSpiralDirection === 'number')) owned = true;
            if (point.cuePlacement && owned) this.directional = true;
            if (relevant && (point.spiralDirection !== undefined || normalizeSpiralDirection(tuning.wormholeSpiralDirection) !== 1)) this.directional = true;
            const last = this.anchors.at(-1);
            if (last) sample(last, point.time, previous);
            applyMvpWormholePreset(raw, payload, point);
            resolve(raw, resolved);
            const magnitude = Math.max(0, resolved.wormholeSpiral);
            const signed = effectiveWormholeSpiral(resolved);
            // A track's initial preset is already established at time zero, like source.prepare.
            this.anchors.push({ point, owned, time: point.time, transition: Object.freeze({ id: `automation:${point.id}`, time: point.time }),
                startMagnitude: point.time === 0 ? magnitude : previous.wormholeSpiral,
                startSigned: point.time === 0 ? signed : effectiveWormholeSpiral(previous),
                targetMagnitude: magnitude, targetSigned: signed,
                transitionSpeed: resolved.transitionSpeed,
                morphDurationSec: resolved.morphDurationSec, morphCurveValue: resolved.morphCurveValue });
        }
    }

    /** Writes only the two coherent spiral keys, after the host's ordinary tuning morph. */
    apply(time: number, out: SpiralTuning): boolean {
        this.transitionAnchor = null;
        if (!this.directional || !Number.isFinite(time)) return false;
        let low = 0, high = this.anchors.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (this.anchors[middle].time <= time) low = middle + 1; else high = middle;
        }
        if (low === 0) return false;
        const next = this.ordered[low];
        if (next && time >= next.time) return false;
        if (this.anchors[low - 1].point.cuePlacement && !this.anchors[low - 1].owned) return false;
        sample(this.anchors[low - 1], time, out);
        this.transitionAnchor = this.anchors[low - 1].transition;
        return true;
    }
}

function copyTuning(raw: VisualTuningConfig, out: VisualTuningConfig): VisualTuningConfig { return Object.assign(out, raw); }

function sample(anchor: Anchor, time: number, out: SpiralTuning): void {
    const amount = anchor.point.cuePlacement ? automationMorphProgress(anchor.point, time)
        : tuningMorphAmount(anchor, anchor.transitionSpeed, time - anchor.time);
    const magnitude = anchor.startMagnitude + (anchor.targetMagnitude - anchor.startMagnitude) * amount;
    const signed = anchor.startSigned + (anchor.targetSigned - anchor.startSigned) * amount;
    out.wormholeSpiral = magnitude;
    out.wormholeSpiralDirection = magnitude > 0 ? normalizeSpiralDirection(signed / magnitude) : 1;
}
