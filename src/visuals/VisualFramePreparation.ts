import type { AudioFrame, VisualFeatureFrame, VisualTuningConfig } from '../types';
import type { WormholeRenderState, ResolvedWormholeFrameView } from '../types/WormholeHostFrame';
import type { VisualDirectorFSM } from './VisualDirectorFSM';
import { applyTuningMorph, cloneDefaultVisualTuning, writeModulationBus } from '../config/visualTuning';
import { SemanticTuningProjection } from './SemanticTuningProjection';
import { decayOverSeconds } from './transientDecay';

/** Shared arithmetic, with one instance per host/context. Hosts retain clocks and event ownership. */
export class VisualFramePreparation {
    private readonly projection = new SemanticTuningProjection();
    private readonly semanticTarget = cloneDefaultVisualTuning();
    private readonly semanticBase = cloneDefaultVisualTuning();
    private projecting = false;

    /** Resolve gains once, copying aliased host buffers before resolving a semantic base. */
    beginTuning(visual: VisualTuningConfig, rawTarget: VisualTuningConfig,
        rawBase: (() => Readonly<VisualTuningConfig>) | null, resolve: (raw: VisualTuningConfig) => VisualTuningConfig,
        deltaSec: number, snap = false): VisualTuningConfig {
        let target = resolve(rawTarget);
        this.projecting = rawBase !== null;
        if (rawBase) {
            Object.assign(this.semanticTarget, target);
            Object.assign(this.semanticBase, resolve(rawBase() as VisualTuningConfig));
            target = this.semanticBase;
        }
        this.projection.restore(visual);
        if (snap) Object.assign(visual, target);
        else applyTuningMorph(visual, target, target.transitionSpeed, deltaSec);
        return target;
    }

    /** Finite automation and spiral channels run between begin and finish, in their existing owner. */
    finishTuning(visual: VisualTuningConfig): void {
        if (this.projecting) this.projection.apply(visual, this.semanticBase, this.semanticTarget);
        this.projecting = false;
    }
}

/** Explicit publication/lookahead policies. Clock and presentation ownership stays in adapters. */
export type FramePreparationPolicy = 'host' | 'embedded';

export function publishAnalysisFrame(state: WormholeRenderState, index: number, policy: FramePreparationPolicy): void {
    if (index >= 0 && index < state.frames.length) {
        if (policy === 'embedded') Object.assign(state.currentFrame, state.frames[index]);
        else copyAudioFrame(state.frames[index], state.currentFrame);
    }
    if (index >= 0 && index < state.trackAnalysis.features.length) {
        if (policy === 'embedded') Object.assign(state.currentFeatures, state.trackAnalysis.features[index]);
        else copyVisualFeatures(state.trackAnalysis.features[index], state.currentFeatures);
    }
}

function copyAudioFrame(source: AudioFrame, target: AudioFrame): void {
    target.e = source.e; target.densityProj = source.densityProj;
    target.melodyProj = source.melodyProj; target.fxProj = source.fxProj;
    target.perceptualSpectrum = source.perceptualSpectrum;
    target.subEnergy = source.subEnergy ?? 0; target.bassEnergy = source.bassEnergy ?? 0;
    target.subFlux = source.subFlux ?? 0; target.bassFlux = source.bassFlux ?? 0;
    target.state = source.state; target.eRatio = source.eRatio;
}
function copyVisualFeatures(source: VisualFeatureFrame, target: VisualFeatureFrame): void {
    target.melody = source.melody; target.vocal = source.vocal; target.fx = source.fx;
    target.density = source.density; target.brightness = source.brightness; target.tension = source.tension;
}

export function decayHostAnalysisFrame(state: WormholeRenderState, deltaSec = 1 / 60): void {
    const factor = decayOverSeconds(0.9, deltaSec);
    state.currentFrame.subEnergy = (state.currentFrame.subEnergy ?? 0) * factor;
    state.currentFrame.bassEnergy = (state.currentFrame.bassEnergy ?? 0) * factor;
    state.currentFrame.subFlux = (state.currentFrame.subFlux ?? 0) * factor;
    state.currentFrame.bassFlux = (state.currentFrame.bassFlux ?? 0) * factor;
    state.currentFrame.e *= factor; state.currentFrame.densityProj *= factor;
    state.currentFrame.melodyProj *= factor; state.currentFrame.fxProj *= factor;
    state.currentFrame.perceptualSpectrum = state.currentFrame.perceptualSpectrum.map(value => value * factor);
    state.currentFrame.eRatio *= factor;
    state.currentFeatures.melody *= factor; state.currentFeatures.vocal *= factor;
    state.currentFeatures.fx *= factor; state.currentFeatures.density *= factor;
    state.currentFeatures.brightness *= factor; state.currentFeatures.tension *= factor;
}

/** Bus/director stage only. Publication and transient advancement happen before this call. */
export function prepareFrameSignals(state: WormholeRenderState, director: Pick<VisualDirectorFSM, 'update'>,
    time: number, cueDecay: number, policy: FramePreparationPolicy, active: boolean) {
    writeModulationBus(state.modulation, state.currentFrame, state.currentFeatures, state.beatDecay, cueDecay, state.visualTuning);
    let index = Math.floor(time * state.sampleRate / state.hopSize);
    if (policy === 'embedded') index = Math.max(0, index);
    const buildup = policy === 'host' ? state.trackAnalysis.buildupConfidence[index] || 0 : state.trackAnalysis.buildupConfidence[index] ?? 0;
    const pivot = policy === 'host' ? state.trackAnalysis.spectralPivot[index] || 0 : state.trackAnalysis.spectralPivot[index] ?? 0;
    const anticipation = state.visualTuning.dropAnticipation;
    const futureIndex = Math.floor((time + anticipation) * state.sampleRate / state.hopSize);
    const future = anticipation > 0 && (policy === 'embedded' || active) ? state.frames[futureIndex] : undefined;
    return director.update(time, state.currentFrame, state.currentFeatures, buildup, pivot, state.visualTuning, state.modulation, future);
}

/** Borrowed data until synchronous structured clone. Never a second tuning/preset resolver. */
export function borrowResolvedWormholeFrame(state: WormholeRenderState): ResolvedWormholeFrameView {
    return { version: 1, tuningStage: 'resolved', ownership: 'borrowed-until-clone', values: {
        currentTime: state.currentTime, isExporting: state.isExporting, exportTime: state.exportTime,
        visualTuning: state.visualTuning, targetTuning: state.targetTuning, currentFrame: state.currentFrame,
        currentFeatures: state.currentFeatures, modulation: state.modulation, beatDecay: state.beatDecay,
        denseImpactFlash: state.denseImpactFlash, directorOutput: state.directorOutput,
        activeVisualTransitionId: state.activeVisualTransitionId, spiralTransitionAnchor: state.spiralTransitionAnchor,
        playbackFade: state.playbackFade
    } };
}
