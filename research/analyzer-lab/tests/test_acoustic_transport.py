"""Validate actual opt-in production JSON with the independent draft 2020-12 validator."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess

from jsonschema import Draft202012Validator
import pytest

from plexus_analyzer_lab.config import LAB_ROOT


@pytest.fixture(scope="module")
def enabled_result():
    root = Path(LAB_ROOT).parents[1]
    result = subprocess.run(["node", "research/analyzer-lab/diagnostics/measure-an02-candidates.mjs", "--transport"],
                            cwd=root, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def validator():
    root = Path(LAB_ROOT).parents[1]
    schema = json.loads((root / "tests/fixtures/analyzer/analysis-result.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_real_enabled_analysis_satisfies_production_schema(enabled_result):
    validator().validate(enabled_result)
    assert len(enabled_result["trackAnalysis"]["acousticOnsets"]["candidates"]) == 3


@pytest.mark.parametrize("change", ["negative-index", "wrong-algorithm", "unknown-field", "missing-support", "invalid-flatness"])
def test_optional_evidence_schema_rejects_malformed_transport(enabled_result, change):
    changed = deepcopy(enabled_result)
    stream = changed["trackAnalysis"]["acousticOnsets"]
    candidate = stream["candidates"][0]
    if change == "negative-index":
        candidate["sampleIndex"] = -1
    elif change == "wrong-algorithm":
        stream["algorithm"] = "invented"
    elif change == "unknown-field":
        candidate["probability"] = .99
    elif change == "missing-support":
        del candidate["supportEndSample"]
    else:
        candidate["spectralFlatness"] = 1.1
    assert list(validator().iter_errors(changed))
