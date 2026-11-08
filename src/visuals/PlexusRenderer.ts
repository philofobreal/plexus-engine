import p5 from 'p5';
import type { MusicDisplaySettings } from '../types/MusicDisplay';
import { State } from '../state/store';
import { Particle } from './Particle';
import { Shockwave } from './Shockwave';
import { featureFlags } from '../config/featureFlags';
import { tuneAudioValue, tuningMorphDeltaSec, visualTuningKeys } from '../config/visualTuning';
import { PausedPreviewGate } from './PausedPreviewGate';
import { P5RendererBackend } from './P5RendererBackend';
import type { AudioEngine } from '../audio/AudioEngine';
import type { VisualCueKind, VisualTuningConfig } from '../types';
import { VisualDirectorFSM } from './VisualDirectorFSM';
import { HostVisualFramePreparation } from './HostVisualFramePreparation';
import { publishAnalysisFrame, decayHostAnalysisFrame, prepareFrameSignals, borrowResolvedWormholeFrame } from './VisualFramePreparation';
import type { StyleRegistry } from './StyleRegistry';
import type { SemanticRuntimeAdapter } from '../semantics';
import { ShockwaveLifecycle } from './ShockwaveLifecycle';
import type { ChoreographyFrame as SemanticScoreFrame } from '../types/semantics';
import { semanticScoreTransitionId } from './VisualTransitionIdentity';
import { setActiveVisualTransitionComponent } from '../state/visualTransitionState';
import { IdentityTransitionController, computeCrossfadeAlpha, type IdentityDraw } from './IdentityTransitionController';
import { WorkerIdentityTransition } from './WorkerIdentityTransition';
import { ExactExportFrameBridge, type ExactFrameSource } from './ExactExportFrameBridge';
import { WormholeRasterPass } from './WormholeRasterPass';
import { P5RenderTargetCompositor } from './P5RenderTargetCompositor';
import { PostFxPipeline } from './PostFxPipeline';
import { VisualTransientSampler, advancePlaybackFade, integratedFadeFrames } from './transientDecay';
import { TemporalFragmentationEffect } from './TemporalFragmentationEffect';
import type { PostFxSurfaceHost } from './CanvasPostFxSurface';
import type { WormholeHostRasterSource, WormholeHostFrame } from '../types/WormholeHostFrame';

export class SemanticRendererBridge {
    private semanticAdapter?: SemanticRuntimeAdapter;
    private lastFrame: SemanticScoreFrame | null = null;
    private activeTransitionId: string | null = null;

    setSemanticAdapter(adapter: SemanticRuntimeAdapter | undefined): void {
        this.semanticAdapter = adapter;
        this.lastFrame = null;
        this.activeTransitionId = null;
    }

    hasPlan(): boolean {
        return this.semanticAdapter?.hasPlan() ?? false;
    }

    getBaseTuning(): Readonly<VisualTuningConfig> | null { return this.semanticAdapter?.getBaseTuning?.() ?? null; }
    restoreBaseTuning(target: VisualTuningConfig): void { this.semanticAdapter?.restoreBaseTuning?.(target); }

    updateSemantic(timeSec: number, targetTuning: VisualTuningConfig): string | null {
        if (!this.semanticAdapter) return null;
        const frame = this.semanticAdapter.update(timeSec, targetTuning);
        if (frame !== this.lastFrame) {
            this.lastFrame = frame;
            this.activeTransitionId = semanticScoreTransitionId(frame);
        }
        return this.activeTransitionId;
    }
}

/** Structural subset of DashboardUI (and any lighter host, e.g. the MVP UI) that the renderer loop needs. */
export interface PlexusRendererHost {
    updateDashboard(): void;
    prepareAutomationFrame?(): void;
    applyAutomatedTuning?(time: number, out: VisualTuningConfig, target: VisualTuningConfig): boolean;
    setExportTarget(p5Instance: any, canvas: HTMLCanvasElement): void;
    /**
     * Optional final transform applied to State.targetTuning immediately before it's used as the
     * morph target, once per render frame, after every other targetTuning writer that frame
     * (preset/automation triggers, the ADR-003/004 semantic layer) has already run. A host that
     * doesn't implement this (e.g. the advanced dashboard) is unaffected -- the renderer falls
     * back to targetTuning itself, today's exact behaviour. The MVP surface uses this to layer its
     * Visual character / Advanced tuning boosts on top of whatever is currently authored, without
     * ever writing into targetTuning or semanticBaseTuning itself (see
     * MvpVisualController.getBoostedTuning for why that matters). Implementations should return a
     * reused/mutated object rather than allocating one per call.
     */
    getTuningForMorph?(rawTuning: VisualTuningConfig): VisualTuningConfig;
    /** Host-owned absolute spiral channel, after the normal morph; receives the same live/export clock. */
    applyAutomatedSpiral?(songTime: number, tuning: VisualTuningConfig, resolvedBase?: VisualTuningConfig): import('../types').VisualTransitionAnchor | null;
}

export interface PlexusRendererOptions {
    /** Live host quality preference. When present, overrides the static preview caps below. */
    previewQuality?: {
        readonly compactMaterialPreview: boolean;
        readonly pixelRatioCap: number;
        readonly maxBackingLongEdge: number;
        /** Device preference, independent of artistic tuning and presets. */
        readonly wormholeRenderer?: 'compatible' | 'webgl' | 'offscreen';
        readonly musicDisplay?: MusicDisplaySettings;
    };
    /** Smaller material rasters for compact/mobile previews; exports retain their own budget. */
    compactMaterialPreview?: boolean;
    /** Preview source; its latest-wins images never enter export. */
    createWormholeWorker?: (invalidate: () => void) => WormholeHostRasterSource;
    /** Composition-root factory for a separate, job-bound exact worker. */
    createExactWormholeSource?: () => ExactFrameSource;
    onWormholeRasterChange?: (kind: string) => void;
    /** When provided, the canvas tracks this container-relative size instead of the full browser window. */
    getPreviewSize?: () => { width: number; height: number };
    /** Caps the p5 backing-store pixel density independently of devicePixelRatio (perf policy). */
    pixelRatioCap?: number;
    /**
     * Absolute backing-store resolution ceiling (long edge, device pixels; e.g. 1920 for a
     * 1080p-tier preview). pixelRatioCap alone only bounds the *ratio* applied to whatever CSS
     * size the container currently is -- on a HiDPI display that container can itself grow past
     * the design's preview-quality tiers (e.g. a fullscreen previewCol on a 4K/5K screen), which
     * would still multiply out to a far larger backing store than the tier intends. When set, the
     * effective pixel density is reduced below pixelRatioCap as needed so the backing store's
     * long edge never exceeds this value, independent of the container's current CSS size.
     */
    maxBackingLongEdge?: number;
}

export function startPlexusRenderer(
    containerId: string,
    ui: PlexusRendererHost,
    engine: AudioEngine,
    styleRegistry: StyleRegistry,
    semanticBridge: SemanticRendererBridge = new SemanticRendererBridge(),
    options?: PlexusRendererOptions
) {
    new p5((p: p5) => {
        const getCanvasSize = () => options?.getPreviewSize?.() ?? { width: p.windowWidth, height: p.windowHeight };
        const getPreviewPolicy = () => options?.previewQuality ?? options;
        let lastRatioCap = getPreviewPolicy()?.pixelRatioCap;
        let lastLongEdgeCap = getPreviewPolicy()?.maxBackingLongEdge;
        const pausedPreview = new PausedPreviewGate();
        const renderFeatureKeys = Object.keys(featureFlags) as Array<keyof typeof featureFlags>;
        let canvasRevision = 0;
        const wormholeRaster = new WormholeRasterPass(() => { canvasRevision++; pausedPreview.invalidate(); });
        let workerRaster: WormholeHostRasterSource | null = null;
        let reportedRaster = '';
        const pairedTransition = new WorkerIdentityTransition();
        let renderPostFrame: Readonly<WormholeHostFrame> | null = null;
        let forceSynchronousWormhole = false;
        let workerUsed = false, activeRaster = 'compatible', workerNeedsMainSync = false;
        const drawIdentity: IdentityDraw = (identity, target, particles, shockwaves, context) => {
            const musicDisplay=options?.previewQuality?.musicDisplay;
            if(identity.id==='cosmic-wormhole') (identity as {setMusicDisplay?(s?:MusicDisplaySettings):void}).setMusicDisplay?.(musicDisplay);
            const mode = options?.previewQuality?.wormholeRenderer ?? 'compatible';
            if (mode === 'offscreen' && !forceSynchronousWormhole && !State.isExporting && identity.id === 'cosmic-wormhole'
                && target instanceof P5RendererBackend && options?.createWormholeWorker) {
                wormholeRaster.suspend();
                workerRaster ??= options.createWormholeWorker(() => { canvasRevision++; pausedPreview.invalidate(); });
                workerUsed = true;
                if (workerRaster.draw(State, target, (identity as { depthCueStrength?: number }).depthCueStrength ?? 0,
                    State.videoBackplateActive, State.isPlaying,musicDisplay)) {
                    activeRaster = workerRaster.rasterKind; workerNeedsMainSync = true; return;
                }
            }
            if (workerNeedsMainSync && identity.id === 'cosmic-wormhole') {
                identity.syncPosition?.(context?.timeSec ?? State.currentTime); workerNeedsMainSync = false;
            }
            wormholeRaster.draw(identity, target, particles, shockwaves, context,
                mode === 'webgl' ? 'webgl' : 'compatible', State.videoBackplateActive);
            activeRaster = mode === 'offscreen' && !State.isExporting
                ? identity.id === 'cosmic-wormhole' ? 'fallback' : 'native' : wormholeRaster.rasterKind;
        };
        // p5 owns the render lifecycle; a GPU context must not survive removal of this renderer.
        const remove = p.remove?.bind(p);
        if (remove) p.remove = () => { exactExport.dispose(); workerRaster?.dispose(); wormholeRaster.dispose(); pairedTransition.reset(); compositor?.dispose(); postFxPipeline.dispose(); remove(); };

        // Effective pixel density for a given CSS size: pixelRatioCap bounds the ratio, then
        // maxBackingLongEdge (if set) reduces it further so the backing store's long edge never
        // exceeds that absolute device-pixel ceiling, however large the CSS container itself is.
        const computeEffectiveDensity = (cssWidth: number, cssHeight: number): number => {
            const policy = getPreviewPolicy();
            const requested = Math.max(0.1, Math.min(window.devicePixelRatio || 1, policy?.pixelRatioCap ?? Infinity));
            if (!policy?.maxBackingLongEdge) return requested;
            const longEdge = Math.max(cssWidth, cssHeight);
            if (longEdge <= 0) return requested;
            return Math.max(0.1, Math.min(requested, policy.maxBackingLongEdge / longEdge));
        };

        // Applies a target CSS size, first adjusting pixel density if the size change moved it
        // past the backing-store cap, then resizing the canvas. Used by setup, the container
        // ResizeObserver, and the draw-loop self-heal fallback below, so all three honour the same
        // backing-resolution ceiling instead of only the initial setup call doing so.
        const applyCanvasSize = (cssWidth: number, cssHeight: number): void => {
            if (getPreviewPolicy()?.pixelRatioCap !== undefined || getPreviewPolicy()?.maxBackingLongEdge !== undefined) {
                const effectiveDensity = computeEffectiveDensity(cssWidth, cssHeight);
                if (Math.abs(effectiveDensity - p.pixelDensity()) > 1e-6) {
                    p.pixelDensity(effectiveDensity);
                    canvasRevision++;
                }
            }
            if (cssWidth !== p.width || cssHeight !== p.height) {
                p.resizeCanvas(cssWidth, cssHeight);
                canvasRevision++;
            }
        };

        let particles: Particle[] = [];
        const shockwaveLifecycle = new ShockwaveLifecycle<Shockwave>(State.visualMode);
        const shockwaves = shockwaveLifecycle.items;
        let currentEventIdx = 0;
        let currentCueIdx = 0;
        let currentTargetFrameRate = 60;
        let lastTuningTime: number | null = null;
        let lastEnvelopeTime: number | null = null;
        let lastEnvelopeExport = State.isExporting;
        const transientSampler = new VisualTransientSampler();
        let lastTuningClockWasExport = State.isExporting;
        const compactMaterialPreview = () => getPreviewPolicy()?.compactMaterialPreview ?? false;
        const backend = new P5RendererBackend(p, compactMaterialPreview);
        const visualDirector = new VisualDirectorFSM();
        const identityTransitionController = new IdentityTransitionController();
        let compositor: P5RenderTargetCompositor | null = null;
        // Renderer-owned post chain (ADR-007). Buffers are allocated lazily on the first active
        // frame, so an untouched Post FX section costs nothing.
        const workerPostState = { visualTuning: State.visualTuning, directorOutput: State.directorOutput,
            modulation: State.modulation, isPlaying: false, isExporting: false };
        const readPostState = () => {
            const frame = renderPostFrame;
            if (!frame) return State;
            workerPostState.visualTuning = frame.visualTuning; workerPostState.directorOutput = frame.directorOutput;
            workerPostState.modulation = frame.modulation; workerPostState.isPlaying = frame.isExporting ? false : State.isPlaying;
            workerPostState.isExporting = frame.isExporting;
            return workerPostState;
        };
        const postFxPipeline = new PostFxPipeline([new TemporalFragmentationEffect(readPostState)], undefined, readPostState);

        const exactExport = new ExactExportFrameBridge(() => {
            if (options?.previewQuality?.wormholeRenderer !== 'offscreen' || !options.createExactWormholeSource
                || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
            workerRaster?.dispose(); workerRaster = null; pairedTransition.reset(); wormholeRaster.suspend();
            syncEventIndex(0); // New job starts its existing host cursors/history at song zero.
            return options.createExactWormholeSource();
        }, () => State, () => p.redraw(), kind => {
            const canvas = (p as unknown as { canvas?: HTMLCanvasElement }).canvas;
            if (canvas?.dataset) canvas.dataset.exportRaster = kind;
        }, () => { compositor?.releaseExportSurfaces(); postFxPipeline.dispose(); syncEventIndex(engine.getCurrentTime()); });
        // Shared data-only port. Export owns its lifetime and awaits it outside p5.draw.
        (p as p5 & { __plexusExportFramePort?: import('../types/HostExportFramePort').HostExportFramePort }).__plexusExportFramePort = exactExport;

        const framePreparation = new HostVisualFramePreparation(ui, semanticBridge, setActiveVisualTransitionComponent);

        p.setup = () => {
            const initialSize = getCanvasSize();
            const renderer = p.createCanvas(initialSize.width, initialSize.height);
            // p5 2 creates a new renderer with device density in createCanvas(), discarding any
            // earlier pixelDensity() setting. Cap the actual canvas before its first draw and
            // before graphics targets inherit its density.
            applyCanvasSize(initialSize.width, initialSize.height);
            renderer.parent(containerId);
            p.frameRate(60);
            for (let i = 0; i < 75; i++) particles.push(new Particle(p));
            compositor = new P5RenderTargetCompositor(p, compactMaterialPreview);
            ui.setExportTarget(p, (renderer as unknown as { elt: HTMLCanvasElement }).elt);

            if (options?.getPreviewSize && typeof ResizeObserver !== 'undefined') {
                const containerEl = document.getElementById(containerId);
                if (containerEl) {
                    // Reacts as soon as the container's box changes (including a display:none ->
                    // visible transition), independent of the draw loop's own throttled check below
                    // (which is the fallback for cases a ResizeObserver notification is missed).
                    new ResizeObserver(() => {
                        const size = getCanvasSize();
                        applyCanvasSize(size.width, size.height);
                    }).observe(containerEl);
                }
            }
        };

        const syncEventIndex = (time: number) => {
            lastEnvelopeTime = null;
            pausedPreview.invalidate();
            workerRaster?.reset(); pairedTransition.reset();
            currentEventIdx = State.events.findIndex(e => e.time >= time);
            if (currentEventIdx === -1) currentEventIdx = State.events.length;
            currentCueIdx = State.trackAnalysis.cues.findIndex(e => e.time >= time);
            if (currentCueIdx === -1) currentCueIdx = State.trackAnalysis.cues.length;
            resetTransientVisualState();
            styleRegistry.forEach(identity => identity.syncPosition?.(time));
        };

        engine.addPositionChangedListener(syncEventIndex);

        engine.addPlaybackEndedListener(() => {
            lastEnvelopeTime = null;
            pausedPreview.invalidate();
            workerRaster?.reset(); pairedTransition.reset();
            currentEventIdx = 0;
            currentCueIdx = 0;
            resetTransientVisualState();
            State.currentFrame.state = 'IDLE';
            ui.updateDashboard();
        });

        p.draw = () => {
            if (!exactExport.allowDraw()) return;
            // Preferences are cheap host values. Only a real policy change needs a size read.
            const policy = getPreviewPolicy();
            if (lastRatioCap !== policy?.pixelRatioCap || lastLongEdgeCap !== policy?.maxBackingLongEdge) {
                lastRatioCap = policy?.pixelRatioCap;
                lastLongEdgeCap = policy?.maxBackingLongEdge;
                const size = getCanvasSize();
                applyCanvasSize(size.width, size.height);
            }
            // Fallback for the rare case the ResizeObserver above missed a transition (e.g. a
            // resize that happened before the observer was attached): self-heals regardless of
            // when the container's box actually changes. Throttled rather than checked every
            // frame -- getPreviewSize() reads getBoundingClientRect(), which forces a layout, and
            // the ResizeObserver above already handles the common case immediately.
            if (options?.getPreviewSize && p.frameCount % 15 === 0) {
                const size = getCanvasSize();
                applyCanvasSize(size.width, size.height);
            }

            const targetFrameRate = State.isPlaying ? 60 : State.duration > 0 ? 30 : 15;
            if (currentTargetFrameRate !== targetFrameRate) {
                currentTargetFrameRate = targetFrameRate;
                p.frameRate(targetFrameRate);
            }

            const ct = State.isExporting ? State.exportTime : engine.getCurrentTime();
            State.currentTime = ct;
            ui.prepareAutomationFrame?.();
            const morphTarget = ui.getTuningForMorph ? ui.getTuningForMorph(State.targetTuning) : State.targetTuning;
            const idlePreview = !State.isPlaying && !State.isExporting && State.playbackFade <= 0;
            if (idlePreview) {
                // The p5 callback stays available for UI/host changes; unchanged paused frames
                // perform no identity, material, post-FX or dashboard canvas drawing. Snapshot
                // numeric values too: tuning objects and MVP boost results are mutated in place.
                pausedPreview.begin();
                pausedPreview.watch(canvasRevision);
                pausedPreview.watch(ct);
                pausedPreview.watch(State.duration);
                pausedPreview.watch(State.bpm);
                pausedPreview.watch(State.visualMode);
                pausedPreview.watch(State.frames);
                pausedPreview.watch(State.events);
                pausedPreview.watch(State.trackAnalysis);
                pausedPreview.watch(State.visualChoreography);
                pausedPreview.watch(State.semanticBaseTuning);
                pausedPreview.watch(State.performancePlan);
                pausedPreview.watch(State.editedPerformancePlan);
                pausedPreview.watch(State.automationMorphScale);
                pausedPreview.watch(State.activeVisualTransitionId);
                pausedPreview.watch(State.visualModeTransition);
                pausedPreview.watch(State.videoBackplateActive);
                pausedPreview.watch(State.videoDominantColor.r);
                pausedPreview.watch(State.videoDominantColor.g);
                pausedPreview.watch(State.videoDominantColor.b);
                pausedPreview.watch(compactMaterialPreview());
                pausedPreview.watch(options?.previewQuality?.wormholeRenderer);
                pausedPreview.watch(options?.previewQuality?.musicDisplay);
                pausedPreview.watch(semanticBridge.hasPlan());
                for (const key of renderFeatureKeys) pausedPreview.watch(featureFlags[key]);
                for (const key of visualTuningKeys) {
                    pausedPreview.watch(State.visualTuning[key]);
                    pausedPreview.watch(State.targetTuning[key]);
                    pausedPreview.watch(morphTarget[key]);
                }
                if (!pausedPreview.shouldDraw()) return;
            } else {
                // Playback, export and the existing pause fade always render normally. Finish
                // with one settled paused frame, even if its tuning and song time are unchanged.
                pausedPreview.invalidate();
            }

            shockwaveLifecycle.syncMode(State.visualMode);

            const active = State.isPlaying || State.isExporting;
            // Song time owns all musical envelopes. Only the host's cosmetic pause fade uses
            // p5 elapsed time; it cannot advance events, automation, director or export time.
            const envelopeDelta = lastEnvelopeTime === null || lastEnvelopeExport !== State.isExporting
                ? 0 : active ? Math.max(0, ct - lastEnvelopeTime)
                    : Math.min(0.25, Math.max(0, Number.isFinite(p.deltaTime) ? p.deltaTime / 1000 : 0));
            lastEnvelopeTime = ct; lastEnvelopeExport = State.isExporting;
            State.rotationPhase += integratedFadeFrames(State.playbackFade, active, envelopeDelta);
            State.playbackFade = advancePlaybackFade(State.playbackFade, active, envelopeDelta, true);

            State.currentTime = ct;
            const tuningClockChanged = lastTuningClockWasExport !== State.isExporting;
            const tuningDeltaSec = tuningMorphDeltaSec(ct, lastTuningTime, tuningClockChanged);
            lastTuningTime = ct;
            lastTuningClockWasExport = State.isExporting;
            // Optional host-owned final layer (see PlexusRendererHost.getTuningForMorph): applied
            // fresh every frame directly on top of whatever State.targetTuning currently is, so a
            // host that boosts/cuts specific keys (the MVP surface) never has to write into
            // targetTuning itself to make that stick. A host without the hook (the advanced
            // dashboard) morphs toward targetTuning directly, exactly as before.


            framePreparation.prepareTuning(State, featureFlags, ct, tuningDeltaSec);

            if (State.frames.length > 0) {
                let frameIdx = Math.floor(ct * State.sampleRate / State.hopSize);
                publishAnalysisFrame(State, frameIdx, 'host');

                while (active && currentEventIdx < State.events.length && ct >= State.events[currentEventIdx].time) {
                    let ev = State.events[currentEventIdx];
                    shockwaveLifecycle.emit(State.visualMode, () =>
                        new Shockwave(p, tuneAudioValue(ev.intensity, State.visualTuning), State.currentFrame.state, ev.type)
                    );
                    currentEventIdx++;
                }

                while (active && currentCueIdx < State.trackAnalysis.cues.length && ct >= State.trackAnalysis.cues[currentCueIdx].time) {
                    let cue = State.trackAnalysis.cues[currentCueIdx];
                    let cueIntensity = tuneAudioValue(cue.intensity, State.visualTuning);
                    State.activeCueKind = cue.kind;
                    State.activePatternId = cue.kind === 'pattern' ? cue.patternId || null : State.activePatternId;
                    shockwaveLifecycle.emit(State.visualMode, () =>
                        new Shockwave(p, cueIntensity, State.currentFrame.state, cueTypeToShockwave(cue.kind))
                    );
                    currentCueIdx++;
                }
            } else {
                decayHostAnalysisFrame(State, envelopeDelta);
            }

            const transients = transientSampler.sample(State.events, State.trackAnalysis.cues, ct);
            State.beatDecay = transients.beat;
            State.denseImpactFlash = transients.dense;
            State.cueDecay = tuneAudioValue(transients.cue, State.visualTuning);
            if (State.cueDecay < 0.02) {
                State.activeCueKind = null;
                State.activePatternId = null;
            }

            const directorOutput = prepareFrameSignals(State, visualDirector, ct, State.cueDecay, 'host', State.isPlaying || State.isExporting);
            State.directorOutput.state = directorOutput.state;
            State.directorOutput.centripetalOrbit = directorOutput.centripetalOrbit;
            State.directorOutput.glitchIntensity = directorOutput.glitchIntensity;
            State.directorOutput.invertBackground = directorOutput.invertBackground;

            if (idlePreview || p.frameCount % 4 === 0) ui.updateDashboard();

            workerUsed = false; renderPostFrame = null;
            let completedFrame = true;
            const transition = State.visualModeTransition;
            const paired = compositor && transition && transition.to === State.visualMode && ct >= transition.startTimeSec
                && (transition.from === 'cosmic-wormhole' || transition.to === 'cosmic-wormhole')
                && options?.previewQuality?.wormholeRenderer === 'offscreen' && options.createWormholeWorker && !State.isExporting;
            let exactQueued = false;
            // Exact export has a separate source and no preview pacing or dropped frames.
            const exactIndex = exactExport.frameIndex;
            const exactPair = transition && transition.to === State.visualMode && ct >= transition.startTimeSec
                && computeCrossfadeAlpha(ct, transition.startTimeSec, transition.durationSec) < 1
                && (transition.from === 'cosmic-wormhole' || transition.to === 'cosmic-wormhole');
            const exactWormhole = State.visualMode === 'cosmic-wormhole' || exactPair;
            if (exactIndex !== null && exactWormhole && compositor) {
                const incomingWormhole = State.visualMode === 'cosmic-wormhole';
                const wormhole = styleRegistry.get('cosmic-wormhole');
                const capturedTransition = exactPair ? { ...transition! } : null;
                const frame: WormholeHostFrame = {
                    ...borrowResolvedWormholeFrame(State).values,
                    width: backend.width, height: backend.height, density: 1, compact: false,
                    frameCount: exactIndex + 1, reset: false,
                    depthCue: (wormhole as { depthCueStrength?: number }).depthCueStrength ?? 0,
                    transparent: State.videoBackplateActive, skybox: featureFlags.wormholeSkybox,
                    musicDisplay: options?.previewQuality?.musicDisplay
                };
                if (capturedTransition) {
                    compositor.beginPairedFrame(backend.width, backend.height);
                    const other = styleRegistry.get(incomingWormhole ? capturedTransition.from : capturedTransition.to);
                    drawIdentity(other, compositor.incomingBackend, particles, shockwaves,
                        { timeSec: ct, advanceSharedSimulation: true });
                    compositor.freezePairedCounterpart();
                }
                exactExport.submit(frame, lease => {
                    if (capturedTransition) compositor!.compositePaired(
                        computeCrossfadeAlpha(lease.frame.currentTime, capturedTransition.startTimeSec, capturedTransition.durationSec),
                        lease.bitmap, incomingWormhole);
                    else backend.presentRaster(lease.bitmap);
                    renderPostFrame = lease.frame; completedFrame = true;
                    activeRaster = 'exact-' + lease.raster; workerNeedsMainSync = true;
                    finishFrame();
                });
                if (transition && !capturedTransition) identityTransitionController.finishPairedFrame(transition.generation, ct);
                exactQueued = true; completedFrame = false;
            } else if (paired && compositor) {
                wormholeRaster.suspend();
                workerRaster ??= options!.createWormholeWorker!(() => { canvasRevision++; pausedPreview.invalidate(); });
                const incoming = styleRegistry.get(transition.to), outgoing = styleRegistry.get(transition.from);
                const wormhole = transition.to === 'cosmic-wormhole' ? incoming : outgoing;
                const result = pairedTransition.draw({
                    time: ct, transition, state: State, incoming, outgoing, compositor,
                    source: workerRaster,
                    target: { width: backend.width, height: backend.height, frameCount: backend.frameCount,
                        rasterPixelRatio: backend.rasterPixelRatio, compactMaterialPreview: backend.compactMaterialPreview },
                    depthCue: (wormhole as { depthCueStrength?: number }).depthCueStrength ?? 0,
                    transparent: State.videoBackplateActive, playing: State.isPlaying, musicDisplay: options?.previewQuality?.musicDisplay,
                    revision: renderFeatureKeys.map(key => featureFlags[key]).join('/') + '/' +
                        State.videoDominantColor.r + '/' + State.videoDominantColor.g + '/' + State.videoDominantColor.b,
                    particles, shockwaves, drawIdentity
                });
                workerUsed = true; // Keep a failed worker latched; never retry its startup every draw.
                if (result.handled) {
                    workerNeedsMainSync = true; activeRaster = workerRaster.rasterKind;
                    renderPostFrame = result.frame; completedFrame = result.frame !== null;
                    if (result.frame) identityTransitionController.finishPairedFrame(transition.generation, result.frame.currentTime);
                } else {
                    forceSynchronousWormhole = true;
                    const fallbackDraw: IdentityDraw = (identity, target, pool, waves, context) =>
                        drawIdentity(identity, target, pool, waves, result.advanced ? { ...context, advanceSharedSimulation: false } : context);
                    try { identityTransitionController.draw(ct, backend, compositor, styleRegistry, particles, shockwaves, fallbackDraw); }
                    finally { forceSynchronousWormhole = false; }
                    activeRaster = workerRaster.rasterKind === 'fallback' ? 'fallback' : 'compatible-transition';
                }
            } else {
                pairedTransition.reset();
                if (compositor) {
                    identityTransitionController.draw(ct, backend, compositor, styleRegistry, particles, shockwaves, drawIdentity);
                } else {
                    drawIdentity(styleRegistry.get(State.visualMode), backend, particles, shockwaves, { timeSec: ct, advanceSharedSimulation: true });
                }
                renderPostFrame = workerUsed ? workerRaster?.presentedFrame ?? null : null;
            }
            // Single Post FX seam (ADR-007): the identity frame is finished here in both the
            // steady-state and the crossfade path, so the chain runs exactly once per frame on the
            // final composite, for the live canvas and the offscreen export target alike.
            const finishFrame = () => {
                if (completedFrame) postFxPipeline.render(p as unknown as PostFxSurfaceHost, renderPostFrame?.currentTime ?? ct);
            };
            if (!exactQueued) finishFrame();
            if (!workerUsed && workerRaster) { workerRaster.dispose(); workerRaster = null; }
            const canvas = (p as unknown as { canvas?: HTMLCanvasElement }).canvas;
            if (canvas?.dataset) canvas.dataset.wormholeRaster = activeRaster;
            if (reportedRaster !== activeRaster) { reportedRaster = activeRaster; options?.onWormholeRasterChange?.(activeRaster); }
            engine.syncMetronomeState(featureFlags.heroEffect && State.visualMode === 'hero', State.visualTuning.heroBeepMode, State.visualTuning.heroBeepVolume);

        };

        p.windowResized = () => {
            if (options?.getPreviewSize) return; // handled by the container ResizeObserver above
            // Routed through applyCanvasSize (not a bare resizeCanvas) so a window moved to a
            // display with a different devicePixelRatio -- or simply resized larger -- keeps
            // honouring pixelRatioCap/maxBackingLongEdge instead of only capping the density once
            // at setup and then drifting uncapped on every resize after.
            applyCanvasSize(p.windowWidth, p.windowHeight);
        };
    });
}

function resetTransientVisualState() {
    State.modulation.subEnergy = State.modulation.bassEnergy = State.modulation.subFlux = State.modulation.bassFlux = 0;
    State.beatDecay = 0;
    State.denseImpactFlash = 0;
    State.cueDecay = 0;
    State.modulation.kineticTension = 0;
    State.modulation.densityDrive = 0;
    State.modulation.spectralChaos = 0;
    State.modulation.rhythmicImpulse = 0;
    State.modulation.macroMomentum = 0;
    State.directorOutput.state = 'IDLE';
    State.directorOutput.centripetalOrbit = 0;
    State.directorOutput.glitchIntensity = 0;
    State.directorOutput.invertBackground = false;
    State.currentChoreography = null;
    State.activeCueKind = null;
    State.activePatternId = null;
}

function cueTypeToShockwave(kind: VisualCueKind): number {
    if (kind === 'melody') return 4;
    if (kind === 'vocal') return 5;
    if (kind === 'fx') return 6;
    if (kind === 'break') return 7;
    if (kind === 'pattern') return 8;
    return 2;
}
