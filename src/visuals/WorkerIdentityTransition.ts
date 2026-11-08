import type { VisualModeTransition } from '../types';
import type { WormholeHostFrame, WormholeHostRasterSource, WormholeHostTarget, WormholeRenderState } from '../types/WormholeHostFrame';
import type { MusicDisplaySettings } from '../types/MusicDisplay';
import type { RenderTargetCompositor } from './RendererBackend';
import type { VisualIdentity } from './VisualIdentity';
import type { IdentityDraw } from './IdentityTransitionController';
import { computeCrossfadeAlpha } from './IdentityTransitionController';
import type { Particle } from './Particle';
import type { Shockwave } from './Shockwave';

export interface PairedTransitionCompositor extends RenderTargetCompositor {
    beginPairedFrame(width: number, height: number): void;
    freezePairedCounterpart(): void;
    compositePaired(alpha: number, image: CanvasImageSource, wormholeIncoming: boolean): void;
}
interface PairInput {
    time: number; transition: VisualModeTransition; state: WormholeRenderState;
    incoming: VisualIdentity; outgoing: VisualIdentity;
    compositor: PairedTransitionCompositor;
    target: Omit<WormholeHostTarget, 'presentRaster' | 'background'>;
    source: WormholeHostRasterSource; depthCue: number; transparent: boolean; playing: boolean;
    musicDisplay?: MusicDisplaySettings; revision: string;
    particles: Particle[]; shockwaves: Shockwave[]; drawIdentity: IdentityDraw;
}
export interface PairedTransitionResult {
    readonly handled: boolean;
    readonly advanced: boolean;
    readonly frame: Readonly<WormholeHostFrame> | null;
}

/** One admitted counterpart image uses the compositor's existing frozen target. Its second
 * target continues native simulation at host cadence. Nothing touches the main canvas until
 * the matching worker image arrives; PostFX may run only on that completed pair.
 * Transition creation/completion and every clock remain owned by the host/controller.
 */
export class WorkerIdentityTransition {
    private key = '';
    private captured: Readonly<WormholeHostFrame> | null = null;
    private presented: Readonly<WormholeHostFrame> | null = null;
    private image: CanvasImageSource | null = null;
    private readonly result = { handled: false, advanced: false, frame: null as Readonly<WormholeHostFrame> | null };
    reset(): void { this.key = ''; this.captured = null; this.presented = null; this.image = null; }

    draw(input: PairInput): PairedTransitionResult {
        const r = this.result; r.handled = false; r.advanced = false; r.frame = null;
        if (!input.source.acknowledgePresented) return r;
        const key = `transition:${input.transition.generation}`;
        if (this.key !== key) { this.reset(); this.key = key; }
        this.image = null;
        const wormholeIncoming = input.incoming.id === 'cosmic-wormhole';
        const other = wormholeIncoming ? input.outgoing : input.incoming;
        input.compositor.beginPairedFrame(input.target.width, input.target.height);
        const advance = !wormholeIncoming || other.usesSharedSimulation === true;
        let drawn = false;
        const drawOther = () => {
            if (drawn) return;
            drawn = true;
            r.advanced = advance;
            input.drawIdentity(other, input.compositor.incomingBackend, input.particles, input.shockwaves,
                { timeSec: input.time, advanceSharedSimulation: advance });
        };
        r.handled = input.source.draw(input.state, {
            ...input.target, presentRaster: image => { this.image = image; }, background() {}
        }, input.depthCue, input.transparent, input.playing, input.musicDisplay, {
            key, revision: input.revision,
            capture: frame => {
                drawOther(); input.compositor.freezePairedCounterpart(); this.captured = frame;
            }
        });
        if (!r.handled) return r;
        drawOther(); // Native pools still advance once on host frames while the worker is busy.
        const frame = input.source.presentedFrame;
        if (this.image && frame && frame === this.captured && frame !== this.presented) {
            const alpha = computeCrossfadeAlpha(frame.currentTime, input.transition.startTimeSec, input.transition.durationSec);
            input.compositor.compositePaired(alpha, this.image, wormholeIncoming);
            this.presented = frame; r.frame = frame;
            input.source.acknowledgePresented(frame);
        }
        this.image = null; // The image is borrowed from the source for this synchronous call only.
        return r;
    }
}
