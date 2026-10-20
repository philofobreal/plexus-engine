"""Train/validation/test workflow with immutable model and canonical predictions."""
import json
from pathlib import Path

import numpy as np
from mir_eval.util import match_events

from ..contracts import validate
from ..hashing import content_hash, object_hash
from ..labels.consensus import consensus
from ..metrics.events import compare_events, event_metrics
from ..provenance import environment, timestamp
from ..reports.json_report import write_json
from ..runner import source_fingerprint
from . import CLASSES, VERSION
from .classifier import MATCH_TOLERANCE, fit, predict, scores, targets, tune, validate_model
from .dataset import load_dataset, observation, signature, verify_identity
from .features import extract


def train(manifest_path, output_path, ridge=1.0, algorithm="v1"):
    output = Path(output_path).resolve()
    if output.suffix != ".json" or output.exists():
        raise ValueError("Drum model output must be a new .json file")
    if algorithm not in ("v1", "v2"):
        raise ValueError("Unknown drum algorithm")
    extractor = extract
    if algorithm == "v2":
        if ridge != 1.0:
            raise ValueError("Drum v2 selects ridge from its frozen validation grid; do not supply --ridge")
        from .features_v2 import extract as extractor
    dataset = load_dataset(manifest_path, "training")
    training = [t for t in dataset["tracks"] if t["split"] == "train"]
    validation = [t for t in dataset["tracks"] if t["split"] == "validation"]
    if not training or not validation:
        raise ValueError("Drum fitting requires separate train and validation tracks")
    features, labels, held_validation, coverage, origins = [], [], [], {}, {}
    for track in training + validation:
        audio, annotation = observation(track)
        times, rows = extractor(audio.samples, audio.sample_rate)
        coverage[track["trackId"]] = event_metrics(sorted({e["time"] for e in annotation["events"]}),
                                                  times.tolist(), MATCH_TOLERANCE)
        origins[track["trackId"]] = annotation["provenance"]
        if track["split"] == "train":
            features.append(rows)
            labels.append(targets(times, annotation["events"]))
        else:
            held_validation.append((times, rows, annotation["events"]))
    if algorithm == "v2":
        from .classifier_v2 import select_model
        model = select_model(np.concatenate(features), np.concatenate(labels), held_validation)
    else:
        model = fit(np.concatenate(features), np.concatenate(labels), ridge)
        tune(model, [(times, scores(model, rows), events) for times, rows, events in held_validation])
    model.update(fitting={"datasetId": dataset["datasetId"], "rights": dataset["rights"],
                          "tracks": [signature(t) for t in training + validation],
                          "annotationProvenance": origins, "candidateCoverage": coverage,
                          "trainingCandidates": sum(len(f) for f in features)},
                 environment=environment(), sourceHash=source_fingerprint(), timestamp=timestamp())
    model["modelChecksum"] = object_hash(model)
    validate_model(model)
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json(output, model)
    return output


def _micro(metrics):
    truth = sum(m.get("referenceCount", 0) for m in metrics)
    predicted = sum(m.get("estimatedCount", 0) for m in metrics)
    matched = sum(m.get("matchedCount", 0) for m in metrics)
    if not truth and not predicted:
        return {"status": "not_available", "reason": "Both counts empty; no perfect-score convention",
                "referenceCount": 0, "estimatedCount": 0, "matchedCount": 0}
    return {"status": "available", "referenceCount": truth, "estimatedCount": predicted, "matchedCount": matched,
            "precision": matched / predicted if predicted else 0, "recall": matched / truth if truth else 0,
            "fMeasure": 2 * matched / (truth + predicted)}


def confusion(reference, estimated):
    """Match correct classes first; then attribute remaining timing-aligned errors.

    Rows=reference, columns=prediction. Simultaneous classes stay distinct.
    Cross-class errors are diagnostic counts, not probabilities or unique truth.
    """
    matrix = {k: {c: 0 for c in (*CLASSES, "missed")} for k in (*CLASSES, "unmatched")}
    unused_r, unused_e = set(range(len(reference))), set(range(len(estimated)))
    for kind in CLASSES:
        ri = [i for i in sorted(unused_r) if reference[i]["class"] == kind]
        ei = [i for i in sorted(unused_e) if estimated[i]["class"] == kind]
        pairs = match_events(np.array([reference[i]["time"] for i in ri]),
                             np.array([estimated[i]["time"] for i in ei]), MATCH_TOLERANCE) if ri and ei else []
        for r, e in pairs:
            matrix[kind][kind] += 1
            unused_r.remove(ri[r])
            unused_e.remove(ei[e])
    ri, ei = sorted(unused_r), sorted(unused_e)
    pairs = match_events(np.array([reference[i]["time"] for i in ri]),
                         np.array([estimated[i]["time"] for i in ei]), MATCH_TOLERANCE) if ri and ei else []
    for r, e in pairs:
        matrix[reference[ri[r]]["class"]][estimated[ei[e]]["class"]] += 1
        unused_r.remove(ri[r])
        unused_e.remove(ei[e])
    for r in unused_r:
        matrix[reference[r]["class"]]["missed"] += 1
    for e in unused_e:
        matrix["unmatched"][estimated[e]["class"]] += 1
    return matrix


def _oracles(track, metadata, estimated):
    results, provenance_by_id, unavailable = {}, {}, []
    for path in track.get("oraclePaths", []):
        if not Path(path).is_file():
            unavailable.append({"path": str(path), "status": "not_available", "reason": "Optional oracle artifact missing"})
            continue
        oracle = validate(json.loads(Path(path).read_text(encoding="utf-8")))
        verify_identity(oracle, metadata)
        provider = oracle["provenance"]["provider"]
        if provider in results or oracle["provenance"]["evidenceType"] != "oracle_prediction":
            raise ValueError("Oracle references must have unique provider identities and oracle_prediction evidence")
        supported = oracle["provenance"]["parameters"].get("eventClasses", [])
        if any(e["provider"] != provider or e["class"] not in supported for e in oracle["events"] or []):
            raise ValueError("Oracle event provider/class differs from declared provenance")
        results[provider] = oracle
        provenance_by_id[provider] = {"provenance": oracle["provenance"], "artifactHash": content_hash(path)}
    labels = []
    for kind in CLASSES:
        eligible = {p: [e for e in r["events"] if e["class"] == kind] for p, r in results.items()
                    if r["events"] is not None and kind in r["provenance"]["parameters"].get("eventClasses", [])}
        labels += consensus(eligible, MATCH_TOLERANCE, 0.5)
    supported = sorted({k for r in results.values() for k in r["provenance"]["parameters"].get("eventClasses", [])
                        if r["events"] is not None and k in CLASSES})
    return {"status": "available" if supported else "not_available", "providers": provenance_by_id,
            "unavailable": unavailable,
            "comparisons": {p: compare_events(r["events"], estimated, MATCH_TOLERANCE,
                             r["provenance"]["parameters"].get("eventClasses", []), CLASSES)
                            for p, r in results.items()},
            "consensus": {"evidenceType": "pseudo_label", "groundTruthStatus": False, "labels": labels,
                          "metrics": compare_events(labels, estimated, MATCH_TOLERANCE, supported, CLASSES)}}


def benchmark(manifest_path, model_path, output_dir):
    output = Path(output_dir).resolve()
    if output.exists():
        raise ValueError("Drum benchmark output directory must be new")
    model = validate_model(json.loads(Path(model_path).read_text(encoding="utf-8")))
    dataset = load_dataset(manifest_path, "evaluation")
    tests = [t for t in dataset["tracks"] if t["split"] == "test"]
    if not tests:
        raise ValueError("Drum benchmark requires test tracks")
    fitted = model["fitting"]["tracks"]
    for track in tests:
        for field in ("trackId", "groupId", "contentHash"):
            if track[field] in {t[field] for t in fitted}:
                raise ValueError(f"Holdout leakage against model {field}")
    # Preflight every annotation and oracle identity before creating artifacts.
    for track in tests:
        audio, annotation = observation(track)
        _oracles(track, audio.metadata, [])
    del audio, annotation
    output.mkdir(parents=True, exist_ok=False)
    report = {"schemaVersion": VERSION, "modelChecksum": model["modelChecksum"],
              "modelFileHash": content_hash(model_path), "datasetId": dataset["datasetId"],
              "manifestHash": dataset["manifestHash"], "rights": dataset["rights"], "timestamp": timestamp(),
              "environment": environment(), "sourceHash": source_fingerprint(), "split": "test",
              "tolerance": MATCH_TOLERANCE, "tracks": [],
              "interpretation": "Research drum baseline; generator truth evaluates only procedural identities. "
                                "Human annotations retain their evidence type. Oracle consensus is never ground truth. "
                                "Scores are uncalibrated evidence. No production classifier integration."}
    for index, track in enumerate(tests):
        audio, annotation = observation(track)
        canonical, diagnostics = predict(audio, model)
        name = f"track-{index:04d}.canonical.json"
        write_json(output / name, canonical)
        reference, estimated = annotation["events"], canonical["events"]
        report["tracks"].append({**signature(track), "canonical": name,
            "referenceProvenance": annotation["provenance"], "metrics": compare_events(reference, estimated, MATCH_TOLERANCE, CLASSES, CLASSES),
            "confusion": confusion(reference, estimated), "diagnostics": diagnostics,
            "oracleEvidence": _oracles(track, audio.metadata, estimated)})
    report["byClass"] = {kind: _micro([t["metrics"]["byClass"][kind] for t in report["tracks"]]) for kind in CLASSES}
    report["micro"] = _micro(list(report["byClass"].values()))
    report["reproducibilityHash"] = object_hash({k: v for k, v in report.items() if k not in ("timestamp", "tracks")}
                                               | {"tracks": [{k: v for k, v in t.items() if k != "canonical"} for t in report["tracks"]]})
    write_json(output / "report.json", report)
    lines = ["# P0 drum research benchmark", "", report["interpretation"], "",
             "| Class | Reference | Predicted | Matched | Precision | Recall | F |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for kind, metric in report["byClass"].items():
        fields = [str(metric[k]) for k in ("referenceCount", "estimatedCount", "matchedCount")]
        fields += [f"{metric[k]:.4f}" if k in metric else "unavailable" for k in ("precision", "recall", "fMeasure")]
        lines.append(f"| {kind} | " + " | ".join(fields) + " |")
    lines += ["", "Test tracks: " + str(len(tests)), "", "Per-track timing error, confusion, silence false hits, annotation provenance and optional oracle evidence are in report.json.", ""]
    (output / "report.md").write_text("\n".join(lines), encoding="utf-8")
    return output, report
