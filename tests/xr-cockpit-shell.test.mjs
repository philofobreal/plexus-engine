import test from'node:test';import assert from'node:assert/strict';import*as THREE from'three';import{createLoader}from'./helpers/xr-loader.mjs';
const doc={createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*20}),save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(){}})})},load=createLoader({three:THREE},{document:doc});
const{appendCockpitRail,roundedCockpitPath}=load('xr/scene/CockpitGeometry.ts'),{XrCockpit,cockpitEnvelope,cockpitShellContour}=load('xr/scene/XrCockpit.ts'),{resolvePlayProfile}=load('xr/XrPlayProfile.ts');
const key=p=>p.map(v=>Math.round(v*1e5)).join(',');
test('closed nonplanar shell sweep has a welded closing frame and no cap/open/nonmanifold edges',()=>{
 const points=[[-2,2,0],[2,2,0],[2,-1,0],[0,-1.4,-.8],[-2,-1,0],[-2,2,0]],path=roundedCockpitPath(points,.4,3);assert.deepEqual(path[0],path.at(-1));assert.ok(path.length>points.length);
 const b={positions:[],colors:[]};appendCockpitRail(b,points,.3,.2,new THREE.Color('white'),true,.4,3,{edgeRadius:.04});assert.ok(b.positions.every(Number.isFinite));const edges=new Map();
 for(let i=0;i<b.positions.length;i+=9){const p=[0,3,6].map(j=>b.positions.slice(i+j,i+j+3));const area=new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])).cross(new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]))).length();assert.ok(area>1e-8,'no collapsed join triangles');for(const[a,z]of[[0,1],[1,2],[2,0]]){const k=[key(p[a]),key(p[z])].sort().join('|');edges.set(k,(edges.get(k)??0)+1);}}
 assert.ok(edges.size>500);for(const count of edges.values())assert.equal(count,2,'every edge belongs to exactly two faces, including closing seam');
});
test('main shell wraps symmetrically under the runway in Full and Reduced without entering its surface',()=>{
 const c=new XrCockpit(doc);for(const space of['standard','tall'])for(const eye of[1.2,1.95]){const p=resolvePlayProfile({},space);c.fit(p.config,p.stage,eye);const e=cockpitEnvelope(p.config,p.stage,eye),path=cockpitShellContour(e);assert.deepEqual(path[0],path.at(-1));for(const pt of path)assert.ok(path.some(q=>Math.abs(q[0]+pt[0])<1e-8&&q[1]===pt[1]&&q[2]===pt[2]));
 for(const mode of['full','reduced']){c.setSettings(mode,'scroll');const a=c.body.geometry.attributes.position;let floor=0,left=false,right=false;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);if(Math.abs(x)<1.7&&y<.7){assert.ok(y<-.04,'central shell remains below existing floor');floor++;}if(y<.05&&z<e.z-.15){if(x< -1.7)left=true;if(x>1.7)right=true;}}assert.ok(floor>100&&left&&right,'both shoulders connect below the track');}}
 c.dispose();
});
test('inset light channel follows transported shell normal through vertical-to-floor bends',()=>{
 const path=[[0,2,0],[0,0,0],[0,-.3,1],[0,-.3,3]],make=offset=>{const b={positions:[],colors:[]};appendCockpitRail(b,path,.02,.012,new THREE.Color('white'),false,.3,3,{normalOffset:offset});return b.positions;};
 const base=make(0),inset=make(.12);assert.equal(base.length,inset.length);let up=0,forward=0;for(let i=0;i<base.length;i+=3){const delta=new THREE.Vector3(inset[i]-base[i],inset[i+1]-base[i+1],inset[i+2]-base[i+2]);assert.ok(Math.abs(delta.length()-.12)<1e-8,'constant normal gap, no arbitrary axis switch');if(Math.abs(delta.y)>.1)up++;if(Math.abs(delta.z)>.1)forward++;}assert.ok(up>50&&forward>50,'channel turns from wall face to upward floor face');
});

test('major authored sweeps keep fine tangent steps and bounded geometry across viewer heights',()=>{
 const{cockpitShellSweep,cockpitSillSweep,COCKPIT_TANGENT_STEP_RADIANS}=load('xr/scene/XrCockpit.ts');const c=new XrCockpit(doc);
 for(const space of['standard','tall'])for(const eye of[.8,1.65,2.5]){const p=resolvePlayProfile({},space),e=cockpitEnvelope(p.config,p.stage,eye);for(const sweep of[cockpitShellSweep(e),cockpitSillSweep(e,-1),cockpitSillSweep(e,1)]){assert.equal(sweep.points.length,sweep.tangents.length);assert.ok(sweep.points.length<240);for(let i=1;i<sweep.tangents.length;i++){const a=new THREE.Vector3(...sweep.tangents[i-1]),b=new THREE.Vector3(...sweep.tangents[i]);assert.ok(Math.abs(a.length()-1)<1e-8&&Math.abs(b.length()-1)<1e-8);assert.ok(a.angleTo(b)<=COCKPIT_TANGENT_STEP_RADIANS+1e-8,'no small polygonal direction jumps');}}
 c.fit(p.config,p.stage,eye);assert.ok((c.body.geometry.attributes.position.count+c.trim.geometry.attributes.position.count)/3<12000,'fine curves stay in the reviewed static budget');}
 c.dispose();
});
