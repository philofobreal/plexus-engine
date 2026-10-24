import * as THREE from 'three';
import { NativeWormholeCosmos } from './NativeWormholeCosmos';
import { NativeWormholeWall } from './NativeWormholeWall';
import { NativeMaterialAttributes, NativeWormholeMaterial } from './NativeWormholeMaterial';
import { WORMHOLE_NATIVE_CAPACITY, WORMHOLE_NATIVE_WEAVE_CAPACITY, WORMHOLE_NATIVE_STRIDE, WORMHOLE_NATIVE_MATERIAL_STRIDE, type WormholeNativeFrame, type WormholeNativeWeave,
    type WormholeNativeSource } from '../../types/WormholeNativeFrame';
import type { CanvasVisualPresentation, VisualAnalysisSnapshot } from '../../types/CanvasVisualSource';

/** Native field plus wall/cosmos, at most four draws per eye. No background canvas/texture. */
export class XrNativeWormhole {
    readonly root = new THREE.Group();
    readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
    readonly weaveMesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
    private readonly heads = new Float32Array(WORMHOLE_NATIVE_CAPACITY * 4);
    private readonly tails = new Float32Array(WORMHOLE_NATIVE_CAPACITY * 3);
    private readonly colors = new Float32Array(WORMHOLE_NATIVE_CAPACITY * 4);
    private readonly headAttribute = new THREE.InstancedBufferAttribute(this.heads, 4).setUsage(THREE.DynamicDrawUsage);
    private readonly tailAttribute = new THREE.InstancedBufferAttribute(this.tails, 3).setUsage(THREE.DynamicDrawUsage);
    private readonly colorAttribute = new THREE.InstancedBufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage);
    private readonly sharp = { value: 1 };
    readonly cosmos = new NativeWormholeCosmos();
    readonly wall = new NativeWormholeWall();
    private readonly surface = new NativeWormholeMaterial(this.sharp);
    private readonly grainSurface = new NativeMaterialAttributes(WORMHOLE_NATIVE_CAPACITY);
    private readonly weaveSurface = new NativeMaterialAttributes(WORMHOLE_NATIVE_WEAVE_CAPACITY);
    private readonly weaveHeads = new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_WEAVE_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    private readonly weaveTails = new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_WEAVE_CAPACITY * 3), 3).setUsage(THREE.DynamicDrawUsage);
    private readonly weaveColors = new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_WEAVE_CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    private ready = false; private revision = 0; private disposed = false;
    private phase = 0; private divider = 1; private shown = 0;
    private distance = 200; private budget = WORMHOLE_NATIVE_CAPACITY;
    onFrameReady: (() => void) | null = null;
    onError: ((message: string) => void) | null = null;
    constructor(privateSource: WormholeNativeSource) {
        this.source = privateSource;
        this.source.onFrameReady=()=>{if(!this.disposed&&this.root.visible)this.onFrameReady?.();};
        this.source.onError=message=>{if(!this.disposed)this.onError?.(message);};
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));
        geometry.setIndex([0,1,2,2,1,3]);
        geometry.setAttribute('aHead',this.headAttribute); geometry.setAttribute('aTail',this.tailAttribute); geometry.setAttribute('aColor',this.colorAttribute);
        this.grainSurface.install(geometry);
        geometry.instanceCount = 0;
        const material = this.surface.create(false);
        this.mesh = new THREE.Mesh(geometry,material); this.mesh.name='wormhole-native-grains-v1'; this.mesh.frustumCulled=false;
        this.mesh.onBeforeRender=renderer=>this.surface.beforeEye(renderer);
        this.root.name='wormhole-native-grains'; this.root.renderOrder=-1000; this.mesh.renderOrder=-1000;
        const weaveGeometry = new THREE.InstancedBufferGeometry();
        weaveGeometry.setAttribute('position', geometry.getAttribute('position').clone()); weaveGeometry.setIndex([0,1,2,2,1,3]);
        weaveGeometry.setAttribute('aHead',this.weaveHeads); weaveGeometry.setAttribute('aTail',this.weaveTails); weaveGeometry.setAttribute('aColor',this.weaveColors);
        this.weaveSurface.install(weaveGeometry);
        weaveGeometry.instanceCount=0;
        this.weaveMesh=new THREE.Mesh(weaveGeometry,this.surface.create(true));
        this.weaveMesh.onBeforeRender=renderer=>this.surface.beforeEye(renderer);
        this.weaveMesh.name='wormhole-native-weave-v1'; this.weaveMesh.frustumCulled=false; this.weaveMesh.renderOrder=-1001;
        this.root.add(this.cosmos.root,this.wall.mesh,this.mesh,this.weaveMesh);
    }
    private readonly source: WormholeNativeSource;
    get focalPoint() { return this.ready && this.root.visible ? this.source.focalPoint : null; }
    get spatialFrame() { return this.ready && this.root.visible ? this.source.spatialFrame : null; }
    get lastRenderMs(): number { return this.source.lastRenderMs; }
    get executionLabel(): string { return this.source.executionLabel??'main geometry; no canvas/worker'; }
    get rasterKind(): null { return null; }
    get framesShown(): number { return this.shown; }
    get redrawDivider(): number { return this.divider; }
    get frameLatencyMs(): number { return this.source.frameLatencyMs??0; }
    get stageTimes(): null { return null; }
    get aheadSamples(): number[] | null { return null; }
    get uploadedAhead(): boolean { return false; }
    setAdaptivePacing(_enabled: boolean): void { /* No asynchronous raster latency to fit. */ }
    setDistance(value: number): void { if (Number.isFinite(value) && value > 0) {
        this.distance=value;this.cosmos.setDistance(value);this.wall.setDistance(value);
        if(this.source.frame)this.cosmos.setFrame(this.source.frame.cosmos);
        if(this.source.frame)this.wall.setFrame(this.source.frame.wall);
    } }
    setQualityBudget(value: number): void {
        this.budget=Math.max(1,Math.min(WORMHOLE_NATIVE_CAPACITY,Math.floor(value)));
        this.cosmos.setBudget(this.budget);
        this.wall.setBudget(this.budget);
        this.surface.pixelLimit.value=this.budget<=360?12:this.budget<=720?14:this.budget<=1080?16:18;
    }
    setEyeHeight(value: number): void { if (Number.isFinite(value)) this.root.position.y=value; }
    setSharpness(value: number): void { this.sharp.value=Math.min(1,Math.max(0,value/1.5)); }
    configure(presentation: CanvasVisualPresentation, divider: number, _displayHz=0): void {
        this.source.setPresentation(presentation); this.divider=Math.max(1,Math.round(divider)); this.phase=0;
    }
    async prepare(analysis: VisualAnalysisSnapshot | null): Promise<void> {
        const revision=++this.revision; this.ready=false; this.mesh.geometry.instanceCount=0; this.weaveMesh.geometry.instanceCount=0;
        this.cosmos.clear();
        this.wall.clear();
        try { await this.source.prepare(analysis); }
        catch(error) { if(!this.disposed&&revision===this.revision)throw error; }
        if(!this.disposed&&revision===this.revision)this.ready=true;
    }
    update(time: number, playing: boolean): void {
        if(!this.ready||this.disposed||!this.root.visible)return;
        if(!playing)this.phase=0;else if(this.phase++%this.divider!==0)return;
        if(this.source.render(time,playing)&&this.source.frame){this.setFrame(this.source.frame);this.shown++;}
    }
    /** Copies the borrowed packet synchronously. Bounds protect the gameplay volume and near plane. */
    setFrame(frame: WormholeNativeFrame): void {
        if(this.disposed)return;
        if(frame.version!==1||!Number.isSafeInteger(frame.count)||frame.count<0||frame.count>WORMHOLE_NATIVE_CAPACITY
            ||frame.data.length<frame.count*WORMHOLE_NATIVE_STRIDE)throw new Error('Invalid native Wormhole spatial frame.');
        if(frame.weave && (!Number.isSafeInteger(frame.weave.count)||frame.weave.count<0||frame.weave.count>WORMHOLE_NATIVE_WEAVE_CAPACITY
            ||frame.weave.data.length<frame.weave.count*WORMHOLE_NATIVE_STRIDE))throw new Error('Invalid native Wormhole weave frame.');
        const material=frame.material;
        if(material && (![material.amount,material.detail,material.bloom].every(v=>Number.isFinite(v)&&v>=0&&v<=1)
            ||material.grains.length<frame.count*WORMHOLE_NATIVE_MATERIAL_STRIDE
            ||material.weave.length<(frame.weave?.count??0)*WORMHOLE_NATIVE_MATERIAL_STRIDE))throw new Error('Invalid native Wormhole material frame.');
        this.cosmos.setFrame(frame.cosmos);this.wall.setFrame(frame.wall);this.surface.configure(material);
        const data=frame.data;let count=0;
        for(let i=0;i<frame.count&&count<this.budget;i++){
            const o=i*WORMHOLE_NATIVE_STRIDE,x=data[o+1],y=data[o+2],z=data[o+3],alpha=data[o+11];
            if(!Number.isFinite(x+y+z+alpha)||-z<.3||-z>this.distance||(-z<12&&Math.hypot(x,y)<2.52)||alpha<=.001)continue;
            const tx=data[o+4],ty=data[o+5],tz=data[o+6];if(!Number.isFinite(tx+ty+tz))continue;
            const support=this.grainSurface.write(count,data,o,material?.grains,i,material);
            if(!Number.isFinite(support)||(-z<12&&Math.hypot(x,y)<2.4+Math.max(.12,support)))continue;
            const dx=tx-x,dy=ty-y,dz=tz-z,length=Math.hypot(dx,dy,dz),share=length>1.5?1.5/length:1;
            let endX=x+dx*share,endY=y+dy*share,endZ=z+dz*share;
            if(Math.min(-z,-endZ)<12){
                const vx=endX-x,vy=endY-y,length2=vx*vx+vy*vy;
                const u=length2>0?Math.min(1,Math.max(0,-(x*vx+y*vy)/length2)):0;
                if(Math.hypot(x+vx*u,y+vy*u)<2.4+Math.max(.12,support)){endX=x;endY=y;endZ=z;}
            }
            const h=count*4,t=count*3;
            this.heads[h]=x;this.heads[h+1]=y;this.heads[h+2]=z;this.heads[h+3]=Math.min(.08,Math.max(.004,data[o+7]));
            this.tails[t]=endX;this.tails[t+1]=endY;this.tails[t+2]=endZ;
            this.colors[h]=data[o+8];this.colors[h+1]=data[o+9];this.colors[h+2]=data[o+10];this.colors[h+3]=Math.min(.7,alpha);
            count++;
        }
        this.mesh.geometry.instanceCount=count;this.headAttribute.needsUpdate=true;this.tailAttribute.needsUpdate=true;this.colorAttribute.needsUpdate=true;
        this.grainSurface.uploaded();this.setWeave(frame.weave,material);
    }
    /** Reject an unsafe link as a whole: clipping it into a floating line would invent geometry. */
    private setWeave(frame?: WormholeNativeWeave, material?: WormholeNativeFrame['material']): void {
        let count=0;
        if(frame)for(let i=0;i<frame.count&&count<this.budget*3;i++){
            const o=i*WORMHOLE_NATIVE_STRIDE,d=frame.data;
            const x=d[o+1],y=d[o+2],z=d[o+3],tx=d[o+4],ty=d[o+5],tz=d[o+6],radius=d[o+7],alpha=d[o+11];
            if(!Number.isFinite(x+y+z+tx+ty+tz+radius+alpha+d[o+8]+d[o+9]+d[o+10])||alpha<=.001
                ||Math.min(-z,-tz)<.3||Math.max(-z,-tz)>this.distance||Math.hypot(tx-x,ty-y,tz-z)>3)continue;
            const support=this.weaveSurface.write(count,d,o,material?.weave,i,material);
            if(!Number.isFinite(support))continue;
            if(Math.min(-z,-tz)<12){
                const dx=tx-x,dy=ty-y,length2=dx*dx+dy*dy;
                const u=length2>0?Math.min(1,Math.max(0,-(x*dx+y*dy)/length2)):0;
                if(Math.hypot(x+dx*u,y+dy*u)<2.4+Math.max(.12,support))continue;
            }
            this.weaveHeads.setXYZW(count,x,y,z,Math.min(.08,Math.max(.004,radius)));
            this.weaveTails.setXYZ(count,tx,ty,tz);this.weaveColors.setXYZW(count,d[o+8],d[o+9],d[o+10],Math.min(.7,alpha));count++;
        }
        this.weaveMesh.geometry.instanceCount=count;
        this.weaveHeads.needsUpdate=true;this.weaveTails.needsUpdate=true;this.weaveColors.needsUpdate=true;
        this.weaveSurface.uploaded();
    }
    prerender(_renderer: THREE.WebGLRenderer): void { /* Drawn directly in each normal eye pass. */ }
    dispose(): void {
        if(this.disposed)return;this.disposed=true;this.revision++;this.ready=false;
        this.source.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();this.root.removeFromParent();
        this.weaveMesh.geometry.dispose();this.weaveMesh.material.dispose();
        this.cosmos.dispose();
        this.wall.dispose();
        this.onFrameReady=null;this.onError=null;
    }
}
