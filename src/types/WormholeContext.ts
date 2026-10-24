import type { VisualTuningConfig } from './index';

/** Construction-time host policy. Raw tuning has never passed through macro/Advanced gains. */
export interface WormholeContextSeed {
    readonly version: 1;
    readonly rawTuning: Readonly<VisualTuningConfig>;
    readonly macros: Readonly<Record<'intensity' | 'motion' | 'depth' | 'detail', number>>;
    readonly boosts: Readonly<Partial<Record<keyof VisualTuningConfig, number>>>;
    readonly policy: {
        /** Studio uses raw controls; MVP/XR apply their own copied macro/Advanced settings once. */
        readonly gains: 'raw' | 'meta';
        readonly semanticResolver: boolean;
        readonly semanticChoreography: boolean;
    };
}
