"""Actual integrated v2 transport, independently validated without changing old cases."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess

import pytest
from jsonschema import Draft202012Validator
from plexus_analyzer_lab.config import LAB_ROOT


@pytest.fixture(scope="module")
def actual():
    root = Path(LAB_ROOT).parents[1]
    completed = subprocess.run(["node", "research/analyzer-lab/diagnostics/export-predictive-transport.mjs"],
                               cwd=root, capture_output=True, text=True, check=True)
    return json.loads(completed.stdout)


def validator():
    root = Path(LAB_ROOT).parents[1]
    schema = json.loads((root / "tests/fixtures/analyzer/analysis-result.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_actual_v2_and_v1_transport_satisfies_additive_schema(actual):
    validator().validate(actual)
    assert actual["trackAnalysis"]["predictiveOnsets"]["algorithm"] == "predictive-innovation-v2"
    assert actual["trackAnalysis"]["acousticOnsets"]["algorithm"] == "overlap-energy-rise-v1"
    points = actual["trackAnalysis"]["predictiveOnsets"]["candidates"]
    assert all(any(abs(p["time"] - t) < .025 for p in points) for t in [.2, .4, .6])


@pytest.mark.parametrize("mutation", ["algorithm", "ratio", "coefficient", "missing-proposal", "probability", "negative-index"])
def test_schema_rejects_malformed_predictive_evidence(actual, mutation):
    result = deepcopy(actual)
    stream = result["trackAnalysis"]["predictiveOnsets"]
    point = stream["candidates"][0]
    if mutation == "algorithm": stream["algorithm"] = "v1"
    elif mutation == "ratio": point["innovationRatio"] = 7
    elif mutation == "coefficient": point["predictorCoefficient"] = 2.1
    elif mutation == "missing-proposal": del point["proposalSample"]
    elif mutation == "probability": point["probability"] = .99
    else: point["sampleIndex"] = -1
    assert list(validator().iter_errors(result))
