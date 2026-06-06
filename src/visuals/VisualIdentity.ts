import type { VisualRendererBackend } from './RendererBackend';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';

export interface VisualIdentity {
    readonly id: string;
    readonly name: string;
    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]): void;
}
