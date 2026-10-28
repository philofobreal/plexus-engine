import type { AudioFrame } from '../types';
import { DEFAULT_MUSIC_DISPLAY, normalizeMusicDisplay, type MusicDisplaySettings } from '../types/MusicDisplay';
import { projectMusicSpectrum, sampleMusicSpectrum } from '../presentation/MusicSpectrum';
import { INSTRUMENT_TOKENS } from '../presentation/InstrumentDesign';
import type { VisualRendererBackend } from './RendererBackend';
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const LEFT=rgb(INSTRUMENT_TOKENS.cyan),RIGHT=rgb(INSTRUMENT_TOKENS.magenta);

/** Bounded display pass inside the identity's existing raster/worker/export draw. */
export class WormholeMusicDisplay {
    private settings: Readonly<MusicDisplaySettings> = DEFAULT_MUSIC_DISPLAY;
    private input: unknown;
    readonly bands=new Float32Array(24);
    readonly lines=new Float32Array(96);
    setSettings(value?: MusicDisplaySettings): boolean {
        if(value===this.input)return false;this.input=value;
        const next=normalizeMusicDisplay(value),old=this.settings;
        this.settings=next;return next.mode!==old.mode||next.size!==old.size||next.opacity!==old.opacity;
    }
    draw(backend: VisualRendererBackend, frames: readonly AudioFrame[], sampleRate: number, hopSize: number,
        time: number, focus: Readonly<{x:number;y:number}>): void {
        const s=this.settings;
        if(s.mode==='off'||s.opacity===0||!sampleMusicSpectrum(frames,sampleRate,hopSize,time,this.bands))return;
        projectMusicSpectrum(this.bands,s.size,this.lines);
        const h=backend.height,cx=(focus.x+1)*backend.width*.5,cy=(1-focus.y)*h*.5;
        backend.noFill();backend.strokeWeight(Math.max(1.5,h*.002));
        for(let i=0;i<24;i++){
            if(this.bands[i]<=0)continue;
            const color=i<12?LEFT:RIGHT,o=i*4;
            backend.stroke(color[0],color[1],color[2],255*s.opacity*(.25+.5*this.bands[i]));
            backend.line(cx+this.lines[o]*h,cy+this.lines[o+1]*h,cx+this.lines[o+2]*h,cy+this.lines[o+3]*h,'round');
        }
    }
}
