// Frozen pre-step-10 float-to-byte conversion, including Bayer threshold and operation order.
export function legacyConvert(src, pixels, cols, rows, safeGain, thresholds) {
        let index = 0;
        for (let y = 0; y < rows; y++) {
            const ditherRow = (y & 7) * 8;
            for (let x = 0; x < cols; x++) {
                // The threshold stays below half a code, so an exactly zero channel still rounds to
                // 0 and a fully cleared layer stays fully transparent.
                const threshold = thresholds[ditherRow + (x & 7)];
                for (let channel = 0; channel < 4; channel++) {
                    // Uint8ClampedArray assignment clamps NaN -> 0 and +-Infinity -> 0/255 per spec,
                    // so malformed source channels cannot leak a NaN pixel even without a guard.
                    pixels[index] = src[index] * safeGain * 255 + threshold;
                    index++;
                }
            }
        }
}
