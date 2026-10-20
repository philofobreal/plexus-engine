"""Rehashed invalid metadata cannot bypass v2 model-load protocol checks."""
import copy
import json

import pytest
from jsonschema import ValidationError

from plexus_analyzer_lab.drums.classifier import THRESHOLDS
from plexus_analyzer_lab.drums.classifier_v2 import RIDGES, validate_model
from plexus_analyzer_lab.drums.experiment import train
from plexus_analyzer_lab.drums.synthetic import generate_corpus
from plexus_analyzer_lab.hashing import object_hash


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    # One actual training run; only train/validation metadata are read here.
    parent = tmp_path_factory.mktemp("v2-load-contract")
    manifest = generate_corpus(parent / "corpus", sample_rate=16000)
    path = train(manifest, parent / "model.json", algorithm="v2")
    return json.loads(path.read_text(encoding="utf-8"))


def rehash(model):
    model["modelChecksum"] = object_hash({key: value for key, value in model.items() if key != "modelChecksum"})
    return model


def changed_threshold(value):
    index = list(THRESHOLDS).index(value)
    return float(THRESHOLDS[(index + 1) % len(THRESHOLDS)])


def winner(model):
    return next(trial for trial in model["hyperparameterSelection"]["trials"] if trial["ridge"] == model["ridge"])


def test_actual_trainer_model_accepted_without_changes(trained):
    before = copy.deepcopy(trained)
    assert validate_model(trained) is trained
    assert trained == before


@pytest.mark.parametrize("flag", ["reviewed", "trainingAllowed", "evaluationAllowed"])
def test_rehashed_unreviewed_or_disallowed_fitting_rights_rejected(trained, flag):
    model = copy.deepcopy(trained)
    model["fitting"]["rights"][flag] = False
    with pytest.raises(ValidationError):
        validate_model(rehash(model))


def test_rehashed_duplicate_track_ids_across_partitions_rejected(trained):
    model = copy.deepcopy(trained)
    tracks = model["fitting"]["tracks"]
    validation = next(track for track in tracks if track["split"] == "validation")
    validation["trackId"] = tracks[0]["trackId"]
    with pytest.raises(ValueError, match="IDs must be unique"):
        validate_model(rehash(model))


@pytest.mark.parametrize("mutation", [
    lambda m: m.update(validationSelection={}),
    lambda m: m.update(hyperparameterSelection={}),
    lambda m: m["hyperparameterSelection"].update(split="test"),
    lambda m: m["hyperparameterSelection"].update(rule="choose best test outcome"),
    lambda m: m["validationSelection"].update(rule="choose lowest threshold"),
    lambda m: m["hyperparameterSelection"].update(ridgeGrid=[1., 10., 1000.]),
    lambda m: m["validationSelection"]["thresholdGrid"].pop(),
    lambda m: m["hyperparameterSelection"]["trials"].pop(),
    lambda m: m["hyperparameterSelection"]["trials"].append(copy.deepcopy(m["hyperparameterSelection"]["trials"][0])),
    lambda m: m["hyperparameterSelection"]["trials"][0].update(macroF=1.1),
    lambda m: m.update(ridge=17.),
    lambda m: m["thresholds"].__setitem__(0, .123456),
    lambda m: m["validationSelection"]["byClass"].pop("kick"),
    lambda m: m["validationSelection"]["byClass"]["kick"].update(referenceCount=0),
    lambda m: m["validationSelection"]["byClass"]["kick"].update(matchedCount=1.5),
    lambda m: m["hyperparameterSelection"]["trials"][0].update(unrecordedCriterion=True),
])
def test_rehashed_selection_protocol_mutations_rejected(trained, mutation):
    model = copy.deepcopy(trained)
    mutation(model)
    with pytest.raises((ValidationError, ValueError)):
        validate_model(rehash(model))


def test_rehashed_duplicate_or_reordered_ridge_trials_rejected(trained):
    for repeat in (True, False):
        model = copy.deepcopy(trained)
        trials = model["hyperparameterSelection"]["trials"]
        if repeat:
            trials[1]["ridge"] = trials[0]["ridge"]
        else:
            trials.reverse()
        with pytest.raises(ValueError, match="each ridge trial"):
            validate_model(rehash(model))


def test_rehashed_nonwinning_selected_ridge_rejected(trained):
    model = copy.deepcopy(trained)
    model["ridge"] = next(ridge for ridge in RIDGES if ridge != model["ridge"])
    with pytest.raises(ValueError, match="trial ranking"):
        validate_model(rehash(model))


def test_rehashed_ranking_prefers_macro_then_worst_then_precision_then_ridge(trained):
    # Construct distinct recorded rankings without reading any held-out outcome.
    for deciding_field in ("macroF", "worstClassF", "macroPrecision", "ridge"):
        model = copy.deepcopy(trained)
        trials = model["hyperparameterSelection"]["trials"]
        for trial in trials:
            trial.update(macroF=.8, worstClassF=.6, macroPrecision=.7)
        desired = trials[-1] if deciding_field == "ridge" else trials[0]
        if deciding_field != "ridge":
            desired[deciding_field] += .05
        wrong = next(trial for trial in trials if trial["ridge"] != desired["ridge"])
        model["ridge"] = wrong["ridge"]
        model["thresholds"] = list(wrong["thresholds"])
        with pytest.raises(ValueError, match="trial ranking"):
            validate_model(rehash(model))


def test_rehashed_selected_threshold_consistency_rejected(trained):
    for target in ("model", "trial", "class"):
        model = copy.deepcopy(trained)
        if target == "model":
            model["thresholds"][0] = changed_threshold(model["thresholds"][0])
        elif target == "trial":
            selected = winner(model)
            selected["thresholds"][0] = changed_threshold(selected["thresholds"][0])
        else:
            metric = model["validationSelection"]["byClass"]["kick"]
            metric["threshold"] = changed_threshold(metric["threshold"])
        with pytest.raises(ValueError, match="threshold"):
            validate_model(rehash(model))


def test_rehashed_validation_counts_and_fraction_arithmetic_rejected(trained):
    for target in ("matchedCount", "precision", "recall", "fMeasure"):
        model = copy.deepcopy(trained)
        metric = model["validationSelection"]["byClass"]["kick"]
        if target == "matchedCount":
            metric[target] = max(metric["referenceCount"], metric["estimatedCount"]) + 1
        else:
            metric[target] = 0. if metric[target] > 0 else 1.
        with pytest.raises(ValueError, match="counts"):
            validate_model(rehash(model))


def test_rehashed_trial_summary_arithmetic_rejected(trained):
    model = copy.deepcopy(trained)
    selected = winner(model)
    # A larger macro score retains winner status but contradicts selected counts.
    selected["macroF"] = 1. if selected["macroF"] < 1. else .99
    with pytest.raises(ValueError):
        validate_model(rehash(model))
    model = copy.deepcopy(trained)
    trial = model["hyperparameterSelection"]["trials"][0]
    trial.update(macroF=.2, worstClassF=.8)
    with pytest.raises(ValueError, match="worst-class"):
        validate_model(rehash(model))
