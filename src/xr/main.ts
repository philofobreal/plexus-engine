// Composition root for the /xr/ WebXR rhythm-game host (ADR-009). The only module that
// constructs AudioEngine and the Three.js renderer (via XrRuntime) for this page; everything
// else -- gameplay domain, XR runtime, scene -- is wired together and handed to the
// XrAppController facade.

import './xr.css';

import { AudioEngine } from '../audio/AudioEngine';
import { XrAppController } from './XrAppController';
import { XrRuntime } from './runtime/XrRuntime';
import { WormholeCanvasSource } from '../visuals/WormholeCanvasSource';
import { WormholeWorkerSource, wormholeWorkerSupported } from '../visuals/WormholeWorkerSource';
import { createXrSettingsStore } from './XrSettingsStore';

const container = document.querySelector<HTMLDivElement>('#xr-app');
if (!container) throw new Error('#xr-app container missing from xr/index.html');

// Opt-in debug counters, parsed once here and passed down (never re-read by runtime modules).
const diagnostics = window.location.search.includes('xrDiagnostics=1');
const engine = new AudioEngine(undefined, { loopPlayback: false, heroMetronome: false });
const runtime = new XrRuntime(container, { diagnostics });
// Player settings persist per viewer; storage can be unavailable (private mode, policy).
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { storage = null; }
// One background plane with monocular depth cues; the scene picks the raster size (player quality).
// It rasterizes in a worker when the browser can (ADR-009 Addendum G); `?xrBackgroundThread=main`
// forces the in-thread source for A/B frame-time comparison.
const offThread = !window.location.search.includes('xrBackgroundThread=main') && wormholeWorkerSupported();
new XrAppController(engine, runtime, container, options => {
    const size = { diagnostics, profile: diagnostics, depthCue: 0.7, width: options?.width, height: options?.height };
    return offThread ? new WormholeWorkerSource(size) : new WormholeCanvasSource(size);
}, { diagnostics, settingsStore: createXrSettingsStore(storage) });
