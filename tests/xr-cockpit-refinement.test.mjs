import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';import{createLoader}from'./helpers/xr-loader.mjs';
const contexts=[];const doc={createElement(){const c={font:'',measureText:t=>({width:Array.from(t).length*20}),fillText(){},save(){},restore(){},beginPath(){},rect(){},clip(){}};contexts.push(c);return{width:0,height:0,getContext:()=>c};}};
const load=createLoader({three:THREE},{document:doc});const{XrCockpit,cockpitEnvelope,COCKPIT_TITLE_DROP_METERS}=load('xr/scene/XrCockpit.ts');const{resolvePlayProfile}=load('xr/XrPlayProfile.ts');const{roundedCockpitPath,appendCockpitRail}=load('xr/scene/CockpitGeometry.ts');
test('rounded rail joins retain straight spans, endpoints and finite bounded static geometry',()=>{
 const points=[[-2,0,0],[0,0,0],[0,2,0]],path=roundedCockpitPath(points);assert.deepEqual(path[0],points[0]);assert.deepEqual(path.at(-1),points.at(-1));assert.ok(path.length>points.length);assert.ok(path.some(p=>p[0]<0&&p[0]>-.22&&p[1]>0&&p[1]<.22));assert.ok(!path.some(p=>p.every(v=>v===0)));
 const batch={positions:[],colors:[]};appendCockpitRail(batch,points,.24,.34,new THREE.Color('white'));assert.ok(batch.positions.every(Number.isFinite));assert.equal(batch.positions.length,batch.colors.length);assert.ok(new Set(batch.colors.map(v=>v.toFixed(4))).size>3,'baked rounded edge shading');assert.ok(batch.positions.length/9<300);
});
test('stepped title descends while its ink stays in front of the recessed pod and frame',()=>{
 const c=new XrCockpit(doc);for(const space of['standard','tall'])for(const eye of[1.2,1.65,1.95]){const p=resolvePlayProfile({},space);c.fit(p.config,p.stage,eye);const e=cockpitEnvelope(p.config,p.stage,eye),pos=c.title.mesh.position;assert.equal(COCKPIT_TITLE_DROP_METERS,.245);assert.ok(Math.abs(pos.y-(e.top+.075-.245))<1e-8);
 let max=-Infinity,count=0;for(const mesh of[c.body,c.trim]){const a=mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i))<1.15&&Math.abs(a.getY(i)-pos.y)<.23&&a.getZ(i)<e.z+.7&&a.getZ(i)>e.z-.5){max=Math.max(max,a.getZ(i));count++;}}assert.ok(count>100);assert.ok(pos.z-max>.045,`real depth gap ${pos.z-max}`);}
 c.dispose();
});
test('rounded central pod keeps the above and side HUD rectangles unoccluded',()=>{
 const c=new XrCockpit(doc),ray=new THREE.Raycaster(),camera=new THREE.Vector3(),target=new THREE.Vector3();let checks=0;
 for(const space of['standard','tall'])for(const eye of[1.2,1.95]){const p=resolvePlayProfile({},space);c.fit(p.config,p.stage,eye);c.root.updateMatrixWorld(true);const middle=Math.max(.7,eye-.55),hud=new THREE.Object3D();
 if(p.stage.hudPlacement==='side'){hud.position.set(-1.55,middle+p.stage.frameCenterYMeters+.05,-p.stage.playfieldForwardMeters-1);hud.rotation.y=.55;hud.scale.setScalar(.72);}else hud.position.set(0,eye+1.15,-p.stage.playfieldForwardMeters-2.8);hud.updateMatrixWorld(true);
 for(const x of[-.625,0,.625])for(const y of[-.3125,0,.3125])for(const cx of[-.25,.25]){camera.set(cx,eye,0);target.copy(hud.localToWorld(new THREE.Vector3(x,y,0)));const dir=target.clone().sub(camera);ray.set(camera,dir.clone().normalize());ray.far=dir.length()-.01;assert.equal(ray.intersectObjects([c.body,c.trim],false).length,0,`${space} ${eye} HUD ${x}/${y}`);checks++;}}
 assert.equal(checks,72);c.dispose();
});
test('marquee shares instrument typography and ink and samples alpha with continuous mip gradients',()=>{
 const{XrTrackMarquee}=load('xr/scene/XrTrackMarquee.ts'),{XR_INSTRUMENT_FONT,XR_INSTRUMENT_INK}=load('xr/scene/XrInstrumentStyle.ts'),m=new XrTrackMarquee(doc);m.setTitle('Oblique angles — árvíztűrő title.wav');assert.equal(contexts.at(-1).font,`700 32px ${XR_INSTRUMENT_FONT}`);const material=m.mesh.material,tex=material.uniforms.uAtlas.value;
 assert.equal(material.uniforms.uInk.value.getHex(),new THREE.Color(XR_INSTRUMENT_INK).getHex());assert.equal(tex.colorSpace,THREE.NoColorSpace);assert.equal(tex.generateMipmaps,true);assert.equal(tex.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(tex.anisotropy,8);assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);assert.match(material.fragmentShader,/textureGrad\(uAtlas,atlasUv,dx,dy\)/);assert.match(material.fragmentShader,/dFdx\(sourceX\)/);assert.doesNotMatch(material.fragmentShader,/dFdx\(atlasUv\)/);
 for(const path of['XrHud','XrMenuPanel'])assert.match(fs.readFileSync(`src/xr/scene/${path}.ts`,'utf8'),/const FONT = XR_INSTRUMENT_FONT/);m.dispose();
});
