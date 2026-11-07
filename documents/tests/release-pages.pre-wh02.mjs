import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectBuildInputs, checkReleaseSource, buildReleaseInputs } from '../scripts/release-pages.mjs';

function fixture(t) {
    const parent = fs.realpathSync(os.tmpdir());
    const cwd = fs.mkdtempSync(path.join(parent, 'plexus-release-test-'));
    t.after(() => {
        const resolved = fs.realpathSync(cwd);
        assert.equal(path.dirname(resolved), parent);
        assert.ok(path.basename(resolved).startsWith('plexus-release-test-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const git = (...args) => execFileSync('git', args, { cwd, windowsHide: true }).toString().trim();
    const write = (name, text) => { fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true }); fs.writeFileSync(path.join(cwd, name), text); };
    git('init'); git('config', 'user.email', 'release-test@example.invalid'); git('config', 'user.name', 'Release test');
    write('.gitignore', 'dist/\n');
    write('package.json', JSON.stringify({ private: true, type: 'module', scripts: { build: 'node scripts/build.mjs' } }));
    write('src/input.txt', 'A');
    write('scripts/devPresetSavePlugin.mjs', 'export default 1;');
    write('scripts/build.mjs', "import fs from 'node:fs';fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/output.txt',fs.readFileSync('src/input.txt'));\n");
    const commit = () => { git('add', '.'); git('commit', '-m', 'fixture'); };
    const snapshot = () => ({ sourceCommit: git('rev-parse', 'HEAD'), inputs: collectBuildInputs(cwd) });
    commit(); return { cwd, git, write, commit, snapshot };
}

test('release builds the current committed source instead of relabelling an older dist', t => {
    const f = fixture(t);
    buildReleaseInputs(f.cwd);
    assert.equal(fs.readFileSync(path.join(f.cwd, 'dist/output.txt'), 'utf8'), 'A');
    f.write('src/input.txt', 'B'); f.commit();
    const source = buildReleaseInputs(f.cwd);
    assert.equal(fs.readFileSync(path.join(f.cwd, 'dist/output.txt'), 'utf8'), 'B');
    checkReleaseSource(source, f.cwd);
});

test('release identity detects new inputs, removals, imported build plugins and HEAD changes', t => {
    const f = fixture(t), original = f.snapshot();
    for (const name of ['public/new.json', 'src/new.ts', 'scripts/new.mjs']) {
        f.write(name, '{}'); assert.throws(() => checkReleaseSource(original, f.cwd), /inventory or content/);
        fs.unlinkSync(path.join(f.cwd, name));
    }
    f.write('scripts/devPresetSavePlugin.mjs', 'export default 2;');
    assert.throws(() => checkReleaseSource(original, f.cwd), /inventory or content/);
    f.write('scripts/devPresetSavePlugin.mjs', 'export default 1;');
    fs.unlinkSync(path.join(f.cwd, 'src/input.txt'));
    assert.throws(() => checkReleaseSource(original, f.cwd), /inventory or content/);
    f.write('src/input.txt', 'A');
    f.git('commit', '--allow-empty', '-m', 'new source identity');
    assert.throws(() => checkReleaseSource(original, f.cwd), /HEAD changed/);
});

test('source changes during the declared build reject preparation', t => {
    const f = fixture(t);
    f.write('scripts/build.mjs', "import fs from 'node:fs';fs.writeFileSync('src/input.txt','changed during build');\n");
    f.commit();
    assert.throws(() => buildReleaseInputs(f.cwd), /inventory or content/);
});


test('historical task publishers fail before any deployment or source snapshot creation', () => {
    const names = fs.readdirSync('scripts').filter(n => /^release-.+\.mjs$/.test(n) && n !== 'release-pages.mjs');
    assert.ok(names.length > 0);
    for (const name of names) {
        assert.throws(() => execFileSync(process.execPath, [path.join('scripts', name), 'prepare'], { windowsHide: true, stdio: 'pipe' }),
            error => error.status === 1 && error.stderr.toString().includes('Retired task publisher.'));
    }
});
