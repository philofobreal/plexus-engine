"""Band-local nonlinear ridge evidence, selected solely on validation tracks."""
from math import isclose

import numpy as np

from ..canonical import empty_analysis
from ..contracts import validate
from ..hashing import object_hash
from ..provenance import provenance, timestamp
from . import CLASSES
from .classifier import MATCH_TOLERANCE, MIN_SEPARATION, LABEL_TOLERANCE, THRESHOLDS, select_events, tune
from .features_v2 import FEATURE_NAMES, FEATURE_VERSION, extract

ALGORITHM = "plexus-drum-ridge-v2"
RIDGES = (1.0, 10.0, 100.0)
# Band-wise power × local attack retains simultaneous source evidence rather
# than treating shared global energy as an exclusive instrument label.
INTERACTIONS = tuple((6 + b, 14 + b) for b in range(4)) + tuple((10 + b, 22 + b) for b in range(4))
INTERACTIONS += tuple((5, 6 + b) for b in range(4))
BASIS_NAMES = list(FEATURE_NAMES) + [f"{FEATURE_NAMES[a]}*{FEATURE_NAMES[b]}" for a, b in INTERACTIONS]


def _validate_selection(model):
    """Check the recorded protocol and selection arithmetic, not score authenticity.

    A checksum detects changes; it cannot prove that training actually occurred.
    Only selected-trial class counts are retained by the existing trainer, so
    other trial summaries cannot be reconstructed without the source experiment.
    """
    selection = model["validationSelection"]
    hyperparameters = model["hyperparameterSelection"]
    if selection["thresholdGrid"] != list(THRESHOLDS) or hyperparameters["ridgeGrid"] != list(RIDGES):
        raise ValueError("Drum v2 selection grids differ from the frozen training protocol")
    trials = hyperparameters["trials"]
    if [trial["ridge"] for trial in trials] != list(RIDGES):
        raise ValueError("Drum v2 must record each ridge trial exactly once in grid order")
    for trial in trials:
        if trial["worstClassF"] > trial["macroF"]:
            raise ValueError("Drum v2 trial worst-class F exceeds macro F")
    winner = max(trials, key=lambda trial: (
        trial["macroF"], trial["worstClassF"], trial["macroPrecision"], trial["ridge"]))
    if model["ridge"] != winner["ridge"] or model["thresholds"] != winner["thresholds"]:
        raise ValueError("Drum v2 selected ridge/thresholds disagree with the declared trial ranking")
    for index, kind in enumerate(CLASSES):
        metric = selection["byClass"][kind]
        matched, estimated, reference = (metric[key] for key in ("matchedCount", "estimatedCount", "referenceCount"))
        if matched > min(estimated, reference):
            raise ValueError("Drum v2 validation matches exceed event counts")
        expected = {"precision": matched / estimated if estimated else 0.,
                    "recall": matched / reference,
                    "fMeasure": 2 * matched / (estimated + reference)}
        if any(not isclose(metric[key], number, rel_tol=1e-12, abs_tol=1e-12) for key, number in expected.items()):
            raise ValueError("Drum v2 validation metrics disagree with their event counts")
        if metric["threshold"] != model["thresholds"][index]:
            raise ValueError("Drum v2 class threshold disagrees with the selected model")
    metrics = [selection["byClass"][kind] for kind in CLASSES]
    expected = {"macroF": float(np.mean([metric["fMeasure"] for metric in metrics])),
                "worstClassF": min(metric["fMeasure"] for metric in metrics),
                "macroPrecision": float(np.mean([metric["precision"] for metric in metrics]))}
    if any(not isclose(winner[key], number, rel_tol=1e-12, abs_tol=1e-12) for key, number in expected.items()):
        raise ValueError("Drum v2 winning trial disagrees with selected class metrics")


def design(model, features):
    z = np.clip((features - model["mean"]) / model["scale"], -8, 8)
    return np.column_stack((np.ones(len(z)), z, *[z[:, a] * z[:, b] for a, b in INTERACTIONS]))


def fit(features, labels, ridge):
    if not len(features):
        raise ValueError("Drum v2 training needs transient candidates")
    model = {"schemaVersion": "1.0.0", "algorithm": ALGORITHM, "classes": list(CLASSES),
             "featureVersion": FEATURE_VERSION, "featureNames": list(FEATURE_NAMES), "basisNames": BASIS_NAMES,
             "mean": features.mean(axis=0).tolist(), "scale": np.maximum(features.std(axis=0), 1e-8).tolist(),
             "ridge": ridge, "thresholds": [0.5] * 3, "labelTolerance": LABEL_TOLERANCE,
             "matchTolerance": MATCH_TOLERANCE, "minSeparation": MIN_SEPARATION,
             "scoreMeaning": "Uncalibrated nonlinear ridge evidence; not probability"}
    x = design(model, features)
    weights = []
    for column, kind in enumerate(CLASSES):
        y = labels[:, column]
        count = int(y.sum())
        if not 0 < count < len(y):
            raise ValueError(f"Drum v2 needs complete detected positive and negative {kind} targets")
        balance = np.where(y == 1, len(y) / (2 * count), len(y) / (2 * (len(y) - count)))
        penalty = np.eye(x.shape[1]) * ridge
        penalty[0, 0] = 0
        weights.append(np.linalg.solve(x.T @ (balance[:, None] * x) + penalty, x.T @ (balance * y)))
    model["weights"] = np.array(weights).T.tolist()
    return model


def scores(model, features):
    return design(model, features) @ np.array(model["weights"])


def select_model(features, labels, validation):
    best, trials = None, []
    for ridge in RIDGES:
        model = fit(features, labels, ridge)
        tune(model, [(times, scores(model, rows), events) for times, rows, events in validation])
        metrics = list(model["validationSelection"]["byClass"].values())
        macro = np.mean([m["fMeasure"] for m in metrics])
        worst = min(m["fMeasure"] for m in metrics)
        precision = np.mean([m["precision"] for m in metrics])
        key = (float(macro), float(worst), float(precision), ridge)
        trials.append({"ridge": ridge, "macroF": float(macro), "worstClassF": float(worst),
                       "macroPrecision": float(precision), "thresholds": list(model["thresholds"])})
        if best is None or key > best[0]:
            best = (key, model)
    best[1]["hyperparameterSelection"] = {"split": "validation", "ridgeGrid": list(RIDGES), "trials": trials,
          "rule": "macro class event F, worst class F, macro precision, higher ridge"}
    return best[1]


def validate_model(model):
    validate(model, "drum-model-v2")
    if model["modelChecksum"] != object_hash({k: v for k, v in model.items() if k != "modelChecksum"}):
        raise ValueError("Drum v2 model checksum mismatch")
    if model["featureNames"] != list(FEATURE_NAMES) or model["basisNames"] != BASIS_NAMES:
        raise ValueError("Incompatible drum v2 feature/basis order")
    if model["featureVersion"] != FEATURE_VERSION:
        raise ValueError("Incompatible drum v2 feature version")
    if {t["split"] for t in model["fitting"]["tracks"]} != {"train", "validation"}:
        raise ValueError("Drum v2 model must record both fitting partitions")
    track_ids = [track["trackId"] for track in model["fitting"]["tracks"]]
    if len(track_ids) != len(set(track_ids)):
        raise ValueError("Drum v2 fitting track IDs must be unique")
    for key in ("groupId", "contentHash"):
        seen = {}
        for track in model["fitting"]["tracks"]:
            if track[key] in seen and seen[track[key]] != track["split"]:
                raise ValueError("Drum v2 model fitting leakage")
            seen[track[key]] = track["split"]
    for name in ("mean", "scale", "weights", "thresholds"):
        if not np.isfinite(np.asarray(model[name])).all():
            raise ValueError("Nonfinite drum v2 model")
    _validate_selection(model)
    return model


def predict(audio, model):
    validate_model(model)
    times, rows = extract(audio.samples, audio.sample_rate)
    prov = provenance("plexus-drum-research", "2.0.0",
          {"eventClasses": list(CLASSES), "featureVersion": FEATURE_VERSION,
           "thresholds": model["thresholds"], "minSeparation": model["minSeparation"]}, "plexus_prediction", timestamp())
    prov.update(modelIdentifier=ALGORITHM, modelVersion="2.0.0", modelChecksum=model["modelChecksum"])
    result = empty_analysis(audio.metadata, prov)
    result["events"] = select_events(times, scores(model, rows), model["thresholds"], model["minSeparation"])
    for event in result["events"]:
        event["attributes"]["scoreMeaning"] = "uncalibrated nonlinear ridge"
    result["tags"] = ["research-only", "uncalibrated-evidence", "band-local-attack"]
    return validate(result), {"candidateCount": len(times), "featureCount": len(FEATURE_NAMES)}
