/** Player overrides of preset-authored wall values; 0.5 is neutral Advanced gain. */
export interface WormholeWallPresentation {
    mode: 'off' | 'preset' | 'on';
    material: 'preset' | 'membrane' | 'mosaic';
    amount: number; fringe: number; caustics: number; waves: number; cracks: number;
}
export const WORMHOLE_WALL_GAIN_FIELDS = ['amount','fringe','caustics','waves','cracks'] as const;
export const DEFAULT_WORMHOLE_WALL: Readonly<WormholeWallPresentation> = Object.freeze({
    mode:'off',material:'preset',amount:.5,fringe:.5,caustics:.5,waves:.5,cracks:.5
});
