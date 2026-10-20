"""Local recordings: deterministic excerpts and event agreement, never accuracy."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import platform

import numpy as np
import soundfile as sf
import librosa
import mir_eval

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'research/analyzer-lab/src'))
from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.adapters.audioflux_onsets import analyze_onsets
from plexus_analyzer_lab.labels.strict_pair import strict_pair

FRACTIONS = [.15, .45, .75]
SECONDS = 20
CONTEXT_SECONDS = .1
TOLERANCES = [.002, .01, .025, .05]
SOURCES = ['src/analyzer/PeakOnsets.ts','src/types/peakOnsets.ts','research/analyzer-lab/src/plexus_analyzer_lab/adapters/audioflux_onsets.py','research/analyzer-lab/src/plexus_analyzer_lab/labels/strict_pair.py','research/analyzer-lab/src/plexus_analyzer_lab/hashing.py','research/analyzer-lab/fixtures/audioflux-runtime-lock-01.json','src/analyzer/ContinuationOnsets.ts', 'src/types/continuationOnsets.ts', 'src/analyzer/DifferenceOnsets.ts',
           'src/analyzer/ResidualOnsets.ts', 'src/analyzer/AdaptiveOnsets.ts',
           'src/analyzer/signalContract.ts', 'src/types/differenceOnsets.ts',
           'src/types/residualOnsets.ts', 'src/types/adaptiveOnsets.ts',
           'tests/helpers/xr-loader.mjs', 'research/analyzer-lab/src/plexus_analyzer_lab/audio.py',
           'research/analyzer-lab/diagnostics/dual-recorded-onsets.py',
           'research/analyzer-lab/diagnostics/dual-recorded-onsets.mjs']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def agreement(a, b, tolerance):
    # Symmetric event matching; neither stream is ground truth.
    shared = len(mir_eval.util.match_events(np.asarray(a), np.asarray(b), tolerance))
    return {'toleranceSeconds': tolerance, 'leftCount': len(a), 'rightCount': len(b),
            'sharedCount': shared, 'leftOnlyCount': len(a) - shared,
            'rightOnlyCount': len(b) - shared,
            'diceAgreement': 2 * shared / (len(a) + len(b)) if a or b else None}


def run(folder, cache, output, runtime_root):
    if output.exists() or Path(str(output) + '.sources').exists() or cache.exists():
        raise FileExistsError('Outputs and PCM cache must be new')
    tracks = sorted(folder.glob('*.mp3')) + sorted(folder.glob('*.wav'))
    if not tracks:
        raise ValueError('No MP3 or WAV recordings')
    cache.mkdir(parents=True)
    source_hashes = {p: digest((ROOT / p).read_bytes()) for p in SOURCES}
    rows = []
    old = json.loads((ROOT / 'research/analyzer-lab/fixtures/an03e-prodigy-recorded-01.json').read_text())
    prior = {(r['file'],r['fraction']):r for r in old['rows']}
    for number, path in enumerate(tracks):
        audio = load_audio(path, mono_projection='channel-0')
        fs, count = audio.sample_rate, audio.samples.size
        if count < (SECONDS + 2 * CONTEXT_SECONDS) * fs:
            raise ValueError('Recording too short for declared excerpt protocol')
        for fraction in FRACTIONS:
            center = round(fraction * count)
            start = center - round(SECONDS * fs / 2)
            end = start + round(SECONDS * fs)
            pad = round(CONTEXT_SECONDS * fs)
            left, right = start - pad, end + pad
            if left < 0 or right > count:
                raise ValueError('Excerpt outside recording')
            pcm = np.asarray(audio.samples[left:right], dtype='<f4').tobytes()
            stem = cache / f'{number}-{int(fraction * 100)}'
            pcm_path = stem.with_suffix('.f32le')
            pcm_path.write_bytes(pcm)
            request = {'format': 'f32le', 'sampleRate': fs, 'sampleCount': right - left,
                       'pcmPath': str(pcm_path.resolve())}
            request_path, result_path = stem.with_suffix('.request.json'), stem.with_suffix('.plexus.json')
            request_path.write_text(json.dumps(request) + '\n')
            subprocess.run(['node', 'research/analyzer-lab/diagnostics/dual-recorded-onsets.mjs',
                            str(request_path.resolve()), str(result_path.resolve())], cwd=ROOT, check=True)
            plexus = json.loads(result_path.read_text())
            y = np.frombuffer(pcm, dtype='<f4')
            envelope = librosa.onset.onset_strength(y=y, sr=fs, hop_length=512, n_fft=2048, center=True)
            times = librosa.onset.onset_detect(onset_envelope=envelope, sr=fs, hop_length=512,
                                             backtrack=False, units='time')
            streams = {p: [left / fs + t for t in plexus[p] if start / fs <= left / fs + t < end / fs]
                       for p in ['differenceV5', 'continuationV6', 'peakV7']}
            streams['librosa'] = [left / fs + float(t) for t in times if start / fs <= left / fs + t < end / fs]
            af = analyze_onsets(y, fs, runtime_root)
            if af['pcmSha256'] != digest(pcm): raise ValueError('Oracle PCM differs')
            streams['audioflux'] = [left / fs + e['time'] for e in af['events'] if start / fs <= left / fs + e['time'] < end / fs]
            previous = prior[(path.name, fraction)]
            if previous['excerptWithContextPcmSha256'] != digest(pcm) or previous['track'] != audio.metadata: raise ValueError('Recording identity differs')
            for provider in ['differenceV5', 'continuationV6', 'librosa']:
                if streams[provider] != previous['eventTimes'][provider]: raise ValueError('Old recorded output changed')
            pair = strict_pair([{'time':t,'class':'onset'} for t in streams['librosa']],
                               [{'time':t,'class':'onset'} for t in streams['audioflux']],
                               left_provider='librosa', right_provider='audioflux', tolerance=.025)
            refs = [e['time'] for e in pair['acceptedReferences']]
            rows.append({'strictReference':pair, 'audiofluxProvenance':{k:v for k,v in af.items() if k != 'events'},
                         'plexusVsAcceptedReference':{p:[agreement(streams[p],refs,t) for t in TOLERANCES] for p in ['continuationV6','peakV7']},'file': path.name, 'absolutePath': str(path.resolve()), 'fraction': fraction,
                         'track': audio.metadata, 'excerptStartSample': start, 'excerptEndSample': end,
                         'contextStartSample': left, 'contextEndSample': right,
                         'excerptWithContextPcmSha256': digest(pcm), 'eventTimes': streams,
                         'agreement': {p: [agreement(streams[p], streams['librosa'], t) for t in TOLERANCES]
                                       for p in ['differenceV5', 'continuationV6', 'peakV7', 'audioflux']}})
            print(json.dumps({'file': path.name, 'fraction': fraction,
                              'counts': {p: len(v) for p, v in streams.items()}}), flush=True)
    if any(digest((ROOT / p).read_bytes()) != h for p, h in source_hashes.items()):
        raise ValueError('DSP or measurement source changed during run')
    bundle = Path(str(output) + '.sources')
    for p in SOURCES:
        target = bundle / (p + '.txt')
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write((ROOT / p).read_bytes())
    report = {'protocol': 'AN-03F two-library agreed references only; unannotated; no correctness claim',
              'versions': {'python': platform.python_version(), 'numpy': np.__version__,
                           'soundfile': sf.__version__, 'libsndfile': sf.__libsndfile_version__,
                           'librosa': librosa.__version__, 'mir_eval': mir_eval.__version__,
                           'node': subprocess.check_output(['node', '--version'], text=True).strip()},
              'sourceHashes': source_hashes, 'fractions': FRACTIONS, 'excerptSeconds': SECONDS,
              'contextSecondsEachSide': CONTEXT_SECONDS, 'resampling': False, 'monoProjection': 'channel-0',
              'librosaParameters': {'hopLength': 512, 'nFft': 2048, 'center': True, 'backtrack': False,
                                    'peakPicking': 'onset_detect defaults of recorded version'},
              'referencePolicy': 'librosa AND audioflux class-matched one-to-one agreement <=25ms; unaccepted outputs remain unknown', 'groundTruth': None, 'accuracy': None, 'rows': rows}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write('\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-root', type=Path, required=True)
    parser.add_argument('--input-dir', type=Path, required=True)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.input_dir, args.cache, args.output, args.runtime_root)
