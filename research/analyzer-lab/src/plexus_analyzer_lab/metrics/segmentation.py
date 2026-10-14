"""Section boundary comparison. Labels require a separate future metric."""

from .events import event_metrics


def boundary_metrics(reference, estimated, tolerance=0.5):
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Section output is unsupported by one or both providers"}
    # Track endpoints are trivial and must not inflate internal boundary agreement.
    reference_times = sorted({section["start"] for section in reference if section["start"] != 0})
    estimated_times = sorted({section["start"] for section in estimated if section["start"] != 0})
    return event_metrics(reference_times, estimated_times, tolerance)


def evaluate(reference, estimated, config=None):
    return boundary_metrics(reference, estimated, (config or {}).get("sectionTolerance", 0.5))
