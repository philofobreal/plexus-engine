import { formatTime } from './mvpFormat';

export interface TransportBarCallbacks {
    onPlayToggle: () => void;
    onRestart: () => void;
    onScrub: (time: number) => void;
    onScrubCommit: () => void;
}

export class TransportBar {
    readonly root: HTMLElement;
    private readonly playBtn: HTMLButtonElement;
    private readonly seek: HTMLInputElement;
    private readonly timeCur: HTMLElement;
    private readonly timeTot: HTMLElement;
    private duration = 0;
    private dragging = false;

    constructor(callbacks: TransportBarCallbacks) {
        this.root = document.createElement('div');
        this.root.className = 'mvp-transport';
        this.root.innerHTML = `
            <button type="button" class="mvp-transport-btn mvp-restart-btn" aria-label="Restart" title="Restart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>
            </button>
            <button type="button" class="mvp-transport-btn mvp-transport-play" aria-label="Play" disabled>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span class="mvp-transport-time mvp-time-cur">0:00</span>
            <input type="range" class="mvp-seek" min="0" max="1000" value="0" step="1" disabled aria-label="Seek">
            <span class="mvp-transport-time mvp-time-tot">0:00</span>
        `;
        this.playBtn = this.root.querySelector('.mvp-transport-play')!;
        this.seek = this.root.querySelector('.mvp-seek')!;
        this.timeCur = this.root.querySelector('.mvp-time-cur')!;
        this.timeTot = this.root.querySelector('.mvp-time-tot')!;

        this.playBtn.addEventListener('click', () => callbacks.onPlayToggle());
        this.root.querySelector('.mvp-restart-btn')!.addEventListener('click', () => callbacks.onRestart());

        const scrubFromEvent = () => {
            if (this.duration <= 0) return;
            const time = (Number(this.seek.value) / 1000) * this.duration;
            callbacks.onScrub(time);
        };
        this.seek.addEventListener('mousedown', () => { this.dragging = true; });
        this.seek.addEventListener('touchstart', () => { this.dragging = true; });
        this.seek.addEventListener('input', scrubFromEvent);
        this.seek.addEventListener('change', () => { callbacks.onScrubCommit(); this.dragging = false; });
        this.seek.addEventListener('touchend', () => { callbacks.onScrubCommit(); this.dragging = false; });
    }

    setEnabled(enabled: boolean): void {
        this.playBtn.disabled = !enabled;
        this.seek.disabled = !enabled;
    }

    setPlaying(isPlaying: boolean): void {
        this.playBtn.innerHTML = isPlaying
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        this.playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    setDuration(duration: number): void {
        this.duration = duration;
        this.timeTot.textContent = formatTime(duration);
    }

    setTime(currentTime: number): void {
        this.timeCur.textContent = formatTime(currentTime);
        if (!this.dragging && this.duration > 0) {
            this.seek.value = String(Math.round((currentTime / this.duration) * 1000));
        }
    }

    isDragging(): boolean { return this.dragging; }
}
