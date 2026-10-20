import shutil
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from plexus_analyzer_lab.audio import load_audio, synthetic
from plexus_analyzer_lab.adapters.librosa import LibrosaAdapter
from plexus_analyzer_lab.adapters.plexus import PlexusAdapter
from plexus_analyzer_lab.config import load_config, REPO_ROOT


def test_audio_projection_preserves_clock_and_content_identity(tmp_path):
    path = tmp_path / "stereo.wav"
    stereo = np.array([[0.5, -0.5], [0.25, 0.75]], dtype=np.float32)
    sf.write(path, stereo, 22050, subtype="FLOAT")
    audio = load_audio(path)
    np.testing.assert_array_equal(audio.samples, [0.5, 0.25])
    assert audio.metadata["monoProjection"] == "channel-0"
    mean = load_audio(path, mono_projection="arithmetic-mean")
    np.testing.assert_array_equal(mean.samples, [0, 0.5])
    assert mean.metadata["contentHash"] == audio.metadata["contentHash"]
    assert mean.metadata["decodedPcmHash"] != audio.metadata["decodedPcmHash"]
    assert audio.samples.dtype == np.float32
    assert audio.metadata["sampleCount"] == 2
    assert audio.metadata["sampleRate"] == 22050


@pytest.mark.parametrize("kind", ["click", "pulse", "tone-click", "sparse", "silence", "ambiguity"])
def test_synthetic_is_repeatable(tmp_path, kind):
    paths = [tmp_path / f"{i}.wav" for i in range(2)]
    metadata = [synthetic(path, kind, 128, 2) for path in paths]
    assert metadata[0] == metadata[1]
    assert paths[0].read_bytes() == paths[1].read_bytes()


def test_librosa_silence_is_empty_evidence(tmp_path):
    path = tmp_path / "silence.wav"
    synthetic(path, "silence", duration=2)
    result = LibrosaAdapter().analyze(load_audio(path), tmp_path, load_config(), "fixed")
    assert result["timing"]["tempo"] is None
    assert result["timing"]["beats"] == []
    assert result["events"] == []
    assert result["sections"] is None


@pytest.mark.integration
def test_real_vertical_slice_repeatability_and_raw_contract(tmp_path):
    if not shutil.which("node") or not (REPO_ROOT / "node_modules/typescript").exists():
        pytest.skip("Node and repository TypeScript required")
    path = tmp_path / "click.wav"
    synthetic(path, duration=8)
    audio = load_audio(path)
    original = audio.samples.copy()
    config = load_config()
    plexus = PlexusAdapter().analyze(audio, tmp_path, config, "fixed")
    librosa = LibrosaAdapter()
    first = librosa.analyze(audio, tmp_path, config, "fixed")
    second = librosa.analyze(audio, tmp_path, config, "fixed")
    assert first == second
    assert plexus["metadata"] == first["metadata"]
    assert plexus["provenance"]["evidenceType"] == "plexus_prediction"
    assert first["provenance"]["evidenceType"] == "oracle_prediction"
    assert plexus["timing"]["beats"]
    assert first["timing"]["beats"]
    assert first["events"]
    assert all(e["class"] == "onset" for e in plexus["events"])
    assert (tmp_path / "plexus.raw.json").is_file()
    assert not list(tmp_path.glob("pcm-*"))
    np.testing.assert_array_equal(audio.samples, original)
