import json
from pathlib import Path

from ..contracts import SCHEMA_VERSION, validate
from ..metrics.timing import compare


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")


def build_report(run_dir):
    run_dir = Path(run_dir)
    manifest = validate(json.loads((run_dir / "manifest.json").read_text(encoding="utf-8")), "run-manifest")
    results = {}
    for provider, entry in manifest["providers"].items():
        if entry["status"] == "success":
            path = (run_dir / entry["canonical"]).resolve()
            if not path.is_relative_to(run_dir.resolve()):
                raise ValueError("Canonical artifact must remain inside its run")
            result = validate(json.loads(path.read_text(encoding="utf-8")))
            if result["metadata"] != manifest["track"] or result["provenance"]["provider"] != provider:
                raise ValueError("Canonical artifact identity does not match its run manifest")
            results[provider] = result
    comparisons = []
    if "plexus" in results:
        for provider, oracle in results.items():
            if provider == "plexus":
                continue
            measurement = compare(results["plexus"], oracle, manifest["config"])
            metrics = {k: v for k, v in measurement.items() if isinstance(v, dict) and "status" in v}
            metrics.update({f"metadata.{k}": v for k, v in measurement.get("metadata", {}).items()})
            # Per-class event metrics remain explicit, independently available.
            metrics.update({f"events.{k}": v for k, v in measurement.get("events", {}).get("byClass", {}).items()})
            comparisons.append({"provider": "plexus", "referenceProvider": provider,
                                "evidenceOnly": True, "metrics": metrics})
    report = {"schemaVersion": SCHEMA_VERSION, "runId": manifest["runId"], "track": manifest["track"],
              "providers": manifest["providers"], "comparisons": comparisons,
              "interpretation": "Differential evidence only. Oracle predictions are not ground truth. "
                                "Plexus onset evidence is grid-gated visual impact, not drum transcription."}
    return validate(report, "benchmark-report")


def generate_report(run_dir):
    from .markdown_report import render_markdown

    report = build_report(run_dir)
    write_json(Path(run_dir) / "report.json", report)
    (Path(run_dir) / "report.md").write_text(render_markdown(report), encoding="utf-8")
    return report
