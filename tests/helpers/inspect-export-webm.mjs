// Independent acceptance reader for the exporter's un-laced VP8/VP9 + Opus WebM.
// Not a general demuxer. The browser caller caps the whole-file copy at 64 MiB.
export function inspectExportWebM(bytes, { frames, fps }) {
    const fail = message => { throw new Error(`WebM inspection: ${message}`); };
    const uint = (a, b) => { let n = 0; for (; a < b; a++) n = n * 256 + bytes[a]; return n; };
    const vint = (at, id = false) => {
        const first = bytes[at]; let width = 1, mask = 128;
        while (width <= 8 && !(first & mask)) { width++; mask >>= 1; }
        if (width > 8 || at + width > bytes.length) fail('invalid integer');
        let value = id ? first : first & (mask - 1), unknown = !id && value === mask - 1;
        for (let i = 1; i < width; i++) { value = value * 256 + bytes[at + i]; unknown &&= bytes[at + i] === 255; }
        return { width, value, unknown };
    };
    const elements = (a, end, visit) => {
        while (a < end) {
            const id = vint(a, true), size = vint(a + id.width), start = a + id.width + size.width;
            const stop = size.unknown && id.value === 0x18538067 ? end : start + size.value;
            if (!Number.isSafeInteger(stop) || stop > end || stop < start) fail('truncated element');
            visit(id.value, start, stop); a = stop;
        }
    };
    const video = [], audio = []; let delayMs = 0, preSkipMs = 0;
    const block = (a, b, clock, paddingMs = 0) => {
        if (b - a < 5 || (bytes[a] !== 0x81 && bytes[a] !== 0x82) || (bytes[a + 3] & 6)) fail('unsupported block');
        const relative = new DataView(bytes.buffer, bytes.byteOffset + a + 1, 2).getInt16(0);
        const time = clock + relative;
        if (bytes[a] === 0x81) video.push(time);
        else {
            const toc = bytes[a + 4], config = toc >> 3, code = toc & 3;
            const ms = config >= 16 ? 2.5 * 2 ** (config & 3) : config >= 12 ? 10 * 2 ** (config & 1) : [10, 20, 40, 60][config & 3];
            const count = code === 0 ? 1 : code < 3 ? 2 : bytes[a + 5] & 63;
            if (!count || ms * count > 120) fail('invalid Opus packet duration');
            audio.push({ time, duration: ms * count, paddingMs });
        }
    };
    const walk = (a, b) => elements(a, b, (id, start, end) => {
        if ([0x18538067, 0x1654ae6b, 0xae].includes(id)) walk(start, end);
        else if (id === 0x56aa) delayMs = uint(start, end) / 1e6;
        else if (id === 0x63a2) {
            if (end - start !== 19 || String.fromCharCode(...bytes.subarray(start, start + 8)) !== 'OpusHead') fail('missing OpusHead');
            preSkipMs = (bytes[start + 10] + bytes[start + 11] * 256) / 48;
        } else if (id === 0x1f43b675) {
            let clock = 0;
            elements(start, end, (child, x, y) => {
                if (child === 0xe7) clock = uint(x, y);
                else if (child === 0xa3) block(x, y, clock);
                else if (child === 0xa0) {
                    let range, padding = 0;
                    elements(x, y, (g, u, v) => { if (g === 0xa1) range = [u, v]; if (g === 0x75a2) padding = uint(u, v) / 1e6; });
                    if (!range) fail('missing grouped block'); block(...range, clock, padding);
                }
            });
        }
    });
    walk(0, bytes.length);
    if (video.length !== frames || !audio.length) fail(`track count ${video.length}/${frames}, audio ${audio.length}`);
    video.forEach((time, i) => { if (Math.abs(time - i * 1000 / fps) > 1) fail(`video discontinuity at ${i}`); });
    if (Math.abs(audio[0].time) > 1 || Math.abs(delayMs - preSkipMs) > .001) fail('audio origin/codec delay');
    for (let i = 1; i < audio.length; i++) if (Math.abs(audio[i].time - audio[i - 1].time - audio[i - 1].duration) > 1) fail(`audio discontinuity at ${i}`);
    const last = audio.at(-1), audioEndMs = last.time + last.duration - delayMs - last.paddingMs;
    if (Math.abs(audioEndMs - frames * 1000 / fps) > 1) fail(`A/V endpoint ${audioEndMs}`);
    return { videoPackets: video.length, audioPackets: audio.length, firstVideoMs: video[0], lastVideoMs: video.at(-1),
        audioEndMs, codecDelayMs: delayMs, discardPaddingMs: last.paddingMs, contiguous: true, toleranceMs: 1 };
}
