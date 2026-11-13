import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output } from 'mediabunny';
import { vp9KeyPictureBitDepth } from './codec-isolation.mjs';

export const vp9Probe = Object.freeze({
    width: 1280, height: 720, fps: 30, frames: 30, maxBytes: 8 * 1024 * 1024,
    maxHeapBytes: 128 * 1024 * 1024, codec: 'vp09.02.40.10.01.01.01.01.00',
});

export async function encodeVp9Probe(core, { progress } = {}) {
    const {width, height, fps, frames, codec, maxBytes, maxHeapBytes} = vp9Probe;
    const source = new EncodedVideoPacketSource('vp9');
    const target = new BufferTarget();
    const output = new Output({target, format:new Mp4OutputFormat({fastStart:'in-memory'})});
    output.addVideoTrack(source, {frameRate:fps});
    const decoderConfig = {codec, codedWidth:width, codedHeight:height,
        colorSpace:{primaries:'bt709', transfer:'bt709', matrix:'bt709', fullRange:false}};
    const stats = {encodedFrames:0, encodedBytes:0, encodedBitDepth:10, wasmLinearMemoryBytes:0,
        inputMs:0, encodeMs:0, muxMs:0};
    const packetSizes = [];
    const begin = performance.now();
    function check(code, phase) {
        if (code !== 0) {
            const detail = core.UTF8ToString(core._probe_error());
            throw Error('libvpx ' + phase + ' failed (' + code + '): ' + detail);
        }
        const bytes = core.HEAPU8.buffer.byteLength;
        if (bytes > maxHeapBytes) throw Error('WASM memory exceeded the probe budget');
        stats.wasmLinearMemoryBytes = Math.max(stats.wasmLinearMemoryBytes, bytes);
    }
    async function drain() {
        while (core._probe_next_packet()) {
            const index = core._probe_packet_index();
            const offset = core._probe_packet_data();
            const length = core._probe_packet_size();
            const heap = core.HEAPU8;
            if (index !== stats.encodedFrames || index >= frames || !core._probe_packet_is_key()) {
                throw Error('Unexpected VP9 picture order or frame type');
            }
            if (offset <= 0 || length <= 0 || offset + length > heap.byteLength || stats.encodedBytes + length > maxBytes) {
                throw Error('VP9 packet exceeds the probe bounds');
            }
            const packet = heap.slice(offset, offset + length);
            if (vp9KeyPictureBitDepth(packet) !== 10) throw Error('Expected a 10-bit VP9 key picture');
            stats.encodedFrames++;
            stats.encodedBytes += length;
            packetSizes.push(length);
            const beginMux = performance.now();
            await source.add(new EncodedPacket(packet, 'key', index / fps, 1 / fps),
                index === 0 ? {decoderConfig} : undefined);
            stats.muxMs += performance.now() - beginMux;
        }
    }
    let opened = false;
    try {
        const openCode = core._probe_open();
        opened = openCode === 0;
        check(openCode, 'open');
        await output.start();
        for (let i = 0; i < frames; i++) {
            const beginInput = performance.now();
            check(core._probe_fill(i), 'input');
            stats.inputMs += performance.now() - beginInput;
            const beginEncode = performance.now();
            check(core._probe_encode(i), 'encode');
            stats.encodeMs += performance.now() - beginEncode;
            await drain();
            progress?.(stats.encodedFrames);
        }
        const flushStart = performance.now();
        check(core._probe_encode(-1), 'flush');
        stats.encodeMs += performance.now() - flushStart;
        await drain();
        if (stats.encodedFrames !== frames) throw Error('Incomplete VP9 encode');
        const meanBitsPerSecond = stats.encodedBytes * 8 * fps / frames;
        const maxFourPictureBits = Math.max(...packetSizes.map((_, i) =>
            packetSizes.slice(i, i + 4).reduce((sum, size) => sum + size * 8, 0)));
        if (meanBitsPerSecond > 18_000_000 || maxFourPictureBits > 16_000_000) {
            throw Error('Sampled VP9 payload exceeds level 4.0 (' + meanBitsPerSecond + ' bit/s)');
        }
        source.close();
        const beginMux = performance.now();
        await output.finalize();
        stats.muxMs += performance.now() - beginMux;
        if (!target.buffer?.byteLength || target.buffer.byteLength > maxBytes) throw Error('MP4 exceeds the probe bounds');
        return {buffer:target.buffer, stats:{...stats, meanBitsPerSecond, maxFourPictureBits, fileBytes:target.buffer.byteLength,
            totalMs:performance.now() - begin, encoder:'libvpx 1.17.0 / WASM scalar / one thread',
            width, height, fps, codec, audio:false}};
    } finally {
        if (opened) core._probe_close();
        if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    }
}

const probeBinaries = {
    scalar: {name:'vp9-10bit-probe.wasm', sha256:'a64f6d0f7be179a509177a6c79784fc05364e5aa1c54cf40579906095f4c03cb'},
    simd: {name:'vp9-10bit-probe-simd.wasm', sha256:'90054c5d31643beb149be4ec63d0be6b2121d146b74818febc3ee01f922effb1'},
};

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
    let started = false;
    self.onmessage = async ({data}) => {
        if (data?.type !== 'wasm_codec_probe' || started) return;
        started = true;
        try {
            const variant = data.variant ?? 'scalar';
            if (variant !== 'scalar' && variant !== 'simd') throw Error('Unknown WASM encoder variant');
            const binary = probeBinaries[variant];
            const directory = new URL(import.meta.env.BASE_URL + 'export/libvpx-1.17.0/', self.location.origin);
            const loadStart = performance.now();
            const {default:createCore} = await import(/* @vite-ignore */ new URL('vp9-10bit-probe.mjs', directory).href);
            const response = await fetch(new URL(binary.name, directory));
            if (!response.ok) throw Error('WASM binary download failed (HTTP ' + response.status + ')');
            const bytes = await response.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
            if (sha256 !== binary.sha256) throw Error('WASM binary hash does not match the requested variant');
            if (!WebAssembly.validate(bytes)) throw Error('The browser cannot run this WASM variant');
            const core = await createCore({wasmBinary:new Uint8Array(bytes)});
            const loadMs = performance.now() - loadStart;
            const {buffer, stats} = await encodeVp9Probe(core, {progress:frames => self.postMessage({type:'progress',frames})});
            self.postMessage({type:'complete', stats:{...stats, loadMs, variant, wasmSha256:sha256,
                encoder:'libvpx 1.17.0 / WASM ' + (variant === 'simd' ? 'SIMD128' : 'scalar') + ' / one thread'}, buffer}, [buffer]);
        } catch (error) {
            self.postMessage({type:'error', message:String(error?.message ?? error).slice(0, 400)});
        }
    };
}
