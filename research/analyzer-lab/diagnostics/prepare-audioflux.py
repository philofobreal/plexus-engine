"""Extract explicitly supplied, downloaded wheels into a new isolated research path."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def prepare(wheel_dirs, target, output):
    target = target.resolve()
    if target.exists() or output.exists():
        raise FileExistsError('Runtime and lock must be new')
    wheels = sorted(p for folder in wheel_dirs for p in folder.glob('*.whl'))
    if not wheels:
        raise ValueError('No supplied wheels')
    packages = []
    for path in wheels:
        with zipfile.ZipFile(path) as archive:
            if any(not (target / name).resolve().is_relative_to(target) for name in archive.namelist()):
                raise ValueError('Wheel path leaves isolated runtime')
            metadata = next(n for n in archive.namelist() if n.endswith('.dist-info/METADATA'))
            fields = archive.read(metadata).decode('utf-8').splitlines()
            name = next(v[6:] for v in fields if v.startswith('Name: '))
            version = next(v[9:] for v in fields if v.startswith('Version: '))
            if name.lower() in ['numpy', 'scipy', 'soundfile', 'librosa', 'mir-eval']:
                raise ValueError('Do not shadow pinned core research dependencies')
            packages.append({'name': name, 'version': version, 'wheel': path.name,
                             'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    if len({p['name'] for p in packages}) != len(packages):
        raise ValueError('Duplicate distribution')
    target.mkdir(parents=True)
    for path in wheels:
        with zipfile.ZipFile(path) as archive:
            archive.extractall(target)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump({'protocol': 'isolated wheel extraction; explicit inputs; no dependency resolution',
                   'target': str(target), 'packages': packages}, stream, indent=2)
        stream.write('\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wheel-dir', type=Path, action='append', required=True)
    parser.add_argument('--target', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.wheel_dir, args.target, args.output)
