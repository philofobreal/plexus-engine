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

/**
 * The player-dependent part of the stage (ADR-009 Addendum I). Everything else in `SCENE_CONFIG` is
 * fixed. `DEFAULT_STAGE_LAYOUT` is the historical stage; the controller applies the layout derived
 * from the player's note speed and saber length (`resolvePlayProfile`).
 */
export interface XrStageLayout {
    /** Hit plane (start frame) distance ahead of the player origin, in meters. */
    readonly playfieldForwardMeters: number;
    /** Far end of the runway in stage-root z (negative = ahead). */
    readonly runwayFrontZMeters: number;
    /** Targets fade in over this distance after spawning (0 = they appear at full strength). */
    readonly spawnFadeMeters: number;
    /** Target rows on the start frame (3 standard, 4 with the Tall overhead row, Addendum M). */
    readonly rowCount: number;
    /**
     * The start frame around the rows, in playfield meters (y = 0 is the middle row): its center
     * height and inner half-height. Gates, the callout and the song map follow it.
     */
    readonly frameCenterYMeters: number;
    readonly frameHalfHeightMeters: number;
    /** Score HUD placement: above the runway, or beside it when the overhead row needs the space above. */
    readonly hudPlacement: 'above' | 'side';
}

/** Inner half-width of the start frame around the lanes (fixed: lanes do not change with the play space). */
export const START_FRAME_HALF_WIDTH_METERS = 0.8;

export const DEFAULT_STAGE_LAYOUT: XrStageLayout = Object.freeze({
    playfieldForwardMeters: SCENE_CONFIG.playfieldForwardMeters,
    runwayFrontZMeters: SCENE_CONFIG.runwayFrontZMeters,
    spawnFadeMeters: 0,
    rowCount: 3,
    frameCenterYMeters: 0,
    frameHalfHeightMeters: 0.6,
    hudPlacement: 'above'
});
