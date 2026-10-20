"""Independent actual v5 payload/schema and authored multi-tone timing checks."""
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
    run = subprocess.run(['node', 'research/analyzer-lab/diagnostics/export-difference-transport.mjs'],
        cwd=root, capture_output=True, text=True, check=True)
    return json.loads(run.stdout)


def validator():
    root = Path(LAB_ROOT).parents[1]
    schema = json.loads((root / 'tests/fixtures/analyzer/analysis-result.schema.json').read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_actual_selected_v5_transport_recovers_all_six_polyphonic_attacks(actual):
    validator().validate(actual)
    stream = actual['trackAnalysis']['adaptiveOnsets']
    assert stream['algorithm'] == 'confirmed-difference-v5'
    assert stream['filterCoefficients'] == [c / 16 for c in [1, -4, 6, -4, 1]]
    assert actual['trackAnalysis']['predictiveOnsets']['algorithm'] == 'predictive-innovation-v2'
    truth = [round((.23 + j * .007) * 22050) / 22050 for j in range(6)]
    score = event_metrics(truth, [p['time'] for p in stream['candidates']], .002)
    assert score['status'] == 'available' and score['matchedCount'] == 6
    assert score['falsePositiveCount'] == 1
    assert all(p['supportEndSample'] <= stream['sampleCount'] for p in stream['candidates'])


@pytest.mark.parametrize('mutation', ['algorithm', 'coefficients', 'memory', 'missing-refinement', 'source',
    'missing-support', 'proposal', 'strength', 'probability', 'ratio', 'coefficient-fiction'])
def test_schema_rejects_malformed_difference_transport(actual, mutation):
    result = deepcopy(actual)
    stream = result['trackAnalysis']['adaptiveOnsets']; point = stream['candidates'][1]
    if mutation == 'algorithm': stream['algorithm'] = 'adaptive-innovation-v3'
    elif mutation == 'coefficients': stream['filterCoefficients'][0] = 1
    elif mutation == 'memory': stream['filterMemorySamples'] = 2
    elif mutation == 'missing-refinement': del stream['refinementSamples']
    elif mutation == 'source': point['evidenceSource'] = 'unknown'
    elif mutation == 'missing-support': del point['supportEndSample']
    elif mutation == 'proposal': point['proposalSample'] = 1.5
    elif mutation == 'strength': point['strength'] = -1
    elif mutation == 'probability': point['probability'] = .99
    elif mutation == 'coefficient-fiction': point['predictorCoefficient'] = 2
    else: point['innovationRatio'] = 0
    assert list(validator().iter_errors(result))
