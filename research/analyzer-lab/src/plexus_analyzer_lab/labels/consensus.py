"""Deterministic bounded-diameter event clusters with one vote per provider."""

from math import isfinite
from statistics import mean


def consensus(events_by_provider, tolerance=0.05, minimum_agreement=0.5):
    """Cluster by class and earliest anchor; never chain adjacent tolerances.

    All events within [anchor, anchor+tolerance] form one cluster. For duplicate
    detections from a provider, its earliest event supplies the sole vote. Empty
    lists participate in the denominator; None denotes unsupported capability.
    Unknown confidence remains None. The result always contains pseudo-labels.
    """
    if not isfinite(tolerance) or tolerance < 0:
        raise ValueError("Consensus tolerance must be finite and nonnegative")
    if not isfinite(minimum_agreement) or not 0 < minimum_agreement <= 1:
        raise ValueError("Minimum agreement must be in (0, 1]")
    providers = sorted(provider for provider, events in events_by_provider.items() if events is not None)
    if not providers:
        return []
    grouped = {}
    for provider in providers:
        for event in events_by_provider[provider]:
            time = event["time"]
            confidence = event.get("confidence")
            if not isfinite(time) or time < 0:
                raise ValueError("Consensus event time must be finite and nonnegative")
            if confidence is not None and (not isfinite(confidence) or not 0 <= confidence <= 1):
                raise ValueError("Confidence must be null or in [0, 1]")
            grouped.setdefault(event["class"], []).append((time, provider, confidence))
    labels = []
    for kind, events in sorted(grouped.items()):
        # Confidence is only a deterministic tie-breaker, not an agreement vote.
        events.sort(key=lambda event: (event[0], event[1], -1 if event[2] is None else event[2]))
        index = 0
        while index < len(events):
            anchor = events[index][0]
            votes = {}
            while index < len(events) and events[index][0] - anchor <= tolerance + 1e-12:
                time, provider, confidence = events[index]
                votes.setdefault(provider, {"provider": provider, "time": time, "confidence": confidence})
                index += 1
            agreement = len(votes) / len(providers)
            if agreement < minimum_agreement:
                continue
            vote_list = [votes[provider] for provider in sorted(votes)]
            confidence = (mean(vote["confidence"] for vote in vote_list)
                          if all(vote["confidence"] is not None for vote in vote_list) else None)
            labels.append({
                "time": mean(vote["time"] for vote in vote_list), "class": kind,
                "evidenceType": "pseudo_label", "confidence": confidence,
                "votes": vote_list, "agreement": agreement, "groundTruthStatus": False,
                "targetProvenance": {"evidenceType": "pseudo_label", "algorithm": "bounded-anchor-v1",
                                     "tolerance": tolerance, "minimumAgreement": minimum_agreement,
                                     "eligibleProviders": providers, "votes": vote_list},
            })
    return sorted(labels, key=lambda label: (label["time"], label["class"]))
