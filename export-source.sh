#!/usr/bin/env bash
# UTF-8, LF. Bash + Python 3.8+; Git is required for Git export modes.
# Menus: bash export-source.sh
# Automation: bash export-source.sh --root . --mode combined --files all
# Modes: working = current source; combined = current source + diff;
# changes = staged/unstaged diff + untracked files; clean = committed HEAD;
# split = <output>.clean.md (HEAD) + <output>.changes.md (local changes).
# "Full source" retains the original extension/directory filters, not every file.
# Default: use Git when available; --filesystem scans disk (working mode only).
# Git state is read only. Avoid editing the project while the export runs.
# Existing non-export files and tracked output paths are never overwritten.
set -euo pipefail
command -v python3 >/dev/null 2>&1 || {
    printf '%s\n' 'Hiba: Python 3.8+ szükséges (python3 parancs).' >&2
    exit 1
}
# Preserve interactive stdin: Python reads its program from the heredoc.
exec python3 - "$@" 3<&0 <<'PYTHON'
import argparse
import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

MARKER = '<!-- source-export:v2 -->'
ALL = set('.ts .tsx .mts .cts .js .jsx .mjs .cjs .css .scss .html .json .md .mdx .txt .svg .ps1 .sh .yml .yaml'.split())
DEV = set('.ts .tsx .mts .cts .js .jsx .mjs .cjs .json'.split())
DOC = {'.md', '.mdx', '.txt'}
EXCLUDE_DIRS = {'node_modules', 'dist', 'build', '.git', '.vite', '.cache', 'coverage'}
EXCLUDE_FILES = {'package-lock.json', 'bun.lock', 'vite-dev.log', 'vite-dev.err.log', 'vite-smoke.out.log', 'vite-smoke.err.log'}
TEST_DIRS = {'test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress'}
MODE_LABELS = {
    'working': 'Aktuális teljes forrás (lokális módosításokkal)',
    'combined': 'Aktuális teljes forrás + lokális diff egy fájlban',
    'changes': 'Csak lokális változások (staged, unstaged, új fájlok)',
    'clean': 'Tiszta teljes forrás az utolsó commitból (HEAD)',
    'split': 'Tiszta HEAD-forrás és lokális változások két fájlban',
}
FILE_LABELS = {'developer': 'Fejlesztői fájlok, tesztek nélkül', 'test': 'Tesztfájlok', 'docs': 'Dokumentumok', 'all': 'Minden támogatott forrásfájl'}


def fail(message):
    raise RuntimeError(message)


def menu(title, choices):
    print('\n' + title)
    keys = list(choices)
    for i, key in enumerate(keys, 1):
        print(f'{i} - {choices[key]}')
    while True:
        print(f'Választás [1-{len(keys)}]: ', end='', flush=True)
        value = INPUT.readline()
        if not value:
            fail('Nincs menübemenet. Automatizáláshoz add meg a --mode és --files opciókat.')
        if value.strip() in [str(i) for i in range(1, len(keys) + 1)]:
            return keys[int(value.strip()) - 1]


def run_git(*args, allowed=(0,)):
    p = subprocess.run(['git', '--literal-pathspecs', '-C', str(repo),
                        '-c', 'core.quotepath=true', '-c', 'color.ui=false',
                        *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode not in allowed:
        fail('Git hiba: ' + p.stderr.decode('utf-8', 'replace').strip())
    return p.stdout


def names(data):
    return [os.fsdecode(p) for p in data.split(b'\0') if p]


def relative(name):
    p = Path(name)
    try:
        return p.relative_to(prefix).as_posix() if prefix != Path('.') else p.as_posix()
    except ValueError:
        return None


def is_test(name):
    p = Path(name.lower())
    return (bool(set(p.parts[:-1]) & TEST_DIRS)
            or bool(re.search(r'\.(spec|test)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$', p.name))
            or bool(re.search(r'\.(e2e|cy)\.(ts|tsx|js|jsx|mjs|cjs)$', p.name)))


def selected(name):
    rel = relative(name)
    if rel is None:
        return False
    p = Path(rel)
    if set(p.parts[:-1]) & EXCLUDE_DIRS or p.name in EXCLUDE_FILES:
        return False
    # Lexical comparison also excludes a deleted output from the HEAD snapshot.
    if os.path.abspath(root / rel) in excluded_outputs:
        return False
    ext = p.suffix.lower()
    return {'developer': ext in DEV and not is_test(rel),
            'test': ext in DEV and is_test(rel),
            'docs': ext in DOC, 'all': ext in ALL}[args.files]


def category(name):
    if args.files == 'test':
        return 'Teszt'
    ext = Path(name).suffix.lower()
    if ext in {'.ts', '.tsx', '.mts', '.cts'}:
        return 'TypeScript'
    if ext in {'.js', '.jsx', '.mjs', '.cjs'}:
        return 'JavaScript'
    return 'Dokumentáció' if ext in DOC else 'Egyéb'


def quoted(name):
    # Stable, unambiguous display even for tabs/newlines in paths.
    import json
    return json.dumps(name, ensure_ascii=True)


def block(data, lang=''):
    text = data.decode('utf-8', 'replace') if isinstance(data, bytes) else data
    longest = max([len(m[0]) for m in re.finditer(r'`+', text)] + [2])
    fence = '`' * (longest + 1)
    return f'{fence}{lang}\n{text}' + ('' if text.endswith('\n') else '\n') + fence + '\n'


def read_working(name):
    path = repo / name
    if path.is_symlink():
        return os.fsencode(os.readlink(path)), 'symlink'
    if path.is_file():
        return path.read_bytes(), 'file'
    if path.is_dir():
        return None, 'directory'
    return None, 'deleted'


def source_section(clean=False):
    entries = []
    for name in sorted(head_files if clean else working_files):
        if not selected(name):
            continue
        if clean:
            mode, oid = head_files[name]
            if mode == '160000':
                data, kind = (oid + '\n').encode(), 'submodule commit'
            else:
                data = run_git('cat-file', 'blob', oid)
                kind = 'symlink' if mode == '120000' else 'file'
        else:
            data, kind = read_working(name)
        if data is None:
            continue
        if data.startswith(MARKER.encode()):
            continue
        lines = len(data.splitlines())
        entries.append((name, data, kind, lines))
    totals = {}
    for name, data, kind, lines in entries:
        for cat in (category(name), 'Összesen'):
            stat = totals.setdefault(cat, [0, 0, 0])
            stat[0] += 1
            stat[1] += lines
            stat[2] += len(data)
    result = ['## Összesítés\n', '| Kategória | Fájlok | Sorok | Méret KiB |', '|---|---:|---:|---:|']
    for cat in (['Teszt'] if args.files == 'test' else ['TypeScript', 'JavaScript', 'Dokumentáció', 'Egyéb']) + ['Összesen']:
        count, lines, size = totals.get(cat, [0, 0, 0])
        result.append(f'| {cat} | {count} | {lines} | {size / 1024:.1f} |')
    result += ['\n## Projektstruktúra\n', block('\n'.join(relative(e[0]) for e in entries), 'text')]
    for name, data, kind, lines in entries:
        result += [f'\n## {quoted(relative(name))}\n',
                   f'Kategória: {category(name)}; típus: {kind}; sorok: {lines}; bájtok: {len(data)}\n']
        if b'\0' in data:
            result.append('Bináris tartalom: nem jeleníthető meg szöveges forrásexportként.\n')
        else:
            result.append(block(data, Path(name).suffix[1:]))
    return '\n'.join(result)


def changes_section():
    # Separate layers preserve staged edits even when unstaged edits undo them.
    diffopts = ['--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', '--binary', '--full-index']
    sections = []
    layers = [('Staged: HEAD → index', ['--cached'] + ([base] if base else [])),
              ('Unstaged: index → munkakönyvtár', [])]
    for title, layer in layers:
        changed = names(run_git('diff', '--name-only', '-z', *diffopts, *layer, '--'))
        patches = []
        for name in sorted(set(changed)):
            if selected(name):
                patches.append(run_git('diff', *diffopts, *layer, '--', name))
        sections += [f'### {title}\n', block(b''.join(patches), 'diff') if patches else 'Nincs változás a kiválasztott fájlkörben.\n']
    sections.append('### Új, még nem követett fájlok\n')
    count = 0
    for name in sorted(untracked):
        if not selected(name):
            continue
        data, kind = read_working(name)
        if data is None or data.startswith(MARKER.encode()):
            continue
        count += 1
        # Content rather than a fabricated patch: includes empty files and symlinks.
        sections += [f'#### Új fájl: {quoted(relative(name))}\n', f'Típus: {kind}; bájtok: {len(data)}\n']
        if b'\0' in data:
            import base64
            sections.append('Bináris fájl, Base64:\n' + block(base64.b64encode(data).decode(), 'text'))
        else:
            sections.append(block(data, Path(name).suffix[1:]))
    if not count:
        sections.append('Nincs új fájl a kiválasztott fájlkörben.\n')
    return '## Lokális változások\n\n' + '\n'.join(sections)


def document(mode, body):
    return (f'{MARKER}\n# Source Export\n\n'
            f'Gyökér: {quoted(str(root))}\n\n'
            f'Mód: {MODE_LABELS[mode]}\n\nFájlkör: {FILE_LABELS[args.files]}\n\n'
            f'HEAD: {head or "nincs commit / nem Git"}\n\n'
            f'Készült: {datetime.datetime.now().astimezone().isoformat(timespec="seconds")}\n\n'
            'A „teljes” a kiválasztott fájlkört jelenti, az eredeti kiterjesztés- és kizárási listával. '
            'Git módban az új, nem ignorált fájlok is bekerülnek. '
            'A diff útvonalai a repository gyökeréhez képest értendők. '
            'Átnevezések törlés + hozzáadás formában szerepelnek. '
            'A szimbolikus linkek célja kerül mentésre, a célfájl beolvasása nélkül. '
            'A submodule-ok tartalmát ez az export nem járja be. '
            'Ez olvasható Markdown-export, nem teljes repository-backup vagy közvetlenül alkalmazható patch. '
            'A szöveges nézet UTF-8-at feltételez; más kódolás hibás bájtjai helyettesítő karakterrel jelennek meg.\n\n'
            + body)


def check_output(path):
    if path.is_symlink():
        fail(f'A kimenet nem lehet szimbolikus link: {path}')
    if path.exists():
        if not path.is_file():
            fail(f'A kimenet nem fájl: {path}')
        with path.open('rb') as f:
            if f.read(len(MARKER)) != MARKER.encode():
                fail(f'Meglévő, nem ezzel a scripttel készült fájlt nem írok felül: {path}')
    if use_git:
        try:
            rel = path.relative_to(repo).as_posix()
        except ValueError:
            return
        if rel in tracked or rel in head_files:
            fail(f'Git által követett fájl nem lehet kimenet: {path}')


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n',
                                         dir=path.parent, prefix='.source-export-', delete=False) as f:
            temp = Path(f.name)
            f.write(content)
        os.replace(temp, path)
    finally:
        if temp is not None and temp.exists():
            temp.unlink()
    print(f'Export kész: {path}')


def main():
    global args, root, repo, prefix, excluded_outputs, use_git, head, base
    global head_files, working_files, tracked, untracked, INPUT
    parser = argparse.ArgumentParser(prog='export-source.sh', description='Forrásexport, Git diff és tiszta HEAD-export. Bash + Python 3.8+ + Git.',
                                     formatter_class=argparse.RawDescriptionHelpFormatter,
                                     epilog='Példa: bash export-source.sh --root . --mode split --files all --output source-export.md\n'
                                            'A split kimenete: source-export.clean.md és source-export.changes.md.\n'
                                            'A --filesystem csak working módban használható; Git nélkül ez az alapértelmezés.')
    parser.add_argument('--root', default='.', help='Projektkönyvtár (alapérték: .)')
    parser.add_argument('--output', default='source-export.md', help='Kimenet; relatív útvonal a --root alatt')
    parser.add_argument('--mode', choices=MODE_LABELS, help='Mentési mód; elhagyva menü')
    parser.add_argument('--files', choices=FILE_LABELS, help='Fájlkör; elhagyva menü')
    parser.add_argument('--filesystem', action='store_true', help='Git helyett fájlrendszer; az ignorált fájlokat is vizsgálja')
    args = parser.parse_args()
    INPUT = os.fdopen(3, 'r', encoding='utf-8')
    args.files = args.files or menu('Mit gyűjtsek össze?', FILE_LABELS)
    args.mode = args.mode or menu('Milyen mentés készüljön?', MODE_LABELS)
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        fail(f'Nem létező projektkönyvtár: {root}')
    repo, prefix = root, Path('.')
    use_git = False
    if not args.filesystem and shutil.which('git'):
        p = subprocess.run(['git', '-C', str(root), 'rev-parse', '--show-toplevel'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode == 0:
            repo = Path(os.fsdecode(p.stdout).rstrip('\r\n')).resolve()
            prefix = root.relative_to(repo)
            use_git = True
    if args.mode != 'working' and not use_git:
        fail('Ehhez a mentési módhoz Git és Git-munkakönyvtár kell; a --filesystem nem használható.')
    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = root / output
    # Resolve the parent only, so an output symlink can be rejected explicitly.
    output = output.parent.resolve() / output.name
    stem = output.with_suffix('') if output.suffix else output
    clean_out = Path(str(stem) + '.clean.md')
    changes_out = Path(str(stem) + '.changes.md')
    excluded_outputs = {os.path.abspath(p) for p in (output, clean_out, changes_out)}
    head, base = None, None
    head_files, tracked, untracked = {}, set(), set()
    if use_git:
        if run_git('ls-files', '--unmerged', '-z'):
            fail('Feloldatlan Git-konfliktus van. Előbb oldd fel, majd ismételd meg az exportot.')
        tracked = set(names(run_git('ls-files', '--cached', '-z')))
        untracked = set(names(run_git('ls-files', '--others', '--exclude-standard', '-z')))
        head_bytes = run_git('rev-parse', '--verify', 'HEAD', allowed=(0, 128))
        head = head_bytes.decode().strip() or None
        if head:
            for item in run_git('ls-tree', '-r', '-z', head).split(b'\0'):
                if item:
                    meta, name = item.split(b'\t', 1)
                    mode, kind, oid = meta.decode().split()
                    head_files[os.fsdecode(name)] = (mode, oid)
            base = head
        elif args.mode in {'clean', 'split'}:
            fail('Még nincs commit: nincs tiszta HEAD-forrás. Előbb készíts commitot, vagy válassz másik módot.')
        else:
            # Without HEAD, git diff --cached compares the index to the empty tree.
            base = None
        working_files = tracked | untracked
    else:
        working_files = set()
        for directory, dirs, files in os.walk(root, followlinks=False):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not (Path(directory) / d).is_symlink()]
            for name in files:
                working_files.add((Path(directory) / name).relative_to(root).as_posix())
    targets = [clean_out, changes_out] if args.mode == 'split' else [output]
    for target in targets:
        check_output(target)
    # Build all requested documents before writing any output.
    if args.mode == 'split':
        exports = [(clean_out, document('clean', source_section(True))),
                   (changes_out, document('changes', changes_section()))]
    else:
        pieces = []
        if args.mode in {'working', 'combined', 'clean'}:
            pieces.append(source_section(args.mode == 'clean'))
        if args.mode in {'combined', 'changes'}:
            pieces.append(changes_section())
        exports = [(output, document(args.mode, '\n\n'.join(pieces)))]
    for path, content in exports:
        atomic_write(path, content)


try:
    main()
except (RuntimeError, OSError, ValueError) as exc:
    print(f'Hiba: {exc}', file=sys.stderr)
    sys.exit(1)
except KeyboardInterrupt:
    print('\nMegszakítva.', file=sys.stderr)
    sys.exit(130)
PYTHON
