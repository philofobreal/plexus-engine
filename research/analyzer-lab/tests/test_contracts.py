from copy import deepcopy

import pytest

from plexus_analyzer_lab.canonical import empty_analysis
from plexus_analyzer_lab.contracts import schema, validate
from plexus_analyzer_lab.provenance import provenance
from plexus_analyzer_lab.config import LAB_ROOT
import json


@pytest.fixture
def canonical():
    return empty_analysis({"trackId": "click", "contentHash": "a" * 64, "duration": 2, "sampleRate": 22050},
                          provenance("librosa", "0.11.0", {}, "oracle_prediction", "2026-10-10T00:00:00Z"))


def test_schema_contracts_compile():
    for kind in ("canonical-analysis", "dataset-manifest", "run-manifest", "benchmark-report", "training-example"):
        schema(kind)
    validate(json.loads((LAB_ROOT / "fixtures/expected/empty-librosa.json").read_text(encoding="utf-8")))
    validate(json.loads((LAB_ROOT / "fixtures/manifests/slakh-like.example.json").read_text(encoding="utf-8")), "dataset-manifest")


def test_optional_outputs_retain_unavailable(canonical):
    validate(canonical)
    assert canonical["notes"] is None
    assert canonical["timing"]["beats"] is None
    canonical["timing"]["beats"] = []
    validate(canonical)


@pytest.mark.parametrize("change", ["nan", "confidence", "time-order", "time-bound", "pitch-length", "negative-note", "bars", "evidence"])
def test_invalid_contracts_are_rejected(canonical, change):
    if change == "nan":
        canonical["metadata"]["duration"] = float("nan")
    elif change == "confidence":
        canonical["confidence"] = {"tempo": 1.01}
    elif change == "time-order":
        canonical["timing"]["beats"] = [1, 0.5]
    elif change == "time-bound":
        canonical["events"] = [{"time": 2.1, "class": "onset", "confidence": None, "provider": "librosa"}]
    elif change == "pitch-length":
        canonical["pitchTracks"] = [{"times": [0, 1], "frequenciesHz": [220], "voicing": [True, True], "confidence": [None, None]}]
    elif change == "negative-note":
        canonical["notes"] = [{"start": 1, "end": 0.5, "midiPitch": 60, "confidence": None}]
    elif change == "bars":
        canonical["timing"]["bars"] = [{"start": 1, "end": 3}]
    else:
        canonical["provenance"]["evidenceType"] = "truth-from-oracle"
    with pytest.raises(Exception):
        validate(canonical)


def test_empty_factory_has_no_shared_mutable_outputs(canonical):
    second = deepcopy(canonical)
    second["tags"].append("changed")
    assert canonical["tags"] == []
