export interface VisualRendererBackend {
    readonly width: number;
    readonly height: number;
    readonly frameCount: number;
    background(r: number, g: number, b: number, a?: number): void;
    noStroke(): void;
    noFill(): void;
    fill(r: number, g: number, b: number, a?: number): void;
    stroke(r: number, g: number, b: number, a?: number): void;
    strokeWeight(weight: number): void;
    line(x1: number, y1: number, x2: number, y2: number): void;
    circle(x: number, y: number, diameter: number): void;
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
    beginShape(): void;
    vertex(x: number, y: number): void;
    endShape(): void;
    radialGlow(cx: number, cy: number, radius: number, color: [number, number, number], alpha: number): void;
    radialDim(cx: number, cy: number, innerRadius: number, outerRadius: number, alpha: number): void;
    compositeRingTint(
        cx: number,
        cy: number,
        innerRadius: number,
        outerRadius: number,
        color: [number, number, number],
        alpha: number,
        mode: RingTintCompositeMode,
        startAngle?: number,
        endAngle?: number
    ): void;
    /** Renderer-owned, reused RGBA float scratch for one generic material layer. Null when the backend
     *  refuses the request (too large, or no raster capability). The identity fills it and must
     *  not retain it beyond the matching drawFieldRaster call. */
    beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null;
    /** Blits the material layer filled by the matching beginFieldRaster into the destination rect, in the
     *  same user/CSS pixel space every other primitive uses. */
    drawFieldRaster(
        layer: 0 | 1 | 2,
        dstX: number, dstY: number, dstW: number, dstH: number,
        gain: number,
        blend: FieldRasterBlendMode
    ): void;
}

export type RingTintCompositeMode = 'saturation' | 'overlay' | 'screen' | 'soft-light';

export type FieldRasterBlendMode = 'source-over' | 'screen' | 'lighter';

/** Renderer-only composition seam. Identities receive only VisualRendererBackend. */
export interface RenderTargetCompositor {
    readonly outgoingBackend: VisualRendererBackend;
    readonly incomingBackend: VisualRendererBackend;
    beginFrame(generation: number, width: number, height: number): void;
    composite(alpha: number): void;
}

export interface SceneNode {
    x: number;
    y: number;
    size: number;
}

export interface SceneLink {
    from: SceneNode;
    to: SceneNode;
    alpha: number;
    weight: number;
}

export interface SceneTriangle {
    a: SceneNode;
    b: SceneNode;
    c: SceneNode;
    alpha: number;
}

export interface PlexusSceneGeometry {
    nodes: SceneNode[];
    links: SceneLink[];
    triangles: SceneTriangle[];
}

export function drawPlexusSceneGeometry(
    backend: VisualRendererBackend,
    scene: PlexusSceneGeometry,
    colors: {
        node: [number, number, number];
        line: [number, number, number];
        triangle: [number, number, number];
    }
) {
    for (const link of scene.links) {
        backend.stroke(colors.line[0], colors.line[1], colors.line[2], link.alpha);
        backend.strokeWeight(link.weight);
        backend.line(link.from.x, link.from.y, link.to.x, link.to.y);
    }

    for (const triangle of scene.triangles) {
        backend.fill(colors.triangle[0], colors.triangle[1], colors.triangle[2], triangle.alpha);
        backend.noStroke();
        backend.triangle(
            triangle.a.x,
            triangle.a.y,
            triangle.b.x,
            triangle.b.y,
            triangle.c.x,
            triangle.c.y
        );
    }

    for (const node of scene.nodes) {
        backend.noStroke();
        backend.fill(colors.node[0], colors.node[1], colors.node[2], 255);
        backend.circle(node.x, node.y, node.size);
    }
}
