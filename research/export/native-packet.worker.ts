/** WH-07b4 laboratory only. Native WebM-style frame submission through the
 * library's supported encoded-packet hook, retaining product MP4 audio/OPFS/mux.
 * No global codec replacement and no second render or audio owner. */
import '../../src/export/mp4-export.worker';
import { CustomVideoEncoder, EncodedPacket, registerEncoder, type VideoSample } from 'mediabunny';

export class NativePacketEncoder extends CustomVideoEncoder {
    static supports(codec: string, config: VideoEncoderConfig) {
        return codec === 'vp9' && /^vp09\.02\.\d{2}\.10(?:\.|$)/.test(config.codec)
            && config.alpha !== 'keep';
    }
    private encoder?: VideoEncoder;
    private failure?: Error;
    private active = false;
    private wake?: (error?: Error) => void;
    init() {
        if (this.encoder || !Number.isFinite(this.config.framerate) || this.config.framerate! <= 0) {
            throw Error('Native packet encoder requires one initialization and a frame rate');
        }
        this.active = true;
        this.encoder = new VideoEncoder({ error: e => this.fail(e), output: (chunk, metadata) => {
            if (!this.active) return;
            try {
                // Constructor options omit duration. A library-backed VideoFrame
                // may inherit it; the separate no-duration probe isolates that.
                // Packet duration is independently defined by fps.
                const packet = EncodedPacket.fromEncodedChunk(chunk).clone({ duration: 1 / this.config.framerate! });
                this.onPacket(packet, metadata);
            } catch (error) { this.fail(error instanceof Error ? error : Error(String(error))); }
        } });
        try { this.encoder.configure({ ...this.config, alpha: 'discard' }); }
        catch (error) { this.close(); throw error; }
    }
    private fail(error: Error) {
        if (!this.active) return;
        this.failure ??= error; this.wake?.(this.failure);
    }
    private check() {
        if (this.failure) throw this.failure;
        if (!this.active || !this.encoder) throw Error('Native packet encoder is closed');
    }
    async encode(sample: VideoSample, options: VideoEncoderEncodeOptions) {
        this.check();
        const frame = new VideoFrame(sample.toCanvasImageSource(), { timestamp: Math.round(sample.timestamp * 1e6) });
        try { this.encoder!.encode(frame, options); } finally { frame.close(); }
        // Match the existing library's four-entry native admission bound. The
        // browser's internal codec resources are opaque, not counted as RAM usage.
        if (this.encoder!.encodeQueueSize >= 4) await new Promise<void>((resolve, reject) => {
            const encoder = this.encoder!;
            const finish = (error?: Error) => {
                clearTimeout(timer); encoder.removeEventListener('dequeue', dequeued);
                this.wake = undefined; error ? reject(error) : resolve();
            };
            const dequeued = () => { if (encoder.encodeQueueSize < 4) finish(); };
            const timer = setTimeout(() => finish(Error('Native packet admission timed out')), 10000);
            this.wake = finish; encoder.addEventListener('dequeue', dequeued);
            if (this.failure) finish(this.failure); else dequeued();
        });
        this.check();
    }
    async flush() {
        this.check(); await this.encoder!.flush(); this.check();
    }
    close() {
        this.active = false; this.wake?.(Error('Native packet encoder closed'));
        if (this.encoder && this.encoder.state !== 'closed') this.encoder.close();
    }
}
registerEncoder(NativePacketEncoder);
