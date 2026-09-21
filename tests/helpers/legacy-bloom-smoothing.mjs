// Frozen pre-step-8 reference: channel-at-a-time bloom recurrence.
// Retained independently to detect arithmetic/order/rounding changes.
export function smoothBloomLayerInPlace(buffer, cols, rows, passes, keep) {
    const safeCols = Math.max(1, Math.floor(cols));
    const safeRows = Math.max(1, Math.floor(rows));
    if (buffer.length < safeCols * safeRows * 4)
        return;
    const safeKeep = Math.min(0.99, Math.max(0.01, keep));
    const spread = 1 - safeKeep;
    for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < safeRows; y++) {
            const rowStart = y * safeCols * 4;
            for (let channel = 0; channel < 4; channel++) {
                let previous = buffer[rowStart + channel];
                for (let x = 1; x < safeCols; x++) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[rowStart + (safeCols - 1) * 4 + channel];
                for (let x = safeCols - 2; x >= 0; x--) {
                    const index = rowStart + x * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
            }
        }
        for (let x = 0; x < safeCols; x++) {
            const columnStart = x * 4;
            for (let channel = 0; channel < 4; channel++) {
                let previous = buffer[columnStart + channel];
                for (let y = 1; y < safeRows; y++) {
                    const index = (y * safeCols + x) * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
                previous = buffer[((safeRows - 1) * safeCols + x) * 4 + channel];
                for (let y = safeRows - 2; y >= 0; y--) {
                    const index = (y * safeCols + x) * 4 + channel;
                    previous = buffer[index] * safeKeep + previous * spread;
                    buffer[index] = previous;
                }
            }
        }
    }
}
