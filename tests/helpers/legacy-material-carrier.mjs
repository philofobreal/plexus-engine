// Frozen pre-step-9 carrier accumulator for whole-kernel comparison.
export function accumulateWormholeGrainCarrier(l0, cols, rows, viewportWidth, viewportHeight, carrier, detail) {
    const safeCols = Math.max(1, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    if (l0.length < safeCols * safeRows * 4)
        return;
    if (!(viewportWidth > 0) || !(viewportHeight > 0))
        return;
    const alpha01 = clamp01(finiteOr(carrier.alpha, 0) / 255);
    if (alpha01 <= 0)
        return;
    const tailX = finiteOr(carrier.tailX, 0) * safeCols / viewportWidth;
    const tailY = finiteOr(carrier.tailY, 0) * safeRows / viewportHeight;
    const headX = finiteOr(carrier.headX, 0) * safeCols / viewportWidth;
    const headY = finiteOr(carrier.headY, 0) * safeRows / viewportHeight;
    const dx = headX - tailX;
    const dy = headY - tailY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const safeDetail = clamp01(detail);
    const depth = clamp01(carrier.depth);
    const near = 1 - depth;
    const isWeave = finiteOr(carrier.weave ?? 0, 0) > 0;
    const energy = clamp01(carrier.energy);
    const strokeWeight = Math.max(0, finiteOr(carrier.strokeWeight, 0));
    const rasterScale = 0.5 * (safeCols / viewportWidth + safeRows / viewportHeight);
    const weightRaster = Math.max(0.25, strokeWeight * rasterScale);
    // Depth attenuation: exponential transmittance along the tunnel, plus an extra smoothstep on the
    // deepest stratum so the throat stays a hole and the light lives in the arms.
    const throatT = clamp01((depth - THROAT_DAMP_START) / (1 - THROAT_DAMP_START));
    const throatDamp = 1 - THROAT_DAMP_STRENGTH * throatT * throatT * (3 - 2 * throatT);
    const flux = alpha01 * (0.42 + 0.58 * energy) * throatDamp * Math.exp(-TUNNEL_EXTINCTION * depth);
    if (flux <= 1e-5)
        return;
    // A weave link is gas between two grains, so its haze scales with the gap it spans rather than
    // with nearness; scaling it by nearness would erase it exactly where the arms are.
    const coreRadius = Math.min(2.6, (0.3 + 1.5 * near * near) * (0.55 + 0.75 * weightRaster));
    const haloReach = isWeave
        ? 2.4 * (0.4 + 0.05 * length)
        : 0.1 + 2.3 * Math.pow(near, 2.2);
    const haloExtent = (0.5 + 3.4 * safeDetail) * (0.3 + 0.7 * Math.sqrt(flux)) * haloReach;
    let radius = Math.min(MAX_GRAIN_MATERIAL_DILATION_PX, coreRadius + haloExtent);
    // Bounded work: shrink the haze (never the core) until the capsule bounding area fits the cap.
    for (let guard = 0; guard < 6; guard++) {
        const span = (length + 2 * radius + 1) * (2 * radius + 1);
        if (span <= MAX_GRAIN_MATERIAL_PIXELS_PER_CARRIER || radius <= coreRadius)
            break;
        radius = Math.max(coreRadius, radius * 0.72);
    }
    const identity = carrierIdentity(finiteOr(carrier.seed, 0), finiteOr(carrier.generation, 0));
    const phase = finiteOr(carrier.materialPhase, 0);
    // A degenerate (head-on) carrier still needs a stable local frame so its mote is fibrous rather
    // than a smooth disc. The frame comes from immutable grain identity, never from motion.
    const invLength = length > 1e-6 ? 1 / length : 0;
    const fallbackAngle = hashUnit(identity, 3, 17) * Math.PI * 2;
    const tangentX = invLength > 0 ? dx * invLength : Math.cos(fallbackAngle);
    const tangentY = invLength > 0 ? dy * invLength : Math.sin(fallbackAngle);
    const normalX = -tangentY;
    const normalY = tangentX;
    // Atmospheric perspective: far strata cool toward the tunnel's own blue, near strata warm
    // toward its complement, so depth is readable as colour and not only as size.
    const colorR = clamp01(finiteOr(carrier.colorR, 0) / 255 * (0.72 + 0.62 * near));
    const colorG = clamp01(finiteOr(carrier.colorG, 0) / 255 * (0.94 - 0.06 * near));
    const colorB = clamp01(finiteOr(carrier.colorB, 0) / 255 * (1.22 - 0.16 * near));
    const radiusSq = radius * radius;
    const invRadiusSq = 1 / Math.max(1e-6, radiusSq);
    const invCoreSq = 1 / Math.max(1e-6, coreRadius * coreRadius);
    const haloGain = (0.1 + 0.4 * safeDetail) * (0.15 + 0.85 * near);
    const filamentPhase = hashUnit(identity, 11, 5) * 37;
    const fibrePhase = hashUnit(identity, 23, 9) * 53;
    // Far strata are fine-grained; near strata carry broad structure.
    const filamentFrequency = (1.6 + 4.4 * safeDetail) * (0.7 + 1.6 * depth);
    const fibreAcross = (0.45 + 0.85 * safeDetail) * (0.6 + 1.3 * depth);
    const fibreAlong = (0.12 + 0.18 * safeDetail) * (0.7 + 0.8 * depth);
    const filamentBias = 0.28 + 0.22 * safeDetail;
    // Breakup thins and brightens a strand; it must not chop it into a bead chain, so the
    // modulation keeps a floor. Weave gas is allowed to break up much further than a grain.
    const filamentFloor = isWeave ? 0.3 : 0.6 - 0.3 * safeDetail;
    // Deposited energy is spread over the covered area, so a wide haze must not also be as intense
    // per pixel as a tight core.
    const depositGain = (isWeave ? 1.6 : 1.7) / (0.5 + radius * 0.34);
    const filamented = length > 1.4;
    // Cost control. The faint outer skirt of a capsule is most of its area and none of its image:
    // below this pre-noise shape value the final contribution cannot reach a quarter of an 8-bit
    // code even after the resolve gain, so the noise evaluations are skipped there entirely.
    const negligible = 6e-5 / Math.max(1e-6, flux * depositGain);
    const minX = Math.max(0, Math.floor(Math.min(tailX, headX) - radius));
    const maxX = Math.min(safeCols - 1, Math.ceil(Math.max(tailX, headX) + radius));
    const minY = Math.max(0, Math.floor(Math.min(tailY, headY) - radius));
    const maxY = Math.min(safeRows - 1, Math.ceil(Math.max(tailY, headY) + radius));
    // A capsule is contained in the infinite strip |across| <= radius. Intersect each row
    // with that strip before testing the exact rounded support below. This avoids the mostly
    // empty AABB of a diagonal carrier without changing any shading arithmetic or write order.
    // Near-horizontal strips and extreme coordinates retain the exhaustive bounds; a one-pixel
    // guard covers rounding at the strip edge for the normal, bounded viewport coordinates.
    const narrowRows = Math.abs(normalX) > 1e-6
        && Math.max(Math.abs(tailX), Math.abs(tailY), Math.abs(headX), Math.abs(headY)) < 1e7;
    const rowSlope = narrowRows ? -normalY / normalX : 0;
    const rowReach = narrowRows ? radius / Math.abs(normalX) : 0;
    for (let y = minY; y <= maxY; y++) {
        const relY = y + 0.5 - tailY;
        const rowCenter = tailX + relY * rowSlope - 0.5;
        const rowMinX = narrowRows ? Math.max(minX, Math.floor(rowCenter - rowReach) - 1) : minX;
        const rowMaxX = narrowRows ? Math.min(maxX, Math.ceil(rowCenter + rowReach) + 1) : maxX;
        for (let x = rowMinX; x <= rowMaxX; x++) {
            const relX = x + 0.5 - tailX;
            const along = relX * tangentX + relY * tangentY;
            const across = relX * normalX + relY * normalY;
            const beyond = along < 0 ? -along : (along > length ? along - length : 0);
            const distanceSq = across * across + beyond * beyond;
            if (distanceSq > radiusSq)
                continue;
            const coreFalloff = 1 - distanceSq * invCoreSq;
            const core = coreFalloff > 0 ? coreFalloff * coreFalloff : 0;
            const haloFalloff = 1 - distanceSq * invRadiusSq;
            const halo = haloFalloff * haloFalloff * haloFalloff * haloGain;
            const shape = core + halo;
            if (shape <= negligible)
                continue;
            // A grain's projected head is its emitting front and the trail dissipates behind it; a
            // weave link has two equal ends, so it swells in the middle instead.
            const alongUnit = invLength > 0 ? clamp01(along * invLength) : 1;
            const taper = filamented
                ? (isWeave
                    ? 0.55 + 0.45 * Math.sin(Math.PI * alongUnit)
                    : 0.24 + 0.76 * alongUnit * (0.42 + 0.58 * alongUnit))
                : 1;
            let filament = 1;
            if (filamented && !isWeave) {
                const coarse = valueNoise1(alongUnit * filamentFrequency + filamentPhase + phase * 0.31, identity);
                const fine = valueNoise1(alongUnit * filamentFrequency * 2.6 + filamentPhase * 1.7 + phase * 0.57, identity ^ 0x5bf03635);
                const mixed = coarse * 0.63 + fine * 0.37;
                const shaped = clamp01((mixed - filamentBias) * (0.9 + 1.15 * safeDetail) + 0.5);
                filament = filamentFloor + (1 - filamentFloor) * shaped * shaped * (3 - 2 * shaped);
            }
            // Grains carry the readable structure and get the full two-octave fibre plus micro
            // detail. Weave gas is broad, dim, and far more numerous, so it runs one octave and no
            // micro pass: the same read at a fraction of the per-pixel cost.
            const fibreA = valueNoise2(along * fibreAlong + fibrePhase + phase * 0.44, across * fibreAcross, identity ^ 0x1b873593);
            let texture;
            if (isWeave) {
                texture = 0.62 + 0.76 * fibreA;
            }
            else {
                const fibreB = valueNoise2(along * fibreAlong * 2.7 + fibrePhase * 1.3 + phase * 0.79, across * fibreAcross * 2.7, identity ^ 0x27d4eb2d);
                const micro = 0.86 + 0.28 * valueNoise2(along * 0.9 + phase * 1.13, across * 1.6, identity ^ 0x165667b1);
                texture = (0.5 + 0.72 * (fibreA * 0.64 + fibreB * 0.36)) * micro;
            }
            const contribution = flux * shape * taper * filament * texture * depositGain;
            if (contribution <= 1e-6)
                continue;
            const index = (y * safeCols + x) * 4;
            l0[index] += colorR * contribution;
            l0[index + 1] += colorG * contribution;
            l0[index + 2] += colorB * contribution;
            l0[index + 3] += contribution;
        }
    }
}
