export function normalizeArray(input: Float32Array, typMax: number): Float32Array {
    const output = new Float32Array(input.length);
    const divisor = typMax || 0.001;

    for (let i = 0; i < input.length; i++) {
        output[i] = Math.min(1, Math.max(0, input[i] / divisor));
    }

    return output;
}
