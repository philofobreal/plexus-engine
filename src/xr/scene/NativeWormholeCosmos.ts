import * as THREE from 'three';
import { WORMHOLE_NATIVE_COSMOS_CAPACITY, WORMHOLE_NATIVE_COSMOS_HORIZON,
    WORMHOLE_NATIVE_STRIDE, type WormholeNativeWeave } from '../../types/WormholeNativeFrame';

const VERTEX=`
attribute vec4 aHead; attribute vec3 aTail; attribute vec4 aColor; attribute float aKind;
uniform vec2 uViewport; varying vec4 vColor; varying vec2 vLocal; varying float vLength; varying float vKind;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.0)).xyz;
    vec3 tail=(modelViewMatrix*vec4(aTail,1.0)).xyz;
    float scale=length(modelViewMatrix[0].xyz);
    vec2 delta=head.xy-tail.xy;float len=length(delta);
    vec2 dir=len>.00001?delta/len:vec2(0.,1.);vec2 side=vec2(-dir.y,dir.x);
    float pixels=.5*max(uViewport.y*abs(projectionMatrix[1][1]),uViewport.x*abs(projectionMatrix[0][0]))/max(.3,-head.z);
    float limit=aKind>.5&&aKind<1.5?96.:(aKind>2.5?5.:2.5);
    float radius=clamp(aHead.w*scale,.45/max(.001,pixels),limit/max(.001,pixels));
    // Fixed per-eye streak limit also protects oblique views of a long world-space trail.
    if(len*pixels>24.){tail.xy=head.xy-dir*24./pixels;len=24./pixels;}
    vec3 p=mix(tail,head,position.y);p.xy+=radius*(side*position.x+dir*(position.y*2.-1.));
    gl_Position=projectionMatrix*vec4(p,1.);
    vLocal=vec2(position.x,position.y*(len/radius+2.)-1.);vLength=len/radius;vColor=aColor;vKind=aKind;
}`;
const FRAGMENT=`
varying vec4 vColor; varying vec2 vLocal; varying float vLength; varying float vKind;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){
    float end=max(-vLocal.y,max(0.,vLocal.y-vLength));float r2=vLocal.x*vLocal.x+end*end;
    if(r2>1.)discard;
    float soft=pow(max(0.,1.-r2),vKind>.5&&vKind<1.5?3.:1.6);
    float alpha=min(.7,vColor.a)*soft;if(alpha<.001)discard;
    gl_FragColor=vec4(linearColor(vColor.rgb),alpha);
    #include <colorspace_fragment>
}`;

/** One bounded far-field draw. Coordinates remain authored world coordinates until eye projection. */
export class NativeWormholeCosmos {
    readonly root=new THREE.Group();
    readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
    private readonly heads=new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_COSMOS_CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
    private readonly tails=new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_COSMOS_CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage);
    private readonly colors=new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_COSMOS_CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
    private readonly kinds=new THREE.InstancedBufferAttribute(new Float32Array(WORMHOLE_NATIVE_COSMOS_CAPACITY),1).setUsage(THREE.DynamicDrawUsage);
    private readonly viewport=new THREE.Vector4();private readonly viewportSize={value:new THREE.Vector2(1,1)};
    private distance=200;private budget=1440;private disposed=false;
    constructor(){
        const geometry=new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));geometry.setIndex([0,1,2,2,1,3]);
        geometry.setAttribute('aHead',this.heads);geometry.setAttribute('aTail',this.tails);geometry.setAttribute('aColor',this.colors);geometry.setAttribute('aKind',this.kinds);geometry.instanceCount=0;
        const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{uViewport:this.viewportSize},
            transparent:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
        this.mesh=new THREE.Mesh(geometry,material);this.mesh.name='wormhole-native-cosmos-v1';this.mesh.frustumCulled=false;
        this.mesh.renderOrder=-1002;this.root.renderOrder=-1002;this.root.add(this.mesh);this.setDistance(200);
        this.mesh.onBeforeRender=renderer=>{renderer.getCurrentViewport(this.viewport);this.viewportSize.value.set(Math.max(1,this.viewport.z),Math.max(1,this.viewport.w));};
    }
    setDistance(distance:number):void{if(Number.isFinite(distance)&&distance>0){this.distance=distance;this.root.scale.setScalar(distance/WORMHOLE_NATIVE_COSMOS_HORIZON);}}
    setBudget(budget:number):void{if(Number.isFinite(budget))this.budget=Math.max(1,Math.min(1440,Math.floor(budget)));}
    clear():void{this.mesh.geometry.instanceCount=0;}
    setFrame(frame?:WormholeNativeWeave):void{
        if(this.disposed)return;
        if(frame&&(!Number.isSafeInteger(frame.count)||frame.count<0||frame.count>WORMHOLE_NATIVE_COSMOS_CAPACITY||frame.data.length<frame.count*WORMHOLE_NATIVE_STRIDE))throw Error('Invalid native cosmos frame.');
        let count=0;const stride=Math.ceil(1440/this.budget),scale=this.distance/WORMHOLE_NATIVE_COSMOS_HORIZON;
        if(frame)for(let i=0;i<frame.count;i++){
            const o=i*16,d=frame.data,id=d[o],kind=d[o+15];
            if(!Number.isInteger(id)||!Number.isInteger(kind)||kind<0||kind>3)continue;
            if(kind!==1&&(kind>=2?id/6:id)%stride!==0)continue;
            const x=d[o+1],y=d[o+2],z=d[o+3],tx=d[o+4],ty=d[o+5],tz=d[o+6],radius=d[o+7],alpha=d[o+11];
            if(!Number.isFinite(x+y+z+tx+ty+tz+radius+alpha+d[o+8]+d[o+9]+d[o+10])||radius<=0||alpha<=.001||Math.min(-z,-tz)*scale<.3)continue;
            // Keep entire near strokes/soft discs out of the gameplay volume.
            if(Math.min(-z,-tz)*scale<12){const dx=tx-x,dy=ty-y,l2=dx*dx+dy*dy;
                const u=l2>0?Math.max(0,Math.min(1,-(x*dx+y*dy)/l2)):0;
                if(Math.hypot(x+u*dx,y+u*dy)*scale<2.52+radius*scale)continue;}
            this.heads.setXYZW(count,x,y,z,radius);this.tails.setXYZ(count,tx,ty,tz);
            this.colors.setXYZW(count,d[o+8],d[o+9],d[o+10],Math.min(.7,Math.max(0,alpha)));this.kinds.setX(count,kind);count++;
        }
        this.mesh.geometry.instanceCount=count;this.heads.needsUpdate=true;this.tails.needsUpdate=true;this.colors.needsUpdate=true;this.kinds.needsUpdate=true;
    }
    dispose():void{if(this.disposed)return;this.disposed=true;this.clear();this.mesh.geometry.dispose();this.mesh.material.dispose();this.root.removeFromParent();}
}
