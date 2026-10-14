// Float32 mirror of `TRACK_BEND_GLSL` (src/xr/scene/XrTrackPath.ts), operation for operation, so
// tests can read the positions the GPU renders for static runway geometry. `xr-track-path.test.mjs`
// pins the GLSL text this mirrors; change both together.

const f = Math.fround;

/** `xrTrackPathOffset(rootZ)` for a `uTrackBend` value (x, y: amplitudes; z: bend start; w: bend end). */
export function glslTrackOffset(uniform, rootZ) {
    const start = f(uniform.z), end = f(uniform.w);
    const u = Math.min(1, Math.max(0, f(f(f(-f(rootZ)) - start) / f(end - start))));
    const weight = f(u * u);
    return { x: f(f(uniform.x) * weight), y: f(f(uniform.y) * weight) };
}

/**
 * `xrTrackPathOffsetExtended(rootZ)` (`TRACK_BEND_EXTENDED_GLSL`): the far-end tangent continued past
 * the runway, plus the far-aim remainder (`uTrackFarAim`: x, y, backdrop distance; absent = none).
 */
export function glslTrackOffsetExtended(uniform, rootZ, farAim = { x: 0, y: 0, z: 0, w: 0 }) {
    const start = f(uniform.z), end = f(uniform.w);
    const u = Math.max(0, f(f(f(-f(rootZ)) - start) / f(end - start)));
    const weight = u <= 1 ? f(u * u) : f(f(2 * u) - 1);
    const q = f(farAim.z) > end ? Math.max(0, f(f(f(-f(rootZ)) - end) / f(f(farAim.z) - end))) : 0;
    const aim = f(q * q);
    return { x: f(f(f(uniform.x) * weight) + f(f(farAim.x) * aim)), y: f(f(f(uniform.y) * weight) + f(f(farAim.y) * aim)) };
}

/** Rendered (shader-bent) positions of a stage-root mesh: `transformed.xy += xrTrackPathOffset(transformed.z)`. */
export function renderedPositions(geometry, uniform) {
    const source = geometry.getAttribute('position').array, out = new Float32Array(source.length);
    for (let i = 0; i < source.length; i += 3) {
        const offset = glslTrackOffset(uniform, source[i + 2]);
        out[i] = f(source[i] + offset.x); out[i + 1] = f(source[i + 1] + offset.y); out[i + 2] = source[i + 2];
    }
    return out;
}
