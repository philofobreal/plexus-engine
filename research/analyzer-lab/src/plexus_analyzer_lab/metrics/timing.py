"""Canonical comparison of timing, events, metadata, and capability availability."""

from math import isfinite

from .events import compare_events, event_metrics
from .segmentation import boundary_metrics
from . import pitch, transcription, source_activity


def tempo_metrics(reference, estimated):
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing tempo estimate"}
    if not all(isfinite(bpm) and bpm > 0 for bpm in (reference, estimated)):
        return {"status": "not_available", "reason": "Tempo must be finite and positive"}
    ratio = estimated / reference
    return {
        "status": "available", "referenceBpm": reference, "estimatedBpm": estimated,
        "signedErrorBpm": estimated - reference, "absoluteErrorBpm": abs(estimated - reference),
        "relativeError": abs(estimated - reference) / reference,
        "octaveEquivalentRelativeError": min(abs(ratio * scale - 1) for scale in (0.5, 1, 2)),
    }


def _bar_times(bars):
    return None if bars is None else [bar["start"] if isinstance(bar, dict) else bar for bar in bars]


def _event_classes(canonical):
    declared = canonical["provenance"].get("parameters", {}).get("eventClasses")
    if declared is not None:
        return declared
    observed = {event["class"] for event in canonical.get("events") or []}
    if canonical["provenance"]["provider"] in ("plexus", "librosa"):
        observed.add("onset")
    return observed


def compare(plexus, oracle, config=None):
    """Treat the oracle as reference evidence, never as asserted ground truth."""
    config = config or {}
    for field in ("trackId", "contentHash", "duration", "sampleRate", "sampleCount", "channels", "monoProjection", "decodedPcmHash"):
        left, right = plexus["metadata"], oracle["metadata"]
        if field in left or field in right:
            if left.get(field) != right.get(field):
                raise ValueError(f"Cannot compare different PCM identities/clocks: {field}")
    a, b = plexus["timing"], oracle["timing"]
    metadata = {}
    for field in ("duration", "sampleRate"):
        estimated, reference = plexus["metadata"].get(field), oracle["metadata"].get(field)
        metadata[field] = ({"status": "not_available", "reason": "Missing metadata"}
                           if estimated is None or reference is None else
                           {"status": "available", "estimated": estimated, "reference": reference,
                            "difference": estimated - reference, "matches": estimated == reference})
    return {
        "referenceProvider": oracle["provenance"]["provider"],
        "estimatedProvider": plexus["provenance"]["provider"],
        "referenceEvidenceType": oracle["provenance"]["evidenceType"],
        "groundTruthStatus": False,
        "metadata": metadata,
        "tempo": tempo_metrics(b.get("tempo"), a.get("tempo")),
        "beats": event_metrics(b.get("beats"), a.get("beats"), config.get("beatTolerance", 0.07)),
        "downbeats": event_metrics(b.get("downbeats"), a.get("downbeats"), config.get("beatTolerance", 0.07)),
        "bars": event_metrics(_bar_times(b.get("bars")), _bar_times(a.get("bars")), config.get("beatTolerance", 0.07)),
        "events": compare_events(oracle.get("events"), plexus.get("events"), config.get("eventTolerance", 0.05),
                                 _event_classes(oracle), _event_classes(plexus)),
        "sections": boundary_metrics(oracle.get("sections"), plexus.get("sections"), config.get("sectionTolerance", 0.5)),
        "pitch": pitch.evaluate(oracle.get("pitchTracks"), plexus.get("pitchTracks"), config),
        "transcription": transcription.evaluate(oracle.get("notes"), plexus.get("notes"), config),
        "sourceActivity": source_activity.evaluate(oracle.get("sourceActivity"), plexus.get("sourceActivity"), config),
    }
