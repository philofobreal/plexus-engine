"""Deterministic track assignment; never split neighbouring frames randomly."""

from hashlib import sha256
from math import isclose, isfinite
import json


def split_track(track_id, seed=17, ratios=(0.8, 0.1, 0.1)):
    if not isinstance(track_id, str) or not track_id:
        raise ValueError("A nonempty track id is required")
    if len(ratios) != 3 or any(not isfinite(ratio) or ratio < 0 for ratio in ratios) or not isclose(sum(ratios), 1, abs_tol=1e-12):
        raise ValueError("Train/validation/test ratios must be nonnegative and sum to one")
    key = json.dumps([track_id, seed], ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    bucket = int.from_bytes(sha256(key).digest()[:8], "big")
    if bucket < int(ratios[0] * 2**64):
        return "train"
    if bucket < int((ratios[0] + ratios[1]) * 2**64):
        return "validation"
    return "test"
