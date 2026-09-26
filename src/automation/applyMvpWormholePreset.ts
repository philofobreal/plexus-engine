import type { PerformanceAutomationPoint, VisualTuningConfig } from '../types';
import { wormholeMorphDurationFloor } from './morphFloor';
import { applyAutomationMorphAuthority } from './performanceAutomationRuntime';
import { filterForeignIdentityTuningForAutomation } from '../config/identityTuningRegistry';
import { normalizeVisualTuningConfig, mvpSurfaceTuningOverrides } from '../config/visualTuning';

/** Shared MVP preset merge and morph authority, without global state writes. */
export function applyMvpWormholePreset(target: VisualTuningConfig, payload: unknown, point: PerformanceAutomationPoint): void {
    const previousSpeed = target.wormholeSpeed;
    const previousBend = target.wormholePathBend;
    const previousBendVertical = target.wormholePathBendVertical;

    const filtered = filterForeignIdentityTuningForAutomation(
        (payload && typeof payload === 'object' ? payload : {}) as { visualMode?: unknown; visualTuning?: unknown },
        'cosmic-wormhole'
    );
    Object.assign(target, normalizeVisualTuningConfig(filtered, target));
    if (point.bendMirror) target.wormholePathBend = -target.wormholePathBend;

    // MVP surface policy (config-owned, see mvpSurfaceTuningOverrides): forced back to its
    // fixed value after every preset merge regardless of what the preset requested.
    Object.assign(target, mvpSurfaceTuningOverrides);

    const preset = filtered as { dramaturgyProfile?: Record<string, unknown> };
    const profile = preset.dramaturgyProfile;
    if (profile) {
        if (typeof profile.buildupIntensity === 'number') target.buildupIntensity = profile.buildupIntensity;
        if (typeof profile.dropDampening === 'number') target.dropDampening = profile.dropDampening;
        if (typeof profile.breakRestraint === 'number') target.breakRestraint = profile.breakRestraint;
        if (typeof profile.vocalHighlight === 'number') target.vocalHighlight = profile.vocalHighlight;
        if (typeof profile.fxChaos === 'number') target.fxChaos = profile.fxChaos;
    }

    applyAutomationMorphAuthority(target, point);
    const deltaSpeed = Math.abs(target.wormholeSpeed - previousSpeed);
    const deltaBend = Math.hypot(
        target.wormholePathBend - previousBend,
        target.wormholePathBendVertical - previousBendVertical
    );
    target.morphDurationSec = Math.max(point.morphDurationSec, wormholeMorphDurationFloor(deltaSpeed, deltaBend));
}
