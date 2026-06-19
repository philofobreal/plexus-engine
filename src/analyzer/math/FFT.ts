export class FFT {
    public readonly size: number;
    public readonly binCount: number;
    public readonly re: Float32Array;
    public readonly im: Float32Array;
    public readonly window: Float32Array;
    private readonly cosTable: Float32Array;
    private readonly sinTable: Float32Array;

    constructor(size: number) {
        if (size < 2 || (size & (size - 1)) !== 0) {
            throw new Error(`FFT size must be a power of two, got ${size}`);
        }

        this.size = size;
        this.binCount = size / 2;
        this.re = new Float32Array(size);
        this.im = new Float32Array(size);
        this.window = createHannWindow(size);
        this.cosTable = new Float32Array(this.binCount);
        this.sinTable = new Float32Array(this.binCount);

        for (let i = 0; i < this.binCount; i++) {
            this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
            this.sinTable[i] = Math.sin((-2 * Math.PI * i) / size);
        }
    }

    public setWindowedSamples(samples: Float32Array, start: number): number {
        let energy = 0;
        for (let i = 0; i < this.size; i++) {
            const sample = samples[start + i] || 0;
            energy += sample * sample;
            this.re[i] = sample * this.window[i];
            this.im[i] = 0;
        }
        return energy;
    }

    public transform(): void {
        let j = 0;
        for (let i = 0; i < this.size - 1; i++) {
            if (i < j) {
                const tr = this.re[j], ti = this.im[j];
                this.re[j] = this.re[i]; this.im[j] = this.im[i];
                this.re[i] = tr; this.im[i] = ti;
            }
            let k = this.size >> 1;
            while (k <= j) { j -= k; k >>= 1; }
            j += k;
        }

        for (let size = 2; size <= this.size; size *= 2) {
            const halfsize = size / 2;
            const tablestep = this.size / size;
            for (let i = 0; i < this.size; i += size) {
                for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
                    const c = this.cosTable[k], s = this.sinTable[k];
                    const tr = this.re[j + halfsize] * c - this.im[j + halfsize] * s;
                    const ti = this.re[j + halfsize] * s + this.im[j + halfsize] * c;
                    this.re[j + halfsize] = this.re[j] - tr;
                    this.im[j + halfsize] = this.im[j] - ti;
                    this.re[j] += tr;
                    this.im[j] += ti;
                }
            }
        }
    }

    public magnitude(bin: number): number {
        return Math.sqrt(this.re[bin] * this.re[bin] + this.im[bin] * this.im[bin]);
    }
}

export function createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, size - 1)));
    }
    return window;
}
