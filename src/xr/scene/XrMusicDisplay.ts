import * as THREE from 'three';
import type { AudioFrame } from '../../types';
import type { MusicDisplaySettings } from '../../types/MusicDisplay';
import { sampleMusicSpectrum, projectMusicSpectrum } from '../../presentation/MusicSpectrum';
import { INSTRUMENT_TOKENS } from '../../presentation/InstrumentDesign';
import { backdropScale, SCENE_CONFIG } from './SceneConfig';

/** Native-only counterpart of the raster pass: one fixed 24-quad batch, behind gameplay. */
export class XrMusicDisplay {
    readonly mesh: THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    readonly bands=new Float32Array(24);
    readonly lines=new Float32Array(96);
    private readonly positions=new THREE.BufferAttribute(new Float32Array(24*12),3);
    private readonly colors=new THREE.BufferAttribute(new Float32Array(24*16),4);
    private valid=false;
    private lastTime=NaN;
    private lastSize=NaN;
    private lastFrames: readonly AudioFrame[] | null=null;
    private lastRate=0;private lastHop=0;
    constructor(){
        const geometry=new THREE.BufferGeometry(),indices:number[]=[];
        const c=new THREE.Color();
        for(let i=0;i<24;i++){c.set(i<12?INSTRUMENT_TOKENS.cyan:INSTRUMENT_TOKENS.magenta);for(let j=0;j<4;j++)this.colors.setXYZW(i*4+j,c.r,c.g,c.b,0);
            const v=i*4;indices.push(v,v+1,v+2,v+1,v+3,v+2)}
        geometry.setAttribute('position',this.positions);geometry.setAttribute('color',this.colors);geometry.setIndex(indices);
        this.positions.setUsage(THREE.DynamicDrawUsage);
        this.colors.setUsage(THREE.DynamicDrawUsage);
        this.mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
        this.mesh.material.forceSinglePass=true;this.mesh.frustumCulled=false;this.mesh.renderOrder=-90;this.mesh.visible=false;this.mesh.name='wormhole-music-display';
    }
    update(frames:readonly AudioFrame[],rate:number,hop:number,time:number,focus:Readonly<{x:number;y:number}>,distance:number,eyeHeight:number,s:MusicDisplaySettings):void {
        this.mesh.visible=s.mode==='spectrum'&&s.opacity>0&&Number.isFinite(focus.x)&&Number.isFinite(focus.y);
        if(!this.mesh.visible)return;
        if(time!==this.lastTime||s.size!==this.lastSize||frames!==this.lastFrames||rate!==this.lastRate||hop!==this.lastHop){
            this.lastTime=time;this.lastSize=s.size;this.lastFrames=frames;this.lastRate=rate;this.lastHop=hop;
            this.valid=sampleMusicSpectrum(frames,rate,hop,time,this.bands);
            projectMusicSpectrum(this.bands,s.size,this.lines);
            for(let i=0;i<24;i++){
                const o=i*4,x=this.lines[o],y=-this.lines[o+1],a=this.lines[o+2],b=-this.lines[o+3];
                const dx=a-x,dy=b-y,len=Math.hypot(dx,dy),half=.001;
                const nx=len>0?-dy/len*half:0,ny=len>0?dx/len*half:0,v=i*4;
                this.positions.setXYZ(v,x+nx,y+ny,0);this.positions.setXYZ(v+1,x-nx,y-ny,0);
                this.positions.setXYZ(v+2,a+nx,b+ny,0);this.positions.setXYZ(v+3,a-nx,b-ny,0);
                for(let j=0;j<4;j++)this.colors.setW(v+j,.25+.5*this.bands[i]);
            }
            this.positions.needsUpdate=true;
            this.colors.needsUpdate=true;
        }
        this.mesh.visible=this.valid;
        const scale=backdropScale(distance),h=SCENE_CONFIG.backdropHeightMeters*scale;
        this.mesh.scale.setScalar(h);this.mesh.position.set(focus.x*SCENE_CONFIG.backdropWidthMeters*scale*.5,eyeHeight+focus.y*h*.5,-distance);
        this.mesh.material.opacity=s.opacity;
    }
    dispose():void {this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
