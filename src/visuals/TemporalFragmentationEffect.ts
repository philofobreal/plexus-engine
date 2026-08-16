import { State } from '../state/store';
import type { PostFxFrameContext, PostFxRenderTarget, PostProcessEffect } from './PostFxTypes';
import {
    createTemporalFragmentationInput,
    createTemporalFragmentationPlan,
    isTemporalFragmentationActive,
    planTemporalFragmentation,
    type TemporalFragmentationInput,
    type TemporalFragmentationPlan
} from './temporalFragmentationPlan';

/**
 * Temporal Fragmentation: the first renderer post effect (ADR-007).
 *
 * It treats the finished identity frame as an image, cuts it into deterministic horizontal bands
 * (optionally only a rectangular horizontal fragment of a band), and displaces a few of them
 * sideways for the length of one dramaturgical accent. It is not a visual identity, it changes no
 * identity geometry, and it owns no musical decision of its own: `glitchIntensity` starts and ends
 * the burst, `spectralChaos` only shapes fragmentation complexity, `rhythmicImpulse` only scales
 * the one-shot displacement.
 *
 * Per moving band the destination rect is cleared and refilled from the snapshot with a same-size
 * source rect at the same Y, plus one wrap copy. That means:
 * - exact pixels and exact alpha, so transparent, chroma-key, and video-backplate output are safe;
 * - no color is ever synthesized, so a chroma plate stays a clean key;
 * - full coverage of the cleared rect, so no hole can appear in either axis.
 */
export class TemporalFragmentationEffect implements PostProcessEffect {
    readonly id = 'fragmentation' as const;

    private readonly plan: TemporalFragmentationPlan = createTemporalFragmentationPlan();
    private readonly input: TemporalFragmentationInput = createTemporalFragmentationInput();

    isActive(_frame: PostFxFrameContext): boolean {
        return isTemporalFragmentationActive(
            State.directorOutput.glitchIntensity,
            State.visualTuning.postFxFragmentAmount
        );
    }

    apply(target: PostFxRenderTarget, snapshot: HTMLCanvasElement, frame: PostFxFrameContext): void {
        const plan = planTemporalFragmentation(this.plan, this.readInput(frame));
        if (!plan.active) return;

        const ctx = target.ctx;
        ctx.save();
        // Device-pixel space: p5 scales the live context by pixel density, and the export target is
        // a different surface again. Neutralizing the transform makes one plan correct for both.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < plan.bandCount; i++) {
            const band = plan.bands[i];
            const wrapOffset = band.shiftX > 0 ? -band.width : band.width;
            ctx.save();
            ctx.beginPath();
            ctx.rect(band.x, band.y, band.width, band.height);
            ctx.clip();
            ctx.clearRect(band.x, band.y, band.width, band.height);
            ctx.drawImage(
                snapshot,
                band.x, band.y, band.width, band.height,
                band.x + band.shiftX, band.y, band.width, band.height
            );
            ctx.drawImage(
                snapshot,
                band.x, band.y, band.width, band.height,
                band.x + band.shiftX + wrapOffset, band.y, band.width, band.height
            );
            ctx.restore();
        }

        ctx.restore();
    }

    private readInput(frame: PostFxFrameContext): TemporalFragmentationInput {
        const input = this.input;
        input.timeSec = frame.timeSec;
        input.widthPx = frame.widthPx;
        input.heightPx = frame.heightPx;
        input.glitchIntensity = State.directorOutput.glitchIntensity;
        input.spectralChaos = State.modulation.spectralChaos;
        input.rhythmicImpulse = State.modulation.rhythmicImpulse;
        input.amount = State.visualTuning.postFxFragmentAmount;
        input.displacement = State.visualTuning.postFxFragmentDisplacement;
        input.density = State.visualTuning.postFxFragmentDensity;
        return input;
    }
}
