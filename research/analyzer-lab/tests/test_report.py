import json
import subprocess
import sys

from plexus_analyzer_lab.audio import synthetic
from plexus_analyzer_lab.config import load_config
from plexus_analyzer_lab.hashing import content_hash
from plexus_analyzer_lab.runner import analyze
from plexus_analyzer_lab.runner import benchmark
from plexus_analyzer_lab.reports.json_report import generate_report
from plexus_analyzer_lab.adapters.external_process import ExternalProcessAdapter
from plexus_analyzer_lab.adapters.base import ProviderFailure
from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.training.export import export_training

import pytest


def test_failure_isolation_and_report_immutability(tmp_path):
    path = tmp_path / "click.wav"
    synthetic(path, duration=2)
    run = analyze(path, runs_dir=tmp_path / "runs", providers=["librosa", "basic-pitch", "msaf"], enabled=["basic-pitch"])
    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["providers"]["librosa"]["status"] == "success"
    assert manifest["providers"]["basic-pitch"]["status"] == "unavailable"
    assert manifest["providers"]["msaf"]["status"] == "disabled"
    before = {p.name: content_hash(p) for p in run.iterdir() if p.name not in ("report.json", "report.md")}
    generate_report(run)
    assert before == {p.name: content_hash(p) for p in run.iterdir() if p.name not in ("report.json", "report.md")}
    assert "unavailable" in (run / "report.md").read_text(encoding="utf-8")
    with pytest.raises(ValueError, match=".jsonl"):
        export_training(run, run / "manifest.json")
    canonical_path = run / "librosa.canonical.json"
    canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    canonical["metadata"]["trackId"] = "wrong"
    canonical_path.write_text(json.dumps(canonical), encoding="utf-8")
    with pytest.raises(ValueError, match="identity"):
        generate_report(run)


@pytest.mark.parametrize("mode", ["nonzero", "malformed", "timeout", "wrong-path"])
def test_external_provider_failure_boundary(tmp_path, mode):
    path = tmp_path / "click.wav"
    synthetic(path, duration=1)
    script = tmp_path / "provider.py"
    code = {
        "nonzero": "import sys; print('model missing',file=sys.stderr);sys.exit(7)",
        "malformed": "print('not json')",
        "timeout": "import time; time.sleep(5)",
        "wrong-path": "import json; print(json.dumps({'resultPath':'elsewhere.json'}))",
    }[mode]
    script.write_text(code, encoding="utf-8")
    config = load_config()
    config["timeoutSeconds"] = 0.1 if mode == "timeout" else 5
    adapter = ExternalProcessAdapter("msaf", {"command": [sys.executable, str(script)]})
    with pytest.raises((ProviderFailure, json.JSONDecodeError)) as failure:
        adapter.analyze(load_audio(path), tmp_path, config, "fixed")
    if mode == "nonzero":
        assert failure.value.exit_code == 7
        assert "model missing" in failure.value.stderr
    assert not (tmp_path / "msaf.input.wav").exists()


def test_external_protocol_success_and_identity_failure_keep_diagnostics(tmp_path):
    path = tmp_path / "click.wav"
    synthetic(path, duration=1)
    script = tmp_path / "provider.py"
    script.write_text('''import json, sys
from plexus_analyzer_lab.canonical import empty_analysis
from plexus_analyzer_lab.provenance import provenance
request = json.load(sys.stdin)
metadata = request['metadata']
if '--wrong-identity' in sys.argv:
    metadata['trackId'] = 'wrong'
result = empty_analysis(metadata, provenance('msaf','test',{},'oracle_prediction',request['timestamp']))
with open(request['outputPath'],'w') as stream:
    json.dump(result,stream)
print('provider-diagnostic',file=sys.stderr)
print(json.dumps({'resultPath':request['outputPath']}))
''', encoding="utf-8")
    config = load_config()
    config["providers"]["msaf"] = {"command": [sys.executable, str(script)]}
    run = analyze(path, providers=["msaf"], config=config, runs_dir=tmp_path / "runs", enabled=["msaf"])
    outcome = json.loads((run / "manifest.json").read_text(encoding="utf-8"))["providers"]["msaf"]
    assert outcome["status"] == "success"
    assert outcome["exitCode"] == 0
    assert "provider-diagnostic" in outcome["stderr"]
    config["providers"]["msaf"]["command"].append("--wrong-identity")
    run = analyze(path, providers=["msaf"], config=config, runs_dir=tmp_path / "runs", enabled=["msaf"])
    outcome = json.loads((run / "manifest.json").read_text(encoding="utf-8"))["providers"]["msaf"]
    assert outcome["status"] == "failed"
    assert outcome["exitCode"] == 0
    assert "provider-diagnostic" in outcome["stderr"]


def test_benchmark_rejects_actual_content_leakage_without_supplied_hash(tmp_path):
    path = tmp_path / "click.wav"
    synthetic(path, duration=1)
    base = {"audio": "click.wav", "contentHash": None, "stems": [], "midi": None,
            "annotations": [], "license": "synthetic", "licenseSource": "generator", "allowedResearchUsage": "test", "tags": []}
    manifest = {"schemaVersion": "1.0.0", "datasetId": "test", "datasetVersion": "1",
                "tracks": [{**base, "trackId": "a", "split": "train"}, {**base, "trackId": "b", "split": "test"}]}
    file = tmp_path / "manifest.json"
    file.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="Actual audio content leakage"):
        benchmark(file, runs_dir=tmp_path / "runs")
    assert not (tmp_path / "runs").exists()
