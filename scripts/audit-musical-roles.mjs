// T08 evidence reducer. Read-only measurements and immutable T07c failure comparison.
// node scripts/audit-musical-roles.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { discoverTests } from './run-tests.mjs';
const dir = 'logs/t08', json = p => JSON.parse(fs.readFileSync(p)), read = p => fs.readFileSync(p, 'utf8');
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function metrics(tap) {
    return Object.fromEntries(['tests', 'pass', 'fail', 'skipped', 'cancelled', 'duration_ms'].map(k => {
        const n = tap.match(new RegExp('^# ' + k + ' (.+)$', 'm'))?.[1];
        if (n === undefined) throw Error('Incomplete TAP ' + k);
        return [k, Number(n)];
    }));
}
function failures(tap) {
    return [...tap.replaceAll('\r\n', '\n').matchAll(/^not ok \d+ - (.+)\n([\s\S]*?)^  \.\.\./gm)].map(m => {
        const lines = m[2].split('\n'), i = lines.findIndex(l => l.startsWith('  error: '));
        if (i < 0) throw Error('Missing assertion ' + m[1]);
        let message = lines[i].slice(9);
        if (message === '|-') {
            const a = [];
            for (let j = i + 1; j < lines.length && (lines[j].startsWith('    ') || lines[j] === ''); j++) a.push(lines[j].slice(4));
            message = a.join('\n').trimEnd();
        } else if (message.startsWith("'")) message = message.slice(1, -1).replaceAll("''", "'");
        else if (message.startsWith('"')) message = JSON.parse(message);
        return { name: m[1], message };
    });
}
const prior = json('documents/audits/xr-cockpit-shell-validation-data.json');
const retention = json('documents/tests/t08-retention.json'), active = discoverTests().map(p => p.replaceAll('\\', '/'));
for (const t of retention.previousTests) if (!active.includes(t.path) || hash(t.path) !== t.sha256) throw Error('Changed predecessor ' + t.path);
for (const s of retention.predecessorSources) if (hash(s.archive) !== s.sha256) throw Error('Changed archive ' + s.archive);
if (retention.previousTests.length !== 186 || active.length !== 187 || retention.predecessorSources.length !== 5
    || hash('tests/helpers/xr-loader.mjs') !== retention.protectedLoaderSha256
    || hash('research/analyzer-lab/fixtures/accepted-timing-integration-source-evolution-01.json') !== retention.protectedEvolutionManifestSha256) throw Error('Retention gate');
const full = metrics(read(dir + '/tests-final.tap')), targeted = metrics(read(dir + '/targeted-final.tap'));
const failed = failures(read(dir + '/tests-final.tap')).map(f => ({ ...f, matchesBaseline: prior.failures.some(p => p.name === f.name && p.message === f.message) }));
const allFailuresMatchBaseline = failed.length === 9 && failed.every(f => f.matchesBaseline);
const browser = json(dir + '/browser.json'), consoleMessages = json(dir + '/browser-console.json'), localUi = json(dir + '/local-ui.json');
if (full.tests !== 1733 || full.pass !== 1724 || full.fail !== 9 || full.skipped || full.cancelled
    || targeted.tests !== 139 || targeted.fail || targeted.skipped || targeted.cancelled || !allFailuresMatchBaseline
    || !browser.pass || browser.cases.length !== 36 || !browser.cases.every(c => c.changed > 50 && c.centralChanged === 0)
    || browser.capacity !== 16 || browser.extraDraws !== 1 || browser.haloTrianglesPerInstance !== 88
    || consoleMessages.length || !localUi.pass || localUi.consoleMessages.length) throw Error('T08 acceptance gate');
const evidence = ['tests-final.tap', 'targeted-final.tap', 'build-final.log', 'diff-check.log', 'browser.json',
    'browser-console.json', 'browser.jpg', 'local-ui.json', 'local-music-settings.jpg', 'local-music-reloaded.jpg',
    'local-playing.jpg', 'local-paused.jpg', 'local-restarted.jpg'];
const data = { task: 'T08', full, targeted, failures: failed, allFailuresMatchBaseline, browser, consoleMessages, localUi,
    retention: { previousFiles: 186, activeFiles: 187, sourceArchives: 5, allPreviousFilesUnchanged: true, reviewedTestReplacements: 0,
        protectedLoaderSha256: retention.protectedLoaderSha256, evolutionManifestUnchanged: true },
    activeTests: active.map(path => ({ path, sha256: hash(path) })),
    commands: ['npm run build', 'node --test --test-reporter=tap tests/rhythm-musical-roles.test.mjs tests/xr-note-halos.test.mjs tests/rhythm-resolution.test.mjs tests/rhythm-judge.test.mjs tests/rhythm-scoring.test.mjs tests/rhythm-session.test.mjs tests/xr-note-design.test.mjs tests/xr-note-gpu.test.mjs tests/xr-controller-regeneration.test.mjs tests/xr-settings.test.mjs tests/xr-menu.test.mjs tests/gameplay-purity.test.mjs',
        'npm test -- --test-reporter=tap', 'git diff --check', 'node scripts/audit-musical-roles.mjs'],
    operationalFallbacks: ['Node v25.2.1 / npm 11.6.2; full suite filesystem escalation for retained temp/Git fixture operations.',
        'Unavailable Bun-based deploy replaced by guarded Node gh-pages entrypoint; package scripts/dependencies unchanged.'],
    limits: ['Physical Quest readability, comfort and frame pacing unmeasured; desktop GPU correctness is not headset acceptance.',
        'Accent uses accepted onset intensity and existing phrase metadata; no independent musical-truth or source-dominance claim.',
        'Role setting is optional viewer presentation (default Off), not an artist preset parameter.',
        'Wall Off / Galaxies 0 unchanged; further Wall/T06f deferred.'],
    diffExport: 'Scoped immutable predecessor archives plus complete deployment input manifest; no broad diff_export.ps1 in cumulative worktree.',
    researchPrograms: ['tests/browser/musical-role-smoke.html', 'scripts/capture-note-role-baseline.mjs', 'scripts/audit-musical-roles.mjs'].map(path => ({ path, sha256: hash(path) })),
    evidence: evidence.map(name => ({ path: dir + '/' + name, sha256: hash(dir + '/' + name) })) };
fs.writeFileSync('documents/audits/xr-musical-roles-validation-data.json', JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ full, targeted, allFailuresMatchBaseline, retention: data.retention, browser: browser.pass }));
