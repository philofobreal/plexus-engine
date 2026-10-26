import type { PerformanceAutomationPlan, VisualTransitionAnchor, VisualTuningConfig } from '../types';
import { cloneDefaultVisualTuning, effectiveWormholeSpiral, normalizeSpiralDirection, tuningMorphAmount } from '../config/visualTuning';
import { automationMorphProgress, automationMorphWindow, type AutomationMorphWindow } from './performanceAutomationRuntime';
import { applyMvpWormholePreset } from './applyMvpWormholePreset';

type SpiralTuning = Pick<VisualTuningConfig, 'wormholeSpiral' | 'wormholeSpiralDirection'>;
type ResolveTuning = (raw: VisualTuningConfig, out: VisualTuningConfig) => VisualTuningConfig;
interface Anchor {
    transition: VisualTransitionAnchor;
    time: number;
    window: AutomationMorphWindow;
    point: import('../types').PerformanceAutomationPoint;
    owned: boolean;
    magnitudeOwned: boolean;
    directionOwned: boolean;
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
        let owned = false, magnitudeOwned = false, directionOwned = false;
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
            if (relevant && Number.isFinite(tuning.wormholeSpiral)) magnitudeOwned = true;
            // A magnitude preset's omitted direction explicitly defaults to Right in the shared
            // merge contract. Acquire that effective endpoint too, rather than flipping at its cue.
            if (point.spiralDirection !== undefined || relevant && (Number.isFinite(tuning.wormholeSpiralDirection) || Number.isFinite(tuning.wormholeSpiral))) directionOwned = true;
            if (point.cuePlacement && owned) this.directional = true;
            if (relevant && (point.spiralDirection !== undefined || normalizeSpiralDirection(tuning.wormholeSpiralDirection) !== 1)) this.directional = true;
            const last = this.anchors.at(-1), window = automationMorphWindow(point, last?.point);
            if (last) sample(last, window.start, previous);
            applyMvpWormholePreset(raw, payload, point);
            resolve(raw, resolved);
            const magnitude = Math.max(0, resolved.wormholeSpiral);
            const signed = effectiveWormholeSpiral(resolved);
            // A track's initial preset is already established at time zero, like source.prepare.
            this.anchors.push({ point, owned, magnitudeOwned, directionOwned, window, time: window.start, transition: Object.freeze({ id: `automation:${point.id}`, time: point.time }),
                startMagnitude: point.time === 0 ? magnitude : previous.wormholeSpiral,
                startSigned: point.time === 0 ? signed : effectiveWormholeSpiral(previous),
                targetMagnitude: magnitude, targetSigned: signed,
                transitionSpeed: resolved.transitionSpeed,
                morphDurationSec: resolved.morphDurationSec, morphCurveValue: resolved.morphCurveValue });
        }
    }

    /** Writes only the two coherent spiral keys, after the host's ordinary tuning morph. */
    apply(time: number, out: SpiralTuning, currentTarget?: SpiralTuning): boolean {
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
        const selected = this.anchors[low - 1];
        // The render window may look ahead, but geometry disturbances retain the current cue token.
        let logical = low - 1;
        while (logical >= 0 && this.anchors[logical].point.time > time) logical--;
        const current = this.anchors[logical];
        if (!selected.point.cuePlacement) sample(selected, time, out); // Exact legacy law.
        else {
            const host = currentTarget ?? out, preroll = time < selected.point.time;
            const amount = automationMorphProgress(selected.point, time, selected.window);
            let startMagnitude = selected.startMagnitude, targetMagnitude = selected.targetMagnitude;
            let startDirection = startMagnitude > 0 ? normalizeSpiralDirection(selected.startSigned / startMagnitude) : 1;
            let targetDirection = targetMagnitude > 0 ? normalizeSpiralDirection(selected.targetSigned / targetMagnitude) : 1;
            if (!selected.magnitudeOwned) startMagnitude = targetMagnitude = host.wormholeSpiral;
            else if (preroll && current && !current.magnitudeOwned) startMagnitude += host.wormholeSpiral - current.targetMagnitude;
            if (!selected.directionOwned) startDirection = targetDirection = host.wormholeSpiralDirection;
            else if (preroll && current && !current.directionOwned) startDirection = host.wormholeSpiralDirection;
            const magnitude = Math.max(0, startMagnitude + (targetMagnitude - startMagnitude) * amount);
            const signed = startMagnitude * startDirection + (targetMagnitude * targetDirection - startMagnitude * startDirection) * amount;
            out.wormholeSpiral = magnitude;
            out.wormholeSpiralDirection = magnitude > 0 ? normalizeSpiralDirection(signed / magnitude) : 1;
        }
        this.transitionAnchor = this.anchors[logical]?.transition ?? null;
        return true;
    }
}

function copyTuning(raw: VisualTuningConfig, out: VisualTuningConfig): VisualTuningConfig { return Object.assign(out, raw); }

function sample(anchor: Anchor, time: number, out: SpiralTuning): void {
    const amount = anchor.point.cuePlacement ? automationMorphProgress(anchor.point, time, anchor.window)
        : tuningMorphAmount(anchor, anchor.transitionSpeed, time - anchor.time);
    const magnitude = anchor.startMagnitude + (anchor.targetMagnitude - anchor.startMagnitude) * amount;
    const signed = anchor.startSigned + (anchor.targetSigned - anchor.startSigned) * amount;
    out.wormholeSpiral = magnitude;
    out.wormholeSpiralDirection = magnitude > 0 ? normalizeSpiralDirection(signed / magnitude) : 1;
}
