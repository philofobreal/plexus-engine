// WH-01: immutable, loopback-only scalar fixture capture and independent artifact validation.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { QUALITY_POLICY, BASELINE_CASES, compareRgba } from './wormhole-quality.mjs';
import { CARRIER_FIELDS } from './parallel-material-data.mjs';
import { createLoader } from '../../tests/helpers/xr-loader.mjs';
const { assertWormholeRenderFrameStamp: validateStamp } = createLoader()('types/WormholeRenderFrame.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve('logs/wh01'), fixture = '/plexus-engine/research/export/wormhole-baseline.html';
const hostFixture = '/plexus-engine/tests/browser/wormhole-host-backend-smoke.html';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
export function verifyPack(pack) {
    assert.equal(pack.version, 1); assert.equal(pack.pass, true);
    assert.deepEqual(pack.policy, QUALITY_POLICY);
    assert.equal(pack.cases.length, 8); assert.equal(new Set(pack.cases.map(c => c.id)).size, 8);
    for (const [index, frame] of pack.cases.entries()) {
        const spec = BASELINE_CASES[index];
        assert.equal(frame.id, spec.id); assert.equal(frame.stamp.songTime, spec.time); assert.equal(frame.stamp.mode, spec.mode);
        assert.equal(frame.width, spec.width ?? 640); assert.equal(frame.height, spec.height ?? 360);
        validateStamp(frame.stamp);
        assert.ok(integer(frame.width, 1, 1024) && integer(frame.height, 1, 1024));
        assert.equal(frame.scalarReplayExact, true); assert.equal(frame.repeatExact, true);
        assert.equal(frame.raw.stride, 15); assert.equal(frame.material.stride, 24); assert.equal(frame.lines.stride, 9);
        assert.deepEqual(frame.raw.fields, CARRIER_FIELDS);
        assert.equal(frame.reference.format, 'rgba8-straight-srgb'); assert.equal(frame.base.format, 'rgba8-straight-srgb');
        assert.equal(frame.raw.format, 'float64-le');
        assert.equal(frame.material.format, 'float32-le'); assert.equal(frame.lines.format, 'float32-le');
        assert.ok(integer(frame.raw.count, 0, 32768) && integer(frame.material.count, 0, frame.raw.count)
            && integer(frame.lines.count, 0, 32768));
        if (frame.id === 'material-off') assert.equal(frame.raw.count + frame.material.count + frame.lines.count, 0);
        else {
            assert.ok(frame.raw.count > 0 && frame.material.count > 0, 'Empty material fixture');
            assert.ok(integer(frame.material.cols, 1, 640) && integer(frame.material.rows, 1, 640)
                && frame.material.cols * frame.material.rows <= 640 * 360);
            assert.ok([frame.material.amount, frame.material.detail, frame.material.bloom]
                .every(value => Number.isFinite(value) && value >= 0 && value <= 1));
        }
        for (const key of ['reference', 'base', 'raw', 'material', 'lines']) {
            const data = Buffer.from(frame[key].bytes, 'base64');
            assert.equal(data.toString('base64'), frame[key].bytes, 'Noncanonical base64');
            assert.equal(hash(data), frame[key].sha256, frame.id + ': changed ' + key);
            assert.equal(frame.repeatHashes[key], frame[key].sha256);
            const expected = key === 'reference' || key === 'base' ? frame.width * frame.height * 4
                : frame[key].count * frame[key].stride * (key === 'raw' ? 8 : 4);
            assert.equal(data.length, expected, key + ': unexpected byte size');
            if (key !== 'reference' && key !== 'base') for (let i = 0; i < data.length; i += key === 'raw' ? 8 : 4)
                assert.ok(Number.isFinite(key === 'raw' ? data.readDoubleLE(i) : data.readFloatLE(i)), 'Nonfinite input');
            else assert.equal(compareRgba(data, data, frame.width, frame.height).meanError, 0);
        }
    }
    assert.equal(pack.temporalControls.length, 2);
    assert.ok(pack.temporalControls.every(row => row.pass && row.meanError === 0));
    return { cases: pack.cases.length, images: pack.cases.map(c => ({ id: c.id, sha256: c.reference.sha256,
        carriers: c.raw.count, prepared: c.material.count, lines: c.lines.count })) };
}

async function capture() {
    const chrome = process.env.PLEXUS_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    await stat(chrome); // Fail before opening a server if the browser is unavailable.
    const output = path.join(root, 'run-' + randomUUID()), site = path.join(output, 'site');
    await mkdir(output, { recursive: true });
    const paths = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'research/export',
        'tests/helpers', 'tests/browser/wormhole-host-backend-smoke.html', 'documents/governance', 'AGENTS.md').split(/\r?\n/).filter(Boolean);
    const sourceInputs = await Promise.all([...new Set(paths)].sort().map(async file => ({ path: file, sha256: hash(await readFile(file)) })));
    const built = await build({ configFile: false, base: '/plexus-engine/', publicDir: false,
        build: { outDir: site, rollupOptions: { input: ['research/export/wormhole-baseline.html',
            'tests/browser/wormhole-host-backend-smoke.html'] } } });
    const bundles = (Array.isArray(built) ? built : [built]).flatMap(result => result.output);
    const manifest = { version: 1, baseCommit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain'),
        sourceInputs, bundles: await Promise.all(bundles.map(async entry => ({ path: entry.fileName,
            sha256: hash(await readFile(path.join(site, entry.fileName))) }))) };
    for (const input of sourceInputs) assert.equal(hash(await readFile(input.path)), input.sha256, 'Source changed while building');
    await writeFile(path.join(output, 'build.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    let origin, captured = false;
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, origin);
            if (req.method === 'POST' && url.pathname === '/capture' && req.headers.origin === origin) {
                if (captured) { res.writeHead(409).end('Already captured'); return; }
                const chunks = []; let size = 0;
                for await (const chunk of req) { size += chunk.length; if (size > 64 * 1024 * 1024) throw Error('Capture exceeds cap'); chunks.push(chunk); }
                const bytes = Buffer.concat(chunks), pack = JSON.parse(bytes.toString());
                const verified = verifyPack(pack);
                await writeFile(path.join(output, 'baseline.json'), bytes, { flag: 'wx' }); captured = true;
                await writeFile(path.join(output, 'verification.json'), JSON.stringify({ ...verified,
                    baselineSha256: hash(bytes), policy: QUALITY_POLICY, pass: true }, null, 2) + '\n', { flag: 'wx' });
                res.writeHead(201).end(); return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
            if (!url.pathname.startsWith('/plexus-engine/')) { res.writeHead(404).end(); return; }
            const file = path.resolve(site, decodeURIComponent(url.pathname.slice('/plexus-engine/'.length)));
            if (!file.startsWith(site + path.sep)) { res.writeHead(404).end(); return; }
            const data = await readFile(file);
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : data);
        } catch (error) { res.writeHead(400).end(String(error)); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = 'http://127.0.0.1:' + server.address().port;
    const child = spawn(chrome, ['--headless', '--remote-debugging-port=0', '--user-data-dir=' + path.join(output, 'chrome'),
        '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let socket;
    try {
        let port;
        for (let i = 0; i < 100; i++) {
            try { port = Number((await readFile(path.join(output, 'chrome/DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
            catch { await sleep(200); }
        }
        assert.ok(port, 'Chrome debug endpoint missing');
        const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
        socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        let serial = 0;
        const send = (method, params) => new Promise((resolve, reject) => {
            const id = ++serial;
            const listener = ({ data }) => { const reply = JSON.parse(data); if (reply.id === id) {
                socket.removeEventListener('message', listener); reply.error ? reject(Error(JSON.stringify(reply.error))) : resolve(reply.result);
            } };
            socket.addEventListener('message', listener); socket.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
        await send('Page.navigate', { url: origin + fixture });
        for (let i = 0; i < 100 && !await evaluate('Boolean(window.runWh01)'); i++) await sleep(100);
        const run = await evaluate('window.runWh01()'); assert.equal(run?.pass, true, JSON.stringify(run));
        const layout = await send('Page.getLayoutMetrics', {}), dimensions = layout.cssContentSize;
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 } });
        await writeFile(path.join(output, 'reference-gallery.png'), Buffer.from(screenshot.data, 'base64'), { flag: 'wx' });
        console.log('Scalar reference captured; checking existing host regression fixture');
        await send('Page.navigate', { url: origin + hostFixture });
        let host;
        for (let i = 0; i < 400; i++) {
            const text = await evaluate('document.querySelector("#result")?.textContent');
            if (text?.startsWith('{')) { host = JSON.parse(text); break; } await sleep(200);
        }
        await writeFile(path.join(output, 'host-smoke.json'), JSON.stringify(host, null, 2) + '\n', { flag: 'wx' });
        assert.equal(host?.pass, true, JSON.stringify(host));
        await writeFile(path.join(root, 'active-run.txt'), output + '\n');
        console.log(JSON.stringify({ output, pass: true, cases: 8, hostRows: host.rows.length }));
    } finally { socket?.close(); child.kill(); await new Promise(resolve => server.close(resolve)); }
}
async function verify(file) {
    const output = file ? path.dirname(path.resolve(file)) : (await readFile(path.join(root, 'active-run.txt'), 'utf8')).trim();
    const baseline = await readFile(file ?? path.join(output, 'baseline.json'));
    const report = verifyPack(JSON.parse(baseline));
    console.log(JSON.stringify({ ...report, baselineSha256: hash(baseline) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv[2] === 'capture') await capture();
    else if (process.argv[2] === 'verify') await verify(process.argv[3]);
    else throw Error('Use: node research/export/wormhole-baseline.mjs capture | verify [baseline.json]');
}
