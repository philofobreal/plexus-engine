import type { TrackSaveChoice, UnsavedTrackChanges } from './trackSaveState';

/** One dialog for either/both save domains; native dialog owns focus and inert background. */
export class UnsavedChangesDialog {
    readonly root: HTMLDialogElement;
    private readonly saveButtons: Record<TrackSaveChoice, HTMLButtonElement>;
    private readonly discardButton: HTMLButtonElement;
    private readonly cancelButton: HTMLButtonElement;
    private readonly status: HTMLElement;
    private readonly description: HTMLElement;
    private pending: ((proceed: boolean) => void) | null = null;
    private saving = false;
    private continuing = false;
    private readonly save: (choice: TrackSaveChoice) => Promise<boolean>;
    private readonly getChanges: () => UnsavedTrackChanges;
    private readonly discardHistory: () => boolean | void;
    private readonly getSaveError: (choice: TrackSaveChoice) => string | null;

    constructor(save: (choice: TrackSaveChoice) => Promise<boolean>, getChanges: () => UnsavedTrackChanges,
        discardHistory: () => boolean | void = () => {}, getSaveError: (choice: TrackSaveChoice) => string | null = () => null) {
        this.getSaveError = getSaveError;
        this.discardHistory = discardHistory;
        this.save = save;
        this.getChanges = getChanges;
        this.root = document.createElement('dialog');
        this.root.className = 'mvp-modal mvp-unsaved-dialog';
        this.root.setAttribute('aria-labelledby', 'mvp-unsaved-title');
        this.root.setAttribute('aria-describedby', 'mvp-unsaved-description');
        this.root.innerHTML = `
            <h2 class="mvp-modal-title" id="mvp-unsaved-title">Unsaved changes</h2>
            <p id="mvp-unsaved-description"></p>
            <div class="mvp-modal-status" role="status" aria-live="polite"></div>
            <div class="mvp-modal-actions">
                <button type="button" class="mvp-btn" data-cancel autofocus>Keep editing</button>
                <button type="button" class="mvp-btn" data-discard>Discard and continue</button>
            </div>
            <div class="mvp-modal-actions">
                <button type="button" class="mvp-btn" data-save-journey>Save automation</button>
                <button type="button" class="mvp-btn" data-save-tuning>Save visual tuning</button>
                <button type="button" class="mvp-btn" data-save-history title="Saves history, automation, visual tuning and workspace together. Audio is not stored.">Save history + workspace</button>
                <button type="button" class="mvp-btn mvp-btn-accent" data-save-all>Save all</button>
            </div>`;
        this.saveButtons = {
            journey: this.root.querySelector('[data-save-journey]')!,
            tuning: this.root.querySelector('[data-save-tuning]')!,
            history: this.root.querySelector('[data-save-history]')!,
            all: this.root.querySelector('[data-save-all]')!
        };
        this.discardButton = this.root.querySelector('[data-discard]')!;
        this.cancelButton = this.root.querySelector('[data-cancel]')!;
        this.status = this.root.querySelector('[role="status"]')!;
        this.description = this.root.querySelector('#mvp-unsaved-description')!;
        this.cancelButton.addEventListener('click', () => this.finish(false));
        this.discardButton.addEventListener('click', () => {
            if (this.saving) return;
            if (this.discardHistory() === false) this.status.textContent = 'History could not be discarded. Enable browser storage and retry.';
            else this.finish(true);
        });
        for (const choice of ['journey', 'tuning', 'history', 'all'] as const) {
            this.saveButtons[choice].addEventListener('click', () => void this.saveAndFinish(choice));
        }
        this.root.addEventListener('cancel', (event) => { event.preventDefault(); this.finish(false); });
        this.root.addEventListener('close', () => { if (this.pending) this.finish(false); });
    }

    /** Repeated navigation attempts cannot replace the action the user is reviewing. */
    confirm(continuing: boolean): Promise<boolean> {
        if (this.pending) return Promise.resolve(false);
        this.continuing = continuing;
        this.updateChanges(this.getChanges());
        this.saveButtons.all.textContent = continuing ? 'Save all and continue' : 'Save all';
        this.discardButton.hidden = false;
        this.discardButton.textContent = continuing ? 'Discard and continue' : 'Do not keep history';
        this.discardButton.disabled = !continuing && (this.getChanges().journey || this.getChanges().tuning);
        this.status.textContent = '';
        return new Promise((resolve) => {
            this.pending = resolve;
            this.root.showModal();
        });
    }

    updateChanges(changes: UnsavedTrackChanges): void {
        const subject = changes.journey && changes.tuning ? 'Automation and visual tuning (Advanced tuning / Visual character)'
            : changes.tuning ? 'Visual tuning (Advanced tuning / Visual character)' : 'Automation';
        this.description.textContent = `${changes.journey || changes.tuning ? `${subject} changes have not been saved for this track. ` : ''}${changes.history ? 'History / workspace is not saved for the next reload. Saving history also saves all current settings. Audio is not stored: select the same file again after reload. Playback will pause.' : ''}`;
        this.setBusy(this.saving);
    }

    private finish(proceed: boolean): void {
        if (this.saving) return;
        const resolve = this.pending;
        this.pending = null;
        this.root.close();
        resolve?.(proceed);
    }

    private async saveAndFinish(choice: TrackSaveChoice): Promise<void> {
        if (this.saving) return;
        this.saving = true;
        this.setBusy(true);
        this.status.textContent = 'Saving changes...';
        let saved = false;
        try { saved = await this.save(choice); } catch { /* Keep the dialog and unsaved state. */ }
        this.saving = false;
        const remaining = this.getChanges();
        this.updateChanges(remaining);
        if (saved && !remaining.journey && !remaining.tuning && !remaining.history) this.finish(true);
        else if (saved) this.status.textContent = 'Saved the selected settings. Other changes are still unsaved; save them or keep editing.';
        else this.status.textContent = this.getSaveError(choice)
            ?? 'Changes were not saved completely. Wait for generation to finish or check browser storage, then retry. Your changes are still here.';
    }

    private setBusy(busy: boolean): void {
        const changes = this.getChanges();
        this.saveButtons.journey.disabled = busy || !changes.journey;
        this.saveButtons.tuning.disabled = busy || !changes.tuning;
        this.saveButtons.history.disabled = busy || !changes.history;
        this.saveButtons.all.disabled = busy || (!changes.journey && !changes.tuning && !changes.history);
        this.discardButton.disabled = busy || (!this.continuing && (changes.journey || changes.tuning));
        this.cancelButton.disabled = busy;
    }
}
