import type { VisualRendererBackend } from './RendererBackend';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';

export interface VisualIdentityDrawContext {
    readonly timeSec: number;
    readonly advanceSharedSimulation: boolean;
}

export interface VisualIdentity {
    readonly id: string;
    readonly name: string;
    readonly usesSharedSimulation?: boolean;
    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[], context?: VisualIdentityDrawContext): void;
    syncPosition?(timeSec: number): void;
}
