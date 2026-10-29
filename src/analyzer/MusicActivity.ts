import type { FeatureClock } from '../types/featureClock';
import type { AcousticActivityLayer, AcousticAttack, AcousticTexture } from '../types/musicEvents';
import { validateAnalysisClock, validateAnalysisSamples } from './signalContract';
import { FFT } from './math/FFT';
import type { FftKernelFactory } from './math/FFT';
import { classifyEntryNeighborhood, attackChangeWindowSize } from '../types/musicEvents';

// A bounded monitor of frozen frequency bins, never ownership of an isolated sound source.
interface EntryBand {
    frame: number; bins: number[]; baseline: number[]; peak: number; quiet: number;
    endFrame: number | null; // First of two complete low-energy windows.
}


/** Fixed signal measurements, not instrument/voice probabilities or a second beat detector.
 * Borrows feature FFTs read-only. The optional attack-change sidecar uses two bounded
 * short transforms per accepted energy attack at finish(), never render-time DSP.
 */
export class MusicActivity {
    private readonly samples: Float32Array;
    private readonly clock: FeatureClock;
    private readonly power: Float64Array;
    private readonly concentration: Float64Array;
    private readonly spectrum: Float64Array;
    private readonly marks: Uint32Array;
    private readonly peakBins = new Int32Array(6);
    private readonly peakPower = new Float64Array(6);
    private readonly textureAvailable: boolean;
    private readonly windowSpectrum: FFT;
    private readonly history: Float64Array[];
    private readonly historyPeaks = Array.from({ length: 3 }, () => new Int32Array(6));
    private readonly currentPeaks = new Int32Array(6);
    private readonly entrySpectrum: Float64Array;
    private readonly hannPower: number;
    private readonly entryFrames: { frame: number; texture: AcousticTexture; fraction: number; retained: number; bins: number[]; carrier: number; band: EntryBand | null; contextPeak: number; prefixPower: number; prefixRatio: number }[] = [];
    private readonly activeBands: EntryBand[] = [];
    private stamp = 0;
    private count = 0;
    // AC RMS floor = 1e-5 amplitude (-100 dBFS); no per-track quantile amplification.
    private static readonly FLOOR_POWER = 1e-10;

    private readonly fftKernelFactory?: FftKernelFactory;

    constructor(samples: Float32Array, sampleRate: number, hopSize: number, fftKernelFactory?: FftKernelFactory) {
        this.fftKernelFactory = fftKernelFactory;
        validateAnalysisClock(sampleRate, hopSize); validateAnalysisSamples(samples);
        this.samples = samples;
        this.clock = { sampleRate, sampleCount: samples.length, hopSize, windowSize: hopSize,
            originSample: 0, timestamp: 'window-start', tailPolicy: 'zero-pad' };
        const frames = Math.ceil(samples.length / hopSize);
        this.power = new Float64Array(frames); this.concentration = new Float64Array(frames);
        this.spectrum = new Float64Array(hopSize / 2); this.marks = new Uint32Array(hopSize / 2);
        this.textureAvailable = hopSize >= 512 && hopSize / sampleRate >= .015;
        this.windowSpectrum = this.hannSpectrum(hopSize);
        this.history = Array.from({ length: 3 }, () => new Float64Array(hopSize / 2));
        this.entrySpectrum = new Float64Array(hopSize / 2);
        this.hannPower = this.windowSpectrum.window.reduce((s, w) => s + w * w, 0);
    }

    private hannSpectrum(valid: number): FFT {
        const fft = new FFT(this.clock.hopSize, this.fftKernelFactory);
        for (let i = 0; i < valid; i++) fft.re[i] = fft.window[i];
        fft.transform(); return fft;
    }

    /** Synchronous read-only observer; FFT arrays remain owned by FeatureExtractor. */
    observe(start: number, re: Float32Array, im: Float32Array): void {
        const { hopSize, sampleCount } = this.clock, index = this.count;
        if (index >= this.power.length || start !== index * hopSize || re.length !== hopSize || im.length !== hopSize)
            throw new Error('Music activity spectrum clock mismatch');
        this.count++;
        const end = Math.min(sampleCount, start + hopSize);
        let mean = 0, m2 = 0;
        for (let i = start; i < end; i++) {
            const delta = this.samples[i] - mean;
            mean += delta / (i - start + 1); m2 += delta * (this.samples[i] - mean);
        }
        this.power[index] = Math.max(0, m2 / (end - start));
        // FFT((x-mean)*Hann) = borrowed FFT(x*Hann) - mean*FFT(Hann).
        // A partial tail subtracts the window only over observed samples, not padded silence.
        const window = end - start === hopSize ? this.windowSpectrum : this.hannSpectrum(end - start);
        let total = 0;
        for (let k = 1; k < this.spectrum.length; k++) {
            const p = (re[k] - mean * window.re[k]) ** 2 + (im[k] - mean * window.im[k]) ** 2;
            this.spectrum[k] = p; total += p;
        }
        this.concentration[index] = this.concentrated(this.spectrum, total);
        this.currentPeaks.set(this.peakBins);
        for (let j = this.entryFrames.length - 1; j >= 0 && index - this.entryFrames[j].frame <= 2; j--) {
            const e = this.entryFrames[j];
            let body = 0;
            for (const bin of e.bins) body += this.spectrum[bin];
            e.retained = Math.min(e.retained, body / e.carrier);
        }
        this.observeBands(index, end - start === hopSize);
        this.observeEntry(index, end - start === hopSize, total);
        this.history[index % 3].set(this.spectrum);
        this.historyPeaks[index % 3].set(this.currentPeaks);
    }

    private concentrated(spectrum: Float64Array, total: number): number {
        this.stamp++;
        this.peakBins.fill(-1); this.peakPower.fill(-1);
        for (let k = 1; k < spectrum.length; k++) {
            const p = spectrum[k];
            if (p <= (spectrum[k - 1] ?? 0) || p < (spectrum[k + 1] ?? 0) || p <= this.peakPower[5]) continue;
            let at = 5;
            while (at > 0 && p > this.peakPower[at - 1]) {
                this.peakPower[at] = this.peakPower[at - 1]; this.peakBins[at] = this.peakBins[at - 1]; at--;
            }
            this.peakPower[at] = p; this.peakBins[at] = k;
        }
        let concentrated = 0;
        for (const bin of this.peakBins) if (bin >= 0) {
            for (let k = Math.max(1, bin - 1); k <= Math.min(spectrum.length - 1, bin + 1); k++) {
                if (this.marks[k] === this.stamp) continue;
                this.marks[k] = this.stamp; concentrated += spectrum[k];
            }
        }
        return total > 0 ? Math.min(1, concentrated / total) : 0;
    }

    /** Conservative extra proposals over a stable tonal carrier, not arbitrary mixture separation.
     * Background uses observed prefix only. Three spectra are a fixed ring, never a spectrogram.
     */
    private observeEntry(frame: number, full: boolean, total: number): void {
        if (!full || !this.textureAvailable || frame < 3 || total <= 0) return;
        let low = Infinity, high = 0;
        for (let i = frame - 3; i < frame; i++) {
            if (this.concentration[i] < .8 || this.power[i] <= MusicActivity.FLOOR_POWER) return;
            low = Math.min(low, this.power[i]); high = Math.max(high, this.power[i]);
        }
        if (high > low * 1.2) return;
        const baseline = this.history[frame % 3], delta = this.entrySpectrum;
        delta.fill(0);
        let peak = 0;
        for (const p of baseline) peak = Math.max(peak, p);
        let originalCarrier = 0, currentCarrier = 0, novelty = 0;
        for (let k = 1; k < delta.length; k++) {
            let occupied = false;
            for (let n = Math.max(1, k - 2); n <= Math.min(delta.length - 1, k + 2); n++)
                if (baseline[n] >= peak * .02) { occupied = true; break; }
            if (occupied) { originalCarrier += baseline[k]; currentCarrier += this.spectrum[k]; }
            else { delta[k] = Math.max(0, this.spectrum[k] - 4 * baseline[k]); novelty += delta[k]; }
        }
        const retained = originalCarrier > 0 ? currentCarrier / originalCarrier : 0;
        // Reject replacement/legato/cutoff: the previously observed carrier must survive.
        if (retained < .8 || novelty < total * .005) return;
        const hop = this.clock.hopSize;
        // Parseval scale is used only as an absolute floor, never calibrated source loudness.
        if (2 * novelty / (hop * this.hannPower) <= MusicActivity.FLOOR_POWER) return;
        const bins: number[] = [];
        for (const peakBin of this.historyPeaks[frame % 3]) if (peakBin >= 0 && baseline[peakBin] >= peak * .02)
            for (let k = Math.max(1, peakBin - 2); k <= Math.min(delta.length - 1, peakBin + 2); k++) if (!bins.includes(k)) bins.push(k);
        const carrier = bins.reduce((sum, bin) => sum + baseline[bin], 0);
        if (carrier <= 0) return;
        const family = texture(this.concentrated(delta, novelty));
        const contextPeak = this.peakBins[0];
        // Only f-3 and f-2 are guaranteed pre-search. f-1 can already contain the entry.
        const prefix = Math.max(this.neighborhoodPower(baseline, contextPeak, 4), this.neighborhoodPower(this.history[(frame + 1) % 3], contextPeak, 4));
        const prefixPower = 2 * prefix / (hop * this.hannPower);
        const prefixRatio = prefix / this.neighborhoodPower(this.spectrum, contextPeak, 1);
        // concentrated(delta) left the NEW excess peaks here; carrier bins above are different.
        let band: EntryBand | null = null;
        if (this.activeBands.length < 32) {
            const mask: number[] = [];
            for (const peakBin of this.peakBins) if (peakBin >= 0 && delta[peakBin] >= this.peakPower[0] * .02 && delta[peakBin] > 0)
                for (let k = Math.max(1, peakBin - 1); k <= Math.min(delta.length - 1, peakBin + 1); k++)
                    if (!mask.includes(k)) mask.push(k);
            mask.sort((a, b) => a - b);
            band = { frame, bins: mask, baseline: mask.map(k => 4 * baseline[k]), peak: 0, quiet: 0, endFrame: null };
            band.peak = this.bandPower(band);
            this.activeBands.push(band);
        }
        this.entryFrames.push({ frame, texture: family, fraction: novelty / total, retained, bins, carrier, band, contextPeak, prefixPower, prefixRatio });
    }

    private neighborhoodPower(spectrum: Float64Array, center: number, radius: number): number {
        let power = 0;
        for (let k = Math.max(1, center - radius); k <= Math.min(spectrum.length - 1, center + radius); k++) power += spectrum[k];
        return power;
    }

    private bandPower(band: EntryBand): number {
        let power = 0;
        for (let i = 0; i < band.bins.length; i++) power += Math.max(0, this.spectrum[band.bins[i]] - band.baseline[i]);
        return power;
    }

    private observeBands(frame: number, full: boolean): void {
        // Partial/padded windows cannot establish a release or train the frozen body threshold.
        if (!full) return;
        const floor = MusicActivity.FLOOR_POWER * this.clock.hopSize * this.hannPower / 2;
        for (let i = this.activeBands.length - 1; i >= 0; i--) {
            const band = this.activeBands[i], power = this.bandPower(band);
            // Only the three entry body windows set the reference. Later loud sources cannot
            // raise the release threshold and retroactively erase a held weaker entry.
            if (frame < band.frame + 3) band.peak = Math.max(band.peak, power);
            if (power > Math.max(floor, band.peak * .1)) band.quiet = 0;
            else band.quiet++;
            if (band.quiet >= 2) {
                band.endFrame = frame - 1;
                this.activeBands.splice(i, 1);
            }
        }
    }

    finish(): AcousticActivityLayer {
        if (this.count !== this.power.length) throw new Error('Incomplete music activity spectrum coverage');
        const { sampleRate: fs, sampleCount: length, hopSize: hop } = this.clock;
        const result: AcousticActivityLayer = {
            algorithm: 'acoustic-activity-v1', source: 'analysis-pcm', clock: { ...this.clock }, confidence: null,
            consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
            capabilities: { attacks: 'energy-rise-candidates', offsets: 'activity-boundaries',
                sustain: 'activity-span', family: 'spectral-texture', dominance: 'acoustic-texture',
                noteIdentity: 'unsupported', vocal: 'unsupported' },
            activity: [], attacks: [], dominance: []
        };
        const floor = MusicActivity.FLOOR_POWER;
        const active = (i: number) => i >= 0 && i < this.count && this.power[i] > floor;
        let start = -1, quiet = 0, peak = 0, valley = Infinity, lastAttack = -Infinity;
        for (let i = 0; i < this.count; i++) {
            if (active(i)) {
                if (start < 0) start = i;
                quiet = 0;
                const before = i > 0 ? this.power[i - 1] : this.power[i];
                // An energy re-articulation needs an observed dip/rise, never pitch change alone.
                const fromQuiet = i > 0 && !active(i - 1);
                const repeated = peak > 0 && valley < peak * .5 && this.power[i] > Math.max(floor, valley) * 1.8;
                const strongRise = i > 0 && this.power[i] > Math.max(floor, before) * 4;
                if ((fromQuiet || repeated || strongRise) && i * hop - lastAttack >= .06 * fs) {
                    const attack = this.attack(i, Math.max(start * hop, lastAttack + Math.ceil(.06 * fs)));
                    result.attacks.push(attack); lastAttack = attack.sampleIndex;
                    peak = this.power[i]; valley = Infinity;
                } else { peak = Math.max(peak, this.power[i]); valley = Math.min(valley, this.power[i]); }
            } else if (start >= 0) {
                quiet++;
                // Require two observed low-energy windows; a padded tail cannot close an activity.
                if (quiet >= 2 && (i + 1) * hop <= length) {
                    this.addActivity(result, start * hop, (i - quiet + 1) * hop, false);
                    start = -1; peak = 0; valley = Infinity;
                }
            }
        }
        if (start >= 0) this.addActivity(result, start * hop, length, true);
        this.dominance(result);
        result.spectralEntries = { algorithm: 'tonal-carrier-entry-v1', confidence: null,
            consumerUse: 'signal-evidence-only', xrScoring: 'ineligible', candidates: [] };
        result.bandActivity = { algorithm: 'entry-fixed-band-activity-v1', confidence: null,
            consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
            scope: 'frozen-frequency-mask', sourceOwnership: 'unresolved', records: [] };
        result.entryContexts = { algorithm: 'entry-prefix-neighborhood-v1', confidence: null,
            consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
            scope: 'dominant-excess-neighborhood', sourceOwnership: 'unresolved', publication: 'full-track-analysis', records: [] };
        let lastEntry = -Infinity, span = 0;
        for (const e of this.entryFrames) {
            const anchor = e.frame * hop;
            if ((e.frame + 3) * hop > length || e.retained < .8 || anchor - lastEntry < .15 * fs) continue;
            while (span < result.activity.length && result.activity[span].endSample <= anchor) span++;
            if (span >= result.activity.length) continue;
            const a = this.entryTime(e.frame, Math.max(result.activity[span].startSample, lastEntry + Math.ceil(.15 * fs)));
            if (!a) continue;
            const low = Math.min((e.frame - 3) * hop, a.sampleIndex - .06 * fs), high = Math.max((e.frame + 1) * hop, a.sampleIndex + .06 * fs);
            // Raw frame proposals can localize out of order before acceptance/refractory.
            // Search independently; an advanced cursor could miss a prior energy duplicate.
            let energy = 0, right = result.attacks.length;
            while (energy < right) {
                const middle = (energy + right) >>> 1;
                if (result.attacks[middle].sampleIndex < low) energy = middle + 1; else right = middle;
            }
            if (energy < result.attacks.length && result.attacks[energy].sampleIndex <= high) continue;
            result.spectralEntries.candidates.push({ id: `entry:${a.sampleIndex}`, sampleIndex: a.sampleIndex,
                time: a.sampleIndex / fs, observationFrame: e.frame,
                prefixSamples: [(e.frame - 3) * hop, anchor - hop],
                bodySamples: [anchor, (e.frame + 3) * hop], decisionSample: (e.frame + 3) * hop,
                supportSamples: [(e.frame - 3) * hop, (e.frame + 3) * hop],
                texture: e.texture, positivePowerFraction: e.fraction, carrierPowerRatio: e.retained,
                backgroundResidualFraction: a.fitFraction });
            const band = e.band, end = band?.endFrame;
            const closed = end !== null && end !== undefined;
            result.bandActivity.records.push({ entryId: `entry:${a.sampleIndex}`, startSample: a.sampleIndex,
                bins: band ? [...band.bins] : [],
                maskSupportSamples: [(e.frame - 3) * hop, (e.frame + 1) * hop],
                endSample: band ? closed ? end * hop : length : null,
                offsetSupportSamples: closed ? [Math.max(anchor, (end - 1) * hop), (end + 2) * hop] : null,
                decisionSample: band ? closed ? Math.max((e.frame + 3) * hop, (end + 2) * hop) : length : (e.frame + 3) * hop,
                rightCensored: !closed, endReason: !band ? 'budget-exceeded' : closed ? 'quiet-windows' : 'file-boundary' });
            result.entryContexts.records.push({ entryId: `entry:${a.sampleIndex}`, peakBin: e.contextPeak,
                prefixSamples: [(e.frame - 3) * hop, anchor - hop], seedSamples: [anchor, anchor + hop],
                // Raw-entry dedup is retrospective. The seed measurement is local, but final
                // record publication depends on the complete accepted entry list.
                decisionSample: length, prefixPower: e.prefixPower, prefixToSeedPowerRatio: e.prefixRatio,
                context: classifyEntryNeighborhood(e.prefixPower, e.prefixRatio) });
            lastEntry = a.sampleIndex;
        }
        for (const attack of result.attacks) {
            const quiet = this.quietOnset(attack.observationFrame);
            if (quiet) attack.quietOnset = quiet;
        }
        this.attackChanges(result);
        return result;
    }

    /** A window comparison attached to existing attacks, not an isolated-source spectrum.
     * Reuses one FFT and two spectra; at most two <=512-point transforms per 60ms attack.
     */
    private attackChanges(result: AcousticActivityLayer): void {
        const { sampleRate: fs, sampleCount: length, hopSize: hop } = this.clock;
        const size = attackChangeWindowSize(fs, hop);
        const layer = result.attackChanges = { algorithm: 'attack-local-excess-v2', confidence: null,
            consumerUse: 'signal-evidence-only', xrScoring: 'ineligible', scope: 'local-window-positive-spectrum',
            sourceOwnership: 'unresolved', publication: 'full-track-analysis', windowSize: size,
            records: [] } as NonNullable<AcousticActivityLayer['attackChanges']>;
        let fft: FFT | undefined, prefix: Float64Array | undefined, delta: Float64Array | undefined;
        let windowSum = 0, windowPower = 0;
        const transform = (start: number) => {
            let weightedMean = 0;
            for (let n = 0; n < size!; n++) weightedMean += this.samples[start + n] * fft!.window[n];
            weightedMean /= windowSum;
            for (let n = 0; n < size!; n++) {
                fft!.re[n] = (this.samples[start + n] - weightedMean) * fft!.window[n]; fft!.im[n] = 0;
            }
            fft!.transform();
        };
        for (const a of result.attacks) {
            const r: NonNullable<AcousticActivityLayer['attackChanges']>['records'][number] = {
                attackId: a.id, prefixSamples: null, bodySamples: null, decisionSample: length,
                status: size === null ? 'insufficient-resolution' : 'file-boundary',
                positivePower: null, positivePowerFraction: null, peakBin: null, peakNeighborhoodFraction: null };
            layer.records.push(r);
            // Prefer the observed quiet-prefix crossing; retain legacy anchoring when unavailable.
            const anchor = a.quietOnset?.sampleIndex ?? a.sampleIndex;
            const bodyStart = anchor - Math.ceil(.002 * fs), prefixEnd = bodyStart - Math.ceil(.004 * fs);
            if (size === null || prefixEnd - size < 0 || bodyStart + size > length) continue;
            if (!fft) {
                fft = new FFT(size, this.fftKernelFactory); prefix = new Float64Array(size / 2); delta = new Float64Array(size / 2);
                for (const w of fft.window) { windowSum += w; windowPower += w * w; }
            }
            r.prefixSamples = [prefixEnd - size, prefixEnd]; r.bodySamples = [bodyStart, bodyStart + size];
            // Hann-weighted centering rejects constant DC without creating a large edge-impulse residual.
            transform(prefixEnd - size);
            for (let k = 1; k < size / 2; k++) prefix![k] = fft.re[k] ** 2 + fft.im[k] ** 2;
            transform(bodyStart);
            let total = 0, excess = 0, peak = 1;
            delta!.fill(0);
            for (let k = 1; k < size / 2; k++) {
                const p = fft.re[k] ** 2 + fft.im[k] ** 2;
                delta![k] = Math.max(0, p - prefix![k]); total += p; excess += delta![k];
                if (delta![k] > delta![peak]) peak = k;
            }
            r.positivePower = 2 * excess / (size * windowPower);
            r.positivePowerFraction = total > 0 ? Math.min(1, excess / total) : 0;
            r.status = r.positivePower > MusicActivity.FLOOR_POWER ? 'measured' : 'below-floor';
            if (r.status === 'measured') {
                let neighborhood = 0;
                for (let k = Math.max(1, peak - 1); k <= Math.min(size / 2 - 1, peak + 1); k++) neighborhood += delta![k];
                r.peakBin = peak; r.peakNeighborhoodFraction = Math.min(1, neighborhood / excess);
            }
        }
    }

    private entryTime(frame: number, lower: number): { sampleIndex: number; fitFraction: number } | null {
        const { hopSize: hop, sampleRate: fs, sampleCount: length } = this.clock;
        const anchor = frame * hop, prefix = anchor - 3 * hop, fitEnd = anchor - hop, radius = Math.max(1, Math.round(.002 * fs));
        let mean = 0;
        for (let n = prefix; n < fitEnd; n++) mean += this.samples[n];
        mean /= fitEnd - prefix;
        const x = (n: number) => this.samples[n] - mean;
        let cross = 0, lagPower = 0, power = 0;
        for (let n = prefix + 2; n < fitEnd; n++) {
            cross += x(n - 1) * (x(n) + x(n - 2)); lagPower += x(n - 1) ** 2; power += x(n) ** 2;
        }
        const coefficient = lagPower > 0 ? Math.max(-2, Math.min(2, cross / lagPower)) : 2;
        const residualPower = (n: number) => n < prefix + 2 || n >= length ? 0 : (x(n) - coefficient * x(n - 1) + x(n - 2)) ** 2;
        let error = 0;
        for (let n = prefix + 2; n < fitEnd; n++) error += residualPower(n);
        const fitFraction = power > 0 ? error / power : Infinity;
        if (fitFraction > .05) return null;
        const start = Math.max(anchor - hop, lower), end = Math.min(length, anchor + hop);
        let left = 0, right = 0, best = -Infinity, sampleIndex = start;
        for (let n = start - radius; n < start; n++) left += residualPower(n);
        for (let n = start; n < start + radius; n++) right += residualPower(n);
        for (let n = start; n < end; n++) {
            const step = right - left;
            if (step > best) { best = step; sampleIndex = n; }
            left += residualPower(n) - residualPower(n - radius);
            right += residualPower(n + radius) - residualPower(n);
        }
        return { sampleIndex, fitFraction };
    }

    /** Earliest prefix-referenced 2ms energy crossing, only after a complete quiet frame.
     * No future/global maximum sets the threshold; old attack localization stays immutable.
     */
    private quietOnset(frame: number): AcousticAttack['quietOnset'] {
        const { hopSize: h, sampleRate: fs, sampleCount: length } = this.clock;
        const start = frame * h, radius = Math.max(1, Math.round(.002 * fs));
        if (frame < 1 || h < radius || start + h > length || this.power[frame - 1] > MusicActivity.FLOOR_POWER) return undefined;
        const prefixPower = this.power[frame - 1], thresholdPower = Math.max(MusicActivity.FLOOR_POWER, 4 * prefixPower);
        let mean = 0;
        for (let i = start - h; i < start; i++) mean += this.samples[i];
        mean /= h;
        const power = (i: number) => (this.samples[i] - mean) ** 2;
        let sum = 0;
        for (let i = start - radius; i < start; i++) sum += power(i);
        // A quiet full hop can hide a short prefix spike: require a below-threshold
        // initial trailing window, otherwise there is no observed new crossing.
        if (sum / radius > thresholdPower) return undefined;
        for (let i = start; i < start + h; i++) {
            sum -= power(i - radius); sum += power(i);
            const crossingPower = Math.max(0, sum / radius);
            if (crossingPower > thresholdPower) return { algorithm: 'quiet-prefix-energy-v1', sampleIndex: i,
                prefixSamples: [start - h, start], supportSamples: [i - radius + 1, i + 1],
                prefixPower, thresholdPower, crossingPower, decisionSample: length };
        }
        return undefined;
    }

    private attack(frame: number, lowerBound: number): AcousticAttack {
        const { sampleRate: fs, sampleCount: length, hopSize: hop } = this.clock;
        const anchor = frame * hop, start = Math.max(0, anchor - hop), end = Math.min(length, anchor + hop), radius = Math.max(1, Math.round(.002 * fs));
        const support: [number, number] = [Math.max(0, start - radius), Math.min(length, end + radius)];
        let baseline = 0;
        for (let n = support[0]; n < support[1]; n++) baseline += this.samples[n];
        baseline /= support[1] - support[0];
        const powerAt = (n: number) => n >= 0 && n < length ? (this.samples[n] - baseline) ** 2 : 0;
        // Maximum positive short-energy step, with support entirely in observed PCM.
        const searchStart = Math.max(start, lowerBound);
        let left = 0, right = 0;
        for (let n = searchStart - radius; n < searchStart; n++) left += powerAt(n);
        for (let n = searchStart; n < searchStart + radius; n++) right += powerAt(n);
        let best = -Infinity, sampleIndex = searchStart;
        for (let n = searchStart; n < end; n++) {
            const step = right - left;
            if (step > best) { best = step; sampleIndex = n; }
            left += powerAt(n) - powerAt(n - radius);
            right += powerAt(n + radius) - powerAt(n);
        }
        let weighted = 0, power = 0;
        const last = Math.min(this.count - 1, frame + Math.max(1, Math.ceil(.06 * fs / hop)));
        for (let i = frame; i <= last; i++) {
            if ((i + 1) * hop > length) continue;
            weighted += this.concentration[i] * this.power[i]; power += this.power[i];
        }
        const family = this.textureAvailable && power > MusicActivity.FLOOR_POWER ? texture(weighted / power) : 'unknown';
        return { id: `acoustic:${sampleIndex}`, observationFrame: frame, sampleIndex, time: sampleIndex / fs,
            supportSamples: support,
            familySupportSamples: [anchor, Math.min(length, (last + 1) * hop)], family,
            strengthRms: Math.sqrt(this.power[frame]),
            powerRatio: this.power[frame] / Math.max(MusicActivity.FLOOR_POWER, this.power[frame - 1] ?? 0) };
    }

    private addActivity(result: AcousticActivityLayer, start: number, end: number, rightCensored: boolean): void {
        const { hopSize: hop, sampleCount: length, sampleRate: fs } = this.clock;
        if (end <= start) return;
        result.activity.push({ id: `activity:${start}`, startSample: start, endSample: end,
            onsetSupportSamples: start === 0 ? null : [Math.max(0, start - hop), Math.min(length, start + hop)],
            offsetSupportSamples: rightCensored ? null : [Math.max(start, end - hop), Math.min(length, end + hop)],
            sustainSamples: end - start >= Math.ceil(.12 * fs) ? [start, end] : null,
            leftCensored: start === 0, rightCensored });
    }

    private dominance(result: AcousticActivityLayer): void {
        const { hopSize: hop, sampleRate: fs, sampleCount: length } = this.clock;
        const window = Math.max(1, Math.ceil(.2 * fs / hop)), confirm = Math.max(2, Math.ceil(.08 * fs / hop));
        let total = 0, tonal = 0, current: AcousticTexture | 'silence' = 'unknown';
        let candidate: AcousticTexture | 'silence' = 'unknown', votes = 0, lastChange = -Infinity;
        result.dominance.push({ startSample: 0, endSample: length, texture: current, decisionSample: 0 });
        for (let i = 0; i < this.count; i++) {
            total += this.power[i]; tonal += this.power[i] * this.concentration[i];
            if (i >= window) { total -= this.power[i - window]; tonal -= this.power[i - window] * this.concentration[i - window]; }
            const average = total / Math.min(i + 1, window), ratio = total > 0 ? tonal / total : 0;
            let next: AcousticTexture | 'silence' = average <= MusicActivity.FLOOR_POWER ? 'silence' : this.textureAvailable ? texture(ratio) : 'unknown';
            // Separate entry/exit thresholds stop small changes around a texture boundary chattering.
            if (current === 'tonal' && ratio >= .6 && next !== 'silence') next = 'tonal';
            if (current === 'broadband' && ratio <= .45 && next !== 'silence') next = 'broadband';
            if (next === candidate) votes++; else { candidate = next; votes = 1; }
            const sample = i * hop;
            if (next !== current && votes >= confirm && sample - lastChange >= .2 * fs && sample > 0) {
                result.dominance[result.dominance.length - 1].endSample = sample;
                result.dominance.push({ startSample: sample, endSample: length, texture: next,
                    decisionSample: Math.min(length, (i + 1) * hop) });
                current = next; lastChange = sample;
            }
        }
    }
}

function texture(concentration: number): AcousticTexture {
    return concentration >= .7 ? 'tonal' : concentration <= .35 ? 'broadband' : 'mixed';
}
