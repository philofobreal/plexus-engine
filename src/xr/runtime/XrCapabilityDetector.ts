// Runtime WebXR capability detection (ADR-009). Feature-detects only; never inspects the
// user agent string to decide functionality.

export type ImmersiveVrSupport = 'unknown' | 'supported' | 'unsupported' | 'no-webxr';

/**
 * Resolves whether `immersive-vr` sessions are available. Always resolves (never throws): a
 * missing `navigator.xr`, a rejected `isSessionSupported()`, or any other runtime error all
 * resolve to a non-'supported' status so the caller can fail safe into the desktop preview.
 */
export async function detectImmersiveVrSupport(): Promise<ImmersiveVrSupport> {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr || typeof xr.isSessionSupported !== 'function') return 'no-webxr';

    try {
        const supported = await xr.isSessionSupported('immersive-vr');
        return supported ? 'supported' : 'unsupported';
    } catch {
        return 'unsupported';
    }
}
