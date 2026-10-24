import * as THREE from 'three';
import { WORMHOLE_NATIVE_MATERIAL_STRIDE, type WormholeNativeMaterial } from '../../types/WormholeNativeFrame';

const clamp = (x: number) => Math.min(1,Math.max(0,x));
export interface NativeMaterialShape { core: number; halo: number; support: number }
/** Metres, not raster pixels. Reuses the material's depth/extinction/halo character with spatial caps. */
export function nativeMaterialShape(base: number, depth: number, amount: number, detail: number, bloom: number,
    energy: number, alpha: number, out: NativeMaterialShape): void {
    if(amount<=0){out.core=base;out.halo=base;out.support=base;return;}
    const near=1-clamp(depth),t=clamp((depth-.55)/.45);
    const flux=clamp(alpha)*(.42+.58*clamp(energy))*(1-.6*t*t*(3-2*t))*Math.exp(-2.5*clamp(depth));
    out.core=Math.max(base*.85,Math.min(.1,(.006+.065*near*near)*(.55+.75*base/.02)));
    out.halo=Math.min(.24,out.core+(.5+3.4*clamp(detail))*(.3+.7*Math.sqrt(flux))*(.002+.035*Math.pow(near,2.2)));
    out.support=Math.min(.6,out.halo+clamp(bloom)*(.04+.32*near));
}

const VERTEX = `
attribute vec4 aHead; attribute vec3 aTail; attribute vec4 aColor;
attribute vec4 aSurface; attribute vec2 aIdentity; attribute vec4 aRadii;
uniform float uAmount; uniform float uViewportHeight; uniform float uViewportWidth; uniform float uPixelLimit;
varying vec2 vUv; varying vec4 vColor; varying vec4 vSurface; varying vec2 vIdentity;
varying vec4 vRadii; varying vec2 vLocal; varying float vLength;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.0)).xyz;
    vec3 tail=(modelViewMatrix*vec4(aTail,1.0)).xyz;
    vec2 delta=head.xy-tail.xy;
    float len=length(delta);
    vec2 dir=len>0.00001?normalize(delta):vec2(0.0,1.0);
    vec2 side=vec2(-dir.y,dir.x);
    float pixelScale=0.5*max(uViewportHeight*abs(projectionMatrix[1][1]),uViewportWidth*abs(projectionMatrix[0][0]))/max(0.3,min(-head.z,-tail.z));
    float support=uAmount>0.0?max(0.0001,min(aRadii.w,uPixelLimit/max(0.001,pixelScale))):aHead.w;
    vec3 p=mix(tail,head,position.y);
    p.xy+=support*(side*position.x+dir*(position.y*2.0-1.0));
    gl_Position=projectionMatrix*vec4(p,1.0);
    vUv=vec2(position.x,position.y);vColor=aColor;vSurface=aSurface;vIdentity=aIdentity;
    vRadii=vec4(min(aHead.w,support),min(aRadii.y,support),min(aRadii.z,support),support);
    vLocal=vec2(position.x*support,position.y*(len+2.0*support)-support);vLength=len;
}`;
const FRAGMENT = `
uniform float uSharpness; uniform float uAmount; uniform float uDetail; uniform float uBloom; uniform float uWeave;
varying vec2 vUv; varying vec4 vColor; varying vec4 vSurface; varying vec2 vIdentity;
varying vec4 vRadii; varying vec2 vLocal; varying float vLength;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+dot(vIdentity,vec2(17.23,43.17)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
void main(){
    // Predecessor packet/Amount zero: exact old shader branch and support, no noise/glow work.
    if(uAmount<=0.0){
        float edge=1.0-smoothstep(mix(0.1,0.7,uSharpness),1.0,abs(vUv.x));
        float cap=smoothstep(0.0,0.12,vUv.y)*(1.0-smoothstep(0.88,1.0,vUv.y));
        float alpha=vColor.a*edge*cap;if(alpha<0.001)discard;
        gl_FragColor=vec4(linearColor(vColor.rgb),alpha);
        #include <colorspace_fragment>
        return;
    }
    float along=clamp(vLocal.y/max(0.000001,vLength),0.0,1.0);
    float beyond=max(-vLocal.y,max(0.0,vLocal.y-vLength));
    float d2=vLocal.x*vLocal.x+beyond*beyond;
    float near=1.0-clamp(vSurface.z,0.0,1.0);
    float throat=clamp((vSurface.z-0.55)/0.45,0.0,1.0);
    float flux=vSurface.w*(0.42+0.58*vSurface.y)*(1.0-0.6*throat*throat*(3.0-2.0*throat))*exp(-2.5*vSurface.z);
    float coreFall=max(0.0,1.0-d2/max(0.000001,vRadii.y*vRadii.y));
    float haloFall=max(0.0,1.0-d2/max(0.000001,vRadii.z*vRadii.z));
    float haloGain=(0.1+0.4*uDetail)*(0.15+0.85*near);
    float shape=coreFall*coreFall+pow(haloFall,3.0)*haloGain;
    float phase=vSurface.x;
    float frequency=(1.6+4.4*uDetail)*(0.7+1.6*vSurface.z);
    float filament=1.0;
    float taper=vLength>vRadii.x*2.0?(uWeave>0.5?0.55+0.45*sin(3.14159265*along):0.24+0.76*along*(0.42+0.58*along)):1.0;
    float across=vLocal.x/max(0.004,vRadii.y);
    // Noise lives in carrier-local coordinates and release phase; no eye/screen/wall-clock seed.
    float textureValue=1.0;
    if(shape>0.00001){
        float coarse=noise(vec2(along*frequency+phase*0.31,0.0));
        float fine=noise(vec2(along*frequency*2.6+phase*0.57,13.0));
        float shaped=clamp((coarse*0.63+fine*0.37-(0.28+0.22*uDetail))*(0.9+1.15*uDetail)+0.5,0.0,1.0);
        if(uWeave<0.5&&vLength>vRadii.x*2.0)filament=mix(0.6-0.3*uDetail,1.0,shaped*shaped*(3.0-2.0*shaped));
        float fibreA=noise(vec2(along*frequency*2.0+phase*0.44,across*(0.45+0.85*uDetail)*3.0));
        float fibreB=noise(vec2(along*frequency*5.4+phase*0.79,across*(0.45+0.85*uDetail)*8.1));
        textureValue=uWeave>0.5?0.62+0.76*fibreA:0.5+0.72*(fibreA*0.64+fibreB*0.36);
    }
    float gain=(uWeave>0.5?1.6:1.7)/(0.5+vRadii.z/0.02*0.34);
    float density=flux*gain*shape*taper*filament*textureValue;
    float emission=1.0-exp(-density*1.75);
    float bodyAlpha=emission*uAmount;
    float mediumRadius=mix(vRadii.z,vRadii.w,0.45);
    float mediumFall=max(0.0,1.0-d2/max(0.000001,mediumRadius*mediumRadius));
    float hazeFall=max(0.0,1.0-d2/max(0.000001,vRadii.w*vRadii.w));
    float glowAlpha=(1.0-exp(-flux*gain*1.75))*uAmount*uBloom*(0.15+0.85*near)
        *(0.32*pow(mediumFall,3.0)+0.16*pow(hazeFall,3.0));
    float lineEdge=1.0-smoothstep(mix(0.1,0.7,uSharpness),1.0,abs(vLocal.x)/vRadii.x);
    float lineCap=smoothstep(0.0,0.12,along)*(1.0-smoothstep(0.88,1.0,along));
    float legacyAlpha=uWeave>0.5?0.0:vColor.a*(1.0-uAmount)*lineEdge*lineCap;
    float total=legacyAlpha+bodyAlpha+glowAlpha;if(total<0.001)discard;
    vec3 tint=clamp(vColor.rgb*vec3(0.72+0.62*near,0.94-0.06*near,1.22-0.16*near),0.0,1.0);
    vec3 body=clamp(tint*(0.78+0.5*emission),0.0,1.0);
    vec3 color=(linearColor(vColor.rgb)*legacyAlpha+linearColor(body)*bodyAlpha+linearColor(tint)*glowAlpha)/total;
    gl_FragColor=vec4(color,min(0.85,total));
    #include <colorspace_fragment>
}`;

export class NativeMaterialAttributes {
    readonly surface: THREE.InstancedBufferAttribute;
    readonly identity: THREE.InstancedBufferAttribute;
    readonly radii: THREE.InstancedBufferAttribute;
    private readonly shape: NativeMaterialShape={core:0,halo:0,support:0};
    constructor(capacity: number){
        this.surface=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
        this.identity=new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage);
        this.radii=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    }
    install(geometry: THREE.InstancedBufferGeometry): void {
        geometry.setAttribute('aSurface',this.surface);geometry.setAttribute('aIdentity',this.identity);geometry.setAttribute('aRadii',this.radii);
    }
    write(index: number, data: Float32Array, o: number, metadata: Float32Array | undefined, sourceIndex: number,
        material?: WormholeNativeMaterial): number {
        const m=sourceIndex*WORMHOLE_NATIVE_MATERIAL_STRIDE,base=Math.min(.08,Math.max(.004,data[o+7]));
        const phase=metadata?.[m]??0,energy=metadata?.[m+1]??0,alpha=metadata?.[m+2]??data[o+11],depth=clamp(data[o+14]);
        if(!Number.isFinite(phase+energy+alpha+depth+base+data[o+12]+data[o+13]))return Number.NaN;
        nativeMaterialShape(base,depth,material?.amount??0,material?.detail??0,material?.bloom??0,energy,alpha,this.shape);
        this.surface.setXYZW(index,phase,clamp(energy),depth,clamp(alpha));this.identity.setXY(index,data[o+13],data[o+12]);
        this.radii.setXYZW(index,base,this.shape.core,this.shape.halo,this.shape.support);
        return this.shape.support;
    }
    uploaded(): void {this.surface.needsUpdate=true;this.identity.needsUpdate=true;this.radii.needsUpdate=true;}
}

export class NativeWormholeMaterial {
    readonly amount={value:0};readonly detail={value:0};readonly bloom={value:0};
    readonly viewportHeight={value:1};readonly viewportWidth={value:1};readonly pixelLimit={value:18};
    private readonly viewport=new THREE.Vector4();
    private readonly sharp: {value:number};
    constructor(sharp: {value:number}){this.sharp=sharp;}
    create(weave: boolean): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,
            uniforms:{uSharpness:this.sharp,uAmount:this.amount,uDetail:this.detail,uBloom:this.bloom,
                uViewportHeight:this.viewportHeight,uViewportWidth:this.viewportWidth,uPixelLimit:this.pixelLimit,uWeave:{value:weave?1:0}},
            transparent:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
            blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
            depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    }
    beforeEye(renderer: THREE.WebGLRenderer): void {
        renderer.getCurrentViewport(this.viewport);this.viewportHeight.value=Math.max(1,this.viewport.w);this.viewportWidth.value=Math.max(1,this.viewport.z);
    }
    configure(material?: WormholeNativeMaterial): void {
        this.amount.value=material?.amount??0;this.detail.value=material?.detail??0;this.bloom.value=material?.bloom??0;
    }
}
