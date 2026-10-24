import * as THREE from 'three';
import { WORMHOLE_NATIVE_WALL_CAPACITY as CAPACITY, WORMHOLE_NATIVE_STRIDE,
    type WormholeNativeWeave } from '../../types/WormholeNativeFrame';

const VERTEX=`
attribute vec4 aHead;attribute vec3 aTail;attribute vec4 aColor;
uniform vec2 uViewport;uniform float uPixelLimit;
varying vec4 vColor;varying vec2 vLocal;varying float vLength;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.)).xyz,tail=(modelViewMatrix*vec4(aTail,1.)).xyz;
    vec2 delta=head.xy-tail.xy;float len=length(delta);vec2 dir=len>.00001?delta/len:vec2(0.,1.);
    float pixels=.5*max(uViewport.y*abs(projectionMatrix[1][1]),uViewport.x*abs(projectionMatrix[0][0]))/max(.3,min(-head.z,-tail.z));
    float radius=clamp(aHead.w,.4/max(.001,pixels),uPixelLimit/max(.001,pixels));
    vec3 p=mix(tail,head,position.y);p.xy+=radius*(vec2(-dir.y,dir.x)*position.x+dir*(position.y*2.-1.));
    gl_Position=projectionMatrix*vec4(p,1.);vLocal=vec2(position.x,position.y*(len/radius+2.)-1.);vLength=len/radius;vColor=aColor;
}`;
const FRAGMENT=`
varying vec4 vColor;varying vec2 vLocal;varying float vLength;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){
    float end=max(-vLocal.y,max(0.,vLocal.y-vLength));float r2=vLocal.x*vLocal.x+end*end;
    if(r2>1.)discard;float alpha=vColor.a*pow(max(0.,1.-r2),1.5);if(alpha<.001)discard;
    gl_FragColor=vec4(linearColor(vColor.rgb),min(.7,alpha));
    #include <colorspace_fragment>
}`;

/** Authored wall light paths, not a solid shell or post-projected background image. */
export class NativeWormholeWall {
    readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
    private readonly heads=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
    private readonly tails=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage);
    private readonly colors=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
    private readonly viewport=new THREE.Vector4();private readonly viewportSize={value:new THREE.Vector2(1,1)};
    private readonly pixelLimit={value:3};private budget=1440;private distance=200;private disposed=false;
    constructor(){
        const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));g.setIndex([0,1,2,2,1,3]);
        g.setAttribute('aHead',this.heads);g.setAttribute('aTail',this.tails);g.setAttribute('aColor',this.colors);g.instanceCount=0;
        const m=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{uViewport:this.viewportSize,uPixelLimit:this.pixelLimit},
            transparent:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
        this.mesh=new THREE.Mesh(g,m);this.mesh.name='wormhole-native-wall-v1';this.mesh.frustumCulled=false;this.mesh.renderOrder=-1001.5;
        this.mesh.onBeforeRender=renderer=>{renderer.getCurrentViewport(this.viewport);this.viewportSize.value.set(Math.max(1,this.viewport.z),Math.max(1,this.viewport.w));};
    }
    setDistance(distance:number):void{if(Number.isFinite(distance)&&distance>0)this.distance=distance;}
    setBudget(budget:number):void{if(Number.isFinite(budget)){this.budget=Math.max(1,Math.min(1440,Math.floor(budget)));this.pixelLimit.value=this.budget<=720?2:3;}}
    clear():void{this.mesh.geometry.instanceCount=0;}
    setFrame(frame?:WormholeNativeWeave):void{
        if(this.disposed)return;
        if(frame&&(!Number.isSafeInteger(frame.count)||frame.count<0||frame.count>CAPACITY||frame.data.length<frame.count*WORMHOLE_NATIVE_STRIDE))throw Error('Invalid native wall frame.');
        let count=0;const stride=Math.ceil(1440/this.budget);
        if(frame)for(let i=0;i<frame.count;i++){
            const d=frame.data,o=i*16,id=d[o],kind=d[o+15],variant=d[o+12];
            if(!Number.isSafeInteger(id)||id<0||!Number.isInteger(kind)||kind<0||kind>3||(variant!==-1&&variant!==0&&variant!==1)||id%stride!==0)continue;
            const x=d[o+1],y=d[o+2],z=d[o+3],tx=d[o+4],ty=d[o+5],tz=d[o+6],radius=d[o+7],alpha=d[o+11];
            if(!Number.isFinite(x+y+z+tx+ty+tz+radius+alpha+d[o+8]+d[o+9]+d[o+10])||radius<=0||alpha<=.001
                ||Math.min(-z,-tz)<.3||Math.max(-z,-tz)>this.distance||Math.hypot(tx-x,ty-y,tz-z)>24)continue;
            if(Math.min(-z,-tz)<12){const dx=tx-x,dy=ty-y,l2=dx*dx+dy*dy,u=l2>0?Math.max(0,Math.min(1,-(x*dx+y*dy)/l2)):0;
                if(Math.hypot(x+u*dx,y+u*dy)<2.52+Math.max(.08,radius))continue;}
            this.heads.setXYZW(count,x,y,z,Math.min(.08,radius));this.tails.setXYZ(count,tx,ty,tz);
            this.colors.setXYZW(count,d[o+8],d[o+9],d[o+10],Math.max(0,Math.min(.7,alpha)));count++;
        }
        this.mesh.geometry.instanceCount=count;this.heads.needsUpdate=true;this.tails.needsUpdate=true;this.colors.needsUpdate=true;
    }
    dispose():void{if(this.disposed)return;this.disposed=true;this.clear();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.removeFromParent();}
}
