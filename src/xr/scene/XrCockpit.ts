import * as THREE from 'three';
import type { RhythmGameConfig } from '../../gameplay';
import type { XrCockpitMode, XrCockpitTitleMode } from '../XrAppearanceSettings';
import { SCENE_CONFIG, type XrStageLayout } from './SceneConfig';
import { XrTrackMarquee, TRACK_MARQUEE_WIDTH_METERS, TRACK_MARQUEE_HEIGHT_METERS } from './XrTrackMarquee';
import type { HudStyle } from '../../presentation/InstrumentDesign';
import { instrumentGateParts } from './InstrumentDesignRenderer';
import { mergeColoredParts } from './SceneGeometry';

import { appendCockpitPanel, appendCockpitRail, type CockpitBatch, type CockpitPoint } from './CockpitGeometry';

export const COCKPIT_TITLE_DROP_METERS = .245;
export const COCKPIT_TITLE_FORWARD_METERS = .55;

/** Stage-space envelope, derived only on layout/recenter, never from music or head rotation. */
export function cockpitEnvelope(config: RhythmGameConfig, layout: XrStageLayout, eyeHeight: number) {
    const eye = Number.isFinite(eyeHeight) ? Math.max(.8, Math.min(2.5, eyeHeight)) : SCENE_CONFIG.defaultEyeHeightMeters;
    const middle = Math.max(.7, eye - SCENE_CONFIG.hitHeightBelowEyesMeters);
    const top = Math.max(eye + 1.3, middle + layout.frameCenterYMeters + layout.frameHalfHeightMeters + .7);
    return { halfWidth: Math.max(2.7, SCENE_CONFIG.runwayWidthMeters / 2 + config.noteSizeMeters + .7),
        top, bottom: .04, z: -Math.max(2.4, layout.playfieldForwardMeters + 1.1),
        floorGap: SCENE_CONFIG.runwayWidthMeters / 2 + config.noteSizeMeters + .12 };
}

export interface CockpitSweep { points: CockpitPoint[]; tangents: CockpitPoint[] }

function sweepFrom(point: CockpitPoint, direction: CockpitPoint): CockpitSweep {
    return {points:[point],tangents:[new THREE.Vector3(...direction).normalize().toArray()]};
}
function lineTo(sweep: CockpitSweep, to: CockpitPoint, steps=1): void {
    const from=new THREE.Vector3(...sweep.points.at(-1)!), end=new THREE.Vector3(...to), tangent=end.clone().sub(from).normalize().toArray();
    for(let i=1;i<=steps;i++){sweep.points.push(from.clone().lerp(end,i/steps).toArray());sweep.tangents.push(tangent);}
}
function bezier(controls: readonly THREE.Vector3[], t: number): THREE.Vector3 {
    const p=controls.map(p=>p.clone());
    for(let n=p.length-1;n>0;n--)for(let i=0;i<n;i++)p[i].lerp(p[i+1],t);
    return p[0];
}
/** Six controls give zero endpoint curvature; adjacent straight spans and bends share tangents. */
export const COCKPIT_CURVE_ERROR_METERS = .0015;
export const COCKPIT_TANGENT_STEP_RADIANS = Math.PI/30;
function bendTo(sweep: CockpitSweep, to: CockpitPoint, direction: CockpitPoint): void {
    const from=new THREE.Vector3(...sweep.points.at(-1)!), end=new THREE.Vector3(...to);
    const incoming=new THREE.Vector3(...sweep.tangents.at(-1)!).normalize(), outgoing=new THREE.Vector3(...direction).normalize();
    const handle=from.distanceTo(end)*.22;
    const controls=[from,from.clone().addScaledVector(incoming,handle),from.clone().addScaledVector(incoming,2*handle),
        end.clone().addScaledVector(outgoing,-2*handle),end.clone().addScaledVector(outgoing,-handle),end];
    const derivative=controls.slice(1).map((p,i)=>p.clone().sub(controls[i]).multiplyScalar(5));
    const point=(t:number)=>t===1?end.clone():bezier(controls,t);
    const tangent=(t:number)=>t===1?outgoing.clone():bezier(derivative,t).normalize();
    const distanceToChord=(p:THREE.Vector3,a:THREE.Vector3,b:THREE.Vector3)=>{
        const d=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/Math.max(1e-12,d.lengthSq()),0,1);
        return p.distanceTo(a.clone().addScaledVector(d,u));
    };
    const sample=(a:number,b:number,pa:THREE.Vector3,pb:THREE.Vector3,ta:THREE.Vector3,tb:THREE.Vector3,depth:number):void=>{
        const m=(a+b)/2,pm=point(m),tm=tangent(m);
        const error=Math.max(distanceToChord(pm,pa,pb),distanceToChord(point((a+m)/2),pa,pb),distanceToChord(point((m+b)/2),pa,pb));
        const angle=Math.max(ta.angleTo(tb),ta.angleTo(tm),tm.angleTo(tb));
        if(depth<8&&(error>COCKPIT_CURVE_ERROR_METERS||angle>COCKPIT_TANGENT_STEP_RADIANS)){
            sample(a,m,pa,pm,ta,tm,depth+1);sample(m,b,pm,pb,tm,tb,depth+1);
        }else{sweep.points.push(pb.toArray());sweep.tangents.push(tb.toArray());}
    };
    sample(0,1,from,end,incoming,outgoing,0);
}

/** Six major spans per side: quiet crown, broad shoulder, long side, lower sweep, under-track arch. */
export function cockpitShellSweep(e: ReturnType<typeof cockpitEnvelope>): CockpitSweep {
    const w=e.halfWidth,top=e.top,z=e.z;
    const sweep=sweepFrom([0,top-.08,z],[-1,0,0]);
    lineTo(sweep,[-1.08,top-.08,z]);
    bendTo(sweep,[-1.92,top+.06,z],[-1,0,0]);
    const sideTop: CockpitPoint=[-w,top-.70,z],sideBottom: CockpitPoint=[-w-.16,.70,z];
    const sideDirection=new THREE.Vector3(...sideBottom).sub(new THREE.Vector3(...sideTop)).normalize().toArray();
    bendTo(sweep,sideTop,sideDirection);lineTo(sweep,sideBottom);
    bendTo(sweep,[-1.96,-.25,z-.60],[1,0,-.18]);
    bendTo(sweep,[0,-.30,z-.92],[1,0,0]);
    // Reflection plus reversed traversal shares the exact tangent at both center seams.
    const reflected=sweep.points.slice(0,-1).reverse().map(p=>[-p[0],p[1],p[2]] as const);
    const reflectedTangents=sweep.tangents.slice(0,-1).reverse().map(t=>[t[0],-t[1],-t[2]] as const);
    const points=[...sweep.points,...reflected],tangents=[...sweep.tangents,...reflectedTangents];
    points[points.length-1]=points[0];tangents[tangents.length-1]=tangents[0];
    return {points,tangents};
}
export function cockpitShellContour(e: ReturnType<typeof cockpitEnvelope>): CockpitPoint[] { return cockpitShellSweep(e).points; }

export function cockpitSillSweep(e: ReturnType<typeof cockpitEnvelope>, side: number): CockpitSweep {
    const direction=new THREE.Vector3(side*.16,.70-(e.top-.70),0).normalize().toArray();
    const sweep=sweepFrom([side*(e.halfWidth+.16),.70,e.z-.10],direction);
    bendTo(sweep,[side*(e.floorGap+.16),-.18,e.z+1.35],[0,0,1]);
    lineTo(sweep,[side*(e.floorGap+.16),-.18,1.8],5);
    return sweep;
}

/** Two merged unlit structure draws and one clipped filename plane; no gameplay/runtime owner. */
export class XrCockpit {
    readonly root = new THREE.Group();
    readonly title: XrTrackMarquee;
    readonly body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly trim: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    private reduced: readonly THREE.BufferGeometry[] = [];
    private full: readonly THREE.BufferGeometry[] = [];
    private mode: XrCockpitMode = 'full';
    private layoutKey = '';
    private disposed = false;
    private hudStyle: HudStyle = 'classic';
    private instrumentBezel: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
    setHudStyle(style: HudStyle): void {
        if (this.disposed || style === this.hudStyle) return;
        this.hudStyle = style;
        if (style === 'classic' || style === 'off') { if (this.instrumentBezel) this.instrumentBezel.visible = false; return; }
        const geometry = mergeColoredParts(instrumentGateParts(style, TRACK_MARQUEE_WIDTH_METERS / 2 + .02, TRACK_MARQUEE_HEIGHT_METERS / 2 + .02));
        if (!this.instrumentBezel) {
            this.instrumentBezel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:0x4fd8ff,transparent:true,opacity:.7,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
            this.instrumentBezel.material.forceSinglePass = true;
            this.instrumentBezel.position.z = .002; this.instrumentBezel.name = 'cockpitInstrumentBezel';
            this.title.mesh.add(this.instrumentBezel);
        } else { this.instrumentBezel.geometry.dispose(); this.instrumentBezel.geometry = geometry; this.instrumentBezel.visible = true; }
    }

    constructor(doc: Pick<Document, 'createElement'> = document) {
        this.root.name = 'xr-cockpit-v1';
        this.body = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
        this.trim = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
        this.title = new XrTrackMarquee(doc);
        this.root.add(this.body, this.trim, this.title.mesh);
    }

    setSettings(mode: XrCockpitMode, titleMode: XrCockpitTitleMode): void {
        if (this.disposed) return;
        this.mode = mode;
        this.root.visible = mode !== 'off';
        this.title.setMode(mode === 'off' ? 'off' : titleMode);
        this.selectGeometry();
    }

    setTitle(filename: string): void { if (!this.disposed) this.title.setTitle(filename); }
    /** Desktop preview has a rearward camera; adapt once on entry/exit, never track the head. */
    setViewOrigin(z: number): void { if (!this.disposed && Number.isFinite(z)) this.root.position.z = Math.max(0, Math.min(3, z)); }
    update(songTime: number): void { if (this.root.visible && !this.disposed) this.title.update(songTime); }

    fit(config: RhythmGameConfig, layout: XrStageLayout, eyeHeight: number): void {
        if (this.disposed) return;
        const e = cockpitEnvelope(config, layout, eyeHeight), key = JSON.stringify(e);
        if (key === this.layoutKey) return;
        this.layoutKey = key;
        for (const g of new Set([this.body.geometry, this.trim.geometry, ...this.reduced, ...this.full])) g.dispose();
        this.reduced = this.build(e, false); this.full = this.build(e, true);
        this.selectGeometry();
        this.title.mesh.position.set(0, e.top + .075 - COCKPIT_TITLE_DROP_METERS, e.z + COCKPIT_TITLE_FORWARD_METERS);
    }

    private selectGeometry(): void {
        const pair = this.mode === 'reduced' ? this.reduced : this.full;
        if (pair.length) { this.body.geometry = pair[0]; this.trim.geometry = pair[1]; }
    }

    private build(e: ReturnType<typeof cockpitEnvelope>, full: boolean): readonly THREE.BufferGeometry[] {
        const body: CockpitBatch = { positions: [], colors: [] }, trim: CockpitBatch = { positions: [], colors: [] };
        const cyan = new THREE.Color(0x4fd8ff), magenta = new THREE.Color(0xff5fb4), white = new THREE.Color(0xeef8ff);
        const dark = new THREE.Color(0x172234), lighter = new THREE.Color(0x26354b);
        const beam = (batch: CockpitBatch, a: CockpitPoint, b: CockpitPoint, width: number, depth: number, color: THREE.Color) =>
            appendCockpitRail(batch,[a,b],width,depth,color,batch===body);
        const shell=cockpitShellSweep(e),contour=shell.points;
        const shellWidth=(p:CockpitPoint)=>.20+(full?.18:.14)*THREE.MathUtils.smootherstep(p[1],-.24,.50);
        appendCockpitRail(body,contour,.38,full?.28:.24,lighter,true,.52,3,
            {edgeRadius:.06,widthAt:shellWidth,tangents:shell.tangents});
        // The light channel follows the same entire closed sweep, including the lower return.
        const lightStart=trim.positions.length;
        appendCockpitRail(trim,contour,.018,.012,white,false,.52,2,{normalOffset:full?.16:.14,tangents:shell.tangents});
        for(let i=lightStart;i<trim.positions.length;i+=3){const x=trim.positions[i],c=x<-.18?cyan:x>.18?magenta:white;trim.colors[i]=c.r;trim.colors[i+1]=c.g;trim.colors[i+2]=c.b;}
        // A rounded, stepped central console descends from the crown, with a recessed display.
        const podZ = e.z + .2;
        appendCockpitPanel(body,[[-1.45,e.top+.12],[1.45,e.top+.12],[1.28,e.top-.36],[-1.28,e.top-.36]],podZ-.03,.26,dark,.11,.022);
        const cy=e.top-.17;
        appendCockpitPanel(body,[[-1.18,cy+.17],[1.18,cy+.17],[1.22,cy+.12],[1.22,cy-.12],[1.16,cy-.18],[-1.16,cy-.18],[-1.22,cy-.12],[-1.22,cy+.12]],podZ+.26,.01,new THREE.Color(0x050d1c),.035,.004);
        const bezel: CockpitPoint[] = [[0,cy+.18,podZ+.28],[1.15,cy+.18,podZ+.28],[1.24,cy+.10,podZ+.28],[1.24,cy-.11,podZ+.28],
            [1.15,cy-.20,podZ+.28],[-1.15,cy-.20,podZ+.28],[-1.24,cy-.11,podZ+.28],[-1.24,cy+.10,podZ+.28],[-1.15,cy+.18,podZ+.28],[0,cy+.18,podZ+.28]];
        appendCockpitRail(trim,bezel,.012,.018,new THREE.Color(0x50627c),false,.035,2);
        for(const side of[-1,1]){
            const color=side<0?cyan:magenta;
            for(const up of[-1,1])appendCockpitRail(trim,[[side*.98,cy+up*.146,podZ+.29],[side*1.11,cy+up*.146,podZ+.29],[side*1.14,cy+up*.115,podZ+.29],[side*1.14,cy+up*.07,podZ+.29]],.012,.012,color,false,.018,1);
            beam(trim,[side*.35,e.top-.377,podZ+.28],[side*.83,e.top-.377,podZ+.28],.012,.012,color);
        }
        beam(trim,[-.09,e.top-.377,podZ+.28],[.09,e.top-.377,podZ+.28],.009,.012,white);
        if (full) for(const side of[-1,1]) {
            const color=side<0?cyan:magenta,sill=cockpitSillSweep(e,side);
            const tip=(p:CockpitPoint)=>1-.98*THREE.MathUtils.smootherstep(p[2],.9,1.8);
            const widthAt=(p:CockpitPoint)=>(.07+.35*THREE.MathUtils.smootherstep(p[2],e.z-.1,e.z+.9))*tip(p);
            // Buried narrow root, one generous shoulder and a long straight return with a soft tip.
            appendCockpitRail(body,sill.points,.42,.18,dark,true,.44,3,
                {edgeRadius:.045,widthAt,depthAt:p=>.18*tip(p),tangents:sill.tangents});
            const lightGain=(p:CockpitPoint)=>THREE.MathUtils.smootherstep(p[2],e.z+.2,e.z+1.0);
            appendCockpitRail(trim,sill.points,.015,.012,color,false,.44,3,
                {normalOffset:p=>.106*tip(p),widthAt:p=>.015*tip(p)*(.02+.98*lightGain(p)),
                    gainAt:lightGain,depthAt:p=>.012*tip(p),tangents:sill.tangents});
        }
        return [body,trim].map(batch => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
            geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
            geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.root.visible = false;
        if (this.instrumentBezel) { this.instrumentBezel.geometry.dispose(); this.instrumentBezel.material.dispose(); }
        for (const g of new Set([this.body.geometry,this.trim.geometry,...this.reduced,...this.full])) g.dispose();
        this.body.material.dispose(); this.trim.material.dispose(); this.title.dispose();
        this.root.removeFromParent();
    }
}
