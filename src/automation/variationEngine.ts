import type { StyleCapabilityMatrix, VisualMotif } from '../types';

// VariationEngine - PURE candidate scoring for the Visual OS layer (ADR-005).
//
// It NEVER generates musical semantics and NEVER mutates state. It only scores
// already-permitted realizations of an already-generated semantic frame: given the
// motif the ADR-003 semantic chain proposed, the active style's capability matrix,
// and a read-only view of recent history, it ranks the style-permitted motifs. The
// ChoreographyDirector owns selection and history; this module is referentially
// transparent and deterministic (no Math.random).

// Static, style-independent reading of how "energetic" each FORM reads on screen.
// Used only to fit a candidate motif to the semantic frame's intensity; it is not a
// renderer value and carries no tuning data.
const MOTIF_ENERGY: Record<VisualMotif, number> = {
    'pulse-field': 0.5,
    'orbit-system': 0.45,
    'tunnel-drive': 0.85,
    'network-bloom': 0.75,
    'fragment-cloud': 0.8,
    'wave-ripple': 0.35,
    'grid-scan': 0.55,
    'halo-focus': 0.3,
    'swarm-motion': 0.8,
    'void-minimal': 0.1
};

const WEIGHTS = { capability: 0.4, energy: 0.3, novelty: 0.2, history: 0.1 } as const;

// Default per-tier capability scores when a pack does not declare its own (data-driven via
// StyleCapabilityMatrix.weights). Mirrors the Preferred 0.9 / Supported 0.4 design intent.
const DEFAULT_CAPABILITY_WEIGHTS = { preferred: 0.9, supported: 0.4 } as const;

// What the engine reads from one already-generated semantic frame. Decoupled from the
// exact MotifChoreographyFrame/MotifPhrase shape so scoring stays testable in isolation.
export interface SceneSemanticInput {
    semanticMotif: VisualMotif | null; // the motif the ADR-003 chain proposed
    intensity: number;                 // 0..1 (motifIntensity)
    novelty: number;                   // 0..1
    variationSeed: number;             // deterministic seed carried from the phrase
}

export interface VariationContext {
    previousMotif: VisualMotif | null;
    // Read-only usage counts over the recent window; the director builds and owns these.
    recentUsage: Partial<Record<VisualMotif, number>>;
    recentWindow: number; // window size the counts were taken over (>= 1)
}

export interface MotifCandidate {
    motif: VisualMotif;
    score: number;
    // Component scores for traceability / tests (each 0..1 except score).
    capability: number;
    energyFit: number;
    noveltyFit: number;
    historyPenalty: number;
}

// Build the style-permitted candidate set: the semantic-proposed motif (continuity) plus
// the style's preferred and supported forms, minus everything forbidden. Order is
// deterministic: semantic motif first, then preferred (ranked), then supported.
export function buildCandidateMotifs(
    semanticMotif: VisualMotif | null,
    capability: StyleCapabilityMatrix
): VisualMotif[] {
    const forbidden = new Set(capability.forbidden);
    const out: VisualMotif[] = [];
    const seen = new Set<VisualMotif>();
    const push = (motif: VisualMotif | null | undefined) => {
        if (!motif || forbidden.has(motif) || seen.has(motif)) return;
        seen.add(motif);
        out.push(motif);
    };
    push(semanticMotif);
    for (const motif of capability.preferred) push(motif);
    for (const motif of capability.supported) push(motif);
    // Misconfigured pack (everything forbidden): fall back to the semantic motif so the
    // pipeline never produces an empty scene. void-minimal is the safe last resort.
    if (out.length === 0) push(semanticMotif ?? 'void-minimal');
    if (out.length === 0) { out.push('void-minimal'); }
    return out;
}

export function scoreMotifCandidates(
    input: SceneSemanticInput,
    capability: StyleCapabilityMatrix,
    ctx: VariationContext
): MotifCandidate[] {
    const candidates = buildCandidateMotifs(input.semanticMotif, capability);
    const preferredRank = new Map<VisualMotif, number>();
    capability.preferred.forEach((motif, index) => {
        if (!preferredRank.has(motif)) preferredRank.set(motif, index);
    });
    const supported = new Set(capability.supported);
    const weights = capability.weights ?? DEFAULT_CAPABILITY_WEIGHTS;
    const unlistedScore = (weights.preferred + weights.supported) / 2;
    const window = Math.max(1, ctx.recentWindow);
    const novelty = clamp01(input.novelty);
    const intensity = clamp01(input.intensity);

    const scored = candidates.map((motif) => {
        // Capability: data-driven per-tier weight. Earlier preferred ranks score slightly
        // higher via a small rank decay; the tier weights themselves come from the pack, so
        // a pack may legitimately weight supported above preferred.
        let capabilityScore: number;
        if (preferredRank.has(motif)) {
            const rank = preferredRank.get(motif)!;
            capabilityScore = Math.max(0, weights.preferred - rank * 0.03);
        } else if (supported.has(motif)) {
            capabilityScore = weights.supported;
        } else {
            capabilityScore = unlistedScore; // semantic motif the pack neither prefers nor lists
        }
        if (motif === input.semanticMotif) capabilityScore = Math.min(1, capabilityScore + 0.15);

        const energyFit = 1 - Math.abs(MOTIF_ENERGY[motif] - intensity);

        // High novelty rewards switching away from the previous motif; low novelty rewards
        // continuity. With no previous motif, treat as neutral continuity.
        const isContinuation = ctx.previousMotif != null && motif === ctx.previousMotif;
        const noveltyFit = ctx.previousMotif == null
            ? 0.5
            : isContinuation ? 1 - novelty : novelty;

        const usage = ctx.recentUsage[motif] ?? 0;
        const historyPenalty = clamp01(usage / window);

        const score =
            WEIGHTS.capability * capabilityScore +
            WEIGHTS.energy * clamp01(energyFit) +
            WEIGHTS.novelty * clamp01(noveltyFit) -
            WEIGHTS.history * historyPenalty;

        return { motif, score, capability: capabilityScore, energyFit: clamp01(energyFit), noveltyFit: clamp01(noveltyFit), historyPenalty };
    });

    // Deterministic ordering: higher score first; ties broken by a stable seed hash, then
    // by motif name so identical input always yields identical ranking.
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ha = tieHash(a.motif, input.variationSeed);
        const hb = tieHash(b.motif, input.variationSeed);
        if (hb !== ha) return hb - ha;
        return a.motif < b.motif ? -1 : a.motif > b.motif ? 1 : 0;
    });
    return scored;
}

function tieHash(motif: string, seed: number): number {
    let h = (Math.floor(seed) | 0) ^ 0x9e3779b9;
    for (let i = 0; i < motif.length; i++) {
        h = Math.imul(h ^ motif.charCodeAt(i), 0x01000193) >>> 0;
    }
    return (h >>> 0) / 0xffffffff;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
