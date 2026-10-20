"""Actual NumPy/SciPy least-squares cross-check for selected fixed-frequency frames.

python check_an04c_projection.py --input MANIFEST --output NEW_JSON
Manifest samples specify PCM identity/path, support and hypothesis frequency.
Frequency is a MODEL PARAMETER, not a provider F0 prediction or source label.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import numpy.linalg._linalg as numpy_source
import scipy
import scipy.linalg
import scipy.linalg._basic as scipy_source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Exclusive arithmetic result required')
    if np.__version__ != '2.2.6' or scipy.__version__ != '1.15.3':
        raise ValueError('Expected measured NumPy/SciPy versions')
    raw = args.input.read_bytes()
    manifest = json.loads(raw)
    cases = []
    for entry in manifest['frames']:
        pcm = Path(entry['pcmPath']).read_bytes()
        identity = entry['identity']
        if hashlib.sha256(pcm).hexdigest() != identity['pcmSha256'] or len(pcm) != identity['sampleCount'] * 4:
            raise ValueError('Arithmetic PCM mismatch')
        start, end, frequency = entry['startSample'], entry['endSample'], entry['frequencyHz']
        fs = identity['sampleRate']
        if not 0 <= start < end <= identity['sampleCount'] or not 80 <= frequency <= 1000:
            raise ValueError('Invalid arithmetic model support')
        x = np.frombuffer(pcm, dtype='<f4')[start:end].astype(np.float64)
        train = 2 * len(x) // 3
        x -= x[:train].mean()
        columns = [np.ones(len(x))]
        h = 1
        while h <= 8 and h * frequency < .4 * fs:
            phase = 2 * math.pi * h * frequency * np.arange(len(x), dtype=np.float64) / fs
            columns += [np.cos(phase), np.sin(phase)]
            h += 1
        matrix = np.column_stack(columns)
        fit_energy, suffix_energy = float(x[:train] @ x[:train]), float(x[train:] @ x[train:])
        results = {}
        for provider in ['numpy', 'scipy']:
            solved = np.linalg.lstsq(matrix[:train], x[:train], rcond=1e-10) if provider == 'numpy' else scipy.linalg.lstsq(
                matrix[:train], x[:train], cond=1e-10, lapack_driver='gelsd')
            residual = x - matrix @ solved[0]
            results[provider] = {'rank': int(solved[2]),
                                 'fitResidualFraction': float(residual[:train] @ residual[:train]) / fit_energy,
                                 'heldOutResidualFraction': float(residual[train:] @ residual[train:]) / suffix_energy}
        difference = max(abs(results['numpy'][key] - results['scipy'][key])
                         for key in ['fitResidualFraction', 'heldOutResidualFraction'])
        cases.append({'caseId': entry['caseId'], 'frameIndex': entry['frameIndex'], 'frequencyHz': frequency,
                      'support': [start, end], 'pcmSha256': identity['pcmSha256'], 'trainingSamples': train,
                      'columns': matrix.shape[1], 'results': results, 'maxAbsoluteDifference': difference,
                      'arithmeticAgreement': difference <= 1e-10 and results['numpy']['rank'] == results['scipy']['rank'],
                      'musicalTruth': False})
    packages = [Path(np.__file__).parent.parent / 'numpy.libs', Path(scipy.__file__).parent.parent / 'scipy.libs']
    binaries = [{'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                for folder in packages for path in sorted(folder.glob('*.dll'))]
    sources = [Path(numpy_source.__file__), Path(scipy_source.__file__)]
    report = {'kind': 'actual-two-library-arithmetic', 'versions': {'numpy': np.__version__, 'scipy': scipy.__version__},
              'inputSha256': hashlib.sha256(raw).hexdigest(), 'cutoff': 1e-10, 'scipyDriver': 'gelsd',
              'sources': [{'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in sources],
              'binaries': binaries, 'frames': cases, 'sampleCoverage': 'first/last available primary frame per case',
              'sourceIsolationReference': 'unavailable'}
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'frames': len(cases), 'agreed': sum(c['arithmeticAgreement'] for c in cases)}))


if __name__ == '__main__':
    main()
