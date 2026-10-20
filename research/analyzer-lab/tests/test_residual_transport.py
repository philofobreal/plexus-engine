"""Independent validation of actual version-selected v4 wire output."""
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
    run = subprocess.run(['node', 'research/analyzer-lab/diagnostics/export-residual-transport.mjs'],
                         cwd=root, capture_output=True, text=True, check=True)
    return json.loads(run.stdout)


def validator():
    root = Path(LAB_ROOT).parents[1]
    schema = json.loads((root / 'tests/fixtures/analyzer/analysis-result.schema.json').read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_actual_selected_v4_transport_recovers_all_weak_dense_carrier_attacks(actual):
    validator().validate(actual)
    stream = actual['trackAnalysis']['adaptiveOnsets']
    assert stream['algorithm'] == 'residual-innovation-v4'
    assert stream['backgroundEstimator'] == 'clean-block-or-rolling'
    assert actual['trackAnalysis']['predictiveOnsets']['algorithm'] == 'predictive-innovation-v2'
    points = stream['candidates']
    score = event_metrics([.18 + j * .006 for j in range(6)], [p['time'] for p in points], .002)
    assert score['status'] == 'available' and score['matchedCount'] == 6
    assert score['falsePositiveCount'] == 1
    for p in points:
        if p['time'] >= .1:
            assert p['backgroundModel'] == 'clean-block' and p['modelBlockCount'] >= 3
            assert p['predictorSupportStartSample'] < p['predictorSupportEndSample'] <= p['proposalSample']


@pytest.mark.parametrize('mutation', ['algorithm', 'estimator', 'model', 'count', 'missing-fit-start',
                                    'missing-fit-end', 'coefficient', 'missing-proposal', 'probability', 'ratio'])
def test_schema_rejects_malformed_residual_transport(actual, mutation):
    result = deepcopy(actual)
    stream = result['trackAnalysis']['adaptiveOnsets']
    point = stream['candidates'][1]
    if mutation == 'algorithm': stream['algorithm'] = 'adaptive-innovation-v3'
    elif mutation == 'estimator': del stream['backgroundEstimator']
    elif mutation == 'model': point['backgroundModel'] = 'unknown'
    elif mutation == 'count': point['modelBlockCount'] = -1
    elif mutation == 'missing-fit-start': del point['predictorSupportStartSample']
    elif mutation == 'missing-fit-end': del point['predictorSupportEndSample']
    elif mutation == 'coefficient': point['predictorCoefficient'] = 3
    elif mutation == 'missing-proposal': del point['proposalSample']
    elif mutation == 'probability': point['probability'] = .99
    else: point['innovationRatio'] = 7
    assert list(validator().iter_errors(result))
