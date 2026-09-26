// Isolated Quest 3 performance policy (ADR-009). Requests a stable 72 Hz session and a
// conservative foveation level only when the platform exposes the capability; never fails
// startup when it does not, and never identifies the platform by user-agent parsing.

import type { WebXRManager } from 'three';

const TARGET_FRAME_RATE_HZ = 72;
/** Conservative, centralized foveation level: 0 disables, 1 is maximum. */
const CONSERVATIVE_FOVEATION = 0.3;

/**
 * Requests the MVP's stable frame-rate target when the session exposes frame-rate selection.
 * Silently does nothing on a session/browser without the capability (never throws, never blocks
 * startup).
 */
export async function applyTargetFrameRate(session: XRSession): Promise<void> {
    const supportedRates = session.supportedFrameRates;
    if (!supportedRates || typeof session.updateTargetFrameRate !== 'function') return;

    if (!Array.from(supportedRates).includes(TARGET_FRAME_RATE_HZ)) return;

    try {
        await session.updateTargetFrameRate(TARGET_FRAME_RATE_HZ);
    } catch {
        // Frame-rate selection is a best-effort optimization; never fail startup over it.
    }
}

/** Applies a conservative fixed foveation level when the renderer's XR manager supports it. */
export function applyConservativeFoveation(xrManager: WebXRManager): void {
    if (typeof xrManager.setFoveation !== 'function') return;
    try {
        xrManager.setFoveation(CONSERVATIVE_FOVEATION);
    } catch {
        // Foveation is an optional optimization; a platform that rejects it keeps rendering normally.
    }
}
