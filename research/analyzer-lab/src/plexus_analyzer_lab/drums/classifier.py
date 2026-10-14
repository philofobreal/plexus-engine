"""Original multi-label, class-balanced ridge baseline; scores are not probabilities."""
import numpy as np

from ..canonical import empty_analysis
from ..contracts import validate
from ..hashing import object_hash
from ..metrics.events import event_metrics
from ..provenance import provenance, timestamp
from . import CLASSES, VERSION
from .features import FEATURE_NAMES, FEATURE_VERSION, extract

LABEL_TOLERANCE = 0.03
MATCH_TOLERANCE = 0.05
MIN_SEPARATION = 0.05
THRESHOLDS = tuple(np.linspace(-0.25, 1.5, 36))


def targets(times, events):
    labels = np.zeros((len(times), len(CLASSES)))
    for column, kind in enumerate(CLASSES):
        for event in events:
            if event["class"] == kind and len(times):
                nearest = int(np.argmin(abs(times - event["time"])))
                if abs(times[nearest] - event["time"]) <= LABEL_TOLERANCE:
                    labels[nearest, column] = 1
    return labels


def fit(features, labels, ridge=1.0):
    if ridge <= 0 or not np.isfinite(ridge):
        raise ValueError("Ridge penalty must be finite and positive")
    if not len(features):
        raise ValueError("Training audio supplied no transient candidates")
    mean, scale = features.mean(axis=0), features.std(axis=0)
    scale = np.maximum(scale, 1e-8)
    design = np.column_stack((np.ones(len(features)), (features - mean) / scale))
    weights = []
    for column, kind in enumerate(CLASSES):
        y = labels[:, column]
        count = int(y.sum())
        if count == 0 or count == len(y):
            raise ValueError(f"Training must have detected positive and complete negative examples for {kind}")
        balance = np.where(y == 1, len(y) / (2 * count), len(y) / (2 * (len(y) - count)))
        penalty = np.eye(design.shape[1]) * ridge
        penalty[0, 0] = 0
        weights.append(np.linalg.solve(design.T @ (balance[:, None] * design) + penalty,
                                       design.T @ (balance * y)))
    return {"schemaVersion": VERSION, "algorithm": "plexus-drum-ridge-v1", "classes": list(CLASSES),
            "featureVersion": FEATURE_VERSION, "featureNames": list(FEATURE_NAMES),
            "mean": mean.tolist(), "scale": scale.tolist(), "weights": np.array(weights).T.tolist(),
            "thresholds": [0.5] * len(CLASSES), "ridge": ridge,
            "labelTolerance": LABEL_TOLERANCE, "matchTolerance": MATCH_TOLERANCE,
            "minSeparation": MIN_SEPARATION, "scoreMeaning": "Uncalibrated ridge evidence; not probability"}


def scores(model, features):
    design = np.column_stack((np.ones(len(features)), (features - model["mean"]) / model["scale"]))
    return design @ np.asarray(model["weights"])


def select_events(times, values, thresholds, min_separation=MIN_SEPARATION):
    events = []
    for column, kind in enumerate(CLASSES):
        chosen = []
        for index in sorted(np.flatnonzero(values[:, column] >= thresholds[column]),
                            key=lambda i: (-values[i, column], times[i])):
            if all(abs(times[index] - times[other]) >= min_separation for other in chosen):
                chosen.append(index)
        events.extend({"time": float(times[i]), "class": kind, "confidence": None, "provider": "plexus-drum-research",
                       "attributes": {"evidenceScore": float(values[i, column]), "scoreMeaning": "uncalibrated ridge"}}
                      for i in chosen)
    return sorted(events, key=lambda e: (e["time"], e["class"]))


def tune(model, validation):
    """Threshold-only tuning on validation events; no fit to validation features."""
    diagnostics = {}
    for column, kind in enumerate(CLASSES):
        best = None
        for threshold in THRESHOLDS:
            thresholds = [float("inf")] * len(CLASSES)
            thresholds[column] = float(threshold)
            tp = predicted = truth = 0
            for times, values, events in validation:
                selected = select_events(times, values, thresholds)
                metric = event_metrics([e["time"] for e in events if e["class"] == kind],
                                       [e["time"] for e in selected if e["class"] == kind], MATCH_TOLERANCE)
                tp += metric.get("matchedCount", 0)
                predicted += metric.get("estimatedCount", 0)
                truth += metric.get("referenceCount", 0)
            if truth == 0:
                raise ValueError(f"Validation must include positive {kind} events")
            precision = tp / predicted if predicted else 0
            recall = tp / truth
            f = 2 * tp / (predicted + truth) if predicted + truth else 0
            candidate = (f, precision, float(threshold), recall, tp, predicted, truth)
            if best is None or candidate[:3] > best[:3]:
                best = candidate
        model["thresholds"][column] = best[2]
        diagnostics[kind] = dict(zip(("fMeasure", "precision", "threshold", "recall", "matchedCount", "estimatedCount", "referenceCount"), best))
    model["validationSelection"] = {"rule": "maximize micro event F, then precision, then higher threshold",
                                    "thresholdGrid": list(THRESHOLDS), "byClass": diagnostics}
    return model


def validate_model(model):
    if model.get("algorithm") == "plexus-drum-ridge-v2":
        from .classifier_v2 import validate_model as validate_v2
        return validate_v2(model)
    validate(model, "drum-model")
    expected = object_hash({k: v for k, v in model.items() if k != "modelChecksum"})
    if model["modelChecksum"] != expected:
        raise ValueError("Drum model checksum mismatch")
    if model["featureNames"] != list(FEATURE_NAMES) or model["featureVersion"] != FEATURE_VERSION:
        raise ValueError("Incompatible drum features")
    if model["classes"] != list(CLASSES) or model["algorithm"] != "plexus-drum-ridge-v1":
        raise ValueError("Incompatible drum classifier")
    fitted = model["fitting"]["tracks"]
    if {t["split"] for t in fitted} != {"train", "validation"}:
        raise ValueError("Model must record both fitting partitions")
    for field in ("groupId", "contentHash"):
        seen = {}
        for track in fitted:
            if track[field] in seen and seen[track[field]] != track["split"]:
                raise ValueError("Model fitting partition leakage")
            seen[track[field]] = track["split"]
    arrays = {name: np.asarray(model[name]) for name in ("mean", "scale", "weights", "thresholds")}
    if any(not np.isfinite(v).all() for v in arrays.values()) or any(arrays["scale"] <= 0):
        raise ValueError("Invalid drum model numeric arrays")
    return model


def predict(audio, model):
    if model.get("algorithm") == "plexus-drum-ridge-v2":
        from .classifier_v2 import predict as predict_v2
        return predict_v2(audio, model)
    validate_model(model)
    times, features = extract(audio.samples, audio.sample_rate)
    prov = provenance("plexus-drum-research", VERSION,
                      {"eventClasses": list(CLASSES), "featureVersion": FEATURE_VERSION,
                       "thresholds": model["thresholds"], "minSeparation": model["minSeparation"]},
                      "plexus_prediction", timestamp())
    prov.update(modelIdentifier=model["algorithm"], modelVersion=VERSION, modelChecksum=model["modelChecksum"])
    result = empty_analysis(audio.metadata, prov)
    result["events"] = select_events(times, scores(model, features), model["thresholds"], model["minSeparation"])
    result["tags"] = ["research-only", "uncalibrated-evidence"]
    return validate(result), {"candidateCount": len(times), "featureCount": len(FEATURE_NAMES)}
