// WH-02 loopback-only laboratory runner. Pins the WH-01 dataset; never replaces it.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { verifyPack } from './wormhole-baseline.mjs';
import { QUALITY_POLICY, compareRgba, compareTemporal } from './wormhole-quality.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve('logs/wh02'), fixture = '/plexus-engine/research/export/wormhole-gpu.html';
const hostFixture = '/plexus-engine/tests/browser/wormhole-host-backend-smoke.html';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
export function verifyGpuReport(report, baseline) {
    assert.equal(report.version,1);assert.deepEqual(report.policy,QUALITY_POLICY);
    assert.equal(report.rows.length,baseline.cases.length);
    assert.equal(report.temporal.length,2);assert.equal(report.lifecycle.malformedRejected,true);
    const decode=block=>{assert.equal(block.format,'rgba8-straight-srgb');const bytes=Buffer.from(block.bytes,'base64');
        assert.equal(hash(bytes),block.sha256);assert.equal(bytes.toString('base64'),block.bytes);return bytes;};
    const compare=(a,b)=>{for(const key of Object.keys(a))typeof a[key]==='number'
        ?assert.ok(Math.abs(a[key]-b[key])<1e-9,key):assert.equal(a[key],b[key],key);};
    const candidates=[];
    for(const [i,row] of report.rows.entries()){
        const ref=baseline.cases[i];assert.equal(row.id,ref.id);assert.equal(row.width,ref.width);assert.equal(row.height,ref.height);
        const candidate=decode(row.captures.candidate),cpu=decode(row.captures.cpu),bitmap=decode(row.captures.bitmap),reference=decode(ref.reference);
        compare(compareRgba(reference,candidate,row.width,row.height),row.quality);
        compare(compareRgba(reference,cpu,row.width,row.height),row.cpuReplay);
        compare(compareRgba(candidate,bitmap,row.width,row.height),row.bitmapParity);candidates.push(candidate);
    }
    for(const [j,i] of [0,2].entries())compare(compareTemporal(decode(baseline.cases[i].reference),decode(baseline.cases[i+1].reference),
        candidates[i],candidates[i+1],report.rows[i].width,report.rows[i].height),report.temporal[j]);
    assert.equal(report.pass,report.rows.every(r=>r.quality.pass&&r.cpuReplay.pass&&r.bitmapParity.pass)
        &&report.temporal.every(t=>t.pass)&&report.lifecycle.retryQuality.pass&&report.lifecycle.recoveryQuality.pass
        &&report.lifecycle.resizeExact&&report.lifecycle.disposed);
    return {pass:report.pass,rows:report.rows.length,precision:report.precision,rawPixelMetricsRecomputed:true};
}
async function capture() {
    const precision = process.argv[3] ?? 'float16';
    assert.ok(['float16','float32'].includes(precision));
    const baselineDir=(await readFile('logs/wh01/active-run.txt','utf8')).trim();
    const scalarBaseline=await readFile(path.join(baselineDir,'baseline.json'));
    assert.equal(hash(scalarBaseline),'937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f');
    verifyPack(JSON.parse(scalarBaseline));
    const chrome = process.env.PLEXUS_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    await stat(chrome); // Fail before opening a server if the browser is unavailable.
    const output = path.join(root, 'run-' + randomUUID()), site = path.join(output, 'site');
    await mkdir(output, { recursive: true });
    const paths = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'research/export',
        'tests/helpers', 'tests/browser/wormhole-host-backend-smoke.html', 'documents/governance', 'AGENTS.md').split(/\r?\n/).filter(Boolean);
    const sourceInputs = await Promise.all([...new Set(paths)].sort().map(async file => ({ path: file, sha256: hash(await readFile(file)) })));
    const built = await build({ configFile: false, base: '/plexus-engine/', publicDir: false,
        build: { outDir: site, rollupOptions: { input: ['research/export/wormhole-gpu.html',
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
                const verified = verifyGpuReport(pack,JSON.parse(scalarBaseline));
                await writeFile(path.join(output, 'gpu-report.json'), bytes, { flag: 'wx' }); captured = true;
                await writeFile(path.join(output, 'verification.json'), JSON.stringify({ ...verified,
                    reportSha256: hash(bytes), referenceSha256: hash(scalarBaseline) }, null, 2) + '\n', { flag: 'wx' });
                res.writeHead(201).end(); return;
            }
            if (req.method === 'GET' && url.pathname === '/baseline.json') { res.writeHead(200, { 'Content-Type':'application/json' }).end(scalarBaseline); return; }
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
        const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list', { headers: { Connection: 'close' } })).json();
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
        // Optional actual-deployment host check; local quality capture below stays immutable.
        const publicRelease = process.argv.find(arg => arg.startsWith('--public-release='))?.slice(17);
        if (publicRelease) {
            assert.match(publicRelease,/^[a-zA-Z0-9-]+$/);
            const exceptions=[],hosts=[];
            socket.addEventListener('message',({data})=>{const event=JSON.parse(data);
                if(event.method==='Runtime.exceptionThrown')exceptions.push(event.params.exceptionDetails);});
            await send('Runtime.enable',{});
            const raster='document.querySelector("canvas[data-wormhole-raster]")?.dataset.wormholeRaster';
            for(const route of ['','mvp/']){
                const url='https://philofobreal.github.io/plexus-engine/'+route+'?release='+publicRelease;
                await send('Page.navigate',{url});
                for(let i=0;i<400&&await evaluate(raster)!=='offscreen-gpu-material';i++)await sleep(50);
                assert.equal(await evaluate(raster),'offscreen-gpu-material','Production GPU preview: '+route);
                if(route==='mvp/')await evaluate("document.querySelector('[aria-label=\"Advanced tuning\"]').click()");
                const hint=await evaluate('document.querySelector(".preview-quality-control")?.textContent');
                assert.ok(hint?.includes('Active: GPU material in worker'),hint);
                const modes=[];
                for(const mode of ['compatible','offscreen']){
                    await evaluate("(()=>{const s=document.querySelector('[aria-label=\"Wormhole renderer\"]');s.value="+JSON.stringify(mode)+';s.dispatchEvent(new Event("change",{bubbles:true}));})()');
                    const expected=mode==='offscreen'?'offscreen-gpu-material':'compatible';
                    for(let i=0;i<400&&await evaluate(raster)!==expected;i++)await sleep(50);
                    const active=await evaluate(raster);assert.equal(active,expected);modes.push({mode,active});
                }
                const pixels=await evaluate('(()=>{const c=document.querySelector("canvas[data-wormhole-raster]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return {width:c.width,height:c.height,nonblank:d.some((v,i)=>i%4!==3&&v>0),saved:localStorage.getItem("plexus.wormholeRenderer")};})()');
                assert.equal(pixels.nonblank,true);assert.equal(pixels.saved,'offscreen');
                // An explicit saved choice survives a fresh renderer, not just an in-memory menu change.
                await evaluate('localStorage.setItem("plexus.wormholeRenderer","compatible")');await send('Page.navigate',{url});
                for(let i=0;i<400&&await evaluate(raster)!=='compatible';i++)await sleep(50);
                assert.equal(await evaluate(raster),'compatible','Saved Compatible respected: '+route);
                if(route==='mvp/')await evaluate("document.querySelector('[aria-label=\"Advanced tuning\"]').click()");
                assert.equal(await evaluate("document.querySelector('[aria-label=\"Wormhole renderer\"]').value"),'compatible');
                for(let i=0;i<8;i++)await evaluate('new Promise(requestAnimationFrame)');
                assert.equal(await evaluate(raster),'compatible','Saved choice remains active: '+route);
                await evaluate('localStorage.setItem("plexus.wormholeRenderer","offscreen")');
                hosts.push({route,hint,modes,pixels,savedCompatibleRespected:true});
            }
            assert.equal(exceptions.length,0,JSON.stringify(exceptions));
            await writeFile(path.join(output,'public-hosts.json'),JSON.stringify({release:publicRelease,hosts,exceptions,pass:true},null,2)+'\n',{flag:'wx'});
        }
        await send('Page.navigate', { url: origin + fixture + '?frozen=1' });
        for (let i = 0; i < 100 && !await evaluate('Boolean(window.runWh02)'); i++) await sleep(100);
        const run = await evaluate('window.runWh02('+JSON.stringify(precision)+','+(process.argv[4]==='cpu-lines')+')'); assert.equal(run?.rows?.length, 8, JSON.stringify(run));
        const layout = await send('Page.getLayoutMetrics', {}), dimensions = layout.cssContentSize;
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 } });
        await writeFile(path.join(output, 'reference-gallery.png'), Buffer.from(screenshot.data, 'base64'), { flag: 'wx' });
        const first=await evaluate('(()=>{const r=document.querySelector("article").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
        const detail=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:first});
        await writeFile(path.join(output,'comparison-first.png'),Buffer.from(detail.data,'base64'),{flag:'wx'});
        const inspection=await evaluate(`(async()=>{
            const article=[...document.querySelectorAll('article')].find(a=>a.querySelector('h2').textContent.startsWith('transparent'));
            const canvases=[...article.querySelectorAll('canvas')].slice(0,2),select=document.querySelector('#background'),rows=[];
            const hash=async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data)),x=>x.toString(16).padStart(2,'0')).join('');
            for(const mode of ['dark','black','white','checker']){select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));
                rows.push({mode,color:getComputedStyle(canvases[0]).backgroundColor,image:getComputedStyle(canvases[0]).backgroundImage,hashes:await Promise.all(canvases.map(hash))});}
            return rows;
        })()`);
        await writeFile(path.join(output,'alpha-inspection.json'),JSON.stringify(inspection,null,2)+'\n',{flag:'wx'});
        assert.equal(inspection.length,4);assert.ok(inspection.every(row=>JSON.stringify(row.hashes)===JSON.stringify(inspection[0].hashes)));
        assert.equal(inspection[2].color,'rgb(255, 255, 255)');assert.notEqual(inspection[3].image,'none');
        const transparent=await evaluate(`(()=>{const a=[...document.querySelectorAll('article')].find(a=>a.querySelector('h2').textContent.startsWith('transparent')),r=a.getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
        const alphaImage=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:transparent});
        await writeFile(path.join(output,'transparent-checker.png'),Buffer.from(alphaImage.data,'base64'),{flag:'wx'});
        console.log('GPU report captured; checking existing host regression fixture');
        await send('Page.navigate', { url: origin + hostFixture });
        let host;
        for (let i = 0; i < 400; i++) {
            const text = await evaluate('document.querySelector("#result")?.textContent');
            if (text?.startsWith('FAIL:')) throw Error(text);
            if (text?.startsWith('{')) { host = JSON.parse(text); break; } await sleep(200);
        }
        await writeFile(path.join(output, 'host-smoke.json'), JSON.stringify(host, null, 2) + '\n', { flag: 'wx' });
        assert.equal(host?.pass, true, JSON.stringify(host));
        await writeFile(path.join(root, 'active-run.txt'), output + '\n');
        console.log(JSON.stringify({ output, qualityPass: run.pass, cases: 8, hostRows: host.rows.length }));
    } finally {
        // Finish the CDP close handshake before terminating our private Chrome instance.
        if (socket && socket.readyState !== WebSocket.CLOSED) await new Promise(resolve => {
            const timer = setTimeout(resolve, 1000);
            socket.addEventListener('close', () => { clearTimeout(timer); resolve(); }, { once: true });
            socket.close();
        });
        child.kill();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
    if(process.argv[2]==='capture')await capture();
    else if(process.argv[2]==='verify'){
        const dir=process.argv[3]??(await readFile(path.join(root,'active-run.txt'),'utf8')).trim();
        const baseline=JSON.parse(await readFile(path.join((await readFile('logs/wh01/active-run.txt','utf8')).trim(),'baseline.json')));
        console.log(JSON.stringify(verifyGpuReport(JSON.parse(await readFile(path.join(dir,'gpu-report.json'))),baseline)));
    }else throw Error('Use: node research/export/wormhole-gpu-spike.mjs capture [float16|float32] [cpu-lines] [--public-release=ID] | verify [run-directory]');
}
