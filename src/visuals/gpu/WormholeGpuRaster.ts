import type { GrainMaterialFrame } from '../../types/GrainMaterialFrame';
import type { GrainLineFrame } from '../../types/GrainLineFrame';
import { CARRIER_VERTEX, CARRIER_FRAGMENT, PASS_VERTEX, RESOLVE_FRAGMENT, GATHER_FRAGMENT,
    IIR_FRAGMENT, LINE_AREA_VERTEX, LINE_AREA_FRAGMENT } from './WormholeGpuShaders';

type Target = { texture: WebGLTexture; buffer: WebGLFramebuffer; width: number; height: number; bytes: number };
type Program = { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };
export type WormholeGpuPrecision = 'float16' | 'float32';

/** Research boundary: fixed carrier ceiling and current UHD output; no host/default integration. */
export function validateGpuRasterInput(width: number, height: number, base: Uint8Array,
    material: GrainMaterialFrame | null, lines: GrainLineFrame): void {
    const integer = (x: number, max: number) => Number.isSafeInteger(x) && x > 0 && x <= max;
    if (!integer(width, 8192) || !integer(height, 8192) || width * height > 3840 * 2160
        || !(base instanceof Uint8Array) || base.length !== width * height * 4) throw Error('Invalid GPU base image');
    const data = (array: Float32Array, count: number, stride: number) => {
        if (!(array instanceof Float32Array) || !Number.isSafeInteger(count) || count < 0 || count > 32768
            || array.length < count * stride) throw Error('Invalid GPU carrier count');
        for (let i = 0; i < count * stride; i++) if (!Number.isFinite(array[i])) throw Error('Nonfinite GPU carrier');
    };
    if (lines.width !== width || lines.height !== height || typeof lines.square !== 'boolean') throw Error('Mismatched GPU line image');
    data(lines.data, lines.count, 9);
    if (material) {
        if (!integer(material.cols, 640) || !integer(material.rows, 640) || material.cols * material.rows > 640 * 360
            || ![material.amount, material.bloom, material.detail].every(x => Number.isFinite(x) && x >= 0 && x <= 1))
            throw Error('Invalid GPU material surface');
        data(material.data, material.count, 24);
    }
}

const COMPOSE = `precision highp float;
out vec4 outColor;
uniform sampler2D uBase, uLines, uL0, uL1, uL2;
uniform vec2 uSize;
uniform bool uMaterial;
// Manual bilinear also works on RGBA32F without OES_texture_float_linear.
vec4 sampleLayer(sampler2D image, vec2 uv) {
    ivec2 size = textureSize(image, 0);
    vec2 p = uv * vec2(size) - 0.5, f = fract(p); ivec2 i = ivec2(floor(p));
    vec4 a = texelFetch(image, clamp(i, ivec2(0), size-1), 0);
    vec4 b = texelFetch(image, clamp(i+ivec2(1,0), ivec2(0), size-1), 0);
    vec4 c = texelFetch(image, clamp(i+ivec2(0,1), ivec2(0), size-1), 0);
    vec4 d = texelFetch(image, clamp(i+ivec2(1,1), ivec2(0), size-1), 0);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 base = texelFetch(uBase, ivec2(p.x, int(uSize.y)-1-p.y), 0);
    base.rgb *= base.a;
    vec4 line = texelFetch(uLines, p, 0);
    vec4 result = line + base * (1.0-line.a);
    if (uMaterial) {
        vec2 uv = gl_FragCoord.xy/uSize;
        vec4 a=sampleLayer(uL0,uv), b=sampleLayer(uL1,uv), c=sampleLayer(uL2,uv);
        result += c+b+a;
    }
    outColor=clamp(result,0.0,1.0);
}`;

// Match CanvasFieldRasterSurface's straight-alpha Bayer quantization before bilinear upscale.
const QUANTIZE = `precision highp float; precision highp int;
out vec4 outColor; uniform sampler2D uSource; uniform bool uPremultiplied;
void main() {
    ivec2 p=ivec2(gl_FragCoord.xy), size=textureSize(uSource,0);
    int x=p.x&7, y=(size.y-1-p.y)&7, mixed=x^y, value=0;
    for(int bit=2;bit>=0;bit--) { value=(value<<1)|((y>>bit)&1);value=(value<<1)|((mixed>>bit)&1); }
    float threshold=float(value)/64.0-0.5;
    vec4 c=texelFetch(uSource,p,0);
    if(uPremultiplied)c.rgb=c.a>0.0?c.rgb/c.a:vec3(0.0);
    c=clamp(roundEven(c*255.0+threshold),0.0,255.0)/255.0;
    outColor=vec4(c.rgb*c.a,c.a);
}`;

/** Plain WebGL2 adapter, safe to construct in an Offscreen worker. No Three, State or audio. */
export class WormholeGpuRaster {
    readonly gl: WebGL2RenderingContext;
    readonly canvas: OffscreenCanvas | HTMLCanvasElement;
    readonly precision: WormholeGpuPrecision;
    private readonly programs: Program[] = [];
    private readonly buffers: WebGLBuffer[] = [];
    private readonly arrays: WebGLVertexArrayObject[] = [];
    private readonly targets: Target[] = [];
    private readonly textures: WebGLTexture[] = [];
    private carrier!: Program; private resolve!: Program; private gather!: Program;
    private blurProgram!: Program; private line!: Program; private compose!: Program; private quantize!: Program;
    private passArray!: WebGLVertexArrayObject; private carrierArray!: WebGLVertexArrayObject;
    private lineArray!: WebGLVertexArrayObject; private carrierData!: WebGLBuffer; private lineData!: WebGLBuffer;
    private base!: WebGLTexture;
    private baseWidth = 0; private baseHeight = 0;
    private disposed = false;

    constructor(canvas: OffscreenCanvas | HTMLCanvasElement, precision: WormholeGpuPrecision = 'float16') {
        this.canvas = canvas; this.precision = precision;
        if (precision !== 'float16' && precision !== 'float32') throw Error('Unsupported GPU precision');
        const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false,
            depth: false, stencil: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null;
        if (!gl) throw Error('WebGL2 unavailable'); this.gl = gl;
        try {
            if (!gl.getExtension('EXT_color_buffer_float')) throw Error('Float colour targets unavailable');
            if (precision === 'float32' && !gl.getExtension('EXT_float_blend')) throw Error('Float32 blending unavailable');
            this.carrier = this.program(CARRIER_VERTEX, CARRIER_FRAGMENT);
            this.resolve = this.program(PASS_VERTEX, RESOLVE_FRAGMENT);
            this.gather = this.program(PASS_VERTEX, GATHER_FRAGMENT);
            this.blurProgram = this.program(PASS_VERTEX, IIR_FRAGMENT);
            this.line = this.program(LINE_AREA_VERTEX, LINE_AREA_FRAGMENT);
            this.compose = this.program(PASS_VERTEX, COMPOSE);
            this.quantize = this.program(PASS_VERTEX, QUANTIZE);
            this.passArray = this.geometry(this.resolve, new Float32Array([-1,-1,0,3,-1,0,-1,3,0]));
            const quad = new Float32Array([0,-1,0,1,-1,0,0,1,0,0,1,0,1,-1,0,1,1,0]);
            this.carrierArray = this.geometry(this.carrier, quad); this.carrierData = this.buffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.carrierData);
            for (let i=0; i<6; i++) this.attribute(this.carrier, 'a'+i, 4, 96, i*16, 1);
            this.lineArray = this.geometry(this.line, quad); this.lineData = this.buffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.lineData);
            this.attribute(this.line,'aSegment',4,36,0,1); this.attribute(this.line,'aWidth',1,36,16,1);
            this.attribute(this.line,'aColor',4,36,20,1);
            this.base = this.texture();
            gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.DITHER);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
            this.check();
        } catch (error) { this.dispose(); throw error; }
    }

    /** Upload and issue GPU passes. Call finish or readPixels for completion timing, not this alone. */
    render(width: number, height: number, base: Uint8Array, material: GrainMaterialFrame | null, lines: GrainLineFrame,
        baseSource?: OffscreenCanvas): void {
        if (this.disposed || this.gl.isContextLost()) throw Error('GPU raster unavailable');
        validateGpuRasterInput(width,height,base,material,lines);
        if(baseSource && (baseSource.width!==width || baseSource.height!==height))throw Error('Mismatched base canvas');
        const gl=this.gl;
        if (this.canvas.width!==width) this.canvas.width=width;
        if (this.canvas.height!==height) this.canvas.height=height;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.base);
        if(this.baseWidth!==width||this.baseHeight!==height){
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
            this.baseWidth=width;this.baseHeight=height;
        }
        if(baseSource)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,baseSource);
        else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,base);
        const cols=material?.cols??1, rows=material?.rows??1;
        const l1w=Math.max(1,Math.round(cols/3)), l1h=Math.max(1,Math.round(rows/3));
        const l2w=Math.max(1,Math.round(cols/8)), l2h=Math.max(1,Math.round(rows/8));
        const accum=this.target(0,cols,rows), resolved=this.target(1,cols,rows);
        const l1=[this.target(2,l1w,l1h),this.target(3,l1w,l1h)];
        const l2=[this.target(4,l2w,l2h),this.target(5,l2w,l2h)];
        const lineTarget=this.target(6,width,height,true);
        const quantized=[this.target(7,cols,rows,true),this.target(8,l1w,l1h,true),this.target(9,l2w,l2h,true)];
        this.bind(lineTarget); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        if (lines.count) {
            gl.useProgram(this.line.program); gl.bindVertexArray(this.lineArray);
            gl.bindBuffer(gl.ARRAY_BUFFER,this.lineData); gl.bufferData(gl.ARRAY_BUFFER,lines.data.subarray(0,lines.count*9),gl.DYNAMIC_DRAW);
            gl.uniform2f(this.u(this.line,'uSize'),width,height); gl.uniform1f(this.u(this.line,'uSquare'),lines.square?1:0);
            gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArraysInstanced(gl.TRIANGLES,0,6,lines.count); gl.disable(gl.BLEND);
        }
        if (material) {
            this.bind(accum); gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(this.carrier.program); gl.bindVertexArray(this.carrierArray);
            gl.bindBuffer(gl.ARRAY_BUFFER,this.carrierData); gl.bufferData(gl.ARRAY_BUFFER,material.data.subarray(0,material.count*24),gl.DYNAMIC_DRAW);
            gl.uniform2f(this.u(this.carrier,'uSize'),cols,rows); gl.uniform1f(this.u(this.carrier,'uDetail'),material.detail);
            gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.drawArraysInstanced(gl.TRIANGLES,0,6,material.count); gl.disable(gl.BLEND);
            this.source(this.resolve,'uSource',accum.texture,0); gl.uniform1f(this.u(this.resolve,'uAmount'),material.amount);
            this.pass(this.resolve,resolved);
            for (const t of [l1[0],l2[0]]) { this.bind(t); gl.clear(gl.COLOR_BUFFER_BIT); }
            if (material.bloom>0 && material.amount>0) {
                this.gatherLayer(resolved,l1[0],material.bloom*2.6,.004,true); this.blur(l1,3,.5);
                this.gatherLayer(l1[0],l2[0],1.5,0,false); this.blur(l2,5,.4);
            }
            for(const [i,t] of [resolved,l1[0],l2[0]].entries()) {
                this.source(this.quantize,'uSource',t.texture,0);gl.uniform1i(this.u(this.quantize,'uPremultiplied'),i===0?1:0);
                this.pass(this.quantize,quantized[i]);
            }
        }
        this.source(this.compose,'uBase',this.base,0); this.source(this.compose,'uLines',lineTarget.texture,1);
        this.source(this.compose,'uL0',quantized[0].texture,2); this.source(this.compose,'uL1',quantized[1].texture,3);
        this.source(this.compose,'uL2',quantized[2].texture,4);
        gl.uniform2f(this.u(this.compose,'uSize'),width,height); gl.uniform1i(this.u(this.compose,'uMaterial'),material?1:0);
        this.pass(this.compose,null); this.check();
    }

    /** Readback is research/quality instrumentation, never required by the rendering path. */
    readPixels(): Uint8Array {
        const gl=this.gl, w=this.canvas.width,h=this.canvas.height, raw=new Uint8Array(w*h*4), out=new Uint8Array(raw.length);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw); this.check();
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
            const s=((h-1-y)*w+x)*4,d=(y*w+x)*4,a=raw[s+3]; out[d+3]=a;
            for(let k=0;k<3;k++) out[d+k]=a?Math.min(255,Math.round(raw[s+k]*255/a)):0;
        }
        return out;
    }
    get targetBytes(): number { return this.targets.reduce((n,t)=>n+t.width*t.height*t.bytes,0); }
    dispose(): void {
        if(this.disposed)return; this.disposed=true;
        const gl=this.gl;
        for(const t of this.targets)gl.deleteFramebuffer(t.buffer);
        for(const t of this.textures)gl.deleteTexture(t);
        for(const b of this.buffers)gl.deleteBuffer(b);
        for(const a of this.arrays)gl.deleteVertexArray(a);
        for(const p of this.programs)gl.deleteProgram(p.program);
    }
    private check(): void { const e=this.gl.getError(); if(e!==this.gl.NO_ERROR)throw Error('WebGL error '+e); }
    private texture(): WebGLTexture {
        const gl=this.gl,t=gl.createTexture(); if(!t)throw Error('Texture allocation failed'); this.textures.push(t);
        gl.bindTexture(gl.TEXTURE_2D,t); for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
        for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE); return t;
    }
    private target(index:number,w:number,h:number,bytes=false):Target {
        const gl=this.gl;
        if(!this.targets[index]) { const texture=this.texture(),buffer=gl.createFramebuffer(); if(!buffer)throw Error('Framebuffer allocation failed');
            // Only additive accumulation may use half precision. Repeated IIR stages stay Float32:
            // half-float rounding there failed the frozen dark-region gate in dense/alpha cases.
            this.targets[index]={texture,buffer,width:0,height:0,bytes:bytes?4:index===0&&this.precision==='float16'?8:16}; }
        const t=this.targets[index];
        if(t.width!==w||t.height!==h) {
            gl.bindTexture(gl.TEXTURE_2D,t.texture);
            const half=index===0&&this.precision==='float16';
            gl.texImage2D(gl.TEXTURE_2D,0,bytes?gl.RGBA8:half?gl.RGBA16F:gl.RGBA32F,w,h,0,gl.RGBA,bytes?gl.UNSIGNED_BYTE:half?gl.HALF_FLOAT:gl.FLOAT,null);
            gl.bindFramebuffer(gl.FRAMEBUFFER,t.buffer); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.texture,0);
            if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete GPU target');
            t.width=w;t.height=h;
        } return t;
    }
    private buffer():WebGLBuffer { const b=this.gl.createBuffer();if(!b)throw Error('Buffer allocation failed');this.buffers.push(b);return b; }
    private geometry(p:Program,data:Float32Array):WebGLVertexArrayObject {
        const gl=this.gl,a=gl.createVertexArray();if(!a)throw Error('Vertex array allocation failed');this.arrays.push(a);gl.bindVertexArray(a);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer());gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.attribute(p,'position',3,0,0,0);return a;
    }
    private attribute(p:Program,name:string,size:number,stride:number,offset:number,divisor:number):void {
        const gl=this.gl,i=gl.getAttribLocation(p.program,name);if(i<0)throw Error('Missing attribute '+name);
        gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(i,divisor);
    }
    private program(vertex:string,fragment:string):Program {
        const gl=this.gl, shaders:WebGLShader[]=[]; let program:WebGLProgram|null=null;
        try {
            for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const) {
                const s=gl.createShader(type);if(!s)throw Error('Shader allocation failed');shaders.push(s);
                gl.shaderSource(s,'#version 300 es\nprecision highp float;\n'+(type===gl.VERTEX_SHADER?'layout(location=0) in vec3 position;\n':'')+source);
                gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'Shader compile failed');
            }
            program=gl.createProgram();if(!program)throw Error('Program allocation failed');for(const s of shaders)gl.attachShader(program,s);gl.linkProgram(program);
            if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Program link failed');
            const p={program,uniforms:new Map()};this.programs.push(p);return p;
        } catch(e) { if(program)gl.deleteProgram(program);throw e; } finally {for(const s of shaders)gl.deleteShader(s);}
    }
    private u(p:Program,name:string):WebGLUniformLocation|null {if(!p.uniforms.has(name))p.uniforms.set(name,this.gl.getUniformLocation(p.program,name));return p.uniforms.get(name)!;}
    private source(p:Program,name:string,t:WebGLTexture,unit:number):void {const gl=this.gl;gl.useProgram(p.program);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(this.u(p,name),unit);}
    private bind(t:Target|null):void {const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,t?.buffer??null);gl.viewport(0,0,t?.width??this.canvas.width,t?.height??this.canvas.height);}
    private pass(p:Program,t:Target|null):void {this.bind(t);this.gl.useProgram(p.program);this.gl.bindVertexArray(this.passArray);this.gl.drawArrays(this.gl.TRIANGLES,0,3);}
    private gatherLayer(source:Target,target:Target,gain:number,threshold:number,premultiplied:boolean):void {
        const p=this.gather,gl=this.gl;this.source(p,'uSource',source.texture,0);
        gl.uniform2i(this.u(p,'uSourceSize'),source.width,source.height);gl.uniform2i(this.u(p,'uTargetSize'),target.width,target.height);
        gl.uniform1f(this.u(p,'uGain'),gain);gl.uniform1f(this.u(p,'uThreshold'),threshold);gl.uniform1i(this.u(p,'uSourcePremultiplied'),premultiplied?1:0);this.pass(p,target);
    }
    private blur(targets:Target[],passes:number,keep:number):void {
        const p=this.blurProgram,gl=this.gl;
        gl.useProgram(p.program);gl.uniform2i(this.u(p,'uSize'),targets[0].width,targets[0].height);gl.uniform1f(this.u(p,'uKeep'),keep);
        for(let i=0;i<passes;i++)for(const [index,direction] of [[1,0],[-1,0],[0,-1],[0,1]].entries()) {
            this.source(p,'uSource',targets[index%2].texture,0);gl.uniform2i(this.u(p,'uDirection'),direction[0],direction[1]);this.pass(p,targets[1-index%2]);
        }
    }
}
