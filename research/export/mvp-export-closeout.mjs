// WH-08. Run the built MVP through its normal upload, export and download controls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [input, directory, profile = 'desktop', playbackOnly] = process.argv.slice(2);
assert.ok(input && directory && ['desktop', 'mobile-layout', 'webm', 'uhd'].includes(profile)
    && (playbackOnly === undefined || ['--playback-only', '--controls-only'].includes(playbackOnly)),
    'Usage: node research/export/mvp-export-closeout.mjs TRACK LOG_DIRECTORY [desktop|mobile-layout|webm|uhd] [--playback-only|--controls-only]');
const controlsOnly = playbackOnly === '--controls-only';
const playbackVariant = process.env.PLEXUS_WEBM_PLAYBACK_VARIANT;
assert.ok(playbackVariant === undefined || ['remux', 'color', 'color709'].includes(playbackVariant));
assert.ok(!playbackVariant || playbackOnly === '--playback-only');
const source = path.resolve(input);
const out = path.resolve(directory);
const dist = path.resolve('dist');
assert.ok(path.relative(path.resolve('logs'), out).startsWith('wh08' + path.sep));
await stat(source);
if (!playbackOnly || controlsOnly) await mkdir(out);
let marker;
try { marker = JSON.parse(await readFile(path.join(dist, 'release.json'), 'utf8')); }
catch (error) {
    if (error.code !== 'ENOENT' || !process.env.PLEXUS_LOCAL_BUILD_ID) throw error;
    marker = { id:process.env.PLEXUS_LOCAL_BUILD_ID };
}
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
    '.svg':'image/svg+xml', '.wasm':'application/wasm', '.mjs':'text/javascript', '.webm':'video/webm', '.mp4':'video/mp4' };
const server = createServer(async (req, res) => {
    try {
        if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
        const url = new URL(req.url, 'http://127.0.0.1');
        const base = '/plexus-engine/';
        const download = /^\/wh08\/((?:full|stop|retry|remux|color|color709)\.(?:mp4|webm))$/.exec(url.pathname);
        if (!download && !url.pathname.startsWith(base)) return res.writeHead(404).end();
        const relative = decodeURIComponent(url.pathname.slice(base.length));
        const file = download ? path.join(out, download[1])
            : path.resolve(dist, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
        if (!download && !file.startsWith(dist + path.sep)) return res.writeHead(404).end();
        const info = await stat(file);
        if (!info.isFile()) return res.writeHead(404).end();
        const range = download && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
        const start = range ? Number(range[1]) : 0;
        const end = range && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
        if (start > end) return res.writeHead(416, { 'Content-Range': 'bytes */' + info.size }).end();
        res.writeHead(range ? 206 : 200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
            'Content-Length': end - start + 1, 'Cache-Control':'no-store',
            ...(download && { 'Accept-Ranges':'bytes' }),
            ...(range && { 'Content-Range': `bytes ${start}-${end}/${info.size}` }) });
        if (req.method === 'HEAD') res.end();
        else createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    } catch {
        if (!res.headersSent) res.writeHead(404).end();
        else res.destroy();
    }
});
await new Promise((resolve, reject) => { server.on('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = 'http://127.0.0.1:' + server.address().port;
const chrome = process.env.PLEXUS_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const softwareDecode = process.env.PLEXUS_SOFTWARE_DECODE === '1';
const userDir = path.join(out, playbackOnly === '--playback-only' ? 'chrome-playback-' + randomUUID() : 'chrome');
const child = spawn(chrome, ['--headless', '--remote-debugging-port=0', '--user-data-dir=' + userDir,
    ...(softwareDecode ? ['--disable-accelerated-video-decode'] : []),
    '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { windowsHide:true, stdio:'ignore' });
let socket, serial = 0, exportStatus;
const rows = [];
const media = [];
const waitFor = async (description, timeoutMs, check, interval = 500) => {
    const until = Date.now() + timeoutMs;
    do {
        const value = await check();
        if (value) return value;
        await sleep(interval);
    } while (Date.now() < until);
    throw Error(description + ' timed out');
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => finish(Error('CDP timed out: ' + method)), 120_000);
    function finish(error, value) {
        clearTimeout(timer);
        socket.removeEventListener('message', listener);
        if (error) reject(error);
        else resolve(value);
    }
    function listener({ data }) {
        const reply = JSON.parse(data);
        if (reply.id === id) finish(reply.error ? Error(JSON.stringify(reply.error)) : null, reply.result);
    }
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true, userGesture:true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result?.value;
}
const status = () => evaluate(`(() => {
        const dialog = document.querySelector('[aria-label="Export video"]');
        const speed = dialog.querySelector('.mvp-export-performance-status');
        const codec = dialog.querySelector('.mvp-export-codec-diagnostic');
    return { text: dialog.querySelector('.mvp-modal-status').textContent,
        speed: speed.hidden ? '' : speed.textContent,
        codec: codec.hidden ? '' : codec.textContent,
        progress: dialog.querySelector('.mvp-export-progress output').textContent,
        active: !dialog.querySelector('.mvp-export-stop').classList.contains('mvp-hidden') };
})()`);
async function downloadSettings() {
    // Read the app's Copy payload using a transient page-local recorder.
    return evaluate(`(async () => {
        const original = Object.getOwnPropertyDescriptor(navigator.clipboard, 'writeText');
        let payload;
        Object.defineProperty(navigator.clipboard, 'writeText', { configurable:true, value:async text => { payload = text; } });
        try {
            document.querySelector('.mvp-export-copy').click();
            await Promise.resolve();
            return JSON.parse(payload);
        } finally {
            if (original) Object.defineProperty(navigator.clipboard, 'writeText', original);
            else delete navigator.clipboard.writeText;
        }
    })()`);
}
async function run(id, config, command) {
    const downloadDirectory = path.join(out, id + '-download');
    await mkdir(downloadDirectory);
    await send('Browser.setDownloadBehavior', { behavior:'allow', downloadPath:downloadDirectory });
    await evaluate(`(() => {
        const cfg = ${JSON.stringify(config)};
        const dialog = document.querySelector('[aria-label="Export video"]');
        if (dialog.parentElement.classList.contains('mvp-hidden')) document.querySelector('.mvp-export-btn').click();
        dialog.querySelector('[data-res="' + cfg.res + '"]').click();
        for (const [key, value] of Object.entries({format:cfg.format, fps:cfg.fps, performance:cfg.speed})) {
            const select = dialog.querySelector('.mvp-export-' + key);
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles:true }));
        }
        const start = dialog.querySelector('.mvp-export-start');
        if (start.disabled) throw Error(dialog.querySelector('.mvp-capability-warning').textContent || 'Export disabled');
        start.click();
    })()`);
    const started = Date.now();
    const record = { id, config, command };
    rows.push(record);
    if (command) {
        await waitFor('Frames before ' + command, 180_000, async () => {
            exportStatus = await status();
            if (!exportStatus.active && exportStatus.text && !exportStatus.text.startsWith('Preparing')) throw Error(exportStatus.text);
            return exportStatus.active && parseInt(exportStatus.progress, 10) >= 2;
        });
        record.beforeCommand = exportStatus;
        const click = evaluate(`document.querySelector('.mvp-export-${command}').click()`);
        if (command === 'cancel') {
            const dialog = await waitFor('Cancel confirmation', 15_000, () => confirmation, 100);
            assert.equal(dialog.type, 'confirm');
            assert.match(dialog.message, /Discard/);
            await send('Page.handleJavaScriptDialog', { accept:true });
            confirmation = null;
        }
        await click;
    }
    let lastProgressLog = started;
    record.status = await waitFor(id + ' terminal status', 50 * 60_000, async () => {
        exportStatus = await status();
        if (Date.now() - lastProgressLog > 30_000) {
            console.log(JSON.stringify({ id, elapsedSec:Math.round((Date.now() - started) / 1000), ...exportStatus }));
            lastProgressLog = Date.now();
        }
        return !exportStatus.active && exportStatus.text && !exportStatus.text.startsWith('Preparing') && exportStatus;
    }, 1250);
    record.elapsedMs = Date.now() - started;
    record.settings = await downloadSettings();
    assert.equal(record.settings.export.resolution, config.res);
    assert.equal(record.settings.export.fps, Number(config.fps));
    if (command === 'cancel') {
        assert.equal(record.status.text, 'Export cancelled.');
        const files = await readdir(downloadDirectory);
        assert.deepEqual(files.filter(name => !/^downloads\.htm(?: \(\d+\))?(?:\.crdownload)?$/.test(name)), []);
    } else {
        assert.match(record.status.text, /^Done/);
        const extension = config.format.startsWith('webm') ? 'webm' : 'mp4';
        const file = await waitFor('Completed download', 180_000,
            async () => (await readdir(downloadDirectory)).find(name => name.endsWith('.' + extension)));
        const target = path.join(out, id + '.' + extension);
        await rename(path.join(downloadDirectory, file), target);
        record.file = path.basename(target);
        record.bytes = (await stat(target)).size;
    }
    console.log(JSON.stringify(record));
}

async function checkPlayback(record) {
    const seeks = record.id === 'full' ? [2, 47, 60, 85, 92, 205, 407] : [0.5, 2];
    record.playback = await evaluate(`(async () => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        document.body.append(video);
        const event = (name, action) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                clean();
                reject(Error('Video timed out: ' + name + ', ready=' + video.readyState + ', network=' + video.networkState));
            }, 30000);
            function clean() {
                clearTimeout(timer);
                video.removeEventListener(name, pass);
                video.removeEventListener('error', fail);
            }
            function pass() { clean(); resolve(); }
            function fail() { clean(); reject(Error('Browser media error during ' + name + ' at ' + video.currentTime + ' s: ' + video.error?.message)); }
            video.addEventListener(name, pass, { once:true });
            video.addEventListener('error', fail, { once:true });
            action();
        });
        try {
            await event('loadeddata', () => { video.src = ${JSON.stringify('/wh08/' + record.file)}; });
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 18;
            const ctx = canvas.getContext('2d', { willReadFrequently:true });
            const seeking = [];
            for (const second of ${JSON.stringify(seeks)}) {
                if (second >= video.duration) continue;
                await event('seeked', () => { video.currentTime = second; });
                ctx.drawImage(video, 0, 0, 32, 18);
                const pixels = ctx.getImageData(0, 0, 32, 18).data;
                const maxColor = pixels.reduce((max, value, i) => i % 4 === 3 ? max : Math.max(max, value), 0);
                seeking.push({ requested:second, decoded:video.currentTime, maxColor });
            }
            const start = video.currentTime;
            await video.play();
            await new Promise(resolve => setTimeout(resolve, 600));
            const { totalVideoFrames, droppedVideoFrames } = video.getVideoPlaybackQuality();
            return { duration:video.duration, width:video.videoWidth, height:video.videoHeight,
                seeking, playedSec:video.currentTime - start, quality:{ totalVideoFrames, droppedVideoFrames } };
        } finally { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); }
    })()`);
    assert.ok(record.playback.seeking.length && record.playback.playedSec > .2);
    assert.ok(record.playback.seeking.some(sample => sample.maxColor > 8), 'Decoded video has no visible content');
    for (const sample of record.playback.seeking) assert.ok(Math.abs(sample.decoded - sample.requested) < .05);
}

let failure = null;
let confirmation = null;
try {
    const port = await waitFor('Chrome debug endpoint', 20_000, async () => {
        try { return Number((await readFile(path.join(userDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }, 200);
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.addEventListener('message', ({ data }) => {
        const event = JSON.parse(data);
        if (event.method === 'Page.javascriptDialogOpening') confirmation = event.params;
        if (event.method?.startsWith('Media.') && media.length < 120) media.push(event);
    });
    await send('Page.enable');
    await send('Media.enable');
    if (profile === 'mobile-layout') await send('Emulation.setDeviceMetricsOverride',
        { width:412, height:915, deviceScaleFactor:1, mobile:true });
    await send('Page.navigate', { url: origin + '/plexus-engine/mvp/?release=' + marker.id });
    await waitFor('Track input', 25_000, () => evaluate('Boolean(document.querySelector(".mvp-file-input"))'));
    if (playbackOnly === '--playback-only') {
        const existing = JSON.parse(await readFile(path.join(out, 'browser.json'), 'utf8'));
        assert.equal(existing.release, marker.id);
        assert.ok(existing.rows.some(row => row.file));
        rows.push(...existing.rows);
        if (playbackVariant) {
            const full = rows.find(row => row.id === 'full');
            assert.equal(full.file, 'full.webm');
            full.file = playbackVariant + '.webm';
        }
    } else {
        const { result } = await send('Runtime.evaluate', { expression:`Array.from(document.querySelectorAll('.mvp-file-input')).find(input =>
            !input.closest('.mvp-hidden') && !input.closest('[hidden]')) ?? document.querySelector('.mvp-file-input')` });
        await send('DOM.setFileInputFiles', { files:[source], objectId:result.objectId });
        await waitFor('Reference analysis', 300_000, () => evaluate('document.querySelector(".mvp-export-btn")?.disabled === false'));
        console.log(JSON.stringify({ release:marker.id, profile, loaded:true }));
        const webm = profile === 'webm' || profile === 'uhd';
        const full = profile === 'mobile-layout' ? { res:'720p', format:'mp4', fps:'30', speed:'economy' }
            : { res:profile === 'uhd' ? '4K' : '720p', format:webm ? 'webm10' : 'mp4vp9',
                fps:profile === 'uhd' ? '60' : '30', speed:'turbo' };
        if (!controlsOnly) await run('full', full);
        if (!webm || controlsOnly) {
            const short = webm ? full : { res:'720p', format:'mp4', fps:'30', speed:'economy' };
            await run('stop', short, 'stop');
            await run('cancel', short, 'cancel');
            await run('retry', short, 'stop');
        }
    }
    for (const record of rows.filter(row => row.file)) await checkPlayback(record);
} catch (error) {
    failure = error.message;
    throw error;
} finally {
    socket?.close();
    child.kill();
    server.close();
    const receipt = softwareDecode ? 'playback-software.json'
        : playbackVariant ? 'playback-' + playbackVariant + '.json'
        : playbackOnly === '--playback-only' ? 'playback.json' : 'browser.json';
    await writeFile(path.join(out, receipt),
        JSON.stringify({ release:marker.id, profile, softwareDecode, rows, failure, media, lastStatus:exportStatus }, null, 2) + '\n', { flag:'wx' });
}
