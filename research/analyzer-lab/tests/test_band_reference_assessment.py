"""Independent Python qualification of the actual new TS consumer evidence."""
import json
from pathlib import Path

from plexus_analyzer_lab.labels.qualify_pair import qualify_pair

ROOT = Path(__file__).resolve().parents[3]


def read(name):
    return json.loads((ROOT / 'research/analyzer-lab/fixtures' / name).read_text())


def test_new_recording_assessment_agrees_with_both_vote_python_qualification():
    prior = read('an03f-dual-prodigy-01.json')
    current = read('an03g-recorded-01.json')
    assert current['groundTruth'] is None and current['accuracy'] is None
    assert len(prior['rows']) == len(current['rows']) == 9
    qualified = candidates = 0
    for old, row in zip(prior['rows'], current['rows'], strict=True):
        assert (old['file'], old['fraction']) == (row['file'], row['fraction'])
        assert row['identity']['pcmSha256'] == old['excerptWithContextPcmSha256']
        events = [{'time': row['identity']['timelineOffsetSeconds'] + c['time'], 'class': 'onset'}
                  for c in row['candidates']]
        result = qualify_pair(events, old['strictReference']['acceptedReferences'])
        accepted = [e for e in row['assessment']['events'] if e['reference'] is not None]
        assert len(accepted) == len(result['qualified']) == row['qualified']
        assert row['assessment']['unqualifiedAreNegatives'] is False
        for e in accepted:
            assert all(abs(e['time'] - v['time']) <= .025 for v in e['reference']['votes'])
        qualified += len(accepted)
        candidates += len(events)
    assert qualified == current['totalQualified']
    assert candidates == current['totalCandidates']
    assert (candidates, qualified) == (738, 439)


def test_every_new_recording_event_retains_physical_time_and_abstains_from_consumer_truth():
    current = read('an03g-recorded-01.json')
    for row in current['rows']:
        identity = row['identity']
        for candidate, event in zip(row['candidates'], row['assessment']['events'], strict=True):
            assert event['sampleIndex'] == candidate['sampleIndex']
            assert event['time'] == identity['timelineOffsetSeconds'] + candidate['sampleIndex'] / identity['sampleRate']
            assert event['supportEndSample'] <= identity['sampleCount']
            assert event['confidence'] is None and event['groundTruthStatus'] is False
            assert event['dramaturgy'] == event['choreography'] == 'diagnostic-only'
            assert event['xrScoring'] == 'ineligible'
            assert 'independent-accuracy-unvalidated' in event['reasons']
