// Float64 transport preserves the CPU carrier inputs before their Float32 raster writes.
export const CARRIER_FIELDS = Object.freeze([
    'headX', 'headY', 'tailX', 'tailY', 'alpha', 'strokeWeight',
    'colorR', 'colorG', 'colorB', 'seed', 'generation', 'materialPhase', 'energy', 'depth', 'weave',
]);
export const MAX_CARRIERS = 32768;
