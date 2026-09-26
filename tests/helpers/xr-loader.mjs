import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

export function createLoader(stubs = {}, globals = {}) {
    const cache = new Map();
    function load(path) {
        if (cache.has(path)) return cache.get(path).exports;
        const module = { exports: {} }; cache.set(path, module);
        const code = ts.transpileModule(readFileSync(path, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText.replaceAll('import.meta.env.BASE_URL', "'/plexus-engine/'")
            .replaceAll('import.meta.env?.BASE_URL', "'/plexus-engine/'");
        vm.runInNewContext(code, { console, ...globals, module, exports: module.exports,
            require: request => {
                if (Object.hasOwn(stubs, request)) return stubs[request];
                if (!request.startsWith('.')) throw new Error(`Unexpected import ${request}`);
                const base = resolve(dirname(path), request);
                return load(base.endsWith('.ts') && existsSync(base) ? base : existsSync(base + '.ts') ? base + '.ts' : join(base, 'index.ts'));
            }
        }, { filename: path });
        return module.exports;
    }
    return entry => load(resolve('src', entry));
}
