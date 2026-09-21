export const MVP_CANVAS_CONTAINER_ID = 'mvp-canvas-container';

export interface PreviewStageCallbacks {
    onTogglePlay: () => void;
    onFullscreen: () => void;
}

/** The 16:9 preview viewport: a contained box (not the full window) hosting the p5 canvas. */
export class PreviewStage {
    readonly root: HTMLElement;
    readonly canvasContainer: HTMLElement;
    private readonly centerPlayBtn: HTMLButtonElement;

    constructor(callbacks: PreviewStageCallbacks) {
        this.root = document.createElement('div');
        this.root.className = 'mvp-preview-stage';
        this.root.innerHTML = `
            <div id="${MVP_CANVAS_CONTAINER_ID}"></div>
            <button type="button" class="mvp-center-play" aria-label="Play">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button type="button" class="mvp-fullscreen-btn" aria-label="Fullscreen" title="Fullscreen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <span class="mvp-aspect-badge">16:9</span>
        `;
        this.canvasContainer = this.root.querySelector(`#${MVP_CANVAS_CONTAINER_ID}`)!;
        this.centerPlayBtn = this.root.querySelector('.mvp-center-play')!;
        this.centerPlayBtn.addEventListener('click', () => callbacks.onTogglePlay());
        this.root.querySelector('.mvp-fullscreen-btn')!.addEventListener('click', () => callbacks.onFullscreen());
    }

    setPlaying(isPlaying: boolean): void {
        this.centerPlayBtn.classList.toggle('is-playing', isPlaying);
        this.centerPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        this.centerPlayBtn.innerHTML = isPlaying
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }

    getPreviewSize(): { width: number; height: number } {
        const rect = this.canvasContainer.getBoundingClientRect();
        return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
    }
}
