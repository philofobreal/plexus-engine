import type { MotifChoreographyFrame, VisualChoreographyPlan, VisualMode, VisualTuningConfig, VisualTransitionAnchor } from '../types';
import type { WormholeRenderState } from '../types/WormholeHostFrame';
import { MotifRuntimeAdapter, resolveSemanticState } from '../semantics';
import { cloneDefaultVisualTuning } from '../config/visualTuning';
import { motifTransitionId } from './VisualTransitionIdentity';
import { VisualFramePreparation } from './VisualFramePreparation';

export interface HostSemanticPreparationPort {
    hasPlan(): boolean;
    getBaseTuning(): Readonly<VisualTuningConfig> | null;
    restoreBaseTuning(target: VisualTuningConfig): void;
    updateSemantic(time: number, target: VisualTuningConfig): string | null;
}
export interface HostTuningPreparationPort {
    getTuningForMorph?(raw: VisualTuningConfig): VisualTuningConfig;
    applyAutomatedTuning?(time: number, out: VisualTuningConfig, target: VisualTuningConfig): boolean;
    applyAutomatedSpiral?(time: number, out: VisualTuningConfig, target?: VisualTuningConfig): VisualTransitionAnchor | null;
}
export type HostPreparationState = WormholeRenderState & {
    visualMode: VisualMode; visualChoreography: VisualChoreographyPlan | null;
    semanticBaseTuning: VisualTuningConfig | null; currentChoreography: MotifChoreographyFrame | null;
};

/** Host data preparation extracted from p5. No clocks, DOM, global State, GPU or analysis. */
export class HostVisualFramePreparation {
    private choreoCursor = 0;
    private lastChoreoTime = -1;
    private lastResolvedChoreography: MotifChoreographyFrame | null = null;
    private lastResolvedStyle: VisualMode | null = null;
    private lastResolvedBase: VisualTuningConfig | null = null;
    private lastChoreoPlanRef: VisualChoreographyPlan | null = null;
    private readonly motifRuntime = new MotifRuntimeAdapter();
    private readonly defaultSemanticBase = cloneDefaultVisualTuning();
    private readonly frame = new VisualFramePreparation();
    private readonly host: HostTuningPreparationPort;
    private readonly bridge: HostSemanticPreparationPort;
    private readonly transition: (component: 'motif' | 'semantic-score', id: string | null) => void;
    private state!: HostPreparationState;
    private timeBased = false;
    private readonly resolve = (raw: VisualTuningConfig) => this.host.getTuningForMorph ? this.host.getTuningForMorph(raw) : raw;
    private readonly semanticBase = () => this.timeBased
        ? this.bridge.getBaseTuning() ?? this.state.semanticBaseTuning ?? this.defaultSemanticBase
        : this.state.semanticBaseTuning ?? this.defaultSemanticBase;

    constructor(host: HostTuningPreparationPort, bridge: HostSemanticPreparationPort,
        transition: (component: 'motif' | 'semantic-score', id: string | null) => void) {
        this.host = host; this.bridge = bridge; this.transition = transition;
    }
    prepareTuning(state: HostPreparationState, flags: Readonly<{semanticChoreography: boolean; semanticResolver: boolean}>, ct: number, tuningDeltaSec: number): void {
        const hasTimeBasedSemanticPlan = this.bridge.hasPlan();
        const isTimeBasedSemanticActive = flags.semanticChoreography && hasTimeBasedSemanticPlan;
        if (state.visualMode === 'cosmic-wormhole') this.bridge.restoreBaseTuning(state.targetTuning);
        if (isTimeBasedSemanticActive || !flags.semanticResolver || !state.visualChoreography || state.visualMode !== 'cosmic-wormhole')
            this.motifRuntime.clear(state.targetTuning, state.semanticBaseTuning ?? this.defaultSemanticBase);
        if (flags.semanticChoreography) {
            const semanticTransitionId = this.bridge.updateSemantic(ct, state.targetTuning);
            this.transition(
                'semantic-score',
                isTimeBasedSemanticActive ? semanticTransitionId : null
            );
        } else {
            this.transition('semantic-score', null);
        }

        // Semantic dramaturgy layer (ADR-003): when enabled, the resolved choreography
        // owns targetTuning (the slow param channel). The VisualDirectorFSM and the
        // modulation bus below are untouched — they remain the fast audio-reactive channel.
        if (!isTimeBasedSemanticActive && flags.semanticResolver && state.visualChoreography) {
            if (state.visualMode === 'cosmic-wormhole') {
                const activeFrame = this.motifRuntime.update(state.visualChoreography, ct, state.semanticBaseTuning ?? this.defaultSemanticBase, state.targetTuning);
                state.currentChoreography = activeFrame;
                if (activeFrame !== this.lastResolvedChoreography) this.transition('motif', motifTransitionId(activeFrame));
                this.lastResolvedChoreography = activeFrame;
                this.lastResolvedStyle = state.visualMode; this.lastResolvedBase = state.semanticBaseTuning;
            } else {
                // A recompute / dramaturgy load swaps the plan object: the old cursor and memo now
                // index a stale frames array (wrong slice, or out of bounds). Reset everything.
                if (state.visualChoreography !== this.lastChoreoPlanRef) {
                    this.lastChoreoPlanRef = state.visualChoreography;
                    this.choreoCursor = 0;
                    this.lastChoreoTime = -1;
                    this.lastResolvedChoreography = null;
                    this.lastResolvedStyle = null;
                    this.lastResolvedBase = null;
                }

                const frames = state.visualChoreography.frames;
                if (ct < this.lastChoreoTime) this.choreoCursor = 0; // seek / loop rewind
                this.lastChoreoTime = ct;
                while (this.choreoCursor + 1 < frames.length && frames[this.choreoCursor + 1].time <= ct) this.choreoCursor++;
                const activeFrame = frames.length > 0 && frames[this.choreoCursor].time <= ct ? frames[this.choreoCursor] : null;
                state.currentChoreography = activeFrame;

                const base = state.semanticBaseTuning;
                // Only re-resolve (and re-allocate a tuning config) when something actually changed.
                if (activeFrame !== this.lastResolvedChoreography || state.visualMode !== this.lastResolvedStyle || base !== this.lastResolvedBase) {
                    if (activeFrame !== this.lastResolvedChoreography) {
                        this.transition('motif', motifTransitionId(activeFrame));
                    }
                    this.lastResolvedChoreography = activeFrame;
                    this.lastResolvedStyle = state.visualMode;
                    this.lastResolvedBase = base;
                    const presets = base ? { [state.visualMode]: base } : {};
                    Object.assign(state.targetTuning, resolveSemanticState(activeFrame, state.visualMode, presets));
                }
            }
        } else {
            this.transition('motif', null);
            state.currentChoreography = null;
        }

        const projectSemantic = state.visualMode === 'cosmic-wormhole' && (isTimeBasedSemanticActive
            || flags.semanticResolver && !!state.visualChoreography?.score);
        this.state = state; this.timeBased = isTimeBasedSemanticActive;
        const target = this.frame.beginTuning(state.visualTuning, state.targetTuning,
            projectSemantic ? this.semanticBase : null, this.resolve, tuningDeltaSec);
        this.host.applyAutomatedTuning?.(ct, state.visualTuning, target);
        state.spiralTransitionAnchor = this.host.applyAutomatedSpiral?.(ct, state.visualTuning, target) ?? null;
        this.frame.finishTuning(state.visualTuning);
    }
}
