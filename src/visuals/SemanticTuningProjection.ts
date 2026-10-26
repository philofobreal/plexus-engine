import type { VisualTuningConfig } from '../types';
import { isDiscreteVisualTuningKey, visualTuningControls, visualTuningKeys } from '../config/visualTuning';

const bounds = new Map(visualTuningControls.map(control => [control.key, control]));

/** Render-only semantic overlay. The host first restores this layer, then morphs/samples its
 * resolved BASE, then applies the current resolved semantic delta exactly once.
 */
export class SemanticTuningProjection {
    private target: VisualTuningConfig | null = null;
    private readonly active = new Uint8Array(visualTuningKeys.length);
    private readonly before = new Float64Array(visualTuningKeys.length);
    private readonly after = new Float64Array(visualTuningKeys.length);

    restore(target: VisualTuningConfig): void {
        for (let i = 0; i < visualTuningKeys.length; i++) {
            const key = visualTuningKeys[i];
            if (this.target === target && this.active[i] && target[key] === this.after[i]) target[key] = this.before[i];
            this.active[i] = 0;
        }
        this.target = target;
    }

    apply(target: VisualTuningConfig, base: Readonly<VisualTuningConfig>, semantic: Readonly<VisualTuningConfig>): void {
        this.target = target;
        for (let i = 0; i < visualTuningKeys.length; i++) {
            const key = visualTuningKeys[i], delta = semantic[key] - base[key];
            if (!Number.isFinite(delta) || delta === 0 || !Number.isFinite(target[key])) continue;
            const control = bounds.get(key), value = isDiscreteVisualTuningKey(key) ? semantic[key] : target[key] + delta;
            this.before[i] = target[key];
            this.after[i] = control ? Math.max(control.min, Math.min(control.max, value)) : value;
            this.active[i] = 1; target[key] = this.after[i];
        }
    }
}
