import json
import math
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = LAB_ROOT.parents[1]


def load_config(path=None):
    config = json.loads((LAB_ROOT / "configs/lab.default.json").read_text(encoding="utf-8"))
    if path:
        overrides = json.loads(Path(path).read_text(encoding="utf-8"))
        unknown = overrides.keys() - config.keys()
        if unknown:
            raise ValueError(f"Unknown config keys: {sorted(unknown)}")
        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(config.get(key), dict):
                config[key] = {**config[key], **value}
            else:
                config[key] = value
    for key in ("beatTolerance", "eventTolerance", "sectionTolerance", "consensusTolerance", "timeoutSeconds"):
        value = config[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{key} must be finite and positive")
    agreement = config["minimumAgreement"]
    if isinstance(agreement, bool) or not isinstance(agreement, (int, float)) or not math.isfinite(agreement) or not 0 < agreement <= 1:
        raise ValueError("minimumAgreement must be in (0, 1]")
    if isinstance(config["seed"], bool) or not isinstance(config["seed"], int):
        raise ValueError("seed must be an integer")
    options = config["librosa"]
    if isinstance(options["hopLength"], bool) or not isinstance(options["hopLength"], int) or options["hopLength"] < 1:
        raise ValueError("librosa.hopLength must be a positive integer")
    for name in ("startBpm", "tightness"):
        if isinstance(options[name], bool) or not isinstance(options[name], (int, float)) or not math.isfinite(options[name]) or options[name] <= 0:
            raise ValueError("librosa tempo parameters must be finite and positive")
    for name, minimum in (("hopSize", 1), ("phraseSize", 1), ("algorithmVersion", 1), ("requestId", 0)):
        if name in config["plexus"]:
            value = config["plexus"][name]
            if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
                raise ValueError(f"plexus.{name} must be an integer >= {minimum}")
    if config["plexus"].keys() - {"hopSize", "phraseSize", "algorithmVersion", "requestId"}:
        raise ValueError("Unknown Plexus analyzer option")
    if not isinstance(config["providers"], dict):
        raise ValueError("providers must map provider ids to process options")
    return config
