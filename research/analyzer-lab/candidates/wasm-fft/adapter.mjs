// Research factory; neither this module nor its WASM is imported by production.
export function makeWasmFFT(ReferenceFFT, module, mode = 'resident') {
    if (!['resident', 'copy'].includes(mode)) throw new Error('Invalid FFT memory mode');
    return class ScalarWasmFFT extends ReferenceFFT {
        constructor(size) {
            super(size); // Keep exact reference validation, Hann and twiddle arithmetic.
            const pages = Math.ceil(12 * size / 65536);
            this.memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
            this.instance = new WebAssembly.Instance(module, { env: { memory: this.memory } });
            this.wasmRe = new Float32Array(this.memory.buffer, 0, size);
            this.wasmIm = new Float32Array(this.memory.buffer, 4 * size, size);
            new Float32Array(this.memory.buffer, 8 * size, size / 2).set(this.cosTable);
            new Float32Array(this.memory.buffer, 10 * size, size / 2).set(this.sinTable);
            if (mode === 'resident') {
                this.re = this.wasmRe;
                this.im = this.wasmIm;
            }
        }
        transform() {
            if (mode === 'copy') { this.wasmRe.set(this.re); this.wasmIm.set(this.im); }
            this.instance.exports.transform(this.size);
            if (mode === 'copy') { this.re.set(this.wasmRe); this.im.set(this.wasmIm); }
        }
    };
}
