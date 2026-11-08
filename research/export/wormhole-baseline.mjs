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
if (process.argv.includes('--isolate-host') && ['--codec-host','--turbo-host','--stable-material','--paired-encoder','--mp4-only'].some(flag=>process.argv.includes(flag))) {
    throw Error('--isolate-host is an independent diagnostic, not a Turbo candidate comparison.');
}
if (process.argv.includes('--remux-cfr') && !process.argv.some(arg=>arg.startsWith('--remux-reference='))) {
    throw Error('--remux-cfr requires a bounded --remux-reference frame-ID clip.');
}
if (process.argv.includes('--stable-material') && process.argv.includes('--paired-encoder')) {
    throw Error('Measure stable material and paired codecs separately; combined results have no isolated control.');
}
if (['--stable-material','--paired-encoder','--mp4-only'].some(flag=>process.argv.includes(flag)) && !process.argv.includes('--turbo-host')) {
    throw Error('WH-07b experiment options require --turbo-host.');
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
        'public', 'tests/helpers', 'tests/browser/wormhole-host-backend-smoke.html', 'documents/governance', 'AGENTS.md').split(/\r?\n/).filter(Boolean);
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
            'tests/browser/wormhole-host-backend-smoke.html'] } } });
    if(process.argv.includes('--mp4-no-duration')||process.argv.includes('--mp4-all-intra')||process.argv.includes('--mp4-inter-frame'))assert.ok(durationProbeHits>0,'Probe must inspect the actual worker policy');
    const bundles = (Array.isArray(built) ? built : [built]).flatMap(result => result.output);
    const manifest = { version: 1, arguments: process.argv.slice(2), baseCommit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain'),
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
        const evaluate = async expression => {
            const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
            let report;try{report=await evaluate('window.runWh06Export('+JSON.stringify({turbo:process.argv.includes('--turbo-export-host')})+')');}catch(error){
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
                const ids=execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-vf','crop=192:32:0:0,scale=6:1:flags=neighbor','-pix_fmt','gray','-fps_mode','passthrough','-f','rawvideo','pipe:1'],{windowsHide:true,timeout:120_000,maxBuffer:1024*1024});
                assert.equal(ids.length,row.frames*6);
                const decoded=[];for(let i=0;i<row.frames;i++){
                    let id=0;for(let bit=0;bit<6;bit++)if(ids[i*6+bit]>128)id|=1<<bit;
                    assert.equal(id,i+1,'Independent FFmpeg decoded frame ID mismatch');decoded.push(id);
                }
                (row.performanceMode==='turbo'?turboArtifacts:artifacts).push({name:row.name,sha256:hash(bytes),bytes:bytes.length,video,audio,decodedIds:decoded});
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
                ...(process.argv.includes('--remux-cfr')?['-bsf:v',`setts=pts=N/(${fps}*TB):dts=N/(${fps}*TB):duration=1/(${fps}*TB)`,'-video_track_timescale','90000']:[]),'-c:a','aac','-b:a','192k',
                '-avoid_negative_ts','disabled','-use_editlist','1','-movflags','+delay_moov+default_base_moof+frag_keyframe','-frag_duration','1000000','-flush_packets','1',outputFile]);
            const after=probe(outputFile),video=after.streams.find(s=>s.codec_type==='video'),audio=after.streams.find(s=>s.codec_type==='audio');
            assert.equal(video.nb_read_frames,original.nb_read_frames);assert.equal(video.pix_fmt,original.pix_fmt);assert.equal(audio.codec_name,'aac');
            const packets=file=>JSON.parse(tool('ffprobe',['-v','error','-select_streams','v:0','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts_time,dts_time,flags,data_hash','-of','json',file])).packets;
            const a=packets(input),b=packets(outputFile);assert.deepEqual(b.map(x=>x.data_hash),a.map(x=>x.data_hash),'Encoded packet payload changed');
            const decoded=file=>tool('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-an','-f','streamhash','-']).trim();
            const beforeDecoded=decoded(input),afterDecoded=decoded(outputFile);assert.equal(afterDecoded,beforeDecoded,'Decoded pixels changed during remux');
            const bytes=await readFile(outputFile);let browser;
            try{browser=await evaluate('window.verifyWh07Remux('+JSON.stringify(bytes.toString('base64'))+','+Number(video.nb_read_frames)+')');}catch(error){browser={pass:false,message:String(error.message)};}
            const report={pass:browser.pass===true,cfr:process.argv.includes('--remux-cfr'),input,sourceSha256:hash(source),outputSha256:hash(bytes),before,after,sourcePackets:a,outputPackets:b,decoded:beforeDecoded,browser,
                scope:'Native FFmpeg reference only, not a browser/WASM exporter or a speed claim. Video packets and decoded pixels are identical to accepted WebM. Audio here is an Opus-to-AAC control; a product path must retain original PCM-to-AAC.'};
            await writeFile(path.join(output,'reference-remux.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
            assert.equal(browser.pass,true,JSON.stringify(browser));
            console.log(JSON.stringify({referenceRemux:true,frames:b.length,encodedPacketsIdentical:true,decodedPixelsIdentical:true,browserIds:browser.decodedIds}));
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
            const report=await evaluate('window.runWh07Benchmark('+JSON.stringify({stableMaterial:process.argv.includes('--stable-material'),pairedEncoder:process.argv.includes('--paired-encoder'),mp4Only:process.argv.includes('--mp4-only')})+')');
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
async function verify(file) {
    const output = file ? path.dirname(path.resolve(file)) : (await readFile(path.join(root, 'active-run.txt'), 'utf8')).trim();
    const baseline = await readFile(file ?? path.join(output, 'baseline.json'));
    const report = verifyPack(JSON.parse(baseline));
    console.log(JSON.stringify({ ...report, baselineSha256: hash(baseline) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv[2] === 'capture') await capture();
    else if (process.argv[2] === 'verify') await verify(process.argv[3]);
    else throw Error('Use: node research/export/wormhole-baseline.mjs capture [--exact-host] [--export-host] [--turbo-export-host] [--diagnostics-host] [--codec-host] [--remux-reference=ID_CLIP [--remux-cfr]] [--isolate-host | --turbo-host [--stable-material | --paired-encoder] [--mp4-only]] [--public-release=ID] | verify [baseline.json]');
}
