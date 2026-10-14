"""One-to-one event matching using mir_eval's standard matching primitive."""

from math import isfinite


def _quantile(values, q):
    """Linear interpolation between sorted samples at rank (n-1)*q."""
    ordered = sorted(values)
    rank = (len(ordered) - 1) * q
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower)


def event_metrics(reference, estimated, tolerance=0.05):
    """Compare timestamp lists, with oracle/reference orientation stated explicitly.

    An empty side scores zero against nonempty evidence. Both empty is undefined,
    not perfect. ``None`` means the capability was not supplied.
    """
    if not isfinite(tolerance) or tolerance < 0:
        raise ValueError("Event tolerance must be finite and nonnegative")
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing or unsupported event output"}
    reference, estimated = sorted(reference), sorted(estimated)
    if any(not isfinite(t) or t < 0 for t in reference + estimated):
        raise ValueError("Event timestamps must be finite and nonnegative")
    counts = {"referenceCount": len(reference), "estimatedCount": len(estimated), "tolerance": tolerance}
    if not reference and not estimated:
        return {"status": "not_available", "reason": "Both event lists are empty; agreement is undefined", **counts}
    matches = []
    if reference and estimated:
        try:
            import numpy as np
            from mir_eval.util import match_events
        except ImportError:
            return {"status": "not_available", "reason": "mir_eval and numpy are required for event matching", **counts}
        matches = match_events(np.asarray(reference), np.asarray(estimated), tolerance)
    precision = len(matches) / len(estimated) if estimated else 0.0
    recall = len(matches) / len(reference) if reference else 0.0
    errors = [estimated[j] - reference[i] for i, j in matches]
    absolute = [abs(error) for error in errors]
    timing = {"sampleCount": len(errors), "matchedOnly": True, "units": "seconds",
              "signConvention": "estimated minus reference; positive means late",
              "quantileMethod": "linear interpolation at (n-1)*q",
              "meanSignedError": sum(errors) / len(errors) if errors else None,
              "medianSignedError": _quantile(errors, .5) if errors else None,
              "medianAbsoluteError": _quantile(absolute, .5) if errors else None,
              "p95AbsoluteError": _quantile(absolute, .95) if errors else None,
              "p99AbsoluteError": _quantile(absolute, .99) if errors else None,
              "maximumAbsoluteError": max(absolute) if errors else None,
              "interpretation": "Conditional on matches within tolerance; misses and false positives are separate. "
                                "mir_eval matching maximizes cardinality; collision pairing is not a minimum-error assignment. "
                                "Small-sample quantiles do not establish population tail bounds."}
    return {
        "status": "available", **counts, "matchedCount": len(matches),
        "falsePositiveCount": len(estimated) - len(matches), "missedCount": len(reference) - len(matches),
        "precision": precision, "recall": recall,
        "fMeasure": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "meanAbsoluteTimingError": sum(abs(reference[i] - estimated[j]) for i, j in matches) / len(matches) if matches else None,
        "timingErrors": timing,
        "implementation": "mir_eval.util.match_events" if reference and estimated else "empty-side convention",
    }


def compare_events(reference, estimated, tolerance=0.05, reference_classes=None, estimated_classes=None):
    """Compare supported classes without treating missing source output as empty.

    Declared class capabilities distinguish supported absence from unsupported
    classes. Without declarations, only observed classes establish support.
    """
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing or unsupported event output"}
    reference_classes = set(reference_classes if reference_classes is not None else (event["class"] for event in reference))
    estimated_classes = set(estimated_classes if estimated_classes is not None else (event["class"] for event in estimated))
    classes = sorted(reference_classes | estimated_classes | {event["class"] for event in reference + estimated})
    if not classes:
        return event_metrics([], [], tolerance)
    by_class = {
            kind: (event_metrics([e["time"] for e in reference if e["class"] == kind],
                                 [e["time"] for e in estimated if e["class"] == kind], tolerance)
                   if kind in reference_classes and kind in estimated_classes else
                   {"status": "not_available", "reason": f"Event class {kind!r} is unsupported or undeclared by one or both providers"})
            for kind in classes
        }
    available = any(metric["status"] == "available" for metric in by_class.values())
    return {
        "status": "available" if available else "not_available", "byClass": by_class,
        **({} if available else {"reason": "No class-level metric is available"}),
        "interpretation": "Class-matched event evidence; visual impact subclasses do not establish drum source identity",
    }
