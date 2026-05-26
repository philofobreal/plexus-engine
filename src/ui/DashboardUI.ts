import type { AudioEngine } from '../audio/AudioEngine';
import { normalizeVisualTuningConfig, visualTuningControls, type VisualTuningKey } from '../config/visualTuning';
import { State } from '../state/store';

interface VisualPresetManifest {
    presets?: string[];
}

export class DashboardUI {
    private isDraggingSlider = false;
    private lastSurfaceClickAt = 0;
    private chromeHideTimer: number | null = null;
    private tuningDragOffset = { x: 0, y: 0 };
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;

    // --- Új változók a UI zárolás funkcióhoz ---
    private isUiLockedVisible = false;
    private singleClickTimer: number | null = null;

    constructor(engine: AudioEngine) {
        this.engine = engine;
        this.els = {
            status: document.getElementById('status-text')!,
            canvasContainer: document.getElementById('canvas-container')!,
            centerPlayBtn: document.getElementById('center-play-btn')!,
            playBtn: document.getElementById('play-btn')!,
            visualMode: document.getElementById('visual-mode')!,
            upload: document.getElementById('audio-upload')!,
            fsBtn: document.getElementById('fullscreen-btn')!,
            tuningPanel: document.getElementById('visual-tuning-panel')!,
            tuningDragHandle: document.getElementById('visual-tuning-drag-handle')!,
            toggleTuningPanel: document.getElementById('toggle-tuning-panel')!,
            toggleLoop: document.getElementById('toggle-loop')!,
            toggleMetrics: document.getElementById('toggle-metrics')!,
            tuningControls: document.getElementById('visual-tuning-controls')!,
            presetList: document.getElementById('visual-preset-list')!,
            copyVisualConfig: document.getElementById('copy-visual-config')!,
            copyConfigStatus: document.getElementById('copy-config-status')!,
            metricsGrid: document.getElementById('metrics-grid')!,
            seekBar: document.getElementById('seek-bar')!,
            bpmBadge: document.getElementById('bpm-badge')!,
            timeCur: document.getElementById('time-current')!,
            timeTot: document.getElementById('time-total')!,
            valE: document.getElementById('val-energy')!,
            barE: document.getElementById('bar-energy')!,
            valB: document.getElementById('val-bass')!,
            barB: document.getElementById('bar-bass')!,
            valM: document.getElementById('val-mid')!,
            barM: document.getElementById('bar-mid')!,
            valT: document.getElementById('val-treble')!,
            barT: document.getElementById('bar-treble')!,
            valMelody: document.getElementById('val-melody')!,
            barMelody: document.getElementById('bar-melody')!,
            valVocal: document.getElementById('val-vocal')!,
            barVocal: document.getElementById('bar-vocal')!,
            valFx: document.getElementById('val-fx')!,
            barFx: document.getElementById('bar-fx')!,
            valBeat: document.getElementById('val-beat')!,
            barBeat: document.getElementById('bar-beat')!,
            valProg: document.getElementById('val-prog')!,
            barProg: document.getElementById('bar-prog')!,
            valDyn: document.getElementById('val-dyn')!,
            barDyn: document.getElementById('bar-dyn')!
        };

        this.engine.addPlaybackEndedListener(() => {
            this.setPlaybackUi(false);
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.updateDashboard();
        });

        this.engine.onAnalysisError = (message) => {
            this.els.status.innerText = "Hiba: " + message;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.upload as HTMLInputElement).disabled = false;
        };

        this.initBindings();
        this.initVisualTuningControls();
        this.syncLoopUi();
        this.initChromeAutoHide();
        void this.loadVisualPresetList();
    }

    private formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return "0:00";
        let min = Math.floor(seconds / 60);
        let sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    private initBindings() {
        (this.els.upload as HTMLInputElement).addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            this.engine.stop(true);
            this.els.status.innerText = file.name;
            (this.els.upload as HTMLInputElement).disabled = true;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.setPlaybackUi(false);
            this.els.timeCur.innerText = "0:00";
            this.els.timeTot.innerText = "0:00";
            this.els.bpmBadge.style.display = "none";

            this.engine.onAnalysisComplete = () => {
                if (State.bpm > 0) {
                    this.els.bpmBadge.innerText = State.bpm + " BPM";
                    this.els.bpmBadge.style.display = "inline-flex";
                }
                this.els.status.innerText = file.name;
                (this.els.playBtn as HTMLButtonElement).disabled = false;
                (this.els.centerPlayBtn as HTMLButtonElement).disabled = false;
                (this.els.seekBar as HTMLInputElement).disabled = false;
                (this.els.upload as HTMLInputElement).disabled = false;
                this.els.timeTot.innerText = this.formatTime(State.duration);
                this.setPlaybackUi(false);
            };

            try {
                await this.engine.loadFile(file);
            } catch {
                this.els.status.innerText = "Hiba: nem sikerult betolteni a fajlt";
                (this.els.playBtn as HTMLButtonElement).disabled = true;
                (this.els.centerPlayBtn as HTMLButtonElement).disabled = true;
                (this.els.seekBar as HTMLInputElement).disabled = true;
                (this.els.upload as HTMLInputElement).disabled = false;
            }
        });

        this.els.playBtn.addEventListener('click', () => {
            this.togglePlayback();
        });

        this.els.centerPlayBtn.addEventListener('click', () => {
            this.togglePlayback();
            this.els.canvasContainer.focus();
        });

        (this.els.visualMode as HTMLSelectElement).addEventListener('change', (e) => {
            const mode = (e.target as HTMLSelectElement).value;
            State.visualMode = mode === 'temporal' ? 'temporal' : 'classic';
        });

        this.els.toggleTuningPanel.addEventListener('click', () => {
            this.setTuningPanelOpen(this.els.tuningPanel.classList.contains('is-hidden'));
        });

        this.els.toggleLoop.addEventListener('click', () => {
            State.loopPlayback = !State.loopPlayback;
            this.syncLoopUi();
        });

        this.els.toggleMetrics.addEventListener('click', () => {
            const isHidden = this.els.metricsGrid.classList.toggle('is-hidden');
            this.els.toggleMetrics.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        });

        this.els.canvasContainer.addEventListener('click', () => {
            this.els.canvasContainer.focus();

            const now = window.performance.now();
            
            if (now - this.lastSurfaceClickAt <= 320) {
                // --- DUPLA KATTINTÁS (Play / Pause) ---
                if (this.singleClickTimer !== null) {
                    window.clearTimeout(this.singleClickTimer);
                    this.singleClickTimer = null;
                }
                this.togglePlayback();
                this.lastSurfaceClickAt = 0;
            } else {
                // --- SZIMPLA KATTINTÁS (Késleltetve, hátha dupla lesz) ---
                this.lastSurfaceClickAt = now;
                this.singleClickTimer = window.setTimeout(() => {
                    this.toggleUiLock(); // UI zárolása / feloldása
                    this.singleClickTimer = null;
                }, 350);
            }
        });

        this.els.canvasContainer.addEventListener('keydown', (event) => {
            if (document.activeElement !== this.els.canvasContainer) return;
            if (event.code === 'Space') {
                event.preventDefault();
                this.togglePlayback();
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                this.seekRelative(-5);
            } else if (event.code === 'ArrowRight') {
                event.preventDefault();
                this.seekRelative(5);
            }
        });

        this.initTuningPanelDrag();

        const seek = this.els.seekBar as HTMLInputElement;
        seek.addEventListener('mousedown', () => this.isDraggingSlider = true);
        seek.addEventListener('touchstart', () => this.isDraggingSlider = true);
        seek.addEventListener('input', (e) => {
            if (State.duration > 0) {
                let seekTime = (parseFloat((e.target as HTMLInputElement).value) / 100) * State.duration;
                this.els.timeCur.innerText = this.formatTime(seekTime);
                this.engine.seek(seekTime);
            }
        });
        seek.addEventListener('change', () => this.isDraggingSlider = false);
        seek.addEventListener('touchend', () => this.isDraggingSlider = false);

        this.els.fsBtn.addEventListener('click', () => {
            let doc = window.document as any;
            let docEl = doc.documentElement;
            let reqFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
            let exitFS = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
            if(!doc.fullscreenElement) { reqFS?.call(docEl); } else { exitFS?.call(doc); }
        });
    }

    private toggleUiLock() {
        this.isUiLockedVisible = !this.isUiLockedVisible;
        
        if (this.isUiLockedVisible) {
            // ZÁROLVA: Ne tűnjön el soha
            this.clearChromeHideTimer();
            document.body.classList.remove('chrome-idle');
        } else {
            // FELOLDVA: Kezdje el ismét a visszaszámlálást
            this.scheduleChromeHide();
        }
    }

    private setTuningPanelOpen(isOpen: boolean) {
        this.els.tuningPanel.classList.toggle('is-hidden', !isOpen);
        this.els.toggleTuningPanel.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    private togglePlayback() {
        if ((this.els.playBtn as HTMLButtonElement).disabled || State.duration <= 0) return;

        if (State.isPlaying) {
            this.engine.stop(false);
            this.setPlaybackUi(false);
        } else {
            this.engine.play();
            this.setPlaybackUi(true);
        }
    }

    private setPlaybackUi(isPlaying: boolean) {
        this.els.playBtn.innerText = isPlaying ? "Pause" : "Play";
        this.els.centerPlayBtn.classList.toggle('is-playing', isPlaying);
        this.els.centerPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    private syncLoopUi() {
        this.els.toggleLoop.classList.toggle('is-active', State.loopPlayback);
        this.els.toggleLoop.setAttribute('aria-pressed', State.loopPlayback ? 'true' : 'false');
        this.els.toggleLoop.innerText = State.loopPlayback ? 'Loop' : 'Once';
    }

    private seekRelative(deltaSeconds: number) {
        if (State.duration <= 0) return;
        this.engine.seek(State.currentTime + deltaSeconds);
        this.updateDashboard();
    }

    private initTuningPanelDrag() {
        this.els.tuningDragHandle.addEventListener('pointerdown', (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('button, input, select, textarea, label')) return;

            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            this.tuningDragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            panel.classList.add('is-dragging');
            panel.style.position = 'fixed';
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.marginTop = '0';
            this.els.tuningDragHandle.setPointerCapture(event.pointerId);
        });

        this.els.tuningDragHandle.addEventListener('pointermove', (event) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            const panel = this.els.tuningPanel;
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            const left = Math.min(Math.max(0, event.clientX - this.tuningDragOffset.x), maxLeft);
            const top = Math.min(Math.max(0, event.clientY - this.tuningDragOffset.y), maxTop);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        });

        const endDrag = (event: PointerEvent) => {
            if (!this.els.tuningPanel.classList.contains('is-dragging')) return;
            this.els.tuningPanel.classList.remove('is-dragging');
            if (this.els.tuningDragHandle.hasPointerCapture(event.pointerId)) {
                this.els.tuningDragHandle.releasePointerCapture(event.pointerId);
            }
        };
        this.els.tuningDragHandle.addEventListener('pointerup', endDrag);
        this.els.tuningDragHandle.addEventListener('pointercancel', endDrag);
    }

    private initChromeAutoHide() {
        const interactiveChrome = [this.els.tuningPanel, this.els.metricsGrid, this.els.toggleMetrics, this.els.seekBar];
        const reveal = () => this.revealChromeTemporarily();

        window.addEventListener('mousemove', reveal);
        window.addEventListener('pointerdown', reveal);
        window.addEventListener('keydown', reveal);
        window.addEventListener('touchstart', reveal, { passive: true });

        for (const element of interactiveChrome) {
            element.addEventListener('mouseenter', () => this.clearChromeHideTimer());
            element.addEventListener('mouseleave', () => this.scheduleChromeHide());
            element.addEventListener('focusin', () => this.clearChromeHideTimer());
            element.addEventListener('focusout', () => this.scheduleChromeHide());
        }

        this.revealChromeTemporarily();
    }

    private revealChromeTemporarily() {
        document.body.classList.remove('chrome-idle');
        this.scheduleChromeHide();
    }

    private scheduleChromeHide() {
        this.clearChromeHideTimer();
        
        // Ha le van zárva az eltűnés, ne indítson időzítőt
        if (this.isUiLockedVisible) {
            return;
        }

        this.chromeHideTimer = window.setTimeout(() => {
            if (this.isChromeHovered()) {
                this.scheduleChromeHide();
                return;
            }
            document.body.classList.add('chrome-idle');
        }, 2600);
    }

    private clearChromeHideTimer() {
        if (this.chromeHideTimer !== null) {
            window.clearTimeout(this.chromeHideTimer);
            this.chromeHideTimer = null;
        }
    }

    private isChromeHovered() {
        return [
            '.top-row:hover',
            '.tuning-panel:hover',
            '.bottom-section:hover',
            '.center-play-btn:hover'
        ].some(selector => Boolean(document.querySelector(selector)));
    }

    private initVisualTuningControls() {
        const container = this.els.tuningControls;
        container.innerHTML = "";
        const groups = new Map<string, HTMLElement>();

        for (const control of visualTuningControls) {
            let group = groups.get(control.group);
            if (!group) {
                group = document.createElement('section');
                group.className = 'tuning-group';
                group.innerHTML = `<h2>${control.group}</h2>`;
                groups.set(control.group, group);
                container.appendChild(group);
            }

            const row = document.createElement('label');
            row.className = 'tuning-control';
            const valueId = `visual-tuning-value-${control.key}`;
            const value = State.visualTuning[control.key];
            row.innerHTML = `
                <span class="tuning-label">${control.label}</span>
                <input
                    type="range"
                    min="${control.min}"
                    max="${control.max}"
                    step="${control.step}"
                    value="${value}"
                    data-tuning-key="${control.key}"
                    aria-label="${control.label}"
                >
                <output id="${valueId}" class="tuning-value">${this.formatTuningValue(value, control.unit)}</output>
            `;
            group.appendChild(row);
        }

        container.addEventListener('input', (event) => {
            const input = event.target as HTMLInputElement;
            const key = input.dataset.tuningKey as VisualTuningKey | undefined;
            if (!key) return;

            const value = Number(input.value);
            State.visualTuning[key] = value;
            const control = visualTuningControls.find(item => item.key === key);
            const output = document.getElementById(`visual-tuning-value-${key}`);
            if (output) output.textContent = this.formatTuningValue(value, control?.unit);
        });

        this.els.copyVisualConfig.addEventListener('click', () => {
            this.copyVisualConfig();
        });

        const loadSelectedPreset = () => {
            const fileName = (this.els.presetList as HTMLSelectElement).value;
            if (fileName) void this.loadVisualPreset(fileName);
        };
        this.els.presetList.addEventListener('input', loadSelectedPreset);
        this.els.presetList.addEventListener('change', loadSelectedPreset);
    }

    private async loadVisualPresetList() {
        const select = this.els.presetList as HTMLSelectElement;

        try {
            const response = await fetch(this.presetUrl('index.json'), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset manifest ${response.status}`);

            const manifest = await response.json() as VisualPresetManifest;
            const presets = (manifest.presets || [])
                .filter(fileName => /^[\w .-]+\.json$/i.test(fileName))
                .filter(fileName => fileName.toLowerCase() !== 'index.json');

            select.innerHTML = presets.length
                ? presets.map(fileName => `<option value="${this.escapeHtml(fileName)}">${this.escapeHtml(this.formatPresetName(fileName))}</option>`).join('')
                : `<option value="">No presets</option>`;
            const defaultPreset = presets.find(fileName => fileName.toLowerCase() === 'default.json');
            if (defaultPreset) select.value = defaultPreset;
            select.disabled = presets.length === 0;
        } catch {
            select.innerHTML = `<option value="">No preset index</option>`;
            select.disabled = true;
        }
    }

    private async loadVisualPreset(fileName: string) {
        try {
            const response = await fetch(this.presetUrl(fileName), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Preset ${response.status}`);

            Object.assign(State.visualTuning, normalizeVisualTuningConfig(await response.json()));
            this.syncVisualTuningControls();
        } catch {
            this.els.copyConfigStatus.innerText = `Could not load ${fileName}`;
            window.setTimeout(() => {
                this.els.copyConfigStatus.innerText = "";
            }, 1800);
        }
    }

    private presetUrl(fileName: string) {
        return `${import.meta.env.BASE_URL}visual-tuning-presets/${encodeURIComponent(fileName)}`;
    }

    private syncVisualTuningControls() {
        for (const control of visualTuningControls) {
            const value = State.visualTuning[control.key];
            const input = this.els.tuningControls.querySelector<HTMLInputElement>(`input[data-tuning-key="${control.key}"]`);
            const output = document.getElementById(`visual-tuning-value-${control.key}`);
            if (input) input.value = value.toString();
            if (output) output.textContent = this.formatTuningValue(value, control.unit);
        }
    }

    private escapeHtml(value: string) {
        return value.replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char] || char);
    }

    private formatPresetName(fileName: string) {
        return fileName.replace(/\.json$/i, '');
    }

    private formatTuningValue(value: number, unit?: string) {
        const decimals = value >= 10 || Number.isInteger(value) ? 0 : 2;
        return `${value.toFixed(decimals)}${unit || ""}`;
    }

    private async copyVisualConfig() {
        const payload = JSON.stringify({
            version: 1,
            visualTuning: State.visualTuning
        }, null, 2);

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(payload);
            } else {
                this.copyTextFallback(payload);
            }
            this.els.copyConfigStatus.innerText = "Copied";
        } catch {
            this.copyTextFallback(payload);
            this.els.copyConfigStatus.innerText = "Copied";
        }

        window.setTimeout(() => {
            this.els.copyConfigStatus.innerText = "";
        }, 1600);
    }

    private copyTextFallback(value: string) {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.setAttribute('readonly', 'true');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }

    updateDashboard() {
        if (!this.isDraggingSlider) {
            const progress = State.duration > 0 ? (State.currentTime / State.duration) * 100 : 0;
            (this.els.seekBar as HTMLInputElement).value = progress.toString();
            this.els.timeCur.innerText = this.formatTime(State.currentTime);
        }

        this.els.valE.innerText = State.currentFrame.e.toFixed(2); this.els.barE.style.width = (State.currentFrame.e * 100) + "%";
        this.els.valB.innerText = State.currentFrame.b.toFixed(2); this.els.barB.style.width = (State.currentFrame.b * 100) + "%";
        this.els.valM.innerText = State.currentFrame.m.toFixed(2); this.els.barM.style.width = (State.currentFrame.m * 100) + "%";
        this.els.valT.innerText = State.currentFrame.t.toFixed(2); this.els.barT.style.width = (State.currentFrame.t * 100) + "%";
        this.els.valMelody.innerText = State.currentFeatures.melody.toFixed(2); this.els.barMelody.style.width = (State.currentFeatures.melody * 100) + "%";
        this.els.valVocal.innerText = State.currentFeatures.vocal.toFixed(2); this.els.barVocal.style.width = (State.currentFeatures.vocal * 100) + "%";
        this.els.valFx.innerText = State.currentFeatures.fx.toFixed(2); this.els.barFx.style.width = (State.currentFeatures.fx * 100) + "%";
        this.els.valBeat.innerText = State.beatDecay.toFixed(2); this.els.barBeat.style.width = (State.beatDecay * 100) + "%";

        let dynText = "IDLE";
        if (State.isPlaying) {
            if (State.currentFrame.state === 'HIGH') dynText = "HIGH";
            else if (State.currentFrame.state === 'LOW') dynText = "LOW";
            else if (State.currentFrame.state === 'LOW_DROP') dynText = "LOW [DROP]";
            else if (State.currentFrame.state === 'LOW_OVERLOAD') dynText = "LOW [OVERLOAD]";
        }

        this.els.valDyn.innerText = dynText;
        this.els.barDyn.style.width = (State.currentFrame.eRatio * 100) + "%";

        let isLowMode = State.currentFrame.state !== 'HIGH' && State.currentFrame.state !== 'IDLE';
        let accentColor = isLowMode && State.isPlaying ? '#ff00aa' : '#00e5ff';
        this.els.valDyn.style.color = accentColor; this.els.barDyn.style.background = accentColor;

        if (State.duration > 0) {
            let progPercent = (State.currentTime / State.duration) * 100;
            this.els.valProg.innerText = Math.floor(progPercent) + "%";
            this.els.barProg.style.width = progPercent + "%";
        } else {
            this.els.valProg.innerText = "0%";
            this.els.barProg.style.width = "0%";
        }
    }
}