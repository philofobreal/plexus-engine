// Opt-in background profiling for headset runs (`?xrDiagnostics=1`). Pure accumulator: the host
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

export class BackgroundDiagnostics {
    private elapsed = 0;
    private displayFrames = 0;
    private backgroundFrames = 0;
    private renderSum = 0;
    private readonly stageSums = new Map<string, number>();
    private lastShown: number | null = null;
    private line = '';

    /** The latest summary (empty until the first full window). */
    get summary(): string { return this.line; }

    /**
     * One display frame. `framesShown` is the background's running count of frames put on screen;
     * a change means a new frame whose `renderMs` and `stages` belong to it. Paused frames end the
     * window without a summary. Returns true when a new summary line was produced.
     */
    record(deltaSec: number, playing: boolean, framesShown: number, renderMs: number,
        stages: Readonly<Record<string, number>> | null | undefined, label = ''): boolean {
        if (!playing || !(deltaSec > 0) || !Number.isFinite(deltaSec)) {
            this.reset(framesShown);
            return false;
        }
        this.elapsed += deltaSec;
        this.displayFrames++;
        if (this.lastShown !== null && framesShown !== this.lastShown) {
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

    private reset(framesShown: number): void {
        this.elapsed = 0; this.displayFrames = 0; this.backgroundFrames = 0; this.renderSum = 0;
        this.stageSums.clear();
        this.lastShown = framesShown;
    }
}
