import type { MotifChoreographyAction, MotifChoreographyFrame, TransitionPhrase, VisualChoreographyPlan, VisualTuningConfig } from '../types';
import { cloneDefaultVisualTuning, visualTuningKeys } from '../config/visualTuning';
import { resolveSemanticState } from './motifResolver';

type Frame = MotifChoreographyFrame;
interface Segment { sample: Frame; next: Frame; keys: MotifChoreographyAction[] }
const scalars = ['motifIntensity', 'motifDensity', 'motifMotion', 'novelty'] as const;

/** ADR-003 target owner. Compiles only explicitly scored transition pairs; ordinary/legacy
 * frames retain hold semantics. Canonical identity never follows the mutable sampled frame.
 */
export class MotifRuntimeAdapter {
    current: Frame | null = null;
    sampled: Frame | null = null;
    private plan: VisualChoreographyPlan | null = null;
    private frames: Frame[] = [];
    private segments: Array<Segment | null> = [];
    private index = -1;
    private time = NaN;
    private interpolated = false;
    private target: VisualTuningConfig | null = null;
    private readonly base = cloneDefaultVisualTuning();
    private readonly resolved = cloneDefaultVisualTuning();
    private readonly presets: Record<string, Partial<VisualTuningConfig>> = {};
    private readonly owned = new Set<keyof VisualTuningConfig>();

    /** Restore only values still owned by the previous resolution; preserve out-of-band writes. */
    clear(target: VisualTuningConfig, base: Readonly<VisualTuningConfig>): void {
        if (target === this.target) for (const key of this.owned)
            if (target[key] === this.resolved[key]) target[key] = base[key];
        this.target = null; this.owned.clear();
    }

    update(plan: VisualChoreographyPlan | null, time: number, base: Readonly<VisualTuningConfig>, target: VisualTuningConfig): Frame | null {
        const changedPlan = this.plan !== plan;
        if (changedPlan) {
            this.clear(target, base); this.plan = plan;
            this.frames = (plan?.frames ?? []).filter(f => Number.isFinite(f.time)).slice().sort((a, b) => a.time - b.time);
            const transitions = new Map<string, TransitionPhrase | null>();
            for (const transition of plan?.score?.transitions ?? [])
                transitions.set(transition.fromMotifId, transitions.has(transition.fromMotifId) ? null : transition);
            this.segments = this.frames.map((frame, i) => compile(frame, this.frames[i + 1], transitions.get(frame.motifId ?? '')));
            this.index = -1; this.time = NaN; this.interpolated = false;
        }
        let low = 0, high = this.frames.length;
        if (Number.isFinite(time)) while (low < high) {
            const mid = (low + high) >>> 1;
            if (this.frames[mid].time <= time) low = mid + 1; else high = mid;
        }
        const index = Number.isFinite(time) ? low - 1 : -1, current = this.frames[index] ?? null;
        const segment = this.segments[index];
        const interpolated = !!segment && !!current && time > current.time && time < segment.next.time;
        const changedSample = index !== this.index || (interpolated || this.interpolated) && time !== this.time;
        this.current = current; this.sampled = current;
        if (interpolated && segment && current) {
            const amount = (time - current.time) / (segment.next.time - current.time), out = segment.sample;
            for (const key of segment.keys) out.actions[key] = mix(current.actions[key] ?? 0, segment.next.actions[key] ?? 0, amount);
            out.transition!.progress = mix(current.transition!.progress, segment.next.transition!.progress, amount);
            for (const key of scalars) if (Number.isFinite(current[key]) && Number.isFinite(segment.next[key]))
                out[key] = mix(current[key]!, segment.next[key]!, amount);
            this.sampled = out;
        }
        this.index = index; this.time = time; this.interpolated = interpolated;
        if (!plan || !current) { this.clear(target, base); return null; }
        const changedBase = visualTuningKeys.some(key => this.base[key] !== base[key]);
        if (changedPlan || changedSample || changedBase || target !== this.target) {
            this.clear(target, base);
            Object.assign(this.base, base); this.presets['cosmic-wormhole'] = this.base;
            resolveSemanticState(this.sampled, 'cosmic-wormhole', this.presets, this.resolved);
            for (const key of visualTuningKeys) if (this.resolved[key] !== this.base[key]) {
                this.owned.add(key); target[key] = this.resolved[key];
            }
            this.target = target;
        }
        return this.current;
    }
}

function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }
function compile(current: Frame, next: Frame | undefined, span: TransitionPhrase | null | undefined): Segment | null {
    const a = current.transition, b = next?.transition;
    if (!next || !span || !a || !b || !current.motifId || current.motifId !== next.motifId
        || a.behavior !== b.behavior || a.behavior !== span.behavior || a.fromMotif !== b.fromMotif || a.toMotif !== b.toMotif
        || !a.fromMotif || !a.toMotif || !Number.isFinite(span.startTime) || !Number.isFinite(span.duration) || span.duration <= 0
        || current.time < span.startTime || next.time > span.startTime + span.duration || next.time <= current.time
        || !Number.isFinite(a.progress) || !Number.isFinite(b.progress) || a.progress < 0 || b.progress > 1 || b.progress < a.progress
        || !Array.isArray(a.preserve) || !Array.isArray(b.preserve) || a.preserve.join('|') !== b.preserve.join('|')) return null;
    const keys = [...new Set([...Object.keys(current.actions), ...Object.keys(next.actions)])] as MotifChoreographyAction[];
    const actions = Object.fromEntries(keys.map(key => [key, 0]));
    return { sample: { ...current, actions, transition: { ...a } }, next, keys };
}
