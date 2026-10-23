import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('export-source_updated.ps1');
const shells = ['pwsh', ...(process.platform === 'win32' ? ['powershell'] : [])]
    .filter(shell => spawnSync(shell, ['-NoProfile', '-Command', 'exit 0']).status === 0);

for (const shell of shells) {
    test(`${shell}: export profiles keep source, measurements and audio separate`, () => {
        const root = mkdtempSync(join(tmpdir(), 'plexus-export-'));
        const put = (name, data) => {
            const path = join(root, name);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, data);
        };
        const run = (mode, useGit = false, input) => {
            const result = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
                '-Root', root, '-Output', 'bundle [current].md', ...(mode ? ['-Mode', mode] : []),
                ...(useGit ? ['-UseGit'] : [])], { encoding: 'utf8', input, timeout: 30_000 });
            assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
            const output = readFileSync(join(root, 'bundle [current].md'), 'utf8');
            const paths = [...output.matchAll(/^## (.+)$/gm)].map(match => match[1].trim());
            return { output, paths };
        };
        const audio = Buffer.from(Array.from({ length: 30_007 }, (_, index) => index % 256));
        try {
            put('src/main.ts', 'export const main = true;');
            put('src/settings.json', '{"enabled":true}');
            put('tests/main.test.mjs', 'export const regression = true;');
            put('README.md', '# Project documentation');
            put('research/analyzer-lab/src/analyzer.py', 'def analyze(): pass');
            put('research/analyzer-lab/tests/test_analyzer.py', 'def test_analyze(): pass');
            put('research/analyzer-lab/fixtures/scores.json', '{"measurement":42}');
            put('research/analyzer-lab/fixtures/events.jsonl', '{"time":1}\n');
            put('tests/fixtures/golden/result.json', '{"baseline":true}');
            put('documents/tests/fixtures/golden/result.json', '{"historical":true}');
            put('tests/fixtures/generate.mjs', 'export const generator = true;');
            put('research/analyzer-lab/diagnostics/report.md', '# Generated report');
            put('research/analyzer-lab/diagnostics/probe.py', 'print("probe")');
            put('tests/audio/zene [01].mp3', audio);
            put('research/analyzer-lab/data/local/click.WAV', audio.subarray(0, 19));
            put('public/demo.mp3', audio.subarray(0, 7));
            put('graphify-out/graph.json', '{"graph":true}');
            put('node_modules/package/config.json', '{}');
            put('research/analyzer-lab/.venv/config.json', '{}');
            put('preview.local/report.json', '{}');
            put('plexus-source-export.md', '# Source Export\nprevious export');
            put('custom-old.md', '# Source Export\nprevious custom export');
            put('branch_pr_snapshot.md', '# PR snapshot');
            put('.gitignore', '*.mp3\n*.WAV\nbundle*.md\n');

            const git = (...args) => {
                const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
                assert.equal(result.status, 0, result.stderr);
            };
            git('init', '--quiet');
            git('add', '.');
            // One tracked and two ignored recordings exercise deduplication and local discovery.
            git('add', '--force', 'public/demo.mp3');

            for (const useGit of [false, true]) {
                for (const mode of ['developer', 'test', 'docs', 'all', 'data', 'full']) {
                    const { output, paths } = run(mode, useGit);
                    const has = path => paths.includes(path);
                    assert.equal(has('src/main.ts'), ['developer', 'all', 'data', 'full'].includes(mode), mode);
                    assert.equal(has('tests/main.test.mjs'), ['test', 'all', 'data', 'full'].includes(mode), mode);
                    assert.equal(has('README.md'), ['docs', 'all', 'data', 'full'].includes(mode), mode);
                    assert.equal(has('research/analyzer-lab/src/analyzer.py'), ['developer', 'all', 'data', 'full'].includes(mode), mode);
                    assert.equal(has('research/analyzer-lab/tests/test_analyzer.py'), ['test', 'all', 'data', 'full'].includes(mode), mode);
                    assert.equal(has('tests/fixtures/generate.mjs'), ['test', 'all', 'data', 'full'].includes(mode), mode);
                    for (const path of ['research/analyzer-lab/fixtures/scores.json',
                        'research/analyzer-lab/fixtures/events.jsonl', 'tests/fixtures/golden/result.json',
                        'documents/tests/fixtures/golden/result.json',
                        'research/analyzer-lab/diagnostics/report.md']) {
                        assert.equal(has(path), ['data', 'full'].includes(mode), `${mode}: ${path}`);
                    }
                    for (const path of ['tests/audio/zene [01].mp3', 'public/demo.mp3',
                        'research/analyzer-lab/data/local/click.WAV']) {
                        assert.equal(has(path), mode === 'full', `${mode}: ${path}`);
                        assert.equal(paths.filter(p => p === path).length, mode === 'full' ? 1 : 0);
                    }
                    assert.ok(!paths.some(path => /source-export|bundle|custom-old|branch_pr_snapshot|graphify-out|node_modules|\.venv|\.local/.test(path)));
                    if (mode === 'full') {
                        const section = output.split('## tests/audio/zene [01].mp3')[1];
                        const base64 = section.match(/```base64\r?\n([\s\S]*?)```/)[1];
                        assert.deepEqual(Buffer.from(base64, 'base64'), audio);
                        assert.match(section, /Sorok: 0/);
                    }
                }
            }
            // The interactive menu and repeated exports follow the same filters.
            assert.deepEqual(run(undefined, false, '4\n').paths, run('all').paths);
            assert.ok(run(undefined, false, '6\n').paths.includes('tests/audio/zene [01].mp3'));
            // A Git failure must not replace an existing export with a partial success header.
            rmSync(join(root, '.git'), { recursive: true, force: true });
            put('.git', 'gitdir: missing-git-directory\n');
            const before = readFileSync(join(root, 'bundle [current].md'));
            const failed = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
                '-Root', root, '-Output', 'bundle [current].md', '-Mode', 'all', '-UseGit'], { encoding: 'utf8' });
            assert.notEqual(failed.status, 0);
            assert.deepEqual(readFileSync(join(root, 'bundle [current].md')), before);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}

if (!shells.length) {
    test('PowerShell source export integration (requires pwsh or Windows PowerShell)', { skip: true }, () => {});
}
