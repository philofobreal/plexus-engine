"""JSON Schema validation plus temporal/parallel-array invariants."""
import json
from functools import lru_cache

from jsonschema import Draft202012Validator

from .config import LAB_ROOT

SCHEMA_VERSION = "1.0.0"
EVIDENCE_TYPES = ("ground_truth", "oracle_prediction", "pseudo_label", "plexus_prediction", "human_annotation")


@lru_cache
def schema(kind):
    value = json.loads((LAB_ROOT / "schemas" / f"{kind}.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(value)
    return value


def validate(value, kind="canonical-analysis"):
    # jsonschema's numeric checks alone permit NaN: reject it at the JSON boundary.
    json.dumps(value, allow_nan=False)
    Draft202012Validator(schema(kind)).validate(value)
    if kind == "canonical-analysis":
        duration = value["metadata"]["duration"]
        for bar in value["timing"]["bars"] or []:
            if bar["end"] < bar["start"] or bar["end"] > duration + 1e-6:
                raise ValueError("Invalid timing.bars interval")
        for name in ("beats", "downbeats"):
            times = value["timing"][name]
            if times is not None and (times != sorted(set(times)) or any(t > duration + 1e-6 for t in times)):
                raise ValueError(f"Invalid timing.{name}")
        for name in ("notes", "sections", "chords", "sourceActivity", "stems"):
            for item in value[name] or []:
                if "end" in item and (item["end"] < item["start"] or item["end"] > duration + 1e-6):
                    raise ValueError(f"Invalid {name} interval")
        for event in value["events"] or []:
            if event["time"] > duration + 1e-6 or event["time"] + event.get("duration", 0) > duration + 1e-6:
                raise ValueError("Event exceeds audio duration")
        for track in value["pitchTracks"] or []:
            lengths = {len(track[k]) for k in ("times", "frequenciesHz", "voicing", "confidence")}
            if len(lengths) != 1 or track["times"] != sorted(set(track["times"])):
                raise ValueError("Pitch arrays must share a sorted unique time axis")
            if any(t > duration + 1e-6 for t in track["times"]):
                raise ValueError("Pitch track exceeds audio duration")
    if kind == "training-example" and value["end"] <= value["start"]:
        raise ValueError("Training window must have positive duration")
    return value
