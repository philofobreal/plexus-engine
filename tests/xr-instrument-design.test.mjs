// T14 presentation: deterministic bounded geometry, stable controls/data and live style switching.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';
import { harness } from './helpers/xr-controller-harness.mjs';
const doc = fakeDocument(), load = createLoader({three: THREE}, {document: doc});
const {instrumentDesign, instrumentSvg, normalizeHudStyle} = load('presentation/InstrumentDesign.ts');
const {instrumentGateParts} = load('xr/scene/InstrumentDesignRenderer.ts');
const {DEFAULT_XR_SETTINGS, XR_SETTINGS, normalizeXrSettings, changeScope} = load('xr/XrSettings.ts');
const {DEFAULT_MENU_STATE, settingsReport} = load('xr/XrMenuModel.ts');
const snapshot = {state:'playing',score:124580,combo:128,multiplier:8,hitCount:128,missCount:0,sections:[]};
const json = value => JSON.stringify(value);

test('shared design is seeded, bounded and contains no runtime/renderer dependency', () => {
    const source = readFileSync('src/presentation/InstrumentDesign.ts','utf8');
    assert.doesNotMatch(source, /\bimport\b|Math\.random|Date\.|performance\.|document\.|window\./);
    for (const style of ['angular','orbital','off']) for (const surface of ['panel','menu','control','strip','gate'])
        for (const [w,h] of [[8,8],[8,8192],[8192,8],[768,384],[1280,900],[1024,640]]) {
            const d = instrumentDesign(style,w,h,surface,42);
            assert.equal(json(d),json(instrumentDesign(style,w,h,surface,42)));
            assert.ok(d.paths.length<=12);
            assert.ok(d.paths.reduce((n,p)=>n+p.points.length,0)<=192);
            for (const p of d.paths) for (const [x,y] of p.points) assert.ok(x>=0&&x<=w&&y>=0&&y<=h,`${style}/${surface}/${w}x${h}: ${x},${y}`);
        }
    assert.notEqual(json(instrumentDesign('angular',768,384)),json(instrumentDesign('orbital',768,384)));
    assert.notEqual(json(instrumentDesign('angular',768,384,'panel',1)),json(instrumentDesign('angular',768,384,'panel',2)));
    assert.equal(instrumentDesign('off',768,384).paths.length,0);
});

test('invalid dimensions/seeds fail explicitly; unknown saved styles use Current', () => {
    for (const [w,h] of [[NaN,100],[100,Infinity],[7,100],[100,8193]]) assert.throws(()=>instrumentDesign('angular',w,h));
    assert.throws(()=>instrumentDesign('orbital',100,100,'panel',.5));
    for (const value of [null,undefined,'other',{},'classic']) assert.equal(normalizeHudStyle(value),'classic');
    assert.match(instrumentSvg('orbital'),/stroke-linejoin="round"/);
    assert.doesNotMatch(instrumentSvg('angular'),/script|https:|foreignObject|onload/);
});

test('HUD design is presentation-only, persists in the existing record and is included in Copy', () => {
    const {createXrSettingsStore} = load('xr/XrSettingsStore.ts');
    const descriptor = XR_SETTINGS.find(d=>d.id==='hudStyle');
    assert.equal(descriptor.section,'background');
    assert.equal(descriptor.scope,'presentation');
    assert.equal(descriptor.read(DEFAULT_XR_SETTINGS),'classic');
    assert.equal(Object.hasOwn(DEFAULT_XR_SETTINGS.appearance,'hudStyle'),false,'old default object shape retained');
    let raw; const store=createXrSettingsStore({getItem:()=>raw??null,setItem:(_key,value)=>{raw=value}});
    for (const style of ['angular','orbital','off']) {
        const settings=descriptor.write(DEFAULT_XR_SETTINGS,style);
        assert.equal(changeScope(DEFAULT_XR_SETTINGS,settings),'presentation');
        store.save(settings);assert.equal(store.load().appearance.hudStyle,style);
        assert.equal(JSON.parse(raw).version,1);
        assert.match(settingsReport(settings),/HUD design:/);
        assert.equal(JSON.parse(settingsReport(settings).split('JSON: ')[1]).appearance.hudStyle,style);
        assert.equal(settings.generation,DEFAULT_XR_SETTINGS.generation);
    }
    assert.equal(normalizeXrSettings({appearance:{hudStyle:'unknown'}}).appearance.hudStyle,undefined);
});

test('all four HUD styles keep the score/combo/instructions and redraw only on display changes', () => {
    const {XrHud}=load('xr/scene/XrHud.ts'), hud=new XrHud();
    const ctx=hud.mesh.material.map.image.getContext('2d');
    let reference;
    for (const style of ['classic','angular','orbital','off']) {
        ctx.calls.length=0;hud.setHudStyle(style);hud.update(snapshot,'Follow the accents.');
        const text=ctx.calls.filter(c=>c[0]==='fillText');
        if (!reference) reference=json(text); else assert.equal(json(text),reference,'identical content, fonts and anchors');
        const version=hud.mesh.material.map.version;
        for(let i=0;i<100;i++){hud.setHudStyle(style);hud.update(snapshot,'Follow the accents.')}
        assert.equal(hud.mesh.material.map.version,version);
        if(style==='off')assert.equal(ctx.calls.filter(c=>c[0]==='stroke').length,0);
    }
    hud.dispose();
});

test('Angular/Orbital menus keep every control rectangle and unchanged-value upload cadence', () => {
    const {XrMenuPanel}=load('xr/scene/XrMenuPanel.ts'), menu=new XrMenuPanel(doc);
    const context={settings:DEFAULT_XR_SETTINGS,sessionState:'ready',trackTitle:'NO GOOD',busy:false,canStart:true,status:'Ready',results:null,input:'desktop'};
    const state={...DEFAULT_MENU_STATE,screen:'settings',tab:'background'};
    let reference;
    for(const style of ['classic','angular','orbital','off']){
        menu.setHudStyle(style);menu.update(state,context);
        const items=json(menu.layout.items.map(i=>[i.id,i.x,i.y,i.w,i.h,i.disabled]));
        if(!reference)reference=items;else assert.equal(items,reference);
        assert.ok(menu.layout.items.some(i=>i.id.includes('hudStyle')));
        const draws=menu.redrawCount;
        for(let i=0;i<100;i++)menu.update(state,context);
        assert.equal(menu.redrawCount,draws);
    }
    menu.dispose();
});

test('continuous gate ribbons stay finite, connected and inside Standard/Tall playfield envelopes', () => {
    for(const style of ['angular','orbital'])for(const halfHeight of [.485,.655]){
        const parts=instrumentGateParts(style,.835,halfHeight);
        assert.equal(parts.length,4);
        for(const {geometry:g} of parts){
            const p=g.getAttribute('position');assert.ok(p.count<=32);
            for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Math.abs(p.getX(i))<=.835&&Math.abs(p.getY(i))<=halfHeight+1e-7);
            assert.equal(g.index.count,(p.count/2-1)*6,'one continuous indexed strip per corner');
            for(let i=0;i<p.count;i+=2)assert.ok(Math.hypot(p.getX(i)-p.getX(i+1),p.getY(i)-p.getY(i+1))<.014,'bounded miter joins');
            g.dispose();
        }
    }
});

test('switching frame styles disposes old geometry, hides only decoration in Off and preserves captions', () => {
    const {XrSectionCallout}=load('xr/scene/XrSectionCallout.ts'), {XrSectionGates}=load('xr/scene/XrSectionGates.ts');
    const c=new XrSectionCallout(doc),g=new XrSectionGates(doc);
    c.setTimeline([{start:0,end:60,label:'drop',title:'DROP',leadIn:0,beatSec:.5}]);
    for(const style of ['angular','orbital','off','classic']){
        let disposed=0;for(const mesh of [c.frame,g.brackets])mesh.geometry.addEventListener('dispose',()=>disposed++);
        c.setHudStyle(style);g.setHudStyle(style);c.update(4);
        assert.equal(disposed,2);assert.equal(c.frame.visible,style!=='off');assert.equal(g.brackets.visible,style!=='off');
        assert.equal(c.caption.visible,true);assert.equal(c.root.visible,true);
        const geom=c.frame.geometry;c.setHudStyle(style);assert.equal(c.frame.geometry,geom);
    }
    c.dispose();g.dispose();
});

test('progress-ring style is a static uniform: section data and geometry remain identical', () => {
    const {XrProgressRing}=load('xr/scene/XrProgressRing.ts'),ring=new XrProgressRing();
    const geometry=ring.mesh.geometry,uniforms=ring.mesh.material.uniforms;
    const data=json(uniforms.uSections.value);
    for(const [style,code] of [['angular',1],['orbital',2],['off',3],['classic',0]]){
        ring.setHudStyle(style);assert.equal(uniforms.uDesign.value,code);assert.equal(ring.mesh.geometry,geometry);assert.equal(json(uniforms.uSections.value),data);
    }
    ring.dispose();
});

test('shared canvas adapter preserves disabled opacity and a bright hover accent', () => {
    const {paintInstrumentFrame}=load('xr/scene/InstrumentDesignRenderer.ts');
    const strokes=[],fills=[];
    const ctx={globalAlpha:.35,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
        stroke(){strokes.push([this.globalAlpha,this.strokeStyle])},fill(){fills.push(this.globalAlpha)}};
    paintInstrumentFrame(ctx,'orbital',140,48,'control',14,'black','#eef8ff');
    assert.deepEqual(fills,[.35]);assert.equal(strokes[0][0],.35*.48);assert.equal(strokes[0][1],'#eef8ff');
});

test('cockpit styles reuse one static title bezel and dispose it; the approved shell stays identical', () => {
    const {XrCockpit}=load('xr/scene/XrCockpit.ts'), {resolvePlayProfile}=load('xr/XrPlayProfile.ts');
    const cockpitDoc={createElement(tag){const canvas=doc.createElement(tag),ctx=canvas.getContext('2d');ctx.rect=()=>{};ctx.clip=()=>{};return canvas}};
    const c=new XrCockpit(cockpitDoc),p=resolvePlayProfile({},'tall');c.fit(p.config,p.stage,1.65);
    const body=c.body.geometry,trim=c.trim.geometry;
    c.setSettings('full','static');c.setTitle('NO GOOD');c.setHudStyle('angular');
    const bezel=c.title.mesh.getObjectByName('cockpitInstrumentBezel');assert.ok(bezel);
    assert.equal(bezel.material.forceSinglePass,true);
    c.setHudStyle('orbital');assert.equal(c.title.mesh.getObjectByName('cockpitInstrumentBezel'),bezel);
    const geometry=bezel.geometry;for(let i=0;i<30;i++){c.setHudStyle('orbital');c.update(i/30)}
    assert.equal(bezel.geometry,geometry);assert.equal(c.body.geometry,body);assert.equal(c.trim.geometry,trim);
    c.setHudStyle('off');assert.equal(bezel.visible,false);assert.equal(c.root.visible,true);
    let disposed=0;for(const r of [bezel.geometry,bezel.material])r.addEventListener('dispose',()=>disposed++);
    c.dispose();assert.equal(disposed,2);
});

test('live controller style changes neither reload/replan nor regenerate/rewind the chart', async () => {
    const h=harness();await h.loadTrack();h.engine.play(10);
    const chart=h.chart(),stops=h.engine.stops.length,plans=h.prepareCalls.length,loads=h.engine.loads;
    for(const style of ['angular','orbital','off','classic']){
        h.pick(style,'background','hudStyle');
        assert.equal(h.chart(),chart);assert.equal(h.engine.stops.length,stops);assert.equal(h.prepareCalls.length,plans);assert.equal(h.engine.loads,loads);
        assert.equal(h.controller.session.getState(),'playing');assert.equal(h.drawer.root.dataset.hudStyle,style);
    }
    h.controller.dispose();
});
