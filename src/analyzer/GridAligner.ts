import { FeatureExtractor } from './FeatureExtractor';

export class GridAligner {
    private features: FeatureExtractor;
    private sampleRate: number;
    private hopSize: number;
    public estimatedBPM: number = 120;
    public gridOffset: number = 0;
    public secondsPerBar: number = 2;
    public secondsPerBeat: number = 0.5;

    constructor(features: FeatureExtractor, sampleRate: number, hopSize: number) {
        this.features = features;
        this.sampleRate = sampleRate;
        this.hopSize = hopSize;
    }

    public calculate(): void {
        const { totalFrames, fluxT, rawBassT, typFlux } = this.features;
        const totalDuration = totalFrames * this.hopSize / this.sampleRate;

        // 1. ROBUST BPM DETECTION (Histogram based)
        let intervals: number[] = [];
        let tempLastBeat = 0;
        for (let i = 20; i < totalFrames - 20; i++) {
            let sum = 0; for(let j=i-20; j<=i+20; j++) sum += fluxT[j];
            let avg = sum / 41;
            if (fluxT[i] > avg * 1.5 && fluxT[i] > typFlux * 0.1) {
                if (fluxT[i] > fluxT[i-1] && fluxT[i] > fluxT[i+1]) {
                    let time = i * this.hopSize / this.sampleRate;
                    if (time - tempLastBeat > 0.3) {
                        intervals.push(Math.round(60 / (time - tempLastBeat)));
                        tempLastBeat = time;
                    }
                }
            }
        }

        if (intervals.length > 0) {
            let counts: Record<number, number> = {};
            let maxCount = 0;
            for (let b of intervals) {
                if (b >= 70 && b <= 180) {
                    counts[b] = (counts[b] || 0) + 1;
                    if (counts[b] > maxCount) { maxCount = counts[b]; this.estimatedBPM = b; }
                }
            }
        }

        this.secondsPerBeat = 60 / this.estimatedBPM;
        const secondsPerBeat = this.secondsPerBeat;
        this.secondsPerBar = secondsPerBeat * 4;

        // 2. THE "GROUND TRUTH" ANCHOR PROJECTOR
        // Find the single hardest-hitting percussive moment in the ENTIRE track (The Main Drop Kick)
        let maxHitScore = 0;
        let masterAnchorTime = 0;
        for (let i = 0; i < totalFrames; i++) {
            // Spectral flux (transient sharpness) multiplied by raw bass (kick drum weight)
            let score = fluxT[i] * rawBassT[i];
            if (score > maxHitScore) {
                maxHitScore = score;
                masterAnchorTime = i * this.hopSize / this.sampleRate;
            }
        }

        // 3. EXTRACT EXACT BEAT PHASE
        // We now know exactly where a beat is. We project this phase backward to 0.000s.
        let exactBeatPhase = masterAnchorTime % this.secondsPerBeat;
        if (exactBeatPhase < 0) exactBeatPhase += this.secondsPerBeat;

        // 4. FIND THE DOWNBEAT (1.1.1)
        // A beat can be the 1st, 2nd, 3rd, or 4th quarter note of a bar.
        // We project a grid for each of the 4 possibilities across the ENTIRE track
        // and see which one aligns with the most bass transients (kick drums).
        let bestBarOffset = exactBeatPhase;
        let maxGlobalCorrelation = -1;

        for (let i = 0; i < 4; i++) {
            let testOffset = exactBeatPhase + i * this.secondsPerBeat;
            let correlation = 0;

            // Sample the entire track exactly on this projected grid
            for (let t = testOffset; t < totalDuration; t += this.secondsPerBar) {
                let frame = Math.floor(t * this.sampleRate / this.hopSize);
                if (frame >= 0 && frame < totalFrames) {
                    correlation += fluxT[frame] * rawBassT[frame];
                }
            }

            if (correlation > maxGlobalCorrelation) {
                maxGlobalCorrelation = correlation;
                bestBarOffset = testOffset;
            }
        }

        // 5. LOCK THE GLOBAL GRID OFFSET
        this.gridOffset = bestBarOffset % this.secondsPerBar;
        if (this.gridOffset < 0) this.gridOffset += this.secondsPerBar;
    }
}

