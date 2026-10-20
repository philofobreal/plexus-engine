"""Verify recorded diagnostic clocks/matching and actual binary-to-DSP bridge without MP3 dependencies."""
import importlib.util
import json
from pathlib import Path
import subprocess

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('recorded_onsets', ROOT / 'research/analyzer-lab/diagnostics/recorded-onsets.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_symmetric_one_to_one_agreement_is_not_accuracy():
    a, b = [.01, .02], [.011, .019, .3]
    r = module.agreement(a, b, .002)
    assert (r['sharedCount'], r['leftOnlyCount'], r['rightOnlyCount']) == (2, 0, 1)
    assert r['diceAgreement'] == .8
    reverse = module.agreement(b, a, .002)
    assert reverse['sharedCount'] == 2 and reverse['diceAgreement'] == .8
    assert module.agreement([], [], .025)['diceAgreement'] is None
    assert module.agreement([0, .018], [.009, .027], .01)['sharedCount'] == 2
    assert not {'accuracy', 'precision', 'recall', 'confidence'} & r.keys()


def test_real_recording_manifest_preserves_physical_half_open_clocks():
    data = json.loads((ROOT / 'research/analyzer-lab/fixtures/an03e-prodigy-recorded-01.json').read_text())
    assert data['groundTruth'] is None and data['accuracy'] is None
    assert data['resampling'] is False and data['monoProjection'] == 'channel-0'
    assert len(data['rows']) == 9 and len({r['file'] for r in data['rows']}) == 3
    exposure, counts, shared = 0, {'differenceV5': 0, 'continuationV6': 0, 'librosa': 0}, 0
    for r in data['rows']:
        fs = r['track']['sampleRate']
        assert fs == 44100 and r['track']['channels'] == 2
        assert r['excerptEndSample'] - r['excerptStartSample'] == 20 * fs
        assert r['contextStartSample'] == r['excerptStartSample'] - round(.1 * fs)
        assert r['contextEndSample'] == r['excerptEndSample'] + round(.1 * fs)
        assert r['contextEndSample'] <= r['track']['sampleCount']
        assert all(len(r['track'][h].removeprefix('sha256:')) == 64 for h in ['contentHash', 'decodedPcmHash'])
        exposure += (r['excerptEndSample'] - r['excerptStartSample']) / fs
        for provider, events in r['eventTimes'].items():
            assert events == sorted(events)
            assert all(r['excerptStartSample'] / fs <= t < r['excerptEndSample'] / fs for t in events)
            counts[provider] += len(events)
        assert r['eventTimes']['differenceV5'] == r['eventTimes']['continuationV6']
        assert r['agreement']['continuationV6'][1] == module.agreement(r['eventTimes']['continuationV6'], r['eventTimes']['librosa'], .025)
        shared += r['agreement']['continuationV6'][1]['sharedCount']
    assert exposure == 180 and counts == {'differenceV5': 647, 'continuationV6': 647, 'librosa': 1318}
    assert shared == 426


def bridge(tmp_path, *, truncate=False):
    samples = np.zeros(8000, dtype='<f4'); samples[4000] = .5
    pcm = tmp_path / 'samples.f32le'; pcm.write_bytes(samples.tobytes()[:-1] if truncate else samples.tobytes())
    request = tmp_path / 'request.json'
    request.write_text(json.dumps({'format': 'f32le', 'sampleRate': 8000, 'sampleCount': len(samples), 'pcmPath': str(pcm)}))
    output = tmp_path / 'output.json'
    command = ['node', 'research/analyzer-lab/diagnostics/recorded-onsets.mjs', str(request), str(output)]
    return command, output


def test_binary_bridge_runs_actual_analyzer_and_never_overwrites(tmp_path):
    command, output = bridge(tmp_path)
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    data = json.loads(output.read_text())
    assert data['sampleRate'] == 8000 and data['sampleCount'] == 8000
    assert len(data['continuationV6']) == 1 and .5 <= data['continuationV6'][0] < .502
    assert data['differenceV5'] == data['continuationV6']
    before = output.read_bytes()
    assert subprocess.run(command, cwd=ROOT, capture_output=True).returncode != 0
    assert output.read_bytes() == before


def test_binary_bridge_rejects_truncation(tmp_path):
    command, output = bridge(tmp_path, truncate=True)
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    assert result.returncode != 0 and 'PCM size mismatch' in result.stderr
    assert not output.exists()


def test_recorded_program_refuses_reused_evidence_before_decode(tmp_path):
    folder = tmp_path / 'audio'; folder.mkdir()
    cache = tmp_path / 'cache'; cache.mkdir()
    output = tmp_path / 'result.json'; output.write_text('preserve\n')
    with pytest.raises(FileExistsError):
        module.run(folder, cache, output)
    assert output.read_text() == 'preserve\n'
