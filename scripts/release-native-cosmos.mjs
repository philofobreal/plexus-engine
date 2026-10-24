// Historical publisher retired: retained below for audit, never publish or duplicate source trees.
throw new Error('Retired task publisher. Use node scripts/release-pages.mjs prepare TASK, then publish and verify.');
// Audited T06d Pages operations. No source branch push or force push.
// node scripts/release-native-cosmos.mjs prepare|publish|status|verify
import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const dir='logs/t06d/deploy',base='https://philofobreal.github.io/plexus-engine/',repo='repos/philofobreal/plexus-engine/';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p)),write=(name,value)=>fs.writeFileSync(dir+'/'+name,JSON.stringify(value,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{windowsHide:true}),api=p=>JSON.parse(execFileSync('gh',['api',repo+p],{windowsHide:true}));
const action=process.argv[2];fs.mkdirSync(dir,{recursive:true});
if(action==='prepare'){
 const inputs=[...new Set(git('ls-files','--cached','--others','--exclude-standard','--','src','public','index.html','mvp/index.html','xr/index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts').toString().trim().split(/\r?\n/))].sort().map(path=>({path,sha256:hash(fs.readFileSync(path))}));write('source-inputs.json',inputs);
 const patch=git('diff','--binary','HEAD');fs.writeFileSync(dir+'/source.patch',patch);
 const changed=[...new Set([...git('diff','--name-only','HEAD').toString().trim().split(/\r?\n/),...git('ls-files','--others','--exclude-standard').toString().trim().split(/\r?\n/)])].filter(p=>p&&fs.existsSync(p)&&fs.statSync(p).isFile());
 for(const p of changed){const target=path.join(dir,'source-files',p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(p,target);}
 const entries=['index.html','mvp/index.html','xr/index.html'].map(p=>{const bytes=fs.readFileSync('dist/'+p);return{path:p,sha256:hash(bytes),assets:[...bytes.toString().matchAll(/(?:src|href)="\/plexus-engine\/(assets\/[^"]+)"/g)].map(m=>m[1])};});
 const assets=fs.readdirSync('dist/assets').sort().map(name=>{const p='assets/'+name,bytes=fs.readFileSync('dist/'+p);return{path:p,sha256:hash(bytes),bytes:bytes.length};});
 for(const e of entries){if(!e.assets.length)throw Error('No assets '+e.path);for(const a of e.assets)if(!assets.some(f=>f.path===a))throw Error('Missing '+a);}
 const js=assets.filter(a=>a.path.endsWith('.js')).map(a=>fs.readFileSync('dist/'+a.path,'utf8')).join('\n');
 for(const marker of['wormhole-native-cosmos-v1','Cosmos','Stars','Galaxies','Sky','worker geometry; no background canvas'])if(!js.includes(marker))throw Error('Missing built feature '+marker);
 const builtAt=new Date().toISOString(),release={schemaVersion:1,task:'T06d',releaseId:'t06d-native-cosmos-'+builtAt.replaceAll(/[-:.]/g,''),builtAt,baseCommit:git('rev-parse','HEAD').toString().trim(),workingTreeChanges:true,deployedSourcePatchSha256:hash(patch),sourceInputsSha256:hash(fs.readFileSync(dir+'/source-inputs.json')),sourceInputCount:inputs.length,previousPagesCommit:'7c55d56dfbb96c21505e0c07ba96966bd43f2729',entries,assets};
 fs.writeFileSync('dist/.nojekyll','');fs.writeFileSync('dist/release.json',JSON.stringify(release,null,2)+'\n');write('release.json',release);console.log(JSON.stringify({release:release.releaseId,inputs:inputs.length,entries:entries.length,assets:assets.length,snapshotFiles:changed.length}));
}else if(action==='publish'){
 const release=json(dir+'/release.json'),validation=json('documents/audits/xr-native-cosmos-validation-data.json');
 if(!validation.allFailuresMatchBaseline||!validation.browser.pass||validation.targeted.fail)throw Error('Validation gate');
 const previous=api('git/ref/heads/gh-pages');if(previous.object.sha!==release.previousPagesCommit)throw Error('Pages changed; review before publishing');write('previous-ref.json',previous);
 for(const i of json(dir+'/source-inputs.json'))if(hash(fs.readFileSync(i.path))!==i.sha256)throw Error('Source input changed '+i.path);
 for(const a of[...release.entries,...release.assets])if(hash(fs.readFileSync('dist/'+a.path))!==a.sha256)throw Error('Build changed '+a.path);
 execFileSync(process.execPath,['node_modules/gh-pages/bin/gh-pages.js','-d','dist','--nojekyll','-m','T06d: native cosmic layers and persisted Cosmos controls'],{windowsHide:true,stdio:'inherit'});
 const next=api('git/ref/heads/gh-pages'),commit=api('git/commits/'+next.object.sha);write('published-ref.json',next);write('published-commit.json',commit);
 if(commit.parents[0]?.sha!==release.previousPagesCommit)throw Error('Unexpected publication parent');console.log(JSON.stringify({commit:commit.sha,parent:commit.parents[0].sha,release:release.releaseId}));
}else if(action==='status'){
 const build=api('pages/builds/latest');write('pages-build.json',build);console.log(JSON.stringify({status:build.status,commit:build.commit,updated:build.updated_at}));
}else if(action==='verify'){
 const release=json(dir+'/release.json'),q='?release='+release.releaseId;
 const markerResponse=await fetch(base+'release.json'+q,{cache:'no-store'}),marker=await markerResponse.json();if(markerResponse.status!==200||marker.releaseId!==release.releaseId)throw Error('Stale release '+marker.releaseId);
 const files=await Promise.all([...release.entries,...release.assets].map(async a=>{const r=await fetch(base+a.path+q,{cache:'no-store'}),sha256=hash(Buffer.from(await r.arrayBuffer()));if(r.status!==200||sha256!==a.sha256)throw Error('Asset mismatch '+a.path);return{path:a.path,status:r.status,sha256};}));
 const routes=[];for(const p of['','mvp/','xr/','xr/?xrBackgroundThread=main']){const r=await fetch(base+p+(p.includes('?')?'&':'?')+'release='+release.releaseId,{cache:'no-store'}),sha256=hash(Buffer.from(await r.arrayBuffer())),entry=release.entries.find(e=>e.path===(p.startsWith('mvp')?'mvp/index.html':p.startsWith('xr')?'xr/index.html':'index.html'));if(r.status!==200||sha256!==entry.sha256)throw Error('Route mismatch '+p);routes.push({path:p,status:r.status,sha256});}
 const sourceGraphUnchanged=json(dir+'/source-inputs.json').every(i=>hash(fs.readFileSync(i.path))===i.sha256);if(!sourceGraphUnchanged)throw Error('Source changed after build');
 write('public-verification.json',{checkedAt:new Date().toISOString(),releaseId:release.releaseId,markerStatus:200,files,routes,sourceGraphUnchanged});console.log(JSON.stringify({release:release.releaseId,files:files.length,routes:routes.length,sourceGraphUnchanged}));
}else throw Error('Use prepare|publish|status|verify');
