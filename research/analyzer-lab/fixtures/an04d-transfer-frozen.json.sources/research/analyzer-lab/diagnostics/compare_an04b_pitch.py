"""Call actual providers for an explicit original-clock PCM manifest; exclusive outputs.

python compare_an04b_pitch.py --input NEW_MANIFEST --output NEW_JSON --runtime AUDIOFLUX_ROOT
Manifest cases contain caseId, pcmPath and identity; PCM is mono f32le.
No labels, detection substitutions, dependency installation or resampling.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from plexus_analyzer_lab.adapters.pitch_pair import analyze_pitch_pair


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--runtime', required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Exclusive provider result required')
    manifest_bytes = args.input.read_bytes()
    manifest = json.loads(manifest_bytes)
    cases, seen = [], set()
    for entry in manifest['cases']:
        if entry['caseId'] in seen:
            raise ValueError('Duplicate PCM case')
        seen.add(entry['caseId'])
        data = Path(entry['pcmPath']).read_bytes()
        identity = entry['identity']
        if len(data) != identity['sampleCount'] * 4 or hashlib.sha256(data).hexdigest() != identity['pcmSha256']:
            raise ValueError('Decoded PCM identity mismatch')
        samples = np.frombuffer(data, dtype='<f4').copy()
        result = analyze_pitch_pair(samples, identity['sampleRate'], args.runtime)
        for pair in result['pairs']:
            pair['identity'] = dict(identity)
        cases.append({'caseId': entry['caseId'], 'identity': identity, **result})
    report = {'kind': 'actual-two-provider-pitch-inference', 'python': sys.version,
              'inputManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(), 'cases': cases}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'cases': len(cases), 'providerVersions': cases[0]['providerVersions'],
                      'acceptedPairs': sum(len(c['pairs']) for c in cases)}))


if __name__ == '__main__':
    main()
