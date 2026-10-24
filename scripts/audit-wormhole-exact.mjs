// T05c evidence reducer. Input: full/targeted TAP + browser smoke JSON + retained T05b inventory.
// Does not run tests or regenerate any protected baseline. Run after the commands in the audit.
// node scripts/audit-wormhole-exact.mjs [logs/t05c]
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { discoverTests } from './run-tests.mjs';
const dir = process.argv[2] ?? 'logs/t05c';
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(p, 'utf8');
function failures(tap) {
    return [...tap.replaceAll('\r\n', '\n').matchAll(/^not ok \d+ - (.+)\n([\s\S]*?)^  \.\.\./gm)].map(m => {
        const lines = m[2].split('\n'), i = lines.findIndex(l => l.startsWith('  error: '));
        if (i < 0) throw Error('Missing assertion evidence: ' + m[1]);
        let message = lines[i].slice(9);
        if (message === '|-') {
            const parts = [];
            for (let j = i + 1; j < lines.length && (lines[j].startsWith('    ') || lines[j] === ''); j++) parts.push(lines[j].slice(4));
            message = parts.join('\n').trimEnd();
        } else if (message.startsWith("'")) message = message.slice(1, -1).replaceAll("''", "'");
        else if (message.startsWith('"')) message = JSON.parse(message);
        return { name: m[1], message };
    });
}
function metrics(tap) {
    return Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'duration_ms'].map(name => {
        const value = tap.match(new RegExp('^# ' + name + ' (.+)$', 'm'))?.[1];
        if (value === undefined) throw Error('Incomplete TAP: ' + name);
        return [name, Number(value)];
    }));
}
const previous = JSON.parse(read('documents/audits/xr-shared-backend-validation-data.json'));
const retention = JSON.parse(read('documents/tests/t05c-retention.json'));
const full = read(dir + '/tests-final.tap'), targeted = read(dir + '/targeted-final.tap');
const failed = failures(full).map(f => ({ ...f, matchesBaseline: previous.failures.some(b => b.name === f.name && b.message === f.message) }));
const active = discoverTests().map(p => p.replaceAll('\\', '/'));
const retained = retention.previousTests.map(t => ({ ...t, present: active.includes(t.path), unchanged: hash(fs.readFileSync(t.path)) === t.sha256 }));
for (const source of retention.predecessorSources) if (hash(fs.readFileSync(source.archive)) !== source.sha256) throw Error('Changed predecessor: ' + source.archive);
if (hash(fs.readFileSync(retention.evolutionManifestPredecessor.archive)) !== retention.evolutionManifestPredecessor.sha256) throw Error('Changed predecessor evolution manifest');
const browser = JSON.parse(read(dir + '/browser-final.json'));
const data = { task: 'T05c', runtime: process.version, full: metrics(full), targeted: metrics(targeted), failures: failed,
    allFailuresMatchBaseline: failed.length === previous.failures.length && failed.every(f => f.matchesBaseline),
    retention: { activeFiles: active.length, previousFiles: retained.length, missing: retained.filter(t => !t.present),
        modifiedPreviousTests: retained.filter(t => !t.unchanged), protectedLoaderSha256: hash(fs.readFileSync('tests/helpers/xr-loader.mjs')) },
    activeTests: active.map(path => ({ path, sha256: hash(fs.readFileSync(path)) })), browser,
    commands: [ 'npm run build',
        'node --test --test-reporter=tap tests/wormhole-exact-frame.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-wormhole-worker.test.mjs tests/xr-webgl-backend.test.mjs tests/wormhole-spiral-history.test.mjs tests/export-deterministic.test.mjs tests/gameplay-purity.test.mjs tests/visual-mode-transition.test.mjs tests/styles-deterministic.test.mjs tests/contracts.test.mjs tests/postfx-fragmentation.test.mjs',
        'npm test -- --test-reporter=tap', 'git diff --check' ],
    sampler: { version: 'fixed-song-60-v1', stepSeconds: 1 / 60, replay: 'Song zero through fixed ticks, then exact fractional endpoint; fresh private identity per request.',
        cost: 'Linear in requested song time per frame; bounded retained memory. Offline correctness implementation, not a fast long-track video exporter. Worker deadline 120 seconds; local replay is synchronous. Checkpoint acceleration and exporter integration are T19 acceptance work.' },
    notClaimed: [ 'Existing live preview is now history-independent', 'Cross-backend Canvas2D vs WebGL pixel identity', 'Encoded video parity', 'Physical Quest performance or stereo', 'Native 3D / canvas removal (T06)' ],
    fallback: 'Separate explicit local exact adapter. V1 preview is never silently accepted as an exact source. Node gh-pages entrypoint replaces the Bun-dependent deploy script; no dependencies changed.',
    diffExport: 'Skipped; scoped diff, source-input hash manifest and cumulative test inventory used.' };
data.provenanceGate = { command: 'node --test --test-reporter=tap tests/accepted-timing-measurement.test.mjs', ...metrics(read(dir + '/contract-evolution.tap')) };
data.earlierFullRuns = ['tests.tap', 'tests-pre-manifest.tap'].map(name => ({ path: dir + '/' + name, ...metrics(read(dir + '/' + name)),
    extraFailure: 'Current source-hash migration entry for the new render worker protocol was absent; old manifest retained and reviewed render-only migration added. No historical numerical measurement changed.' }));
data.manualBrowserSmoke = { host: 'local XR', fixture: 'logs/t02b/halo-smoke.wav', bpm: 128, duration: 7, notes: 9,
    outcome: 'Analysis, PLAY and natural end reached Results; 0 hits / 9 misses expected because no input was simulated. Nonblank background, no console errors. Desktop only.' };
data.evidence = ['build-final.log', 'targeted-final.tap', 'tests-final.tap', 'contract-evolution.tap', 'browser-final.json', 'browser-final.jpg', 'browser-console.json', 'local.png', 'worker.png', 'xr-v1-results.jpg', 'browser-initial.json', 'tests.tap', 'tests-pre-manifest.tap'].map(name => ({ path: dir + '/' + name, sha256: hash(fs.readFileSync(dir + '/' + name)) }));
if (!data.allFailuresMatchBaseline || data.full.cancelled || data.full.skipped || data.targeted.fail || !browser.pass
    || data.retention.missing.length || data.retention.modifiedPreviousTests.length
    || data.retention.protectedLoaderSha256 !== retention.protectedLoaderSha256) throw Error('T05c validation gate failed: ' + JSON.stringify(data));
fs.writeFileSync('documents/audits/xr-exact-frame-validation-data.json', JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ full: data.full, targeted: data.targeted, allFailuresMatchBaseline: data.allFailuresMatchBaseline,
    retention: data.retention, browserPass: browser.pass }));
