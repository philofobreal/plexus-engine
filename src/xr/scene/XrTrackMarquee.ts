import * as THREE from 'three';
import type { XrCockpitTitleMode } from '../XrAppearanceSettings';
import { XR_INSTRUMENT_FONT, XR_INSTRUMENT_INK } from './XrInstrumentStyle';

export const TRACK_MARQUEE_WIDTH_METERS = 2;
export const TRACK_MARQUEE_HEIGHT_METERS = .22;
const ATLAS_WIDTH = 2048, ROW_HEIGHT = 64, MAX_ROWS = 8, VIEW_PIXELS = 512;
export const TRACK_MARQUEE_SPEED = 32;

/** Plain filename only. Bounded Unicode text; no HTML, asset or font requests. */
export function cockpitFilename(value: string): string {
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    const characters = Array.from(text);
    return characters.length > 256 ? characters.slice(0, 255).join('') + '…' : text;
}

/** One small title plane. Filename changes upload once; scrolling changes one GPU uniform. */
export class XrTrackMarquee {
    readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    private texture: THREE.CanvasTexture | null = null;
    private title = '';
    private mode: XrCockpitTitleMode = 'scroll';
    private dirty = false;
    private disposed = false;
    private period = VIEW_PIXELS;
    private atlasHeight = ROW_HEIGHT;
    private uploads = 0;
    private readonly doc: Pick<Document, 'createElement'>;

    constructor(doc: Pick<Document, 'createElement'> = document) {
        this.doc = doc;
        const material = new THREE.ShaderMaterial({
            uniforms: { uAtlas: { value: null }, uHeight: { value: ROW_HEIGHT }, uPeriod: { value: VIEW_PIXELS }, uOffset: { value: 0 },
                uInk: { value: new THREE.Color(XR_INSTRUMENT_INK) } },
            vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
            fragmentShader: `precision highp float;
                varying vec2 vUv; uniform sampler2D uAtlas; uniform float uHeight,uPeriod,uOffset; uniform vec3 uInk;
                void main(){
                    float sourceX=vUv.x*512.+uOffset;
                    float pixel=mod(sourceX,uPeriod);
                    float row=floor(pixel/2048.);
                    vec2 atlasUv=vec2(mod(pixel,2048.)/2048.,1.-(row*64.+(1.-vUv.y)*64.)/uHeight);
                    // Derive LOD from continuous coordinates, never from a wrapped row/period.
                    vec2 dx=vec2(dFdx(sourceX)/2048.,dFdx(vUv.y)*64./uHeight);
                    vec2 dy=vec2(dFdy(sourceX)/2048.,dFdy(vUv.y)*64./uHeight);
                    float alpha=textureGrad(uAtlas,atlasUv,dx,dy).a;
                    gl_FragColor=vec4(uInk,alpha);
                    #include <colorspace_fragment>
                }`,
            transparent: true, depthTest: true, depthWrite: false, toneMapped: false
        });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_MARQUEE_WIDTH_METERS, TRACK_MARQUEE_HEIGHT_METERS), material);
        this.mesh.name = 'cockpit-filename-marquee';
        this.mesh.visible = false;
    }

    get text(): string { return this.title; }
    get uploadCount(): number { return this.uploads; }
    get atlasBytes(): number { return this.texture ? ATLAS_WIDTH * this.atlasHeight * 4 : 0; }

    setTitle(filename: string): void {
        if (this.disposed) return;
        const title = cockpitFilename(filename);
        if (title === this.title) return;
        this.title = title; this.dirty = true;
        this.refresh();
    }

    setMode(mode: XrCockpitTitleMode): void {
        if (this.disposed) return;
        this.mode = mode;
        this.refresh();
        if (mode !== 'scroll') this.mesh.material.uniforms.uOffset.value = 0;
    }

    /** Song time already belongs to AudioEngine/session. Pause/seek does not accumulate drift. */
    update(songTime: number): void {
        if (this.disposed || !this.mesh.visible) return;
        this.mesh.material.uniforms.uOffset.value = this.mode === 'scroll' && Number.isFinite(songTime)
            ? (Math.max(0, songTime) * TRACK_MARQUEE_SPEED) % this.period : 0;
    }

    private refresh(): void {
        this.mesh.visible = this.mode !== 'off' && this.title.length > 0;
        if (!this.mesh.visible || !this.dirty) return;
        const canvas = this.doc.createElement('canvas');
        canvas.width = ATLAS_WIDTH; canvas.height = ROW_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) { this.mesh.visible = false; return; }
        const font = `700 32px ${XR_INSTRUMENT_FONT}`;
        ctx.font = font;
        const measured = ctx.measureText(this.title).width;
        // Eight atlas rows bound even hostile names; common filesystem names fit without clipping.
        const width = Number.isFinite(measured) ? Math.max(0, Math.min(ATLAS_WIDTH * MAX_ROWS - VIEW_PIXELS, measured)) : 0;
        this.period = Math.max(VIEW_PIXELS, Math.ceil(width) + VIEW_PIXELS * .5);
        const rows = Math.max(1, Math.ceil(this.period / ATLAS_WIDTH));
        this.atlasHeight = ROW_HEIGHT * 2 ** Math.ceil(Math.log2(rows));
        canvas.height = this.atlasHeight;
        ctx.font = font; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
        for (let row = 0; row < rows; row++) {
            ctx.save(); ctx.beginPath(); ctx.rect(0, row * ROW_HEIGHT, ATLAS_WIDTH, ROW_HEIGHT); ctx.clip();
            ctx.fillText(this.title, 12 - row * ATLAS_WIDTH, row * ROW_HEIGHT + ROW_HEIGHT / 2);
            ctx.restore();
        }
        const texture = new THREE.CanvasTexture(canvas);
        // Alpha mask only: no dark/color fringe from transparent atlas RGB at grazing angles.
        texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 8;
        this.texture?.dispose(); this.texture = texture;
        const u = this.mesh.material.uniforms;
        u.uAtlas.value = texture; u.uHeight.value = this.atlasHeight; u.uPeriod.value = this.period; u.uOffset.value = 0;
        this.uploads++; this.dirty = false;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.mesh.visible = false;
        this.texture?.dispose(); this.texture = null;
        this.mesh.geometry.dispose(); this.mesh.material.dispose();
    }
}
