import { defaultVisualTuning, visualTuningControls, type VisualTuningKey } from '../config/visualTuning';
import type { VisualTuningConfig } from '../types';
import { SemanticResolver } from './SemanticResolver';

export const ALLOWED_TUNING_KEYS: ReadonlySet<VisualTuningKey> = new Set(
    Object.keys(defaultVisualTuning) as VisualTuningKey[]
);

const CONTROL_BOUNDS: ReadonlyMap<VisualTuningKey, { min: number; max: number }> = new Map(
    visualTuningControls.map(control => [control.key, { min: control.min, max: control.max }])
);

/** The only ADR-004 runtime boundary allowed to mutate targetTuning. */
export class SemanticRuntimeAdapter {
    private readonly resolver: SemanticResolver;
    private readonly baseProvider?: () => VisualTuningConfig | null;
    private fallbackBase: VisualTuningConfig | null = null;
    private readonly ownedKeys = new Set<VisualTuningKey>();

    constructor(resolver: SemanticResolver, baseProvider?: () => VisualTuningConfig | null) {
        this.resolver = resolver;
        this.baseProvider = baseProvider;
    }

    setBaseTuning(base: VisualTuningConfig): void {
        this.fallbackBase = { ...base };
    }

    ensureBaseTuning(base: VisualTuningConfig): void {
        if (!this.fallbackBase) this.setBaseTuning(base);
    }

    hasPlan(): boolean {
        return this.resolver.hasPlan();
    }

    update(timeSec: number, targetTuning: VisualTuningConfig): void {
        const result = this.resolver.resolve(timeSec);
        this.ensureBaseTuning(targetTuning);
        const base = this.baseProvider?.() ?? this.fallbackBase;
        if (!base) return;

        const deltas = result?.tuningDeltas ?? {};
        for (const [rawKey, candidate] of Object.entries(deltas)) {
            const key = rawKey as VisualTuningKey;
            if (!ALLOWED_TUNING_KEYS.has(key) || typeof candidate !== 'number' || !Number.isFinite(candidate)) continue;
            this.ownedKeys.add(key);
        }

        for (const key of this.ownedKeys) {
            const bounds = CONTROL_BOUNDS.get(key);
            if (!bounds) continue;
            const baseValue = Number.isFinite(base[key]) ? base[key] : bounds.min;
            const candidate = deltas[key];
            const delta = typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
            const rawValue = baseValue + delta;
            targetTuning[key] = Math.max(bounds.min, Math.min(bounds.max, rawValue));
        }

        if (!this.resolver.hasPlan()) this.ownedKeys.clear();
    }
}
