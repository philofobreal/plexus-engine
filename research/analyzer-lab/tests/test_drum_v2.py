import copy
import json

import numpy as np
import pytest

from plexus_analyzer_lab.drums.classifier import predict, validate_model
from plexus_analyzer_lab.drums.classifier_v2 import BASIS_NAMES, design, scores
from plexus_analyzer_lab.drums.comparison import compare_models
from plexus_analyzer_lab.drums.dataset import load_dataset, observation
from plexus_analyzer_lab.drums.experiment import train
from plexus_analyzer_lab.drums.features_v2 import FEATURE_NAMES, extract
from plexus_analyzer_lab.drums.synthetic_v2 import generate_corpus_v2
from plexus_analyzer_lab.hashing import object_hash
from plexus_analyzer_lab.reports.json_report import write_json


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    parent = tmp_path_factory.mktemp("drum-v2")
    manifest = generate_corpus_v2(parent / "corpus", sample_rate=16000)
    model_path = train(manifest, parent / "v2.json", algorithm="v2")
    return manifest, model_path


@pytest.mark.parametrize("rate", [16000, 22050, 44100, 48000])
def test_sustained_oscillator_has_no_interior_proposals(rate):
    t = np.arange(rate * 3) / rate
    wave = .5 * np.sin(2 * np.pi * 51 * t) * np.minimum(1, t / .2)
    times, rows = extract(wave, rate)
    assert len(times[(times >= 1) & (times < 2.8)]) == 0
    assert rows.shape == (len(times), len(FEATURE_NAMES)) and np.isfinite(rows).all()


def test_empty_predictions_supported_and_no_input_mutation():
    wave = np.zeros(16000)
    before = wave.copy()
    times, rows = extract(wave, 16000)
    assert len(times) == 0 and rows.shape == (0, 30)
    assert np.array_equal(wave, before)
    for rate in (8000, 16000.5, True):
        with pytest.raises(ValueError):
            extract(wave, rate)


def test_v2_identity_dimensions_and_model_integrity(trained):
    model = json.loads(trained[1].read_text(encoding="utf-8"))
    validate_model(model)
    assert model["algorithm"] == "plexus-drum-ridge-v2"
    assert model["basisNames"] == BASIS_NAMES
    assert np.asarray(model["weights"]).shape == (43, 3)
    assert model["hyperparameterSelection"]["split"] == "validation"
    assert model["hyperparameterSelection"]["ridgeGrid"] == [1, 10, 100]
    bad = copy.deepcopy(model)
    bad["weights"][0][0] += .1
    with pytest.raises(ValueError, match="checksum"):
        validate_model(bad)
    bad["basisNames"].reverse()
    bad["modelChecksum"] = object_hash({k: v for k, v in bad.items() if k != "modelChecksum"})
    with pytest.raises(Exception):
        validate_model(bad)


def test_v2_fitting_never_reads_test_labels(trained, tmp_path):
    data = load_dataset(trained[0], "training")
    data.pop("manifestHash")
    invalid = tmp_path / "unread.json"
    invalid.write_text("invalid JSON", encoding="utf-8")
    for track in data["tracks"]:
        track.pop("annotationHash")
        if track["split"] == "test":
            track["annotationPath"] = str(invalid)
    manifest = tmp_path / "manifest.json"
    write_json(manifest, data)
    output = train(manifest, tmp_path / "model.json", algorithm="v2")
    original = json.loads(trained[1].read_text(encoding="utf-8"))
    other = json.loads(output.read_text(encoding="utf-8"))
    for key in ("mean", "scale", "weights", "thresholds", "hyperparameterSelection", "fitting"):
        assert original[key] == other[key]


def test_basis_clipping_and_multilabel_unknown_confidence(trained):
    model = json.loads(trained[1].read_text(encoding="utf-8"))
    x = np.full((1, 30), 1e6)
    assert np.isfinite(scores(model, x)).all() and np.max(abs(design(model, x))) <= 64
    dataset = load_dataset(trained[0], "evaluation")
    audio, _ = observation(next(t for t in dataset["tracks"] if t["split"] == "test"))
    first, _ = predict(audio, model)
    second, _ = predict(audio, model)
    assert first["events"] == second["events"]
    assert all(e["confidence"] is None for e in first["events"])
    assert first["provenance"]["modelVersion"] == "2.0.0"


def test_paired_same_model_delta_is_zero_and_artifacts_preserved(trained, tmp_path):
    output, report = compare_models(trained[0], trained[1], trained[1], tmp_path / "paired")
    assert (output / "comparison.md").is_file()
    assert all(m["fMeasureDelta"] == 0 for m in report["byClass"].values())
    assert report["baselineModelChecksum"] == report["candidateModelChecksum"]
    with pytest.raises(ValueError, match="must be new"):
        compare_models(trained[0], trained[1], trained[1], output)
