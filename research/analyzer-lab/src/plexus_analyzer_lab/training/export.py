"""Deterministic JSONL linking unchanged production features to pseudo-labels."""

from copy import deepcopy
import json
from math import isfinite
from pathlib import Path

from ..datasets.splits import split_track
from ..labels.consensus import consensus


def _read(path):
    with Path(path).open(encoding="utf-8") as stream:
        return json.load(stream)


def _artifact(run_dir, reference):
    path = (run_dir / reference).resolve()
    if not path.is_relative_to(run_dir.resolve()):
        raise ValueError("Run artifacts must be inside their run directory")
    return path


def export_training(run_dir, output, config=None):
    """Export positive onset windows; unknown windows are never negative labels.

    Only successful canonical oracle_prediction results vote. Every example's
    features are copied directly from the existing Plexus raw frames, timed by
    the production hop/sample-rate clock. This exports no ground-truth claims.
    """
    from ..contracts import validate

    run_dir, output = Path(run_dir), Path(output)
    if output.suffix.lower() != ".jsonl":
        raise ValueError("Training output must be a .jsonl file; measurement JSON artifacts must not be overwritten")
    manifest = _read(run_dir / "manifest.json")
    options = {**manifest.get("config", {}), **(config or {})}
    providers = manifest.get("providers", {})
    diagnostics = []
    plexus = providers.get("plexus", {})
    if plexus.get("status") != "success" or not plexus.get("raw"):
        diagnostics.append("No successful Plexus raw feature output is available")
        frames, raw = [], {}
    elif not _artifact(run_dir, plexus["raw"]).is_file():
        diagnostics.append("Plexus raw feature artifact is missing")
        frames, raw = [], {}
    else:
        raw = _read(_artifact(run_dir, plexus["raw"]))
        frames = raw.get("frames", [])
        if not frames:
            diagnostics.append("Plexus raw output has no feature frames")
    events_by_provider, provenance_by_provider = {}, {}
    track = manifest["track"]
    for provider_id, entry in sorted(providers.items()):
        if provider_id == "plexus" or entry.get("status") != "success" or not entry.get("canonical"):
            continue
        canonical_path = _artifact(run_dir, entry["canonical"])
        if not canonical_path.is_file():
            diagnostics.append(f"Oracle {provider_id} canonical artifact is missing")
            continue
        canonical = _read(canonical_path)
        validate(canonical, "canonical-analysis")
        if canonical["provenance"]["evidenceType"] != "oracle_prediction":
            continue
        if canonical["metadata"]["trackId"] != track["trackId"] or canonical["metadata"]["contentHash"] != track["contentHash"]:
            raise ValueError(f"Oracle {provider_id} does not match the run track/content identity")
        events = canonical.get("events")
        declared_classes = canonical["provenance"].get("parameters", {}).get("eventClasses")
        onset_supported = ("onset" in declared_classes if declared_classes is not None else
                           canonical["provenance"]["provider"] == "librosa" or
                           any(event["class"] == "onset" for event in events or []))
        if events is not None and not onset_supported:
            diagnostics.append(f"Oracle {provider_id} onset capability is unsupported or undeclared")
            continue
        events_by_provider[provider_id] = None if events is None else [event for event in events if event["class"] == "onset"]
        provenance_by_provider[provider_id] = deepcopy(canonical["provenance"])
    labels = consensus(events_by_provider, options.get("consensusTolerance", 0.05), options.get("minimumAgreement", 0.5))
    if not labels:
        diagnostics.append("No eligible oracle onset consensus evidence; unknown targets are not fabricated")
    sample_rate = raw.get("sampleRate", track.get("sampleRate"))
    hop_size = raw.get("hopSize")
    duration = track.get("duration", raw.get("duration"))
    if frames and labels and (not isinstance(sample_rate, (int, float)) or not isfinite(sample_rate) or sample_rate <= 0
                   or not isinstance(hop_size, (int, float)) or not isfinite(hop_size) or hop_size <= 0
                   or not isinstance(duration, (int, float)) or not isfinite(duration) or duration < 0):
        raise ValueError("Feature export requires a positive sample rate/hop size and finite duration")
    # Established dataset partitions take precedence; repartitioning an official
    # held-out test set would undermine its independence from future training.
    split = (manifest.get("dataset") or {}).get("split") or split_track(track["trackId"], options.get("seed", 17))
    if split not in ("train", "validation", "test"):
        raise ValueError("Dataset split must be train, validation, or test")
    examples = []
    label_index = 0
    for index, frame in enumerate(frames if labels else []):
        start, end = index * hop_size / sample_rate, min((index + 1) * hop_size / sample_rate, duration)
        if start >= end:
            break
        while label_index < len(labels) and labels[label_index]["time"] < start:
            label_index += 1
        window_labels = []
        while label_index < len(labels) and labels[label_index]["time"] < end:
            window_labels.append(labels[label_index])
            label_index += 1
        for label in window_labels:
            target_provenance = deepcopy(label["targetProvenance"])
            target_provenance["providers"] = {vote["provider"]: provenance_by_provider[vote["provider"]] for vote in label["votes"]}
            target_provenance["trackId"] = track["trackId"]
            target_provenance["contentHash"] = track["contentHash"]
            example = {
                "schemaVersion": "1.0.0", "trackId": track["trackId"], "contentHash": track["contentHash"],
                "start": start, "end": end, "features": deepcopy(frame), "targetLabel": label["class"],
                "targetProvenance": target_provenance, "oracleAgreement": label["agreement"],
                "groundTruthStatus": False, "confidence": label["confidence"], "split": split,
            }
            validate(example, "training-example")
            examples.append(example)
    if labels and frames and not examples:
        diagnostics.append("Oracle onset evidence does not intersect an available production feature window")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="\n") as stream:
        for example in examples:
            stream.write(json.dumps(example, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
    return {"count": len(examples), "output": str(output), "split": split, "diagnostics": diagnostics}
