// Shared layout of the Wormhole grain material as carrier data (ADR-009 Addendum W). The producer
// (`src/visuals`, CPU) prepares each carrier's raster-space constants once; the XR GPU material
// renderer (`src/xr/scene`) evaluates the per-pixel capsule law from them. Plain data only.

/** Float32 values per prepared carrier. */
export const GRAIN_CARRIER_STRIDE = 24;

/** Offsets inside one carrier record (raster pixel space, +y down, origin at the top-left). */
export const GRAIN_CARRIER = Object.freeze({
    TAIL_X: 0,
    TAIL_Y: 1,
    TANGENT_X: 2,
    TANGENT_Y: 3,
    LENGTH: 4,
    RADIUS: 5,
    CORE_RADIUS: 6,
    /** flux x depositGain: the contribution scale before shape, taper, filament and texture. */
    FLUX_GAIN: 7,
    COLOR_R: 8,
    COLOR_G: 9,
    COLOR_B: 10,
    HALO_GAIN: 11,
    /** The 32-bit carrier identity, split into exact 16-bit halves. */
    IDENTITY_HI: 12,
    IDENTITY_LO: 13,
    PHASE: 14,
    FILAMENT_PHASE: 15,
    FIBRE_PHASE: 16,
    FILAMENT_FREQUENCY: 17,
    FIBRE_ACROSS: 18,
    FIBRE_ALONG: 19,
    FILAMENT_BIAS: 20,
    FILAMENT_FLOOR: 21,
    /** 1 = weave link, + 2 = filamented (long enough for along-carrier breakup). */
    FLAGS: 22,
    /** Pre-noise shape value below which a pixel contributes nothing visible. */
    NEGLIGIBLE: 23
});

/** One frame's grain material as carriers, plus the resolve parameters of that frame. */
export interface GrainMaterialFrame {
    /** L0 raster size the carriers are expressed in. */
    readonly cols: number;
    readonly rows: number;
    /** Grain material amount (resolve) and bloom strength, after tuning. */
    readonly amount: number;
    readonly bloom: number;
    /** Material detail in [0, 1] (the per-pixel filament shaping uses it). */
    readonly detail: number;
    /** Valid carriers in `data` (each `GRAIN_CARRIER_STRIDE` floats). */
    readonly count: number;
    readonly data: Float32Array;
}
