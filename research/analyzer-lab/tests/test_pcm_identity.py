import copy

import numpy as np
import pytest
import soundfile as sf

from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.canonical import empty_analysis
from plexus_analyzer_lab.drums.dataset import verify_identity
from plexus_analyzer_lab.metrics.timing import compare
from plexus_analyzer_lab.provenance import provenance


def test_stereo_antiphase_matches_host_channel_and_records_distinct_pcm(tmp_path):
    path = tmp_path / 'antiphase.wav'
    left = np.array([.5, -.25, .75], dtype=np.float32)
    sf.write(path, np.column_stack((left, -left)), 48000, subtype='FLOAT')
    host = load_audio(path)
    mean = load_audio(path, mono_projection='arithmetic-mean')
    np.testing.assert_array_equal(host.samples, left)
    np.testing.assert_array_equal(mean.samples, np.zeros(3))
    assert host.metadata['sampleRate'] == 48000
    assert host.metadata['sampleCount'] == 3
    assert host.metadata['duration'] == 3 / 48000
    assert host.metadata['contentHash'] == mean.metadata['contentHash']
    assert host.metadata['decodedPcmHash'] != mean.metadata['decodedPcmHash']
    with pytest.raises(ValueError, match='identity mismatch'):
        verify_identity({'metadata': mean.metadata}, host.metadata)
    with pytest.raises(ValueError, match='Unsupported mono projection'):
        load_audio(path, mono_projection='implicit')


def test_legacy_single_channel_annotations_have_equivalent_projection(tmp_path):
    path = tmp_path / 'mono.wav'
    sf.write(path, np.array([.5, -.25], dtype=np.float32), 44100, subtype='FLOAT')
    audio = load_audio(path)
    old_metadata = {k: v for k, v in audio.metadata.items() if k != 'decodedPcmHash'}
    old_metadata['monoProjection'] = 'arithmetic-mean'
    verify_identity({'metadata': old_metadata}, audio.metadata)


@pytest.mark.parametrize('field', ['monoProjection', 'decodedPcmHash', 'sampleCount', 'channels'])
def test_differential_scores_reject_mismatched_pcm_contract(field):
    metadata = {'trackId': 'same-file', 'contentHash': 'a' * 64, 'duration': 1, 'sampleRate': 48000,
                'sampleCount': 48000, 'channels': 2, 'monoProjection': 'channel-0', 'decodedPcmHash': 'b' * 64}
    baseline = empty_analysis(metadata, provenance('plexus', '7', {}, 'plexus_prediction', 'fixed'))
    other = copy.deepcopy(baseline)
    other['metadata'][field] = 'changed'
    with pytest.raises(ValueError, match='different PCM identities'):
        compare(baseline, other)
    del other['metadata'][field]
    with pytest.raises(ValueError, match='different PCM identities'):
        compare(baseline, other)
