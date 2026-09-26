// Three.js/WebXR renderer + session lifecycle owner (ADR-009). `renderer.setAnimationLoop`
// is the sole render-loop owner, in both the desktop preview and an immersive session -- no
// competing manual `requestAnimationFrame`. Delta is only controller-velocity timing.

import * as THREE from 'three';

export type XrFrameUpdateCallback = (frame: XRFrame | null, deltaSec: number) => void;

/** Opt-in debug counters (`?xrDiagnostics=1`), decided once by the composition root. */
export interface XrDiagnosticsOptions {
    readonly diagnostics?: boolean;
}

export class XrRuntime {
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;

    private readonly container: HTMLElement;
    private updateCallback: XrFrameUpdateCallback | null = null;
    private lastFrameTimeMs: number | null = null;
    private nextDesktopFrameMs: number | null = null;
    private playing = false;
    private dirty = true;
    private loopArmed = false;
    private enteringXr = false;
    private renderedFrames = 0;
    private readonly diagnostics: boolean;
    private readonly animate = (time: number, frame?: XRFrame) => this.handleFrame(time, frame ?? null);
    private readonly visibilityChanged = () => { this.lastFrameTimeMs = null; this.invalidate(); };
    private readonly handleResizeBound = () => this.handleResize();
    private disposed = false;
    private readonly sessionStarted = () => { this.lastFrameTimeMs = null; this.onSessionStart?.(); };
    private readonly sessionEnded = () => {
        this.lastFrameTimeMs = null;
        this.camera.position.set(0, 1.65, 2.6);
        this.camera.quaternion.identity();
        this.camera.updateMatrixWorld(true);
        this.onSessionEnd?.();
        this.handleResize();
    };

    onSessionStart: (() => void) | null = null;
    onSessionEnd: (() => void) | null = null;

    constructor(container: HTMLElement, options: XrDiagnosticsOptions = {}) {
        this.diagnostics = options.diagnostics === true;
        this.container = container;

        // Avoid a multisampled full-screen framebuffer, especially on integrated GPUs.
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        this.renderer.xr.enabled = true;
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(
            70,
            Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
            0.05,
            50
        );
        this.camera.position.set(0, 1.65, 2.6);

        window.addEventListener('resize', this.handleResizeBound);
        document.addEventListener('visibilitychange', this.visibilityChanged);

        this.renderer.xr.addEventListener('sessionstart', this.sessionStarted);
        this.renderer.xr.addEventListener('sessionend', this.sessionEnded);

        this.handleResize();
    }

    private handleFrame(timeMs: number, frame: XRFrame | null): void {
        if (this.disposed) return;
        const immersive = this.renderer.xr.isPresenting;
        // XR owns headset cadence; never cap head tracking to the desktop frame budget.
        if (immersive && !frame) return;
        if (!immersive && document.hidden) { this.syncLoop(); return; }
        if (!immersive && !this.dirty && this.nextDesktopFrameMs !== null && timeMs + 0.1 < this.nextDesktopFrameMs) return;
        if (!immersive) {
            const next = (this.nextDesktopFrameMs ?? timeMs) + 1000 / 60;
            this.nextDesktopFrameMs = next > timeMs ? next : timeMs + 1000 / 60;
        }
        const deltaSec = this.lastFrameTimeMs === null ? 0 : (timeMs - this.lastFrameTimeMs) / 1000;
        this.lastFrameTimeMs = timeMs;
        this.dirty = false;
        const updateStarted = this.diagnostics ? performance.now() : 0;
        this.updateCallback?.(frame, deltaSec);
        const updateMs = this.diagnostics ? performance.now() - updateStarted : 0;
        this.renderer.render(this.scene, this.camera);
        if (this.diagnostics) {
            const canvas = this.renderer.domElement;
            canvas.dataset.xrFrames = String(++this.renderedFrames);
            canvas.dataset.xrDrawCalls = String(this.renderer.info.render.calls);
            canvas.dataset.xrPixels = String(canvas.width * canvas.height);
            canvas.dataset.xrUpdateMs = updateMs.toFixed(2);
        }
        this.syncLoop();
    }

    /** The facade supplies transport state; rendering never decides audio lifecycle. */
    setPlaying(playing: boolean): void {
        if (this.playing !== playing) { this.lastFrameTimeMs = null; this.nextDesktopFrameMs = null; }
        this.playing = playing;
        this.invalidate();
    }

    invalidate(): void { this.dirty = true; this.syncLoop(); }

    private syncLoop(): void {
        if (this.disposed) return;
        const needed = this.renderer.xr.isPresenting || this.enteringXr || (!document.hidden && (this.playing || this.dirty));
        if (needed === this.loopArmed) return;
        this.loopArmed = needed;
        this.renderer.setAnimationLoop(needed ? this.animate : null);
        if (!needed) { this.lastFrameTimeMs = null; this.nextDesktopFrameMs = null; }
    }

    setUpdateCallback(callback: XrFrameUpdateCallback | null): void {
        this.updateCallback = callback;
        this.invalidate();
    }

    private handleResize(): void {
        if (this.renderer.xr.isPresenting) return;
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        // ~1080p physical-pixel budget, including on 4K / high-DPI monitors.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(1920 * 1080 / (width * height))));
        this.renderer.setSize(width, height);
        this.invalidate();
    }

    /** Requests an immersive-vr session with a local-floor reference space. Must follow a user gesture. */
    async requestImmersiveSession(): Promise<XRSession> {
        const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
        if (!xr) throw new Error('WebXR is not available on this device/browser.');

        this.renderer.xr.setReferenceSpaceType('local-floor');
        const session = await xr.requestSession('immersive-vr', {
            requiredFeatures: ['local-floor']
        });
        if (this.disposed) { await session.end(); throw new Error('XR runtime disposed.'); }
        // Arm before Three switches to the XR loop; don't restart its desktop RAF in sessionstart.
        this.enteringXr = true;
        this.syncLoop();
        try { await this.renderer.xr.setSession(session); }
        catch (error) { await session.end(); throw error; }
        finally { this.enteringXr = false; this.invalidate(); }
        return session;
    }

    endActiveSession(): void {
        const session = this.renderer.xr.getSession();
        if (session) void session.end();
    }

    isPresenting(): boolean {
        return this.renderer.xr.isPresenting;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.renderer.setAnimationLoop(null);
        this.renderer.xr.removeEventListener('sessionstart', this.sessionStarted);
        this.renderer.xr.removeEventListener('sessionend', this.sessionEnded);
        window.removeEventListener('resize', this.handleResizeBound);
        document.removeEventListener('visibilitychange', this.visibilityChanged);
        this.endActiveSession();
        this.renderer.dispose();
        if (this.renderer.domElement.parentElement === this.container) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
