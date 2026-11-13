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
import { QUALITY_POLICY, BASELINE_CASES, compareRgba, evaluateEncodedStats, compareOwnSource } from './wormhole-quality.mjs';
import { evaluateReplayBounds, mobileCodecProbeConfigurations, mobileCodecOutcome } from './codec-isolation.mjs';
import { CARRIER_FIELDS } from './parallel-material-data.mjs';
import { createLoader } from '../../tests/helpers/xr-loader.mjs';
const { assertWormholeRenderFrameStamp: validateStamp } = createLoader()('types/WormholeRenderFrame.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve('logs/wh01'), fixture = '/plexus-engine/research/export/wormhole-baseline.html';
const hostFixture = '/plexus-engine/tests/browser/wormhole-host-backend-smoke.html';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
if(process.argv.includes('--level-boundary')&&(!process.argv.includes('--detail-host')||process.argv.some(a=>a.startsWith('--public-release='))))throw Error('--level-boundary is a separate local detail diagnostic');
const detailProfileArg = process.argv.find(arg => arg.startsWith('--detail-profile='))?.slice('--detail-profile='.length);
if (detailProfileArg !== undefined && (!process.argv.includes('--detail-host') || !['reference','detail','text','variable'].includes(detailProfileArg))) {
    throw Error('A listed --detail-profile requires --detail-host.');
}
if (process.argv.includes('--detail-host') && ['--export-host','--turbo-host','--isolate-host','--codec-host','--native-packets'].some(flag=>process.argv.includes(flag))) {
    throw Error('--detail-host is a separate bounded diagnostic.');
}
if(process.argv.includes('--profile-check')&&(!process.argv.includes('--export-host')||['--profile-source','--turbo-export-host','--detail-host','--quality-candidate='].some(f=>process.argv.some(a=>a.startsWith(f)))))throw Error('--profile-check requires its separate --export-host matrix');
if (process.argv.includes('--profile-source') && (!process.argv.includes('--export-host') || ['--turbo-export-host','--turbo-host','--detail-host','--isolate-host'].some(flag=>process.argv.includes(flag)))) {
    throw Error('--profile-source requires its separate --export-host qualification cohort.');
}
if (process.argv.includes('--predictive-detail') && (!['--export-host','--turbo-host'].some(flag=>process.argv.includes(flag))
    || ['--mp4-inter-frame','--native-packets','--paired-encoder','--stable-material','--detail-host'].some(flag=>process.argv.includes(flag)))) {
    throw Error('--predictive-detail requires its own export quality or throughput run; no global GOP transform.');
}
if (process.argv.includes('--isolate-host') && ['--codec-host','--turbo-host','--stable-material','--paired-encoder','--mp4-only','--native-packets'].some(flag=>process.argv.includes(flag))) {
    throw Error('--isolate-host is an independent diagnostic, not a Turbo candidate comparison.');
}
if (['--remux-cfr','--remux-color709','--inspect-remux'].some(flag=>process.argv.includes(flag)) && !process.argv.some(arg=>arg.startsWith('--remux-reference='))) {
    throw Error('Remux options require a bounded --remux-reference frame-ID clip.');
}
if (['--stable-material','--paired-encoder','--native-packets'].filter(flag=>process.argv.includes(flag)).length>1) {
    throw Error('Measure worker candidates separately; combined results have no isolated control.');
}
if (process.argv.includes('--native-packets') && !['--export-host','--turbo-host'].some(flag=>process.argv.includes(flag))) {
    throw Error('--native-packets requires an export quality or throughput run.');
}
if (['--stable-material','--paired-encoder','--mp4-only'].some(flag=>process.argv.includes(flag)) && !process.argv.includes('--turbo-host')) {
    throw Error('WH-07b experiment options require --turbo-host.');
}
const qualityCandidateArg=process.argv.find(arg=>arg.startsWith('--quality-candidate='))?.slice('--quality-candidate='.length);
const qualityQuantizer=qualityCandidateArg===undefined?undefined:Number(qualityCandidateArg);
if(qualityCandidateArg!==undefined&&(!['1','2','4','8'].includes(qualityCandidateArg)||!['--export-host','--turbo-host'].some(f=>process.argv.includes(f))
    ||['--predictive-detail','--native-packets','--detail-host','--mp4-inter-frame','--stable-material','--paired-encoder','--public-release='].some(f=>process.argv.some(a=>a.startsWith(f)))))throw Error('A listed --quality-candidate requires its own local export or speed cohort');
const refineQuality=process.argv.includes('--quality-refine');
const shortGop = process.argv.includes('--short-gop');
const replaySourceArg=process.argv.find(arg=>arg.startsWith('--quantizer-source='))?.slice('--quantizer-source='.length);
if(replaySourceArg && (process.argv[2]!=='capture' || process.argv.slice(3).some(arg=>!arg.startsWith('--quantizer-source=')&&!['--quality-refine', '--short-gop'].includes(arg)))) {
    throw Error('--quantizer-source is a separate loopback-only feasibility cohort.');
}
if ((refineQuality || shortGop) && (!replaySourceArg || (refineQuality && shortGop))) {
    throw Error('Choose one quality cohort with --quantizer-source');
}

function replayProfiles(profileSet) {
    const control = { name: 'all-key', profile: 'all-key' };
    if (profileSet === 'short-gop-v1') return [
        control,
        { name: 'q0', profile: 'quantizer', quantizer: 0 },
        { name: 'q4-g4', profile: 'quantizer', quantizer: 4, keyInterval: 4 },
        { name: 'q4-g12', profile: 'quantizer', quantizer: 4, keyInterval: 12 },
        { name: 'cbr-g4', profile: 'constant-detail', keyInterval: 4 },
    ];
    const quantizers = profileSet === 'refine-v1' ? [1, 2, 4, 8] : [0, 16, 32, 64];
    return [control, ...quantizers.map(quantizer => ({ name: 'q' + quantizer, profile: 'quantizer', quantizer }))];
}
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
        'public', 'tests/helpers', 'tests/browser/wormhole-host-backend-smoke.html', 'tests/browser/mobile-codec-probe.html', 'documents/governance', 'AGENTS.md').split(/\r?\n/).filter(Boolean);
    const sourceInputs = await Promise.all([...new Set(paths)].sort().map(async file => ({ path: file, sha256: hash(await readFile(file)) })));
    let durationProbeHits=0;
    const durationProbe=()=>({name:'wh06-mp4-duration-probe',enforce:'pre',transform(code,id){
        if(!id.split('?')[0].replaceAll('\\','/').endsWith('/src/export/mp4-export.worker.ts'))return;
        const before='new VideoSample(bitmap, { timestamp: frames / fps, duration: 1 / fps })';
        assert.equal(code.split(before).length,2,'MP4 duration probe boundary changed');durationProbeHits++;
        return code.replace(before,'new VideoSample(bitmap, { timestamp: timestampUs / 1e6 })');
    }});
    const intraProbe=()=>({name:'wh06-mp4-intra-probe',enforce:'pre',transform(code,id){
        if(!id.split('?')[0].replaceAll('\\','/').endsWith('/src/export/mp4-export.worker.ts'))return;
        const before="encoding = { codec: 'vp9', fullCodecString, bitrate, keyFrameInterval: 0,";
        assert.equal(code.split(before).length,2,'MP4 intra probe boundary changed');durationProbeHits++;
        return code.replace(before,process.argv.includes('--mp4-inter-frame')?before.replace('keyFrameInterval: 0','keyFrameInterval: 1'):before);
    }});
    const built = await build({ configFile: false, base: '/plexus-engine/', publicDir: 'public',
        worker: { plugins: () => [
            ...(process.argv.includes('--mp4-no-duration') ? [durationProbe()] : []),
            ...((process.argv.includes('--mp4-all-intra')||process.argv.includes('--mp4-inter-frame')) ? [intraProbe()] : [])
        ] },
        build: { outDir: site, rollupOptions: { input: ['research/export/wormhole-baseline.html',
            'tests/browser/wormhole-host-backend-smoke.html', 'tests/browser/mobile-codec-probe.html'] } } });
    if(process.argv.includes('--mp4-no-duration')||process.argv.includes('--mp4-all-intra')||process.argv.includes('--mp4-inter-frame'))assert.ok(durationProbeHits>0,'Probe must inspect the actual worker policy');
    const bundles = (Array.isArray(built) ? built : [built]).flatMap(result => result.output);
    const manifest = { version: 1, arguments: process.argv.slice(2), baseCommit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain'),
        sourceInputs, bundles: await Promise.all(bundles.map(async entry => ({ path: entry.fileName,
            sha256: hash(await readFile(path.join(site, entry.fileName))) }))) };
    for (const input of sourceInputs) assert.equal(hash(await readFile(input.path)), input.sha256, 'Source changed while building');
    await writeFile(path.join(output, 'build.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    let origin, captured = false;
    const replaySources=new Map();let replayManifest,replayDirectory,replaySpecs;
    if(replaySourceArg){
        replayDirectory=path.resolve(replaySourceArg);replayManifest=JSON.parse(await readFile(path.join(replayDirectory,'source-frames.json'),'utf8'));
        replaySpecs=JSON.parse(await readFile(path.join(replayDirectory,'integrated-export.json'),'utf8')).rows;
        assert.equal(replayManifest.sources.length,12);let total=0;
        for(const row of replayManifest.sources){
            assert.match(row.name,/^export-\d{3}\.mp4$/);assert.ok(integer(row.frames.length,1,63));
            for(const [i,f]of row.frames.entries()){
                assert.equal(f.index,i);assert.match(f.name,/^source-export-\d{3}-\d{3}\.png$/);assert.ok(!replaySources.has(f.name));
                const file=path.join(replayDirectory,f.name),bytes=await readFile(file);assert.ok(bytes.length<=16*1024*1024);total+=bytes.length;assert.ok(total<=512*1024*1024);
                assert.equal(hash(bytes),f.sha256);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
                const spec=replaySpecs.find(s=>s.name===row.name);assert.equal(bytes.readUInt32BE(16),spec.width);assert.equal(bytes.readUInt32BE(20),spec.height);
                replaySources.set(f.name,{file,sha256:f.sha256});
            }
        }
        await writeFile(path.join(output,'replay-inputs.json'),JSON.stringify({directory:replayDirectory,sources:replayManifest.sources,...(shortGop ? {profileSet:'short-gop-v1'} : refineQuality ? {profileSet:'refine-v1'} : {})},null,2)+'\n',{flag:'wx'});
    }
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
            if(replaySourceArg && req.method==='GET' && url.pathname.startsWith('/_wh07-source/')){
                const name=url.pathname.slice('/_wh07-source/'.length),source=replaySources.get(name);
                if(!source){res.writeHead(404).end();return;}
                const bytes=await readFile(source.file);assert.equal(hash(bytes),source.sha256);
                res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'}).end(bytes);return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
            if (!url.pathname.startsWith('/plexus-engine/')) { res.writeHead(404).end(); return; }
            const file = path.resolve(site, decodeURIComponent(url.pathname.slice('/plexus-engine/'.length)));
            if (!file.startsWith(site + path.sep)) { res.writeHead(404).end(); return; }
            const data = await readFile(file);
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
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
        const evaluate = async (expression, userGesture = false) => {
            const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
            if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? JSON.stringify(response.exceptionDetails));
            return response.result?.value;
        };
        await send('Page.navigate', { url: origin + fixture });
        for (let i = 0; i < 100 && !await evaluate('Boolean(window.runWh01)'); i++) await sleep(100);
        const run = await evaluate('window.runWh01()'); assert.equal(run?.pass, true, JSON.stringify(run));
        const layout = await send('Page.getLayoutMetrics', {}), dimensions = layout.cssContentSize;
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 } });
        await writeFile(path.join(output, 'reference-gallery.png'), Buffer.from(screenshot.data, 'base64'), { flag: 'wx' });
        console.log('Scalar reference captured; checking existing host regression fixture');
        const publicRelease=process.argv.find(arg=>arg.startsWith('--public-release='))?.slice(17);
        if(publicRelease)assert.match(publicRelease,/^[a-zA-Z0-9-]+$/);
        const hostUrl=publicRelease?'https://philofobreal.github.io'+hostFixture+'?release='+publicRelease:origin+hostFixture;
        await send('Page.navigate', { url: hostUrl });
        let host;
        for (let i = 0; i < 400; i++) {
            const text = await evaluate('document.querySelector("#result")?.textContent');
            if (text?.startsWith('FAIL:')) throw Error(text);
            if (text?.startsWith('{')) { host = JSON.parse(text); break; } await sleep(200);
        }
        await writeFile(path.join(output, 'host-smoke.json'), JSON.stringify(host, null, 2) + '\n', { flag: 'wx' });
        assert.equal(host?.pass, true, JSON.stringify(host));
        if(replaySourceArg){
            const rows=[];
            for(const source of replayManifest.sources){
                const spec=replaySpecs.find(r=>r.name===source.name);
                for (const {name: suffix, ...settings} of replayProfiles(shortGop ? 'short-gop-v1' : refineQuality ? 'refine-v1' : undefined)) {
                    const name = source.name.replace('.mp4', '') + '-' + suffix + '.webm';
                    const request={width:spec.width,height:spec.height,fps:source.fps,bitrate:spec.width*spec.height>=3840*2160?64000000:spec.width*spec.height>=1920*1080?14000000:8000000,
                        ...settings,frames:source.frames.map(({name,index})=>({name,index}))};
                    const report=await evaluate('window.runWh07Replay('+JSON.stringify(request)+','+JSON.stringify(name)+')');
                    const row={source:source.name,request:{...request,frames:request.frames.length},...report};
                    if(report.name){
                        const data=await evaluate(`(async()=>{const b=window.wh07ReplayBlobs.get(${JSON.stringify(name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(b);});})()`);
                        const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length<=64*1024*1024);
                        const file=path.join(output,name);await writeFile(file,bytes,{flag:'wx'});row.sha256=hash(bytes);row.fileBytes=bytes.length;
                        const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',file],{windowsHide:true}));row.video=probe.streams.find(s=>s.codec_type==='video');
                        const pixels=execFileSync('ffmpeg',['-v','error','-threads','2','-i',file,'-vf','crop=192:32:0:0,format=gray','-f','rawvideo','-'],{windowsHide:true,maxBuffer:1024*1024});
                        row.independentIds=[];for(let start=0;start<pixels.length;start+=192*32){let id=0;for(let bit=0;bit<6;bit++)if(pixels[start+16*192+bit*32+16]>128)id|=1<<bit;row.independentIds.push(id);}
                        await evaluate('window.wh07ReplayBlobs.clear()');
                    }
                    rows.push(row);await writeFile(path.join(output,'source-replay.json'),JSON.stringify({measurementComplete:false,rows},null,2)+'\n');
                    console.log(JSON.stringify({replay: source.name, ...settings, stage: report.stage, error: report.error, bytes: row.fileBytes}));
                }
            }
            await writeFile(path.join(output,'source-replay.json'),JSON.stringify({measurementComplete:true,productionPromoted:false,rows},null,2)+'\n');
        }
        if (process.argv.includes('--diagnostics-host')) {
            const diagnostic = await evaluate('window.runWh06c1()');
            await writeFile(path.join(output,'export-diagnostics.json'),JSON.stringify(diagnostic,null,2)+'\n',{flag:'wx'});
            assert.equal(diagnostic?.pass,true,JSON.stringify(diagnostic));
            console.log(JSON.stringify({diagnosticChecks:diagnostic.checks,pass:diagnostic.pass}));
        }
        if (process.argv.includes('--exact-host')) {
            const exact = await evaluate('window.runWh06Exact()');
            await writeFile(path.join(output,'exact-host.json'),JSON.stringify(exact,null,2)+'\n',{flag:'wx'});
            assert.equal(exact?.pass,true,JSON.stringify(exact));
            const samples=await evaluate(`(async()=>{
                const rows=[];
                for(const a of document.querySelectorAll('#exact-views a')){
                    const blob=await(await fetch(a.href)).blob();
                    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
                    rows.push({name:a.download,data});
                }return rows;
            })()`);
            const images=[];
            for(const [index,sample] of samples.entries()){
                assert.match(sample.name,/^[a-zA-Z0-9-]+\.png$/);const data=Buffer.from(sample.data.split(',')[1],'base64');
                const name='exact-'+index+'-'+sample.name;
                await writeFile(path.join(output,name),data,{flag:'wx'});
                images.push({name,sha256:hash(data),width:data.readUInt32BE(16),height:data.readUInt32BE(20)});
            }
            assert.equal(images.length,4);assert.ok(images.every(i=>i.width===3840&&i.height===2160));
            await writeFile(path.join(output,'exact-images.json'),JSON.stringify(images,null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({exactRows:exact.rows.length,exactPass:exact.pass,fullSizeSamples:images.length}));
        }

        if(process.argv.includes('--export-host')){
            let report;try{report=await evaluate('window.runWh06Export('+JSON.stringify({turbo:process.argv.includes('--turbo-export-host'),nativePackets:process.argv.includes('--native-packets'),predictiveDetail:process.argv.includes('--predictive-detail'),profileSourceOnly:process.argv.includes('--profile-source')||process.argv.includes('--profile-check'),noSourceArchive:process.argv.includes('--profile-check'),qualityQuantizer})+')');}catch(error){
                await writeFile(path.join(output,'integrated-export-failure.json'),JSON.stringify(await evaluate('window.wh06ExportFailure'),null,2)+'\n',{flag:'wx'});
                for(const name of await evaluate('Array.from(window.wh06ExportBlobs.keys())')){
                    assert.match(name,/^export-\d{3}\.(?:webm|mp4)$/);
                    const data=await evaluate(`(async()=>{const blob=window.wh06ExportBlobs.get(${JSON.stringify(name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(blob);});})()`);
                    const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length<=64*1024*1024);
                    await writeFile(path.join(output,name),bytes,{flag:'wx'});
                }throw error;
            }
            await writeFile(path.join(output,'integrated-export.json'),JSON.stringify(report??{failure:await evaluate('document.querySelector("#export-result").textContent')},null,2)+'\n',{flag:'wx'});
            assert.equal(report?.pass,true,'Integrated export failed; see integrated-export.json');
            const artifacts=[],turboArtifacts=[];
            for(const row of [...report.rows,...(report.turboRows??[])].filter(r=>r.name)){
                assert.match(row.name,/^export-\d{3}\.(?:webm|mp4)$/);
                const encoded=await evaluate(`(async()=>{const blob=window.wh06ExportBlobs.get(${JSON.stringify(row.name)});return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});})()`);
                assert.match(encoded,/^data:.*;base64,/);const bytes=Buffer.from(encoded.slice(encoded.indexOf(',')+1),'base64');
                assert.ok(bytes.length>0&&bytes.length<=64*1024*1024);assert.equal(bytes.length,row.bytes);
                const file=path.join(output,row.name);await writeFile(file,bytes,{flag:'wx'});
                const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{windowsHide:true,encoding:'utf8',timeout:60_000}));
                const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
                assert.equal(video.width,row.width);assert.equal(video.height,row.height);assert.equal(audio.channels,2);
                if(row.precision)assert.match(video.pix_fmt,/10/,'High-precision export lost bit depth');
                if(row.name.endsWith('.mp4')&&video.codec_name==='vp9'){
                    assert.equal(video.color_primaries,'bt709','VP9 MP4 lost declared Canvas primaries');
                    assert.ok(['bt709','iec61966-2-1'].includes(video.color_transfer),'VP9 MP4 lost declared Canvas transfer');
                }
                const ids=execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-vf','crop=192:32:0:0,scale=6:1:flags=neighbor','-pix_fmt','gray','-fps_mode','passthrough','-f','rawvideo','pipe:1'],{windowsHide:true,timeout:120_000,maxBuffer:1024*1024});
                assert.equal(ids.length,row.frames*6);
                const decoded=[];for(let i=0;i<row.frames;i++){
                    let id=0;for(let bit=0;bit<6;bit++)if(ids[i*6+bit]>128)id|=1<<bit;
                    assert.equal(id,i+1,'Independent FFmpeg decoded frame ID mismatch');decoded.push(id);
                }
                const inspection=qualityQuantizer!==undefined&&row.format==='mp4'&&row.precision?await evaluate('window.inspectWh07Packets('+JSON.stringify(bytes.toString('base64'))+',"video/mp4")'):undefined;
                (row.performanceMode==='turbo'?turboArtifacts:artifacts).push({name:row.name,sha256:hash(bytes),bytes:bytes.length,video,audio,decodedIds:decoded,...(inspection?{inspection}:{})});
            }
            if(process.argv.includes('--profile-source')){
                const sources=[];
                for(const row of report.rows.filter(r=>r.name)){
                    assert.equal(row.sourceFrames?.length,row.frames);
                    const frames=[];
                    for(const sample of row.sourceFrames){
                        assert.match(sample.name,/^source-export-\d{3}-\d{3}\.png$/);
                        const data=await evaluate(`(async()=>{const b=window.wh07SourceBlobs.get(${JSON.stringify(sample.name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(b);});})()`);
                        const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length<=16*1024*1024);
                        await writeFile(path.join(output,sample.name),bytes,{flag:'wx'});frames.push({...sample,sha256:hash(bytes)});
                    }
                    sources.push({name:row.name,fps:row.fps,frames});
                }
                await writeFile(path.join(output,'source-frames.json'),JSON.stringify({sources},null,2)+'\n',{flag:'wx'});
            }
            await writeFile(path.join(output,'integrated-export-artifacts.json'),JSON.stringify({pass:true,artifacts,...(turboArtifacts.length?{turboArtifacts}:{})},null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({exportRows:report.rows.length,files:artifacts.length,independentlyDecoded:true,turboRows:report.turboRows?.length??0,turboFiles:turboArtifacts.length}));
        }
        const remuxInput=process.argv.find(arg=>arg.startsWith('--remux-reference='))?.slice(18);
        if(remuxInput) {
            const input=path.resolve(remuxInput),info=await stat(input);assert.ok(info.isFile()&&info.size>0&&info.size<=64*1024*1024,'Reference clip must fit 64 MiB');
            const source=await readFile(input);assert.equal(source.length,info.size,'Reference input changed');
            const outputFile=path.join(output,'reference-remux.mp4');
            const tool=(name,args)=>execFileSync(name,args,{windowsHide:true,encoding:'utf8',timeout:120_000,maxBuffer:4*1024*1024});
            const probe=file=>JSON.parse(tool('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',file]));
            const before=probe(input),original=before.streams.find(s=>s.codec_type==='video');
            assert.equal(original.codec_name,'vp9');assert.match(original.pix_fmt,/10/);assert.ok(Number(original.nb_read_frames)<=63,'Use the frame-ID reference clip');
            assert.ok(original.width*original.height<=3840*2160&&Number(original.nb_read_frames)>0);
            const fps=original.r_frame_rate.split('/').map(Number).reduce((a,b)=>a/b);assert.ok([30,60].includes(fps));
            tool('ffmpeg',['-v','error','-nostdin','-n','-i',input,'-map','0:v:0','-map','0:a:0','-c:v','copy',
                ...(process.argv.includes('--remux-cfr')?['-bsf:v',`setts=pts=N/(${fps}*TB):dts=N/(${fps}*TB):duration=1/(${fps}*TB)`,'-video_track_timescale','90000']:[]),...(process.argv.includes('--remux-color709')?['-color_primaries','bt709','-color_trc','bt709']:[]),'-c:a','aac','-b:a','192k',
                '-avoid_negative_ts','disabled','-use_editlist','1','-movflags','+delay_moov+default_base_moof+frag_keyframe','-frag_duration','1000000','-flush_packets','1',outputFile]);
            const after=probe(outputFile),video=after.streams.find(s=>s.codec_type==='video'),audio=after.streams.find(s=>s.codec_type==='audio');
            assert.equal(video.nb_read_frames,original.nb_read_frames);assert.equal(video.pix_fmt,original.pix_fmt);assert.equal(audio.codec_name,'aac');
            const packets=file=>JSON.parse(tool('ffprobe',['-v','error','-select_streams','v:0','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts_time,dts_time,flags,data_hash','-of','json',file])).packets;
            const a=packets(input),b=packets(outputFile);assert.deepEqual(b.map(x=>x.data_hash),a.map(x=>x.data_hash),'Encoded packet payload changed');
            const decoded=file=>tool('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-an','-f','streamhash','-']).trim();
            const beforeDecoded=decoded(input),afterDecoded=decoded(outputFile);assert.equal(afterDecoded,beforeDecoded,'Decoded pixels changed during remux');
            const bytes=await readFile(outputFile);let browser;
            try{browser=await evaluate('window.verifyWh07Remux('+JSON.stringify(bytes.toString('base64'))+','+Number(video.nb_read_frames)+')');}catch(error){browser={pass:false,message:String(error.message)};}
            if(process.argv.includes('--inspect-remux')) {
                const sourceView=await evaluate('window.inspectWh07Packets('+JSON.stringify(source.toString('base64'))+',"video/webm")');
                const outputView=await evaluate('window.inspectWh07Packets('+JSON.stringify(bytes.toString('base64'))+',"video/mp4")');
                const inspection={source:sourceView,output:outputView,ffprobeSource:a,ffprobeOutput:b};
                await writeFile(path.join(output,'packet-inspection.json'),JSON.stringify(inspection,null,2)+'\n',{flag:'wx'});
                console.log(JSON.stringify({packetInspection:true,source:sourceView.decoded.map(x=>({name:x.name,pass:x.pass,ids:x.ids})),output:outputView.decoded.map(x=>({name:x.name,pass:x.pass,ids:x.ids}))}));
            }
            const report={pass:browser.pass===true,cfr:process.argv.includes('--remux-cfr'),input,sourceSha256:hash(source),outputSha256:hash(bytes),before,after,sourcePackets:a,outputPackets:b,decoded:beforeDecoded,browser,
                scope:'Native FFmpeg reference only, not a browser/WASM exporter or a speed claim. Video packets and decoded pixels are identical to accepted WebM. Audio here is an Opus-to-AAC control; a product path must retain original PCM-to-AAC.'};
            await writeFile(path.join(output,'reference-remux.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
            assert.equal(browser.pass,true,JSON.stringify(browser));
            console.log(JSON.stringify({referenceRemux:true,frames:b.length,encodedPacketsIdentical:true,decodedPixelsIdentical:true,browserIds:browser.decodedIds}));
        }
        if(process.argv.includes('--detail-host')) {
            const profile=detailProfileArg??'reference';
            const report=await evaluate('window.runWh07Detail('+JSON.stringify(profile)+','+process.argv.includes('--level-boundary')+')');
            await writeFile(path.join(output,'predictive-detail.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
            assert.equal(report.pass,true);assert.equal(report.inputs.length,8);
            const artifacts=[];
            for(const row of report.containers){
                assert.match(row.name,/^detail-(?:packets|product|stage)\.(?:webm|mp4)$/);
                const encoded=await evaluate(`(async()=>{const b=window.wh07DetailBlobs.get(${JSON.stringify(row.name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(b);});})()`);
                const bytes=Buffer.from(encoded.split(',')[1],'base64');assert.ok(bytes.length<=64*1024*1024);
                const file=path.join(output,row.name);await writeFile(file,bytes,{flag:'wx'});
                const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-vf','crop=192:32:0:0,scale=6:1:flags=neighbor','-pix_fmt','gray','-fps_mode','passthrough','-f','rawvideo','pipe:1'],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});
                assert.equal(raw.length,48);const ids=[];for(let i=0;i<8;i++)ids.push([...raw.subarray(i*6,i*6+6)].reduce((id,v,bit)=>v>128?id|(1<<bit):id,0));
                artifacts.push({name:row.name,sha256:hash(bytes),decodedIds:ids});
            }
            await writeFile(path.join(output,'predictive-detail-artifacts.json'),JSON.stringify({artifacts},null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({detailProbe:true,inputIds:report.inputs.map(r=>r.id),nativeIds:report.native.ids,containers:artifacts}));
        }
        if(process.argv.includes('--codec-host')) {
            const codecs=await evaluate('window.runWh07CodecMatrix()');assert.equal(codecs.type,'codec_matrix_done');assert.equal(codecs.rows.length,24);
            await writeFile(path.join(output,'codec-matrix.json'),JSON.stringify(codecs,null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({codecProbes:codecs.rows.length,scope:codecs.scope}));
        }
        if (process.argv.includes('--isolate-host')) {
            const report=await evaluate('window.runWh07Benchmark({mp4Only:true,pipelineProbe:true})');
            assert.equal(report?.pass,true);assert.equal(report.rows.length,12);
            await writeFile(path.join(output,'pipeline-isolation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
            const artifacts=[];
            for(const row of report.rows) {
                assert.ok(row.performanceReport.peakOutstandingFrames<=2);
                if(row.media===false) {
                    assert.equal(row.isolation.kind,'unencoded-pipeline-probe');assert.equal(row.isolation.frames,row.frames);
                    assert.ok(row.name.endsWith('.json'));continue;
                }
                assert.match(row.name,/^turbo-(?:720p|4k)-mp4-display-[1-3]\.mp4$/);
                const data=await evaluate(`(async()=>{const blob=window.wh07Blobs.get(${JSON.stringify(row.name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(blob);});})()`);
                const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length<=128*1024*1024);
                const file=path.join(output,row.name);await writeFile(file,bytes,{flag:'wx'});
                const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',file],{windowsHide:true,encoding:'utf8',timeout:120_000}));
                const video=metadata.streams.find(s=>s.codec_type==='video'),audio=metadata.streams.find(s=>s.codec_type==='audio');
                assert.equal(Number(video.nb_read_frames),row.frames);assert.match(video.pix_fmt,/10/);assert.equal(audio.channels,2);
                const decoded=execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-an','-f','streamhash','-'],{windowsHide:true,encoding:'utf8',timeout:120_000}).trim();
                artifacts.push({name:row.name,sha256:hash(bytes),video,audio,decoded});
            }
            assert.equal(artifacts.length,6);
            await writeFile(path.join(output,'isolation-artifacts.json'),JSON.stringify({artifacts},null,2)+'\n',{flag:'wx'});
            const codecs=await evaluate('window.runWh07CodecMatrix()');assert.equal(codecs.type,'codec_matrix_done');assert.equal(codecs.rows.length,24);
            await writeFile(path.join(output,'codec-matrix.json'),JSON.stringify(codecs,null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({isolationRows:report.rows.length,actualVideos:artifacts.length,codecProbes:codecs.rows.length,scope:'Diagnostic only, no product or Turbo promotion'}));
        }
        if (process.argv.includes('--turbo-host')) {
            const report=await evaluate('window.runWh07Benchmark('+JSON.stringify({stableMaterial:process.argv.includes('--stable-material'),pairedEncoder:process.argv.includes('--paired-encoder'),mp4Only:process.argv.includes('--mp4-only'),nativePackets:process.argv.includes('--native-packets'),predictiveDetail:process.argv.includes('--predictive-detail'),profileSourceOnly:process.argv.includes('--profile-source')||process.argv.includes('--profile-check'),noSourceArchive:process.argv.includes('--profile-check'),qualityQuantizer})+')');
            await writeFile(path.join(output,'turbo-benchmark.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
            assert.equal(report?.pass,true);assert.equal(report.rows.length,process.argv.includes('--mp4-only')?12:24);
            const artifacts=[];
            for(const row of report.rows){
                assert.match(row.name,/^turbo-(?:720p|4k)-(?:mp4|webm)-(?:display|cooperative)-[1-3]\.(?:mp4|webm)$/);
                const data=await evaluate(`(async()=>{const blob=window.wh07Blobs.get(${JSON.stringify(row.name)});return await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=j;f.readAsDataURL(blob);});})()`);
                const bytes=Buffer.from(data.split(',')[1],'base64');assert.ok(bytes.length<=128*1024*1024);const file=path.join(output,row.name);await writeFile(file,bytes,{flag:'wx'});
                const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',file],{windowsHide:true,encoding:'utf8',timeout:120_000}));
                const video=metadata.streams.find(s=>s.codec_type==='video'),audio=metadata.streams.find(s=>s.codec_type==='audio');
                assert.equal(Number(video.nb_read_frames),row.frames);assert.match(video.pix_fmt,/10/);assert.equal(audio.channels,2);
                const decoded=execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-an','-f','streamhash','-'],{windowsHide:true,encoding:'utf8',timeout:120_000}).trim();
                artifacts.push({name:row.name,sha256:hash(bytes),video,audio,decoded});
            }
            const comparisons=report.rows.filter(r=>r.scheduling==='display').map(row=>{
                const candidate=report.rows.find(r=>r.resolution===row.resolution&&r.format===row.format&&r.run===row.run&&r.scheduling==='cooperative');
                const baseline=artifacts.find(a=>a.name===row.name),actual=artifacts.find(a=>a.name===candidate.name);
                return {resolution:row.resolution,format:row.format,run:row.run,displayMs:row.elapsedMs,cooperativeMs:candidate.elapsedMs,
                    gain:1-candidate.elapsedMs/row.elapsedMs,exactDecodedPixels:baseline.decoded===actual.decoded};
            });
            await writeFile(path.join(output,'turbo-artifacts.json'),JSON.stringify({artifacts,comparisons},null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({turboComparisons:comparisons}));
        }
        if (publicRelease && process.argv.includes('--diagnostics-host')) {
            const hosts=[];
            for (const route of ['', 'mvp/']) {
                await send('Page.navigate',{url:'https://philofobreal.github.io/plexus-engine/'+route+'?release='+publicRelease});
                const selector=route?'.mvp-export-fps':'#export-fps';
                for(let i=0;i<200&&!await evaluate('Boolean(document.querySelector('+JSON.stringify(selector)+'))');i++)await sleep(100);
                for(let i=0;i<200&&await evaluate('Boolean(document.querySelector("#app-loader,#mvp-app-loader"))');i++)await sleep(50);
                assert.equal(await evaluate('Boolean(document.querySelector("#app-loader,#mvp-app-loader"))'),false,'Product boot overlay did not finish');
                const actual=await evaluate(`(()=>{
                    const fps=document.querySelector(${JSON.stringify(selector)});
                    const before=fps?.value;
                    const speed=document.querySelector(${JSON.stringify(route?'.mvp-export-performance':'#export-performance')}),beforeSpeed=speed?.value;
                    if(!speed)throw Error('Product throughput control missing');
                    speed.value=${JSON.stringify(route?'economy':'turbo')};speed.dispatchEvent(new Event('change',{bubbles:true}));
                    if(!fps)throw Error('Product FPS control missing');
                    fps.value=${JSON.stringify(route?'60':'30')};fps.dispatchEvent(new Event('change',{bubbles:true}));
                    return {before,beforeSpeed,selected:fps.value,saved:localStorage.getItem('plexus.export.fps'),speed:speed.value,savedSpeed:localStorage.getItem('plexus.export.performance.v1'),
                        copy:Boolean(document.querySelector(${JSON.stringify(route?'.mvp-export-copy':'#copy-export-diagnostics')})),
                        summary:Boolean(document.querySelector(${JSON.stringify(route?'.mvp-export-codec-diagnostic':'#export-diagnostic-status')})),
                        dashboardSummaryOutsideActions:!document.querySelector('#export-diagnostic-status')?.closest('.timeline-actions')};
                })()`);
                assert.equal(actual.copy,true);assert.equal(actual.summary,true);
                assert.equal(actual.saved,route?'60':'30');
                assert.equal(actual.savedSpeed,route?'economy':'turbo');
                if(route){assert.equal(actual.beforeSpeed,'turbo','MVP must read dashboard throughput preference');assert.equal(actual.before,'30','MVP must read dashboard FPS preference');}
                else assert.equal(actual.dashboardSummaryOutsideActions,true);
                hosts.push({route,...actual});
                if(route){
                    // Layout-only sample: expose the already constructed empty-track dialog.
                    // This does not claim an audio-backed product-button or mobile codec test.
                    await send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:false});
                    await evaluate('document.querySelector(".mvp-export-performance").closest(".mvp-modal-scrim").classList.remove("mvp-hidden")');
                }
                await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
                if(route){
                    const layout=await evaluate('Object.fromEntries([".mvp-export-fps",".mvp-export-performance"].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{width:r.width,height:r.height}]}))');
                    assert.ok(Object.values(layout).every(r=>r.width>=200&&r.height>=40),'Export selectors must be readable and touch sized');
                    hosts.at(-1).layout=layout;
                }
                const picture=await send('Page.captureScreenshot',{format:'png'});
                await writeFile(path.join(output,route?'product-mvp-export-layout.png':'product-dashboard-layout.png'),Buffer.from(picture.data,'base64'),{flag:'wx'});
            }
            await writeFile(path.join(output,'diagnostic-host-controls.json'),JSON.stringify({pass:true,release:publicRelease,hosts,
                scope:'Actual published startup controls and cross-host FPS persistence; no audio export or physical-mobile claim.'},null,2)+'\n',{flag:'wx'});
        }
        if (process.argv.includes('--mobile-codec-host')) {
            const route = '/plexus-engine/tests/browser/mobile-codec-probe.html';
            const probeUrl = publicRelease ? 'https://philofobreal.github.io' + route + '?release=' + publicRelease : origin + route;
            await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
            await send('Page.navigate', {url:probeUrl});
            for (let i = 0; i < 100 && !await evaluate('document.querySelector("#start")?.disabled === false'); i++) await sleep(100);
            const readReport = () => evaluate('JSON.parse(document.querySelector("#report").value || "null")');
            await evaluate('document.querySelector("#start").click(); document.querySelector("#cancel").click();');
            assert.equal((await readReport()).status, 'cancelled');
            await evaluate('document.querySelector("#start").click()');
            let report;
            for (let i = 0; i < 240; i++) {
                report = await readReport();
                if (report) break;
                await sleep(500);
            }
            assert.equal(report?.status, 'complete', JSON.stringify(report));
            assert.equal(report.release, publicRelease ?? null);
            await writeFile(path.join(output, 'mobile-codec-observed.json'), JSON.stringify(report, null, 2)+'\n', {flag:'wx'});
            const cases = mobileCodecProbeConfigurations();
            assert.deepEqual(report.rows.map(r => r.id), cases.map(r => r.id));
            for (const [i, row] of report.rows.entries()) {
                for (const key of ['codec', 'width', 'height', 'framerate', 'bitrate']) assert.equal(row.config[key], cases[i][key]);
                assert.equal(row.outcome, mobileCodecOutcome(row));
                if (row.stage === 'complete') assert.deepEqual(row.decodedTimestamps, row.timestamps);
            }
            assert.equal(report.rows[0].outcome, 'control-pass', 'Desktop browser must complete the 8-bit control');
            assert.ok(report.rows.some(row => row.group === 'product' && row.outcome === 'ten-bit-confirmed'),
                'Desktop browser must confirm a 10-bit VP9 bitstream and decode it');

            // Exercise the actual clipboard action and downloaded JSON in an isolated browser profile.
            await send('Browser.grantPermissions', {origin:new URL(probeUrl).origin, permissions:['clipboardReadWrite', 'clipboardSanitizedWrite']});
            await send('Emulation.setFocusEmulationEnabled', {enabled:true});
            const copied = await evaluate(`(async () => {
                document.querySelector('#copy').click();
                for (let i = 0; i < 40; i++) {
                    if (document.querySelector('#status').textContent.includes('vágólapra')) return navigator.clipboard.readText();
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                return null;
            })()`, true);
            if (copied) assert.deepEqual(JSON.parse(copied), report);
            else assert.equal(await evaluate(`document.querySelector('#report').selectionEnd === document.querySelector('#report').value.length`), true);
            await send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:output});
            await evaluate('document.querySelector("#save").click()');
            let saved;
            for (let i = 0; i < 50; i++) {
                try { saved = await readFile(path.join(output, 'plexus-mobile-codec-report.json'), 'utf8'); break; }
                catch (error) { if (error.code !== 'ENOENT') throw error; await sleep(100); }
            }
            assert.deepEqual(JSON.parse(saved), report);
            assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Probe layout must fit a phone viewport');
            const screenshot = await send('Page.captureScreenshot', {format:'png'});
            await writeFile(path.join(output, 'mobile-codec-layout.png'), Buffer.from(screenshot.data, 'base64'), {flag:'wx'});
            const proof = {pass:true, cases:report.rows.length, cancelRetry:true, copied:Boolean(copied), selectedForCopy:!copied, downloaded:true,
                scope:'Desktop Chrome with a phone viewport. Physical phone results are collected separately.', report};
            await writeFile(path.join(output, 'mobile-codec-browser.json'), JSON.stringify(proof, null, 2)+'\n', {flag:'wx'});
            console.log(JSON.stringify({mobileCodecProbe:proof.pass, cases:proof.cases, outcomes:report.rows.map(r => [r.id,r.outcome])}));
        }
        if (process.argv.includes('--wasm-codec-host') || process.argv.includes('--wasm-simd-host')) {
            const variant = process.argv.includes('--wasm-simd-host') ? 'simd' : 'scalar';
            const route = '/plexus-engine/tests/browser/mobile-codec-probe.html';
            const url = publicRelease ? 'https://philofobreal.github.io' + route + '?release=' + publicRelease : origin + route;
            await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
            await send('Page.navigate', {url});
            for (let i = 0; i < 100 && !await evaluate('document.querySelector("#wasm-start")?.disabled === false'); i++) await sleep(100);
            await evaluate('document.querySelector("#wasm-variant").value = ' + JSON.stringify(variant));
            const reportField = 'JSON.parse(document.querySelector("#wasm-report").value || "null")';
            await evaluate('document.querySelector("#wasm-start").click(); document.querySelector("#wasm-cancel").click();');
            assert.equal((await evaluate(reportField))?.status, 'cancelled');
            await evaluate('document.querySelector("#wasm-start").click()');
            let report;
            for (let i = 0; i < 380; i++) {
                report = await evaluate(reportField);
                if (report) break;
                await sleep(500);
            }
            await writeFile(path.join(output, 'wasm-codec-observed.json'), JSON.stringify(report,null,2)+'\n', {flag:'wx'});
            assert.equal(report?.status, 'complete', JSON.stringify(report));
            assert.equal(report.release, publicRelease ?? null);
            assert.equal(report.variant, variant);
            assert.equal(report.stats.variant, variant);
            assert.match(report.stats.wasmSha256, /^[a-f0-9]{64}$/);
            assert.equal(report.stats.encodedFrames, 30);
            assert.equal(report.stats.encodedBitDepth, 10);
            assert.ok(report.stats.wasmLinearMemoryBytes <= 128 * 1024 * 1024);
            const videoBytes = await evaluate(`(async () => {
                const link = document.querySelector('#wasm-download');
                const clip = await (await fetch(link.href)).blob();
                return new Promise((resolve,reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(clip);
                });
            })()`);
            const clip = Buffer.from(videoBytes,'base64');
            assert.equal(clip.byteLength, report.stats.fileBytes);
            await writeFile(path.join(output, 'vp9-10bit-probe.mp4'),clip,{flag:'wx'});
            await evaluate(`(async () => {
                const video = document.querySelector('#wasm-video');
                try { await video.play(); } catch {}
                return true;
            })()`, true);
            for (let i = 0; i < 60; i++) {
                report = await evaluate(reportField);
                if (report.playback !== 'not-tested') break;
                await sleep(100);
            }
            assert.equal(report.playback, 'ended', JSON.stringify(report));
            assert.equal(report.decodedVideoWidth,1280);
            assert.equal(report.decodedVideoHeight,720);
            const clipPath = path.join(output, 'vp9-10bit-probe.mp4');
            const streams = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-of','json',clipPath],
                {windowsHide:true,encoding:'utf8',timeout:30000})).streams;
            assert.equal(streams.length,1);
            assert.deepEqual([streams[0].codec_name, streams[0].profile, streams[0].pix_fmt, streams[0].nb_frames],
                ['vp9','Profile 2','yuv420p10le','30']);
            const decodedHash = execFileSync('ffmpeg', ['-v','error','-threads','2','-i',clipPath,'-an',
                '-pix_fmt','yuv420p10le','-f','streamhash','-hash','sha256','-'], {windowsHide:true,encoding:'utf8',timeout:30000}).trim();
            assert.equal(decodedHash, '0,v,SHA256=6bed43471dca408ee9e11bcc0c270217e1f38ace4680bd87226c56a48b80dbb8');
            const screenshot = await send('Page.captureScreenshot',{format:'png'});
            await writeFile(path.join(output,'wasm-codec-layout.png'),Buffer.from(screenshot.data,'base64'),{flag:'wx'});
            await writeFile(path.join(output,'wasm-codec-browser.json'),JSON.stringify({pass:true, report, sha256:hash(clip), decodedHash},null,2)+'\n',{flag:'wx'});
            console.log(JSON.stringify({wasmCodecProbe:true, ...report.stats, playback:report.playback}));
        }
        await writeFile(path.join(root, 'active-run.txt'), output + '\n');
        console.log(JSON.stringify({ output, pass: true, cases: 8, hostRows: host.rows.length, ...(publicRelease?{publicRelease}:{}) }));
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
// Separate offline decoder comparison: never included in whole-job speed timings.
async function compareEncoded(baselineDirectory, candidateDirectory) {
    const baseline=path.resolve(baselineDirectory??''),candidate=path.resolve(candidateDirectory??'');
    assert.notEqual(baseline,candidate,'Supply independent control and candidate runs');
    const read=async(dir,name)=>JSON.parse(await readFile(path.join(dir,name),'utf8'));
    const control=await read(baseline,'integrated-export.json'),actual=await read(candidate,'integrated-export.json');
    assert.equal(control.pass,true);assert.equal(actual.pass,true);
    const baselineBuild=await read(baseline,'build.json'),candidateBuild=await read(candidate,'build.json');
    const sourceMap=new Map(candidateBuild.sourceInputs.map(x=>[x.path,x.sha256]));
    for(const input of baselineBuild.sourceInputs.filter(x=>x.path.startsWith('src/')||x.path==='tests/browser/wormhole-host-backend-smoke.html'))assert.equal(sourceMap.get(input.path),input.sha256,'Producer changed: '+input.path);
    const controlRows=[...control.rows,...(control.turboRows??[])].filter(r=>r.name),candidateRows=[...actual.rows,...(actual.turboRows??[])].filter(r=>r.name);
    assert.equal(controlRows.length,36);assert.equal(candidateRows.length,36);
    const output=path.join(root,'encoded-comparison-'+randomUUID());await mkdir(output,{recursive:true});const rows=[];
    for(const [index,row]of candidateRows.entries()){
        assert.match(row.name,/^export-\d{3}\.(?:webm|mp4)$/);const before=controlRows.find(x=>x.name===row.name);assert.ok(before,'Missing reference');
        for(const key of ['resolution','aspect','fps','frames','format','precision','command','post','transitions','mode','display'])assert.equal(row[key],before[key],row.name+' '+key);
        assert.ok([30,60].includes(row.fps)&&integer(row.frames,1,63));
        const left=path.join(baseline,row.name),right=path.join(candidate,row.name);
        const ssim='ssim-'+index+'.txt',psnr='psnr-'+index+'.txt';
        const filter=`[0:v]settb=AVTB,setpts=N/(${row.fps}*TB),format=gbrp16le,split=2[a][c];[1:v]settb=AVTB,setpts=N/(${row.fps}*TB),format=gbrp16le,split=2[b][d];[a][b]ssim=stats_file=${ssim}[s];[c][d]psnr=stats_file=${psnr}[p]`;
        execFileSync('ffmpeg',['-v','error','-nostdin','-threads','2','-i',left,'-threads','2','-i',right,'-filter_complex_threads','2','-filter_complex',filter,'-map','[s]','-map','[p]','-frames:v',String(row.frames),'-an','-f','null','-'],{cwd:output,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
        const scores=evaluateEncodedStats(await readFile(path.join(output,ssim),'utf8'),await readFile(path.join(output,psnr),'utf8'),row.frames);
        rows.push({name:row.name,referenceSha256:hash(await readFile(left)),candidateSha256:hash(await readFile(right)),changedProfile:row.format==='mp4'&&row.precision===true,...scores});
    }
    const report={pass:rows.every(row=>row.pass),baseline,candidate,scope:'Independent full decoded-frame RGB16 comparison to accepted all-key output. Not a raw-input or whole-song/perceptual guarantee.',rows};
    await writeFile(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({output,pass:report.pass,rows:rows.length,failed:rows.filter(r=>!r.pass).map(r=>({name:r.name,minSsim:r.minSsim,minPsnrDb:r.minPsnrDb}))}));
    assert.equal(report.pass,true,'Encoded comparison did not meet its fixed per-frame gates; evidence retained');
}

async function compareSources(baselineDirectory,candidateDirectory){
    const baseline=path.resolve(baselineDirectory??''),candidate=path.resolve(candidateDirectory??'');assert.notEqual(baseline,candidate);
    const read=async(dir,name)=>JSON.parse(await readFile(path.join(dir,name),'utf8'));
    const before=await read(baseline,'source-frames.json'),after=await read(candidate,'source-frames.json');
    assert.equal(before.sources.length,12);assert.equal(after.sources.length,12);
    const output=path.join(root,'source-comparison-'+randomUUID());await mkdir(output,{recursive:true});const rows=[];
    for(const [index,row]of after.sources.entries()){
        assert.match(row.name,/^export-\d{3}\.mp4$/);const control=before.sources.find(x=>x.name===row.name);assert.ok(control);assert.equal(row.fps,control.fps);assert.equal(row.frames.length,control.frames.length);
        assert.deepEqual(row.frames.map(f=>f.sha256),control.frames.map(f=>f.sha256),'Actual source images differ: '+row.name);
        const measure=async(dir,samples,role)=>{
            const ssim=`${role}-ssim-${index}.txt`,psnr=`${role}-psnr-${index}.txt`;
            const pattern=path.join(dir,'source-'+row.name.replace('.mp4','')+'-%03d.png');
            const filter=`[0:v]settb=AVTB,setpts=N/(${row.fps}*TB),format=gbrp16le,split=2[a][c];[1:v]settb=AVTB,setpts=N/(${row.fps}*TB),format=gbrp16le,split=2[b][d];[a][b]ssim=stats_file=${ssim}[s];[c][d]psnr=stats_file=${psnr}[p]`;
            for(const [i,f]of samples.entries()){assert.equal(f.index,i);assert.equal(hash(await readFile(path.join(dir,f.name))),f.sha256,'Source image changed');}
            execFileSync('ffmpeg',['-v','error','-nostdin','-framerate',String(row.fps),'-start_number','0','-i',pattern,'-threads','2','-i',path.join(dir,row.name),'-filter_complex_threads','2','-filter_complex',filter,'-map','[s]','-map','[p]','-frames:v',String(samples.length),'-an','-f','null','-'],{cwd:output,windowsHide:true,timeout:180000,maxBuffer:1024*1024});
            return evaluateEncodedStats(await readFile(path.join(output,ssim),'utf8'),await readFile(path.join(output,psnr),'utf8'),samples.length).frames.map(({frame,ssim,psnrDb})=>({frame,ssim,psnrDb}));
        };
        const reference=await measure(baseline,control.frames,'baseline'),actual=await measure(candidate,row.frames,'candidate');
        rows.push({name:row.name,sourceHashesEqual:true,...compareOwnSource(reference,actual)});
    }
    const report={pass:rows.every(r=>r.pass),baseline,candidate,scope:'Every encoded picture compared to its own exact input PNG, with matched source hashes across runs. Independent from lossy-output similarity.',rows};
    await writeFile(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,pass:report.pass,rows:rows.length,failed:rows.filter(r=>!r.pass).map(r=>({name:r.name,frames:r.frames.filter(f=>!f.pass)}))}));assert.equal(report.pass,true,'Source-relative quality gate failed; evidence retained');
}

async function analyzeReplay(directory,acceptedComparisonFile){
    const run=path.resolve(directory??''),inputs=JSON.parse(await readFile(path.join(run,'replay-inputs.json'),'utf8')),
        replay=JSON.parse(await readFile(path.join(run,'source-replay.json'),'utf8'));
    const profilesToCheck = replayProfiles(inputs.profileSet);
    const shortGopRun = inputs.profileSet === 'short-gop-v1';
    assert.ok([undefined, 'refine-v1', 'short-gop-v1'].includes(inputs.profileSet), 'Unknown replay cohort');
    assert.equal(replay.measurementComplete, true);
    assert.equal(inputs.sources.length, 12);
    assert.equal(replay.rows.length, inputs.sources.length * profilesToCheck.length);
    const expected = new Set(inputs.sources.flatMap(source => {
        assert.match(source.name, /^export-\d{3}\.mp4$/);
        return profilesToCheck.map(p => source.name.replace('.mp4', '') + '-' + p.name + '.webm');
    }));
    const acceptedBytes=await readFile(path.resolve(acceptedComparisonFile??'')),accepted=JSON.parse(acceptedBytes);
    assert.equal(path.resolve(accepted.baseline),path.resolve(inputs.directory),'Accepted source identity differs');
    assert.equal(accepted.rows.length,12);
    const output=path.join(root,'replay-comparison-'+randomUUID());await mkdir(output,{recursive:true});const rows=[];
    for(const [index,row]of replay.rows.entries()){
        const source=inputs.sources.find(s=>s.name===row.source);assert.ok(source);
        const settings = profilesToCheck.find(p => p.profile === row.profile && p.quantizer === row.quantizer && p.keyInterval === row.keyInterval);
        assert.ok(settings, 'Unexpected replay profile');
        const key = source.name.replace('.mp4', '') + '-' + settings.name + '.webm';
        assert.ok(expected.delete(key), 'Unexpected or duplicate replay row');
        if (!row.name) { rows.push({...row, eligible: false}); continue; }
        assert.equal(row.name, key);
        const file = path.join(run, row.name);
        assert.equal(hash(await readFile(file)), row.sha256);
        for(const f of source.frames)assert.equal(hash(await readFile(path.join(inputs.directory,f.name))),f.sha256);
        const ssim='ssim-'+index+'.txt',psnr='psnr-'+index+'.txt',pattern=path.join(inputs.directory,'source-'+source.name.replace('.mp4','')+'-%03d.png');
        const filter=`[0:v]settb=AVTB,setpts=N/(${source.fps}*TB),format=gbrp16le,split=2[a][c];[1:v]settb=AVTB,setpts=N/(${source.fps}*TB),format=gbrp16le,split=2[b][d];[a][b]ssim=stats_file=${ssim}[s];[c][d]psnr=stats_file=${psnr}[p]`;
        execFileSync('ffmpeg',['-v','error','-nostdin','-framerate',String(source.fps),'-start_number','0','-i',pattern,'-threads','2','-i',file,'-filter_complex_threads','2','-filter_complex',filter,'-map','[s]','-map','[p]','-frames:v',String(source.frames.length),'-an','-f','null','-'],{cwd:output,windowsHide:true,timeout:180000,maxBuffer:1024*1024});
        const scores=evaluateEncodedStats(await readFile(path.join(output,ssim),'utf8'),await readFile(path.join(output,psnr),'utf8'),source.frames.length).frames;
        rows.push({...row,scores});
    }
    assert.equal(expected.size, 0);
    for(const row of rows.filter(r=>r.scores)){
        const control=rows.find(r=>r.source===row.source&&r.profile==='all-key');assert.ok(control?.scores,'Replay all-key control failed');
        row.quality=compareOwnSource(control.scores,row.scores);
        const prior=accepted.rows.find(r=>r.name===row.source);assert.ok(prior?.sourceHashesEqual);
        const acceptedScores=prior.frames.map(f=>({frame:f.frame,ssim:f.sourceSsimBefore,psnrDb:f.sourcePsnrBefore}));
        row.acceptedQuality=compareOwnSource(acceptedScores,row.scores);
        row.eligible=row.quality.pass&&row.acceptedQuality.pass&&row.decoded?.pass&&row.video?.pix_fmt==='yuv420p10le'&&Number(row.video.nb_read_frames)===row.request.frames
            &&row.independentIds.length===row.request.frames&&row.independentIds.every((id,i)=>id===i+1);
    }
    if (inputs.profileSet === 'refine-v1' || shortGopRun) {
        const load = createLoader();
        const {mp4Vp9LevelArgs, readVp9ExportLevel} = load('export/ExportPreparation.ts');
        const {planMp4Storage} = load('export/Mp4StorageAdmission.ts');
        for (const row of rows.filter(r => r.scores)) {
            const {width, height, fps, bitrate} = row.request;
            const packetBytes = row.packets.map(p => p.bytes);
            row.sampledBounds = evaluateReplayBounds({codec: row.decoderConfig.codec, width, height, fps, packetBytes});
            row.fidelityEligible = row.eligible;
            row.eligible = row.fidelityEligible && row.sampledBounds.pass;
            if (!shortGopRun) continue;

            // Compare with the current product budget after the fixed short-job allowance has amortized.
            const seconds = 300;
            const plan = planMp4Storage({frames: seconds * fps, fps, sampleRate: 48000,
                sourceSamples: seconds * 48000, videoBitrate: bitrate});
            assert.ok(plan.ok);
            const rate = Math.ceil(row.sampledBounds.videoBitsPerSecond);
            const projectedVideoPayloadBytes = Math.ceil(seconds * rate / 8);
            row.storageProjection = {seconds, projectedVideoPayloadBytes, productVideoLimitBytes: plan.limits.video,
                steadyVideoCeilingBitsPerSecond: bitrate * 1.5,
                pass: rate < bitrate * 1.5 && projectedVideoPayloadBytes < plan.limits.video,
                scope: 'Sampled payload extrapolation with headroom for container bytes. Full-song storage admission requires an integrated run.'};
            try {
                row.productLevel = Number(mp4Vp9LevelArgs({width, height, fps, bitrate: Math.max(bitrate, rate),
                    nativeLevel: readVp9ExportLevel(row.decoderConfig.codec),
                    maxFourBytes: row.sampledBounds.maxFourPictureBits / 8})[1]);
            } catch (error) {
                row.productLevelError = error.message;
            }
            row.keyPictures = row.packets.flatMap((packet, i) => packet.type === 'key' ? [i] : []);
            row.deltaPictures = row.packets.length - row.keyPictures.length;
            row.eligible = row.eligible && row.storageProjection.pass && Number.isInteger(row.productLevel);
        }
        if (shortGopRun) {
            assert.equal(rows.filter(row => row.profile === 'all-key' && row.fidelityEligible).length, 12, 'Accepted all-key fidelity control drift');
            assert.equal(rows.filter(row => row.quantizer === 0 && row.fidelityEligible).length, 12, 'Positive q0 fidelity control drift');
        }
    }
    const profiles = profilesToCheck.filter(p => p.profile !== 'all-key').map(({name, ...settings}) => {
        const members = rows.filter(row => row.profile === settings.profile && row.quantizer === settings.quantizer && row.keyInterval === settings.keyInterval);
        const allPassed = members.length === 12 && members.every(r => r.eligible);
        return {...(shortGopRun ? {name, ...settings, fidelityCases: members.filter(r => r.fidelityEligible).length,
            sampledLevelCases: members.filter(r => r.sampledBounds?.pass && Number.isInteger(r.productLevel)).length,
            storageCases: members.filter(r => r.storageProjection?.pass).length,
            deltaPictures: members.reduce((sum, r) => sum + (r.deltaPictures ?? 0), 0)} : {quantizer: settings.quantizer}),
            cases: members.length,
            eligible: allPassed && (!shortGopRun || (settings.keyInterval !== undefined && members.some(r => r.deltaPictures > 0))),
            failedSources: members.filter(r => !r.eligible).map(r => r.source)};
    });
    const report={measurementComplete:true,productionPromoted:false,run,acceptedComparison:{path:path.resolve(acceptedComparisonFile),sha256:hash(acceptedBytes)},scope:'Native short codec feasibility against replay all-key AND accepted product own-source fidelity. No integrated MP4/audio/lifecycle/whole-job speed promotion.',profiles,rows};
    await writeFile(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,profiles}));
}

async function probeLevel(directory){
    const dir=path.resolve(directory??''),data=JSON.parse(await readFile(path.join(dir,'predictive-detail.json'),'utf8'));
    assert.equal(data.encoder.width,3840);assert.equal(data.encoder.height,2160);assert.equal(data.encoder.framerate,60);assert.equal(data.inputs.length,8);
    const native=data.decoder.codec,expected=Number(native.split('.')[2]);assert.equal(expected,51);
    const input=await readFile(path.join(dir,'detail-stage.mp4'));assert.ok(input.length<16*1024*1024);
    const {Input,BlobSource,ALL_FORMATS,EncodedPacketSink}=await import('mediabunny');
    const config=async(bytes)=>{const media=new Input({source:new BlobSource(new Blob([bytes])),formats:ALL_FORMATS});try{return await(await media.getPrimaryVideoTrack()).getDecoderConfig();}finally{media.dispose();}};
    const packets=async bytes=>{const media=new Input({source:new BlobSource(new Blob([bytes])),formats:ALL_FORMATS});try{
        const track=await media.getPrimaryVideoTrack(),out=[];
        for await(const p of new EncodedPacketSink(track).packets())out.push(hash(p.data));
        assert.equal(out.length,8);return out;
    }finally{media.dispose();}};
    const decode=file=>execFileSync('ffmpeg',['-v','error','-threads','2','-i',file,'-map','0:v:0','-an','-f','streamhash','-hash','sha256','-'],{windowsHide:true,timeout:120000,maxBuffer:1024*1024}).toString().trim();
    const referencePackets=await packets(input),referenceDecoded=decode(path.join(dir,'detail-stage.mp4'));
    assert.equal(Number((await config(input)).codec.split('.')[2]),expected);
    const output=path.join(root,'level-probe-'+randomUUID());await mkdir(output,{recursive:true});const rows=[];
    const corePath=path.resolve('public/export/ffmpeg-5.1.10/ffmpeg-core.js'),wasmPath=path.resolve('public/export/ffmpeg-5.1.10/ffmpeg-core.wasm');
    const {default:createCore}=await import(pathToFileURL(corePath));const wasm=await readFile(wasmPath);
    for(const [name,args]of [['copy',[]],['level',['-level:v','51']],['fps',['-r','60']],['both',['-level:v','51','-r','60']]]){
        const logs=[],core=await createCore({wasmBinary:wasm});core.setLogger(({message})=>{if(logs.push(message)>12)logs.shift();});core.setProgress(()=>{});core.setTimeout(30000);
        core.FS.writeFile('input.mp4',input);
        core.exec('-i','input.mp4','-map','0:v:0','-c:v','copy',...args,'-an','-f','mp4','-avoid_negative_ts','disabled','-use_editlist','1','-movflags','+delay_moov+default_base_moof+frag_keyframe','-frag_duration','1000000','-flush_packets','1','output.mp4');
        assert.equal(core.ret,0,logs.join('\n'));const bytes=core.FS.readFile('output.mp4');assert.ok(bytes.length&&bytes.length<16*1024*1024);
        const file=path.join(output,name+'.mp4');await writeFile(file,bytes,{flag:'wx'});
        const videoPackets=await packets(bytes),decodedHash=decode(file);
        assert.deepEqual(videoPackets,referencePackets);assert.equal(decodedHash,referenceDecoded);
        const codec=(await config(bytes)).codec;assert.equal(Number(codec.split('.')[2]),args.includes('-level:v')?51:50);
        rows.push({name,args,codec,sha256:hash(bytes),bytes:bytes.length,videoPackets,decodedHash,logs});
        core.FS.unlink('input.mp4');core.FS.unlink('output.mp4');
    }
    const result={nativeCodec:native,source:dir,stageCodec:(await config(input)).codec,stageSha256:hash(input),actualProductCodec:data.containers.find(r=>r.name==='detail-product.mp4').codec,
        referencePackets,referenceDecoded,videoOnlyIdentity:true,coreSha256:hash(await readFile(corePath)),wasmSha256:hash(wasm),rows,scope:'Exact shipped5.1.10 WASM under Node,MEMFS bounded16MiB clip; same-packet intermediate reconstruction,not direct OPFS dump or browser timing.'};
    await writeFile(path.join(output,'level-probe.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,native,stage:result.stageCodec,actual:result.actualProductCodec,variants:rows.map(({name,codec})=>({name,codec}))}));
}

async function auditMp4Levels(baselineDirectory,fixedDirectory){
    const beforeDir=path.resolve(baselineDirectory??''),afterDir=path.resolve(fixedDirectory??'');assert.notEqual(beforeDir,afterDir);
    const read=async(dir,file)=>JSON.parse(await readFile(path.join(dir,file),'utf8'));
    const original=await read(beforeDir,'integrated-export.json'),fixed=await read(afterDir,'integrated-export.json');
    const beforeRows=original.rows.filter(r=>r.name),afterRows=fixed.rows.filter(r=>r.name);assert.equal(beforeRows.length,12);assert.equal(afterRows.length,12);
    const {Input,BlobSource,ALL_FORMATS,EncodedPacketSink}=await import('mediabunny');
    const {mp4Vp9LevelArgs,readVp9ExportLevel}=createLoader()('export/ExportPreparation.ts');
    const inspect=async(dir,spec)=>{
        assert.match(spec.name,/^export-\d{3}\.mp4$/);const bytes=await readFile(path.join(dir,spec.name));assert.ok(bytes.length<64*1024*1024);
        const input=new Input({source:new BlobSource(new Blob([bytes])),formats:ALL_FORMATS});
        try{
            const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();assert.ok(video&&audio);
            const packets=async track=>{const out=[];for await(const p of new EncodedPacketSink(track).packets())out.push({sha256:hash(p.data),bytes:p.data.byteLength,timestamp:p.timestamp,duration:p.duration,type:p.type});assert.ok(out.length<1000);return out;};
            return {fileSha256:hash(bytes),bytes:bytes.length,videoCodec:await video.getDecoderConfig(),audioCodec:await audio.getDecoderConfig(),video:await packets(video),audio:await packets(audio)};
        }finally{input.dispose();}
    };
    const output=path.join(root,'level-audit-'+randomUUID());await mkdir(output,{recursive:true});const rows=[];
    for(const spec of afterRows){
        const old=beforeRows.find(r=>r.name===spec.name);assert.ok(old);for(const k of ['width','height','fps','frames'])assert.equal(spec[k],old[k]);
        const before=await inspect(beforeDir,old),after=await inspect(afterDir,spec);assert.equal(after.video.length,spec.frames);
        assert.deepEqual(after.video,before.video,'Video packet bytes or timing changed');assert.deepEqual(after.audio,before.audio,'AAC packets or timing changed');assert.deepEqual(after.audioCodec,before.audioCodec);
        const preflight=spec.diagnostics.find(d=>d.stage==='encoder-query');assert.ok(preflight);
        const payload=after.video.reduce((n,p)=>n+p.bytes,0),burst=Math.max(...after.video.map((_,i)=>after.video.slice(i,i+4).reduce((n,p)=>n+p.bytes,0)));
        const floor=Number(mp4Vp9LevelArgs({width:spec.width,height:spec.height,fps:spec.fps,bitrate:Math.max(preflight.bitrate,Math.ceil(payload*8*spec.fps/spec.frames)),nativeLevel:readVp9ExportLevel(preflight.codec),maxFourBytes:burst})[1]);
        const actual=readVp9ExportLevel(after.videoCodec.codec);assert.ok(actual>=floor&&actual<=51,'Incorrect final MP4 level');
        const expectedCodec=before.videoCodec.codec.split('.');expectedCodec[2]=String(actual);assert.equal(after.videoCodec.codec,expectedCodec.join('.'),'Non-level VP9 configuration changed');
        const decode=file=>execFileSync('ffmpeg',['-v','error','-threads','2','-i',file,'-map','0:v:0','-an','-f','streamhash','-hash','sha256','-'],{windowsHide:true,timeout:120000,maxBuffer:1024*1024}).toString().trim();
        const a=decode(path.join(beforeDir,spec.name)),b=decode(path.join(afterDir,spec.name));assert.equal(a,b,'Decoded video changed');
        rows.push({name:spec.name,width:spec.width,height:spec.height,fps:spec.fps,frames:spec.frames,before,after,requiredLevel:floor,actualLevel:actual,videoAndAacPacketIdentity:true,decodedHash:a});
    }
    const result={pass:true,baseline:beforeDir,fixed:afterDir,rows,scope:'Actual12-file product MP4 metadata parity and independent encoded video/AAC/timing plus decoded-video identity; no hardware or speed claim.'};
    await writeFile(path.join(output,'level-audit.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,pass:true,files:rows.length,frames:rows.reduce((n,r)=>n+r.frames,0),levels:rows.map(r=>({name:r.name,old:r.before.videoCodec.codec,current:r.after.videoCodec.codec}))}));
}

async function compareWasmVp9Builds(directory) {
    const out = path.resolve(directory ?? path.join(root, 'wasm-pairs-' + randomUUID()));
    await mkdir(out, {recursive:true});
    const {encodeVp9Probe} = await import('./vp9-10bit-probe.worker.mjs');
    const codecDir = path.resolve('public/export/libvpx-1.17.0');
    const {default:createCore} = await import(pathToFileURL(path.join(codecDir, 'vp9-10bit-probe.mjs')).href);
    const rows = [];
    for (const variant of ['scalar', 'simd', 'simd', 'scalar', 'scalar', 'simd']) {
        const suffix = variant === 'simd' ? '-simd' : '';
        const binary = await readFile(path.join(codecDir, 'vp9-10bit-probe' + suffix + '.wasm'));
        const core = await createCore({wasmBinary:binary});
        const {buffer, stats} = await encodeVp9Probe(core);
        const name = variant + '-' + (rows.length + 1) + '.mp4';
        await writeFile(path.join(out, name), Buffer.from(buffer), {flag:'wx'});
        const row = {variant, name, wasmSha256:hash(binary), encodeMs:stats.encodeMs, totalMs:stats.totalMs,
            fileBytes:stats.fileBytes, wasmLinearMemoryBytes:stats.wasmLinearMemoryBytes};
        rows.push(row);
        console.log(JSON.stringify(row));
    }
    const median = variant => rows.filter(row => row.variant === variant).map(row => row.totalMs).sort((a, b) => a-b)[1];
    await writeFile(path.join(out, 'node-pairs.json'), JSON.stringify({scope:'Sequential desktop Node runs of the same 720p30 clip. Core loading excluded.',
        scalarMedianMs:median('scalar'), simdMedianMs:median('simd'), rows}, null, 2)+'\n', {flag:'wx'});
    console.log(JSON.stringify({output:out, scalarMedianMs:median('scalar'), simdMedianMs:median('simd')}));
}

async function verify(file) {
    const output = file ? path.dirname(path.resolve(file)) : (await readFile(path.join(root, 'active-run.txt'), 'utf8')).trim();
    const baseline = await readFile(file ?? path.join(output, 'baseline.json'));
    const report = verifyPack(JSON.parse(baseline));
    console.log(JSON.stringify({ ...report, baselineSha256: hash(baseline) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv[2] === 'capture') await capture();
    else if (process.argv[2] === 'audit-mp4-levels') await auditMp4Levels(process.argv[3],process.argv[4]);
    else if (process.argv[2] === 'level-probe') await probeLevel(process.argv[3]);
    else if (process.argv[2] === 'analyze-replay') await analyzeReplay(process.argv[3],process.argv[4]);
    else if (process.argv[2] === 'compare-source') await compareSources(process.argv[3],process.argv[4]);
    else if (process.argv[2] === 'compare-encoded') await compareEncoded(process.argv[3],process.argv[4]);
    else if (process.argv[2] === 'compare-wasm-vp9') await compareWasmVp9Builds(process.argv[3]);
    else if (process.argv[2] === 'verify') await verify(process.argv[3]);
    else throw Error('Use: node research/export/wormhole-baseline.mjs capture [--quantizer-source=PRIOR_SOURCE_RUN [--quality-refine | --short-gop]] [--exact-host] [--export-host [--profile-source | --profile-check]] [--native-packets | --predictive-detail | --quality-candidate=1|2|4|8] [--turbo-export-host] [--diagnostics-host] [--mobile-codec-host] [--wasm-codec-host | --wasm-simd-host] [--codec-host] [--detail-host [--level-boundary] [--detail-profile=reference|detail|text|variable]] [--remux-reference=ID_CLIP [--remux-cfr] [--remux-color709] [--inspect-remux]] [--isolate-host | --turbo-host [--stable-material | --paired-encoder] [--mp4-only]] [--public-release=ID] | audit-mp4-levels BASELINE_RUN FIXED_RUN | level-probe RUN | analyze-replay RUN ACCEPTED_SOURCE_COMPARISON | compare-source BASELINE_RUN CANDIDATE_RUN | compare-encoded BASELINE_RUN CANDIDATE_RUN | compare-wasm-vp9 [OUTPUT_DIRECTORY] | verify [baseline.json]');
}
