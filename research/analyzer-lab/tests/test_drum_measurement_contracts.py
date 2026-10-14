import copy

import pytest

from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.canonical import empty_analysis
from plexus_analyzer_lab.drums import comparison, references
from plexus_analyzer_lab.drums.synthetic_v2 import generate_corpus_v2
from plexus_analyzer_lab.provenance import provenance
from plexus_analyzer_lab.reports.json_report import write_json


@pytest.fixture(scope="module")
def corpus(tmp_path_factory):
    return generate_corpus_v2(tmp_path_factory.mktemp("reference-contract") / "corpus", sample_rate=16000)


@pytest.mark.parametrize("field", ["sourceHash", "environment", "split", "tolerance"])
def test_paired_models_reject_different_measurement_protocol(field, monkeypatch, tmp_path):
    baseline = {"sourceHash": "a" * 64, "environment": {"numpy": "1"}, "split": "test", "tolerance": .05}
    candidate = {**baseline, field: "changed"}
    reports = iter([baseline, candidate])
    monkeypatch.setattr(comparison, "benchmark", lambda *a: (None, next(reports)))
    with pytest.raises(ValueError, match="measurement protocol differs"):
        comparison.compare_models("manifest", "baseline", "candidate", tmp_path / "comparison")
    assert not (tmp_path / "comparison" / "comparison.json").exists()


def fake_runner(tmp_path, change=None):
    def analyze(path, *, track_id, runs_dir, **kwargs):
        audio = load_audio(path, track_id)
        run = runs_dir / track_id
        run.mkdir(parents=True)
        manifest = {"schemaVersion": "1.0.0", "runId": "a" * 64, "reproducibilityHash": "b" * 64,
                    "track": audio.metadata, "configHash": "c" * 64, "config": {}, "plexusCommit": None,
                    "timestamp": "fixture", "schemaVersions": {}, "environment": {"sourceHash": "d" * 64},
                    "randomSeeds": {}, "dataset": None, "providers": {}}
        for provider in ("plexus", "librosa"):
            kind = "plexus_prediction" if provider == "plexus" else "oracle_prediction"
            canonical = empty_analysis(audio.metadata, provenance(provider, "fixture", {}, kind, "fixture"))
            canonical["events"] = []
            if change:
                change(manifest, canonical, provider)
            write_json(run / f"{provider}.json", canonical)
            manifest["providers"][provider] = {"status": "success", "canonical": f"{provider}.json"}
        write_json(run / "manifest.json", manifest)
        return run
    return analyze


@pytest.mark.parametrize("target", ["manifest", "canonical", "provider"])
def test_reference_rejects_stale_audio_and_provider_identity(corpus, tmp_path, monkeypatch, target):
    def change(manifest, canonical, provider):
        if target == "manifest":
            manifest["track"] = {**manifest["track"], "contentHash": "e" * 64}
        elif target == "canonical":
            canonical["metadata"] = {**canonical["metadata"], "duration": canonical["metadata"]["duration"] + 1}
        else:
            canonical["provenance"]["provider"] = "other-provider"
    monkeypatch.setattr(references, "analyze", fake_runner(tmp_path, change))
    with pytest.raises(ValueError, match="identity mismatch|provider identity differs"):
        references.benchmark_references(corpus, tmp_path / "report")
    assert not (tmp_path / "report" / "report.json").exists()


def test_reference_unsupported_events_are_partial_not_empty_success(corpus, tmp_path, monkeypatch):
    def change(manifest, canonical, provider):
        if provider == "librosa":
            canonical["events"] = None
    monkeypatch.setattr(references, "analyze", fake_runner(tmp_path, change))
    _, report = references.benchmark_references(corpus, tmp_path / "report")
    assert report["partial"] is True
    assert report["coverage"]["librosa"] == {"availableTracks": 0, "requestedTracks": 6}
    assert report["coverage"]["plexus"] == {"availableTracks": 6, "requestedTracks": 6}
    assert report["byProvider"]["librosa"]["status"] == "not_available"


@pytest.mark.parametrize("invalid", [[-1], [16000 * 100], [True], [1.5]])
def test_reference_rejects_invalid_confound_sample_clock(corpus, tmp_path, monkeypatch, invalid):
    original = references.observation
    def changed(track):
        audio, annotation = original(track)
        annotation = copy.deepcopy(annotation)
        annotation["provenance"]["parameters"]["generator"]["confoundOnsetSampleIndices"] = invalid
        return audio, annotation
    monkeypatch.setattr(references, "observation", changed)
    with pytest.raises(ValueError, match="bounded sample indices"):
        references.benchmark_references(corpus, tmp_path / "report")
    assert not (tmp_path / "report").exists()
