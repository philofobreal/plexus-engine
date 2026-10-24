// Guarded Pages publisher: build the committed inputs, then publish that exact artifact.
// node scripts/release-pages.mjs prepare TASK | publish | verify
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const output='logs/pages-release',repo='repos/philofobreal/plexus-engine/',base='https://philofobreal.github.io/plexus-engine/';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,windowsHide:true}).toString().trim();
const api=p=>JSON.parse(execFileSync('gh',['api',repo+p],{windowsHide:true}));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
function files(root,prefix=''){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name),prefix+e.name+'/'):[prefix+e.name]);}
export function collectBuildInputs(cwd=process.cwd()){
 const paths=git(cwd,'ls-files','--cached','--others','--exclude-standard','--','src','public','scripts','index.html','mvp/index.html','xr/index.html','package.json','package-lock.json','bun.lock','tsconfig*.json','vite.config.*').split(/\r?\n/).filter(Boolean);
 return [...new Set(paths)].filter(p=>fs.existsSync(path.join(cwd,p))&&fs.statSync(path.join(cwd,p)).isFile()).sort().map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(cwd,p)))}));
}
export function checkReleaseSource(release,cwd=process.cwd()){
 if(git(cwd,'rev-parse','HEAD')!==release.sourceCommit)throw Error('Source HEAD changed since preparation');
 if(JSON.stringify(collectBuildInputs(cwd))!==JSON.stringify(release.inputs))throw Error('Source input inventory or content changed since preparation');
}
function runProjectBuild(cwd){
 const npmCli=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')].find(p=>p&&fs.existsSync(p));
 if(npmCli)execFileSync(process.execPath,[npmCli,'run','build'],{cwd,windowsHide:true,stdio:'inherit'});
 else if(process.platform!=='win32')execFileSync('npm',['run','build'],{cwd,stdio:'inherit'});
 else throw Error('npm CLI unavailable beside Node; run this publisher through npm exec');
}
export function buildReleaseInputs(cwd=process.cwd()){
 const source={sourceCommit:git(cwd,'rev-parse','HEAD'),inputs:collectBuildInputs(cwd)};
 runProjectBuild(cwd);checkReleaseSource(source,cwd);return source;
}
async function readPublic(url){
 for(let attempt=0;attempt<3;attempt++)try{const response=await fetch(url);return{status:response.status,bytes:Buffer.from(await response.arrayBuffer())};}
 catch(error){if(attempt===2)throw error;}
 throw Error('Unreachable network read');
}
async function main(){
 const cwd=process.cwd(),action=process.argv[2];fs.mkdirSync(output,{recursive:true});
 if(action==='prepare'){
  const task=process.argv[3];if(!task||!/^[a-z0-9-]+$/.test(task))throw Error('Supply a short task identifier');
  if(git(cwd,'status','--porcelain','--untracked-files=all'))throw Error('Commit the reviewed work before preparing a release');
  const previousCommit=api('git/ref/heads/gh-pages').object.sha,source=buildReleaseInputs(cwd);
  for(const entry of ['index.html','mvp/index.html','xr/index.html'])if(!fs.existsSync('dist/'+entry))throw Error('Build entry missing: '+entry);
  fs.writeFileSync('dist/.nojekyll','');
  const release={id:task+'-'+new Date().toISOString().replaceAll(/[-:.]/g,''),previousCommit,...source,
   files:files('dist').filter(p=>p!=='release.json').map(p=>({path:p,sha256:hash(fs.readFileSync('dist/'+p))}))};
  write('dist/release.json',release);write(output+'/release.json',release);console.log(JSON.stringify({id:release.id,inputs:release.inputs.length,files:release.files.length}));
 }else if(action==='publish'){
  const r=json(output+'/release.json');checkReleaseSource(r,cwd);
  if(git(cwd,'status','--porcelain','--untracked-files=all'))throw Error('Working tree changed since preparation');
  if(api('git/ref/heads/gh-pages').object.sha!==r.previousCommit)throw Error('Pages changed since prepare');
  if(hash(fs.readFileSync('dist/release.json'))!==hash(fs.readFileSync(output+'/release.json')))throw Error('Release marker changed');
  for(const f of r.files)if(hash(fs.readFileSync('dist/'+f.path))!==f.sha256)throw Error('Build changed: '+f.path);
  execFileSync(process.execPath,['node_modules/gh-pages/bin/gh-pages.js','-d','dist','--nojekyll','-m',r.id],{windowsHide:true,stdio:'inherit'});
  const commit=api('git/commits/'+api('git/ref/heads/gh-pages').object.sha);if(commit.parents[0]?.sha!==r.previousCommit)throw Error('Unexpected Pages parent');
  write(output+'/commit.json',{sha:commit.sha,parent:r.previousCommit,id:r.id});console.log(commit.sha);
 }else if(action==='verify'){
  const r=json(output+'/release.json'),commit=json(output+'/commit.json'),build=api('pages/builds/latest');
  if(build.status!=='built'||build.commit!==commit.sha)throw Error('Pages not built yet');checkReleaseSource(r,cwd);
  const q='?release='+r.id,marker=await readPublic(base+'release.json'+q);
  if(marker.status!==200||hash(marker.bytes)!==hash(fs.readFileSync(output+'/release.json')))throw Error('Stale release');
  const normalizedLineEndings=[];
  for(let offset=0;offset<r.files.length;offset+=6)await Promise.all(r.files.slice(offset,offset+6).map(async f=>{
   const response=await readPublic(base+f.path+q),bytes=response.bytes;if(response.status!==200)throw Error('Public status: '+f.path);
   if(hash(bytes)!==f.sha256){
    const built=fs.readFileSync('dist/'+f.path),canonical=b=>b.toString('utf8').replaceAll('\r\n','\n');
    if(!/\.(json|md|svg|html|css|js)$/.test(f.path)||hash(built)!==f.sha256||hash(canonical(bytes))!==hash(canonical(built)))throw Error('Public mismatch: '+f.path);
    normalizedLineEndings.push(f.path);
   }
  }));
  for(const [route,entry]of [['','index.html'],['mvp/','mvp/index.html'],['xr/','xr/index.html']]){
   const response=await readPublic(base+route+q);if(response.status!==200||hash(response.bytes)!==r.files.find(f=>f.path===entry).sha256)throw Error('Route mismatch: '+route);
  }
  write(output+'/verification.json',{id:r.id,commit:commit.sha,sourceCommit:r.sourceCommit,files:r.files.length,inputs:r.inputs.length,normalizedLineEndings,pass:true});
  console.log(JSON.stringify({id:r.id,commit:commit.sha,normalizedLineEndings:normalizedLineEndings.length,pass:true}));
 }else throw Error('Use prepare TASK | publish | verify');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
