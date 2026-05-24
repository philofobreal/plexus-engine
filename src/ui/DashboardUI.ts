import type { AudioEngine } from '../audio/AudioEngine';
import { State } from '../state/store';

export class DashboardUI {
    private isDraggingSlider = false;
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine;

    constructor(engine: AudioEngine) {
        this.engine = engine;
        this.els = {
            status: document.getElementById('status-text')!,
            playBtn: document.getElementById('play-btn')!,
            visualMode: document.getElementById('visual-mode')!,
            upload: document.getElementById('audio-upload')!,
            fsBtn: document.getElementById('fullscreen-btn')!,
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
            valCue: document.getElementById('val-cue')!,
            barCue: document.getElementById('bar-cue')!,
            valBeat: document.getElementById('val-beat')!,
            barBeat: document.getElementById('bar-beat')!,
            valProg: document.getElementById('val-prog')!,
            barProg: document.getElementById('bar-prog')!,
            valDyn: document.getElementById('val-dyn')!,
            barDyn: document.getElementById('bar-dyn')!
        };

        this.engine.addPlaybackEndedListener(() => {
            this.els.playBtn.innerText = "Play";
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.updateDashboard();
        });

        this.engine.onAnalysisError = (message) => {
            this.els.status.innerText = "Hiba: " + message;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.upload as HTMLInputElement).disabled = false;
        };

        this.initBindings();
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
            this.els.status.innerText = "Globalis dalanalizis (zero-CPU elokeszites)...";
            (this.els.upload as HTMLInputElement).disabled = true;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).disabled = true;
            (this.els.seekBar as HTMLInputElement).value = "0";
            this.els.playBtn.innerText = "Play";
            this.els.timeCur.innerText = "0:00";
            this.els.timeTot.innerText = "0:00";
            this.els.bpmBadge.style.display = "none";

            this.engine.onAnalysisComplete = () => {
                if (State.bpm > 0) {
                    this.els.bpmBadge.innerText = State.bpm + " BPM";
                    this.els.bpmBadge.style.display = "inline-flex";
                }
                this.els.status.innerText = `Kesz: ${file.name} | ${State.trackAnalysis.sections.length} szekcio | ${State.trackAnalysis.patterns.length} minta | ${State.trackAnalysis.cues.length} cue`;
                (this.els.playBtn as HTMLButtonElement).disabled = false;
                (this.els.seekBar as HTMLInputElement).disabled = false;
                (this.els.upload as HTMLInputElement).disabled = false;
                this.els.timeTot.innerText = this.formatTime(State.duration);
            };

            await this.engine.loadFile(file);
        });

        this.els.playBtn.addEventListener('click', () => {
            if (State.isPlaying) {
                this.engine.stop(false);
                this.els.playBtn.innerText = "Play";
            } else {
                this.engine.play();
                this.els.playBtn.innerText = "Pause";
            }
        });

        (this.els.visualMode as HTMLSelectElement).addEventListener('change', (e) => {
            const mode = (e.target as HTMLSelectElement).value;
            State.visualMode = mode === 'temporal' ? 'temporal' : 'classic';
        });

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
        this.els.valCue.innerText = State.activeCueKind ? State.activeCueKind.toUpperCase() : "--";
        this.els.barCue.style.width = (State.cueDecay * 100) + "%";
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
        let accentColor = isLowMode && State.isPlaying ? '#ff00aa' : '#00ffcc';
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
