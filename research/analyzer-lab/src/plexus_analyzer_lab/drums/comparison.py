"""Paired frozen-model measurements, never model selection on test outcomes."""
from pathlib import Path

from ..reports.json_report import write_json
from . import CLASSES
from .experiment import benchmark


def compare_models(manifest, baseline_model, candidate_model, output_dir):
    output = Path(output_dir).resolve()
    if output.exists():
        raise ValueError("Paired drum comparison output directory must be new")
    output.mkdir(parents=True, exist_ok=False)
    _, baseline = benchmark(manifest, baseline_model, output / "baseline")
    _, candidate = benchmark(manifest, candidate_model, output / "candidate")
    for key in ("sourceHash", "environment", "split", "tolerance"):
        if baseline[key] != candidate[key]:
            raise ValueError(f"Paired comparison measurement protocol differs: {key}")
    before = {t["trackId"]: t for t in baseline["tracks"]}
    after = {t["trackId"]: t for t in candidate["tracks"]}
    if before.keys() != after.keys() or baseline["manifestHash"] != candidate["manifestHash"]:
        raise ValueError("Paired comparison dataset identity differs")
    for track_id in before:
        if before[track_id]["contentHash"] != after[track_id]["contentHash"] or before[track_id]["annotationHash"] != after[track_id]["annotationHash"]:
            raise ValueError("Paired comparison source/annotation changed")
    by_class = {}
    for kind in (*CLASSES, "micro"):
        a = baseline["micro"] if kind == "micro" else baseline["byClass"][kind]
        b = candidate["micro"] if kind == "micro" else candidate["byClass"][kind]
        by_class[kind] = {"baseline": a, "candidate": b,
            "fMeasureDelta": b["fMeasure"] - a["fMeasure"] if "fMeasure" in a and "fMeasure" in b else None,
            "baselineFalsePositiveCount": a["estimatedCount"] - a["matchedCount"],
            "candidateFalsePositiveCount": b["estimatedCount"] - b["matchedCount"],
            "baselineMissedCount": a["referenceCount"] - a["matchedCount"],
            "candidateMissedCount": b["referenceCount"] - b["matchedCount"]}
    report = {"schemaVersion": "1.0.0", "datasetId": baseline["datasetId"], "manifestHash": baseline["manifestHash"],
              "baselineModelChecksum": baseline["modelChecksum"], "candidateModelChecksum": candidate["modelChecksum"],
              "baselineReproducibilityHash": baseline["reproducibilityHash"],
              "candidateReproducibilityHash": candidate["reproducibilityHash"], "byClass": by_class,
              "measurementProtocol": {k: baseline[k] for k in ("sourceHash", "environment", "split", "tolerance")},
              "interpretation": "Paired test measurements of models frozen before evaluation. "
                                "Synthetic identities do not establish real-drum generalization; reports preserve regressions."}
    write_json(output / "comparison.json", report)
    lines = ["# Paired drum model comparison", "", report["interpretation"], "",
             "| Class | Baseline F | Candidate F | Delta F | False positives before/after | Missed before/after |",
             "| --- | --- | --- | --- | --- | --- |"]
    for kind, item in by_class.items():
        a, b = item["baseline"], item["candidate"]
        if item["fMeasureDelta"] is None:
            values = "unavailable | unavailable | unavailable"
        else:
            values = f"{a['fMeasure']:.4f} | {b['fMeasure']:.4f} | {item['fMeasureDelta']:+.4f}"
        lines.append(f"| {kind} | {values} | {item['baselineFalsePositiveCount']}/{item['candidateFalsePositiveCount']} | {item['baselineMissedCount']}/{item['candidateMissedCount']} |")
    lines += ["", "See baseline/report.json and candidate/report.json for per-track provenance, confusion, timing error, unavailable oracle diagnostics and canonical predictions.", ""]
    (output / "comparison.md").write_text("\n".join(lines), encoding="utf-8")
    return output, report
