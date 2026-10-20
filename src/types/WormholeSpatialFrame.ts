// Plain-data spatial state of one rendered Wormhole frame (XR spatial field). The visuals side
// resolves it from its own morphed tuning when it draws a frame; it travels with that frame (in
// thread or through the worker, like the focal point), so the XR field always shows the state of
// the background image actually on screen. Every value is finite and clamped by the producer.

/** Upper bound of `travelRate`, in Wormhole horizons per second (well above the fastest authored flight). */
export const WORMHOLE_SPATIAL_MAX_TRAVEL_RATE = 4;
/** Upper bound of `spiralTurns` (well above the strongest authored spiral). */
export const WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS = 8;
/** Bounds of `tubeSpread` (far beyond any authored radius / depth ratio). */
export const WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE = [0.001, 10] as const;

export interface WormholeSpatialFrame {
    /** Song time this frame was resolved at, in seconds (>= 0); consumers extrapolate travel from it. */
    readonly time: number;
    /**
     * The Wormhole's own travel distance at `time`, in horizons (>= 0, unwrapped). Consumers derive
     * their own cycle phases from it in double precision, so any spatial scale stays continuous.
     */
    readonly travel: number;
    /** Instantaneous travel rate at `time`, in horizons per second, in [0, WORMHOLE_SPATIAL_MAX_TRAVEL_RATE]. */
    readonly travelRate: number;
    /**
     * The 2D tunnel's projected spread: how far from the vanishing point a grain on the tube wall
     * appears, in canvas heights, at its release (the circle grains emerge on). A grain at normalized
     * depth u (1 at release, falling by one per horizon of travel) appears at spread / u, so with the
     * travel this fixes where grains are born and how they accelerate toward the edges. In
     * WORMHOLE_SPATIAL_TUBE_SPREAD_RANGE.
     */
    readonly tubeSpread: number;
    /** Overall presence in [0, 1] (0 = the image carries no grains, the field stays empty). */
    readonly amount: number;
    /** Occupancy in [0, 1]: sparse emission lowers it, continuous emission and grain density raise it. */
    readonly density: number;
    /** Tunnel radius in [0, 1] (radial extent around the route). */
    readonly radius: number;
    /**
     * How deep the tunnel reads, in [0, 1]: the image's own near/far law, its projected tube scale
     * (radius / depth). 0 = a wide, shallow near-member role, 1 = a narrow, deep far-member role.
     */
    readonly depth: number;
    /**
     * The coherent spiral the image draws, in turns over a grain's flight (0 at release, growing
     * with forward progress 1 - u; screen angles, canvas y down). 0 when the grain material, which
     * the spiral conditions, is off. In [0, WORMHOLE_SPATIAL_MAX_SPIRAL_TURNS].
     */
    readonly spiralTurns: number;
    /** Jitter / flow-curvature disorder in [0, 1]. */
    readonly turbulence: number;
    /** Streak continuity potential in [0, 1] (the length cue itself also scales with `travelRate`). */
    readonly streak: number;
    /** Soft-volume (Nebula material / weave) tendency in [0, 1]. */
    readonly wisp: number;
    /** Displayed grain hue in degrees, wrapped to [0, 360). */
    readonly hue: number;
    /** The grain colour the Wormhole drew this frame (sRGB, each in [0, 1]); its impact brightening included. */
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    /** The Wormhole's depth-haze colour that far grains fade toward (sRGB, each in [0, 1]). */
    readonly hazeRed: number;
    readonly hazeGreen: number;
    readonly hazeBlue: number;
    /** Beat transient in [0, 1] (decays after each beat). */
    readonly pulse: number;
    /** Dense-impact transient in [0, 1]. */
    readonly impact: number;
}

/** The producer's reusable, writable view of the same record. */
export type MutableWormholeSpatialFrame = { -readonly [K in keyof WormholeSpatialFrame]: WormholeSpatialFrame[K] };
