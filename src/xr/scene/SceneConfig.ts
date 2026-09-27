export const SCENE_CONFIG = {
    playfieldForwardMeters: 0.85,
    defaultEyeHeightMeters: 1.65,
    hitHeightBelowEyesMeters: 0.55,
    runwayWidthMeters: 3.4,
    runwayFrontZMeters: -10,
    runwayBackZMeters: 2,
    /** Length of one repeat of the procedural floor pattern; the floor length is a whole multiple. */
    runwayTileLengthMeters: 2,
    /** World-anchored Wormhole backdrop plane, in stage-root space. */
    backdropWidthMeters: 106,
    backdropHeightMeters: 60,
    backdropCenterYMeters: 1.65,
    backdropDistanceMeters: 40,
    /** Far -> near stereo plane distances; all lie beyond the gameplay volume (runway <= 10 m). */
    backdropLayerDistancesMeters: [40, 22, 12],
    /** Distance ahead of the player where the track starts bending; nearer is exactly straight. */
    trackBendStartMeters: 2.5,
    /** Saturation limits for the far-end track displacement toward the Wormhole focal point. */
    trackMaxLateralBendMeters: 2.4,
    trackMaxVerticalBendMeters: 1
} as const;
