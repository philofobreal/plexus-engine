import type { VisualMode, VisualTuningConfig } from '../types';

export type IdentityOwnedTuningKey = keyof VisualTuningConfig;

export const identityOwnedTuningKeys: Readonly<Record<string, readonly IdentityOwnedTuningKey[]>> = {
    'cosmic-wormhole': [
        'wormholeRadius',
        'wormholeDepth',
        'wormholeSpeed',
        'wormholeWarp',
        'wormholeCurve',
        'wormholePathBend',
        'wormholePathBendVertical',
        'wormholeRing',
        'wormholeDepthCoherence',
        'wormholeContinuity',
        'wormholeStarfield',
        'wormholeGalaxy',
        'wormholeSkybox',
        'wormholeEmissionMode',
        'wormholeJitter'
    ]
};

const keyOwners = buildIdentityTuningOwners(identityOwnedTuningKeys);

function buildIdentityTuningOwners(registry: Readonly<Record<string, readonly IdentityOwnedTuningKey[]>>): ReadonlyMap<IdentityOwnedTuningKey, string> {
    const owners = new Map<IdentityOwnedTuningKey, string>();
    for (const [identity, keys] of Object.entries(registry)) {
        for (const key of keys) {
            const existing = owners.get(key);
            if (existing && existing !== identity) throw new Error(`Tuning key '${key}' is owned by both '${existing}' and '${identity}'`);
            owners.set(key, identity);
        }
    }
    return owners;
}

export function ownedTuningKeysForIdentity(identity: string): readonly IdentityOwnedTuningKey[] {
    return identityOwnedTuningKeys[identity] ?? [];
}

export function ownerForTuningKey(key: string): string | undefined {
    return keyOwners.get(key as IdentityOwnedTuningKey);
}

export function filterForeignIdentityTuningForAutomation<T extends { visualMode?: unknown; visualTuning?: unknown }>(
    preset: T,
    activeIdentity: VisualMode
): T {
    const ownedKeys = ownedTuningKeysForIdentity(activeIdentity);
    if (!ownedKeys.length) return preset;
    if (preset.visualMode === activeIdentity) return preset;
    if (typeof preset.visualMode !== 'string') return preset;
    if (!preset.visualTuning || typeof preset.visualTuning !== 'object') return preset;

    const blocked = new Set<string>(ownedKeys);
    const filteredTuning = Object.fromEntries(
        Object.entries(preset.visualTuning as Record<string, unknown>).filter(([key]) => !blocked.has(key))
    );
    return { ...preset, visualTuning: filteredTuning };
}
