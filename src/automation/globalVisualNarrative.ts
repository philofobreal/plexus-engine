import type {
    GlobalArcType,
    GlobalVisualNarrative,
    MovementGesture,
    SceneNarrativeBias,
    VisualScenePlan
} from '../types';

// Track-level interpretation of the already-generated semantic scene plan. This module consumes
// no audio and derives no new musical analysis.
export function planGlobalVisualNarrative(plan: VisualScenePlan): GlobalVisualNarrative {
    const scenes = plan.scenes ?? [];
    const narratives = scenes.map((scene) => scene.targetStateReference.split(':').pop() ?? 'groove');
    const dropIndices = narratives.flatMap((narrative, index) => narrative === 'release' || narrative === 'peak' ? [index] : []);
    const climaxSceneIndex = scenes.length > 0
        ? scenes.reduce((best, scene, index) => scene.behaviour.energy >= scenes[best].behaviour.energy ? index : best, 0)
        : undefined;
    const arcType = resolveArcType(dropIndices.length, narratives);
    const totalEnergyShape = resolveEnergyShape(scenes.map((scene) => scene.behaviour.energy));
    const primaryGestureFamily: MovementGesture[] = arcType === 'slow-burn'
        ? ['bloom', 'orbit', 'ripple']
        : ['drive', 'tunnel', 'pulse', 'swarm'];
    const secondaryGestureFamily: MovementGesture[] = arcType === 'fragmented'
        ? ['slice', 'fragment', 'scatter']
        : ['echo', 'fade', 'bloom', 'collapse'];
    const returnStrategy = dropIndices.length >= 2 ? 'evolve' : narratives.at(-1) === 'outro' ? 'dissolve' : 'repeat';

    let dropOrdinal = 0;
    const sceneBiases: SceneNarrativeBias[] = scenes.map((_, sceneIndex) => {
        const narrative = narratives[sceneIndex];
        const isDrop = narrative === 'release' || narrative === 'peak';
        if (isDrop) dropOrdinal++;
        const roleInTrack = sceneIndex === climaxSceneIndex ? 'climax'
            : narrative === 'outro' ? 'resolution'
            : climaxSceneIndex !== undefined && sceneIndex > climaxSceneIndex ? 'aftermath'
            : sceneIndex === 0 ? 'setup' : 'development';
        const gestureBias = roleInTrack === 'resolution' ? ['echo', 'fade', 'bloom'] as MovementGesture[]
            : isDrop && dropOrdinal > 1 ? [...secondaryGestureFamily, ...primaryGestureFamily]
            : roleInTrack === 'climax' ? ['swarm', 'tunnel', 'drive'] as MovementGesture[]
            : [...primaryGestureFamily];
        const variationBias = roleInTrack === 'setup' ? 'restrain'
            : roleInTrack === 'climax' ? 'intensify'
            : roleInTrack === 'resolution' || roleInTrack === 'aftermath' ? 'resolve' : 'open';
        return { sceneIndex, roleInTrack, gestureBias, variationBias };
    });

    return { arcType, totalEnergyShape, primaryGestureFamily, secondaryGestureFamily, returnStrategy, climaxSceneIndex, sceneBiases };
}

function resolveArcType(dropCount: number, narratives: string[]): GlobalArcType {
    if (dropCount >= 2) return 'two-drop';
    if (narratives.includes('breakdown') && dropCount > 0) return 'peak-and-release';
    if (dropCount === 0 && narratives.length >= 4) return 'slow-burn';
    if (narratives.filter((value) => value === 'build' || value === 'tension').length >= 2) return 'wave-cycle';
    return narratives.length <= 2 ? 'single-rise' : 'fragmented';
}

function resolveEnergyShape(energies: number[]): GlobalVisualNarrative['totalEnergyShape'] {
    if (energies.length < 2) return 'plateau';
    const first = energies[0];
    const last = energies.at(-1) ?? first;
    const range = Math.max(...energies) - Math.min(...energies);
    if (range < 0.15) return 'plateau';
    if (last > first + 0.15) return 'rising';
    if (last < first - 0.15) return 'falling';
    return 'wave';
}
