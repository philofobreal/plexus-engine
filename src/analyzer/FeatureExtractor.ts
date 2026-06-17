export class FeatureExtractor {
    private channel: Float32Array;
    private hopSize: number;
    public totalFrames: number;
    public rmsT: Float32Array;
    public fluxT: Float32Array;
    public rawBassT: Float32Array;
    public rawMidT: Float32Array;
    public rawHighT: Float32Array;
    public centroidT: Float32Array;
    public flatnessT: Float32Array;
    public pitchConfidenceT: Float32Array;
    public typRms: number = 0;
    public typFlux: number = 0;

    constructor(channel: Float32Array, sampleRate: number, hopSize: number) {
        void sampleRate;
        this.channel = channel;
        this.hopSize = hopSize;
        this.totalFrames = Math.floor(channel.length / hopSize);
        this.rmsT = new Float32Array(this.totalFrames);
        this.fluxT = new Float32Array(this.totalFrames);
        this.rawBassT = new Float32Array(this.totalFrames);
        this.rawMidT = new Float32Array(this.totalFrames);
        this.rawHighT = new Float32Array(this.totalFrames);
        this.centroidT = new Float32Array(this.totalFrames);
        this.flatnessT = new Float32Array(this.totalFrames);
        this.pitchConfidenceT = new Float32Array(this.totalFrames);
    }

    public process(onProgress?: (p: number) => void): void {
        const N = this.hopSize;
        const cosTable = new Float32Array(N / 2);
        const sinTable = new Float32Array(N / 2);
        for (let i = 0; i < N / 2; i++) {
            cosTable[i] = Math.cos((2 * Math.PI * i) / N);
            sinTable[i] = Math.sin((-2 * Math.PI * i) / N);
        }

        const windowMultiplier = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            windowMultiplier[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        }

        const re = new Float32Array(N);
        const im = new Float32Array(N);
        const prevMag = new Float32Array(N / 2);
        let lastReportedProgress = -1;
        const processFFT = () => {
            let j = 0;
            for (let i = 0; i < N - 1; i++) {
                if (i < j) { let tr = re[j], ti = im[j]; re[j] = re[i]; im[j] = im[i]; re[i] = tr; im[i] = ti; }
                let k = N >> 1;
                while (k <= j) { j -= k; k >>= 1; }
                j += k;
            }
            for (let size = 2; size <= N; size *= 2) {
                let halfsize = size / 2;
                let tablestep = N / size;
                for (let i = 0; i < N; i += size) {
                    for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
                        let c = cosTable[k], s = sinTable[k];
                        let tr = re[j + halfsize] * c - im[j + halfsize] * s;
                        let ti = re[j + halfsize] * s + im[j + halfsize] * c;
                        re[j + halfsize] = re[j] - tr; im[j + halfsize] = im[j] - ti;
                        re[j] += tr; im[j] += ti;
                    }
                }
            }
        };

        for (let i = 0; i < this.totalFrames; i++) {
            let start = i * this.hopSize;
            let sumE = 0;
            for (let j = 0; j < this.hopSize; j++) {
                let sample = this.channel[start + j] || 0;
                sumE += sample * sample;
                re[j] = sample * windowMultiplier[j];
                im[j] = 0;
            }
            this.rmsT[i] = Math.sqrt(sumE / this.hopSize);

            processFFT();

            let sumMag = 0, sumFreqMag = 0, sumLogMag = 0;
            let currentFlux = 0, eB = 0, eM = 0, eH = 0;

            for (let k = 1; k < N / 2; k++) {
                let mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                sumMag += mag;
                sumFreqMag += k * mag;
                sumLogMag += Math.log(mag + 1e-6);

                let fluxDiff = Math.max(0, mag - prevMag[k]);
                currentFlux += fluxDiff;
                prevMag[k] = mag;

                if (k <= 6) eB += mag;
                else if (k <= 93) eM += mag;
                else if (k <= 465) eH += mag;
            }

            this.fluxT[i] = currentFlux;
            let totalBand = eB + eM + eH + 1e-6;
            this.rawBassT[i] = eB / totalBand;
            this.rawMidT[i] = eM / totalBand;
            this.rawHighT[i] = eH / totalBand;
            
            this.centroidT[i] = sumMag > 0 ? (sumFreqMag / sumMag) / 512 : 0;
            this.flatnessT[i] = sumMag > 0 ? Math.exp(sumLogMag / 511) / (sumMag / 511) : 0;
            this.pitchConfidenceT[i] = Math.min(1, Math.max(0, 1 - this.flatnessT[i]));

            if (onProgress && this.totalFrames > 0) {
                const p = (i + 1) / this.totalFrames;
                if (p - lastReportedProgress >= 0.02) {
                    onProgress(p);
                    lastReportedProgress = p;
                }
            }
        }

        const getTypicalMax = (arr: Float32Array) => {
            let sorted = new Float32Array(arr).sort();
            return sorted[Math.floor(sorted.length * 0.98)] || 0.001;
        };
        this.typRms = getTypicalMax(this.rmsT);
        this.typFlux = getTypicalMax(this.fluxT);
    }
}

