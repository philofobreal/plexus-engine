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
