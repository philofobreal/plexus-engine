// Research: synchronous FFmpeg writes to an OPFS file through an Emscripten device.
// The page owns the containing scratch directory and removes it after termination.
self.onmessage = async ({ data: { coreURL, wasmURL, video, wav, output, limit, timeout } }) => {
    let file, mounted = false, fs, offset = 0, peakWrite = 0, writes = 0, failure;
    const log = [];
    try {
        const started = performance.now();
        const { default: createCore } = await import(/* @vite-ignore */ coreURL);
        const core = await createCore({
            mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL })),
        });
        const loadMs = Math.round(performance.now() - started);
        core.setLogger(({ message }) => {
            if (log.push(message) > 12) log.shift();
        });
        core.setProgress(() => {});
        fs = core.FS;
        fs.mkdir('/in');
        fs.mount(fs.filesystems.WORKERFS, { blobs: [{ name: 'video.mp4', data: video }, { name: 'audio.wav', data: wav }] }, '/in');
        mounted = true;
        file = await output.createSyncAccessHandle();
        const dev = fs.makedev(72, 0);
        fs.registerDevice(dev, {
            open(stream) { stream.seekable = false; },
            write(_stream, buffer, start, length) {
                try {
                    if (offset + length > limit) throw Error('Final MP4 byte limit exceeded');
                    const written = file.write(buffer.subarray(start, start + length), { at: offset });
                    if (written !== length) throw Error('Incomplete OPFS write');
                    offset += written;
                    writes++;
                    if (writes === 1) postMessage({ type: 'writing' });
                    peakWrite = Math.max(peakWrite, written);
                    return written;
                } catch (error) {
                    failure = error;
                    // Return a conventional EIO through Emscripten rather than throwing into WASM.
                    throw new fs.ErrnoError(29);
                }
            },
        });
        fs.mkdev('/dev/plexus-out', 0o222, dev);
        const execStart = performance.now();
        core.setTimeout(timeout);
        core.exec('-i', '/in/video.mp4', '-i', '/in/audio.wav', '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-f', 'mp4',
            '-avoid_negative_ts', 'disabled', '-use_editlist', '1', '-movflags',
            '+delay_moov+default_base_moof+frag_keyframe', '-frag_duration', '1000000',
            '-flush_packets', '1', '/dev/plexus-out');
        const execMs = Math.round(performance.now() - execStart);
        if (failure) throw failure;
        if (core.ret !== 0 || offset === 0) throw Error('FFmpeg exited without a complete MP4');
        file.flush();
        file.close();
        file = undefined;
        postMessage({ type: 'result', loadMs, execMs, bytes: offset, writes, peakWrite,
            wasmLinearBytes: core.HEAPU8?.byteLength ?? null });
    } catch (error) {
        postMessage({ type: 'error', error: String(error) + '\n' + log.join('\n') });
    } finally {
        file?.close();
        if (mounted) fs.unmount('/in');
    }
};
