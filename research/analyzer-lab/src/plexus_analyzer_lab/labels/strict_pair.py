"""Only two-provider, class-matched, one-to-one agreement is an eligible reference."""
from math import isfinite

import numpy as np
from mir_eval.util import match_events


def strict_pair(left, right, *, left_provider, right_provider, tolerance=.025):
    if not left_provider or not right_provider or left_provider == right_provider:
        raise ValueError('Two different declared providers are required')
    if not isfinite(tolerance) or tolerance < 0:
        raise ValueError('Finite nonnegative tolerance required')
    if left is None or right is None:
        return {'status': 'not_available', 'reason': 'Both providers must supply this capability',
                'acceptedReferences': [], 'groundTruthStatus': False}
    def checked(events):
        result = []
        for e in events:
            if not isinstance(e.get('class'), str) or not e['class'] or not isfinite(e['time']) or e['time'] < 0:
                raise ValueError('Finite physical times and declared event classes required')
            result.append({'time': float(e['time']), 'class': e['class']})
        if len({(e['class'], e['time']) for e in result}) != len(result):
            raise ValueError('Duplicate events cannot inflate agreement')
        return sorted(result, key=lambda e: (e['class'], e['time']))
    left, right = checked(left), checked(right)
    accepted, left_only, right_only = [], [], []
    for kind in sorted({e['class'] for e in left + right}):
        a = [e['time'] for e in left if e['class'] == kind]
        b = [e['time'] for e in right if e['class'] == kind]
        matches = match_events(np.asarray(a), np.asarray(b), tolerance) if a and b else []
        used_a, used_b = {i for i, j in matches}, {j for i, j in matches}
        for i, j in matches:
            accepted.append({'time': (a[i] + b[j]) / 2, 'class': kind,
                'evidenceType': 'pseudo_label', 'acceptance': 'two-library-agreement',
                'groundTruthStatus': False, 'confidence': None,
                'timeInterval': [min(a[i], b[j]), max(a[i], b[j])],
                'disagreementSeconds': abs(a[i] - b[j]),
                'votes': [{'provider': left_provider, 'time': a[i]}, {'provider': right_provider, 'time': b[j]}]})
        left_only.extend({'time': t, 'class': kind} for i, t in enumerate(a) if i not in used_a)
        right_only.extend({'time': t, 'class': kind} for j, t in enumerate(b) if j not in used_b)
    return {'status': 'available', 'algorithm': 'strict-class-pair-v1', 'toleranceSeconds': tolerance,
            'requiredProviders': [left_provider, right_provider], 'minimumAgreement': 1,
            'groundTruthStatus': False, 'acceptedReferences': sorted(accepted, key=lambda e: (e['time'], e['class'])),
            'unacceptedLeft': left_only, 'unacceptedRight': right_only,
            'unacceptedAreNegatives': False}
