import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, posix } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

/** Replay the actual measured dependency tree, never substitute current source. */
export function loadRetainedTiming(reportPath) {
    const report = JSON.parse(readFileSync(reportPath)), cache = new Map();
    const load = name => {
        if (cache.has(name)) return cache.get(name).exports;
        const bytes = readFileSync(join(reportPath + '.sources', name + '.txt'));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sourceHashes[name], name);
        const module = { exports: {} }; cache.set(name, module);
        const code = ts.transpileModule(bytes.toString('utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText;
        vm.runInNewContext(code, { module, exports: module.exports, Float32Array, Float64Array,
            require: request => {
                assert.ok(request.startsWith('.'), 'retained analyzer dependencies remain local');
                const base = posix.normalize(posix.join(dirname(name).replaceAll('\\', '/'), request));
                return load([base + '.ts', base + '/index.ts'].find(p => existsSync(join(reportPath + '.sources', p + '.txt'))));
            }
        }, { filename: name });
        return module.exports;
    };
    return load('src/analyzer/AcceptedEventTiming.ts').refineAcceptedEventTiming;
}
