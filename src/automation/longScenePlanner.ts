import type { AutomationSituation, LongScenePhase, LongSceneSection, MovementGesture, VariantRole } from '../types';

interface PhaseTemplate {
    phase: LongScenePhase;
    share: number;
    roles: VariantRole[];
    gestures: MovementGesture[];
    intensityBias: number;
}

const ENERGETIC: PhaseTemplate[] = [
    { phase: 'entry', share: 0.16, roles: ['primary'], gestures: ['drive', 'pulse'], intensityBias: 0.9 },
    { phase: 'establish', share: 0.24, roles: ['primary', 'secondary'], gestures: ['drive', 'lock'], intensityBias: 1 },
    { phase: 'intensify', share: 0.24, roles: ['secondary', 'focus'], gestures: ['slice', 'fragment', 'expand'], intensityBias: 1.1 },
    { phase: 'peak', share: 0.23, roles: ['primary', 'focus'], gestures: ['tunnel', 'swarm', 'drive'], intensityBias: 1.2 },
    { phase: 'release', share: 0.13, roles: ['release'], gestures: ['echo', 'fade', 'bloom'], intensityBias: 0.75 }
];

const REFLECTIVE: PhaseTemplate[] = [
    { phase: 'entry', share: 0.2, roles: ['sparse'], gestures: ['fade', 'collapse'], intensityBias: 0.7 },
    { phase: 'develop', share: 0.35, roles: ['primary', 'focus'], gestures: ['bloom', 'orbit', 'ripple'], intensityBias: 0.9 },
    { phase: 'counter', share: 0.25, roles: ['secondary'], gestures: ['ripple', 'echo'], intensityBias: 0.85 },
    { phase: 'decay', share: 0.2, roles: ['release', 'sparse'], gestures: ['fade', 'echo'], intensityBias: 0.65 }
];

export function planLongScene(situation: AutomationSituation, durationSec: number): LongSceneSection[] {
    const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    if (duration <= 0) return [];
    if (duration < 24) return [{
        phase: 'entry', offsetSec: 0, durationSec: duration,
        preferredRoles: ['primary'], preferredGestures: [], intensityBias: 1
    }];

    const reflective = situation === 'breakdown-long' || situation === 'outro-dissolve' || situation === 'transition-release';
    const templates = reflective ? REFLECTIVE : ENERGETIC;
    let offset = 0;
    return templates.map((template, index) => {
        const sectionDuration = index === templates.length - 1 ? duration - offset : duration * template.share;
        const section: LongSceneSection = {
            phase: template.phase,
            offsetSec: offset,
            durationSec: sectionDuration,
            preferredRoles: [...template.roles],
            preferredGestures: [...template.gestures],
            intensityBias: template.intensityBias
        };
        offset += sectionDuration;
        return section;
    });
}
