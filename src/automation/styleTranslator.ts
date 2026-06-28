import type {
    BehaviourBias,
    BehaviourState,
    MovementGesture,
    ResolvedStylePack,
    ResolvedSubstyle,
    SceneIntent,
    StyleCapabilityMatrix,
    StylePackDefinition,
    StylePacksFile,
    StyleMovementVocabularyMap,
    StyleSubstyleDefinition,
    VisualMotif,
    VisualPalette,
    VisualScene,
    VisualScenePlan,
    VisualVocabulary
} from '../types';

// StyleTranslator - Visual OS Style Translation Pipeline (ADR-005). Pure, offline,
// deterministic. It turns a selected SceneIntent (already produced by the
// ChoreographyDirector from ADR-003 semantic output) into a renderer-INDEPENDENT
// VisualScene through the chain:
//   Style Resolver -> Visual Grammar -> Capability Filter -> Behaviour Resolver -> VisualScene
//
// CRITICAL (Renderer Independence Contract): this module never emits tuning keys or
// preset filenames. `VisualScene.targetStateReference` is an OPAQUE handle; only
// scenePlanAdapter resolves it to a concrete preset via the pack's targetMap.

// Runtime validation tables (TS unions are erased at runtime).
const KNOWN_MOTIFS: ReadonlySet<VisualMotif> = new Set<VisualMotif>([
    'pulse-field', 'orbit-system', 'tunnel-drive', 'network-bloom', 'fragment-cloud',
    'wave-ripple', 'grid-scan', 'halo-focus', 'swarm-motion', 'void-minimal'
]);
const KNOWN_PALETTES: ReadonlySet<VisualPalette> = new Set<VisualPalette>([
    'mono', 'duotone', 'neon', 'earth', 'spectral', 'void'
]);
const KNOWN_MOVEMENT_GESTURES: ReadonlySet<MovementGesture> = new Set<MovementGesture>([
    'pulse', 'drive', 'orbit', 'scatter', 'collapse', 'expand', 'bloom', 'fragment',
    'ripple', 'slice', 'tunnel', 'swarm', 'lock', 'echo', 'fade'
]);

const MAX_INHERITANCE_DEPTH = 16;

// -- Style Resolver: flatten single-parent inheritance ------------------------

export function resolveStylePack(file: StylePacksFile, packId: string): ResolvedStylePack {
    const byId = new Map<string, StylePackDefinition>();
    for (const def of file.packs ?? []) byId.set(def.id, def);

    // Walk parent chain leaf -> root, detecting cycles and missing parents atomically.
    const chain: StylePackDefinition[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined = packId;
    while (cursor) {
        const def = byId.get(cursor);
        if (!def) throw new Error(`StylePack '${cursor}' not found (referenced from '${packId}')`);
        if (seen.has(cursor)) throw new Error(`StylePack inheritance cycle at '${cursor}'`);
        seen.add(cursor);
        chain.push(def);
        if (chain.length > MAX_INHERITANCE_DEPTH) throw new Error(`StylePack inheritance too deep at '${packId}'`);
        cursor = def.extends;
    }
    chain.reverse(); // root -> leaf

    let acc: ResolvedStylePack = baseResolvedPack(packId);
    for (const def of chain) acc = applyLayer(acc, def);
    acc.id = packId;

    // Resolve substyles against the fully-resolved pack (pack acts as parent, substyle as child).
    const substyles: Record<string, ResolvedSubstyle> = {};
    const mergedSubstyleDefs = new Map<string, StyleSubstyleDefinition>();
    for (const def of chain) {
        for (const [name, sub] of Object.entries(def.substyles ?? {})) mergedSubstyleDefs.set(name, sub);
    }
    for (const [name, sub] of mergedSubstyleDefs) {
        substyles[name] = {
            label: sub.label ?? `${acc.label} ${name}`,
            capabilities: mergeCapabilities(acc.capabilities, sub.capabilities),
            vocabulary: { ...acc.vocabulary, ...sub.vocabulary },
            behaviour: { ...acc.behaviour, ...sub.behaviour },
            targetMap: { ...acc.targetMap, ...sub.targetMap },
            // Per-situation override/extend, mirroring targetMap inheritance.
            variantPairs: { ...acc.variantPairs, ...sub.variantPairs },
            behaviourVocabulary: { ...acc.behaviourVocabulary, ...sub.behaviourVocabulary },
            movementVocabulary: mergeMovementVocabulary(acc.movementVocabulary, sub.movementVocabulary)
        };
        validatePalette(substyles[name].vocabulary.palette);
        validateCapabilities(substyles[name].capabilities);
    }
    acc.substyles = substyles;

    validateCapabilities(acc.capabilities);
    validatePalette(acc.vocabulary.palette);
    return acc;
}

export function tryResolveStylePack(file: StylePacksFile, packId: string): ResolvedStylePack | null {
    try {
        return resolveStylePack(file, packId);
    } catch {
        return null;
    }
}

function baseResolvedPack(id: string): ResolvedStylePack {
    return {
        id,
        label: id,
        capabilities: { preferred: [], supported: [], forbidden: [], palettes: { preferred: [], forbidden: [] }, weights: { preferred: 0.9, supported: 0.4 } },
        vocabulary: { palette: 'spectral', lineCharacter: 0.5, glowCharacter: 0.5, grain: 0.3, contrast: 0.5 },
        behaviour: { energy: 0, density: 0, motion: 0, volatility: 0, cohesion: 0 },
        substyles: {},
        targetMap: {},
        variantPairs: {},
        behaviourVocabulary: {},
        movementVocabulary: {}
    };
}

function applyLayer(acc: ResolvedStylePack, def: StylePackDefinition): ResolvedStylePack {
    return {
        id: def.id,
        label: def.label ?? acc.label,
        capabilities: mergeCapabilities(acc.capabilities, def.capabilities),
        vocabulary: { ...acc.vocabulary, ...def.vocabulary },
        behaviour: { ...acc.behaviour, ...def.behaviour },
        substyles: acc.substyles,
        targetMap: { ...acc.targetMap, ...def.targetMap },
        // Variant pairs override/extend per situation (child wins for a given situation key,
        // unlisted situations are inherited). They are the planner's vocabulary fallback when
        // no explicit behaviourVocabulary is authored for a situation.
        variantPairs: { ...acc.variantPairs, ...def.variantPairs },
        // Behaviour vocabulary inherits the same way: child situation list wins, others inherit.
        behaviourVocabulary: { ...acc.behaviourVocabulary, ...def.behaviourVocabulary },
        movementVocabulary: mergeMovementVocabulary(acc.movementVocabulary, def.movementVocabulary)
    };
}

function mergeMovementVocabulary(parent: StyleMovementVocabularyMap, child?: StyleMovementVocabularyMap): StyleMovementVocabularyMap {
    const merged: StyleMovementVocabularyMap = { ...parent };
    for (const [situation, values] of Object.entries(child ?? {})) {
        const valid = (values ?? []).filter((value): value is MovementGesture => KNOWN_MOVEMENT_GESTURES.has(value as MovementGesture));
        if (valid.length > 0) merged[situation as keyof StyleMovementVocabularyMap] = valid;
    }
    return merged;
}

// Capability merge rules (ADR-005): forbidden is additive; a child can re-enable a parent
// forbade form only by explicitly listing it in its own preferred/supported. preferred and
// supported accumulate (union), so a restrictive child reduces options by FORBIDDING, which
// removes the form from preferred/supported.
function mergeCapabilities(parent: StyleCapabilityMatrix, child?: Partial<StyleCapabilityMatrix>): StyleCapabilityMatrix {
    const c = child ?? {};
    const reEnabled = new Set<VisualMotif>([...(c.preferred ?? []), ...(c.supported ?? [])]);
    const forbidden = dedupe([...(parent.forbidden ?? []), ...(c.forbidden ?? [])]).filter((m) => !reEnabled.has(m));
    const forbiddenSet = new Set(forbidden);

    const preferred = dedupe([...(parent.preferred ?? []), ...(c.preferred ?? [])]).filter((m) => !forbiddenSet.has(m));
    const preferredSet = new Set(preferred);
    const supported = dedupe([...(parent.supported ?? []), ...(c.supported ?? [])])
        .filter((m) => !forbiddenSet.has(m) && !preferredSet.has(m));

    const emptyPalettes = { preferred: [] as VisualPalette[], forbidden: [] as VisualPalette[] };
    const pParent = parent.palettes ?? emptyPalettes;
    const pChild = c.palettes ?? emptyPalettes;
    const palReEnabled = new Set<VisualPalette>(pChild.preferred ?? []);
    const palForbidden = dedupe([...(pParent.forbidden ?? []), ...(pChild.forbidden ?? [])]).filter((p) => !palReEnabled.has(p));
    const palForbiddenSet = new Set(palForbidden);
    const palPreferred = dedupe([...(pParent.preferred ?? []), ...(pChild.preferred ?? [])]).filter((p) => !palForbiddenSet.has(p));

    // Weights are data-driven and overridable per layer; a child without weights inherits the parent's.
    const weights = c.weights ?? parent.weights;
    return { preferred, supported, forbidden, palettes: { preferred: palPreferred, forbidden: palForbidden }, weights };
}

function validateCapabilities(cap: StyleCapabilityMatrix): void {
    for (const motif of [...cap.preferred, ...cap.supported, ...cap.forbidden]) {
        if (!KNOWN_MOTIFS.has(motif)) throw new Error(`Unknown motif in capability matrix: '${motif}'`);
    }
    for (const palette of [...cap.palettes.preferred, ...cap.palettes.forbidden]) {
        validatePalette(palette);
    }
}

function validatePalette(palette: VisualPalette): void {
    if (!KNOWN_PALETTES.has(palette)) throw new Error(`Unknown palette: '${palette}'`);
}

// -- Per-scene translation: Grammar -> Capability Filter -> Behaviour -> Scene -

export function translateScene(scene: SceneIntent, pack: ResolvedStylePack, substyle?: string): VisualScene {
    const sub = substyle ? pack.substyles[substyle] : undefined;
    const capability = sub?.capabilities ?? pack.capabilities;
    const vocabularyBase = sub?.vocabulary ?? pack.vocabulary;
    const behaviourBias = sub?.behaviour ?? pack.behaviour;

    // Visual Grammar: keep the director-selected FORM; derive the MATERIAL (vocabulary) for
    // this style, choosing a permitted palette.
    const vocabulary = deriveVocabulary(vocabularyBase, capability);

    // Capability Filter (defense in depth): the director already selects within capability,
    // but guarantee the final motif is permitted; substitute the top preferred form if not.
    const motif = filterMotif(scene.motif, capability);

    // Behaviour Resolver: bias the semantic-derived behaviour by the style, then clamp.
    const behaviour = applyBias(scene.behaviour, behaviourBias);

    const effectivePackId = substyle ? `${pack.id}#${substyle}` : pack.id;
    return {
        timeSec: scene.timeSec,
        durationSec: scene.durationSec,
        stylePack: pack.id,
        substyle,
        motif,
        vocabulary,
        behaviour,
        evolution: scene.evolution,
        microEvents: scene.microEvents,
        transition: scene.transition,
        // OPAQUE handle. The key after ':' is the targetMap lookup the adapter performs.
        targetStateReference: `${effectivePackId}:${scene.narrative}`
    };
}

export function translateScenePlan(scenes: SceneIntent[], pack: ResolvedStylePack, substyle?: string): VisualScenePlan {
    return {
        version: 1,
        stylePack: pack.id,
        scenes: scenes.map((scene) => translateScene(scene, pack, substyle))
    };
}

function deriveVocabulary(base: VisualVocabulary, capability: StyleCapabilityMatrix): VisualVocabulary {
    return { ...base, palette: choosePalette(base.palette, capability) };
}

function choosePalette(preferredPalette: VisualPalette, capability: StyleCapabilityMatrix): VisualPalette {
    const forbidden = new Set(capability.palettes.forbidden);
    if (!forbidden.has(preferredPalette)) return preferredPalette;
    const fallback = capability.palettes.preferred.find((p) => !forbidden.has(p));
    return fallback ?? 'mono';
}

function filterMotif(motif: VisualMotif, capability: StyleCapabilityMatrix): VisualMotif {
    if (!capability.forbidden.includes(motif)) return motif;
    return capability.preferred[0] ?? capability.supported[0] ?? 'void-minimal';
}

function applyBias(behaviour: BehaviourState, bias: BehaviourBias): BehaviourState {
    return {
        energy: clamp01(behaviour.energy + bias.energy),
        density: clamp01(behaviour.density + bias.density),
        motion: clamp01(behaviour.motion + bias.motion),
        volatility: clamp01(behaviour.volatility + bias.volatility),
        cohesion: clamp01(behaviour.cohesion + bias.cohesion)
    };
}

function dedupe<T>(items: T[]): T[] {
    const seen = new Set<T>();
    const out: T[] = [];
    for (const item of items) {
        if (seen.has(item)) continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
