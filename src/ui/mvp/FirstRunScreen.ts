const ACCEPT = 'audio/*,video/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska';

/** The empty-state "Drop your track" screen (design doc §12): no timeline, no tuning, no metrics. */
export class FirstRunScreen {
    readonly root: HTMLElement;
    private readonly fileInput: HTMLInputElement;
    private readonly dropzone: HTMLElement;

    constructor(onFile: (file: File) => void) {
        this.root = document.createElement('div');
        this.root.className = 'mvp-centered-screen';
        this.root.innerHTML = `
            <h1 class="mvp-hero-title">Welcome to Plexus</h1>
            <p class="mvp-hero-sub">Plexus analyzes the structure and builds a visual journey.</p>
            <div class="mvp-dropzone" tabindex="0" role="button" aria-label="Drop your track or click to browse">
                <svg class="mvp-dropzone-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <p class="mvp-dropzone-title">Drop your track</p>
                <span class="mvp-dropzone-link">or click to browse</span>
                <div class="mvp-dropzone-formats">Supported formats: MP3, WAV, FLAC, M4A, OGG</div>
            </div>
            <input type="file" class="mvp-file-input" accept="${ACCEPT}" aria-hidden="true" tabindex="-1">
        `;
        this.dropzone = this.root.querySelector('.mvp-dropzone')!;
        this.fileInput = this.root.querySelector('.mvp-file-input')!;

        const openPicker = () => this.fileInput.click();
        this.dropzone.addEventListener('click', openPicker);
        this.dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
        });

        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            this.fileInput.value = '';
            if (file) onFile(file);
        });

        this.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropzone.classList.add('is-dragover');
        });
        this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('is-dragover'));
        this.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzone.classList.remove('is-dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) onFile(file);
        });
    }
}
