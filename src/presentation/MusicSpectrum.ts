import type { AudioFrame } from '../types';

export const MUSIC_SPECTRUM_BANDS = 24;
/** Absolute analysis-clock sampler, not a history accumulator or an FFT. Reuses caller storage. */
export function sampleMusicSpectrum(frames: readonly AudioFrame[], sampleRate: number, hopSize: number,
    songTime: number, out: Float32Array): boolean {
    out.fill(0);
    if(out.length!==24||!Number.isFinite(songTime)||songTime<0||!(sampleRate>0)||!Number.isFinite(sampleRate)
        ||!(hopSize>0)||!Number.isFinite(hopSize))return false;
    const position=songTime*sampleRate/hopSize,index=Math.floor(position),mix=position-index;
    if(index>=frames.length)return false;
    const a=frames[index]?.perceptualSpectrum,b=frames[index+1]?.perceptualSpectrum;
    if(a?.length!==24)return false;
    const unit=(v: number)=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;
    for(let i=0;i<24;i++)out[i]=unit(a[i])*(1-mix)+unit(b?.length===24?b[i]:a[i])*mix;
    return true;
}
/** 24 radial bars, in canvas-height units, with a fixed 90-degree opening BELOW the focal point.
 * The clear central disk and lower opening are independent of spectrum energy and spiral direction.
 */
export function projectMusicSpectrum(bands: Float32Array, size: number, out: Float32Array): void {
    const s=Number.isFinite(size)?Math.min(1,Math.max(0,size)):.5,inner=.045+.035*s;
    for(let i=0;i<24;i++){
        const angle=Math.PI*.75+(i+.5)/24*Math.PI*1.5,c=Math.cos(angle),sine=Math.sin(angle);
        const value=Number.isFinite(bands[i])?Math.min(1,Math.max(0,bands[i])):0;
        const outer=inner+(.008+.028*s)*value,o=i*4;
        out[o]=c*inner;out[o+1]=sine*inner;out[o+2]=c*outer;out[o+3]=sine*outer;
    }
}
