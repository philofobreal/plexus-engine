"""Actual standard bridge/adapter opt-in and independent strict result-schema checks."""
from copy import deepcopy
import json
import subprocess

import pytest
from jsonschema import Draft202012Validator
from plexus_analyzer_lab.adapters.plexus import PlexusAdapter
from plexus_analyzer_lab.audio import load_audio, synthetic
from plexus_analyzer_lab.config import load_config, REPO_ROOT, LAB_ROOT


@pytest.fixture(scope="module")
def actual(tmp_path_factory):
    directory = tmp_path_factory.mktemp("event-timing-wire")
    source = directory / "track.wav"
    synthetic(source, kind="tone-click", duration=4)
    audio = load_audio(source)
    results = {}
    for name, mode in (("default", None), ("v1", "local-band-v1"), ("v2", "local-band-v2")):
        output = directory / name
        output.mkdir()
        config_path = directory / (name + ".json")
        config_path.write_text(json.dumps({"plexus": {"eventTiming": mode} if mode else {}}), encoding="utf-8")
        config = load_config(config_path)
        canonical = PlexusAdapter().analyze(audio, output, config, "fixed")
        results[name] = (json.loads((output / "plexus.raw.json").read_text()), canonical)
    return results


def validator():
    schema = json.loads((REPO_ROOT / "tests/fixtures/analyzer/analysis-result.schema.json").read_bytes())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_standard_adapter_accepts_both_explicit_modes_and_keeps_default_unchanged(actual):
    baseline = actual["default"][0]
    assert "eventTiming" not in baseline["trackAnalysis"]
    assert "eventTiming" not in load_config()["plexus"]
    assert baseline["events"]
    for name, algorithm in (("v1", "accepted-frame-band-timing-v1"), ("v2", "accepted-frame-band-timing-v2-dc1")):
        raw, canonical = actual[name]
        validator().validate(raw)
        report = raw["trackAnalysis"]["eventTiming"]
        assert report["algorithm"] == algorithm
        assert report["policy"] == "experimental-opt-in"
        assert len(report["observations"]) == len(raw["events"]) == len(baseline["events"])
        assert raw["beats"] == baseline["beats"] and raw["barStarts"] == baseline["barStarts"]
        assert canonical["provenance"]["parameters"]["eventTiming"] == "local-band-" + name
        assert [event["time"] for event in canonical["events"]] == [event["time"] for event in raw["events"]]
    validator().validate(baseline)


@pytest.mark.parametrize("mutation", ["algorithm", "policy", "clock", "count", "hop", "status", "support", "unknown", "missing", "refined-null", "ambiguous-count", "v1-gradual"])
def test_strict_schema_rejects_malformed_opt_in_reports(actual, mutation):
    raw = deepcopy(actual["v2"][0])
    report = raw["trackAnalysis"]["eventTiming"]
    point = report["observations"][0]
    if mutation == "algorithm": report["algorithm"] = "certain-onsets"
    elif mutation == "policy": report["policy"] = "default"
    elif mutation == "clock": report["sampleRate"] = 1
    elif mutation == "count": report["sampleCount"] = 0
    elif mutation == "hop": report["hopSize"] = 1000
    elif mutation == "status": point["status"] = "certain"
    elif mutation == "support": point["supportStartSample"] = -1
    elif mutation == "unknown": point["audibleTruth"] = True
    elif mutation == "refined-null": point.update(status="refined", sampleIndex=None, candidateCount=1)
    elif mutation == "ambiguous-count": point.update(status="ambiguous", sampleIndex=None, candidateCount=1)
    elif mutation == "v1-gradual":
        report["algorithm"] = "accepted-frame-band-timing-v1"
        point.update(status="gradual-attack", sampleIndex=None, candidateCount=1)
    else: del point["candidateCount"]
    assert list(validator().iter_errors(raw))


def test_historical_v2_identity_remains_schema_compatible(actual):
    raw = deepcopy(actual["v2"][0])
    raw["trackAnalysis"]["eventTiming"]["algorithm"] = "accepted-frame-band-timing-v2"
    validator().validate(raw)


@pytest.mark.parametrize("value", [None, True, 1, "", "v2", [], {}])
def test_config_rejects_non_enum_timing_modes(tmp_path, value):
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps({"plexus": {"eventTiming": value}}), encoding="utf-8")
    with pytest.raises(ValueError, match="plexus.eventTiming"):
        load_config(path)


@pytest.mark.parametrize("value", [None, True, 1, "v2"])
def test_bridge_rejects_invalid_mode_before_reading_pcm(tmp_path, value):
    request = {"sampleRate": 22050, "pcmPath": str(tmp_path / "not-read.f32le"), "options": {"eventTiming": value}}
    run = subprocess.run(["node", str(LAB_ROOT / "bridge/run-plexus-analysis.mjs")], input=json.dumps(request),
                         text=True, capture_output=True, cwd=REPO_ROOT)
    assert run.returncode != 0
    assert "Invalid analyzer option: eventTiming" in run.stderr
    assert "ENOENT" not in run.stderr
