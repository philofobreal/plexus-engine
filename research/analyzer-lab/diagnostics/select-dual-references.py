"""Strict reference qualification and predeclared density-preserving falsification controls."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'research/analyzer-lab/src'))
from plexus_analyzer_lab.labels.qualify_pair import qualify_pair

SHIFTS = [1.137, 7.137, 11.137]
SOURCES = ['research/analyzer-lab/diagnostics/select-dual-references.py',
           'research/analyzer-lab/src/plexus_analyzer_lab/labels/qualify_pair.py']


def run(source, output):
    if output.exists() or Path(str(output) + '.sources').exists(): raise FileExistsError('Output must be new')
    raw = source.read_bytes(); data = json.loads(raw)
    rows = []
    for row in data['rows']:
        fs = row['track']['sampleRate']; start = row['excerptStartSample'] / fs
        duration = (row['excerptEndSample'] - row['excerptStartSample']) / fs
        refs = row['strictReference']['acceptedReferences']
        providers, controls = {}, {}
        for provider in ['continuationV6', 'peakV7']:
            events = [{'time':t,'class':'onset'} for t in row['eventTimes'][provider]]
            providers[provider] = qualify_pair(events, refs, .025)
            controls[provider] = {str(shift):len(qualify_pair(
                [{'time':start + ((e['time'] - start + shift) % duration),'class':'onset'} for e in events],
                refs, .025)['qualified']) for shift in SHIFTS}
        rows.append({'file':row['file'],'fraction':row['fraction'],'acceptedReferenceCount':len(refs),
                     'referenceQualifiedPlexus':providers,'shiftedCandidateControlCounts':controls})
    sources = {}
    for p in SOURCES:
        content=(ROOT/p).read_bytes(); sources[p]=hashlib.sha256(content).hexdigest()
        target=Path(str(output)+'.sources')/(p+'.txt'); target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as stream: stream.write(content)
    result={'protocol':'AN-03F BOTH-oracle timing qualification; no ground-truth accuracy',
            'inputSha256':hashlib.sha256(raw).hexdigest(),'sourceHashes':sources,
            'controlShiftsSeconds':SHIFTS,'controlInterpretation':'Same candidate density, changed alignment. High control coverage warns against recall-only promotion; shifts are diagnostic, not a statistical null model.',
            'rows':rows}
    with output.open('x',encoding='utf-8') as stream: json.dump(result,stream,indent=2,allow_nan=False); stream.write('\n')
    print(json.dumps({'acceptedReferences':sum(r['acceptedReferenceCount'] for r in rows),
                      'qualified':{p:sum(len(r['referenceQualifiedPlexus'][p]['qualified']) for r in rows) for p in ['continuationV6','peakV7']},
                      'shiftedControls':{p:{str(s):sum(r['shiftedCandidateControlCounts'][p][str(s)] for r in rows) for s in SHIFTS} for p in ['continuationV6','peakV7']}}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True); parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); run(args.input,args.output)
