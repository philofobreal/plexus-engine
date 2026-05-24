import AnalyzerWorker from './analyzer.worker.ts?worker';
import { State } from '../state/store';
import type { AnalysisResult } from '../types';

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    
    private playStartTime = 0;
    private playOffset = 0;
    public pausedAt = 0;

    public onAnalysisComplete?: () => void;
    public onPlaybackEnded?: () => void;

    async loadFile(file: File) {
        if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        
        State.duration = this.buffer.duration;
        State.sampleRate = this.buffer.sampleRate;

        const worker = new AnalyzerWorker();
        const channelData = this.buffer.getChannelData(0);
        
        worker.postMessage({ samples: channelData.buffer, sampleRate: State.sampleRate }, [channelData.buffer]);
        
        worker.onmessage = (e: MessageEvent<AnalysisResult & {type: string}>) => {
            if (e.data.type === 'analysis_done') {
                State.bpm = e.data.bpm;
                State.frames = e.data.frames;
                State.events = e.data.events;
                State.hopSize = e.data.hopSize;
                worker.terminate();
                if (this.onAnalysisComplete) this.onAnalysisComplete();
            }
        };
    }

    play(offset: number = this.pausedAt) {
        if (!this.ctx || !this.buffer) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.ctx.destination);
        
        this.playStartTime = this.ctx.currentTime;
        this.playOffset = offset;
        
        this.source.onended = () => {
            if (this.getCurrentTime() >= State.duration - 0.1) {
                this.stop(true);
                if (this.onPlaybackEnded) this.onPlaybackEnded();
            }
        };

        this.source.start(0, offset);
        State.isPlaying = true;
    }

    stop(reset: boolean = false) {
        if (this.source) {
            this.source.onended = null;
            try { this.source.stop(); } catch(e){}
            this.source.disconnect();
            this.source = null;
        }
        State.isPlaying = false;
        if (reset) {
            this.pausedAt = 0;
            State.currentTime = 0;
        } else {
            this.pausedAt = this.getCurrentTime();
        }
    }

    getCurrentTime(): number {
        if (!State.isPlaying || !this.ctx) return this.pausedAt;
        return this.playOffset + (this.ctx.currentTime - this.playStartTime);
    }
}