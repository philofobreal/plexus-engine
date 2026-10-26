import { filterForeignIdentityTuningForAutomation } from '../config/identityTuningRegistry';
import type { PerformanceAutomationPlan, PerformanceAutomationPoint, VisualTuningConfig } from '../types';
import { applyTuningMorph, cloneDefaultVisualTuning, visualTuningKeys, visualTuningControls, tuningMorphAmount, mvpSurfaceTuningOverrides, isDiscreteVisualTuningKey } from '../config/visualTuning';
import { applyMvpWormholePreset } from './applyMvpWormholePreset';
import { automationMorphProgress, automationMorphWindow, type AutomationMorphWindow } from './performanceAutomationRuntime';

type Resolve = (raw: VisualTuningConfig, out: VisualTuningConfig) => VisualTuningConfig;
type Key = keyof VisualTuningConfig;
interface Anchor { point: PerformanceAutomationPoint; window: AutomationMorphWindow; start: VisualTuningConfig; target: VisualTuningConfig; raw: VisualTuningConfig; keys: Key[]; owned: ReadonlySet<Key> }
const bounds = new Map(visualTuningControls.map(c => [c.key, c]));
const copy: Resolve = (raw, out) => Object.assign(out, raw);

/** Cached preset-base lane on the existing song clock. Rebuilds only on immutable plan, payload,
 * host policy or seed changes. Semantic/manual deltas are never baked into cached endpoints.
 */
export class AutomationTuningTimeline {
    private generation = 0;
    get revision(): number { return this.generation; }
    private plan: PerformanceAutomationPlan | null = null;
    private policy: unknown;
    private seed: Readonly<VisualTuningConfig> | undefined;
    private surfacePolicy = true;
    private payloads: unknown[] = [];
    private anchors: Anchor[] = [];
    private ordered: PerformanceAutomationPoint[] = [];
    private lastIndex = -1;
    private lastTime = -Infinity;
    private completed = false;
    private readonly sampled = cloneDefaultVisualTuning();

    invalidate(): void { this.generation++; this.plan = null; this.payloads = []; this.anchors = []; this.lastIndex = -1; this.completed = false; }

    configure(plan: PerformanceAutomationPlan | null, preset: (name: string) => unknown, policy: unknown = 0,
        resolve: Resolve = copy, seed?: Readonly<VisualTuningConfig>, surfacePolicy = true): void {
        const points = plan?.points ?? [];
        if (this.plan === plan && this.policy === policy && this.seed === seed && this.surfacePolicy === surfacePolicy
            && points.length === this.payloads.length && points.every((p, i) => preset(p.preset) === this.payloads[i])) return;
        this.generation++;
        this.plan = plan; this.policy = policy; this.seed = seed; this.surfacePolicy = surfacePolicy;
        this.payloads = points.map(p => preset(p.preset)); this.anchors = [];
        this.lastIndex = -1; this.lastTime = -Infinity; this.completed = false;
        if (!points.some(p => p.cuePlacement)) { this.ordered = []; return; }
        const raw = seed ? { ...seed } : cloneDefaultVisualTuning(), owned = new Set<Key>();
        let previous: Anchor | undefined;
        this.ordered = [...points].filter(p => Number.isFinite(p.time) && p.time >= 0).sort((a, b) => a.time - b.time);
        for (const point of this.ordered) {
            if (!Number.isFinite(point.time) || point.time < 0) continue;
            const payload = preset(point.preset);
            // A missing future asset cannot disable the already authoritative prefix.
            if (!payload || typeof payload !== 'object') break;
            const data = filterForeignIdentityTuningForAutomation(payload as { visualMode?: unknown; visualTuning?: object; dramaturgyProfile?: object }, 'cosmic-wormhole');
            const tuning = data.visualTuning && typeof data.visualTuning === 'object' ? data.visualTuning : payload;
            for (const key of visualTuningKeys) if (typeof (tuning as Partial<VisualTuningConfig>)[key] === 'number' && Number.isFinite((tuning as Partial<VisualTuningConfig>)[key])) owned.add(key);
            const aliases = tuning as { particleBassTurn?: number; heroDrumsOnly?: number };
            if (Number.isFinite(aliases.particleBassTurn)) owned.add('particleActivityTurn');
            if (aliases.heroDrumsOnly === 0 || aliases.heroDrumsOnly === 1) owned.add('heroEventMode');
            for (const key of ['wormholeRadiusLfoWaveform','wormholeDepthLfoWaveform'] as const) if (Object.hasOwn(tuning,key)) owned.add(key);
            for (const key of ['audioSensitivity','morphDurationSec','morphCurveValue'] as const) owned.add(key);
            if (point.spiralDirection !== undefined || Object.hasOwn(tuning,'wormholeSpiralDirection')) owned.add('wormholeSpiralDirection');
            if (surfacePolicy) for (const key of Object.keys(mvpSurfaceTuningOverrides) as Key[]) owned.add(key);
            if (data.dramaturgyProfile) for (const key of ['buildupIntensity','dropDampening','breakRestraint','vocalHighlight','fxChaos'] as const)
                if (Object.hasOwn(data.dramaturgyProfile, key)) owned.add(key);
            const start = cloneDefaultVisualTuning(), target = cloneDefaultVisualTuning();
            const window = automationMorphWindow(point, previous?.point);
            if (previous) sample(previous, window.start, start); else resolve(raw, start);
            applyMvpWormholePreset(raw, payload, point, surfacePolicy);
            resolve(raw, target);
            if (point.time === 0) Object.assign(start, target);
            const anchor = { point, window, start, target, raw: { ...raw }, keys: [...owned], owned: new Set(owned) }; this.anchors.push(anchor); previous = anchor;
        }
    }

    private indexAt(time: number, logical = false): number {
        let low = 0, high = this.anchors.length;
        while (low < high) { const mid = (low + high) >>> 1; if ((logical ? this.anchors[mid].point.time : this.anchors[mid].window.start) <= time) low = mid + 1; else high = mid; }
        return low - 1;
    }

    /** Rebase owned preset fields before semantic resolution, including partial-preset inheritance.
     * Unauthored global controls remain host-owned. Only an authoritative current point qualifies.
     */
    applyCanonicalTarget(point: PerformanceAutomationPoint, target: VisualTuningConfig): boolean {
        const anchor = this.anchors[this.indexAt(point.time, true)];
        if (!point.cuePlacement || anchor?.point !== point) return false;
        for (const key of anchor.keys) target[key] = anchor.raw[key];
        return true;
    }

    /** Current target already includes host gains and semantic/manual deltas. The finite base is
     * sampled separately; ordinary smoothing resumes after arrival instead of snapping later deltas.
     */
    apply(time: number, out: VisualTuningConfig, currentTarget: VisualTuningConfig): boolean {
        if (!Number.isFinite(time)) return false;
        const index = this.indexAt(time), anchor = this.anchors[index];
        if (!anchor?.point.cuePlacement) { this.lastIndex = index; this.lastTime = time; this.completed = false; return false; }
        // No inferred current target past a missing predecessor.
        const unresolved = this.ordered[index + 1];
        if (unresolved && time >= unresolved.time) return false;
        const current = this.anchors[this.indexAt(time, true)];
        if (!current) return false;
        const progress = anchor.point.time === 0 ? 1 : automationMorphProgress(anchor.point, time, anchor.window);
        const entering = index !== this.lastIndex || time < this.lastTime;
        this.lastIndex = index; this.lastTime = time;
        if (progress >= 1 && this.completed && !entering) return false;
        this.completed = progress >= 1;
        sample(anchor, time, this.sampled);
        for (const key of anchor.keys) {
            if (key === 'wormholeSpiral' || key === 'wormholeSpiralDirection') continue;
            // Enum/gate publication and semantic identity belong to the actual cue, never look-ahead.
            if (time < anchor.point.time && isDiscreteVisualTuningKey(key)) { out[key] = currentTarget[key]; continue; }
            const inheritedOffset = currentTarget[key] - current.target[key];
            // A newly authored key inherits the player's current value at start, then gives up that
            // inherited offset as the new preset acquires ownership, avoiding a snap at the cue.
            const delta = inheritedOffset * (current.owned.has(key) ? 1 : 1 - progress);
            const value = this.sampled[key] + delta, control = bounds.get(key);
            out[key] = control && delta !== 0 ? Math.max(control.min, Math.min(control.max, value)) : value;
        }
        return true;
    }
}
function sample(anchor: Anchor, time: number, out: VisualTuningConfig): void {
    Object.assign(out, anchor.start);
    const p = anchor.point;
    const amount = p.time === 0 ? 1 : p.cuePlacement ? automationMorphProgress(p, time, anchor.window)
        : tuningMorphAmount(anchor.target, anchor.target.transitionSpeed, time - p.time);
    applyTuningMorph(out, anchor.target, anchor.target.transitionSpeed, 0, amount);
}
