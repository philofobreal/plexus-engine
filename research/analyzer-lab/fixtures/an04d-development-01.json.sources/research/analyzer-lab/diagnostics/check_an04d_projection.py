"""Actual NumPy/SciPy arithmetic, conditional on the Plexus prefix-only F0, not musical truth."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import scipy
import scipy.linalg
import numpy.linalg._linalg as numpy_source
import scipy.linalg._basic as scipy_source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    raw = args.input.read_bytes()
    if np.__version__ != '2.2.6' or scipy.__version__ != '1.15.3':
        raise ValueError('Pinned arithmetic providers required')
    frames = []
    for entry in json.loads(raw)['frames']:
        data = Path(entry['pcmPath']).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry['identity']['pcmSha256']:
            raise ValueError('PCM hash mismatch')
        n, fs, f = entry['trainingSamples'], entry['identity']['sampleRate'], entry['frequencyHz']
        start = entry['startSample']
        x = np.frombuffer(data, dtype='<f4')[start:start + n + n // 2].astype(np.float64)
        if len(x) != n + n // 2 or n != 2 ** int(np.ceil(np.log2(.08 * fs))) or not 80 <= f <= 1000:
            raise ValueError('Original-clock forecast geometry mismatch')
        x -= x[:n].mean()
        energy = [float(x[:n] @ x[:n]), float(x[n:] @ x[n:])]
        if min(energy) <= 1e-12 * min(n, n // 2):
            raise ValueError('Sampled arithmetic requires supported energy')
        for kind in ['stationary', 'linear-envelope']:
            columns = [np.ones(len(x))]
            i = np.arange(len(x), dtype=np.float64)
            u = i / (n - 1) - .5
            for h in range(1, 9):
                if h * f >= .4 * fs:
                    break
                phase = 2 * np.pi * h * f * i / fs
                c, s = np.cos(phase), np.sin(phase)
                columns += [c, s]
                if kind == 'linear-envelope':
                    columns += [u * c, u * s]
            matrix = np.column_stack(columns)
            results = {}
            for provider in ['numpy', 'scipy']:
                solved = np.linalg.lstsq(matrix[:n], x[:n], rcond=1e-10) if provider == 'numpy' else scipy.linalg.lstsq(
                    matrix[:n], x[:n], cond=1e-10, lapack_driver='gelsd')
                residual = x - matrix @ solved[0]
                results[provider] = {'rank': int(solved[2]),
                                     'fitResidualFraction': float(residual[:n] @ residual[:n]) / energy[0],
                                     'heldOutResidualFraction': float(residual[n:] @ residual[n:]) / energy[1]}
            difference = max(abs(results['numpy'][key] - results['scipy'][key])
                             for key in ['fitResidualFraction', 'heldOutResidualFraction'])
            frames.append({'caseId': entry['caseId'], 'frameIndex': entry['frameIndex'], 'kind': kind,
                           'trainingSamples': n, 'frequencyHz': f, 'columns': matrix.shape[1], 'results': results,
                           'maxAbsoluteDifference': difference,
                           'arithmeticAgreement': difference <= 1e-10 and results['numpy']['rank'] == results['scipy']['rank'],
                           'musicalTruth': False})
    folders = [Path(np.__file__).parent.parent / 'numpy.libs', Path(scipy.__file__).parent.parent / 'scipy.libs']
    sources = [Path(numpy_source.__file__), Path(scipy_source.__file__)]
    report = {'kind': 'actual-two-library-arithmetic', 'versions': {'numpy': np.__version__, 'scipy': scipy.__version__},
              'inputSha256': hashlib.sha256(raw).hexdigest(), 'frames': frames, 'cutoff': 1e-10, 'scipyDriver': 'gelsd',
              'sources': [{'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources],
              'binaries': [{'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                           for folder in folders for p in sorted(folder.glob('*.dll'))]}
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'models': len(frames), 'agreed': sum(f['arithmeticAgreement'] for f in frames)}))


if __name__ == '__main__':
    main()
