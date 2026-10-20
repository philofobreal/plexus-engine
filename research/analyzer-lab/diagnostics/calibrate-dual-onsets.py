"""Authored onset controls measure both libraries and their agreed subset separately."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import librosa

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'research/analyzer-lab/src'))
from plexus_analyzer_lab.adapters.audioflux_onsets import analyze_onsets
from plexus_analyzer_lab.labels.strict_pair import strict_pair
from plexus_analyzer_lab.metrics.events import event_metrics

SOURCES = ['research/analyzer-lab/diagnostics/calibrate-dual-onsets.py',
           'research/analyzer-lab/src/plexus_analyzer_lab/adapters/audioflux_onsets.py',
           'research/analyzer-lab/src/plexus_analyzer_lab/labels/strict_pair.py',
           'research/analyzer-lab/src/plexus_analyzer_lab/metrics/events.py',
           'research/analyzer-lab/fixtures/audioflux-runtime-lock-01.json']


def controls():
    fs = 44100
    for kind in ['impulse', 'noise', 'pluck', 'mixed-noise', 'mixed-pluck', 'sustain', 'ramp', 'removal']:
        samples = np.zeros(round(1.2 * fs), dtype=np.float32)
        t = np.arange(len(samples)) / fs
        if kind.startswith('mixed') or kind in ['sustain', 'ramp', 'removal']:
            env = np.ones_like(t)
            if kind == 'ramp': env = .1 + .9 * np.clip((t - .3) / .2, 0, 1)
            for j, hz in enumerate([191, 337, 503, 719]):
                carrier = .03 * env * np.sin(2 * np.pi * hz * t + .19)
                if kind == 'removal' and j == 0: carrier[t >= .63] = 0
                samples += carrier.astype(np.float32)
        truth = [round(a * fs) / fs for a in [.223, .463, .703]] if kind not in ['sustain', 'ramp', 'removal'] else []
        rng = np.random.default_rng(20261016)
        for at in truth:
            if kind == 'impulse': wave = np.array([.02], dtype=np.float32)
            elif 'noise' in kind:
                age = np.arange(round(.004 * fs)) / fs
                wave = .02 * rng.uniform(-1, 1, len(age)) * np.exp(-age / .0013)
            else:
                age = np.arange(round(.018 * fs)) / fs
                wave = .02 * np.sin(2 * np.pi * 1031 * age) * np.exp(-age / .006)
            start = round(at * fs)
            samples[start:start + len(wave)] += wave.astype(np.float32)
        yield kind, samples, fs, truth


def run(runtime, output):
    if output.exists() or Path(str(output) + '.sources').exists(): raise FileExistsError('Output must be new')
    rows = []
    for kind, samples, fs, truth in controls():
        env = librosa.onset.onset_strength(y=samples, sr=fs, n_fft=2048, hop_length=512, center=True)
        times = librosa.onset.onset_detect(onset_envelope=env, sr=fs, hop_length=512, backtrack=False, units='time')
        a = [{'time': float(t), 'class': 'onset'} for t in times if .1 <= t < len(samples) / fs]
        af = analyze_onsets(samples, fs, runtime)
        b = [e for e in af['events'] if e['time'] >= .1]
        pair = strict_pair(a, b, left_provider='librosa', right_provider='audioflux', tolerance=.025)
        streams = {'librosa': [e['time'] for e in a], 'audioflux': [e['time'] for e in b],
                   'agreed': [e['time'] for e in pair['acceptedReferences']]}
        rows.append({'kind': kind, 'sampleRate': fs, 'sampleCount': len(samples), 'truth': truth,
                     'negativeStart': .1, 'pcmSha256': af['pcmSha256'], 'eventTimes': streams,
                     'strictReference': pair, 'audiofluxProvenance': {k:v for k,v in af.items() if k != 'events'},
                     'truthComparison': {p: [event_metrics(truth, v, tol) for tol in [.002,.025,.05]] for p,v in streams.items()}})
    sources = {}
    for p in SOURCES:
        raw = (ROOT / p).read_bytes(); sources[p] = hashlib.sha256(raw).hexdigest()
        target = Path(str(output) + '.sources') / (p + '.txt'); target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream: stream.write(raw)
    with output.open('x', encoding='utf-8') as stream:
        json.dump({'protocol': 'AN-03F authored synthetic oracle calibration; consensus remains pseudo-label',
                   'librosaVersion': librosa.__version__, 'numpyVersion': np.__version__,
                   'librosaParameters': {'nFft':2048,'hopLength':512,'center':True,'backtrack':False},
                   'sourceHashes':sources,'rows':rows}, stream, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({r['kind']: {p:len(v) for p,v in r['eventTimes'].items()} for r in rows}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.runtime_root, args.output)
