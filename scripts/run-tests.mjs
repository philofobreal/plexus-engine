import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Every active Node regression remains in the default suite, including future subfolders.
export function discoverTests(root = 'tests') {
    const paths = [];
    const walk = dir => {
        for (const item of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, item.name);
            if (item.isDirectory()) walk(path);
            else if (item.isFile() && /\.test\.mjs$/.test(item.name)) paths.push(path);
        }
    };
    walk(root);
    return paths.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.includes('--list')) {
        console.log(JSON.stringify(discoverTests(), null, 2));
    } else {
        const paths = discoverTests();
        if (!paths.length) throw new Error('No active Node tests found');
        const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...paths], { stdio: 'inherit', shell: false });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
    }
}
