import { classicPlexusIdentity } from './ClassicPlexusEffect';
import { cyberpunkIdentity } from './CyberpunkIdentity';
import { darkTechnoIdentity } from './DarkTechnoIdentity';
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
}

export function createDefaultStyleRegistry(): StyleRegistry {
    const registry = new StyleRegistry();
    registry.register(classicPlexusIdentity);
    registry.register(temporalMusicIdentity);
    registry.register(darkTechnoIdentity);
    registry.register(organicAmbientIdentity);
    registry.register(cyberpunkIdentity);
    return registry;
}
