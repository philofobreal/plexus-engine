/** WH-07b experiment only. Reuses one padded GPU presentation surface instead of
 * resizing it three times per frame. Native per-layer Canvas blending is retained.
 * Imported only by the opt-in browser laboratory, never by a product entrypoint.
 */
import { WormholeGpuRaster } from '../../src/visuals/gpu/WormholeGpuRaster';
import '../../src/visuals/wormholeHostRender.worker';

WormholeGpuRaster.prototype.compositeExactMaterial = function(material, destination) {
    const raster = this as any;
    if (raster.disposed || this.gl.isContextLost()) throw Error('GPU raster unavailable');
    if (!material) return;
    const gl = this.gl, layers = raster.prepareMaterial(material), ctx = destination.getContext('2d');
    if (!ctx) throw Error('Exact composition target unavailable');
    const width = material.cols + 2, height = material.rows + 2;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    ctx.save();
    try {
        ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1;
        ctx.globalCompositeOperation='lighter'; ctx.imageSmoothingEnabled=true;
        for (const i of [2,1,0]) {
            const layer = layers[i], w = layer.width, h = layer.height;
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER,layer.buffer); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
            // Duplicate one edge texel: scaling must not sample an adjacent/stale atlas area.
            for (const [sx0,sx1,dx0,dx1] of [[0,w,1,w+1],[0,1,0,1],[w-1,w,w+1,w+2]]) {
                for (const [sy0,sy1,dy0,dy1] of [[0,h,1,h+1],[0,1,0,1],[h-1,h,h+1,h+2]]) {
                    gl.blitFramebuffer(sx0,sy0,sx1,sy1,dx0,dy0,dx1,dy1,gl.COLOR_BUFFER_BIT,gl.NEAREST);
                }
            }
            raster.check();
            ctx.drawImage(this.canvas,1,height-h-1,w,h,0,0,destination.width,destination.height);
        }
    } finally { ctx.restore(); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
};
