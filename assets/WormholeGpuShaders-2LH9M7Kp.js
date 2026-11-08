var e=Math.sqrt(6*.5/.25),t=Math.sqrt(10*.6/.16),n=`
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
}`,r=`precision highp float;
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
}`,i=`precision highp float; precision highp int;
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
}`,a=`
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
}`,o=`
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
}`,s=`
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
${a}
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
}`,c=`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,l=`
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
}`,u=`
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
}`,d=`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSize;
uniform ivec2 uDirection;
uniform float uSigma;
uniform int uRadius;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 sum = vec4(0.0);
    float weightSum = 0.0;
    for (int i = -20; i <= 20; i++) {
        if (i < -uRadius || i > uRadius) continue;
        float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
        ivec2 q = clamp(p + uDirection * i, ivec2(0), uSize - 1);
        sum += w * texelFetch(uSource, q, 0);
        weightSum += w;
    }
    outColor = sum / weightSum;
}`,f=`
in vec4 aSegment;
in float aWidth;
in vec4 aColor;
uniform vec2 uSize;
out vec2 vLocal;
out float vHalfLength;
out float vHalfWidth;
out float vCoverage;
out vec4 vColor;
void main() {
    vec2 p1 = aSegment.xy, delta = aSegment.zw - aSegment.xy;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 across = vec2(-dir.y, dir.x);
    // Sub-pixel strokes cover one pixel at proportionally lower opacity (like a hairline).
    float halfWidth = max(aWidth, 1.0) * 0.5;
    float reach = halfWidth + 1.0;
    float along = mix(-reach, len + reach, position.x);
    float side = position.y * reach;
    vec2 p = p1 + dir * along + across * side;
    vLocal = vec2(along - 0.5 * len, side);
    vHalfLength = 0.5 * len;
    vHalfWidth = halfWidth;
    vCoverage = min(aWidth, 1.0);
    vColor = aColor;
    // Raster pixels (+y down) to clip space; the target's top row is the canvas's top row.
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`,p=`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform float uSquare;
in vec2 vLocal;
in float vHalfLength;
in float vHalfWidth;
in float vCoverage;
in vec4 vColor;
void main() {
    float distanceOut;
    if (uSquare > 0.5) {
        vec2 q = abs(vLocal) - vec2(vHalfLength + vHalfWidth, vHalfWidth);
        distanceOut = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    } else {
        distanceOut = length(vec2(max(abs(vLocal.x) - vHalfLength, 0.0), vLocal.y)) - vHalfWidth;
    }
    float alpha = vColor.a * clamp(0.5 - distanceOut, 0.0, 1.0) * vCoverage;
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb * alpha, alpha);
}`,m=`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uCanvas;
uniform sampler2D uLines;
uniform float uHasLines;
// 1: uCanvas is the worker's ImageBitmap uploaded ahead (ADR-009 Addendum AE): raw bytes (no sRGB
// decode), premultiplied, top row first (WebGL ignores the flip and premultiply unpack flags for
// ImageBitmaps). 0: the canvas texture (sRGB, straight alpha, bottom row first).
uniform float uCanvasAhead;
vec3 encodeSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 decodeSrgb(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec3 encoded;
    if (uCanvasAhead > 0.5) {
        // Exactly what the canvas texture holds: the same bytes, un-premultiplied, rows flipped.
        vec4 raw = texelFetch(uCanvas, ivec2(p.x, textureSize(uCanvas, 0).y - 1 - p.y), 0);
        encoded = raw.a > 0.0 ? min(raw.rgb / raw.a, vec3(1.0)) : vec3(0.0);
    } else {
        encoded = encodeSrgb(texelFetch(uCanvas, p, 0).rgb);
    }
    if (uHasLines > 0.5) {
        vec4 lines = texelFetch(uLines, p, 0);
        encoded = lines.rgb + encoded * (1.0 - lines.a);
    }
    outColor = vec4(decodeSrgb(clamp(encoded, 0.0, 1.0)), 1.0);
}`;export{o as a,r as c,p as d,f,s as i,n as l,l as m,t as n,u as o,c as p,d as r,i as s,e as t,m as u};