import type {
    AutomationEnvelope,
    AutomationSituation,
    BehaviourState,
    ChoreographyPlan,
    ChoreographySegment,
    DramaturgyVariantMode,
    NarrativeType,
    MovementGesture,
    TempoContext,
    VariantRole,
    VariationProfile,
    VariationMemoryState,
    LongSceneSection
} from '../types';
import { resolveMovementGesture } from './movementGrammar';

// microChoreographyPlanner - PURE, deterministic micro-choreography planner (ADR-005 extension,
// successor to variantPairPlanner). Given a classified AutomationSituation, the scene's duration
// + behaviour + absolute start, a TempoContext and a VariationProfile, it produces an ordered set
// of ChoreographySegments. Each segment carries a BEHAVIOUR INTENT (a role + an OPAQUE target
// handle + a relative intensity) and an AutomationEnvelope (attack/sustain/release/cooldown).
//
// Responsibilities: WHAT plays and WHEN (adaptive, bar-snapped subdivision; a behaviour-cycle
// grammar with weighted recency memory; per-segment envelopes), all from a deterministic seed.
// It decides NOTHING about presets or tuning.
//
// CRITICAL (Renderer Independence Contract): this module never sees or emits a preset filename or
// a tuning key. `target` is an opaque handle (e.g. "drop.primary"); scenePlanAdapter alone
// resolves it via the pack targetMap, and alone turns the envelope into PerformanceAutomationPoints.

export interface MicroChoreographyInput {
    situation: AutomationSituation;
    startSec: number;            // absolute scene start (seconds); used only for bar alignment
    durationSec: number;
    behaviour: BehaviourState;   // energy/volatility shape the envelope character
    narrative?: NarrativeType;
    movementVocabulary?: MovementGesture[];
    // Ordered list of OPAQUE behaviour-family handles the planner may use, resolved by the
    // adapter (authored vocabulary -> variantPairs -> narrative fallback). Index 0 is the home
    // family. Must contain at least one handle.
    vocabulary: string[];
    vocabularyId: string;        // provenance id for the chosen vocabulary
}

export interface MicroChoreographyOptions {
    variation: VariationProfile;
    // Hard cap on the number of segments (= attack waypoints) for the scene, supplied by the
    // adapter from the DramaturgyActivityLevel. Activity is the DENSITY axis; Variation is style.
    activityCap: number;
    // Density multiplier on the target segment length from the DramaturgyActivityLevel: <1 makes
    // segments shorter (denser, 'active'), >1 longer (sparser, 'macro'). Defaults to 1 ('balanced')
    // so Activity is a genuine density control, not merely an upper cap. See resolveSegmentCount.
    activityDensityScale?: number;
    tempo: TempoContext;
    memory?: VariationMemoryState;
    longSceneSections?: LongSceneSection[];
    // Optional authored pacing from the selected style-pack variant pair. Omitted means
    // the legacy subdivision path is used unchanged.
    segmentSecRange?: { min: number; max: number };
}

export interface MicroChoreographyContext {
    trackSeed: number;
    sceneIndex: number;
}

// Minimum musical room a single segment may occupy, so a long scene never shatters into
// sub-second slivers regardless of the activity cap.
const MIN_SEGMENT_SEC = 2.0;
// A morph (attack) is never shorter than this, so the engine always has a usable transition.
const MIN_ATTACK_SEC = 0.12;

// Per-situation choreography character: the base subdivision (in bars), the role palette the
// cycle grammar draws from (index 0 is the home role), and the base envelope phase shares
// (attack/sustain/release as fractions of a segment; the remainder is the cooldown breath).
interface SituationProfile {
    segBars: number;
    roles: VariantRole[];
    attack: number;
    sustain: number;
    release: number;
}

// segBars = base target segment length in bars. Kept deliberately SMALL so a long sustained scene
// breaks into several behaviour beats instead of one giant block; the activity density scale and
// variation subdivision scale then stretch/shrink from here (see resolveSegmentCount).
const SITUATION_PROFILES: Record<AutomationSituation, SituationProfile> = {
    'intro-establish':    { segBars: 5, roles: ['primary', 'focus', 'secondary'],            attack: 0.34, sustain: 0.30, release: 0.18 },
    'verse-long':         { segBars: 4, roles: ['primary', 'secondary', 'focus'],            attack: 0.18, sustain: 0.34, release: 0.20 },
    'groove-sustain':     { segBars: 3, roles: ['primary', 'secondary', 'focus', 'sparse'],  attack: 0.16, sustain: 0.40, release: 0.18 },
    'buildup-ramp':       { segBars: 2, roles: ['sparse', 'primary', 'secondary'],           attack: 0.30, sustain: 0.34, release: 0.12 },
    'drop-short':         { segBars: 2, roles: ['primary', 'secondary'],                     attack: 0.12, sustain: 0.30, release: 0.18 },
    'drop-long':          { segBars: 2, roles: ['primary', 'secondary', 'release', 'focus'], attack: 0.12, sustain: 0.34, release: 0.20 },
    'drop-after-build':   { segBars: 2, roles: ['primary', 'secondary', 'release'],          attack: 0.12, sustain: 0.30, release: 0.28 },
    'breakdown-long':     { segBars: 3, roles: ['sparse', 'primary', 'focus', 'secondary'],  attack: 0.22, sustain: 0.30, release: 0.24 },
    'peak-sustain':       { segBars: 2, roles: ['primary', 'secondary', 'focus'],            attack: 0.14, sustain: 0.44, release: 0.16 },
    'transition-release': { segBars: 2, roles: ['primary', 'release', 'sparse'],             attack: 0.16, sustain: 0.24, release: 0.34 },
    'outro-dissolve':     { segBars: 5, roles: ['focus', 'release', 'sparse'],               attack: 0.30, sustain: 0.26, release: 0.30 }
};

// VARIATION = choreography complexity/style (NOT density). See ADR-005 section 7 and the table
// in the directive. vocabularySize caps distinct families; subdivisionScale stretches/shrinks
// segments; the *Frequency knobs drive the cycle grammar; lifetimeScale governs the cooldown
// breath; randomnessBudget bounds the (seeded) jitter. Density is a separate axis (activityCap).
export const VARIATION_PROFILES: Record<DramaturgyVariantMode, VariationProfile> = {
    stable:     { mode: 'stable',     vocabularySize: 1, subdivisionScale: 1.6,  transitionFrequency: 0.25, releaseFrequency: 0.20, callbackFrequency: 0.85, weightedMemoryStrength: 0.80, randomnessBudget: 0.10, lifetimeScale: 1.3 },
    paired:     { mode: 'paired',     vocabularySize: 3, subdivisionScale: 1.0,  transitionFrequency: 0.55, releaseFrequency: 0.50, callbackFrequency: 0.50, weightedMemoryStrength: 0.50, randomnessBudget: 0.20, lifetimeScale: 1.0 },
    expressive: { mode: 'expressive', vocabularySize: 6, subdivisionScale: 0.65, transitionFrequency: 0.80, releaseFrequency: 0.75, callbackFrequency: 0.30, weightedMemoryStrength: 0.30, randomnessBudget: 0.35, lifetimeScale: 0.75 }
};

export function variationProfileFor(mode: DramaturgyVariantMode): VariationProfile {
    return VARIATION_PROFILES[mode] ?? VARIATION_PROFILES.paired;
}

// Low-confidence damping threshold. Mirrors the resolveSegmentCount coarsening threshold so the
// two low-confidence behaviours (fewer segments, calmer variation) engage together.
const LOW_CONFIDENCE_THRESHOLD = 0.35;

// dampVariationForConfidence - GLOBAL Visual OS low-confidence safety rule. It runs for every
// style pack (this planner is style-agnostic), not just a specific identity profile. When the
// tempo context carries REAL timing evidence (bpm/bars present) but that evidence is
// untrustworthy, the variation profile is damped toward a simpler dramaturgy: at most two
// behaviour families, rarer switching/releases, less seeded jitter, and a longer trailing breath.
// A neutral context with no tempo at all (direct adapter callers) is left untouched - absence of
// timing is not evidence of bad timing. ALWAYS returns a fresh clone; never mutates the input or
// VARIATION_PROFILES.
export function dampVariationForConfidence(variation: VariationProfile, tempo: TempoContext): VariationProfile {
    const damped: VariationProfile = { ...variation };
    const hasEvidence = tempo.bpm > 0 || tempo.bars.length >= 2 || (typeof tempo.secondsPerBar === 'number' && tempo.secondsPerBar > 0);
    if (!hasEvidence) return damped;
    const confidence = clamp01(tempo.confidence);
    const below = confidence < LOW_CONFIDENCE_THRESHOLD ? 1 - confidence / LOW_CONFIDENCE_THRESHOLD : 0;
    const strength = Math.max(below, tempo.reliable ? 0 : 0.5);
    if (strength <= 0) return damped;
    damped.vocabularySize = Math.min(damped.vocabularySize, 2);
    damped.transitionFrequency *= 1 - 0.5 * strength;
    damped.releaseFrequency *= 1 - 0.5 * strength;
    damped.randomnessBudget *= 1 - 0.6 * strength;
    damped.lifetimeScale *= 1 + 0.3 * strength;
    return damped;
}

// Plan a scene's micro-choreography. ALWAYS returns a plan (>=1 segment): even a stable, short,
// or vocabulary-less scene yields a single home-family segment with its own envelope, so the
// adapter has a uniform path and stable scenes still "breathe".
export function planMicroChoreography(
    input: MicroChoreographyInput,
    options: MicroChoreographyOptions,
    ctx: MicroChoreographyContext
): ChoreographyPlan {
    const profile = SITUATION_PROFILES[input.situation] ?? SITUATION_PROFILES['verse-long'];
    const variation = dampVariationForConfidence(options.variation, options.tempo);
    const duration = Number.isFinite(input.durationSec) && input.durationSec > 0 ? input.durationSec : 0;

    // Effective family list: cap the resolved vocabulary to the variation's vocabulary size.
    const families = dedupe(input.vocabulary.filter((h) => typeof h === 'string' && h.length > 0));
    const familyPool = families.length > 0 ? families.slice(0, Math.max(1, Math.round(variation.vocabularySize))) : ['default'];

    if (duration <= 0) {
        return { situation: input.situation, vocabularyId: input.vocabularyId, segments: [] };
    }

    const count = resolveSegmentCount(duration, profile, variation, options.tempo, options.activityCap, options.activityDensityScale ?? 1, options.segmentSecRange);
    const boundaries = computeBoundaries(input.startSec, duration, count, options.tempo);
    const roles = generateRoles(count, profile, variation, ctx);

    const segments: ChoreographySegment[] = [];
    const lastTarget = options.memory?.recentTargets.at(-1);
    let prevFamily = lastTarget ? familyPool.indexOf(lastTarget) : -1;
    let previousGesture: ChoreographySegment['movementGesture'] | undefined = options.memory?.recentGestures.at(-1);
    for (let i = 0; i < count; i++) {
        const offsetSec = boundaries[i];
        const segDuration = boundaries[i + 1] - offsetSec;
        const longSection = sectionAt(options.longSceneSections, offsetSec + segDuration * 0.5);
        const generatedRole = roles[i];
        const role = longSection?.preferredRoles.length
            ? longSection.preferredRoles[i % longSection.preferredRoles.length]
            : generatedRole;
        const familyIndex = pickFamily(role, familyPool, prevFamily, options.memory?.familyUseCounts);
        const movementGesture = resolveMovementGesture({
            situation: input.situation,
            variantRole: role,
            behaviour: input.behaviour,
            narrative: input.narrative,
            variationMode: variation.mode,
            previousGesture,
            movementVocabulary: mergeGestures(longSection?.preferredGestures, input.movementVocabulary),
            gestureUseCounts: options.memory?.gestureUseCounts
        });
        prevFamily = familyIndex;
        previousGesture = movementGesture;
        segments.push({
            index: i,
            offsetSec,
            durationSec: segDuration,
            role,
            target: familyPool[familyIndex],
            movementGesture,
            longScenePhase: longSection?.phase,
            intensityScale: clamp(intensityForRole(role, input.behaviour, i, count) * (longSection?.intensityBias ?? 1), 0.4, 1.3),
            envelope: computeEnvelope(role, profile, segDuration, input.behaviour, variation, options.tempo, ctx, i)
        });
    }

    return { situation: input.situation, vocabularyId: input.vocabularyId, segments };
}

function sectionAt(sections: LongSceneSection[] | undefined, offsetSec: number): LongSceneSection | undefined {
    return sections?.find((section) => offsetSec >= section.offsetSec && offsetSec < section.offsetSec + section.durationSec)
        ?? sections?.at(-1);
}

function mergeGestures(primary: MovementGesture[] | undefined, secondary: MovementGesture[] | undefined): MovementGesture[] | undefined {
    const authored = secondary ?? [];
    const allowed = new Set(authored);
    const preferred = authored.length > 0 ? (primary ?? []).filter((gesture) => allowed.has(gesture)) : (primary ?? []);
    const merged = [...preferred, ...authored];
    return merged.length > 0 ? [...new Set(merged)] : undefined;
}

// -- Adaptive subdivision -----------------------------------------------------

// Segment count from scene type (situation), tempo/bar structure, variation style, the activity
// DENSITY scale, scene length and confidence; finally clamped by the activity cap and the room cap.
// `densityScale` < 1 ('active') shortens the target segment so more beats fit; > 1 ('macro')
// lengthens it. Low confidence coarsens (fewer, longer segments). No tempo falls back to an equal
// time split with an assumed bar length. ceil (not round) so a long scene whose natural division is
// e.g. 1.4 segments still yields 2 rather than collapsing into one block.
function resolveSegmentCount(
    duration: number,
    profile: SituationProfile,
    variation: VariationProfile,
    tempo: TempoContext,
    activityCap: number,
    densityScale: number,
    segmentSecRange?: { min: number; max: number }
): number {
    const scale = Number.isFinite(densityScale) && densityScale > 0 ? densityScale : 1;
    let targetSegBars = Math.max(0.5, profile.segBars * variation.subdivisionScale * scale);
    if (!tempo.reliable || tempo.confidence < 0.35) targetSegBars *= 1.5;

    const secondsPerBar = tempo.secondsPerBar;
    let count: number;
    if (secondsPerBar && secondsPerBar > 0) {
        count = Math.ceil((duration / secondsPerBar) / targetSegBars);
    } else {
        const approxSegSec = Math.max(MIN_SEGMENT_SEC, targetSegBars * 2.0); // assume ~2s bars
        count = Math.ceil(duration / approxSegSec);
    }

    const cap = Math.max(1, Math.floor(activityCap));
    const roomCap = Math.max(1, Math.floor(duration / MIN_SEGMENT_SEC));
    if (!isValidSegmentSecRange(segmentSecRange)) return clampInt(count, 1, Math.min(cap, roomCap));

    const minSegmentSec = Math.max(MIN_SEGMENT_SEC, segmentSecRange.min);
    const baseSegmentSec = secondsPerBar && secondsPerBar > 0
        ? targetSegBars * secondsPerBar
        : Math.max(MIN_SEGMENT_SEC, targetSegBars * 2.0);
    const targetSegmentSec = clamp(baseSegmentSec, minSegmentSec, segmentSecRange.max);
    // ceil keeps the target length at or below the pair's authored maximum. The lower room cap
    // prevents equal subdivision from making segments shorter than the pair minimum; bar snapping
    // below may move an interior boundary by at most one bar.
    const rangeCount = Math.min(Math.ceil(duration / targetSegmentSec), Math.max(1, Math.floor(duration / minSegmentSec)));
    return clampInt(rangeCount, 1, Math.min(cap, roomCap));
}

function isValidSegmentSecRange(range: { min: number; max: number } | undefined): range is { min: number; max: number } {
    return !!range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min > 0 && range.min <= range.max;
}

// Segment boundaries (scene-relative, ascending, [0..duration]). Interior boundaries snap to the
// nearest bar start when the grid is reliable, so behaviour switches land on the music; otherwise
// an equal time split. Always strictly increasing so no segment collapses to zero length.
function computeBoundaries(startSec: number, duration: number, count: number, tempo: TempoContext): number[] {
    const boundaries: number[] = [0];
    const snap = tempo.reliable && tempo.secondsPerBar && tempo.secondsPerBar > 0;
    for (let i = 1; i < count; i++) {
        const even = (duration * i) / count;
        let rel = even;
        if (snap) {
            const snappedAbs = snapToBar(startSec + even, tempo);
            const snappedRel = snappedAbs - startSec;
            // Keep the snap only if it stays strictly inside the scene and ahead of the previous
            // boundary by at least a minimum, else fall back to the even split.
            if (snappedRel > boundaries[i - 1] + MIN_ATTACK_SEC && snappedRel < duration - MIN_ATTACK_SEC) {
                rel = snappedRel;
            }
        }
        if (rel <= boundaries[i - 1]) rel = boundaries[i - 1] + (duration - boundaries[i - 1]) / (count - i + 1);
        boundaries.push(rel);
    }
    boundaries.push(duration);
    return boundaries;
}

function snapToBar(absTime: number, tempo: TempoContext): number {
    const bars = tempo.bars;
    if (bars.length >= 2) {
        // Nearest authored bar start.
        let best = bars[0];
        let bestDist = Math.abs(absTime - bars[0]);
        for (let i = 1; i < bars.length; i++) {
            const d = Math.abs(absTime - bars[i]);
            if (d < bestDist) { best = bars[i]; bestDist = d; }
        }
        return best;
    }
    const spb = tempo.secondsPerBar;
    if (!spb || spb <= 0) return absTime;
    return tempo.gridOffset + Math.round((absTime - tempo.gridOffset) / spb) * spb;
}

// -- Behaviour-cycle grammar (weighted recency memory, seeded) ----------------

// Generate a role sequence from the situation's palette. Not a fixed A/B: a forward cycle bias
// (primary -> counter -> release -> ...) modulated by callbackFrequency (returns to the home
// role), releaseFrequency (gates release roles), transitionFrequency (willingness to switch),
// a weighted recency penalty (avoids over-repetition without hard bans), and seeded jitter.
function generateRoles(count: number, profile: SituationProfile, variation: VariationProfile, ctx: MicroChoreographyContext): VariantRole[] {
    const palette = profile.roles.length > 0 ? profile.roles : (['primary'] as VariantRole[]);
    const home = palette.includes('primary') ? 'primary' : palette[0];
    const roles: VariantRole[] = [];
    const lastUsedAt = new Map<VariantRole, number>();
    let sinceHome = 0;

    for (let i = 0; i < count; i++) {
        if (i === 0) {
            roles.push(home);
            lastUsedAt.set(home, 0);
            continue;
        }
        const prev = roles[i - 1];
        const prevIdx = Math.max(0, palette.indexOf(prev));

        let best = palette[0];
        let bestScore = -Infinity;
        for (let k = 0; k < palette.length; k++) {
            const c = palette[k];
            // Forward-cycle preference: the role just after `prev` in the palette scores highest.
            const forwardDist = (k - prevIdx - 1 + palette.length) % palette.length;
            let score = palette.length - forwardDist;
            // Willingness to switch: staying on the same role is damped by transitionFrequency.
            if (c === prev) score *= (1 - variation.transitionFrequency);
            // Release gate: rare unless the variation calls for releases.
            if (c === 'release') score *= 0.2 + 0.8 * variation.releaseFrequency;
            // Callback: pull back to the home role the longer we have been away.
            if (c === home) score += variation.callbackFrequency * Math.min(2, sinceHome);
            // Weighted recency memory: penalize roles used very recently (soft, not a ban).
            const since = i - (lastUsedAt.get(c) ?? -palette.length - 1);
            const recency = since <= 0 ? 1 : Math.max(0, 1 - since / (palette.length + 1));
            score *= 1 - variation.weightedMemoryStrength * recency;
            // Seeded jitter (deterministic, no runtime randomness).
            score += (hashFloat(ctx.trackSeed, ctx.sceneIndex, i, roleCode(c)) - 0.5) * 2 * variation.randomnessBudget;

            if (score > bestScore) { bestScore = score; best = c; }
        }
        roles.push(best);
        lastUsedAt.set(best, i);
        sinceHome = best === home ? 0 : sinceHome + 1;
    }
    return roles;
}

// Map a role to a family index. primary/focus = home family; secondary/release/sparse fan out to
// later families. With >1 family available, never repeat the previous family on adjacent segments
// (the A->A ban is now conditional on vocab>1); with a single family everything collapses to it
// (stable identity) and variety comes from intensity/envelope instead.
function pickFamily(role: VariantRole, families: string[], prevFamily: number, useCounts?: Record<string, number>): number {
    const familyCount = families.length;
    if (familyCount <= 1) return 0;
    let idx: number;
    switch (role) {
        case 'primary':
        case 'focus':     idx = 0; break;
        case 'secondary': idx = 1 % familyCount; break;
        case 'release':   idx = Math.min(2, familyCount - 1); break;
        case 'sparse':    idx = familyCount - 1; break;
        default:          idx = 0; break;
    }
    if (idx === prevFamily) idx = (prevFamily + 1) % familyCount;
    const minUse = Math.min(...families.map((family) => useCounts?.[family] ?? 0));
    if ((useCounts?.[families[idx]] ?? 0) > minUse + 1) {
        const leastUsed = families.findIndex((family, index) => index !== prevFamily && (useCounts?.[family] ?? 0) === minUse);
        if (leastUsed >= 0) idx = leastUsed;
    }
    return idx;
}

function intensityForRole(role: VariantRole, behaviour: BehaviourState, index: number, count: number): number {
    const energy = clamp01(behaviour.energy);
    let base: number;
    switch (role) {
        case 'primary':   base = 1.05; break;
        case 'focus':     base = 1.0;  break;
        case 'secondary': base = 0.9;  break;
        case 'release':   base = 0.7;  break;
        case 'sparse':    base = 0.55; break;
        default:          base = 0.9;  break;
    }
    // A gentle within-scene drift so even a single-family (stable) scene is not flat.
    const drift = count > 1 ? 0.08 * Math.sin((index / Math.max(1, count - 1)) * Math.PI) : 0;
    return clamp(base * (0.85 + energy * 0.3) + drift, 0.4, 1.3);
}

// -- Hierarchical envelope ----------------------------------------------------

// Build one segment's AutomationEnvelope. Hierarchy: situation base shares -> role character ->
// behaviour (energy/volatility) -> variation lifetime -> seeded jitter -> bar-snapped attack/
// release with the remainder split into sustain + cooldown (so the invariant
// attack+sustain+release+cooldown == segmentDuration holds exactly and attack/release stay
// musically aligned).
export function computeEnvelope(
    role: VariantRole,
    profile: SituationProfile,
    segDuration: number,
    behaviour: BehaviourState,
    variation: VariationProfile,
    tempo: TempoContext,
    ctx: MicroChoreographyContext,
    segIndex: number
): AutomationEnvelope {
    if (!(segDuration > 0)) return { attackSec: 0, sustainSec: 0, releaseSec: 0, cooldownSec: 0 };

    const energy = clamp01(behaviour.energy);
    const volatility = clamp01(behaviour.volatility);

    // 1+3. Situation base fractions, shaped by role character.
    let attackFrac = profile.attack;
    let releaseFrac = profile.release;
    let cooldownShare = Math.max(0, 1 - profile.attack - profile.sustain - profile.release);
    switch (role) {
        case 'primary':   attackFrac *= 0.7; break;                                   // punchy
        case 'focus':     attackFrac *= 0.9; break;                                   // longer hold (sustain via remainder)
        case 'release':   releaseFrac *= 1.4; cooldownShare *= 1.3; break;            // long decay + air
        case 'sparse':    releaseFrac *= 1.2; cooldownShare *= 1.5; attackFrac *= 1.1; break; // quiet, lots of air
        case 'secondary': break;
        default: break;
    }
    // 3. Behaviour: high energy => snappier attack; high volatility => less sustain (more air).
    attackFrac *= 1 - 0.35 * energy;
    cooldownShare *= 1 + 0.4 * volatility;
    // 4. Variation lifetime: stable holds the air longer, expressive trims it.
    cooldownShare *= variation.lifetimeScale;
    // 5. Seeded jitter (+/- randomnessBudget) on attack and release.
    attackFrac *= 1 + (hashFloat(ctx.trackSeed, ctx.sceneIndex, segIndex, 101) - 0.5) * 2 * variation.randomnessBudget;
    releaseFrac *= 1 + (hashFloat(ctx.trackSeed, ctx.sceneIndex, segIndex, 211) - 0.5) * 2 * variation.randomnessBudget;

    // 2. Bar-snapped attack/release (to the nearest beat = quarter bar), floored so they stay usable.
    let attack = clamp(attackFrac * segDuration, MIN_ATTACK_SEC, segDuration * 0.6);
    let release = clamp(releaseFrac * segDuration, 0, segDuration * 0.5);
    attack = snapDurationToBeat(attack, tempo, MIN_ATTACK_SEC);
    release = snapDurationToBeat(release, tempo, 0);
    if (attack + release > segDuration * 0.85) {
        const k = (segDuration * 0.85) / (attack + release);
        attack *= k;
        release *= k;
    }
    attack = Math.max(Math.min(MIN_ATTACK_SEC, segDuration), attack);
    // Guarantee room for the remainder so attack+sustain+release+cooldown == segDuration exactly.
    if (attack + release > segDuration) {
        const k = segDuration / (attack + release);
        attack *= k;
        release *= k;
    }

    // 6. Remainder => sustain + cooldown. cooldown is the trailing breath; clamp its share.
    const remainder = Math.max(0, segDuration - attack - release);
    const share = clamp(cooldownShare, 0, 0.85);
    const cooldown = remainder * share;
    const sustain = remainder - cooldown;
    return { attackSec: attack, sustainSec: sustain, releaseSec: release, cooldownSec: cooldown };
}

function snapDurationToBeat(sec: number, tempo: TempoContext, floorSec: number): number {
    const spb = tempo.secondsPerBar;
    if (!tempo.reliable || !spb || spb <= 0) return sec;
    const beat = spb / 4;
    const snapped = Math.round(sec / beat) * beat;
    return Math.max(floorSec, snapped);
}

// -- Deterministic seeded hash ------------------------------------------------

// FNV-1a style mix over the integer arguments with a final avalanche, returning a float in [0,1).
// Pure and stable: identical arguments always produce the identical value (no Math.random).
function hashFloat(...ints: number[]): number {
    let h = 2166136261 >>> 0;
    for (const value of ints) {
        h ^= (value | 0) >>> 0;
        h = Math.imul(h, 16777619) >>> 0;
        h ^= h >>> 13;
    }
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}

function roleCode(role: VariantRole): number {
    switch (role) {
        case 'primary':   return 1;
        case 'secondary': return 2;
        case 'release':   return 3;
        case 'sparse':    return 4;
        case 'focus':     return 5;
        default:          return 0;
    }
}

function dedupe(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        if (seen.has(item)) continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}

function clampInt(value: number, min: number, max: number): number {
    const v = Math.round(Number.isFinite(value) ? value : min);
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.max(lo, Math.min(hi, v));
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
}
