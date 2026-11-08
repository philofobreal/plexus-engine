(function(){let e=`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;function t(e,t,n,r,i,a=!1){let o=(e,t)=>Number.isSafeInteger(e)&&e>0&&e<=t;if(!o(e,8192)||!o(t,8192)||e*t>3840*2160||!a&&(!(n instanceof Uint8Array)||n.length!==e*t*4))throw Error(`Invalid GPU base image`);let s=(e,t,n)=>{if(!(e instanceof Float32Array)||!Number.isSafeInteger(t)||t<0||t>32768||e.length<t*n)throw Error(`Invalid GPU carrier count`);for(let r=0;r<t*n;r++)if(!Number.isFinite(e[r]))throw Error(`Nonfinite GPU carrier`)};if(i.width!==e||i.height!==t||typeof i.square!=`boolean`)throw Error(`Mismatched GPU line image`);if(s(i.data,i.count,9),r){if(!o(r.cols,640)||!o(r.rows,640)||r.cols*r.rows>640*360||![r.amount,r.bloom,r.detail].every(e=>Number.isFinite(e)&&e>=0&&e<=1))throw Error(`Invalid GPU material surface`);s(r.data,r.count,24)}}var n=class{gl;canvas;precision;programs=[];buffers=[];arrays=[];targets=[];textures=[];carrier;resolve;gather;blurProgram;line;compose;quantize;passArray;carrierArray;lineArray;carrierData;lineData;base;overlay;overlayWidth=0;overlayHeight=0;baseWidth=0;baseHeight=0;disposed=!1;constructor(t,n=`float16`){if(this.canvas=t,this.precision=n,n!==`float16`&&n!==`float32`)throw Error(`Unsupported GPU precision`);let r=t.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!r)throw Error(`WebGL2 unavailable`);this.gl=r;try{if(!r.getExtension(`EXT_color_buffer_float`))throw Error(`Float colour targets unavailable`);if(n===`float32`&&!r.getExtension(`EXT_float_blend`))throw Error(`Float32 blending unavailable`);this.carrier=this.program(`
in vec4 a0;
in vec4 a1;
in vec4 a2;
in vec4 a3;
in vec4 a4;
in vec4 a5;
uniform vec2 uSize;
flat out vec4 v0;
flat out vec4 v1;
flat out vec4 v2;
flat out vec4 v3;
flat out vec4 v4;
flat out vec4 v5;
void main() {
    // A quad covering the capsule (plus one pixel) in carrier-local along / across coordinates.
    vec2 tangent = a0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float reach = a1.y + 1.0;
    float along = -reach + position.x * (a1.x + 2.0 * reach);
    float across = position.y * reach;
    vec2 p = a0.xy + tangent * along + normal * across;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
    v0 = a0; v1 = a1; v2 = a2; v3 = a3; v4 = a4; v5 = a5;
}`,`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform vec2 uSize;
uniform float uDetail;
flat in vec4 v0;
flat in vec4 v1;
flat in vec4 v2;
flat in vec4 v3;
flat in vec4 v4;
flat in vec4 v5;

float hashUnit(uint a, uint b, uint c) {
    uint h = (a * 0x27d4eb2du) ^ (b * 0x165667b1u) ^ (c * 0x9e3779b1u);
    h = (h ^ (h >> 15u)) * 0x85ebca6bu;
    h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
    return float(h ^ (h >> 16u)) / 4294967296.0;
}
uint latticeIndex(float cell) { return uint(int(cell)); }
float valueNoise1(float x, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float cell = floor(safeX);
    float fraction = safeX - cell;
    float smoothed = fraction * fraction * (3.0 - 2.0 * fraction);
    uint c = latticeIndex(cell);
    float low = hashUnit(identity, c, 0u);
    float high = hashUnit(identity, c + 1u, 0u);
    return low + (high - low) * smoothed;
}
float valueNoise2(float x, float y, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float safeY = clamp(y, -1e6, 1e6);
    float cellX = floor(safeX);
    float cellY = floor(safeY);
    float fx = safeX - cellX;
    float fy = safeY - cellY;
    float sx = fx * fx * (3.0 - 2.0 * fx);
    float sy = fy * fy * (3.0 - 2.0 * fy);
    uint cx = latticeIndex(cellX);
    uint cy = latticeIndex(cellY);
    float lowLeft = hashUnit(identity, cx, cy);
    float lowRight = hashUnit(identity, cx + 1u, cy);
    float highLeft = hashUnit(identity, cx, cy + 1u);
    float highRight = hashUnit(identity, cx + 1u, cy + 1u);
    float low = lowLeft + (lowRight - lowLeft) * sx;
    float high = highLeft + (highRight - highLeft) * sx;
    return low + (high - low) * sy;
}
void main() {
    vec2 tail = v0.xy;
    vec2 tangent = v0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float carrierLength = v1.x;
    float radius = v1.y;
    float coreRadius = v1.z;
    float fluxGain = v1.w;
    vec3 color = v2.xyz;
    float haloGain = v2.w;
    uint identity = (uint(v3.x) << 16u) | uint(v3.y);
    float phase = v3.z;
    float filamentPhase = v3.w;
    float fibrePhase = v4.x;
    float filamentFrequency = v4.y;
    float fibreAcross = v4.z;
    float fibreAlong = v4.w;
    float filamentBias = v5.x;
    float filamentFloor = v5.y;
    bool isWeave = mod(v5.z, 2.0) >= 0.5;
    bool filamented = v5.z >= 1.5;
    float negligible = v5.w;

    // Raster pixel centre, +y down from the top row (the CPU raster's convention).
    float relX = gl_FragCoord.x - tail.x;
    float relY = (uSize.y - gl_FragCoord.y) - tail.y;
    float along = relX * tangent.x + relY * tangent.y;
    float across = relX * normal.x + relY * normal.y;
    float beyond = along < 0.0 ? -along : (along > carrierLength ? along - carrierLength : 0.0);
    float distanceSq = across * across + beyond * beyond;
    float radiusSq = radius * radius;
    if (distanceSq > radiusSq) discard;

    float invCoreSq = 1.0 / max(1e-6, coreRadius * coreRadius);
    float invRadiusSq = 1.0 / max(1e-6, radiusSq);
    float coreFalloff = 1.0 - distanceSq * invCoreSq;
    float core = coreFalloff > 0.0 ? coreFalloff * coreFalloff : 0.0;
    float haloFalloff = 1.0 - distanceSq * invRadiusSq;
    float halo = haloFalloff * haloFalloff * haloFalloff * haloGain;
    float shape = core + halo;
    if (shape <= negligible) discard;

    float invLength = carrierLength > 1e-6 ? 1.0 / carrierLength : 0.0;
    float alongUnit = invLength > 0.0 ? clamp(along * invLength, 0.0, 1.0) : 1.0;
    float taper = filamented
        ? (isWeave ? 0.55 + 0.45 * sin(3.141592653589793 * alongUnit) : 0.24 + 0.76 * alongUnit * (0.42 + 0.58 * alongUnit))
        : 1.0;

    float filament = 1.0;
    if (filamented && !isWeave) {
        float coarse = valueNoise1(alongUnit * filamentFrequency + filamentPhase + phase * 0.31, identity);
        float fine = valueNoise1(alongUnit * filamentFrequency * 2.6 + filamentPhase * 1.7 + phase * 0.57, identity ^ 0x5bf03635u);
        float mixed = coarse * 0.63 + fine * 0.37;
        float shaped = clamp((mixed - filamentBias) * (0.9 + 1.15 * uDetail) + 0.5, 0.0, 1.0);
        filament = filamentFloor + (1.0 - filamentFloor) * shaped * shaped * (3.0 - 2.0 * shaped);
    }

    float fibreA = valueNoise2(along * fibreAlong + fibrePhase + phase * 0.44, across * fibreAcross, identity ^ 0x1b873593u);
    float textureValue;
    if (isWeave) {
        textureValue = 0.62 + 0.76 * fibreA;
    } else {
        float fibreB = valueNoise2(along * fibreAlong * 2.7 + fibrePhase * 1.3 + phase * 0.79, across * fibreAcross * 2.7, identity ^ 0x27d4eb2du);
        float micro = 0.86 + 0.28 * valueNoise2(along * 0.9 + phase * 1.13, across * 1.6, identity ^ 0x165667b1u);
        textureValue = (0.5 + 0.72 * (fibreA * 0.64 + fibreB * 0.36)) * micro;
    }

    float contribution = fluxGain * shape * taper * filament * textureValue;
    if (contribution <= 1e-6) discard;
    outColor = vec4(color * contribution, contribution);
}`),this.resolve=this.program(e,`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform float uAmount;
void main() {
    vec4 accumulated = texelFetch(uSource, ivec2(gl_FragCoord.xy), 0);
    float density = max(0.0, accumulated.a);
    if (density <= 1e-8 || uAmount <= 0.0) { outColor = vec4(0.0); return; }
    float invDensity = 1.0 / density;
    float emission = clamp(1.0 - exp(-density * 1.75), 0.0, 1.0);
    float heat = emission * emission * emission;
    float gain = 0.78 + 0.5 * emission;
    vec3 rgb = accumulated.rgb * invDensity * gain;
    float peak = max(rgb.r, max(rgb.g, rgb.b));
    float whiten = heat * 0.12;
    float lift = peak > 1e-6 ? (1.0 - whiten) + whiten * (1.0 / peak) : 1.0;
    vec3 resolved = clamp(rgb * lift, 0.0, 1.0);
    float alpha = clamp(emission * uAmount, 0.0, 1.0);
    outColor = vec4(resolved * alpha, alpha);
}`),this.gather=this.program(e,`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSourceSize;
uniform ivec2 uTargetSize;
uniform float uGain;
uniform float uThreshold;
uniform bool uSourcePremultiplied;
void main() {
    // Work in top-down rows like the CPU raster, then read GL (bottom-up) rows.
    int x = int(gl_FragCoord.x);
    int y = uTargetSize.y - 1 - int(gl_FragCoord.y);
    int sx0 = (x * uSourceSize.x) / uTargetSize.x;
    int sx1 = max(sx0 + 1, ((x + 1) * uSourceSize.x + uTargetSize.x - 1) / uTargetSize.x);
    int sy0 = (y * uSourceSize.y) / uTargetSize.y;
    int sy1 = max(sy0 + 1, ((y + 1) * uSourceSize.y + uTargetSize.y - 1) / uTargetSize.y);
    vec3 weighted = vec3(0.0);
    float emissionSum = 0.0;
    float samples = 0.0;
    for (int dy = 0; dy < 8; dy++) {
        int sy = sy0 + dy;
        if (sy >= sy1 || sy >= uSourceSize.y) break;
        for (int dx = 0; dx < 8; dx++) {
            int sx = sx0 + dx;
            if (sx >= sx1 || sx >= uSourceSize.x) break;
            vec4 s = texelFetch(uSource, ivec2(sx, uSourceSize.y - 1 - sy), 0);
            float emission = clamp(s.a, 0.0, 1.0);
            samples += 1.0;
            if (emission <= 0.0) continue;
            weighted += uSourcePremultiplied ? s.rgb : s.rgb * emission;
            emissionSum += emission;
        }
    }
    if (emissionSum <= 0.0 || samples <= 0.0) { outColor = vec4(0.0); return; }
    float averageEmission = emissionSum / samples;
    if (averageEmission <= uThreshold) { outColor = vec4(0.0); return; }
    float bloomEmission = clamp((averageEmission - uThreshold) * uGain, 0.0, 1.0);
    outColor = vec4(clamp(weighted / emissionSum, 0.0, 1.0), bloomEmission);
}`),this.blurProgram=this.program(e,`precision highp float; precision highp int;
out vec4 outColor;
uniform sampler2D uSource; uniform ivec2 uSize, uDirection; uniform float uKeep;
void main() {
    ivec2 p=ivec2(gl_FragCoord.xy), start=p;
    if(uDirection.x>0)start.x=0;
    if(uDirection.x<0)start.x=uSize.x-1;
    if(uDirection.y>0)start.y=0;
    if(uDirection.y<0)start.y=uSize.y-1;
    int steps=abs(p.x-start.x)+abs(p.y-start.y);
    vec4 value=texelFetch(uSource,start,0);
    for(int i=1;i<640;i++) { if(i>steps)break;value=texelFetch(uSource,start+uDirection*i,0)*uKeep+value*(1.0-uKeep); }
    outColor=value;
}`),this.line=this.program(`
in vec4 aSegment; in float aWidth; in vec4 aColor;
uniform vec2 uSize;
out vec2 vLocal; out float vHalfLength; out float vHalfWidth; out vec4 vColor;
void main() {
    vec2 delta=aSegment.zw-aSegment.xy;float len=length(delta);
    vec2 dir=len>1e-6?delta/len:vec2(1.0,0.0),normal=vec2(-dir.y,dir.x);
    float halfWidth=aWidth*0.5,reach=halfWidth+1.0;
    float along=mix(-reach,len+reach,position.x),side=position.y*reach;
    vec2 p=aSegment.xy+dir*along+normal*side;
    vLocal=vec2(along-0.5*len,side);vHalfLength=0.5*len;vHalfWidth=halfWidth;vColor=aColor;
    gl_Position=vec4(p.x/uSize.x*2.0-1.0,1.0-p.y/uSize.y*2.0,0.0,1.0);
}`,`precision highp float;
out vec4 outColor; uniform float uSquare;
in vec2 vLocal; in float vHalfLength; in float vHalfWidth; in vec4 vColor;
float distanceOut(vec2 p) {
    if(uSquare>0.5){vec2 q=abs(p)-vec2(vHalfLength+vHalfWidth,vHalfWidth);return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
    return length(vec2(max(abs(p.x)-vHalfLength,0.0),p.y))-vHalfWidth;
}
void main() {
    vec2 dx=dFdx(vLocal),dy=dFdy(vLocal);float d=distanceOut(vLocal),coverage=0.0;
    if(d>0.708)discard;
    if(d< -0.708)coverage=1.0;
    else for(int y=0;y<32;y++)for(int x=0;x<32;x++){
        vec2 offset=(vec2(float(x),float(y))+0.5)/32.0-0.5;
        if(distanceOut(vLocal+dx*offset.x+dy*offset.y)<=0.0)coverage+=1.0/1024.0;
    }
    float alpha=vColor.a*coverage;outColor=vec4(vColor.rgb*alpha,alpha);
}`),this.compose=this.program(e,`precision highp float;
out vec4 outColor;
uniform sampler2D uBase, uLines, uL0, uL1, uL2, uOverlay;
uniform vec2 uSize;
uniform bool uMaterial, uHasOverlay;
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
    result=clamp(result,0.0,1.0);
    if(uHasOverlay) {
        vec4 overlay=texelFetch(uOverlay,ivec2(p.x,int(uSize.y)-1-p.y),0);
        overlay.rgb*=overlay.a;
        result=overlay+result*(1.0-overlay.a);
    }
    outColor=result;
}`),this.quantize=this.program(e,`precision highp float; precision highp int;
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
}`),this.passArray=this.geometry(this.resolve,new Float32Array([-1,-1,0,3,-1,0,-1,3,0]));let t=new Float32Array([0,-1,0,1,-1,0,0,1,0,0,1,0,1,-1,0,1,1,0]);this.carrierArray=this.geometry(this.carrier,t),this.carrierData=this.buffer(),r.bindBuffer(r.ARRAY_BUFFER,this.carrierData);for(let e=0;e<6;e++)this.attribute(this.carrier,`a`+e,4,96,e*16,1);this.lineArray=this.geometry(this.line,t),this.lineData=this.buffer(),r.bindBuffer(r.ARRAY_BUFFER,this.lineData),this.attribute(this.line,`aSegment`,4,36,0,1),this.attribute(this.line,`aWidth`,1,36,16,1),this.attribute(this.line,`aColor`,4,36,20,1),this.base=this.texture(),this.overlay=this.texture(),r.disable(r.DEPTH_TEST),r.disable(r.CULL_FACE),r.disable(r.DITHER),r.pixelStorei(r.UNPACK_ALIGNMENT,1),this.check()}catch(e){throw this.dispose(),e}}render(e,n,r,i,a,o,s){if(this.disposed||this.gl.isContextLost())throw Error(`GPU raster unavailable`);if(t(e,n,r,i,a,!!o),o&&(o.width!==e||o.height!==n))throw Error(`Mismatched base canvas`);if(s&&(s.width!==e||s.height!==n))throw Error(`Mismatched overlay canvas`);let c=this.gl;this.canvas.width!==e&&(this.canvas.width=e),this.canvas.height!==n&&(this.canvas.height=n),c.activeTexture(c.TEXTURE0),c.bindTexture(c.TEXTURE_2D,this.base),(this.baseWidth!==e||this.baseHeight!==n)&&(c.texImage2D(c.TEXTURE_2D,0,c.RGBA8,e,n,0,c.RGBA,c.UNSIGNED_BYTE,null),this.baseWidth=e,this.baseHeight=n),o?c.texSubImage2D(c.TEXTURE_2D,0,0,0,c.RGBA,c.UNSIGNED_BYTE,o):c.texSubImage2D(c.TEXTURE_2D,0,0,0,e,n,c.RGBA,c.UNSIGNED_BYTE,r);let l=i?.cols??1,u=i?.rows??1,d=Math.max(1,Math.round(l/3)),f=Math.max(1,Math.round(u/3)),p=Math.max(1,Math.round(l/8)),m=Math.max(1,Math.round(u/8)),h=this.target(0,l,u),g=this.target(1,l,u),_=[this.target(2,d,f),this.target(3,d,f)],v=[this.target(4,p,m),this.target(5,p,m)],y=this.target(6,e,n,!0),b=[this.target(7,l,u,!0),this.target(8,d,f,!0),this.target(9,p,m,!0)];if(this.bind(y),c.clearColor(0,0,0,0),c.clear(c.COLOR_BUFFER_BIT),a.count&&(c.useProgram(this.line.program),c.bindVertexArray(this.lineArray),c.bindBuffer(c.ARRAY_BUFFER,this.lineData),c.bufferData(c.ARRAY_BUFFER,a.data.subarray(0,a.count*9),c.DYNAMIC_DRAW),c.uniform2f(this.u(this.line,`uSize`),e,n),c.uniform1f(this.u(this.line,`uSquare`),+!!a.square),c.enable(c.BLEND),c.blendEquation(c.FUNC_ADD),c.blendFunc(c.ONE,c.ONE_MINUS_SRC_ALPHA),c.drawArraysInstanced(c.TRIANGLES,0,6,a.count),c.disable(c.BLEND)),i){this.bind(h),c.clear(c.COLOR_BUFFER_BIT),c.useProgram(this.carrier.program),c.bindVertexArray(this.carrierArray),c.bindBuffer(c.ARRAY_BUFFER,this.carrierData),c.bufferData(c.ARRAY_BUFFER,i.data.subarray(0,i.count*24),c.DYNAMIC_DRAW),c.uniform2f(this.u(this.carrier,`uSize`),l,u),c.uniform1f(this.u(this.carrier,`uDetail`),i.detail),c.enable(c.BLEND),c.blendFunc(c.ONE,c.ONE),c.drawArraysInstanced(c.TRIANGLES,0,6,i.count),c.disable(c.BLEND),this.source(this.resolve,`uSource`,h.texture,0),c.uniform1f(this.u(this.resolve,`uAmount`),i.amount),this.pass(this.resolve,g);for(let e of[_[0],v[0]])this.bind(e),c.clear(c.COLOR_BUFFER_BIT);i.bloom>0&&i.amount>0&&(this.gatherLayer(g,_[0],i.bloom*2.6,.004,!0),this.blur(_,3,.5),this.gatherLayer(_[0],v[0],1.5,0,!1),this.blur(v,5,.4));for(let[e,t]of[g,_[0],v[0]].entries())this.source(this.quantize,`uSource`,t.texture,0),c.uniform1i(this.u(this.quantize,`uPremultiplied`),+(e===0)),this.pass(this.quantize,b[e])}this.source(this.compose,`uBase`,this.base,0),this.source(this.compose,`uLines`,y.texture,1),this.source(this.compose,`uL0`,b[0].texture,2),this.source(this.compose,`uL1`,b[1].texture,3),this.source(this.compose,`uL2`,b[2].texture,4),c.uniform2f(this.u(this.compose,`uSize`),e,n),c.uniform1i(this.u(this.compose,`uMaterial`),+!!i),c.uniform1i(this.u(this.compose,`uHasOverlay`),+!!s),c.activeTexture(c.TEXTURE5),c.bindTexture(c.TEXTURE_2D,this.overlay);let x=s?e:1,S=s?n:1;(this.overlayWidth!==x||this.overlayHeight!==S)&&(c.texImage2D(c.TEXTURE_2D,0,c.RGBA8,x,S,0,c.RGBA,c.UNSIGNED_BYTE,null),this.overlayWidth=x,this.overlayHeight=S),s&&c.texSubImage2D(c.TEXTURE_2D,0,0,0,c.RGBA,c.UNSIGNED_BYTE,s),c.uniform1i(this.u(this.compose,`uOverlay`),5),this.pass(this.compose,null),this.check()}readPixels(){let e=this.gl,t=this.canvas.width,n=this.canvas.height,r=new Uint8Array(t*n*4),i=new Uint8Array(r.length);e.bindFramebuffer(e.FRAMEBUFFER,null),e.readPixels(0,0,t,n,e.RGBA,e.UNSIGNED_BYTE,r),this.check();for(let e=0;e<n;e++)for(let a=0;a<t;a++){let o=((n-1-e)*t+a)*4,s=(e*t+a)*4,c=r[o+3];i[s+3]=c;for(let e=0;e<3;e++)i[s+e]=c?Math.min(255,Math.round(r[o+e]*255/c)):0}return i}get targetBytes(){return this.targets.reduce((e,t)=>e+t.width*t.height*t.bytes,0)}dispose(){if(this.disposed)return;this.disposed=!0;let e=this.gl;for(let t of this.targets)e.deleteFramebuffer(t.buffer);for(let t of this.textures)e.deleteTexture(t);for(let t of this.buffers)e.deleteBuffer(t);for(let t of this.arrays)e.deleteVertexArray(t);for(let t of this.programs)e.deleteProgram(t.program)}check(){let e=this.gl.getError();if(e!==this.gl.NO_ERROR)throw Error(`WebGL error `+e)}texture(){let e=this.gl,t=e.createTexture();if(!t)throw Error(`Texture allocation failed`);this.textures.push(t),e.bindTexture(e.TEXTURE_2D,t);for(let t of[e.TEXTURE_MIN_FILTER,e.TEXTURE_MAG_FILTER])e.texParameteri(e.TEXTURE_2D,t,e.NEAREST);for(let t of[e.TEXTURE_WRAP_S,e.TEXTURE_WRAP_T])e.texParameteri(e.TEXTURE_2D,t,e.CLAMP_TO_EDGE);return t}target(e,t,n,r=!1){let i=this.gl;if(!this.targets[e]){let t=this.texture(),n=i.createFramebuffer();if(!n)throw Error(`Framebuffer allocation failed`);this.targets[e]={texture:t,buffer:n,width:0,height:0,bytes:r?4:e===0&&this.precision===`float16`?8:16}}let a=this.targets[e];if(a.width!==t||a.height!==n){i.bindTexture(i.TEXTURE_2D,a.texture);let o=e===0&&this.precision===`float16`;if(i.texImage2D(i.TEXTURE_2D,0,r?i.RGBA8:o?i.RGBA16F:i.RGBA32F,t,n,0,i.RGBA,r?i.UNSIGNED_BYTE:o?i.HALF_FLOAT:i.FLOAT,null),i.bindFramebuffer(i.FRAMEBUFFER,a.buffer),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,a.texture,0),i.checkFramebufferStatus(i.FRAMEBUFFER)!==i.FRAMEBUFFER_COMPLETE)throw Error(`Incomplete GPU target`);a.width=t,a.height=n}return a}buffer(){let e=this.gl.createBuffer();if(!e)throw Error(`Buffer allocation failed`);return this.buffers.push(e),e}geometry(e,t){let n=this.gl,r=n.createVertexArray();if(!r)throw Error(`Vertex array allocation failed`);return this.arrays.push(r),n.bindVertexArray(r),n.bindBuffer(n.ARRAY_BUFFER,this.buffer()),n.bufferData(n.ARRAY_BUFFER,t,n.STATIC_DRAW),this.attribute(e,`position`,3,0,0,0),r}attribute(e,t,n,r,i,a){let o=this.gl,s=o.getAttribLocation(e.program,t);if(s<0)throw Error(`Missing attribute `+t);o.enableVertexAttribArray(s),o.vertexAttribPointer(s,n,o.FLOAT,!1,r,i),o.vertexAttribDivisor(s,a)}program(e,t){let n=this.gl,r=[],i=null;try{for(let[i,a]of[[n.VERTEX_SHADER,e],[n.FRAGMENT_SHADER,t]]){let e=n.createShader(i);if(!e)throw Error(`Shader allocation failed`);if(r.push(e),n.shaderSource(e,`#version 300 es
precision highp float;
`+(i===n.VERTEX_SHADER?`layout(location=0) in vec3 position;
`:``)+a),n.compileShader(e),!n.getShaderParameter(e,n.COMPILE_STATUS))throw Error(n.getShaderInfoLog(e)??`Shader compile failed`)}if(i=n.createProgram(),!i)throw Error(`Program allocation failed`);for(let e of r)n.attachShader(i,e);if(n.linkProgram(i),!n.getProgramParameter(i,n.LINK_STATUS))throw Error(n.getProgramInfoLog(i)??`Program link failed`);let a={program:i,uniforms:new Map};return this.programs.push(a),a}catch(e){throw i&&n.deleteProgram(i),e}finally{for(let e of r)n.deleteShader(e)}}u(e,t){return e.uniforms.has(t)||e.uniforms.set(t,this.gl.getUniformLocation(e.program,t)),e.uniforms.get(t)}source(e,t,n,r){let i=this.gl;i.useProgram(e.program),i.activeTexture(i.TEXTURE0+r),i.bindTexture(i.TEXTURE_2D,n),i.uniform1i(this.u(e,t),r)}bind(e){let t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,e?.buffer??null),t.viewport(0,0,e?.width??this.canvas.width,e?.height??this.canvas.height)}pass(e,t){this.bind(t),this.gl.useProgram(e.program),this.gl.bindVertexArray(this.passArray),this.gl.drawArrays(this.gl.TRIANGLES,0,3)}gatherLayer(e,t,n,r,i){let a=this.gather,o=this.gl;this.source(a,`uSource`,e.texture,0),o.uniform2i(this.u(a,`uSourceSize`),e.width,e.height),o.uniform2i(this.u(a,`uTargetSize`),t.width,t.height),o.uniform1f(this.u(a,`uGain`),n),o.uniform1f(this.u(a,`uThreshold`),r),o.uniform1i(this.u(a,`uSourcePremultiplied`),+!!i),this.pass(a,t)}blur(e,t,n){let r=this.blurProgram,i=this.gl;i.useProgram(r.program),i.uniform2i(this.u(r,`uSize`),e[0].width,e[0].height),i.uniform1f(this.u(r,`uKeep`),n);for(let n=0;n<t;n++)for(let[t,n]of[[1,0],[-1,0],[0,-1],[0,1]].entries())this.source(r,`uSource`,e[t%2].texture,0),i.uniform2i(this.u(r,`uDirection`),n[0],n[1]),this.pass(r,e[1-t%2])}};function r(e,t){if(!Number.isSafeInteger(e)||e<0||!Number.isFinite(t)||t<=0||t>240)throw Error(`Invalid exact Wormhole frame index or fps.`);let n=e/t;if(!Number.isFinite(n))throw Error(`Invalid exact Wormhole song time.`);return n}function i(e){if(!e||typeof e!=`object`||Array.isArray(e))throw Error(`Invalid Wormhole frame stamp`);let t=e,n=e=>typeof e==`string`&&e.trim().length>0&&e.length<=128,i=(e,t)=>typeof e==`number`&&Number.isSafeInteger(e)&&e>=t,a=[`protocol`,`contextId`,`generation`,`requestSerial`,`songTime`,`presentationRevision`,`mode`];if(t.protocol!==1||!n(t.contextId)||!i(t.generation,0)||!i(t.requestSerial,1)||!i(t.presentationRevision,0)||typeof t.songTime!=`number`||!Number.isFinite(t.songTime)||t.songTime<0)throw Error(`Invalid Wormhole frame stamp`);if(t.mode===`exact`){if(a.push(`jobId`,`frameIndex`,`fps`,`timestampUs`),!n(t.jobId)||!i(t.frameIndex,0)||t.fps!==30&&t.fps!==60||!i(t.timestampUs,0)||t.songTime!==r(t.frameIndex,t.fps)||t.timestampUs!==Math.round(t.frameIndex*1e6/t.fps))throw Error(`Invalid exact Wormhole frame clock`)}else if(t.mode!==`preview`)throw Error(`Invalid Wormhole frame mode`);if(a.some(e=>!Object.hasOwn(t,e))||Object.keys(t).some(e=>!a.includes(e)))throw Error(`Unknown or missing Wormhole frame stamp field`)}let a=.55;function o(){return{tailX:0,tailY:0,headX:0,headY:0,length:0,invLength:0,tangentX:1,tangentY:0,normalX:0,normalY:1,radius:0,coreRadius:0,flux:0,depositGain:0,colorR:0,colorG:0,colorB:0,haloGain:0,identity:0,phase:0,filamentPhase:0,fibrePhase:0,filamentFrequency:0,fibreAcross:0,fibreAlong:0,filamentBias:0,filamentFloor:0,negligible:0,detail:0,isWeave:!1,filamented:!1}}function s(e,t,n,r,i,o,s){let c=Math.max(1,Math.floor(e)),l=Math.max(1,Math.floor(t));if(!(n>0)||!(r>0))return!1;let u=b(y(i.alpha,0)/255);if(u<=0)return!1;let d=y(i.tailX,0)*c/n,f=y(i.tailY,0)*l/r,p=y(i.headX,0)*c/n,g=y(i.headY,0)*l/r;if(d<-6&&p<-6||d>c+6&&p>c+6||f<-6&&g<-6||f>l+6&&g>l+6)return!1;let _=p-d,v=g-f,x=Math.sqrt(_*_+v*v),S=b(o),C=b(i.depth),w=1-C,T=y(i.weave??0,0)>0,E=b(i.energy),D=Math.max(0,y(i.strokeWeight,0)),O=.5*(c/n+l/r),k=Math.max(.25,D*O),A=b((C-a)/(1-a)),j=1-.6*A*A*(3-2*A),M=u*(.42+.58*E)*j*Math.exp(-2.5*C);if(M<=1e-5)return!1;let N=Math.min(2.6,(.3+1.5*w*w)*(.55+.75*k)),P=T?2.4*(.4+.05*x):.1+2.3*w**2.2,F=(.5+3.4*S)*(.3+.7*Math.sqrt(M))*P,I=Math.min(6,N+F);for(let e=0;e<6&&!((x+2*I+1)*(2*I+1)<=1024||I<=N);e++)I=Math.max(N,I*.72);let L=m(y(i.seed,0),y(i.generation,0)),R=y(i.materialPhase,0),z=x>1e-6?1/x:0,B=h(L,3,17)*Math.PI*2,V=z>0?_*z:Math.cos(B),H=z>0?v*z:Math.sin(B);s.colorR=b(y(i.colorR,0)/255*(.72+.62*w)),s.colorG=b(y(i.colorG,0)/255*(.94-.06*w)),s.colorB=b(y(i.colorB,0)/255*(1.22-.16*w)),s.haloGain=(.1+.4*S)*(.15+.85*w),s.filamentPhase=h(L,11,5)*37,s.fibrePhase=h(L,23,9)*53,s.filamentFrequency=(1.6+4.4*S)*(.7+1.6*C),s.fibreAcross=(.45+.85*S)*(.6+1.3*C),s.fibreAlong=(.12+.18*S)*(.7+.8*C),s.filamentBias=.28+.22*S,s.filamentFloor=T?.3:.6-.3*S;let U=(T?1.6:1.7)/(.5+I*.34);return s.negligible=6e-5/Math.max(1e-6,M*U),s.tailX=d,s.tailY=f,s.headX=p,s.headY=g,s.length=x,s.invLength=z,s.tangentX=V,s.tangentY=H,s.normalX=-H,s.normalY=V,s.radius=I,s.coreRadius=N,s.flux=M,s.depositGain=U,s.identity=L,s.phase=R,s.detail=S,s.isWeave=T,s.filamented=x>1.4,!0}let c=o();function l(e,t,n,r,i,a,o,l){let u=Math.max(1,Math.floor(t)),d=Math.max(1,Math.floor(n)),f=l?.firstRow??0,p=l?.rowCount??d;if(!Number.isSafeInteger(f)||!Number.isSafeInteger(p)||f<0||p<=0||f+p>d||e.length<u*p*4)return;let m=c;if(!s(t,n,r,i,a,o,m))return;let{tailX:h,tailY:v,headX:y,headY:x,length:S,invLength:C,tangentX:w,tangentY:T,normalX:E,normalY:D,radius:O,coreRadius:k,flux:A,depositGain:j,colorR:M,colorG:N,colorB:P,haloGain:F,identity:I,phase:L,filamentPhase:R,fibrePhase:z,filamentFrequency:B,fibreAcross:V,fibreAlong:H,filamentBias:U,filamentFloor:W,negligible:G,isWeave:K,filamented:q}=m,J=m.detail,Y=O*O,ee=1/Math.max(1e-6,Y),te=1/Math.max(1e-6,k*k),X=Math.max(0,Math.floor(Math.min(h,y)-O)),Z=Math.min(u-1,Math.ceil(Math.max(h,y)+O)),ne=Math.max(f,Math.floor(Math.min(v,x)-O)),re=Math.min(f+p-1,Math.ceil(Math.max(v,x)+O)),Q=Math.abs(E)>1e-6&&Math.max(Math.abs(h),Math.abs(v),Math.abs(y),Math.abs(x))<1e7,ie=Q?-D/E:0,$=Q?O/Math.abs(E):0;for(let t=ne;t<=re;t++){let n=t+.5-v,r=h+n*ie-.5,i=Q?Math.max(X,Math.floor(r-$)-1):X,a=Q?Math.min(Z,Math.ceil(r+$)+1):Z;for(let r=i;r<=a;r++){let i=r+.5-h,a=i*w+n*T,o=i*E+n*D,s=a<0?-a:a>S?a-S:0,c=o*o+s*s;if(c>Y)continue;let l=1-c*te,d=l>0?l*l:0,p=1-c*ee,m=d+p*p*p*F;if(m<=G)continue;let v=C>0?b(a*C):1,y=q?K?.55+.45*Math.sin(Math.PI*v):.24+.76*v*(.42+.58*v):1,x=1;if(q&&!K){let e=g(v*B+R+L*.31,I),t=g(v*B*2.6+R*1.7+L*.57,I^1542469173),n=b((e*.63+t*.37-U)*(.9+1.15*J)+.5);x=W+(1-W)*n*n*(3-2*n)}let O=_(a*H+z+L*.44,o*V,I^461845907),k;if(K)k=.62+.76*O;else{let e=_(a*H*2.7+z*1.3+L*.79,o*V*2.7,I^668265261),t=.86+.28*_(a*.9+L*1.13,o*1.6,I^374761393);k=(.5+.72*(O*.64+e*.36))*t}let X=A*m*y*x*k*j;if(X<=1e-6)continue;let Z=((t-f)*u+r)*4;e[Z]+=M*X,e[Z+1]+=N*X,e[Z+2]+=P*X,e[Z+3]+=X}}}function u(e,t,n,r,i,a,o,s,c,l,u){let p=b(l),m=b(u),h=Math.min(Math.floor(e.length/4),Math.max(0,Math.floor(t)*Math.floor(n)));for(let t=0;t<h;t++){let n=t*4,r=Math.max(0,y(e[n+3],0));if(r<=1e-8||p<=0){e[n]=0,e[n+1]=0,e[n+2]=0,e[n+3]=0;continue}let i=1/r,a=b(1-Math.exp(-r*1.75)),o=a*a*a,s=.78+.5*a,c=e[n]*i*s,l=e[n+1]*i*s,u=e[n+2]*i*s,d=Math.max(c,Math.max(l,u)),f=o*.12,m=d>1e-6?1-f+1/d*f:1;e[n]=b(c*m),e[n+1]=b(l*m),e[n+2]=b(u*m),e[n+3]=b(a*p)}r.fill(0),o.fill(0),!(p<=0||m<=0)&&(d(e,t,n,r,i,a,m*2.6,.004),f(r,i,a,3,.5),d(r,i,a,o,s,c,1.5,0),f(o,s,c,5,.4))}function d(e,t,n,r,i,a,o,s){let c=Math.max(1,Math.floor(t)),l=Math.max(1,Math.floor(n)),u=Math.max(1,Math.floor(i)),d=Math.max(1,Math.floor(a));if(!(e.length<c*l*4||r.length<u*d*4))for(let t=0;t<d;t++){let n=Math.floor(t*l/d),i=Math.max(n+1,Math.ceil((t+1)*l/d));for(let a=0;a<u;a++){let d=Math.floor(a*c/u),f=Math.max(d+1,Math.ceil((a+1)*c/u)),p=0,m=0,h=0,g=0,_=0;for(let t=n;t<i&&t<l;t++)for(let n=d;n<f&&n<c;n++){let r=(t*c+n)*4,i=b(e[r+3]);_++,!(i<=0)&&(p+=e[r]*i,m+=e[r+1]*i,h+=e[r+2]*i,g+=i)}if(g<=0||_<=0)continue;let v=g/_;if(v<=s)continue;let y=b((v-s)*o);if(y<=0)continue;let x=(t*u+a)*4,S=1/g;r[x]=b(p*S),r[x+1]=b(m*S),r[x+2]=b(h*S),r[x+3]=y}}}function f(e,t,n,r,i){let a=Math.max(1,Math.floor(t)),o=Math.max(1,Math.floor(n));if(e.length<a*o*4)return;let s=Math.min(.99,Math.max(.01,i)),c=1-s,l=a*4;for(let t=0;t<r;t++){for(let t=0;t<o;t++)p(e,t*l,4,a,s,c);for(let t=0;t<a;t++)p(e,t*4,l,o,s,c)}}function p(e,t,n,r,i,a){let o=t+(r-1)*n,s=e[t],c=e[t+1],l=e[t+2],u=e[t+3];for(let r=t+n;r<=o;r+=n)s=e[r]*i+s*a,c=e[r+1]*i+c*a,l=e[r+2]*i+l*a,u=e[r+3]*i+u*a,e[r]=s,e[r+1]=c,e[r+2]=l,e[r+3]=u;s=e[o],c=e[o+1],l=e[o+2],u=e[o+3];for(let r=o-n;r>=t;r-=n)s=e[r]*i+s*a,c=e[r+1]*i+c*a,l=e[r+2]*i+l*a,u=e[r+3]*i+u*a,e[r]=s,e[r+1]=c,e[r+2]=l,e[r+3]=u}function m(e,t){let n=Math.round(v(e,-1e6,1e6)*1024)|0,r=Math.floor(v(t,-1e9,1e9))|0;return Math.imul(n,668265261)^Math.imul(r,2654435761)|0}function h(e,t,n){let r=Math.imul(e|0,668265261)^Math.imul(t|0,374761393)^Math.imul(n|0,2654435761)|0;return r=Math.imul(r^r>>>15,2246822507)|0,r=Math.imul(r^r>>>13,3266489909)|0,((r^r>>>16)>>>0)/4294967296}function g(e,t){let n=v(e,-1e6,1e6),r=Math.floor(n),i=n-r,a=i*i*(3-2*i),o=h(t,r,0);return o+(h(t,r+1,0)-o)*a}function _(e,t,n){let r=v(e,-1e6,1e6),i=v(t,-1e6,1e6),a=Math.floor(r),o=Math.floor(i),s=r-a,c=i-o,l=s*s*(3-2*s),u=c*c*(3-2*c),d=h(n,a,o),f=h(n,a+1,o),p=h(n,a,o+1),m=h(n,a+1,o+1),g=d+(f-d)*l;return g+(p+(m-p)*l-g)*u}function v(e,t,n){return Math.min(n,Math.max(t,y(e,0)))}function y(e,t){return Number.isFinite(e)?e:t}function b(e){return Math.min(1,Math.max(0,y(e,0)))}let x=S();function S(){let e=new Float32Array(64);for(let t=0;t<8;t++)for(let n=0;n<8;n++){let r=n^t,i=0;for(let e=2;e>=0;e--)i=i<<1|t>>e&1,i=i<<1|r>>e&1;e[t*8+n]=i/64-.5}return e}function C(e,t,n,r,i){let a=Number.isFinite(r)?r:0,o=0;for(let r=0;r<n;r++){let n=(r&7)*8;for(let r=0;r<t;r++){let t=x[n+(r&7)];i[o]=e[o]*a*255+t,i[o+1]=e[o+1]*a*255+t,i[o+2]=e[o+2]*a*255+t,i[o+3]=e[o+3]*a*255+t,o+=4}}}function w(){if(typeof document>`u`)throw Error(`Field raster surface requires a DOM canvas factory.`);return document.createElement(`canvas`)}function T(){return{cols:0,rows:0,buffer:null,canvas:null,ctx:null,imageData:null,allocationCount:0,resizeCount:0}}var E=class{createCanvas;layers;constructor(e=w){this.createCanvas=e,this.layers=[];for(let e=0;e<3;e++)this.layers.push(T())}bufferAllocationCount(e){return this.layers[e].allocationCount}bufferResizeCount(e){return this.layers[e].resizeCount}beginFieldRaster(e,t,n){let r=Math.floor(t),i=Math.floor(n);if(!(r>0)||!(i>0)||r*i>230400)return null;let a=this.layers[e],o=!a.buffer||!a.canvas,s=a.cols!==r||a.rows!==i;return o?(a.buffer=new Float32Array(r*i*4),a.canvas=this.createCanvas(),a.canvas.width=r,a.canvas.height=i,a.ctx=a.canvas.getContext(`2d`),a.imageData=a.ctx?a.ctx.createImageData(r,i):null,a.allocationCount++,a.resizeCount++,a.cols=r,a.rows=i):s&&(a.buffer=new Float32Array(r*i*4),a.canvas.width=r,a.canvas.height=i,a.ctx=a.canvas.getContext(`2d`),a.imageData=a.ctx?a.ctx.createImageData(r,i):null,a.resizeCount++,a.cols=r,a.rows=i),a.buffer}drawFieldRaster(e,t,n,r,i,a,o,s){let c=this.layers[e];if(!c.buffer||!c.canvas||!c.ctx||!c.imageData||!(i>0)||!(a>0)||!Number.isFinite(n)||!Number.isFinite(r))return;C(c.buffer,c.cols,c.rows,o,c.imageData.data),c.ctx.putImageData(c.imageData,0,0);let l=s===`screen`||s===`lighter`||s===`source-over`?s:`source-over`;t.save();try{t.imageSmoothingEnabled=!0,t.globalCompositeOperation=l,t.drawImage(c.canvas,0,0,c.cols,c.rows,n,r,i,a)}finally{t.restore(),t.globalCompositeOperation=`source-over`}}};let D=Object.freeze({TAIL_X:0,TAIL_Y:1,TANGENT_X:2,TANGENT_Y:3,LENGTH:4,RADIUS:5,CORE_RADIUS:6,FLUX_GAIN:7,COLOR_R:8,COLOR_G:9,COLOR_B:10,HALO_GAIN:11,IDENTITY_HI:12,IDENTITY_LO:13,PHASE:14,FILAMENT_PHASE:15,FIBRE_PHASE:16,FILAMENT_FREQUENCY:17,FIBRE_ACROSS:18,FIBRE_ALONG:19,FILAMENT_BIAS:20,FILAMENT_FLOOR:21,FLAGS:22,NEGLIGIBLE:23});var O=class{data=new Float32Array(1024*24);count=0;active=!1;cols=0;rows=0;viewportWidth=0;viewportHeight=0;detail=0;amount=0;bloom=0;prepared=o();reset(){this.active=!1,this.count=0}begin(e,t,n,r,i,a,o){this.active=!0,this.count=0,this.cols=Math.max(1,Math.floor(e)),this.rows=Math.max(1,Math.floor(t)),this.viewportWidth=n,this.viewportHeight=r,this.detail=i,this.amount=a,this.bloom=o}carrier(e){if(!this.active)return;let t=this.prepared;if(!s(this.cols,this.rows,this.viewportWidth,this.viewportHeight,e,this.detail,t))return;if((this.count+1)*24>this.data.length){let e=new Float32Array(this.data.length*2);e.set(this.data),this.data=e}let n=this.count*24,r=this.data;r[n+D.TAIL_X]=t.tailX,r[n+D.TAIL_Y]=t.tailY,r[n+D.TANGENT_X]=t.tangentX,r[n+D.TANGENT_Y]=t.tangentY,r[n+D.LENGTH]=t.length,r[n+D.RADIUS]=t.radius,r[n+D.CORE_RADIUS]=t.coreRadius,r[n+D.FLUX_GAIN]=t.flux*t.depositGain,r[n+D.COLOR_R]=t.colorR,r[n+D.COLOR_G]=t.colorG,r[n+D.COLOR_B]=t.colorB,r[n+D.HALO_GAIN]=t.haloGain,r[n+D.IDENTITY_HI]=t.identity>>>16&65535,r[n+D.IDENTITY_LO]=t.identity&65535,r[n+D.PHASE]=t.phase,r[n+D.FILAMENT_PHASE]=t.filamentPhase,r[n+D.FIBRE_PHASE]=t.fibrePhase,r[n+D.FILAMENT_FREQUENCY]=t.filamentFrequency,r[n+D.FIBRE_ACROSS]=t.fibreAcross,r[n+D.FIBRE_ALONG]=t.fibreAlong,r[n+D.FILAMENT_BIAS]=t.filamentBias,r[n+D.FILAMENT_FLOOR]=t.filamentFloor,r[n+D.FLAGS]=+!!t.isWeave+(t.filamented?2:0),r[n+D.NEGLIGIBLE]=t.negligible,this.count++}get frame(){return this.active?{cols:this.cols,rows:this.rows,amount:this.amount,bloom:this.bloom,detail:this.detail,count:this.count,data:this.data}:null}};let k=Object.freeze([`headX`,`headY`,`tailX`,`tailY`,`alpha`,`strokeWeight`,`colorR`,`colorG`,`colorB`,`seed`,`generation`,`materialPhase`,`energy`,`depth`,`weave`]),A=self,j=null,M=0,N=new OffscreenCanvas(1,1),P=N.getContext(`2d`),F=new E(()=>new OffscreenCanvas(1,1)),I=new OffscreenCanvas(1,1),L=I.getContext(`2d`),R=new O;function z(e,t){e.globalCompositeOperation=`source-over`,e.lineCap=t.square?`square`:`round`;for(let n=0;n<t.count*9;n+=9){let r=t.data;e.lineWidth=r[n+4],e.strokeStyle=`rgba(${Math.round(r[n+5]*255)},${Math.round(r[n+6]*255)},${Math.round(r[n+7]*255)},${r[n+8]})`,e.beginPath(),e.moveTo(r[n],r[n+1]),e.lineTo(r[n+2],r[n+3]),e.stroke()}}function B(e){let{width:t,height:n,base:r,material:i,lines:a,raw:o}=e;if(N.width!==t&&(N.width=t),N.height!==n&&(N.height=n),P.putImageData(new ImageData(new Uint8ClampedArray(r),t,n),0,0),z(P,a),!i)return;let{cols:s,rows:c}=i,d=Math.max(1,Math.round(s/3)),f=Math.max(1,Math.round(c/3)),p=Math.max(1,Math.round(s/8)),m=Math.max(1,Math.round(c/8)),h=F.beginFieldRaster(0,s,c),g=F.beginFieldRaster(1,d,f),_=F.beginFieldRaster(2,p,m);h.fill(0);let v={};for(let e=0;e<o.length;e+=15)k.forEach((t,n)=>{v[t]=o[e+n]}),l(h,s,c,t,n,v,i.detail);u(h,s,c,g,d,f,_,p,m,i.amount,i.bloom);for(let e of[2,1,0])F.drawFieldRaster(e,P,0,0,t,n,1,`lighter`)}A.onmessage=({data:e})=>{try{if(e.protocol!==1||!Number.isSafeInteger(e.id)||e.id<=M)throw Error(`Invalid research request`);if(M=e.id,i(e.stamp),e.action){if(e.action!==`lose-context`&&e.action!==`dispose`)throw Error(`Unknown research action`);let t=e.action===`lose-context`?j?.gl.getExtension(`WEBGL_lose_context`):null;t?.loseContext(),j?.dispose(),j=null,A.postMessage({protocol:1,id:e.id,stamp:e.stamp,pass:!0,action:e.action,contextLoss:!!t});return}if(!(e.raw instanceof Float64Array)||e.raw.length%15||e.raw.length>32768*15||!e.raw.every(Number.isFinite))throw Error(`Invalid raw reference`);let t=performance.now();(!j||j.precision!==e.precision)&&(j?.dispose(),j=new n(new OffscreenCanvas(1,1),e.precision));let r=performance.now()-t,a=j.gl,o=[],s,c=()=>{let t=e.material;if(t){R.begin(t.cols,t.rows,e.width,e.height,t.detail,t.amount,t.bloom);let n={};for(let t=0;t<e.raw.length;t+=15)k.forEach((r,i)=>{n[r]=e.raw[t+i]}),R.carrier(n);if(t=R.frame,!t||t.count!==e.material.count)throw Error(`Prepared carrier mismatch`)}e.cpuLines&&(I.width!==e.width&&(I.width=e.width),I.height!==e.height&&(I.height=e.height),L.putImageData(new ImageData(new Uint8ClampedArray(e.base),e.width,e.height),0,0),z(L,e.lines)),j.render(e.width,e.height,e.base,t,e.cpuLines?{...e.lines,count:0}:e.lines,e.cpuLines?I:void 0)};for(let t=0;t<4;t++){let n=0,r=0,i=0,l=()=>{let t=performance.now();B(e),n=performance.now()-t},u=()=>{let e=performance.now();c(),r=performance.now()-e,a.finish(),i=performance.now()-e};t%2?(l(),u()):(u(),l()),t?o.push({cpuMs:n,issueMs:r,completedMs:i}):s={cpuMs:n,issueMs:r,completedMs:i}}c(),a.finish();let l=performance.now(),u=j.readPixels(),d=performance.now()-l,f=performance.now(),p=j.canvas.transferToImageBitmap(),m=performance.now()-f,h=P.getImageData(0,0,e.width,e.height).data,g=a.getExtension(`WEBGL_debug_renderer_info`);A.postMessage({protocol:1,id:e.id,stamp:e.stamp,pass:!0,pixels:u,cpuPixels:h,bitmap:p,initializationMs:r,warmup:s,samples:o,readbackMs:d,bitmapMs:m,targetBytes:j.targetBytes,renderer:g?a.getParameter(g.UNMASKED_RENDERER_WEBGL):a.getParameter(a.RENDERER),worker:!0},[u.buffer,h.buffer,p])}catch(t){j?.dispose(),j=null,A.postMessage({protocol:1,id:e?.id,stamp:e?.stamp,pass:!1,error:String(t)})}}})();