// Verify final source against the retained v2 measurement and recover newline-only manifest bytes.
// No numerical result or archived source is replaced. Exclusive new import evidence.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = bytes => bytes.toString('utf8').replaceAll('\r\n', '\n');
const reportPath = 'research/analyzer-lab/fixtures/accepted-timing-v2-development-01.json';
const output = 'research/analyzer-lab/fixtures/import-timing-source-equivalence-01.json';
const reportBytes = readFileSync(reportPath), report = JSON.parse(reportBytes);
const sources = Object.entries(report.sourceHashes).map(([path, expected]) => {
    const old = readFileSync(reportPath + '.sources/' + path + '.txt'), current = readFileSync(path);
    assert.equal(hash(old), expected, `Retained measurement source mismatch: ${path}`);
    assert.equal(canonical(old), canonical(current), `Meaningful post-measurement source change: ${path}`);
    return { path, measuredSha256: expected, finalSha256: hash(current),
        equality: old.equals(current) ? 'exact' : 'CRLF-LF-only' };
});
const store = 'research/analyzer-lab/tools/harness/inventories/';
const manifests = readdirSync(store).filter(p => /^v\d{4}\.json$/.test(p)).sort();
const repairs = [];
for (let i = 0; i < manifests.length - 1; i++) {
    const path = store + manifests[i], current = readFileSync(path);
    const expected = JSON.parse(readFileSync(store + manifests[i + 1])).previousManifestHash;
    if (hash(current) === expected) continue;
    const lf = Buffer.from(canonical(current)), crlf = Buffer.from(canonical(current).replaceAll('\n', '\r\n'));
    const exact = [lf, crlf].find(bytes => hash(bytes) === expected);
    assert.ok(exact, `Manifest cannot be repaired solely by line endings: ${path}`);
    repairs.push({ path, bytes: exact, beforeSha256: hash(current), afterSha256: expected });
}
// Validate every source and chain repair before any mutation; no archive or existing report writes.
for (const repair of repairs) writeFileSync(repair.path, repair.bytes);
writeFileSync(output, JSON.stringify({ status: 'verified-newline-only-final-source',
    measuredReportSha256: hash(reportBytes), sources,
    manifestRepairs: repairs.map(({ bytes, ...rest }) => rest),
    limits: 'Numerical observations came from retained measured bytes; final bytes differ only in newline encoding, not code.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sources: sources.length, newlineOnlySources: sources.filter(s => s.equality !== 'exact').length,
    chainManifestsRecovered: repairs.length }));
