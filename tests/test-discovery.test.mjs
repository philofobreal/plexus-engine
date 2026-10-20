import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverTests } from '../scripts/run-tests.mjs';

test('default test discovery retains root tests and adds every nested active Node test', () => {
    const root = mkdtempSync(join(tmpdir(), 'plexus-discovery-'));
    try {
        mkdirSync(join(root, 'nested', 'new'), {recursive: true});
        for (const path of ['old.test.mjs', 'nested/another.test.mjs', 'nested/new/new.test.mjs', 'helper.mjs', 'fixture.json']) {
            writeFileSync(join(root, path), '');
        }
        const actual = discoverTests(root).map(p => p.slice(root.length + 1).replaceAll('\\', '/'));
        assert.deepEqual(actual, ['nested/another.test.mjs', 'nested/new/new.test.mjs', 'old.test.mjs']);
    } finally {
        const target = resolve(root);
        if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('plexus-discovery-')) {
            throw new Error('Refusing cleanup outside the created test directory');
        }
        rmSync(target, {recursive: true});
    }
});
