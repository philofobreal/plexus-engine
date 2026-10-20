"""Independent validation of the actual additive v3 headless transport."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess

import pytest
from jsonschema import Draft202012Validator
from plexus_analyzer_lab.config import LAB_ROOT
from plexus_analyzer_lab.metrics.events import event_metrics


@pytest.fixture(scope='module')
def actual():
    root = Path(LAB_ROOT).parents[1]
    completed = subprocess.run(['node', 'research/analyzer-lab/diagnostics/export-adaptive-transport.mjs'],
                               cwd=root, capture_output=True, text=True, check=True)
    return json.loads(completed.stdout)


def validator():
    root = Path(LAB_ROOT).parents[1]
    schema = json.loads((root / 'tests/fixtures/analyzer/analysis-result.schema.json').read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_actual_three_versions_satisfy_schema_and_dense_truth(actual):
    validator().validate(actual)
    track = actual['trackAnalysis']
    assert track['acousticOnsets']['algorithm'] == 'overlap-energy-rise-v1'
    assert track['predictiveOnsets']['algorithm'] == 'predictive-innovation-v2'
    stream = track['adaptiveOnsets']
    assert stream['algorithm'] == 'adaptive-innovation-v3'
    assert stream['contrastSamples'] == 16
    assert stream['minimumSeparationSamples'] == 24
    result = event_metrics([.25 + j * .008 for j in range(6)], [p['time'] for p in stream['candidates']], .002)
    assert result['status'] == 'available'
    assert result['matchedCount'] == 6 and result['falsePositiveCount'] == 0


@pytest.mark.parametrize('mutation', ['algorithm', 'ratio', 'coefficient', 'missing-contrast',
                                    'missing-spacing', 'probability', 'negative-index', 'missing-proposal'])
def test_schema_rejects_malformed_adaptive_payload(actual, mutation):
    result = deepcopy(actual)
    stream = result['trackAnalysis']['adaptiveOnsets']
    point = stream['candidates'][0]
    if mutation == 'algorithm': stream['algorithm'] = 'predictive-innovation-v2'
    elif mutation == 'ratio': point['innovationRatio'] = 7
    elif mutation == 'coefficient': point['predictorCoefficient'] = 2.1
    elif mutation == 'missing-contrast': del stream['contrastSamples']
    elif mutation == 'missing-spacing': del stream['minimumSeparationSamples']
    elif mutation == 'probability': point['probability'] = .99
    elif mutation == 'negative-index': point['sampleIndex'] = -1
    else: del point['proposalSample']
    assert list(validator().iter_errors(result))
