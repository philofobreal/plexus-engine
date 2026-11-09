/** WH-07b4 laboratory only. Native WebM-style frame submission through the
 * library's supported encoded-packet hook, retaining product MP4 audio/OPFS/mux.
 * No global codec replacement and no second render or audio owner. */
import '../../src/export/mp4-export.worker';
import { CustomVideoEncoder, EncodedPacket, registerEncoder, type VideoSample } from 'mediabunny';

type InputObservation = { config: VideoEncoderConfig; decoderConfig?: VideoDecoderConfig;
    inputs: { timestamp: number; duration: number | null; id: number; bars: number[] }[];
    packets: { data: Uint8Array; type: string; timestamp: number; duration: number }[] };
type InputObserver = (report: InputObservation, transfer: Transferable[]) => void;
let inputObserver: InputObserver | undefined;
type DetailProfile = 'reference' | 'detail' | 'text' | 'variable' | 'predictive-detail';
let detailProfile: DetailProfile = 'reference';
/** Laboratory channel only; capture callback before a new codec instance starts. */
export function observeNativeInputs(observer?: InputObserver, profile: DetailProfile = 'reference') {
    if (!['reference', 'detail', 'text', 'variable', 'predictive-detail'].includes(profile)) throw Error('Invalid detail profile');
    inputObserver = observer; detailProfile = profile;
}

export class NativePacketEncoder extends CustomVideoEncoder {
    static supports(codec: string, config: VideoEncoderConfig) {
        return codec === 'vp9' && /^vp09\.02\.\d{2}\.10(?:\.|$)/.test(config.codec)
            && config.alpha !== 'keep';
    }
    private encoder?: VideoEncoder;
    private failure?: Error;
    private active = false;
    private wake?: (error?: Error) => void;
    private observe?: InputObserver;
    private observation?: InputObservation;
    private probeCanvas?: OffscreenCanvas;
    private probeBytes = 0;
    private predictive = false;
    private submitted = 0;
    init() {
        if (this.encoder || !Number.isFinite(this.config.framerate) || this.config.framerate! <= 0) {
            throw Error('Native packet encoder requires one initialization and a frame rate');
        }
        this.active = true;
        this.observe = inputObserver;
        this.predictive = detailProfile === 'predictive-detail';
        const effective: VideoEncoderConfig & { contentHint?: string } = { ...this.config, alpha: 'discard',
            ...(this.observe && detailProfile === 'variable' ? { bitrateMode: 'variable' as const } : {}),
            ...(this.predictive ? { contentHint: 'detail' } : this.observe && ['detail', 'text'].includes(detailProfile) ? { contentHint: detailProfile } : {}) };
        if (this.observe) this.observation = { config: effective, inputs: [], packets: [] };
        this.encoder = new VideoEncoder({ error: e => this.fail(e), output: (chunk, metadata) => {
            if (!this.active) return;
            try {
                // Constructor options omit duration. A library-backed VideoFrame
                // may inherit it; the separate no-duration probe isolates that.
                // Packet duration is independently defined by fps.
                const packet = EncodedPacket.fromEncodedChunk(chunk).clone({ duration: 1 / this.config.framerate! });
                if (this.observation) {
                    this.probeBytes += packet.data.byteLength;
                    if (this.observation.packets.length >= 63 || this.probeBytes > 64 * 1024 * 1024) throw Error('Input observation packet bound');
                    this.observation.packets.push({ data: packet.data.slice(), type: packet.type,
                        timestamp: Math.round(packet.timestamp * 1e6), duration: Math.round(packet.duration * 1e6) });
                    if (metadata?.decoderConfig) this.observation.decoderConfig = metadata.decoderConfig;
                }
                this.onPacket(packet, metadata);
            } catch (error) { this.fail(error instanceof Error ? error : Error(String(error))); }
        } });
        try { this.encoder.configure(effective); }
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
        try {
            if (this.observation) {
                if (this.observation.inputs.length >= 63) throw Error('Input observation picture bound');
                this.probeCanvas ??= new OffscreenCanvas(192, 32);
                const ctx = this.probeCanvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw Error('Input observation surface unavailable');
                ctx.drawImage(frame, 0, 0);
                const bars = Array.from({ length: 6 }, (_, bit) => ctx.getImageData(bit * 32 + 16, 16, 1, 1).data[0]);
                this.observation.inputs.push({ timestamp: frame.timestamp, duration: frame.duration ?? null,
                    id: bars.reduce((id, value, bit) => value > 128 ? id | (1 << bit) : id, 0), bars });
            }
            if (this.predictive && Math.round(sample.timestamp * this.config.framerate!) !== this.submitted) throw Error('Noncontiguous predictive picture');
            this.encoder!.encode(frame, this.predictive ? { ...options, keyFrame: this.submitted % Math.round(this.config.framerate!) === 0 } : options);
            this.submitted++;
        } finally { frame.close(); }
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
        if (this.observation) {
            const report = this.observation; this.observation = undefined;
            this.observe?.(report, report.packets.map(packet => packet.data.buffer as ArrayBuffer));
        }
    }
    close() {
        this.active = false; this.wake?.(Error('Native packet encoder closed'));
        if (this.encoder && this.encoder.state !== 'closed') this.encoder.close();
        if (this.probeCanvas) this.probeCanvas.width = this.probeCanvas.height = 1;
        this.observation = undefined; this.observe = undefined;
    }
}
registerEncoder(NativePacketEncoder);

if (typeof self !== 'undefined') {
    const receive = self.onmessage;
    self.onmessage = event => {
        if (event.data?.type === 'wh07_configure_predictive') {
            if (event.data.profile !== 'predictive-detail' || event.data.observe !== false) throw Error('Invalid predictive configuration');
            observeNativeInputs(undefined, 'predictive-detail');
        } else if (event.data?.type === 'wh07_observe_inputs') {
            if (event.data.enabled !== true) throw Error('Invalid input observation request');
            observeNativeInputs((report, transfer) => (self as unknown as {
                postMessage(message: unknown, transfer: Transferable[]): void;
            }).postMessage({ type: 'wh07_input_observation', report }, transfer), event.data.profile ?? 'reference');
        } else receive?.call(self, event);
    };
}
