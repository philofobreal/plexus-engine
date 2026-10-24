// T09 immutable evidence reduction. node scripts/audit-movement.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { discoverTests } from './run-tests.mjs';
const dir='logs/t09', json=p=>JSON.parse(fs.readFileSync(p)), read=p=>fs.readFileSync(p,'utf8');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function metrics(tap) {
 return Object.fromEntries(['tests','pass','fail','skipped','cancelled','duration_ms'].map(k=>{
  const n=tap.match(new RegExp('^# '+k+' (.+)$','m'))?.[1]; if(n===undefined)throw Error('Incomplete '+k);return[k,Number(n)];
 }));
}
function failures(tap) {
 return [...tap.replaceAll('\r\n','\n').matchAll(/^not ok \d+ - (.+)\n([\s\S]*?)^  \.\.\./gm)].map(m=>{
  const lines=m[2].split('\n'),i=lines.findIndex(l=>l.startsWith('  error: '));if(i<0)throw Error('Missing assertion');
  let message=lines[i].slice(9);
  if(message==='|-'){const a=[];for(let j=i+1;j<lines.length&&(lines[j].startsWith('    ')||lines[j]==='');j++)a.push(lines[j].slice(4));message=a.join('\n').trimEnd();}
  else if(message.startsWith("'"))message=message.slice(1,-1).replaceAll("''","'");else if(message.startsWith('"'))message=JSON.parse(message);
  return{name:m[1],message};
 });
}
const prior=json('documents/audits/xr-musical-roles-validation-data.json'),retention=json('documents/tests/t09-retention.json');
const active=discoverTests().map(p=>p.replaceAll('\\','/'));
for(const t of retention.previousTests)if(!active.includes(t.path)||(hash(t.path)!==t.sha256&&(!t.reviewedReason||hash(t.path)!==t.replacementSha256||hash(t.archive)!==t.sha256)))throw Error('Retention '+t.path);
for(const s of retention.predecessorSources)if(hash(s.archive)!==s.sha256)throw Error('Archive '+s.archive);
if(retention.previousTests.length!==187||active.length!==188||retention.predecessorSources.length!==6
 ||hash('tests/helpers/xr-loader.mjs')!==retention.protectedLoaderSha256
 ||hash('research/analyzer-lab/fixtures/accepted-timing-integration-source-evolution-01.json')!==retention.protectedEvolutionManifestSha256)throw Error('Protected retention');
const full=metrics(read(dir+'/tests-final.tap')),targeted=metrics(read(dir+'/targeted-final.tap'));
const failed=failures(read(dir+'/tests-final.tap')).map(f=>({...f,matchesBaseline:prior.failures.some(p=>p.name===f.name&&p.message===f.message)}));
const allFailuresMatchBaseline=failed.length===9&&failed.every(f=>f.matchesBaseline),corpus=json(dir+'/corpus.json'),localUi=json(dir+'/local-ui.json');
if(full.tests!==1743||full.pass!==1734||full.fail!==9||full.skipped||full.cancelled||!allFailuresMatchBaseline
 ||targeted.tests!==177||targeted.fail||targeted.skipped||targeted.cancelled||!corpus.pass||corpus.cases!==480||corpus.totals.guardedIssues!==0
 ||!localUi.pass||localUi.consoleMessages.length)throw Error('T09 validation gate');
const evidence=['tests-final.tap','targeted-final.tap','build-final.log','diff-check.log','corpus.json','local-ui.json',
 'local-guarded.jpg','local-copy.jpg','local-reloaded.jpg','local-playing.jpg','local-paused.jpg','local-legacy-regenerated.jpg'];
const data={task:'T09',full,targeted,failures:failed,allFailuresMatchBaseline,browser:{pass:localUi.pass,scope:'Actual local app menu/play/pause/regeneration, unchanged renderer'},localUi,
 corpus:{pass:corpus.pass,cases:corpus.cases,totals:corpus.totals,retainedShare:corpus.retainedShare,minRetainedShare:corpus.minRetainedShare,elapsedMs:corpus.elapsedMs,scope:corpus.scope},
 retention:{previousFiles:187,activeFiles:188,sourceArchives:6,allPreviousFilesRetained:true,reviewedTestReplacements:1,protectedLoaderSha256:retention.protectedLoaderSha256,evolutionManifestUnchanged:true},
 activeTests:active.map(path=>({path,sha256:hash(path)})),
 commands:['npm run build','node --test --test-reporter=tap tests/rhythm-movement.test.mjs tests/xr-generation-settings.test.mjs tests/xr-choreography.test.mjs tests/xr-whole-track-variation.test.mjs tests/xr-play-profile.test.mjs tests/xr-play-space.test.mjs tests/xr-ultra.test.mjs tests/rhythm-chart.test.mjs tests/rhythm-judge.test.mjs tests/rhythm-session.test.mjs tests/rhythm-scoring.test.mjs tests/xr-controller-regeneration.test.mjs tests/xr-menu.test.mjs tests/xr-settings.test.mjs tests/xr-track-path.test.mjs tests/xr-note-gpu.test.mjs tests/gameplay-purity.test.mjs',
 'npm test -- --test-reporter=tap','node scripts/evaluate-movement.mjs','git diff --check','node scripts/audit-movement.mjs'],
 operationalFallbacks:['Node v25.2.1 / npm 11.6.2; cumulative suite uses known filesystem escalation for temp/Git fixture operations.',
 'Node gh-pages entrypoint replaces unavailable Bun-based deploy; no dependencies or package scripts changed.'],
 limits:['Conservative model, not physical reach/comfort/tracking/fatigue or Quest frame pacing evidence.',
 'Guarded can thin demanding profiles substantially (minimum retained share 28.11% in corpus); remains optional with Legacy default.',
 'Left/Right lead are score-equivalent reflections in Guarded. Different movement profiles have different charts/max scores.',
 'No new target curve, musical source analysis or runtime/frame allocation; Wall/T06f deferred.'],
 diffExport:'Scoped predecessor archives plus complete deployment input manifest; no broad diff_export.ps1 in cumulative worktree.',
 researchPrograms:['scripts/capture-movement-baseline.mjs','scripts/evaluate-movement.mjs','scripts/audit-movement.mjs'].map(path=>({path,sha256:hash(path)})),
 evidence:evidence.map(name=>({path:dir+'/'+name,sha256:hash(dir+'/'+name)}))};
fs.writeFileSync('documents/audits/xr-movement-validation-data.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({full,targeted,allFailuresMatchBaseline,retention:data.retention,corpus:data.corpus}));
