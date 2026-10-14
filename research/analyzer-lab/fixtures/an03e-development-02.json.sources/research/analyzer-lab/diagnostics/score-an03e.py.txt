"""Score v4/v5/v6 at original tolerances plus strict 2 ms; retain all extra events."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from plexus_analyzer_lab.metrics.events import event_metrics

TOLERANCES = [.002, .01, .02, .025, .03, .05, .07]
PROVIDERS = ['residualV4', 'differenceV5', 'continuationV6']


def score(source, output):
    if output.exists(): raise FileExistsError('Score must be new')
    raw = source.read_bytes()
    data = json.loads(raw)
    rows, totals = [], {}
    for c in data['cases']:
        row = {k: c[k] for k in ['matrix', 'spec', 'duration', 'negativeStart', 'pcmSha256', 'truthSha256']}
        for times in c['eventTimes'].values():
            if any(not 0 <= t < c['duration'] for t in times): raise ValueError('Invalid physical clock')
        if c['negativeStart'] is not None:
            row['negative'] = {p: sum(t >= c['negativeStart'] for t in c['eventTimes'][p]) for p in PROVIDERS}
        else:
            truth = [i / c['spec']['sampleRate'] for i in c['truthSamples']]
            row['curves'] = {p: [event_metrics(truth, c['eventTimes'][p], t) for t in TOLERANCES] for p in PROVIDERS}
        rows.append(row)
    for matrix in sorted({c['matrix'] for c in rows}):
        totals[matrix] = {}
        for family in sorted({c['spec']['family'] for c in rows if c['matrix'] == matrix}):
            selected = [c for c in rows if c['matrix'] == matrix and c['spec']['family'] == family]
            if family == 'negative':
                totals[matrix][family] = {p: sum(c['negative'][p] for c in selected) for p in PROVIDERS}
                totals[matrix]['negativeExposureSeconds'] = sum(c['duration'] - c['negativeStart'] for c in selected)
            else:
                totals[matrix][family] = {}
                for t_index in [0, 3]:
                    totals[matrix][family][str(TOLERANCES[t_index])] = {}
                    for p in PROVIDERS:
                        metrics = [c['curves'][p][t_index] for c in selected]
                        if any(m['status'] != 'available' for m in metrics): raise ValueError('Missing evidence')
                        totals[matrix][family][str(TOLERANCES[t_index])][p] = {k: sum(m[k] for m in metrics) for k in ['referenceCount', 'estimatedCount', 'matchedCount', 'missedCount', 'falsePositiveCount']}
    with output.open('x', encoding='utf-8') as stream:
        json.dump({'inputSha256': hashlib.sha256(raw).hexdigest(), 'tolerances': TOLERANCES, 'totals': totals, 'cases': rows}, stream, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps(totals))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    score(args.input, args.output)
