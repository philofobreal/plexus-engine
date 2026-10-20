import math

import pytest

from plexus_analyzer_lab.adapters.pitch_pair import pair_frequencies


def test_pitch_pair_requires_two_votes_and_retains_original_frequencies():
    assert pair_frequencies(220, None) is None
    assert pair_frequencies(None, 220) is None
    assert pair_frequencies(220, 440) is None
    result = pair_frequencies(220, 221)
    assert result['votes'][0]['frequencyHz'] == 220
    assert result['votes'][1]['frequencyHz'] == 221
    assert result['geometricMeanHz'] == math.sqrt(220 * 221)
    assert result['confidence'] is None
    assert result['groundTruthStatus'] is False


def test_pitch_pair_rejects_invalid_values_and_changed_tolerance():
    for value in [0, -1, float('nan'), float('inf'), 1001]:
        with pytest.raises(ValueError):
            pair_frequencies(value, 220)
    with pytest.raises(ValueError):
        pair_frequencies(220, 220, 50)
