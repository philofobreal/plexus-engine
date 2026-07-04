import { State } from '../state/store';
import { clearVisualModeTransition } from '../state/visualModeTransition';
import type { Particle } from './Particle';
import type { RenderTargetCompositor, VisualRendererBackend } from './RendererBackend';
import type { Shockwave } from './Shockwave';
import type { StyleRegistry } from './StyleRegistry';
import type { VisualIdentity, VisualIdentityDrawContext } from './VisualIdentity';

interface MutableDrawContext extends VisualIdentityDrawContext {
    timeSec: number;
    advanceSharedSimulation: boolean;
}

export function computeCrossfadeAlpha(currentTimeSec: number, startTimeSec: number, durationSec: number): number {
    if (currentTimeSec < startTimeSec) return 1;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return 1;
    const progress = Math.max(0, Math.min(1, (currentTimeSec - startTimeSec) / durationSec));
    return progress * progress * (3 - 2 * progress);
}

export class IdentityTransitionController {
    private readonly primaryContext: MutableDrawContext = { timeSec: 0, advanceSharedSimulation: true };
    private readonly secondaryContext: MutableDrawContext = { timeSec: 0, advanceSharedSimulation: false };

    draw(
        timeSec: number,
        backend: VisualRendererBackend,
        compositor: RenderTargetCompositor,
        registry: StyleRegistry,
        particles: Particle[],
        shockwaves: Shockwave[]
    ): void {
        const transition = State.visualModeTransition;
        const incoming = registry.get(State.visualMode);
        this.primaryContext.timeSec = timeSec;
        this.secondaryContext.timeSec = timeSec;

        if (!transition || transition.to !== State.visualMode) {
            this.primaryContext.advanceSharedSimulation = true;
            incoming.draw(backend, particles, shockwaves, this.primaryContext);
            return;
        }

        const alpha = computeCrossfadeAlpha(timeSec, transition.startTimeSec, transition.durationSec);
        if (timeSec < transition.startTimeSec || alpha >= 1) {
            clearVisualModeTransition();
            this.primaryContext.advanceSharedSimulation = true;
            incoming.draw(backend, particles, shockwaves, this.primaryContext);
            return;
        }

        const outgoing = registry.get(transition.from);
        compositor.beginFrame(transition.generation, backend.width, backend.height);
        this.drawParticipants(incoming, outgoing, compositor, particles, shockwaves);
        compositor.composite(alpha);
    }

    private drawParticipants(
        incoming: VisualIdentity,
        outgoing: VisualIdentity,
        compositor: RenderTargetCompositor,
        particles: Particle[],
        shockwaves: Shockwave[]
    ): void {
        const incomingOwnsSimulation = incoming.usesSharedSimulation === true || outgoing.usesSharedSimulation !== true;
        this.primaryContext.advanceSharedSimulation = true;
        this.secondaryContext.advanceSharedSimulation = false;

        if (incomingOwnsSimulation) {
            incoming.draw(compositor.incomingBackend, particles, shockwaves, this.primaryContext);
            outgoing.draw(compositor.outgoingBackend, particles, shockwaves, this.secondaryContext);
        } else {
            outgoing.draw(compositor.outgoingBackend, particles, shockwaves, this.primaryContext);
            incoming.draw(compositor.incomingBackend, particles, shockwaves, this.secondaryContext);
        }
    }
}
