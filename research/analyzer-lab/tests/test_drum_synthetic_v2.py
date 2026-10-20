"""Corpus checks only: no classifier, fitting, thresholds, or holdout scores."""
from collections import Counter
import json

import numpy as np
import pytest

from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.drums.dataset import load_dataset, observation
from plexus_analyzer_lab.drums.synthetic_v2 import (
    PROVIDER, SPECIFICATION_HASH, VERSION, _specifications, generate_corpus_v2,
)


@pytest.fixture(scope="module")
def corpus(tmp_path_factory):
    path = generate_corpus_v2(tmp_path_factory.mktemp("v2-parent") / "corpus", sample_rate=16000)
    return path, load_dataset(path, "evaluation")


def annotation(path, track):
    return json.loads((path.parent / track["annotationPath"]).read_text(encoding="utf-8"))


def test_frozen_splits_negative_coverage_and_distinct_groups(corpus):
    path, dataset = corpus
    assert SPECIFICATION_HASH == "91543a11690523e81a8386aa622ab3b9cf9ed4ccdcbc699ba47fa0c37203acca"
    assert dataset["datasetId"] == "synthetic-drums-v2"
    assert Counter(t["split"] for t in dataset["tracks"]) == {"train": 12, "validation": 6, "test": 6}
    assert len({t["groupId"] for t in dataset["tracks"]}) == 24
    assert all(t["groupId"].startswith("independent-procedural-v2-") for t in dataset["tracks"])
    specifications = _specifications()
    assert sum(s["duration"] for s in specifications) == pytest.approx(205.0)
    assert {s["confound"] for s in specifications if s["split"] == "train" and s["pattern"] == "none"} == {
        "bass", "ramp", "tone", "dc", "quiet", "swell", "clap",
    }
    negatives = Counter()
    for track in dataset["tracks"]:
        audio, value = observation(track)
        assert 6 <= audio.metadata["duration"] <= 12
        assert np.isfinite(audio.samples).all()
        assert np.max(np.abs(audio.samples)) <= .920001
        assert value["provenance"]["toolVersion"] == VERSION
        assert value["provenance"]["provider"] == PROVIDER
        params = value["provenance"]["parameters"]
        assert params["groundTruthReviewed"] is True
        assert params["completeEventClasses"] == ["kick", "snare", "hihat"]
        assert params["generator"]["specificationHash"] == SPECIFICATION_HASH
        assert params["generator"]["truthScope"].startswith("sharedProceduralFamily:")
        if not value["events"]:
            negatives[track["split"]] += 1
    assert negatives == {"train": 7, "validation": 3, "test": 3}


def test_exact_scheduled_sample_clock_subclasses_overlap_and_velocities(corpus):
    path, dataset = corpus
    subclasses, velocities, intervals = set(), [], set()
    overlaps = 0
    for track in dataset["tracks"]:
        value = annotation(path, track)
        events = value["events"]
        scheduled = value["provenance"]["parameters"]["generator"]["scheduledEvents"]
        assert len(events) == len(scheduled)
        assert events == sorted(events, key=lambda e: (e["time"], e["class"]))
        assert len({(e["time"], e["class"]) for e in events}) == len(events)
        for event, expected in zip(events, scheduled):
            attrs = event["attributes"]
            assert event["time"] == attrs["sampleIndex"] / 16000
            assert event["time"] < value["metadata"]["duration"]
            assert attrs["sampleIndex"] == expected["sampleIndex"]
            assert event["class"] == attrs["generatorIdentity"] == expected["class"]
            assert event["confidence"] == 1  # Exact identity only, not recognizer calibration.
            assert attrs["velocityScalar"] == expected["velocityScalar"]
            subclasses.add(event["subclass"])
            velocities.append(attrs["velocityScalar"])
        times = sorted({e["time"] for e in events})
        intervals.update(round(t2 - t1, 4) for t1, t2 in zip(times, times[1:]))
        overlaps += sum(count > 1 for count in Counter(e["time"] for e in events).values())
    assert {"openLike", "closedLike", "tonalLike", "noisyLike", "pitchedDecay"} <= subclasses
    assert min(velocities) < .2 and max(velocities) > .95
    assert len(intervals) > 50 and overlaps > 20


def test_confounds_have_no_drum_labels_and_burst_negatives_are_audible(corpus):
    path, dataset = corpus
    for track in dataset["tracks"]:
        value = annotation(path, track)
        generator = value["provenance"]["parameters"]["generator"]
        if generator["specification"]["pattern"] != "none":
            continue
        assert value["events"] == []
        assert generator["scheduledEvents"] == []
        audio = load_audio(track["audioPath"], track["trackId"])
        mode = generator["specification"]["confound"]
        if mode in ("clap", "swellClap"):
            assert len(generator["confoundOnsetSampleIndices"]) > 5
            assert np.max(np.abs(np.diff(audio.samples))) > .08
        if mode == "quiet":
            assert 0 < np.max(np.abs(audio.samples)) < .0001
        if mode == "dc":
            assert np.max(audio.samples) == np.min(audio.samples) != 0


def test_identical_seed_reproduces_wave_bytes_and_events(corpus, tmp_path):
    original_path, dataset = corpus
    repeated_path = generate_corpus_v2(tmp_path / "repeated", sample_rate=16000)
    assert json.loads(original_path.read_text(encoding="utf-8")) == json.loads(repeated_path.read_text(encoding="utf-8"))
    for track in dataset["tracks"]:
        filename = track["trackId"] + ".wav"
        assert (original_path.parent / filename).read_bytes() == (repeated_path.parent / filename).read_bytes()
        original = annotation(original_path, track)
        repeated = annotation(repeated_path, track)
        original["provenance"].pop("timestamp")
        repeated["provenance"].pop("timestamp")
        assert original == repeated


def test_changed_seed_changes_stochastic_tracks_not_split_specification(corpus, tmp_path):
    _, original = corpus
    path = generate_corpus_v2(tmp_path / "other-seed", seed=20261011, sample_rate=16000)
    changed = load_dataset(path, "evaluation")
    assert [(t["trackId"], t["split"], t["groupId"]) for t in original["tracks"]] == [
        (t["trackId"], t["split"], t["groupId"]) for t in changed["tracks"]]
    stochastic = next(t for t in original["tracks"] if t["trackId"] == "v2-train-weak-overlap")
    new = next(t for t in changed["tracks"] if t["trackId"] == stochastic["trackId"])
    assert stochastic["contentHash"] != new["contentHash"]
    assert annotation(path, new)["provenance"]["parameters"]["generator"]["specificationHash"] == SPECIFICATION_HASH


@pytest.mark.parametrize("kwargs", [{"seed": True}, {"seed": -1}, {"seed": 2.5},
    {"sample_rate": True}, {"sample_rate": 15999}, {"sample_rate": 192001}, {"sample_rate": 22050.0}])
def test_invalid_parameters_fail_before_creation(tmp_path, kwargs):
    target = tmp_path / "invalid"
    with pytest.raises(ValueError):
        generate_corpus_v2(target, **kwargs)
    assert not target.exists()


def test_existing_directory_and_file_never_overwritten(tmp_path):
    target = tmp_path / "existing"
    target.mkdir()
    marker = target / "marker"
    marker.write_bytes(b"preserve")
    with pytest.raises(FileExistsError):
        generate_corpus_v2(target)
    assert marker.read_bytes() == b"preserve"
    existing_file = tmp_path / "file"
    existing_file.write_bytes(b"also preserve")
    with pytest.raises(FileExistsError):
        generate_corpus_v2(existing_file)
    assert existing_file.read_bytes() == b"also preserve"
