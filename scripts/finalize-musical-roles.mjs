// T08 closeout. Requires exact public release bytes/build and recorded live UI evidence.
// node scripts/finalize-musical-roles.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'logs/t08/deploy', json = p => JSON.parse(fs.readFileSync(p));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const release = json(dir + '/release.json'), commit = json(dir + '/published-commit.json');
const verify = json(dir + '/public-verification.json'), build = json(dir + '/pages-build.json');
const smoke = json(dir + '/public-smoke.json'), validation = json('documents/audits/xr-musical-roles-validation-data.json');
if (build.status !== 'built' || build.commit !== commit.sha || verify.releaseId !== release.releaseId
    || !verify.sourceGraphUnchanged || !smoke.pass || smoke.consoleMessages.length
    || !validation.allFailuresMatchBaseline || validation.targeted.fail) throw Error('T08 public gate');
const url = 'https://philofobreal.github.io/plexus-engine/xr/?release=' + release.releaseId;
const evidence = ['release.json', 'published-commit.json', 'pages-build.json', 'source-inputs.json',
    'public-verification.json', 'public-smoke.json', 'public-music-settings.jpg', 'public-music-reloaded.jpg',
    'public-copy.jpg', 'public-playing.jpg', 'public-paused.jpg', 'public-off.jpg',
    'public-preference-restored.jpg', 'public-final.jpg'];
const deployment = { task: 'T08', releaseId: release.releaseId, commit: commit.sha, parent: commit.parents[0].sha, url,
    sourceBranchPushed: false, forcePushed: false, sourceInputCount: release.sourceInputCount,
    sourceInputsSha256: release.sourceInputsSha256, deployedSourcePatchSha256: release.deployedSourcePatchSha256,
    verification: verify, pagesBuild: build, publicBrowserSmoke: smoke,
    publisher: 'node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m "T08: musical target roles and bounded halo cues"',
    rollback: 'Note halos Off removes role presentation; previous T07c release tree can be republished in a new Pages commit.',
    evidence: evidence.map(name => ({ path: dir + '/' + name, sha256: hash(dir + '/' + name) })) };
fs.writeFileSync('documents/audits/xr-musical-roles-deployment-data.json', JSON.stringify(deployment, null, 2) + '\n');
const auditPath = 'documents/audits/xr-musical-roles-validation.md';
let audit = fs.readFileSync(auditPath, 'utf8');
if (!audit.includes('DEPLOYMENT_PENDING')) throw Error('Already finalized');
audit = audit.replace('FULL_PENDING', `**${validation.full.tests} tests / ${validation.full.pass} pass / nine exact T07c baseline failures**, zero skips/cancellations`)
    .replace('DEPLOYMENT_PENDING', `Pages **${commit.sha}**, parent **${commit.parents[0].sha}**, release **${release.releaseId}**. [Live XR](${url}). Exact public Pages build, ${verify.files.length} HTML/assets, ${verify.routes.length} routes and ${release.sourceInputCount} unchanged source inputs verified. Public Music selection/Copy/reload/play/pause/Off checked; console warnings/errors absent. The previous Phrase preference is restored after verification. [Deployment evidence](xr-musical-roles-deployment-data.json).`);
fs.writeFileSync(auditPath, audit);
const trackerPath = 'documents/audits/xr-development-tracker.md';
let tracker = fs.readFileSync(trackerPath, 'utf8');
tracker = tracker.replace(/^\| T08 \|.*$/m, `| T08 | Gameplay + XR: note meanings and bounded halos | T02, T07 fit | Deployed ${commit.sha.slice(0, 7)}, waiting for manual test. Three optional musical roles, unchanged judge/score. [Evidence](xr-musical-roles-validation.md) |`);
tracker += `\n## T08 musical target cues delivery (2026-10-24)\n\nT07c accepted. Accent/phrase/section sidecar, pure deterministic policy from accepted intensity/phrase/section data. Explicit skin/gesture/source/role and target table; no new judge, timing, score/combo/accuracy or section bonus rule. Off/Phrase/Music in Visuals menu/localStorage/Copy, default Off, viewer preference. One extra draw, 16 instances, 88 triangles each, no texture; section > phrase > accent and 1.5-second cue gap, 1024 offline cap. Accepted-resolution lifecycle and fail-open behavior retained.\n\nBuild/diff pass; targeted ${validation.targeted.pass}/${validation.targeted.tests}; full ${validation.full.tests}/${validation.full.pass} pass / nine exact retained failures, zero skips/cancellations. All 186 prior files unchanged, 187 active; 36 GPU combinations preserve centre pixels, real local/public menu/reload/Copy/play/pause. Physical Quest readability and pacing unmeasured. Pages ${commit.sha}, release ${release.releaseId}; ${verify.files.length} files/${verify.routes.length} routes/${release.sourceInputCount} inputs verified. No source/force push. **Stop before T09 for manual feedback.** Wall/T06f deferred.\n`;
fs.writeFileSync(trackerPath, tracker);
const statusPath = '../XR-FEJLESZTESI-STATUSZ.md';
let status = fs.readFileSync(statusPath, 'utf8');
const old = '## Aktuális átadás – T07c, 2026-10-24';
if (!status.includes(old)) throw Error('Unexpected status');
status = status.replace(old, `## Aktuális átadás – T08, 2026-10-24\n\nA T07c-t a felhasználó elfogadta. Elkészült a célpontok jelentéstáblája és a zenei kiemelés: arany ív = helyi accent, fehér sarokív = fráziskezdet, halványlila gyűrű = szakaszkezdet. Settings → Visuals → Note halos → Music; mentődik és másolható, alap Off. A kézszínek, vágásirányok és pontozás megmaradnak. Nincs új hitbox vagy véletlen bónusz.\n\n${validation.targeted.pass}/${validation.targeted.tests} célzott sikeres; teljes ${validation.full.tests}/${validation.full.pass} sikeres, kilenc pontosan egyező korábbi hiba. 36 valódi GPU-kombinációban olvasható középső célpontjel, egyetlen extra instanced draw/16 jel, nincs új textúra. Fizikai Quest olvashatóság és frame pacing manuális.\n\nDeploy: ${commit.sha}, release ${release.releaseId}. [Élő teszt](${url}). **Megállunk a manuális tesztre, T09 még nem indult el.** Próbáld a Music/Off kapcsolót, a három jel jelentését, Classic/Shard irány- és kézolvashatóságát, mentést/Copyt, találat/miss visszajelzést és Quest frame pacinget. Wall Off/Galaxies 0 marad.\n[Részletes átadás](plexus-engine/documents/audits/xr-musical-roles-validation.md).\n\n## Korábbi átadás – T07c, 2026-10-24`);
fs.writeFileSync(statusPath, status);
console.log(JSON.stringify({ commit: commit.sha, release: release.releaseId, manualGate: 'Stop before T09' }));
