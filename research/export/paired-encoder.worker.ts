/** WH-07b laboratory only: two native codecs for independent VP9 key pictures.
 * Never imported by a product entrypoint. Inter-predicted probe frames remain
 * on the first encoder; picture order is restored before the existing muxer.
 */
import '../../src/export/mp4-export.worker';

const Native = globalThis.VideoEncoder;
export class PairedEncoder extends EventTarget {
    static isConfigSupported(config: VideoEncoderConfig) { return Native.isConfigSupported(config); }
    private config!: VideoEncoderConfig;
    private readonly init: VideoEncoderInit;
    private encoders: VideoEncoder[] = [];
    private order: number[] = [];
    private ready = new Map<number, [EncodedVideoChunk, EncodedVideoChunkMetadata | undefined]>();
    private independent = 0;
    private generation = 0;
    state: CodecState = 'unconfigured';
    ondequeue: ((event: Event) => void) | null = null;
    constructor(init: VideoEncoderInit) { super(); this.init = init; }
    // Include pictures already accepted by a native codec but not emitted yet.
    // The existing library's four-picture backpressure therefore bounds reorder memory.
    get encodeQueueSize() { return this.order.length; }
    configure(config: VideoEncoderConfig) {
        if (!config.codec.startsWith('vp09.02.')) throw Error('Paired research requires VP9 profile 2');
        this.config = {...config}; this.state = 'configured'; this.makeEncoder();
    }
    private makeEncoder() {
        const epoch = this.generation;
        const encoder = new Native({error:e=>{if(epoch===this.generation)this.init.error(e);},output:(chunk,metadata)=>{
            if(epoch!==this.generation)return;
            this.ready.set(chunk.timestamp,[chunk,metadata]);
            while(this.order.length && this.ready.has(this.order[0])) {
                const timestamp=this.order.shift()!, packet=this.ready.get(timestamp)!;
                this.ready.delete(timestamp); this.init.output(...packet);
            }
            if(this.order.length<4){const event=new Event('dequeue');this.dispatchEvent(event);this.ondequeue?.(event);}
        }});
        encoder.configure(this.config); this.encoders.push(encoder); return encoder;
    }
    encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions) {
        if(this.order.length>=4)throw Error('Paired research picture bound exceeded');
        this.order.push(frame.timestamp);
        const index = options?.keyFrame ? this.independent++ % 2 : 0;
        (this.encoders[index] ?? this.makeEncoder()).encode(frame,options);
    }
    async flush() {
        await Promise.all(this.encoders.map(e=>e.flush()));
        if(this.order.length || this.ready.size)throw Error('Paired research has missing output pictures');
    }
    reset() { this.release(); this.state='unconfigured'; }
    close() { this.release(); this.state='closed'; }
    private release() {
        this.generation++; for(const encoder of this.encoders)if(encoder.state!=='closed')encoder.close();
        this.encoders=[];this.order=[];this.ready.clear();this.independent=0;
    }
}
globalThis.VideoEncoder = PairedEncoder as unknown as typeof VideoEncoder;
