import type { VisualScorePlan } from './semantics';

export interface BeatEvent {
    time: number;
    intensity: number;
    type: 1 | 2 | 3; // 1: default spectral-flux hit, 2: dense impact hit, 3: fx/high-transient hit
}

export interface TempoCandidate {
    bpm: number;
    score: number;
    intervalSec: number;
    peakCount: number;
    isHalfTime: boolean;
    isDoubleTime: boolean;
}

export interface TempoAnalysis {
    bpm: number;
    confidence: number;
    alternativeTempos: number[];
}

export interface BeatAnalysis {
    beats: number[];
    confidence: number;
}

export interface TimingConfidence {
    tempo: number;
    beat: number;
    grid: number;
    overall: number;
}

export interface MusicalGrid {
    bpm: number;
    beatTimes: number[];
    barStarts: number[];
    offset: number;
    confidence: number;
}

export type AutoState = 'IDLE' | 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';

export type VisualMode = 'classic' | 'temporal' | 'dark-techno' | 'organic-ambient' | 'cyberpunk' | 'cosmic-wormhole' | 'hero';

export type MorphCurve = 'linear' | 'easeInOut' | 'exponential';

export interface MorphProfile {
    durationSec: number;
    curve: MorphCurve;
    preserveEnergy: boolean;
}

export interface DramaturgyProfile {
    buildupIntensity: number;
    dropDampening: number;
    breakRestraint: number;
    vocalHighlight: number;
    fxChaos: number;
}

export interface VisualTuningConfig {
    audioSensitivity: number;
    transitionSpeed: number;
    dynamicsThreshold: number;
    dropThreshold: number;
    dropAnticipation: number;
    phraseSize: number;
    chromaKeyMode: number;
    performanceMode: number;
    backgroundRed: number;
    backgroundGreen: number;
    backgroundBlue: number;
    particleIdleSpeed: number;
    particleEnergySpeed: number;
    particleBeatSpeed: number;
    particleBoundaryPull: number;
    particleActivityTurn: number;
    shockwaveRadius: number;
    shockwaveSpeed: number;
    shockwaveAlpha: number;
    shockwaveThickness: number;
    shockwaveExpansion: number;
    shockwaveDecay: number;
    circleBackgroundHue: number;
    circleBackgroundAlpha: number;
    circleHue: number;
    circleAlpha: number;
    circleSize: number;
    circleLineWeight: number;
    lineHue: number;
    lineAlpha: number;
    lineDistance: number;
    lineWeight: number;
    polygonHue: number;
    polygonAlpha: number;
    polygonSize: number;
    polygonFlash: number;
    temporalRingSize: number;
    temporalRingAlpha: number;
    temporalRingSpeed: number;
    temporalNetworkDistance: number;
    temporalPolygonAlpha: number;
    heroLaneBottomOffset: number;
    heroBeepVolume: number;
    heroBeepMode: number;
    heroEventMode: number;
    morphDurationSec: number;
    morphCurveValue: number;
    buildupIntensity: number;
    dropDampening: number;
    breakRestraint: number;
    vocalHighlight: number;
    fxChaos: number;
    wormholeRadius: number;
    wormholeDepth: number;
    wormholeSpeed: number;
    wormholeWarp: number;
    wormholeCurve: number;
    wormholeRing: number;
    wormholeContinuity: number;
    wormholeStarfield: number;
    wormholeGalaxy: number;
    wormholeSkybox: number;
    wormholeEmissionMode: number;
    wormholeJitter: number;
}

export interface PerformancePreset {
    version: 2;
    name: string;
    visualMode: VisualMode;
    visualTuning: VisualTuningConfig;
    morphProfile: MorphProfile;
    dramaturgyProfile: DramaturgyProfile;
}

export type PerformanceAutomationReason = 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'peak' | 'outro' | 'harmonicShift' | 'manual';

// Dramaturgy density level the Visual OS generator uses to thin or expand SceneEvolution
// waypoints. A normal, user-facing control (NOT a feature flag): 'macro' keeps only major
// section anchors, 'balanced' adds strong cues / novelty peaks, 'active' emits denser
// scene-evolution waypoints. Consumed by visualOsPlanner / scenePlanAdapter only.
export type DramaturgyActivityLevel = 'macro' | 'balanced' | 'active';

// Choreography variation mode: selects a VariationProfile controlling how COMPLEX a scene's
// micro-choreography is (behaviour-vocabulary size, cycle frequencies, lifetime, seeded jitter).
// Renderer-independent, user-facing, and orthogonal to DramaturgyActivityLevel (which caps overall
// density): 'stable' keeps a single behaviour family per scene (but still breathes via varying
// intensity/envelope), 'paired' weaves 2-3 families, 'expressive' adds richer cycles. Consumed by
// scenePlanAdapter / microChoreographyPlanner only. See [[visual-os-style-system]].
export type DramaturgyVariantMode = 'stable' | 'paired' | 'expressive';

// Optional, renderer-INDEPENDENT provenance carried from the Visual OS pipeline onto a
// PerformanceAutomationPoint. It records WHICH style/scene produced the point so the
// timeline can surface it (debug/tooltip) and Copy/Load can round-trip it. It MUST NOT
// carry renderer/tuning quantities (no tuning keys, opacity, particleCount); the concrete
// preset binding already lives in PerformanceAutomationPoint.preset. Absent on
// legacy-generated and imported-legacy plans.
export interface PerformanceAutomationMeta {
    motif?: VisualMotif;                 // FORM the scene realized
    palette?: VisualPalette;             // MATERIAL/vocabulary family
    // RESOLVED, post-bias behaviour summary: a normalized BehaviourState (every field 0..1,
    // already clamped by the Behaviour Resolver). This is the realized scene dynamics, NOT a
    // BehaviourBias (-1..1) like StylePack.behaviour, so Copy/Load clamps it to 0..1.
    behaviour?: BehaviourState;
    evolutionPhase?: SceneEvolutionPhase;
    sceneId?: string;                    // adapter scene id (e.g. "vos:dark-techno:0")
    stylePack?: string;
    substyle?: string;
    targetStateReference?: string;       // opaque style handle the adapter resolved
    // Choreography provenance (ADR-005 extension). All renderer-independent: an abstract
    // choreographic situation, the id of the behaviour vocabulary that produced the point, and
    // the role this segment plays within the scene's cycle. Absent on legacy points.
    automationSituation?: AutomationSituation;
    vocabularyId?: string;
    variantRole?: VariantRole;
    movementGesture?: MovementGesture;
    longScenePhase?: LongScenePhase;
    globalArcRole?: SceneNarrativeRole;
}

export interface PerformanceAutomationPoint {
    id: string;
    time: number;
    sectionId: string;
    preset: string;
    confidence: number;
    analysisConfidence?: number;
    timingMode?: 'bar-aligned' | 'energy-reactive' | 'novelty';
    intensity: number;
    reason: PerformanceAutomationReason;
    morphDurationSec: number;
    morphCurve: 'linear' | 'easeInOut' | 'exponential';
    locked?: boolean;
    // Optional Visual OS provenance (ADR-005). Renderer-independent; safe to omit.
    meta?: PerformanceAutomationMeta;
}

export interface PerformanceAutomationPlan {
    version: 1;
    source: 'auto' | 'edited';
    points: PerformanceAutomationPoint[];
}

// ── Semantic / Dramaturgy Layer (ADR-003) ──────────────────────────────────
// A style-independent semantic chain computed offline from TrackAnalysis:
//   Narrative -> Intent -> Choreography -> (SemanticResolver at runtime).
// These plans must stay JSON-serializable and deterministic. Per ADR-003 the
// renderer reads ONLY the resolved tuning plus the looked-up ChoreographyFrame;
// the VisualDirectorFSM and its modulation bus are unaffected.

export type NarrativeType = 'intro' | 'groove' | 'tension' | 'build' | 'fake-drop' | 'release' | 'peak' | 'breakdown' | 'outro';

export interface NarrativeSegment {
    id: string;
    startTime: number;
    endTime: number;
    type: NarrativeType;
    intensity: number; // 0..1
}

export interface MusicalNarrativePlan {
    version: 1;
    segments: NarrativeSegment[];
}

export type IntentType = 'establish' | 'anticipate' | 'compress' | 'expand' | 'release' | 'celebrate' | 'recover' | 'contrast' | 'return' | 'sustain';

export interface IntentPoint {
    time: number;
    intent: IntentType;
    weight: number;   // 0..1
    duration: number; // transition length in seconds
}

export interface DramaturgicalIntentPlan {
    version: 1;
    points: IntentPoint[];
}

export type MotifChoreographyAction = 'expand' | 'collapse' | 'orbit' | 'fragment' | 'bloom' | 'pulse' | 'echo' | 'freeze' | 'accelerate' | 'slow' | 'densify' | 'thin' | 'focus' | 'scatter' | 'merge';

export type GrammarOperator = 'repeat' | 'mirror' | 'invert' | 'alternate' | 'echo' | 'grow' | 'shrink' | 'cascade' | 'call-response';

// Visual Score DSL: a typed, JSON-serializable score AST. This is deliberately
// data-only; runtime parsers, callbacks and renderer-specific values do not belong here.
export type VisualMotif =
    | 'pulse-field' | 'orbit-system' | 'tunnel-drive' | 'network-bloom'
    | 'fragment-cloud' | 'wave-ripple' | 'grid-scan' | 'halo-focus'
    | 'swarm-motion' | 'void-minimal';

export type MotifRole = 'foundation' | 'counterpoint' | 'accent' | 'memory' | 'release' | 'tension';

export type PatternSubdivision = 'beat' | 'half-beat' | 'bar' | 'two-bars' | 'four-bars' | 'phrase' | 'section';

export type TransitionBehavior =
    | 'morph' | 'handoff' | 'echo-out' | 'collapse-release' | 'freeze-cut'
    | 'dissolve' | 'overlay' | 'snap' | 'phase-shift';

export interface MotifPhrase {
    id: string;
    motif: VisualMotif;
    role: MotifRole;
    startTime: number;
    endTime: number;
    subdivision: PatternSubdivision;
    intensity: number;
    density: number;
    motion: number;
    novelty: number;
    variationSeed: number;
    operators: GrammarOperator[];
}

export interface TransitionPhrase {
    fromMotifId: string;
    toMotifId: string;
    startTime: number;
    duration: number;
    behavior: TransitionBehavior;
    curve: 'linear' | 'easeInOut' | 'exponential' | 'snap';
    preserve: Array<'color' | 'rhythmPhase' | 'density' | 'motion' | 'spatialAxis'>;
}

export interface MotifVisualScorePlan {
    version: 1;
    motifs: MotifPhrase[];
    transitions: TransitionPhrase[];
}

export interface MotifChoreographyFrame {
    time: number;
    // Action intensities (0..1). A plain Record, NOT a Map, so the plan stays
    // JSON-serializable and deterministic (ADR-003).
    actions: Partial<Record<MotifChoreographyAction, number>>;
    activeOperators: GrammarOperator[];
    motifId?: string;
    motif?: VisualMotif;
    motifRole?: MotifRole;
    subdivision?: PatternSubdivision;
    transition?: {
        behavior: TransitionBehavior;
        progress: number;
        preserve: TransitionPhrase['preserve'];
        fromMotif?: VisualMotif;
        toMotif?: VisualMotif;
    };
    motifIntensity?: number;
    motifDensity?: number;
    motifMotion?: number;
    novelty?: number;
    phrasePosition?: number;
    rhythmicPhase?: number;
    variationSeed?: number;
}

export interface VisualChoreographyPlan {
    version: 1;
    frames: MotifChoreographyFrame[];
    score?: MotifVisualScorePlan;
}

export type {
    ChoreographyAction,
    ChoreographyFrame,
    NarrativeState,
    PatternPrimitive,
    VariationModel,
    VisualIntentType,
    VisualScorePlan
} from './semantics';

// --- Visual OS Style System (ADR-005) ---------------------------------------
// A renderer-INDEPENDENT style/scene layer that CONSUMES the ADR-003 semantic
// output (Narrative -> Intent -> MotifChoreographyFrame). It never re-derives
// musical semantics. These contracts are type-only, JSON-serializable, and must
// NOT name renderer/runtime quantities (no tuning keys, preset filenames, p5, or
// DOM). All numeric fields are normalized 0..1 unless documented otherwise. The
// single place a style touches a concrete preset is StyleTargetReference, which is
// consumed exclusively by the adapter tier (scenePlanAdapter). This pipeline is the
// DEFAULT dramaturgy generator; the legacy generatePerformancePlan is the fallback
// (featureFlags.forceLegacyDramaturgy is a debug-only override).

// Scene lifecycle: a scene is not static. It is born, grows, peaks, releases, dies.
export type SceneEvolutionPhase = 'birth' | 'growth' | 'peak' | 'release' | 'death';

export interface SceneEvolutionStep {
    phase: SceneEvolutionPhase;
    // Normalized position [0..1] within the scene where this phase begins (birth=0).
    at: number;
    // Normalized, style-relative energy the phase targets [0..1].
    level: number;
}

export interface SceneEvolution {
    // Ordered birth..death lifecycle. Always begins with a birth step at at=0.
    steps: SceneEvolutionStep[];
}

// A small sub-scene accent. Describes WHAT is accented and HOW strongly in abstract
// action terms, never how to draw it. Derived from existing cues/grammar echoes.
export interface MicroEvent {
    timeSec: number;
    action: MotifChoreographyAction;
    strength: number; // 0..1
    source: 'impact' | 'fx' | 'accent' | 'echo';
}

export type VisualPalette = 'mono' | 'duotone' | 'neon' | 'earth' | 'spectral' | 'void';

// MATERIAL (texture/palette character), distinct from Motif (FORM). Style-relative,
// normalized; no renderer/tuning values.
export interface VisualVocabulary {
    palette: VisualPalette;
    lineCharacter: number;  // 0 = soft/organic .. 1 = sharp/digital
    glowCharacter: number;  // 0 = flat .. 1 = blooming
    grain: number;          // 0 = clean .. 1 = textured/noisy
    contrast: number;       // 0 = muted .. 1 = high-contrast
}

// Style capability over FORMS (motifs) and MATERIALS (palettes). `preferred` is ranked
// best-first; `forbidden` is hard-excluded and additive across inheritance. `weights` makes
// the matrix data-driven: the per-tier capability score the VariationEngine applies (e.g.
// preferred 0.9, supported 0.4). When omitted the engine uses those defaults.
export interface StyleCapabilityWeights {
    preferred: number;
    supported: number;
}

export interface StyleCapabilityMatrix {
    preferred: VisualMotif[];
    supported: VisualMotif[];
    forbidden: VisualMotif[];
    palettes: {
        preferred: VisualPalette[];
        forbidden: VisualPalette[];
    };
    weights?: StyleCapabilityWeights;
}

// Normalized, style-relative behaviour dynamics. NO tuning keys.
export interface BehaviourState {
    energy: number;     // 0..1 overall intensity the scene calls for
    density: number;    // 0..1 element density
    motion: number;     // 0..1 movement amount
    volatility: number; // 0..1 reactivity / glitch tendency
    cohesion: number;   // 0..1 ordered (1) vs. scattered (0)
}

// Additive behaviour bias a StylePack/substyle applies on top of the semantic-derived
// BehaviourState. Each field is in [-1..1]; the Behaviour Resolver adds then clamps to [0..1].
export interface BehaviourBias {
    energy: number;
    density: number;
    motion: number;
    volatility: number;
    cohesion: number;
}

export type SceneTransitionCurve = 'linear' | 'easeInOut' | 'exponential' | 'snap';

export interface SceneTransition {
    behavior: TransitionBehavior;
    durationSec: number;
    curve: SceneTransitionCurve;
    preserve: TransitionPhrase['preserve'];
}

// SceneIntent - the selected, style-permitted realization of an already-generated
// semantic frame (ADR-003). It picks among style-permitted candidates; it NEVER
// introduces new narrative/intent/motif. Times come from the semantic frame/section.
export interface SceneIntent {
    timeSec: number;
    durationSec: number;
    narrative: NarrativeType; // reused ADR-003 narrative type
    intent: IntentType;       // reused ADR-003 intent type
    motif: VisualMotif;       // FORM, chosen from style-permitted candidates
    role: MotifRole;
    behaviour: BehaviourState;
    evolution: SceneEvolution;
    microEvents: MicroEvent[];
    novelty: number;          // 0..1, carried from the semantic frame
    variationSeed: number;    // deterministic seed carried from the semantic phrase
    sourceFrameTime: number;  // back-reference to the source MotifChoreographyFrame time
    transition?: SceneTransition;
}

// VisualScene - renderer-INDEPENDENT output of the Style Translation Pipeline.
// `targetStateReference` is an OPAQUE handle (e.g. "dark-techno-minimal#peak") resolved
// to a concrete preset/tuning ONLY by scenePlanAdapter (Renderer Independence Contract).
export interface VisualScene {
    timeSec: number;
    durationSec: number;
    stylePack: string;
    substyle?: string;
    motif: VisualMotif;
    vocabulary: VisualVocabulary;
    behaviour: BehaviourState;
    evolution: SceneEvolution;
    microEvents: MicroEvent[];
    transition?: SceneTransition;
    targetStateReference: string;
}

export interface VisualScenePlan {
    version: 1;
    stylePack: string;
    scenes: VisualScene[];
}

// --- Automation Situations & Variant Pairs (ADR-005 extension) ---------------
// A renderer-INDEPENDENT layer on top of VisualScene that turns a long dramaturgical
// scene into visually-distinct variant pairs. AutomationSituation is a choreographic
// situation classified deterministically from already-generated narrative/behaviour/
// duration (never from raw audio). It names NO renderer/tuning quantity and NO preset.

export type AutomationSituation =
    | 'intro-establish'
    | 'verse-long'
    | 'groove-sustain'
    | 'buildup-ramp'
    | 'drop-short'
    | 'drop-long'
    | 'drop-after-build'
    | 'breakdown-long'
    | 'peak-sustain'
    | 'transition-release'
    | 'outro-dissolve';

// How a variant pair alternates its targets across the subsegments of a long scene.
export type AutomationAlternation = 'A-B' | 'A-B-A' | 'call-response' | 'compress-release' | 'sparse-dense';

// The intensity envelope shape applied across a variant pair's subsegments.
export type AutomationIntensityShape = 'flat' | 'ramp' | 'pulse' | 'wave' | 'release';

// The role a single choreography segment plays inside a scene's behaviour cycle.
// primary = the dominant/percussive family, secondary = a contrasting counter, release =
// a relaxing tail, sparse = a thinned/quiet beat, focus = a sustained hold on the primary.
export type VariantRole = 'primary' | 'secondary' | 'release' | 'sparse' | 'focus';

// Abstract movement quality selected by the renderer-independent choreography domain.
// Gestures describe HOW a segment moves; they never identify a renderer target or preset.
export type MovementGesture =
    | 'pulse'
    | 'drive'
    | 'orbit'
    | 'scatter'
    | 'collapse'
    | 'expand'
    | 'bloom'
    | 'fragment'
    | 'ripple'
    | 'slice'
    | 'tunnel'
    | 'swarm'
    | 'lock'
    | 'echo'
    | 'fade';

// Style-pack authored variant-pair definition (style-packs.json `variantPairs`). The
// `primary`/`secondary`/`release` fields are OPAQUE target handles (e.g. "drop.primary"),
// NOT preset filenames; only scenePlanAdapter resolves them via the pack targetMap.
export interface StyleVariantPairDefinition {
    id: string;
    primary: string;
    secondary: string;
    release?: string;
    alternation: AutomationAlternation;
    minSegmentSec: number;
    maxSegmentSec: number;
    intensityShape: AutomationIntensityShape;
}

// Runtime contract the variant-pair planner emits for a chosen situation+scene. Identical
// shape to the authored definition plus the resolved situation; still opaque (no presets).
export interface AutomationVariantPair {
    id: string;
    situation: AutomationSituation;
    primaryTarget: string;
    secondaryTarget: string;
    releaseTarget?: string;
    alternation: AutomationAlternation;
    minSegmentSec: number;
    maxSegmentSec: number;
    intensityShape: AutomationIntensityShape;
}

// Per-pack/per-situation variant-pair config, resolved with single-parent inheritance
// alongside targetMap. A missing/empty map means the pack has no authored pairs; the
// Micro-Choreography planner then derives a single-family vocabulary from the scene narrative.
export type StyleVariantPairMap = Partial<Record<AutomationSituation, StyleVariantPairDefinition[]>>;

// Per-situation behaviour VOCABULARY: an ordered list of OPAQUE target handles (e.g.
// ["drop.primary", "drop.counter", "drop.release"]) the Micro-Choreography planner draws
// families from. Resolved with single-parent inheritance alongside targetMap/variantPairs.
// When a situation has no authored vocabulary the planner falls back to its variantPairs,
// then to the scene's own narrative handle. Still renderer-independent (no preset filenames).
export type StyleVocabularyMap = Partial<Record<AutomationSituation, string[]>>;
export type StyleMovementVocabularyMap = Partial<Record<AutomationSituation, MovementGesture[]>>;

export type LongScenePhase = 'entry' | 'establish' | 'develop' | 'counter' | 'intensify' | 'peak' | 'release' | 'decay';

export interface LongSceneSection {
    phase: LongScenePhase;
    offsetSec: number;
    durationSec: number;
    preferredRoles: VariantRole[];
    preferredGestures: MovementGesture[];
    intensityBias: number;
}

export type GlobalArcType = 'single-rise' | 'two-drop' | 'wave-cycle' | 'slow-burn' | 'peak-and-release' | 'fragmented';
export type SceneNarrativeRole = 'setup' | 'development' | 'climax' | 'aftermath' | 'resolution';

export interface SceneNarrativeBias {
    sceneIndex: number;
    roleInTrack: SceneNarrativeRole;
    gestureBias: MovementGesture[];
    variationBias: 'restrain' | 'open' | 'intensify' | 'resolve';
}

export interface GlobalVisualNarrative {
    arcType: GlobalArcType;
    totalEnergyShape: 'rising' | 'falling' | 'wave' | 'plateau';
    primaryGestureFamily: MovementGesture[];
    secondaryGestureFamily: MovementGesture[];
    returnStrategy: 'repeat' | 'evolve' | 'invert' | 'dissolve';
    climaxSceneIndex?: number;
    sceneBiases: SceneNarrativeBias[];
}

export interface VariationMemoryState {
    recentTargets: string[];
    recentGestures: MovementGesture[];
    recentSituations: AutomationSituation[];
    familyUseCounts: Record<string, number>;
    gestureUseCounts: Record<MovementGesture, number>;
    lastPeakGesture?: MovementGesture;
    lastDropVocabularyId?: string;
}

// --- Micro-Choreography planner (ADR-005 extension) --------------------------
// A renderer-INDEPENDENT scheduling layer. The planner turns a classified
// AutomationSituation + scene duration + tempo + variation profile into an ordered set of
// ChoreographySegments, each carrying a behaviour intent (role + OPAQUE target + relative
// intensity) and an AutomationEnvelope. It names NO preset and NO tuning key; scenePlanAdapter
// alone resolves targets to presets and envelopes to PerformanceAutomationPoints.

// A renderer-independent amplitude envelope for one choreography segment. The four phases
// fill the segment's musical room: attack (morph-in) -> sustain (hold) -> release (decay) ->
// cooldown (the trailing "air"/breath before the next segment). Invariant:
// attackSec + sustainSec + releaseSec + cooldownSec == segmentDurationSec. attackSec is the
// SOLE source of a PerformanceAutomationPoint.morphDurationSec, so automation lifetime is
// bounded by the segment and never auto-stretches to the next point.
export interface AutomationEnvelope {
    attackSec: number;
    sustainSec: number;
    releaseSec: number;
    cooldownSec: number;
}

// Musical timing context passed to the planner so subdivision and envelope phases can snap to
// bars. Derived once per track from TrackAnalysis. `secondsPerBar` is null when there is no
// usable tempo (planner then uses equal time fallbacks). `reliable` mirrors the legacy grid-
// timing threshold; `confidence` (0..1) coarsens subdivision when timing evidence is weak.
export interface TempoContext {
    bpm: number;
    secondsPerBar: number | null;
    gridOffset: number;
    bars: number[];        // bar start times (seconds), ascending; may be empty
    reliable: boolean;
    confidence: number;
}

// One scheduled behaviour beat inside a scene. `target` is an OPAQUE vocabulary handle; the
// intensityScale is a relative multiplier the adapter combines with the SceneEvolution arc.
export interface ChoreographySegment {
    index: number;
    offsetSec: number;          // start, seconds from scene start
    durationSec: number;
    role: VariantRole;
    target: string;             // opaque target handle, never a preset filename
    movementGesture: MovementGesture;
    longScenePhase?: LongScenePhase;
    intensityScale: number;     // relative envelope multiplier (~0.4..1.3)
    envelope: AutomationEnvelope;
}

// The planner's output for one scene. `vocabularyId` is provenance for the chosen behaviour
// vocabulary (an authored pair id, or a synthesized id for derived/fallback vocabularies).
export interface ChoreographyPlan {
    situation: AutomationSituation;
    vocabularyId: string;
    segments: ChoreographySegment[];
}

// Resolved parameters for a DramaturgyVariantMode. Variation controls choreography COMPLEXITY
// and STYLE (how many behaviour families, how often it switches, how long things live), which
// is orthogonal to DramaturgyActivityLevel (which caps overall automation DENSITY). See the
// VARIATION_PROFILES table in the planner and [[visual-os-style-system]].
export interface VariationProfile {
    mode: DramaturgyVariantMode;
    vocabularySize: number;          // max distinct behaviour families used (1 | 2..3 | 4..6)
    subdivisionScale: number;        // multiplier on the situation's base segment length in bars
                                     // (>1 = longer segments/stable, <1 = shorter/expressive)
    transitionFrequency: number;     // 0..1, how readily the cycle switches role/family
    releaseFrequency: number;        // 0..1, how often a release tail/point is emitted
    callbackFrequency: number;       // 0..1, how strongly the cycle returns to the primary family
    weightedMemoryStrength: number;  // 0..1, recency penalty strength (high=avoids change)
    randomnessBudget: number;        // seeded jitter fraction (0.10 | 0.20 | 0.35)
    lifetimeScale: number;           // envelope cooldown share multiplier (1.3 | 1.0 | 0.75)
}

// --- StylePack data contracts (style-packs.json) ----------------------------
// `extends` enables single-parent inheritance, flattened by the Style Resolver
// (Phase 3). `targetMap` is the ONLY adapter-tier escape hatch where a pack may
// name a concrete preset; it is consumed exclusively by scenePlanAdapter.

// Adapter-tier reference. The single place a style names a concrete preset.
export interface StyleTargetReference {
    preset: string;          // preset filename, e.g. "temporal3.json"
    intensityScale?: number; // optional multiplier the adapter applies to point intensity
    morphCurve?: 'linear' | 'easeInOut' | 'exponential';
}

export interface StyleSubstyleDefinition {
    label?: string;
    capabilities?: Partial<StyleCapabilityMatrix>;
    vocabulary?: Partial<VisualVocabulary>;
    behaviour?: Partial<BehaviourBias>;
    targetMap?: Record<string, StyleTargetReference>;
    variantPairs?: StyleVariantPairMap;
    // Per-situation behaviour vocabulary (opaque handles), override/extend like variantPairs.
    behaviourVocabulary?: StyleVocabularyMap;
    movementVocabulary?: StyleMovementVocabularyMap;
}

export interface StylePackDefinition {
    id: string;
    extends?: string;
    label?: string;
    capabilities?: Partial<StyleCapabilityMatrix>;
    vocabulary?: Partial<VisualVocabulary>;
    behaviour?: Partial<BehaviourBias>;
    substyles?: Record<string, StyleSubstyleDefinition>;
    targetMap?: Record<string, StyleTargetReference>;
    variantPairs?: StyleVariantPairMap;
    // Per-situation behaviour vocabulary (opaque handles) for the Micro-Choreography planner.
    behaviourVocabulary?: StyleVocabularyMap;
    movementVocabulary?: StyleMovementVocabularyMap;
}

export interface StylePacksFile {
    version: 1;
    packs: StylePackDefinition[];
}

// Fully-flattened pack after inheritance resolution. All fields are concrete (no Partial).
export interface ResolvedStylePack {
    id: string;
    label: string;
    capabilities: StyleCapabilityMatrix;
    vocabulary: VisualVocabulary;
    behaviour: BehaviourBias;
    substyles: Record<string, ResolvedSubstyle>;
    targetMap: Record<string, StyleTargetReference>;
    variantPairs: StyleVariantPairMap;
    behaviourVocabulary: StyleVocabularyMap;
    movementVocabulary: StyleMovementVocabularyMap;
}

export interface ResolvedSubstyle {
    label: string;
    capabilities: StyleCapabilityMatrix;
    vocabulary: VisualVocabulary;
    behaviour: BehaviourBias;
    targetMap: Record<string, StyleTargetReference>;
    variantPairs: StyleVariantPairMap;
    behaviourVocabulary: StyleVocabularyMap;
    movementVocabulary: StyleMovementVocabularyMap;
}

export interface ModulationState {
    kineticTension: number;
    densityDrive: number;
    spectralChaos: number;
    rhythmicImpulse: number;
    macroMomentum: number;
}

export type DirectorState = 'IDLE' | 'INTRO_BREAK' | 'BUILDUP' | 'DROP' | 'GLITCH_LOW_DROP';

export interface DirectorOutput {
    state: DirectorState;
    centripetalOrbit: number;
    glitchIntensity: number;
    invertBackground: boolean;
}

export interface VideoDominantColor {
    r: number;
    g: number;
    b: number;
}

export interface AudioFrame {
    /** Normalized RMS energy. */
    e: number;
    /** Smoothed spectral-flux density projection. */
    densityProj: number;
    /** Smoothed tonal melody-presence projection. */
    melodyProj: number;
    /** Smoothed FX/noise/transient projection. */
    fxProj: number;
    /** Precomputed track-relative 24-band spectrum balance, logarithmic 20 Hz..16 kHz. */
    perceptualSpectrum: number[];
    state: AutoState;
    eRatio: number;
}

export type VisualCueKind = 'melody' | 'vocal' | 'fx' | 'impact' | 'break' | 'pattern';

export type TrackSectionLabel = 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'peak' | 'outro';

/**
 * Explanatory taxonomy describing *why* the analyzer placed a boundary, label, or cue.
 * Append-only: new evidence kinds may be added to the end of this union, never removed.
 */
export type AnalysisReason =
    | 'bar-aligned'
    | 'energy-rise'
    | 'energy-drop'
    | 'density-rise'
    | 'bass-return'
    | 'bass-drop'
    | 'high-transient'
    | 'percussive-onset'
    | 'after-buildup'
    | 'low-grid-confidence'
    | 'novelty-peak'
    | 'section-position'
    | 'weak-evidence-fallback';

/**
 * A single point on the deterministic novelty curve. `value` is normalized 0..1 and
 * expresses how much musical "change evidence" was detected at `time` (seconds).
 */
export interface NoveltyPoint {
    time: number;
    value: number;
    reasons: AnalysisReason[];
}

/**
 * A candidate section boundary surfaced by novelty/grid analysis before final selection.
 * `timingMode` records how the boundary time was anchored.
 */
export interface SectionBoundaryCandidate {
    time: number;
    confidence: number;
    timingMode: 'bar-aligned' | 'energy-reactive' | 'novelty';
    reasons: AnalysisReason[];
}

export interface VisualFeatureFrame {
    melody: number;
    vocal: number;
    fx: number;
    density: number;
    brightness: number;
    tension: number;
}

export interface VisualCueEvent {
    time: number;
    duration: number;
    intensity: number;
    confidence: number;
    kind: VisualCueKind;
    patternId?: string;
    reasons?: AnalysisReason[];
}

export interface TrackSection {
    start: number;
    end: number;
    label: TrackSectionLabel;
    energy: number;
    density: number;
    dominantFeature: VisualCueKind | 'rhythm';
    avgRms: number;
    peakRms: number;
    reasons?: AnalysisReason[];
}

export interface BarAnalysis {
    index: number;
    start: number;
    end: number;
    energy: number;
    density: number;
    avgRms: number;
    peakRms: number;
    bass: number;
    mid: number;
    treble: number;
    state: Extract<AutoState, 'HIGH' | 'LOW'>;
    dominantFeature: VisualCueKind | 'rhythm';
}

export interface PatternOccurrence {
    start: number;
    end: number;
    intensity: number;
    confidence: number;
}

export interface MusicPattern {
    id: string;
    signature: string;
    label: TrackSectionLabel;
    dominantFeature: VisualCueKind | 'rhythm';
    occurrences: PatternOccurrence[];
    averageEnergy: number;
    averageDensity: number;
}

export interface TensionTrendSegment {
    start: number;
    end: number;
    startValue: number;
    endValue: number;
    direction: 'rising' | 'falling' | 'stable';
    confidence: number;
}

export interface TensionTrends {
    globalSlope: number;
    peakTime: number;
    peakValue: number;
    segments: TensionTrendSegment[];
}

export interface TrackAnalysis {
    duration: number;
    bpm: number;
    bpmConfidence: number;
    gridConfidence: number;
    downbeatConfidence: number;
    tempoCandidates: TempoCandidate[];
    bars: BarAnalysis[];
    sections: TrackSection[];
    patterns: MusicPattern[];
    cues: VisualCueEvent[];
    significantMoments: VisualCueEvent[];
    features: VisualFeatureFrame[];
    buildupConfidence: number[];
    spectralPivot: number[];
    tensionTrends: TensionTrends;
    /** Per-frame novelty curve (one value per analysis frame, 0..1); time = index * featureHopSize / sampleRate. */
    noveltyCurve?: number[];
    /** Sparse labeled novelty peaks (carry the reason taxonomy; the per-frame curve does not). */
    noveltyPeaks?: NoveltyPoint[];
    boundaryCandidates?: SectionBoundaryCandidate[];
    featureHopSize: number;
    gridOffset: number;
    // Authoritative musical timing model (single source of truth for downstream consumers).
    tempo: number;
    tempoConfidence: number;
    beats: number[];
    beatConfidence: number;
    barStarts: number[];
    alternativeTempos: number[];
    timingConfidence: TimingConfidence;
    /** External ADR-004 payload passed through analysis publication; never produced by the analyzer core. */
    externalVisualScorePlan?: VisualScorePlan;
}

export interface TimelineLayers {
    waveform: boolean;
    rms: boolean;
    buildup: boolean;
    cues: boolean;
    automation: boolean;
}

export interface GestureCallbacks {
    onStart?: (focusX: number, focusY: number, button: number, shiftKey: boolean) => boolean | void;
    onMove?: (focusX: number, focusY: number, deltaX: number, deltaY: number) => void;
    onEnd?: () => void;
    onZoom?: (delta: number, focusX: number) => void;
    onHover?: (focusX: number, focusY: number) => void;
    onDoubleClick?: (focusX: number, focusY: number) => void;
}

export interface RenderState {
    isPlaying?: boolean;
    isExporting: boolean;
    exportTime: number;
    currentTime: number;
    duration: number;
    zoom: number;
    pan: number;
    bpm: number;
    sampleRate: number;
    hopSize: number;
    frames: AudioFrame[];
    sections: TrackSection[];
    bars: BarAnalysis[];
    cues: VisualCueEvent[];
    significantMoments: VisualCueEvent[];
    buildupConfidence: number[];
    spectralPivot: number[];
    tensionTrends: TensionTrends;
    noveltyCurve?: number[];
    boundaryCandidates?: SectionBoundaryCandidate[];
    showAnalyzerDebugOverlay?: boolean;
    performancePlan: PerformanceAutomationPlan | null;
    automationMorphScale?: number;
    // Semantic dramaturgy overlay (ADR-003). Present only when the semantic layer is on;
    // the timeline draws the dramaturgical arc instead of raw preset names. Optional so the
    // legacy render path is unaffected.
    dramaturgicalIntent?: DramaturgicalIntentPlan | null;
    timelineLayers: TimelineLayers;
    snapToGrid: boolean;
    selectedPointId: string | null;
    followPlayhead: boolean;
    hoveredPointId: string | null;
    hoveredHandleType: 'start' | 'end' | 'sensitivity' | 'curve' | null;
    audioSensitivity: number;
    dropAnticipation: number;
    videoDominantColor: VideoDominantColor;
    scrubTime?: number | null;
    gridOffset: number;
}

export interface AnalysisResult {
    requestId: number;
    bpm: number;
    bpmConfidence: number;
    gridConfidence: number;
    downbeatConfidence: number;
    tempoCandidates: TempoCandidate[];
    adaptiveThreshold: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
    // Authoritative timing model, mirrored at the top level for direct worker consumers.
    beats: number[];
    barStarts: number[];
    timingConfidence: TimingConfidence;
    trackAnalysis: TrackAnalysis;
}

export interface AnalysisRequest {
    requestId: number;
    algorithmVersion: number;
    samples: ArrayBuffer;
    sampleRate: number;
    phraseSize: number;
}

export interface AnalysisSuccessMessage extends AnalysisResult {
    type: 'analysis_done';
}

export interface AnalysisErrorMessage {
    type: 'analysis_error';
    requestId: number;
    errorCode: string;
    message: string;
}

export interface AnalysisProgressMessage {
    type: 'analysis_progress';
    requestId: number;
    progress: number;
    stage: string;
}

export type AnalysisWorkerMessage = AnalysisSuccessMessage | AnalysisErrorMessage | AnalysisProgressMessage;
