"""Read the authorized local MP3 corpus; retain original-rate channel-0 f32le excerpts.

python prepare_an04b_recorded.py --audio-root DIRECTORY --output NEW_MANIFEST
Audio and PCM remain local ignored artifacts. No resampling, averaging or normalization.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists() or args.output.parent.exists():
        raise FileExistsError('New manifest and output directory required')
    files = sorted(args.audio_root.glob('*.mp3'))
    if len(files) != 3:
        raise ValueError('Expected the three authorized MP3 inputs')
    args.output.parent.mkdir(parents=True)
    cases = []
    for i, path in enumerate(files):
        info = sf.info(path)
        start = 10 * info.samplerate
        samples, rate = sf.read(path, start=start, frames=2 * info.samplerate, dtype='float32', always_2d=True)
        if len(samples) != 2 * rate:
            raise ValueError('Insufficient excerpt support')
        pcm = np.ascontiguousarray(samples[:, 0], dtype='<f4').tobytes()
        target = args.output.parent / f'recorded-{i}.f32'
        target.write_bytes(pcm)
        original_hash = hashlib.sha256()
        with path.open('rb') as stream:
            while block := stream.read(1024 * 1024):
                original_hash.update(block)
        cases.append({'caseId': f'recorded-{i}', 'pcmPath': str(target.resolve()),
                      'identity': {'pcmSha256': hashlib.sha256(pcm).hexdigest(), 'sampleRate': rate,
                                   'sampleCount': len(samples), 'timelineOffsetSeconds': 10},
                      'original': {'path': str(path.resolve()), 'sha256': original_hash.hexdigest(),
                                   'channels': info.channels, 'frames': info.frames},
                      'projection': 'channel-0', 'resampling': False, 'accuracy': None})
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump({'decoder': {'soundfile': sf.__version__, 'libsndfile': sf.__libsndfile_version__},
                   'cases': cases}, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'cases': len(cases), 'sampleRates': [c['identity']['sampleRate'] for c in cases]}))


if __name__ == '__main__':
    main()
