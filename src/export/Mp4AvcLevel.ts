// H.264 Annex A. Limits for the High-profile MP4 export configurations.
const levels = [
    { idc: 31, frame: 3600, perSecond: 108000, bitrate: 17_500_000 },
    { idc: 32, frame: 5120, perSecond: 216000, bitrate: 25_000_000 },
    { idc: 40, frame: 8192, perSecond: 245760, bitrate: 25_000_000 },
    { idc: 41, frame: 8192, perSecond: 245760, bitrate: 62_500_000 },
    { idc: 42, frame: 8704, perSecond: 522240, bitrate: 62_500_000 },
    { idc: 50, frame: 22080, perSecond: 589824, bitrate: 168_750_000 },
    { idc: 51, frame: 36864, perSecond: 983040, bitrate: 300_000_000 },
    { idc: 52, frame: 36864, perSecond: 2073600, bitrate: 300_000_000 },
    { idc: 60, frame: 139264, perSecond: 4177920, bitrate: 300_000_000 },
    { idc: 61, frame: 139264, perSecond: 8355840, bitrate: 600_000_000 },
    { idc: 62, frame: 139264, perSecond: 16711680, bitrate: 1_000_000_000 },
] as const;

export function selectMp4AvcLevel(width: number, height: number, fps: number, bitrate: number) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
        || ![width, height, fps, bitrate].every(value => Number.isFinite(value) && value > 0)) return undefined;
    const columns = Math.ceil(width / 16), rows = Math.ceil(height / 16);
    const frame = columns * rows;
    return levels.find(level => frame <= level.frame && frame * fps <= level.perSecond
        && Math.max(columns, rows) ** 2 <= level.frame * 8 && bitrate <= level.bitrate)?.idc;
}

export function readMp4AvcLevel(description: AllowSharedBufferSource | undefined): number | undefined {
    if (!description) return undefined;
    const bytes = ArrayBuffer.isView(description)
        ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
        : new Uint8Array(description);
    // AVCDecoderConfigurationRecord starts with version, profile, constraints and level.
    return bytes.length >= 7 && bytes[0] === 1 ? bytes[3] : undefined;
}
