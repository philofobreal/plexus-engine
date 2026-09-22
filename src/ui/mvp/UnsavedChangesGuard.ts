interface LeaveCallbacks {
    hasChanges: () => boolean;
    confirm: (continuing: boolean) => Promise<boolean>;
}

/** UI-owned navigation guard. Does not save automatically or own audio lifecycle. */
export class UnsavedChangesGuard {
    private listening = false;
    private pendingAction = false;
    private returnTimer: number | null = null;
    private readonly host: Window;
    private readonly callbacks: LeaveCallbacks;

    constructor(host: Window, callbacks: LeaveCallbacks) {
        this.host = host;
        this.callbacks = callbacks;
    }

    private readonly beforeUnload = (event: BeforeUnloadEvent): void => {
        if (!this.callbacks.hasChanges()) return;
        event.preventDefault();
        event.returnValue = true;
        // A browser-controlled prompt is unavoidable for close/reload/address-bar/back.
        // If the user stays, offer our save dialog on the next task. If they leave, this
        // document and timer are destroyed. No async work is awaited by beforeunload.
        if (this.returnTimer !== null) this.host.clearTimeout(this.returnTimer);
        this.returnTimer = this.host.setTimeout(() => {
            this.returnTimer = null;
            if (this.callbacks.hasChanges() && !this.pendingAction) void this.callbacks.confirm(false);
        }, 0);
    };

    /** Attach only while dirty, avoiding an unnecessary unload listener on clean pages. */
    sync(): void {
        const dirty = this.callbacks.hasChanges();
        if (dirty === this.listening) return;
        this.listening = dirty;
        if (dirty) this.host.addEventListener('beforeunload', this.beforeUnload);
        else this.host.removeEventListener('beforeunload', this.beforeUnload);
    }

    async run(action: () => void | Promise<void>): Promise<void> {
        if (this.pendingAction) return;
        this.pendingAction = true;
        try {
            if (this.callbacks.hasChanges() && !await this.callbacks.confirm(true)) return;
            await action();
        } finally {
            this.pendingAction = false;
            this.sync();
        }
    }

    dispose(): void {
        this.host.removeEventListener('beforeunload', this.beforeUnload);
        if (this.returnTimer !== null) this.host.clearTimeout(this.returnTimer);
        this.returnTimer = null;
        this.listening = false;
    }
}
