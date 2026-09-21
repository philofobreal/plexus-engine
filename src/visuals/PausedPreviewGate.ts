/** Bounded value snapshot for reusing an unchanged paused image. No timers or p5 ownership. */
export class PausedPreviewGate {
    private readonly values: unknown[] = [];
    private cursor = 0;
    private changed = true;
    private invalidated = true;

    invalidate(): void { this.invalidated = true; }

    begin(): void {
        this.cursor = 0;
        this.changed = this.invalidated;
        this.invalidated = false;
    }

    watch(value: unknown): void {
        if (!Object.is(this.values[this.cursor], value)) this.changed = true;
        this.values[this.cursor++] = value;
    }

    shouldDraw(): boolean {
        if (this.values.length !== this.cursor) this.changed = true;
        this.values.length = this.cursor;
        return this.changed;
    }
}
