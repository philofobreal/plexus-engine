from .contracts import SCHEMA_VERSION


def empty_analysis(metadata, provenance):
    """None = not provided; [] = supported, but no predictions detected."""
    return {"schemaVersion": SCHEMA_VERSION, "metadata": metadata, "provenance": provenance,
            "timing": {"tempo": None, "tempoCandidates": [], "beats": None, "downbeats": None,
                       "bars": None, "confidence": {}},
            **{key: None for key in ("events", "sourceActivity", "pitchTracks", "notes", "chords", "key", "sections", "stems")},
            "tags": [], "confidence": {}, "artifacts": []}
