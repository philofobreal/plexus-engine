import{v as e}from"./CosmicWormholeIdentity-D9x8ggGr.js";import{t}from"./store-CtblWEMp.js";function n(e,n){if(e===`automation`){if(t.activeAutomationTransitionId===n)return t.activeVisualTransitionId;t.activeAutomationTransitionId=n}else if(e===`semantic-score`){if(t.activeSemanticScoreTransitionId===n)return t.activeVisualTransitionId;t.activeSemanticScoreTransitionId=n}else{if(t.activeMotifTransitionId===n)return t.activeVisualTransitionId;t.activeMotifTransitionId=n}return t.activeVisualTransitionId=i(t.activeAutomationTransitionId,t.activeSemanticScoreTransitionId,t.activeMotifTransitionId),t.activeVisualTransitionId}function r(){t.activeAutomationTransitionId=null,t.activeSemanticScoreTransitionId=null,t.activeMotifTransitionId=null,t.activeVisualTransitionId=null}function i(e,t,n){let r=e??``;return t&&(r+=`${r?`|`:``}${t}`),n&&(r+=`${r?`|`:``}${n}`),r||null}var a=4,o=600,s=.06,c=.35,l=class{static getBeepModeAtTime(e){let n=t.editedPerformancePlan||t.performancePlan;if(n?.points.length){let r=null,i=-1/0;for(let t of n.points)t.time<=e&&t.time>=i&&(r=t.preset,i=t.time);if(r){let e=t.preloadedPresets[r],n=(e?.visualTuning&&typeof e.visualTuning==`object`?e.visualTuning:null)?.heroBeepMode??e?.heroBeepMode;if(typeof n==`number`&&Number.isFinite(n))return d(n)}}return d(t.targetTuning.heroBeepMode)}static getBeepEventsInWindow(e,n,r){let i=Math.max(0,e.duration||t.duration||0),a=Math.max(0,n),o=Math.min(Math.max(a,r),i);if(o<=a)return[];let s=60/(Number.isFinite(e.bpm)&&e.bpm>0?e.bpm:t.bpm||120),c=Number.isFinite(e.gridOffset)?e.gridOffset:0,l=[];return this.collectPatternEvents(l,1,c,s,a,o,[0],1),this.collectPatternEvents(l,2,c,s,a,o,[.5],1),this.collectPatternEvents(l,3,c,s,a,o,[0,1/3,2/3],1),this.collectPatternEvents(l,4,c,s,a,o,[0,1.5,2.5,3.75],4),l.sort((e,t)=>e.time-t.time),l}static generateStems(e,t){let n=Math.max(0,t.duration||0),r=e.sampleRate,i=Math.max(1,Math.ceil(n*r)),o=Array.from({length:a},()=>e.createBuffer(1,i,r)),s=60/(Number.isFinite(t.bpm)&&t.bpm>0?t.bpm:120),c=Number.isFinite(t.gridOffset)?t.gridOffset:0;return this.renderPattern(o[0],c,s,n,[0],1),this.renderPattern(o[1],c,s,n,[.5],1),this.renderPattern(o[2],c,s,n,[0,1/3,2/3],1),this.renderPattern(o[3],c,s,n,[0,1.5,2.5,3.75],4),o}static collectPatternEvents(e,t,n,r,i,a,o,s){if(r<=0)return;let c=Math.max(0,Math.floor((i-n)/(r*s))-1);for(let l=c*s;;l+=s){let s=!0;for(let c of o){let o=n+(l+c)*r;if(o<i){s=!1;continue}o>a||(s=!1,this.getBeepModeAtTime(o)===t&&e.push({time:o,intensity:1}))}if(n+l*r>a&&s)break}}static renderPattern(e,t,n,r,i,a){if(!(n<=0||r<=0))for(let o=0;;o+=a){let a=!1;for(let s of i){let i=t+(o+s)*n;i<0||i>=r||(this.addBeep(e,i),a=!0)}if(t+o*n>r&&!a)break}}static addBeep(e,t){let n=e.getChannelData(0),r=e.sampleRate,i=Math.max(0,Math.floor(t*r)),a=Math.max(1,Math.floor(s*r)),l=Math.min(n.length,i+a),d=c;for(let e=i;e<l;e++){let t=(e-i)/r,a=Math.exp(-8*t/s),c=Math.sin(2*Math.PI*o*t)*a*d;n[e]=u(n[e]+c)}}};function u(e){return Math.max(-1,Math.min(1,e))}function d(e){return Math.max(0,Math.min(4,Math.round(Number.isFinite(e)?e:0)))}function f(e){if(!e.trackAnalysis?.musicActivity&&!e.trackAnalysis?.rhythmOnsets)return e;let{musicActivity:t,rhythmOnsets:n,...r}=e.trackAnalysis;return{...e,trackAnalysis:r}}function p(e,t){return Number.isFinite(e)&&Number.isFinite(t)&&e>=0&&e<=1&&Math.abs(e-t)<=.1}var m=4096,h=`#version 300 es
in vec2 aCorner;
in vec4 aSegment;
in float aWidth;
in vec4 aColor;
in float aKind;
uniform vec2 uSize;
uniform float uPixelRatio;
out vec2 vLocal;
out float vHalfLength;
out float vHalfWidth;
out float vCoverage;
out float vRadius;
out vec4 vColor;
flat out int vKind;
void main() {
    // Sub-pixel strokes cover one pixel at proportionally lower opacity (like a hairline).
    float halfWidth = max(aWidth, 1.0 / uPixelRatio) * 0.5;
    vHalfWidth = halfWidth;
    vCoverage = min(aWidth * uPixelRatio, 1.0);
    vColor = aColor;
    vKind = int(aKind + 0.5);
    vec2 p;
    if (vKind == 2) {
        float reach = aSegment.z + halfWidth + 1.0;
        vec2 corner = vec2(aCorner.x * 2.0 - 1.0, aCorner.y) * reach;
        vLocal = corner;
        vRadius = aSegment.z;
        vHalfLength = 0.0;
        p = aSegment.xy + corner;
    } else {
        vec2 p1 = aSegment.xy, delta = aSegment.zw - aSegment.xy;
        float len = length(delta);
        vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
        vec2 across = vec2(-dir.y, dir.x);
        float reach = halfWidth + 1.0;
        float along = mix(-reach, len + reach, aCorner.x);
        float side = aCorner.y * reach;
        p = p1 + dir * along + across * side;
        vLocal = vec2(along - 0.5 * len, side);
        vHalfLength = 0.5 * len;
        vRadius = 0.0;
    }
    // Canvas pixels (+y down) to clip space: the canvas's top row is the image's top row.
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`,g=`#version 300 es
precision highp float;
uniform float uPixelRatio;
in vec2 vLocal;
in float vHalfLength;
in float vHalfWidth;
in float vCoverage;
in float vRadius;
in vec4 vColor;
flat in int vKind;
out vec4 outColor;
void main() {
    float distanceOut;
    if (vKind == 2) {
        distanceOut = abs(length(vLocal) - vRadius) - vHalfWidth;
    } else if (vKind == 1) {
        vec2 q = abs(vLocal) - vec2(vHalfLength + vHalfWidth, vHalfWidth);
        distanceOut = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    } else {
        distanceOut = length(vec2(max(abs(vLocal.x) - vHalfLength, 0.0), vLocal.y)) - vHalfWidth;
    }
    float alpha = vColor.a * clamp(0.5 - distanceOut * uPixelRatio, 0.0, 1.0) * vCoverage;
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb * alpha, alpha);
}`,_=`#version 300 es
in vec2 aCorner;
uniform vec4 uRect;
uniform vec2 uSize;
out vec2 vPixel;
out vec2 vUv;
void main() {
    vec2 corner = vec2(aCorner.x, aCorner.y * 0.5 + 0.5);
    vec2 p = uRect.xy + corner * uRect.zw;
    vPixel = p;
    vUv = corner;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`,v=`
uniform vec2 uCenter;
uniform float uInner;
uniform float uOuter;
uniform int uStopCount;
uniform float uStopT[4];
uniform vec4 uStopColor[4];
vec4 gradientAt(vec2 pixel) {
    float t = clamp((length(pixel - uCenter) - uInner) / max(uOuter - uInner, 1e-6), 0.0, 1.0);
    vec4 color = uStopColor[0];
    for (int i = 1; i < 4; i++) {
        if (i >= uStopCount) break;
        float t0 = uStopT[i - 1], t1 = uStopT[i];
        if (t >= t0) color = mix(uStopColor[i - 1], uStopColor[i], t1 > t0 ? clamp((t - t0) / (t1 - t0), 0.0, 1.0) : 1.0);
    }
    return color;
}`,y=`#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
${v}
void main() {
    vec4 c = gradientAt(vPixel);
    outColor = vec4(c.rgb * c.a, c.a);
}`,b=`#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBackdrop;
uniform int uMode;
uniform vec2 uSector;
uniform float uSectorOn;
${v}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
    float l = lum(c), n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
    if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
    if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
    return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
    float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
    return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
float softLight(float b, float s) {
    if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
    float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
    return b + (2.0 * s - 1.0) * (d - b);
}
float overlay(float b, float s) { return b <= 0.5 ? 2.0 * s * b : 1.0 - 2.0 * (1.0 - s) * (1.0 - b); }
vec3 blendColor(vec3 b, vec3 s) {
    if (uMode == 0) return setLum(setSat(b, sat(s)), lum(b));
    if (uMode == 1) return vec3(overlay(b.r, s.r), overlay(b.g, s.g), overlay(b.b, s.b));
    if (uMode == 2) return b + s - b * s;
    return vec3(softLight(b.r, s.r), softLight(b.g, s.g), softLight(b.b, s.b));
}
void main() {
    vec4 dst = texelFetch(uBackdrop, ivec2(gl_FragCoord.xy), 0);
    vec4 src = gradientAt(vPixel);
    if (uSectorOn > 0.5) {
        // Canvas angles grow clockwise on screen (+y down); the wedge runs from start to end.
        float angle = atan(vPixel.y - uCenter.y, vPixel.x - uCenter.x);
        float sweep = mod(angle - uSector.x, 6.28318530718);
        if (sweep > uSector.y) src.a = 0.0;
    }
    float as = src.a, ab = dst.a;
    vec3 cb = ab > 0.0 ? dst.rgb / ab : vec3(0.0);
    vec3 mixed = blendColor(clamp(cb, 0.0, 1.0), src.rgb);
    vec3 co = src.rgb * as * (1.0 - ab) + dst.rgb * (1.0 - as) + as * ab * mixed;
    outColor = vec4(co, as + ab * (1.0 - as));
}`,x=`#version 300 es
precision highp float;
in vec2 vPixel;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uRaster;
void main() { outColor = texture(uRaster, vUv); }`,S=`#version 300 es
in vec2 aPosition;
uniform vec2 uSize;
void main() { gl_Position = vec4(aPosition.x / uSize.x * 2.0 - 1.0, 1.0 - aPosition.y / uSize.y * 2.0, 0.0, 1.0); }`,C=`#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = uColor; }`,w={saturation:0,overlay:1,screen:2,"soft-light":3};function T(e){return Number.isFinite(e)?Math.min(255,Math.max(0,Math.round(e)))/255:0}function E(e){return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}var D=class{canvas;compactMaterialPreview=!0;transparentBackground=!1;frameCount=0;logicalWidth=null;logicalHeight=null;pixelRatio=1;gl;primitiveProgram;gradientProgram;ringProgram;rasterProgram;solidProgram;primitiveVao;quadVao;solidVao;instanceBuffer;cornerBuffer;solidBuffer;primitives=new Float32Array(m*10);primitiveCount=0;backdrop=null;backdropWidth=0;backdropHeight=0;rasters=[0,1,2].map(()=>({texture:null,cols:0,rows:0,buffer:null,pixels:null}));strokeActive=!0;fillActive=!0;strokeR=0;strokeG=0;strokeB=0;strokeA=1;fillR=1;fillG=1;fillB=1;fillA=1;weight=1;shape=[];stopT=new Float32Array(4);stopColor=new Float32Array(16);drawCalls=0;constructor(e,t,n){this.canvas=n(e,t);let r=this.canvas.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!r)throw Error(`WebGL2 is unavailable for the Wormhole background.`);this.gl=r,this.primitiveProgram=this.link(h,g,[`uSize`,`uPixelRatio`]);let i=[`uSize`,`uRect`,`uCenter`,`uInner`,`uOuter`,`uStopCount`,`uStopT`,`uStopColor`];this.gradientProgram=this.link(_,y,i),this.ringProgram=this.link(_,b,[...i,`uBackdrop`,`uMode`,`uSector`,`uSectorOn`]),this.rasterProgram=this.link(_,x,[`uSize`,`uRect`,`uRaster`]),this.solidProgram=this.link(S,C,[`uSize`,`uColor`]);let a=this.cornerBuffer=r.createBuffer();r.bindBuffer(r.ARRAY_BUFFER,a),r.bufferData(r.ARRAY_BUFFER,new Float32Array([0,-1,1,-1,0,1,1,1]),r.STATIC_DRAW),this.instanceBuffer=r.createBuffer(),this.primitiveVao=r.createVertexArray(),r.bindVertexArray(this.primitiveVao),this.cornerAttribute(this.primitiveProgram,a),r.bindBuffer(r.ARRAY_BUFFER,this.instanceBuffer),this.instanceAttribute(this.primitiveProgram,`aSegment`,4,40,0),this.instanceAttribute(this.primitiveProgram,`aWidth`,1,40,16),this.instanceAttribute(this.primitiveProgram,`aColor`,4,40,20),this.instanceAttribute(this.primitiveProgram,`aKind`,1,40,36),this.quadVao=r.createVertexArray(),r.bindVertexArray(this.quadVao),this.cornerAttribute(this.gradientProgram,a),this.solidBuffer=r.createBuffer(),this.solidVao=r.createVertexArray(),r.bindVertexArray(this.solidVao),r.bindBuffer(r.ARRAY_BUFFER,this.solidBuffer);let o=r.getAttribLocation(this.solidProgram.program,`aPosition`);r.enableVertexAttribArray(o),r.vertexAttribPointer(o,2,r.FLOAT,!1,0,0),r.bindVertexArray(null),r.disable(r.DEPTH_TEST),r.disable(r.CULL_FACE),r.enable(r.BLEND),this.sourceOver(),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1)}get width(){return this.logicalWidth??this.canvas.width}get height(){return this.logicalHeight??this.canvas.height}get contextLost(){return this.gl.isContextLost()===!0}setSize(e,t,n=1){this.logicalWidth=Math.max(1,e),this.logicalHeight=Math.max(1,t),this.pixelRatio=Number.isFinite(n)&&n>0?n:1;let r=Math.max(1,Math.round(this.width*this.pixelRatio)),i=Math.max(1,Math.round(this.height*this.pixelRatio));this.canvas.width!==r&&(this.canvas.width=r),this.canvas.height!==i&&(this.canvas.height=i)}get pendingPrimitives(){return this.primitiveCount}background(e,t,n,r=255){this.flush();let i=this.gl,a=this.transparentBackground?0:E(r/255);i.viewport(0,0,this.canvas.width,this.canvas.height),i.clearColor(T(e)*a,T(t)*a,T(n)*a,a),i.clear(i.COLOR_BUFFER_BIT)}noStroke(){this.strokeActive=!1}noFill(){this.fillActive=!1}fill(e,t,n,r=255){this.fillActive=!0,this.fillR=T(e),this.fillG=T(t),this.fillB=T(n),this.fillA=E(r/255)}stroke(e,t,n,r=255){this.strokeActive=!0,this.strokeR=T(e),this.strokeG=T(t),this.strokeB=T(n),this.strokeA=E(r/255)}strokeWeight(e){Number.isFinite(e)&&e>0?this.weight=e:e<=0&&(this.weight=1e-4)}line(e,t,n,r,i){!this.strokeActive||!(this.strokeA>0)||this.push(e,t,n,r,this.weight,this.strokeR,this.strokeG,this.strokeB,this.strokeA,+(i===`square`))}circle(e,t,n){let r=Math.max(0,n);this.fillActive&&this.fillA>0&&r>0&&this.push(e,t,e,t,r,this.fillR,this.fillG,this.fillB,this.fillA,0),this.strokeActive&&this.strokeA>0&&this.push(e,t,r/2,0,this.weight,this.strokeR,this.strokeG,this.strokeB,this.strokeA,2)}triangle(e,t,n,r,i,a){this.beginShape(),this.vertex(e,t),this.vertex(n,r),this.vertex(i,a),this.endShape(!0)}beginShape(){this.shape.length=0}vertex(e,t){Number.isFinite(e)&&Number.isFinite(t)&&this.shape.push(e,t)}endShape(e=!1){let t=this.shape;if(this.fillActive&&this.fillA>0&&t.length>=6){this.beginPass();let e=this.gl,n=[];for(let e=2;e+3<t.length;e+=2)n.push(t[0],t[1],t[e],t[e+1],t[e+2],t[e+3]);e.useProgram(this.solidProgram.program),e.uniform2f(this.solidProgram.uniforms.uSize,this.width,this.height),e.uniform4f(this.solidProgram.uniforms.uColor,this.fillR*this.fillA,this.fillG*this.fillA,this.fillB*this.fillA,this.fillA),e.bindVertexArray(this.solidVao),e.bindBuffer(e.ARRAY_BUFFER,this.solidBuffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array(n),e.STREAM_DRAW),e.drawArrays(e.TRIANGLES,0,n.length/2),this.drawCalls++}if(this.strokeActive&&t.length>=4){for(let e=0;e+3<t.length;e+=2)this.line(t[e],t[e+1],t[e+2],t[e+3]);e&&t.length>=6&&this.line(t[t.length-2],t[t.length-1],t[0],t[1])}t.length=0}radialGlow(e,t,n,r,i){if(!(n>0)||!Number.isFinite(e)||!Number.isFinite(t))return;let a=E(i);this.gradient(e-n,t-n,2*n,2*n,e,t,0,n,[0,T(r[0]),T(r[1]),T(r[2]),a,1,8/255,5/255,14/255,0])}radialDim(e,t,n,r,i){if(!Number.isFinite(e)||!Number.isFinite(t))return;let a=Math.max(0,n),o=Math.max(a+1,r);this.gradient(0,0,this.width,this.height,e,t,a,o,[0,0,0,0,0,1,0,0,0,E(i)])}compositeRingTint(e,t,n,r,i,a,o,s,c){if(!Number.isFinite(e)||!Number.isFinite(t))return;this.beginPass();let l=this.gl,u=this.width,d=this.height,f=this.copyFrame(),p=this.ringProgram;l.useProgram(p.program);let m=T(i[0]),h=T(i[1]),g=T(i[2]),_=E(a);this.setGradient(p,0,0,u,d,e,t,Math.max(0,n),Math.max(Math.max(0,n)+1,r),[0,0,0,0,0,.38,m,h,g,_,.68,m,h,g,_,1,0,0,0,0]),l.activeTexture(l.TEXTURE0),l.bindTexture(l.TEXTURE_2D,f),l.uniform1i(p.uniforms.uBackdrop,0),l.uniform1i(p.uniforms.uMode,w[o]??0);let v=s!==void 0&&c!==void 0&&c>s&&c-s<Math.PI*2;l.uniform2f(p.uniforms.uSector,v?s:0,v?c-s:0),l.uniform1f(p.uniforms.uSectorOn,+!!v),l.disable(l.BLEND),l.bindVertexArray(this.quadVao),l.drawArrays(l.TRIANGLE_STRIP,0,4),l.enable(l.BLEND),this.drawCalls++}beginFieldRaster(e,t,n){let r=Math.floor(t),i=Math.floor(n);if(!(r>0)||!(i>0)||r*i>230400)return null;let a=this.rasters[e];return(!a.buffer||a.cols!==r||a.rows!==i)&&(a.buffer=new Float32Array(r*i*4),a.pixels=new Uint8ClampedArray(r*i*4),a.cols=r,a.rows=i),a.buffer}drawFieldRaster(t,n,r,i,a,o,s){let c=this.rasters[t];if(!c.buffer||!c.pixels||!(i>0)||!(a>0)||!Number.isFinite(n)||!Number.isFinite(r))return;this.beginPass();let l=this.gl;e(c.buffer,c.cols,c.rows,o,c.pixels),c.texture??=this.createTexture(l.LINEAR),l.activeTexture(l.TEXTURE0),l.bindTexture(l.TEXTURE_2D,c.texture),l.texImage2D(l.TEXTURE_2D,0,l.RGBA,c.cols,c.rows,0,l.RGBA,l.UNSIGNED_BYTE,new Uint8Array(c.pixels.buffer,c.pixels.byteOffset,c.pixels.length));let u=this.rasterProgram;l.useProgram(u.program),l.uniform2f(u.uniforms.uSize,this.width,this.height),l.uniform4f(u.uniforms.uRect,n,r,i,a),l.uniform1i(u.uniforms.uRaster,0),s===`lighter`?l.blendFunc(l.ONE,l.ONE):s===`screen`&&l.blendFuncSeparate(l.ONE,l.ONE_MINUS_SRC_COLOR,l.ONE,l.ONE_MINUS_SRC_ALPHA),l.bindVertexArray(this.quadVao),l.drawArrays(l.TRIANGLE_STRIP,0,4),this.sourceOver(),this.drawCalls++}finish(){this.flush(),this.gl.flush()}flush(){let e=this.primitiveCount;if(e===0)return;this.primitiveCount=0;let t=this.gl,n=this.primitiveProgram;t.viewport(0,0,this.canvas.width,this.canvas.height),t.useProgram(n.program),t.uniform2f(n.uniforms.uSize,this.width,this.height),t.uniform1f(n.uniforms.uPixelRatio,this.pixelRatio),t.bindVertexArray(this.primitiveVao),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.bufferData(t.ARRAY_BUFFER,this.primitives.subarray(0,e*10),t.STREAM_DRAW),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,e),this.drawCalls++}dispose(){let e=this.gl;for(let t of this.rasters)t.texture&&e.deleteTexture(t.texture);this.backdrop&&e.deleteTexture(this.backdrop);for(let t of[this.primitiveProgram,this.gradientProgram,this.ringProgram,this.rasterProgram,this.solidProgram])e.deleteProgram(t.program);e.deleteBuffer(this.instanceBuffer),e.deleteBuffer(this.solidBuffer),e.deleteBuffer(this.cornerBuffer),e.deleteVertexArray(this.primitiveVao),e.deleteVertexArray(this.quadVao),e.deleteVertexArray(this.solidVao),e.getExtension(`WEBGL_lose_context`)?.loseContext()}push(e,t,n,r,i,a,o,s,c,l){if(!Number.isFinite(e)||!Number.isFinite(t)||!Number.isFinite(n)||!Number.isFinite(r))return;if(this.primitiveCount*10>=this.primitives.length){let e=new Float32Array(this.primitives.length*2);e.set(this.primitives),this.primitives=e}let u=this.primitives,d=this.primitiveCount++*10;u[d]=e,u[d+1]=t,u[d+2]=n,u[d+3]=r,u[d+4]=i,u[d+5]=a,u[d+6]=o,u[d+7]=s,u[d+8]=c,u[d+9]=l}beginPass(){this.flush(),this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}gradient(e,t,n,r,i,a,o,s,c){this.beginPass();let l=this.gl;l.useProgram(this.gradientProgram.program),this.setGradient(this.gradientProgram,e,t,n,r,i,a,o,s,c),l.bindVertexArray(this.quadVao),l.drawArrays(l.TRIANGLE_STRIP,0,4),this.drawCalls++}setGradient(e,t,n,r,i,a,o,s,c,l){let u=this.gl,d=e.uniforms,f=Math.min(4,l.length/5),p=this.stopT,m=this.stopColor;p.fill(0),m.fill(0);for(let e=0;e<f;e++){p[e]=l[e*5];for(let t=0;t<4;t++)m[e*4+t]=l[e*5+1+t]}u.uniform2f(d.uSize,this.width,this.height),u.uniform4f(d.uRect,t,n,r,i),u.uniform2f(d.uCenter,a,o),u.uniform1f(d.uInner,s),u.uniform1f(d.uOuter,c),u.uniform1i(d.uStopCount,f),u.uniform1fv(d.uStopT,p),u.uniform4fv(d.uStopColor,m)}copyFrame(){let e=this.gl,t=this.canvas.width,n=this.canvas.height;return(!this.backdrop||this.backdropWidth!==t||this.backdropHeight!==n)&&(this.backdrop&&e.deleteTexture(this.backdrop),this.backdrop=this.createTexture(e.NEAREST),e.texStorage2D(e.TEXTURE_2D,1,e.RGBA8,t,n),this.backdropWidth=t,this.backdropHeight=n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.backdrop),e.copyTexSubImage2D(e.TEXTURE_2D,0,0,0,0,0,t,n),this.backdrop}createTexture(e){let t=this.gl,n=t.createTexture();return t.bindTexture(t.TEXTURE_2D,n),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,e),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,e),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),n}sourceOver(){this.gl.blendFuncSeparate(this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA)}cornerAttribute(e,t){let n=this.gl,r=n.getAttribLocation(e.program,`aCorner`);n.bindBuffer(n.ARRAY_BUFFER,t),n.enableVertexAttribArray(r),n.vertexAttribPointer(r,2,n.FLOAT,!1,0,0)}instanceAttribute(e,t,n,r,i){let a=this.gl,o=a.getAttribLocation(e.program,t);a.enableVertexAttribArray(o),a.vertexAttribPointer(o,n,a.FLOAT,!1,r,i),a.vertexAttribDivisor(o,1)}link(e,t,n){let r=this.gl,i=(e,t)=>{let n=r.createShader(e);if(r.shaderSource(n,t),r.compileShader(n),!r.getShaderParameter(n,r.COMPILE_STATUS))throw Error(`Wormhole WebGL shader: ${r.getShaderInfoLog(n)??`compile failed`}`);return n},a=r.createProgram();if(r.attachShader(a,i(r.VERTEX_SHADER,e)),r.attachShader(a,i(r.FRAGMENT_SHADER,t)),r.bindAttribLocation(a,0,`aCorner`),r.linkProgram(a),!r.getProgramParameter(a,r.LINK_STATUS))throw Error(`Wormhole WebGL program: ${r.getProgramInfoLog(a)??`link failed`}`);let o={};for(let e of n)o[e]=r.getUniformLocation(a,e);return{program:a,uniforms:o}}};export{r as a,l as i,p as n,n as o,f as r,D as t};