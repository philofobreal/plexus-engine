import type { AudioEngine } from '../audio/AudioEngine';
import { State } from '../state/store';

export class DashboardUI {
    private isDraggingSlider = false;
    private els: Record<string, HTMLElement>;
    private engine: AudioEngine; // <--- 1. Ide deklaráljuk

    constructor(engine: AudioEngine) { // <--- 2. Itt kivesszük a 'private' szót
        this.engine = engine; // <--- 3. Ide rendeljük hozzá
        this.els = {
            status: document.getElementById('status-text')!,
            playBtn: document.getElementById('play-btn')!,
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
            valBeat: document.getElementById('val-beat')!,
            barBeat: document.getElementById('bar-beat')!,
            valProg: document.getElementById('val-prog')!,
            barProg: document.getElementById('bar-prog')!,
            valDyn: document.getElementById('val-dyn')!,
            barDyn: document.getElementById('bar-dyn')!
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
            this.els.status.innerText = "Globális Dal Analízis (Zéró-CPU előkészítés)...";
            (this.els.upload as HTMLInputElement).disabled = true;
            (this.els.playBtn as HTMLButtonElement).disabled = true;
            this.els.bpmBadge.style.display = "none";
            
            this.engine.onAnalysisComplete = () => {
                if (State.bpm > 0) { 
                    this.els.bpmBadge.innerText = State.bpm + " BPM"; 
                    this.els.bpmBadge.style.display = "inline-flex"; 
                }
                this.els.status.innerText = "Kész: " + file.name;
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

        const seek = this.els.seekBar as HTMLInputElement;
        seek.addEventListener('mousedown', () => this.isDraggingSlider = true);
        seek.addEventListener('touchstart', () => this.isDraggingSlider = true);
        seek.addEventListener('input', (e) => {
            if (State.duration > 0) {
                let seekTime = (parseFloat((e.target as HTMLInputElement).value) / 100) * State.duration;
                this.els.timeCur.innerText = this.formatTime(seekTime);
                if (State.isPlaying) { 
                    this.engine.stop(false); 
                    this.engine.play(seekTime); 
                } else { 
                    this.engine.pausedAt = seekTime; 
                }
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
        if (State.isPlaying && !this.isDraggingSlider) {
            (this.els.seekBar as HTMLInputElement).value = ((State.currentTime / State.duration) * 100).toString();
            this.els.timeCur.innerText = this.formatTime(State.currentTime);
        }

        this.els.valE.innerText = State.currentFrame.e.toFixed(2); this.els.barE.style.width = (State.currentFrame.e * 100) + "%";
        this.els.valB.innerText = State.currentFrame.b.toFixed(2); this.els.barB.style.width = (State.currentFrame.b * 100) + "%";
        this.els.valM.innerText = State.currentFrame.m.toFixed(2); this.els.barM.style.width = (State.currentFrame.m * 100) + "%";
        this.els.valT.innerText = State.currentFrame.t.toFixed(2); this.els.barT.style.width = (State.currentFrame.t * 100) + "%";
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
        }
    }
}