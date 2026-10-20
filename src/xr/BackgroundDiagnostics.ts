// Opt-in background profiling for headset runs (Settings > System > Diagnostics, or `?xrDiagnostics=1`;
// ADR-009 Addenda U and X). Pure accumulator: the host
// feeds it one sample per display frame while playing; every two seconds it averages the display
// rate, the background frames actually shown and the worker's stage times into one readable line
// (shown in the game menu, where a headset user can read it, and mirrored on the overlay dataset).

/** Seconds of play summarized by one line. */
export const BACKGROUND_DIAGNOSTICS_WINDOW_SEC = 2;

/** Display names of the source's stages, in pipeline order (unknown stages are listed after them). */
const STAGE_LABELS: Readonly<Record<string, string>> = {
    tune: 'tune', background: 'layers', grains: 'grains', weave: 'weave', resolve: 'blur', composite: 'comp', transfer: 'xfer'
};
/** The identity's total is the sum of its stages; listing it again adds nothing. */
const HIDDEN_STAGES = new Set(['draw']);
/** A display frame longer than this many nominal intervals was late (the headset repeated a frame). */
const LATE_FRAME_FACTOR = 1.5;

/**
 * Main-thread cost of one display frame (measured by the runtime): the frame update (game, scene,
 * background presentation) and the render call (command submission, texture uploads included).
 */
export interface FrameCost {
    readonly updateMs: number;
    readonly renderMs: number;
    /** Nominal display rate, for counting late frames. */
    readonly displayHz: number;
    /**
     * GPU times (ms) of earlier frames' render calls that arrived with this frame (they lag a few
     * frames, so they are not split by kind), and whether the browser can time the GPU at all.
     */
    readonly gpuSamples?: readonly number[];
    readonly gpuTimer?: boolean;
    /**
     * Main-thread ms of the background work done ahead since the previous frame (Addendum AE): it runs
     * when a frame arrives, between display frames, so `updateMs` / `renderMs` never include it.
     */
    readonly aheadSamples?: readonly number[];
}

/** Running sum and maximum of the main-thread cost of one kind of frame. */
class CostSum {
    count = 0; sum = 0; max = 0;
    add(ms: number): void { this.count++; this.sum += ms; this.max = Math.max(this.max, ms); }
    clear(): void { this.count = 0; this.sum = 0; this.max = 0; }
    format(name: string): string { return `${name} ${(this.sum / this.count).toFixed(1)}/${this.max.toFixed(1)}`; }
}

export class BackgroundDiagnostics {
    private elapsed = 0;
    private displayFrames = 0;
    private backgroundFrames = 0;
    private renderSum = 0;
    private readonly stageSums = new Map<string, number>();
    private lastShown: number | null = null;
    private line = '';
    /** Main-thread cost of frames that put a new background frame on screen, and of the others. */
    private readonly backgroundCost = new CostSum();
    private readonly otherCost = new CostSum();
    private lateFrames = 0;
    /** Late frames by the kind of the frame that ran long (the one before the late interval ended). */
    private lateAfterBackground = 0;
    private lateAfterOther = 0;
    private readonly gpuCost = new CostSum();
    private gpuTimer: boolean | null = null;
    /** Background work ahead (main thread, between display frames), and the longest display interval. */
    private readonly aheadCost = new CostSum();
    private longestFrameMs = 0;
    /** The cost a host passes describes its previous frame: whether that frame showed a new background. */
    private previousShowedFrame: boolean | null = null;

    /** The latest summary (empty until the first full window). */
    get summary(): string { return this.line; }

    /**
     * One display frame. `framesShown` is the background's running count of frames put on screen;
     * a change means a new frame whose `renderMs` and `stages` belong to it. Paused frames end the
     * window without a summary. Returns true when a new summary line was produced. `cost` (optional)
     * is the main-thread cost of the previous display frame; the line then splits it between frames
     * that showed a new background frame and the others, and counts late frames.
     */
    record(deltaSec: number, playing: boolean, framesShown: number, renderMs: number,
        stages: Readonly<Record<string, number>> | null | undefined, label = '', cost?: FrameCost): boolean {
        if (!playing || !(deltaSec > 0) || !Number.isFinite(deltaSec)) {
            this.reset(framesShown);
            this.previousShowedFrame = null;
            return false;
        }
        this.elapsed += deltaSec;
        this.displayFrames++;
        this.longestFrameMs = Math.max(this.longestFrameMs, deltaSec * 1000);
        const showed = this.lastShown !== null && framesShown !== this.lastShown;
        if (cost) {
            const ms = cost.updateMs + cost.renderMs;
            if (this.previousShowedFrame !== null && Number.isFinite(ms)) (this.previousShowedFrame ? this.backgroundCost : this.otherCost).add(ms);
            if (cost.displayHz > 0 && deltaSec > LATE_FRAME_FACTOR / cost.displayHz) {
                this.lateFrames++;
                if (this.previousShowedFrame === true) this.lateAfterBackground++;
                else if (this.previousShowedFrame === false) this.lateAfterOther++;
            }
            if (cost.gpuTimer !== undefined) this.gpuTimer = cost.gpuTimer;
            if (cost.gpuSamples) for (const ms of cost.gpuSamples) if (Number.isFinite(ms)) this.gpuCost.add(ms);
            if (cost.aheadSamples) for (const ms of cost.aheadSamples) if (Number.isFinite(ms)) this.aheadCost.add(ms);
        }
        this.previousShowedFrame = showed;
        if (showed) {
            this.backgroundFrames++;
            this.renderSum += Number.isFinite(renderMs) ? renderMs : 0;
            if (stages) for (const [name, value] of Object.entries(stages)) {
                if (Number.isFinite(value)) this.stageSums.set(name, (this.stageSums.get(name) ?? 0) + value);
            }
        }
        this.lastShown = framesShown;
        if (this.elapsed < BACKGROUND_DIAGNOSTICS_WINDOW_SEC - 1e-6) return false;
        this.line = this.format(label);
        this.reset(framesShown);
        return true;
    }

    private format(label: string): string {
        const fps = (count: number) => (count / this.elapsed).toFixed(1);
        const parts = [`Display ${fps(this.displayFrames)} fps`];
        // Main thread, avg/max ms per frame: with a new background frame ("bg") and without ("other").
        // Right after the display rate, so the menu's two lines never cut it off.
        if (this.backgroundCost.count || this.otherCost.count) {
            const costs = [this.backgroundCost.count ? this.backgroundCost.format('bg') : '', this.otherCost.count ? this.otherCost.format('other') : '']
                .filter(Boolean).join(', ');
            // Late share overall, then per kind of the frame that ran long (of that kind's frames).
            const share = (late: number, count: number) => `${Math.round(100 * late / Math.max(1, count))}%`;
            const split = this.lateFrames ? ` (bg ${share(this.lateAfterBackground, this.backgroundCost.count)}, other ${share(this.lateAfterOther, this.otherCost.count)})` : '';
            parts[0] += `, late ${Math.round(100 * this.lateFrames / this.displayFrames)}%${split}, max ${this.longestFrameMs.toFixed(1)} ms`;
            parts.push(`Main ms ${costs}${this.aheadCost.count ? `, ${this.aheadCost.format('ahead')}` : ''}`);
            // GPU time of this context's render calls (avg/max), or why it is missing.
            if (this.gpuCost.count) parts.push(this.gpuCost.format('GPU ms'));
            else if (this.gpuTimer === false) parts.push('GPU ms n/a (no timer)');
        }
        if (this.backgroundFrames) {
            const average = (sum: number) => (sum / this.backgroundFrames).toFixed(1);
            parts.push(`Background ${fps(this.backgroundFrames)} fps, ${average(this.renderSum)} ms${label ? ` (${label})` : ''}`);
            const names = [...Object.keys(STAGE_LABELS), ...[...this.stageSums.keys()].filter(name => !(name in STAGE_LABELS))]
                .filter(name => this.stageSums.has(name) && !HIDDEN_STAGES.has(name));
            if (names.length) parts.push(names.map(name => `${STAGE_LABELS[name] ?? name} ${average(this.stageSums.get(name)!)}`).join(' '));
        } else {
            parts.push('Background: no new frames');
        }
        return parts.join(' | ');
    }

    /** Forgets the open window and the last line (diagnostics switched off, or on again). */
    clear(): void {
        this.reset(this.lastShown ?? 0);
        this.lastShown = null;
        this.line = '';
    }

    private reset(framesShown: number): void {
        this.elapsed = 0; this.displayFrames = 0; this.backgroundFrames = 0; this.renderSum = 0;
        this.stageSums.clear();
        this.backgroundCost.clear(); this.otherCost.clear(); this.lateFrames = 0;
        this.lateAfterBackground = 0; this.lateAfterOther = 0; this.gpuCost.clear();
        this.aheadCost.clear(); this.longestFrameMs = 0;
        this.lastShown = framesShown;
    }
}
