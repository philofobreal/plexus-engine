import './mvp.css';

const bootStart = Date.now();

import { AudioEngine } from '../../audio/AudioEngine';
import { SemanticResolver, SemanticRuntimeAdapter } from '../../semantics';
import { SemanticRendererBridge, startPlexusRenderer } from '../../visuals/PlexusRenderer';
import { createDefaultStyleRegistry } from '../../visuals/StyleRegistry';
import { State } from '../../state/store';
import { requestVisualModeChange } from '../../state/visualModeTransition';
import { MvpUI } from './MvpUI';
import { MVP_CANVAS_CONTAINER_ID } from './PreviewStage';
import { createPreviewQualityControl } from '../PreviewQualityControl';

// The MVP is locked to the Cosmic Wormhole identity (design doc: "the user never sees a Visual
// Mode selector"). Asserted explicitly and routed through the one sanctioned State.visualMode
// writer rather than relying on it happening to already be the store's default -- a no-op today
// (State.visualMode already defaults to 'cosmic-wormhole'), but it stops a future default change
// from silently changing what the MVP renders.
requestVisualModeChange('cosmic-wormhole');

const semanticResolver = new SemanticResolver();
const semanticAdapter = new SemanticRuntimeAdapter(semanticResolver, () => State.semanticBaseTuning);
const engine = new AudioEngine((plan) => semanticResolver.setPlan(plan));

const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
const previewQuality = createPreviewQualityControl(!isDesktop);
const ui = new MvpUI(engine, () => semanticResolver.hasPlan(), previewQuality);
document.querySelector<HTMLDivElement>('#mvp-app')!.appendChild(ui.root);

const styleRegistry = createDefaultStyleRegistry();
const semanticBridge = new SemanticRendererBridge();
semanticBridge.setSemanticAdapter(semanticAdapter);

startPlexusRenderer(MVP_CANVAS_CONTAINER_ID, ui, engine, styleRegistry, semanticBridge, {
    getPreviewSize: () => ui.getPreviewSize(),
    previewQuality: previewQuality.preference
});

const minDelayPromise = new Promise<void>((resolve) => {
    const remaining = Math.max(0, 500 - (Date.now() - bootStart));
    setTimeout(resolve, remaining);
});

void minDelayPromise.then(() => {
    const loader = document.getElementById('mvp-app-loader');
    if (loader) {
        loader.classList.add('fade-out');
        loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }
});
