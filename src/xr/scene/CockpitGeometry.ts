import * as THREE from 'three';

export type CockpitPoint = readonly [number, number, number];
export interface CockpitBatch { positions: number[]; colors: number[] }
type Vertex = { p: number[]; n: number[]; gain?: number };
const LIGHT = new THREE.Vector3(.16, .5, .85).normalize();

/** Round only the joins; the long straight/chamfered segments retain the authored silhouette. */
export function roundedCockpitPath(points: readonly CockpitPoint[], cut = .22, steps = 3): CockpitPoint[] {
    if (points.length < 3) return [...points];
    const closed = new THREE.Vector3(...points[0]).distanceToSquared(new THREE.Vector3(...points.at(-1)!)) < 1e-12;
    if (closed) {
        // Round the closing corner too. The duplicate endpoint then has exactly the same frame.
        const loop = points.slice(0, -1), out: CockpitPoint[] = [];
        for (let i = 0; i < loop.length; i++) {
            const part = roundedCockpitPath([loop[(i+loop.length-1)%loop.length],loop[i],loop[(i+1)%loop.length]],cut,steps);
            out.push(...part.slice(1,-1));
        }
        out.push(out[0]); return out;
    }
    const out: CockpitPoint[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const a = new THREE.Vector3(...points[i - 1]), p = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
        const incoming = p.clone().sub(a), outgoing = b.clone().sub(p);
        const d = Math.min(cut, incoming.length() * .32, outgoing.length() * .32);
        if (d <= 1e-6 || incoming.clone().normalize().dot(outgoing.clone().normalize()) > .9999) { out.push(points[i]); continue; }
        const start = p.clone().addScaledVector(incoming.normalize(), -d), end = p.clone().addScaledVector(outgoing.normalize(), d);
        out.push([start.x, start.y, start.z]);
        for (let j = 1; j <= steps; j++) {
            const t = j / steps, u = 1 - t;
            out.push([u*u*start.x+2*u*t*p.x+t*t*end.x, u*u*start.y+2*u*t*p.y+t*t*end.y, u*u*start.z+2*u*t*p.z+t*t*end.z]);
        }
    }
    out.push(points.at(-1)!); return out;
}

function triangle(batch: CockpitBatch, a: Vertex, b: Vertex, c: Vertex, color: THREE.Color, lit: boolean): void {
    const ab = b.p.map((v,i)=>v-a.p[i]), ac = c.p.map((v,i)=>v-a.p[i]);
    const cross = [ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    if (cross.reduce((s,v,i)=>s+v*(a.n[i]+b.n[i]+c.n[i]),0) < 0) [b,c] = [c,b];
    for (const v of [a,b,c]) {
        batch.positions.push(...v.p);
        const shade = (lit ? .43 + .57 * Math.max(0,v.n[0]*LIGHT.x+v.n[1]*LIGHT.y+v.n[2]*LIGHT.z) : 1)*(v.gain??1);
        batch.colors.push(color.r*shade,color.g*shade,color.b*shade);
    }
}

/** A joined rail with a rounded rectangular section. Geometry is built only at layout changes. */
export function appendCockpitRail(batch: CockpitBatch, points: readonly CockpitPoint[], width: number, depth: number,
    color: THREE.Color, lit = true, cut = .22, cornerSteps = 3,
    profile: { edgeRadius?: number; widthAt?: (point: CockpitPoint) => number; depthAt?: (point: CockpitPoint) => number;
        gainAt?: (point: CockpitPoint) => number;
        normalOffset?: number | ((point: CockpitPoint) => number);
        tangents?: readonly CockpitPoint[] } = {}): void {
    // Authored continuous splines already supply their exact tangent at each sample.
    const path = profile.tangents ? [...points] : roundedCockpitPath(points, cut, cornerSteps);
    const closed = new THREE.Vector3(...path[0]).distanceToSquared(new THREE.Vector3(...path.at(-1)!)) < 1e-12;
    const last = path.length-1;
    const tangents = path.map((_,i) => {
        if(profile.tangents) return new THREE.Vector3(...profile.tangents[i]).normalize();
        const prev = new THREE.Vector3(...path[closed?(i+last-1)%last:Math.max(0,i-1)]);
        const next = new THREE.Vector3(...path[closed?(i+1)%last:Math.min(last,i+1)]);
        return next.sub(prev).normalize();
    });
    // A transported frame follows the sweep continuously through wall-to-floor bends.
    // Choosing an arbitrary world axis at each ring introduces visible quarter-turns.
    const axis = Math.abs(tangents[0].z)<.95 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
    const sides = [new THREE.Vector3().crossVectors(tangents[0],axis).normalize()];
    for(let i=1;i<path.length;i++) sides.push(sides[i-1].clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(tangents[i-1],tangents[i])));
    if(closed) {
        const roll = Math.atan2(new THREE.Vector3().crossVectors(sides[last],sides[0]).dot(tangents[0]),sides[last].dot(sides[0]));
        for(let i=1;i<=last;i++) sides[i].applyAxisAngle(tangents[i],roll*i/last);
        sides[last].copy(sides[0]);
    }
    // Subpixel light strips need only a bevel; the wider shaded body keeps rounded edges.
    const sectionSteps = lit ? 2 : 1;
    const rings: Vertex[][] = [];
    for (let i = 0; i < path.length; i++) {
        const hw = (profile.widthAt?.(path[i]) ?? width)/2, hd = (profile.depthAt?.(path[i]) ?? depth)/2;
        const radius = Math.min(profile.edgeRadius??.026,hw*.48,hd*.48);
        const corners = [[hw-radius,hd-radius],[-hw+radius,hd-radius],[-hw+radius,-hd+radius],[hw-radius,-hd+radius]];
        const section: {u:number;v:number;nu:number;nv:number}[] = [];
        for(let k=0;k<4;k++)for(let j=0;j<=sectionSteps;j++){
            const angle=k*Math.PI/2+j*Math.PI/(2*sectionSteps),nu=Math.cos(angle),nv=Math.sin(angle);
            section.push({u:corners[k][0]+radius*nu,v:corners[k][1]+radius*nv,nu,nv});
        }
        const side = sides[i], normal = new THREE.Vector3().crossVectors(side,tangents[i]).normalize();
        const offset=typeof profile.normalOffset==='function'?profile.normalOffset(path[i]):profile.normalOffset??0;
        rings.push(section.map(s=>({p:[path[i][0]+side.x*s.u+normal.x*(s.v+offset),path[i][1]+side.y*s.u+normal.y*(s.v+offset),path[i][2]+side.z*s.u+normal.z*(s.v+offset)],
            n:[side.x*s.nu+normal.x*s.nv,side.y*s.nu+normal.y*s.nv,side.z*s.nu+normal.z*s.nv],gain:profile.gainAt?.(path[i])})));
    }
    const sectionCount = rings[0].length;
    for (let i = 1; i < rings.length; i++) for (let j = 0; j < sectionCount; j++) {
        const k = (j+1)%sectionCount;
        triangle(batch,rings[i-1][j],rings[i][j],rings[i][k],color,lit);
        triangle(batch,rings[i-1][j],rings[i][k],rings[i-1][k],color,lit);
    }
    for (const i of closed?[]:[0,rings.length-1]) {
        const sign = i===0?-1:1, n = tangents[i].toArray().map(v=>v*sign);
        const gain=rings[i][0].gain,center = {p:[0,1,2].map(k=>rings[i].reduce((sum,v)=>sum+v.p[k],0)/sectionCount),n,gain};
        for (let j = 0; j < sectionCount; j++) triangle(batch,center,{p:rings[i][j].p,n,gain},{p:rings[i][(j+1)%sectionCount].p,n,gain},color,lit);
    }
}

/** Rounded polygon plus a short bevel: title pod and inset window, merged into the body batch. */
export function appendCockpitPanel(batch: CockpitBatch, points: readonly (readonly [number,number])[], z: number, depth: number,
    color: THREE.Color, radius = .06, bevel = .018): void {
    const shape = new THREE.Shape();
    points.forEach((p,i)=>{
        const prev = new THREE.Vector2(...points[(i+points.length-1)%points.length]), next = new THREE.Vector2(...points[(i+1)%points.length]), at = new THREE.Vector2(...p);
        const incoming = at.clone().sub(prev), outgoing = next.sub(at), cut = Math.min(radius,incoming.length()*.3,outgoing.length()*.3);
        const start = at.clone().addScaledVector(incoming.normalize(),-cut), end = at.clone().addScaledVector(outgoing.normalize(),cut);
        if(i===0)shape.moveTo(start.x,start.y);else shape.lineTo(start.x,start.y);
        shape.quadraticCurveTo(at.x,at.y,end.x,end.y);
    });shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:3});
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    for(let i=0;i<p.count;i+=3){const v=(j:number):Vertex=>({p:[p.getX(j),p.getY(j),p.getZ(j)+z],n:[n.getX(j),n.getY(j),n.getZ(j)]});triangle(batch,v(i),v(i+1),v(i+2),color,true);}
    geometry.dispose();
}
