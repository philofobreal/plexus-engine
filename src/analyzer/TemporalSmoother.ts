export function applyEMA(input: Float32Array, alpha: number): Float32Array {
    const output = new Float32Array(input.length);
    let s = input.length > 0 ? input[0] : 0;

    for (let i = 0; i < input.length; i++) {
        s += (input[i] - s) * alpha;
        output[i] = s;
    }

    return output;
}
