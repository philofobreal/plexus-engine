import { classicPlexusIdentity } from './ClassicPlexusEffect';
import { cosmicWormholeIdentity } from './CosmicWormholeIdentity';
import { featureFlags } from '../config/featureFlags';
import { cyberpunkIdentity } from './CyberpunkIdentity';
import { darkTechnoIdentity } from './DarkTechnoIdentity';
import { heroEffectIdentity } from './HeroEffectIdentity';
import { organicAmbientIdentity } from './OrganicAmbientIdentity';
import { temporalMusicIdentity } from './TemporalMusicEffect';
import type { VisualIdentity } from './VisualIdentity';

const CLASSIC_STYLE_ID = 'classic';

export class StyleRegistry {
    private readonly identities = new Map<string, VisualIdentity>();

    register(identity: VisualIdentity): void {
        this.identities.set(identity.id, identity);
    }

    get(id: string): VisualIdentity {
        const identity = this.identities.get(id);
        if (identity) return identity;

        const fallback = this.identities.get(CLASSIC_STYLE_ID);
        if (!fallback) throw new Error(`Visual identity "${CLASSIC_STYLE_ID}" is not registered`);
        return fallback;
    }

    forEach(callback: (identity: VisualIdentity) => void): void {
        this.identities.forEach(callback);
    }
}

export function createDefaultStyleRegistry(): StyleRegistry {
    const registry = new StyleRegistry();
    registry.register(classicPlexusIdentity);
    registry.register(temporalMusicIdentity);
    registry.register(darkTechnoIdentity);
    registry.register(organicAmbientIdentity);
    registry.register(cyberpunkIdentity);
    registry.register(cosmicWormholeIdentity);
    if (featureFlags.heroEffect === true) {
        registry.register(heroEffectIdentity);
    }
    return registry;
}
