// Composition root for the /xr/ WebXR rhythm-game host (ADR-009). The only module that
// constructs AudioEngine and the Three.js renderer (via XrRuntime) for this page; everything
// else -- gameplay domain, XR runtime, scene -- is wired together and handed to the
// XrAppController facade.

import './xr.css';

import { AudioEngine } from '../audio/AudioEngine';
import { XrAppController } from './XrAppController';
import { XrRuntime } from './runtime/XrRuntime';
import { WormholeCanvasSource } from '../visuals/WormholeCanvasSource';

const container = document.querySelector<HTMLDivElement>('#xr-app');
if (!container) throw new Error('#xr-app container missing from xr/index.html');

// Opt-in debug counters, parsed once here and passed down (never re-read by runtime modules).
const diagnostics = window.location.search.includes('xrDiagnostics=1');
const engine = new AudioEngine(undefined, { loopPlayback: false, heroMetronome: false });
const runtime = new XrRuntime(container, { diagnostics });
// Stereoscopic 2.5D background: one simulation, three depth planes, plus monocular depth cues.
new XrAppController(engine, runtime, container, () => new WormholeCanvasSource({ diagnostics, depthLayers: true, depthCue: 0.7 }), { diagnostics });
