// World Formation runtime and renderer (ADR-010). Presents the authored World Plan and the
// player's interaction snapshot; it never decides an outcome. Everything is a pure function of
// canonical song time, the plan and the snapshot: pausing freezes the world, a seek lands on the
// exact state, nothing is simulated frame by frame.
//
// Writes: per-instance plan data once per plan; the state attribute (quality, energized, fault)
// once per changed snapshot revision; seeder paths when a side's construction target changes;
// at most 12 drone matrices and the shared uniforms per frame. Lives in the stage root, outside
// the targets' readability volume (XrWorldLayout).

import * as THREE from 'three';
import { characterAt, encounterStageAt, smoothstep01, type MutableWorldCharacter } from '../../gameplay/WorldTimeline';
import {
    createEmptyWorldPlan, type WorldEvent, type WorldInteractionSnapshot, type WorldPlan, type WorldReaction, type WorldReactionKind,
    type WorldStructure
} from '../../gameplay/WorldTypes';
import {
    BEAM_KIND, BODY_KIND, createBeamMaterial, createBodyMaterial, createCoreMaterial, createDroneGeometry, createFloorMaterial,
    createFlowMaterial, createMembraneMaterial, createNodeMaterial, createRingMaterial, createSeederMaterial, createWorldUniforms,
    instancedDraw, MAX_SHADER_REACTIONS, REACTION_CODE, SEEDER_KIND, type WorldUniforms
} from './XrWorldKit';
import {
    conduitSegments, structureAnchor, droneField, droneFormation, dronePatrol, droneScan, FENOM_CENTRE, FENOM_CORE_RADIUS, FENOM_FILAMENTS,
    FENOM_MEMBRANE_RADIUS, FENOM_RING_RADII, FLOOR_INNER_X, FLOW_CENTRE, FLOW_INNER_RADIUS, FLOW_OUTER_RADIUS, FLOW_TILT, HALL_FAR_Z,
    HALL_NEAR_Z, latticeAnchor, latticeNode, latticeSatellite, MATERIAL_NODES_PER_SIDE, materialNode, PYLON_HEIGHT, PYLON_WIDTH,
    PYLON_X, pylonBase, RIB_HEIGHT, RIB_LENGTH, ribCentre, SATELLITES_PER_NODE, seedCore, WALL_HEIGHT, WALL_PANEL_DEPTH,
    WALL_PANELS_PER_SIDE, WALL_X, wallPanelCentre, type Vec3
} from './XrWorldLayout';

export type XrWorldDetail = 'full' | 'reduced';

/** Bounded counts per detail level (the reduced set is a prefix of the full one). */
export const WORLD_DETAIL = {
    full: { collectorsPerSide: 8, drones: 12, flowPoints: 480, satellites: true },
    reduced: { collectorsPerSide: 4, drones: 6, flowPoints: 160, satellites: false }
} as const;

const COLLECTOR_SEGMENTS = 3;
const MAX_COLLECTORS_PER_SIDE = WORLD_DETAIL.full.collectorsPerSide;
const MAX_DRONES = WORLD_DETAIL.full.drones;
const MAX_FLOW = WORLD_DETAIL.full.flowPoints;
const NODE_COUNT = 8;
const BODY_CAPACITY = 2 * WALL_PANELS_PER_SIDE + 12 + 6;
const BEAM_CAPACITY = 24 + 18 + FENOM_FILAMENTS + 2 * MATERIAL_NODES_PER_SIDE;
const SEEDER_CAPACITY = 2 + 4 + 2 * MAX_COLLECTORS_PER_SIDE * COLLECTOR_SEGMENTS;
/** A build slot without a structure in the plan: its outline never appears. */
const NEVER = 1e6;
const MISSING_STRUCTURE = 9999;
const IDLE_SPEED = 0.05;

const REACTION_CODES: Readonly<Record<WorldReactionKind, number>> = REACTION_CODE;

interface InstanceRef { readonly structure: number }

/** Envelope of an event at a song time: fades in over 0.4 s, out over its last second. */
function envelope(event: WorldEvent | null, time: number): number {
    if (!event) return 0;
    const age = time - event.time;
    if (age < 0 || age > event.duration) return 0;
    return smoothstep01(age / 0.4) * (1 - smoothstep01((age - event.duration + 1) / 1));
}

/** The latest event of a kind that started at or before `time` (events are sorted by time). */
function latestEvent(events: readonly WorldEvent[], kind: WorldEvent['kind'], time: number): WorldEvent | null {
    let found: WorldEvent | null = null;
    for (const event of events) {
        if (event.time > time) break;
        if (event.kind === kind) found = event;
    }
    return found;
}

export class XrWorld {
    readonly root = new THREE.Group();
    readonly uniforms: WorldUniforms;
    readonly body: THREE.InstancedMesh;
    readonly floor: THREE.Mesh;
    readonly beams: THREE.InstancedMesh;
    readonly nodes: THREE.InstancedMesh;
    readonly seeders: THREE.InstancedMesh;
    readonly drones: THREE.InstancedMesh;
    readonly flow: THREE.Points;
    readonly rings: THREE.InstancedMesh;
    readonly core: THREE.Mesh;
    readonly membrane: THREE.Mesh;
    /** Diagnostics / tests: instance writes so far (never per frame while nothing changes). */
    planWrites = 0;
    stateWrites = 0;
    pathWrites = 0;

    private readonly bodyAttr: Record<string, THREE.InstancedBufferAttribute>;
    private readonly beamAttr: Record<string, THREE.InstancedBufferAttribute>;
    private readonly nodeAttr: Record<string, THREE.InstancedBufferAttribute>;
    private readonly seederAttr: Record<string, THREE.InstancedBufferAttribute>;
    private readonly ringAttr: Record<string, THREE.InstancedBufferAttribute>;
    private readonly bodyRefs: InstanceRef[] = [];
    private readonly beamRefs: InstanceRef[] = [];
    private readonly nodeRefs: InstanceRef[] = [];
    private readonly ringRefs: InstanceRef[] = [];
    private plan: WorldPlan = createEmptyWorldPlan(0);
    private detail: XrWorldDetail;
    private readonly coreScale = { value: 0 };
    private readonly membraneAmount = { value: 0 };
    private readonly character: MutableWorldCharacter = { industry: 0, construction: 0, lattice: 0, flow: 0, anomaly: 0 };
    private lastSnapshot: WorldInteractionSnapshot | null | undefined = undefined;
    private readonly seederTarget: [number, number] = [-2, -2];
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
    private readonly scale = new THREE.Vector3();
    private readonly position = new THREE.Vector3();
    private readonly a: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly b: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly c: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly next: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly d: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly viewport = new THREE.Vector4();
    private activation: WorldEvent | null = null;

    constructor(detail: XrWorldDetail = 'full') {
        this.detail = detail;
        this.uniforms = createWorldUniforms();
        const u = this.uniforms;
        const body = instancedDraw(new THREE.BoxGeometry(1, 1, 1), createBodyMaterial(u), BODY_CAPACITY, ['aPos', 'aSize', 'aBuild', 'aState']);
        this.body = body.mesh; this.bodyAttr = body.attributes;
        this.floor = new THREE.Mesh(createFloorGeometry(), createFloorMaterial(u));
        this.floor.frustumCulled = false;
        const beams = instancedDraw(new THREE.BoxGeometry(1, 1, 1), createBeamMaterial(u), BEAM_CAPACITY, ['aFrom', 'aTo', 'aBuild', 'aState']);
        this.beams = beams.mesh; this.beamAttr = beams.attributes;
        const nodes = instancedDraw(new THREE.OctahedronGeometry(0.5, 0), createNodeMaterial(u), NODE_COUNT * (1 + SATELLITES_PER_NODE), ['aNode', 'aBuild', 'aState']);
        this.nodes = nodes.mesh; this.nodeAttr = nodes.attributes;
        const seeders = instancedDraw(new THREE.BoxGeometry(1, 1, 1), createSeederMaterial(u), SEEDER_CAPACITY, ['aSeed', 'aPathA', 'aPathB']);
        this.seeders = seeders.mesh; this.seederAttr = seeders.attributes;
        this.drones = new THREE.InstancedMesh(createDroneGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), MAX_DRONES);
        this.drones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.drones.count = 0; this.drones.frustumCulled = false;
        this.flow = new THREE.Points(createFlowGeometry(), createFlowMaterial(u, new THREE.Vector3(FLOW_CENTRE.x, FLOW_CENTRE.y, FLOW_CENTRE.z), FLOW_TILT));
        this.flow.frustumCulled = false;
        // Point sizes follow the current eye viewport (desktop canvas or XR eye buffer).
        const viewportHeight = (this.flow.material as THREE.ShaderMaterial).uniforms.uViewportHeight;
        this.flow.onBeforeRender = renderer => { renderer.getCurrentViewport(this.viewport); viewportHeight.value = this.viewport.w || 1080; };
        const centre = new THREE.Vector3(FENOM_CENTRE.x, FENOM_CENTRE.y, FENOM_CENTRE.z);
        const rings = instancedDraw(new THREE.TorusGeometry(1, 0.028, 4, 128), createRingMaterial(u, centre), FENOM_RING_RADII.length, ['aRing', 'aBuild', 'aState']);
        this.rings = rings.mesh; this.ringAttr = rings.attributes;
        this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), createCoreMaterial(u, centre, this.coreScale));
        this.membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), createMembraneMaterial(u, centre, { value: FENOM_MEMBRANE_RADIUS }, this.membraneAmount));
        for (const mesh of [this.core, this.membrane]) mesh.frustumCulled = false;
        // Opaque structures first, additive light work after (three sorts transparent draws last).
        this.root.add(this.floor, this.body, this.seeders, this.drones, this.core, this.beams, this.nodes, this.rings, this.membrane, this.flow);
        this.root.name = 'xr-world';
        this.setPlan(null);
    }

    get worldPlan(): WorldPlan { return this.plan; }
    get detailLevel(): XrWorldDetail { return this.detail; }

    /** Reduced detail halves the mobile units and the flow particles (deterministic prefixes). */
    setDetail(detail: XrWorldDetail): void {
        if (detail === this.detail) return;
        this.detail = detail;
        this.applyDetail();
    }

    /** Publishes a plan (null: the dormant hall). All plan-scope instance data is written here, once. */
    setPlan(plan: WorldPlan | null): void {
        this.plan = plan ?? createEmptyWorldPlan(0);
        this.planWrites++;
        const byId = new Map<string, WorldStructure>(this.plan.structures.map(s => [s.id, s]));
        const build = (id: string | null): [number, number, number, number] => {
            if (id === null) return [0, 0, -1, 1];
            const s = byId.get(id);
            if (!s || !s.scheduled) return [NEVER, NEVER, s ? s.index : MISSING_STRUCTURE, 0];
            return [s.buildStart, s.buildEnd, s.index, s.prebuilt ? 1 : 0];
        };
        this.writeBodies(build);
        this.writeBeams(build);
        this.writeNodes(build);
        this.writeRings(build);
        this.writeSeeders();
        this.activation = this.plan.events.find(e => e.kind === 'activation') ?? null;
        this.seederTarget[0] = -2; this.seederTarget[1] = -2;
        this.lastSnapshot = undefined;
        this.applyDetail();
        this.rings.visible = this.plan.structures.some(s => s.kind === 'ring' && s.scheduled);
    }

    /** One frame: song time and the latest interaction snapshot (null = neutral). */
    update(songTime: number, snapshot: WorldInteractionSnapshot | null): void {
        const time = Number.isFinite(songTime) ? songTime : 0;
        const u = this.uniforms, plan = this.plan, mix = characterAt(plan, time, this.character);
        u.uTime.value = time;
        u.uMix.value.set(mix.industry, mix.construction, mix.lattice, mix.flow);
        const activation = this.activation ? smoothstep01((time - this.activation.time) / Math.max(0.1, this.activation.duration)) : 0;
        u.uGlobal.value.set(activation, snapshot?.coherence ?? 0.5, snapshot?.formation ?? 0, 0);
        const surge = latestEvent(plan.events, 'surge', time);
        const surgeEnvelope = envelope(surge, time);
        u.uSurge.value.set(surge?.variant ?? 0, surge ? time - surge.time : 0, surge?.strength ?? 0, surgeEnvelope);
        const scan = latestEvent(plan.events, 'scan', time);
        const scanEnvelope = envelope(scan, time);
        u.uScan.value.set(scan && scan.variant % 2 ? 1 : -1, scan ? Math.min(1, (time - scan.time) / scan.duration) : 0, 0, 0);
        u.uGlobal.value.w = scanEnvelope;
        this.updateField(time, snapshot, mix.anomaly);
        this.updateReactions(snapshot);
        if (snapshot !== this.lastSnapshot) this.writeState(snapshot);
        this.updateSeeders(time);
        this.updateDrones(time, mix, surge, surgeEnvelope, scan, scanEnvelope, snapshot);
        // Skip draws that show nothing in the current character.
        this.nodes.visible = mix.lattice > 0.01;
        this.flow.visible = mix.flow > 0.01;
        this.seeders.visible = mix.construction > 0.01 || mix.industry > 0.3;
    }

    /** Draw calls the world issues right now (diagnostics and budget tests). */
    get drawCalls(): number {
        if (!this.root.visible) return 0;
        let calls = 0;
        this.root.traverse(object => {
            if (!object.visible || object === this.root) return;
            if (object instanceof THREE.InstancedMesh) { if (object.count > 0) calls++; }
            else if (object instanceof THREE.Mesh || object instanceof THREE.Points) calls++;
        });
        return calls;
    }

    dispose(): void {
        for (const object of [this.body, this.floor, this.beams, this.nodes, this.seeders, this.drones, this.flow, this.rings, this.core, this.membrane]) {
            object.geometry.dispose();
            (object.material as THREE.Material).dispose();
            if (object instanceof THREE.InstancedMesh) object.dispose();
        }
        this.root.removeFromParent();
    }

    // ---- Plan-scope writes ----------------------------------------------------------------
    private writeBodies(build: (id: string | null) => [number, number, number, number]): void {
        const { aPos, aSize, aBuild, aState } = this.bodyAttr;
        this.bodyRefs.length = 0;
        let i = 0;
        const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, kind: number, b: [number, number, number, number]) => {
            aPos.setXYZW(i, x, y, z, 0); aSize.setXYZW(i, sx, sy, sz, kind); aBuild.setXYZW(i, b[0], b[1], b[2], b[3]); aState.setXYZW(i, 0.6, -1, -1, 0);
            this.bodyRefs.push({ structure: b[2] }); i++;
        };
        for (let k = 0; k < 2 * WALL_PANELS_PER_SIDE; k++) {
            const c = wallPanelCentre(k);
            put(c.x, 0, c.z, 0.5, WALL_HEIGHT, WALL_PANEL_DEPTH, BODY_KIND.panel, build(null));
        }
        for (let slot = 0; slot < 12; slot++) {
            const p = pylonBase(slot);
            put(p.x, 0, p.z, PYLON_WIDTH, PYLON_HEIGHT, PYLON_WIDTH, BODY_KIND.pylon, build(`pylon-${slot}`));
        }
        for (let slot = 0; slot < 6; slot++) {
            const r = ribCentre(slot);
            put(r.x, r.y - RIB_HEIGHT / 2, r.z, RIB_LENGTH, RIB_HEIGHT, 0.4, BODY_KIND.rib, build(`rib-${slot}`));
        }
        this.body.count = i;
        markAll(this.bodyAttr);
    }

    private writeBeams(build: (id: string | null) => [number, number, number, number]): void {
        const { aFrom, aTo, aBuild, aState } = this.beamAttr;
        this.beamRefs.length = 0;
        let i = 0;
        const put = (from: Vec3, to: Vec3, width: number, kind: number, b: [number, number, number, number], phase: number) => {
            aFrom.setXYZW(i, from.x, from.y, from.z, width); aTo.setXYZW(i, to.x, to.y, to.z, kind);
            aBuild.setXYZW(i, b[0], b[1], b[2], phase); aState.setXYZW(i, 0.6, -1, -1, 0);
            this.beamRefs.push({ structure: b[2] }); i++;
        };
        // aBuild.w carries the beam's pulse phase (the beam shader never reads a prebuilt flag).
        const beamBuild = build;
        for (let slot = 0; slot < 12; slot++) {
            const b = beamBuild(`conduit-${slot}`);
            for (const [from, to] of conduitSegments(slot)) put(from, to, 0.07, BEAM_KIND.conduit, b, slot * 0.37);
        }
        for (let slot = 0; slot < NODE_COUNT; slot++) {
            put(latticeAnchor(slot), latticeNode(slot), 0.035, BEAM_KIND.link, beamBuild(`node-${slot}`), slot * 0.61);
            if (slot + 2 < NODE_COUNT) put(latticeNode(slot), latticeNode(slot + 2), 0.03, BEAM_KIND.link, beamBuild(`node-${slot + 2}`), slot * 0.83);
            if (slot % 2 === 0) put(latticeNode(slot), latticeNode(slot + 1), 0.03, BEAM_KIND.link, beamBuild(`node-${slot + 1}`), slot * 0.29);
        }
        const firstRing = beamBuild('ring-0');
        for (let k = 0; k < FENOM_FILAMENTS; k++) {
            const angle = (k + 0.5) / FENOM_FILAMENTS * Math.PI * 2;
            const inner = FENOM_CORE_RADIUS * 1.15, outer = FENOM_RING_RADII[FENOM_RING_RADII.length - 1] + 0.9;
            put({ x: FENOM_CENTRE.x + Math.cos(angle) * inner, y: FENOM_CENTRE.y + Math.sin(angle) * inner, z: FENOM_CENTRE.z },
                { x: FENOM_CENTRE.x + Math.cos(angle) * outer, y: FENOM_CENTRE.y + Math.sin(angle) * outer, z: FENOM_CENTRE.z - 0.6 },
                0.025, BEAM_KIND.filament, firstRing, k * 1.7);
        }
        for (const side of [-1, 1] as const) {
            const core = seedCore(side);
            for (let k = 0; k < MATERIAL_NODES_PER_SIDE; k++) put({ x: core.x, y: 0.9, z: core.z }, materialNode(side, k), 0.015, BEAM_KIND.seed, build(null), k * 0.9);
        }
        this.beams.count = i;
        markAll(this.beamAttr);
    }

    private writeNodes(build: (id: string | null) => [number, number, number, number]): void {
        const { aNode, aBuild, aState } = this.nodeAttr;
        this.nodeRefs.length = 0;
        let i = 0;
        const put = (p: Vec3, scale: number, b: [number, number, number, number]) => {
            aNode.setXYZW(i, p.x, p.y, p.z, scale); aBuild.setXYZW(i, b[0], b[1], b[2], b[3]); aState.setXYZW(i, 0.6, -1, -1, 0);
            this.nodeRefs.push({ structure: b[2] }); i++;
        };
        // Main crystals first, satellites after (reduced detail draws the prefix).
        for (let slot = 0; slot < NODE_COUNT; slot++) put(latticeNode(slot), 0.85, build(`node-${slot}`));
        for (let slot = 0; slot < NODE_COUNT; slot++) for (let k = 0; k < SATELLITES_PER_NODE; k++) put(latticeSatellite(slot, k), 0.4, build(`node-${slot}`));
        markAll(this.nodeAttr);
    }

    private writeRings(build: (id: string | null) => [number, number, number, number]): void {
        const { aRing, aBuild, aState } = this.ringAttr;
        this.ringRefs.length = 0;
        const seed = this.plan.seed;
        FENOM_RING_RADII.forEach((radius, k) => {
            const b = build(`ring-${k}`);
            // Seeded starting misalignment: the field the player pulls into one plane.
            const tiltX = (0.55 + 0.45 * (((seed >>> (k * 5)) & 31) / 31)) * (k % 2 ? -1 : 1);
            const tiltZ = (0.25 + 0.5 * (((seed >>> (k * 5 + 3)) & 31) / 31)) * (k === 1 ? -1 : 1);
            aRing.setXYZW(k, radius, tiltX, tiltZ, k); aBuild.setXYZW(k, b[0], b[1], b[2], b[3]); aState.setXYZW(k, 0.6, -1, -1, 0);
            this.ringRefs.push({ structure: b[2] });
        });
        this.rings.count = FENOM_RING_RADII.length;
        markAll(this.ringAttr);
    }

    private writeSeeders(): void {
        const { aSeed, aPathA, aPathB } = this.seederAttr;
        let i = 0;
        for (const side of [-1, 1] as const) {
            const core = seedCore(side);
            aSeed.setXYZW(i, SEEDER_KIND.core, side, 0, 0); aPathA.setXYZW(i, core.x, 0, core.z, 0); aPathB.setXYZW(i, core.x, 0, core.z, 0); i++;
        }
        for (const side of [-1, 1] as const) for (let seg = 0; seg < 2; seg++) {
            const core = seedCore(side);
            aSeed.setXYZW(i, SEEDER_KIND.arm, side, side * 3 + seg, seg); aPathA.setXYZW(i, core.x, 0, core.z, 0); aPathB.setXYZW(i, core.x, 0, core.z, 0); i++;
        }
        for (let unit = 0; unit < MAX_COLLECTORS_PER_SIDE; unit++) for (const side of [-1, 1] as const) for (let seg = 0; seg < COLLECTOR_SEGMENTS; seg++) {
            const from = materialNode(side, unit % MATERIAL_NODES_PER_SIDE), core = seedCore(side);
            aSeed.setXYZW(i, SEEDER_KIND.collector, side, unit + (side > 0 ? 50 : 0), seg);
            aPathA.setXYZW(i, from.x, 0, from.z, (unit * 0.137 + (side > 0 ? 0.5 : 0)) % 1);
            aPathB.setXYZW(i, core.x, 0, core.z, IDLE_SPEED);
            i++;
        }
        markAll(this.seederAttr);
    }

    private applyDetail(): void {
        const d = WORLD_DETAIL[this.detail];
        this.seeders.count = 2 + 4 + 2 * d.collectorsPerSide * COLLECTOR_SEGMENTS;
        this.nodes.count = NODE_COUNT * (d.satellites ? 1 + SATELLITES_PER_NODE : 1);
        this.flow.geometry.setDrawRange(0, d.flowPoints);
    }

    // ---- Per-frame and per-change work ------------------------------------------------------
    private updateField(time: number, snapshot: WorldInteractionSnapshot | null, anomaly: number): void {
        const plan = this.plan, encounter = plan.encounter, u = this.uniforms;
        const stage = encounterStageAt(plan, time);
        const progress = snapshot?.encounter ?? null;
        const presence = encounter ? anomaly : 0;
        // Alignment: anchors hit / total, eased from the previous value over the last sync hit.
        let alignment = 0;
        if (encounter && progress && progress.anchorsTotal > 0 && time >= encounter.syncStart) {
            const target = progress.anchorsHit / progress.anchorsTotal;
            const lastSync = snapshot ? lastReactionTime(snapshot, 'sync', time) : -Infinity;
            const from = Math.max(0, (progress.anchorsHit - 1) / progress.anchorsTotal);
            alignment = Number.isFinite(lastSync) ? from + (target - from) * smoothstep01((time - lastSync) / 0.8) : target;
        }
        const stability = stage === 'detection' ? 0.3 : progress ? progress.stability : 0.5;
        const stageCode = stage === 'detection' ? 1 : stage === 'synchronization' ? 2 : stage === 'resolution' ? 3 : 0;
        u.uField.value.set(presence, stability, alignment, stageCode);
        const shown = presence > 0.01;
        this.core.visible = shown;
        this.membrane.visible = shown && stageCode !== 1;
        this.coreScale.value = FENOM_CORE_RADIUS * (0.35 + 0.65 * smoothstep01(presence))
            * (1 + 0.07 * Math.sin(time * 2.3) * (1 - stability)) * (stageCode === 3 || (stageCode === 0 && encounter && time >= encounter.resolutionEnd) ? 1 - 0.25 * stability : 1);
        this.membraneAmount.value = presence * (stageCode >= 2 || (encounter && time >= encounter.resolutionEnd) ? 0.2 + 0.8 * stability : 0);
    }

    private updateReactions(snapshot: WorldInteractionSnapshot | null): void {
        const slots = this.uniforms.uReact.value, reactions = snapshot?.reactions ?? [];
        for (let k = 0; k < MAX_SHADER_REACTIONS; k++) {
            const r = reactions[reactions.length - 1 - k];
            if (r) slots[k].set(r.time, r.structure, REACTION_CODES[r.kind], r.grade === 'perfect' ? 1 : r.grade === 'good' ? 0.5 : 0);
            else slots[k].set(-1e6, -9, 0, 0);
        }
    }

    /** Player state into the instance state attributes; once per changed snapshot. */
    private writeState(snapshot: WorldInteractionSnapshot | null): void {
        this.lastSnapshot = snapshot;
        this.stateWrites++;
        const write = (refs: readonly InstanceRef[], attribute: THREE.InstancedBufferAttribute, count: number) => {
            for (let i = 0; i < count; i++) {
                const s = refs[i].structure;
                const valid = snapshot && s >= 0 && s < snapshot.structureQuality.length;
                attribute.setXYZW(i, valid ? snapshot.structureQuality[s] : 0.6, valid ? snapshot.structureEnergizedAt[s] : -1,
                    valid ? snapshot.structureFaultAt[s] : -1, 0);
            }
            attribute.clearUpdateRanges(); attribute.addUpdateRange(0, count * 4); attribute.needsUpdate = true;
        };
        write(this.bodyRefs, this.bodyAttr.aState, this.bodyRefs.length);
        write(this.beamRefs, this.beamAttr.aState, this.beamRefs.length);
        write(this.nodeRefs, this.nodeAttr.aState, this.nodeRefs.length);
        write(this.ringRefs, this.ringAttr.aState, this.ringRefs.length);
    }

    /**
     * Each side's collectors serve the structure being built there (or the next one within 3 s);
     * idle units shuttle between their material and the seed core. Paths are rewritten only when a
     * side's target changes, so a seek lands on the same paths as continuous play.
     */
    private updateSeeders(time: number): void {
        for (const side of [-1, 1] as const) {
            const target = this.seederTargetAt(side, time);
            const key = side < 0 ? 0 : 1;
            if (target === this.seederTarget[key]) continue;
            this.seederTarget[key] = target;
            this.pathWrites++;
            const structure = target >= 0 ? this.plan.structures[target] : null;
            const point = structure ? assemblyPoint(structure) : seedCore(side);
            const speed = structure ? 0.24 : IDLE_SPEED;
            const { aSeed, aPathB } = this.seederAttr;
            for (let i = 0; i < SEEDER_CAPACITY; i++) {
                if (aSeed.getY(i) !== side || aSeed.getX(i) === SEEDER_KIND.core) continue;
                const unitSpeed = aSeed.getX(i) === SEEDER_KIND.collector ? speed * (0.85 + 0.05 * (aSeed.getZ(i) % 6)) : (structure ? 1 : 0);
                aPathB.setXYZW(i, point.x, point.y, point.z, unitSpeed);
            }
            aPathB.clearUpdateRanges(); aPathB.addUpdateRange(0, SEEDER_CAPACITY * 4); aPathB.needsUpdate = true;
        }
    }

    private seederTargetAt(side: -1 | 1, time: number): number {
        let best = -1, bestStart = Infinity;
        for (const s of this.plan.structures) {
            if (!s.scheduled || s.prebuilt || !(s.kind === 'pylon' || s.kind === 'conduit' || s.kind === 'rib')) continue;
            if ((s.slot % 2 === 0 ? -1 : 1) !== side) continue;
            if (time > s.buildEnd || time < s.buildStart - 3) continue;
            if (s.buildStart < bestStart) { best = s.index; bestStart = s.buildStart; }
        }
        return best;
    }

    private updateDrones(time: number, mix: MutableWorldCharacter, surge: WorldEvent | null, surgeEnvelope: number,
        scan: WorldEvent | null, scanEnvelope: number, snapshot: WorldInteractionSnapshot | null): void {
        const presence = Math.max(mix.construction, mix.lattice, mix.anomaly);
        const count = presence < 0.05 ? 0 : WORLD_DETAIL[this.detail].drones;
        this.drones.count = count;
        if (!count) return;
        const encounter = this.plan.encounter;
        const fieldWeight = encounter
            ? smoothstep01((time - encounter.syncStart + 1) / 2) * (1 - smoothstep01((time - encounter.resolutionEnd) / 2)) : 0;
        const detectionWeight = encounter ? smoothstep01((time - encounter.detectionStart) / 2) * (1 - smoothstep01((time - encounter.syncStart) / 1)) : 0;
        const field = this.uniforms.uField.value.z;
        const formation = surge && surge.variant === 1 ? surgeEnvelope : 0;
        // A player achievement (energy, signal, sync) sends one drone to inspect / feed the structure.
        const achievement = this.latestAchievement(snapshot, time);
        if (achievement) {
            const structure = this.plan.structures[achievement.structure];
            const anchor = structure ? structureAnchor(structure.kind, structure.slot) : layoutFenom();
            this.d.x = anchor.x * 0.9; this.d.y = Math.max(anchor.y + 2.5, 5.2); this.d.z = anchor.z + 1.2;
        }
        const courier = achievement ? (achievement.structure * 7 + 3) % count : -1;
        const courierWeight = achievement ? smoothstep01((time - achievement.time) / 0.35) * (1 - smoothstep01((time - achievement.time - 1.1) / 0.6)) : 0;
        for (let i = 0; i < count; i++) {
            this.dronePosition(i, count, time, field, formation, surge, scan, scanEnvelope, fieldWeight, detectionWeight, this.a);
            this.dronePosition(i, count, time + 0.05, field, formation, surge, scan, scanEnvelope, fieldWeight, detectionWeight, this.next);
            if (i === courier) { lerp(this.a, this.d, courierWeight); lerp(this.next, this.d, courierWeight); }
            const dx = this.next.x - this.a.x, dy = this.next.y - this.a.y, dz = this.next.z - this.a.z;
            this.euler.set(-Math.atan2(dy, Math.hypot(dx, dz) + 1e-6), Math.atan2(-dx, -dz), Math.sin(time * 1.3 + i) * 0.25);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(Math.min(1, presence * 1.5));
            this.position.set(this.a.x, this.a.y, this.a.z);
            this.drones.setMatrixAt(i, this.matrix.compose(this.position, this.quaternion, this.scale));
        }
        this.drones.instanceMatrix.clearUpdateRanges();
        this.drones.instanceMatrix.addUpdateRange(0, count * 16);
        this.drones.instanceMatrix.needsUpdate = true;
    }

    /** The latest energize / signal / sync reaction still being answered at `time` (1.7 s). */
    private latestAchievement(snapshot: WorldInteractionSnapshot | null, time: number): WorldReaction | null {
        const reactions = snapshot?.reactions ?? [];
        for (let i = reactions.length - 1; i >= 0; i--) {
            const r = reactions[i];
            if (r.time > time) continue;
            if (time - r.time > 1.7) return null;
            if (r.kind === 'energize' || r.kind === 'signal' || r.kind === 'sync') return r;
        }
        return null;
    }

    /** Pure blend of the drone roles at a song time (every role stays above the clearance). */
    private dronePosition(i: number, count: number, time: number, alignment: number, formation: number, surge: WorldEvent | null,
        scan: WorldEvent | null, scanEnvelope: number, fieldWeight: number, detectionWeight: number, out: Vec3): Vec3 {
        dronePatrol(i, time, out);
        if (scan && scanEnvelope > 0 && i % 3 === scan.variant % 3) {
            droneScan(i, (time - scan.time) / scan.duration, scan.variant, this.b);
            lerp(out, this.b, scanEnvelope);
        }
        if (formation > 0) { droneFormation(i, count, time, surge?.variant ?? 0, this.b); lerp(out, this.b, formation); }
        const towardField = Math.max(fieldWeight, i % 2 === 0 ? 0.5 * detectionWeight : 0);
        if (towardField > 0) { droneField(i, count, time, alignment, this.c); lerp(out, this.c, towardField); }
        return out;
    }
}

function layoutFenom(): Vec3 { return { x: FENOM_CENTRE.x, y: FENOM_CENTRE.y, z: FENOM_CENTRE.z }; }

function lerp(out: Vec3, to: Vec3, t: number): void {
    out.x += (to.x - out.x) * t; out.y += (to.y - out.y) * t; out.z += (to.z - out.z) * t;
}

function lastReactionTime(snapshot: WorldInteractionSnapshot, kind: WorldReactionKind, time: number): number {
    for (let i = snapshot.reactions.length - 1; i >= 0; i--) {
        const r = snapshot.reactions[i];
        if (r.kind === kind && r.time <= time) return r.time;
    }
    return -Infinity;
}

/** Where the Seeder units assemble a structure: a pylon's or conduit's base, a rib's pylon top. */
export function assemblyPoint(structure: WorldStructure): Vec3 {
    switch (structure.kind) {
        case 'pylon': return pylonBase(structure.slot);
        case 'conduit': { const seg = conduitSegments(structure.slot)[0]; return { x: (seg[0].x + seg[1].x) / 2, y: 0, z: seg[0].z }; }
        case 'rib': { const r = ribCentre(structure.slot); return { x: (structure.slot % 2 === 0 ? -1 : 1) * PYLON_X, y: PYLON_HEIGHT, z: r.z }; }
        default: return latticeAnchor(structure.slot);
    }
}

function markAll(attributes: Record<string, THREE.InstancedBufferAttribute>): void {
    for (const attribute of Object.values(attributes)) { attribute.clearUpdateRanges(); attribute.needsUpdate = true; }
}

/** The hall floor: two plates beside the corridor, authored in stage coordinates (shader reads them). */
function createFloorGeometry(): THREE.BufferGeometry {
    const plate = (side: number) => {
        const width = WALL_X - FLOOR_INNER_X, depth = HALL_NEAR_Z - HALL_FAR_Z;
        return new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2)
            .translate(side * (FLOOR_INNER_X + width / 2), -0.01, (HALL_NEAR_Z + HALL_FAR_Z) / 2);
    };
    const left = plate(-1), right = plate(1);
    const positions = new Float32Array([...(left.toNonIndexed().getAttribute('position').array as Float32Array),
        ...(right.toNonIndexed().getAttribute('position').array as Float32Array)]);
    left.dispose(); right.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

/** Egis flow points: deterministic spiral arms (no randomness), authored once. */
function createFlowGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const a = new Float32Array(MAX_FLOW * 4), b = new Float32Array(MAX_FLOW * 4);
    for (let i = 0; i < MAX_FLOW; i++) {
        const h = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
        const arm = i % 3;
        const radius = FLOW_INNER_RADIUS + (FLOW_OUTER_RADIUS - FLOW_INNER_RADIUS) * Math.pow(h(1), 0.8);
        a.set([radius, arm * (Math.PI * 2 / 3) + (h(2) - 0.5) * 0.7, (h(3) - 0.5) * 1.6, 0.6 + 0.6 * h(4)], i * 4);
        b.set([arm, 0.09 + 0.14 * h(5), h(6) * 6.283, 0.35 + 0.65 * h(7)], i * 4);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_FLOW * 3), 3));
    geometry.setAttribute('aFlowA', new THREE.BufferAttribute(a, 4));
    geometry.setAttribute('aFlowB', new THREE.BufferAttribute(b, 4));
    return geometry;
}
