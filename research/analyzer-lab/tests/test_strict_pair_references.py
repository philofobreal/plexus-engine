"""User policy: two independent provider votes only; preserve disagreements as unknown."""
import json
from pathlib import Path

import numpy as np
import pytest

from plexus_analyzer_lab.labels.strict_pair import strict_pair
from plexus_analyzer_lab.labels.qualify_pair import qualify_pair
from plexus_analyzer_lab.adapters.audioflux_onsets import analyze_onsets

ROOT = Path(__file__).resolve().parents[3]


def events(times, kind='onset'):
    return [{'time':t,'class':kind} for t in times]


def pair(a,b,tolerance=.025):
    return strict_pair(a,b,left_provider='librosa',right_provider='audioflux',tolerance=tolerance)


def test_two_votes_are_required_even_when_other_provider_is_empty_or_unavailable():
    assert pair(events([1]),[])['acceptedReferences']==[]
    assert pair(events([1]),None)['status']=='not_available'
    r=pair(events([1,2]),events([1.02,3]))
    assert len(r['acceptedReferences'])==1
    assert r['unacceptedLeft']==events([2]) and r['unacceptedRight']==events([3])
    assert r['minimumAgreement']==1 and r['unacceptedAreNegatives'] is False
    label=r['acceptedReferences'][0]
    assert label['votes']==[{'provider':'librosa','time':1.0},{'provider':'audioflux','time':1.02}]
    assert label['confidence'] is None and label['groundTruthStatus'] is False


def test_class_matching_maximum_cardinality_and_input_order():
    a,b=events([0,.018]),events([.009,.027])
    r=pair(a,b,.01)
    assert len(r['acceptedReferences'])==2
    assert r==pair(list(reversed(a)),list(reversed(b)),.01)
    assert pair(events([1],'kick'),events([1],'onset'))['acceptedReferences']==[]
    assert len(pair(events([1,1.01]),events([1.005]))['acceptedReferences'])==1


@pytest.mark.parametrize('bad',[-1,float('nan'),float('inf')])
def test_invalid_times_and_tolerances_fail(bad):
    with pytest.raises(ValueError): pair(events([bad]),events([1]))
    with pytest.raises(ValueError): pair(events([1]),events([1]),bad)


def test_duplicate_or_same_provider_votes_cannot_manufacture_consensus():
    with pytest.raises(ValueError): pair(events([1,1]),events([1]))
    with pytest.raises(ValueError): strict_pair([],[],left_provider='librosa',right_provider='librosa')


def test_qualification_requires_candidate_close_to_both_votes_not_just_mean():
    refs=pair(events([1]),events([1.024]))['acceptedReferences']
    # Candidate 1.036 is 24 ms from the mean, but 36 ms from the first oracle.
    assert qualify_pair(events([1.036]),refs)['qualified']==[]
    r=qualify_pair(events([1.012,1.018]),refs)
    assert len(r['qualified'])==1 and r['unqualifiedCandidateCount']==1
    assert r['unqualifiedAreNegatives'] is False
    assert qualify_pair(events([1.012],'kick'),refs)['qualified']==[]
    with pytest.raises(ValueError): qualify_pair(events([1]),[{'groundTruthStatus':True}])
    with pytest.raises(ValueError): qualify_pair(events([1.012,1.012]),refs)
    with pytest.raises(ValueError): qualify_pair(events([1.012]),refs+refs)


@pytest.mark.parametrize('samples,fs,nfft,hop',[
    (np.array([],dtype=np.float32),44100,2048,512),
    (np.array([np.nan],dtype=np.float32),44100,2048,512),
    (np.array([0],dtype=np.float64),44100,2048,512),
    (np.array([0],dtype=np.float32),999,2048,512),
    (np.array([0],dtype=np.float32),44100,1000,512),
    (np.array([0],dtype=np.float32),44100,2048,0)])
def test_optional_adapter_rejects_bad_input_before_loading_runtime(samples,fs,nfft,hop):
    with pytest.raises(ValueError): analyze_onsets(samples,fs,ROOT/'absent-runtime',n_fft=nfft,hop=hop)


def test_actual_recorded_references_retain_exactly_two_libraries_and_same_pcm():
    d=json.loads((ROOT/'research/analyzer-lab/fixtures/an03f-dual-prodigy-01.json').read_text())
    assert len(d['rows'])==9 and d['accuracy'] is None and d['groundTruth'] is None
    total=0
    for r in d['rows']:
        assert r['audiofluxProvenance']['pcmSha256']==r['excerptWithContextPcmSha256']
        assert r['audiofluxProvenance']['parameters']['timestampCorrection']==0
        a,b=events(r['eventTimes']['librosa']),events(r['eventTimes']['audioflux'])
        assert pair(a,b)==r['strictReference']
        total+=len(r['strictReference']['acceptedReferences'])
        for ref in r['strictReference']['acceptedReferences']:
            assert ref['disagreementSeconds']<=.025
            assert {v['provider'] for v in ref['votes']}=={'librosa','audioflux'}
    assert total==1184


def test_retained_qualification_and_density_controls_do_not_retime_candidates():
    selection=json.loads((ROOT/'research/analyzer-lab/fixtures/an03f-reference-selection-01.json').read_text())
    counts={p:0 for p in ['continuationV6','peakV7']}
    for row in selection['rows']:
        for p,r in row['referenceQualifiedPlexus'].items():
            counts[p]+=len(r['qualified'])
            for q in r['qualified']:
                assert all(abs(q['candidate']['time']-v['time'])<=.025 for v in q['reference']['votes'])
            assert r['candidateCount']==len(r['qualified'])+r['unqualifiedCandidateCount']
    assert counts=={'continuationV6':379,'peakV7':1079}


def test_calibration_retains_shared_false_removal_instead_of_claiming_consensus_truth():
    d=json.loads((ROOT/'research/analyzer-lab/fixtures/an03f-oracle-calibration-01.json').read_text())
    assert sum(len(r['truth']) for r in d['rows'])==15
    removal=next(r for r in d['rows'] if r['kind']=='removal')
    assert removal['truth']==[] and len(removal['strictReference']['acceptedReferences'])==1
    assert removal['truthComparison']['agreed'][1]['falsePositiveCount']==1
    assert removal['strictReference']['acceptedReferences'][0]['groundTruthStatus'] is False
