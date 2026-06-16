import { State } from '../../state/store';
import { ExportCapabilityDetector } from '../../export/ExportCapabilityDetector';

const MOBILE_VIDEO_FILE_LIMIT_MB = 150;
const DESKTOP_VIDEO_FILE_LIMIT_MB = 600;
const VIDEO_FILE_EXTENSION_RE = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv)$/i;

export interface PlaybackCallbacks {
    onFileSelected: (file: File) => void;
    onPlay: () => void;
    onStop: () => void;
    onSeekScrub: (time: number) => void;
    onSeekCommit: () => void;
    onLoopToggle: () => void;
    onFullscreen: () => void;
    onUiLockToggle: () => void;
    onCanvasDoubleClick: () => void;
    onSeekRelative: (delta: number) => void;
    onKeyDown: (code: string) => void;
}

type PlaybackEls = {
    upload: HTMLElement;
    playBtn: HTMLElement;
    centerPlayBtn: HTMLElement;
    toggleLoop: HTMLElement;
    seekBar: HTMLElement;
    fsBtn: HTMLElement;
    canvasContainer: HTMLElement;
    status: HTMLElement;
    timeCur: HTMLElement;
    timeTot: HTMLElement;
    bpmHeaderBadge: HTMLElement;
    mediaLoaderOverlay: HTMLElement;
    mediaLoaderText: HTMLElement;
    mediaLoaderBar: HTMLElement;
};

export class PlaybackController {
    private els: PlaybackEls;
    private callbacks: PlaybackCallbacks;
    private _isDraggingSlider = false;
    private lastSurfaceClickAt = 0;
    private singleClickTimer: number | null = null;

    constructor(els: PlaybackEls, callbacks: PlaybackCallbacks) {
        this.els = els;
        this.callbacks = callbacks;
        this.initBindings();
    }

    get isDraggingSlider(): boolean {
        return this._isDraggingSlider;
    }

    setPlaybackUi(isPlaying: boolean): void {
        this.els.playBtn.innerText = isPlaying ? 'Pause' : 'Play';
        this.els.centerPlayBtn.classList.toggle('is-playing', isPlaying);
        this.els.centerPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    syncLoopUi(): void {
        this.els.toggleLoop.classList.toggle('is-active', State.loopPlayback);
        this.els.toggleLoop.setAttribute('aria-pressed', State.loopPlayback ? 'true' : 'false');
        this.els.toggleLoop.innerText = State.loopPlayback ? 'Loop' : 'Once';
    }

    updateTimeDisplay(current: number, total: number): void {
        this.els.timeCur.innerText = this.formatTime(current);
        this.els.timeTot.innerText = this.formatTime(total);
    }

    updateSeekBar(progress: number): void {
        if (!this._isDraggingSlider) {
            (this.els.seekBar as HTMLInputElement).value = progress.toString();
        }
    }

    updateBpmBadge(bpm: number): void {
        if (bpm > 0) {
            this.els.bpmHeaderBadge.innerText = bpm + ' BPM';
            this.els.bpmHeaderBadge.style.display = 'inline-flex';
        } else {
            this.els.bpmHeaderBadge.style.display = 'none';
        }
    }

    setEnabled(enabled: boolean): void {
        (this.els.playBtn as HTMLButtonElement).disabled = !enabled;
        (this.els.centerPlayBtn as HTMLButtonElement).disabled = !enabled;
        (this.els.seekBar as HTMLInputElement).disabled = !enabled;
    }

    onFileLoadStart(fileName: string): void {
        this.els.status.innerText = fileName;
        (this.els.upload as HTMLInputElement).disabled = true;
        (this.els.playBtn as HTMLButtonElement).disabled = true;
        (this.els.seekBar as HTMLInputElement).disabled = true;
        (this.els.seekBar as HTMLInputElement).value = '0';
        this.setPlaybackUi(false);
        this.els.timeCur.innerText = '0:00';
        this.els.timeTot.innerText = '0:00';
        this.els.bpmHeaderBadge.style.display = 'none';
        this.els.mediaLoaderBar.style.width = '0%';
        this.els.mediaLoaderText.innerText = 'Loading...';
        this.els.mediaLoaderOverlay.classList.remove('is-hidden');
    }

    updateProgress(progress: number, stage: string): void {
        this.els.mediaLoaderText.innerText = stage;
        this.els.mediaLoaderBar.style.width = (progress * 100) + '%';
    }

    onAnalysisComplete(duration: number, bpm: number, fileName: string): void {
        this.els.mediaLoaderOverlay.classList.add('is-hidden');
        if (bpm > 0) {
            this.els.bpmHeaderBadge.innerText = bpm + ' BPM';
            this.els.bpmHeaderBadge.style.display = 'inline-flex';
        }
        this.els.status.innerText = fileName;
        (this.els.playBtn as HTMLButtonElement).disabled = false;
        (this.els.centerPlayBtn as HTMLButtonElement).disabled = false;
        (this.els.seekBar as HTMLInputElement).disabled = false;
        (this.els.upload as HTMLInputElement).disabled = false;
        this.els.timeTot.innerText = this.formatTime(duration);
        this.setPlaybackUi(false);
    }

    onError(message: string): void {
        this.els.mediaLoaderOverlay.classList.add('is-hidden');
        this.els.status.innerText = message;
        (this.els.playBtn as HTMLButtonElement).disabled = true;
        (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
        (this.els.seekBar as HTMLInputElement).disabled = true;
        (this.els.upload as HTMLInputElement).disabled = false;
    }

    onPlaybackEnded(): void {
        this.setPlaybackUi(false);
        (this.els.seekBar as HTMLInputElement).value = '0';
    }

    setUploadEnabled(enabled: boolean): void {
        (this.els.upload as HTMLInputElement).disabled = !enabled;
    }

    setStatusText(text: string): void {
        this.els.status.innerText = text;
    }

    private formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    private initBindings(): void {
        (this.els.upload as HTMLInputElement).addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            if (this.isOversizedVideo(file)) {
                this.onError(`Hiba: a videofajl tul nagy (maximum ${this.getVideoFileLimitMb()} MB)`);
                input.value = '';
                return;
            }
            this.callbacks.onFileSelected(file);
        });

        this.els.playBtn.addEventListener('click', () => {
            this.handlePlayToggle();
        });

        this.els.centerPlayBtn.addEventListener('click', () => {
            this.handlePlayToggle();
            this.els.canvasContainer.focus();
        });

        this.els.toggleLoop.addEventListener('click', () => {
            this.callbacks.onLoopToggle();
        });

        const seek = this.els.seekBar as HTMLInputElement;
        seek.addEventListener('mousedown', () => { this._isDraggingSlider = true; });
        seek.addEventListener('touchstart', () => { this._isDraggingSlider = true; });
        seek.addEventListener('input', (e) => {
            if (State.duration > 0) {
                const seekTime = (parseFloat((e.target as HTMLInputElement).value) / 100) * State.duration;
                this.callbacks.onSeekScrub(seekTime);
            }
        });
        seek.addEventListener('change', () => {
            this.callbacks.onSeekCommit();
            this._isDraggingSlider = false;
        });
        seek.addEventListener('touchend', () => {
            this.callbacks.onSeekCommit();
            this._isDraggingSlider = false;
        });

        this.els.fsBtn.addEventListener('click', () => {
            this.callbacks.onFullscreen();
        });

        this.els.canvasContainer.addEventListener('click', () => {
            if (State.isExporting) return;
            this.els.canvasContainer.focus();
            const now = window.performance.now();
            if (now - this.lastSurfaceClickAt <= 320) {
                if (this.singleClickTimer !== null) {
                    window.clearTimeout(this.singleClickTimer);
                    this.singleClickTimer = null;
                }
                this.callbacks.onCanvasDoubleClick();
                this.lastSurfaceClickAt = 0;
            } else {
                this.lastSurfaceClickAt = now;
                this.singleClickTimer = window.setTimeout(() => {
                    this.callbacks.onUiLockToggle();
                    this.singleClickTimer = null;
                }, 350);
            }
        });

        this.els.canvasContainer.addEventListener('keydown', (event) => {
            if (State.isExporting) return;
            if (document.activeElement !== this.els.canvasContainer) return;
            if (event.code === 'Space') {
                event.preventDefault();
                this.handlePlayToggle();
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                this.callbacks.onSeekRelative(-5);
            } else if (event.code === 'ArrowRight') {
                event.preventDefault();
                this.callbacks.onSeekRelative(5);
            }
        });

        window.addEventListener('keydown', (event) => {
            if (State.isExporting) return;
            if (this.isEditableTarget(event.target)) return;
            this.callbacks.onKeyDown(event.code);
        });
    }

    private handlePlayToggle(): void {
        if ((this.els.playBtn as HTMLButtonElement).disabled || State.duration <= 0) return;
        if (State.isPlaying) {
            this.callbacks.onStop();
        } else {
            this.callbacks.onPlay();
        }
    }

    private isEditableTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
    }

    private isOversizedVideo(file: File): boolean {
        return this.isVideoFile(file) && file.size > this.getVideoFileLimitBytes();
    }

    private isVideoFile(file: File): boolean {
        return file.type.startsWith('video/') || VIDEO_FILE_EXTENSION_RE.test(file.name);
    }

    private getVideoFileLimitBytes(): number {
        return this.getVideoFileLimitMb() * 1024 * 1024;
    }

    private getVideoFileLimitMb(): number {
        return ExportCapabilityDetector.isMobile() ? MOBILE_VIDEO_FILE_LIMIT_MB : DESKTOP_VIDEO_FILE_LIMIT_MB;
    }
}
