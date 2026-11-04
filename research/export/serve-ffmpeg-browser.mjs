// Stage pinned research-only assets beside a Vite build and serve on loopback.
import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'vite';

const root = path.resolve('logs/t20a1/site');
const installed = path.resolve('logs/t20a1/vendor/node_modules');
const port = Number(process.argv[2] ?? 5209);
const page = '/plexus-engine/research/export/ffmpeg-browser.html';
const vendors = [
    ['@ffmpeg/ffmpeg', '0.12.15', 'dist/esm', 'ffmpeg'],
    ['@ffmpeg/core', '0.12.10', 'dist/esm', 'core'],
    ['mediabunny', '1.39.1', 'dist/bundles/mediabunny.mjs', 'mediabunny.mjs'],
];
for (const [name, version] of vendors) {
    const pkg = JSON.parse(await readFile(path.join(installed, name, 'package.json'), 'utf8'));
    if (pkg.version !== version) throw Error(`Expected ${name}@${version}`);
}
const site = path.join(root, 'plexus-engine');
await build({
    configFile: false, base: '/plexus-engine/', publicDir: false,
    build: { outDir: site, emptyOutDir: false, rollupOptions: { input: 'research/export/ffmpeg-browser.html' } },
});
const vendorOut = path.join(root, path.dirname(page), 'vendor');
await mkdir(vendorOut, { recursive: true });
for (const [name, , source, destination] of vendors) {
    await cp(path.join(installed, name, source), path.join(vendorOut, destination), { recursive: true });
}
const wasm = await stat(path.join(vendorOut, 'core/ffmpeg-core.wasm'));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm' };
createServer(async (req, res) => {
    try {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/fixture-info.json') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ coreWasmBytes: wasm.size, versions: Object.fromEntries(vendors) }));
            return;
        }
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) { res.writeHead(404).end(); return; }
        const info = await stat(file);
        if (!info.isFile()) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Content-Length': info.size });
        if (req.method === 'HEAD') res.end();
        else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}${page}`));
