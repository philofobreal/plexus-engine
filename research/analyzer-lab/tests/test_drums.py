import copy
import json

import numpy as np
import pytest

from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.drums.classifier import predict, select_events, targets, validate_model
from plexus_analyzer_lab.drums.dataset import load_dataset, observation
from plexus_analyzer_lab.drums.experiment import _oracles, benchmark, confusion, train
from plexus_analyzer_lab.drums.features import FEATURE_NAMES, extract
from plexus_analyzer_lab.drums.synthetic import generate_corpus
from plexus_analyzer_lab.hashing import content_hash, object_hash
from plexus_analyzer_lab.reports.json_report import write_json


@pytest.fixture(scope="module")
def corpus(tmp_path_factory):
    path = generate_corpus(tmp_path_factory.mktemp("parent") / "corpus")
    output = path.parent / "model.json"
    train(path, output)
    return path, output


def changed_manifest(corpus, tmp_path, change):
    data = load_dataset(corpus[0], "evaluation")
    data.pop("manifestHash")
    for track in data["tracks"]:
        track.pop("annotationHash")
    change(data)
    path = tmp_path / "dataset.json"
    write_json(path, data)
    return path


def test_silence_has_no_candidates_and_clock_guards():
    times, features = extract(np.zeros(16000), 16000)
    assert len(times) == 0 and features.shape == (0, len(FEATURE_NAMES))
    for wave, rate in ((np.array([np.nan]), 22050), (np.ones(100), 8000), (np.array([]), 22050)):
        with pytest.raises(ValueError):
            extract(wave, rate)


def test_candidate_features_are_deterministic_and_do_not_mutate(corpus):
    dataset = load_dataset(corpus[0], "training")
    audio, _ = observation(dataset["tracks"][0])
    before = audio.samples.copy()
    first = extract(audio.samples, audio.sample_rate)
    second = extract(audio.samples, audio.sample_rate)
    assert np.array_equal(first[0], second[0]) and np.array_equal(first[1], second[1])
    assert np.isfinite(first[1]).all() and len(first[0]) > 0
    assert np.array_equal(audio.samples, before)


def test_overlapping_classes_are_not_exclusive():
    events = select_events(np.array([1, 1.01, 1.1]), np.array([[0.9, 0.8, 0], [0.7, 0.6, 0], [0, 0, 0.9]]), [0.5] * 3)
    assert [(e["time"], e["class"]) for e in events] == [(1, "kick"), (1, "snare"), (1.1, "hihat")]
    assert all(e["confidence"] is None for e in events)
    y = targets(np.array([1, 1.01]), [{"time": 1, "class": "kick"}, {"time": 1, "class": "snare"}])
    assert y.tolist() == [[1, 1, 0], [0, 0, 0]]


@pytest.mark.parametrize("mutation", [
    lambda d: d["rights"].update(reviewed=False),
    lambda d: d["rights"].update(trainingAllowed=False),
    lambda d: d["tracks"][-1].update(groupId=d["tracks"][0]["groupId"]),
    lambda d: d["tracks"][-1].update(audioPath=d["tracks"][0]["audioPath"], contentHash=d["tracks"][0]["contentHash"]),
    lambda d: d["tracks"][0].update(contentHash="0" * 64),
    lambda d: d["tracks"][-1].update(trackId=d["tracks"][0]["trackId"]),
])
def test_permissions_and_actual_identity_leakage(corpus, tmp_path, mutation):
    path = changed_manifest(corpus, tmp_path, mutation)
    with pytest.raises(ValueError):
        load_dataset(path, "training")


def test_partial_annotation_cannot_create_negative_labels(corpus, tmp_path):
    dataset = load_dataset(corpus[0], "training")
    track = dataset["tracks"][0].copy()
    annotation = json.loads(open(track["annotationPath"], encoding="utf-8").read())
    annotation["provenance"]["parameters"]["completeEventClasses"] = ["kick"]
    path = tmp_path / "partial.json"
    write_json(path, annotation)
    track.update(annotationPath=str(path), annotationHash=content_hash(path))
    with pytest.raises(ValueError, match="complete annotations"):
        observation(track)
    annotation["provenance"]["evidenceType"] = "pseudo_label"
    write_json(path, annotation)
    track["annotationHash"] = content_hash(path)
    with pytest.raises(ValueError, match="pseudo-label"):
        observation(track)


def test_training_never_reads_test_labels(corpus, tmp_path):
    invalid = tmp_path / "unread-test.json"
    invalid.write_text("not JSON", encoding="utf-8")
    path = changed_manifest(corpus, tmp_path, lambda d: [t.update(annotationPath=str(invalid)) for t in d["tracks"] if t["split"] == "test"])
    output = train(path, tmp_path / "another-model.json")
    previous = json.loads(corpus[1].read_text(encoding="utf-8"))
    new = json.loads(output.read_text(encoding="utf-8"))
    for field in ("mean", "scale", "weights", "thresholds", "fitting"):
        assert previous[field] == new[field]
    assert {t["split"] for t in new["fitting"]["tracks"]} == {"train", "validation"}


def test_model_integrity_and_unknown_confidence(corpus):
    model = json.loads(corpus[1].read_text(encoding="utf-8"))
    validate_model(model)
    broken = copy.deepcopy(model)
    broken["weights"][0][0] += 1
    with pytest.raises(ValueError, match="checksum"):
        validate_model(broken)
    dataset = load_dataset(corpus[0], "evaluation")
    audio, _ = observation(dataset["tracks"][-1])
    prediction, _ = predict(audio, model)
    assert prediction["events"] == []
    assert prediction["provenance"]["modelChecksum"] == model["modelChecksum"]
    assert prediction["provenance"]["evidenceType"] == "plexus_prediction"


def test_holdout_report_has_counts_and_rejects_fitted_track(corpus, tmp_path):
    output, report = benchmark(corpus[0], corpus[1], tmp_path / "report")
    assert (output / "report.md").is_file()
    assert len(report["tracks"]) == 3 and report["micro"]["referenceCount"] > 0
    assert report["tracks"][-1]["diagnostics"]["candidateCount"] == 0
    assert all(t["oracleEvidence"]["status"] == "not_available" for t in report["tracks"])
    with pytest.raises(ValueError, match="must be new"):
        benchmark(corpus[0], corpus[1], output)
    model = json.loads(corpus[1].read_text(encoding="utf-8"))
    test = load_dataset(corpus[0], "evaluation")["tracks"][-1]
    model["fitting"]["tracks"][0]["contentHash"] = test["contentHash"]
    model["modelChecksum"] = object_hash({k: v for k, v in model.items() if k != "modelChecksum"})
    path = tmp_path / "leaky-model.json"
    write_json(path, model)
    with pytest.raises(ValueError, match="Holdout leakage"):
        benchmark(corpus[0], path, tmp_path / "leaky-report")
    assert not (tmp_path / "leaky-report").exists()


def test_confusion_separates_overlap_and_source_errors():
    r = [{"class": "kick", "time": 1}, {"class": "snare", "time": 1}, {"class": "hihat", "time": 2}]
    e = [{"class": "kick", "time": 1}, {"class": "hihat", "time": 1}, {"class": "snare", "time": 3}]
    matrix = confusion(r, e)
    assert matrix["kick"]["kick"] == matrix["snare"]["hihat"] == matrix["hihat"]["missed"] == matrix["unmatched"]["snare"] == 1


def test_oracle_consensus_is_per_supported_class_and_never_truth(corpus, tmp_path):
    track = load_dataset(corpus[0], "evaluation")["tracks"][-2].copy()
    audio, truth = observation(track)
    paths = []
    for provider, classes in (("kick-oracle", ["kick"]), ("hat-oracle", ["hihat"])):
        value = copy.deepcopy(truth)
        value["provenance"].update(provider=provider, evidenceType="oracle_prediction")
        value["provenance"]["parameters"]["eventClasses"] = classes
        value["events"] = [e for e in value["events"] if e["class"] in classes]
        for event in value["events"]:
            event["provider"] = provider
        path = tmp_path / (provider + ".json")
        write_json(path, value)
        paths.append(str(path))
    track["oraclePaths"] = paths
    result = _oracles(track, audio.metadata, [])
    assert result["status"] == "available"
    assert result["consensus"]["groundTruthStatus"] is False
    assert all(e["agreement"] == 1 and e["evidenceType"] == "pseudo_label" for e in result["consensus"]["labels"])
    assert result["consensus"]["metrics"]["byClass"]["snare"]["status"] == "not_available"


def test_missing_optional_oracle_and_unsupported_drum_artifact_are_unavailable(corpus, tmp_path):
    track = load_dataset(corpus[0], "evaluation")["tracks"][-1].copy()
    audio, truth = observation(track)
    value = copy.deepcopy(truth)
    value["provenance"].update(provider="onset-only", evidenceType="oracle_prediction")
    value["provenance"]["parameters"]["eventClasses"] = ["onset"]
    path = tmp_path / "onsets.json"
    write_json(path, value)
    track["oraclePaths"] = [str(tmp_path / "absent.json"), str(path)]
    result = _oracles(track, audio.metadata, [])
    assert result["status"] == "not_available"
    assert result["unavailable"][0]["reason"] == "Optional oracle artifact missing"
    assert result["consensus"]["labels"] == []
