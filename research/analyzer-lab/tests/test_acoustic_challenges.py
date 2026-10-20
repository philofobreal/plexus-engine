"""Identity, same-clock matching and missing-evidence gates for the C2 evaluator."""
import base64
from copy import deepcopy
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

path = Path(__file__).parents[1] / "diagnostics/measure-an02-challenges.py"
spec = importlib.util.spec_from_file_location("an02_challenges", path)
c2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c2)


def case(negative=False):
    samples = np.zeros(6400, dtype="<f4")
    truth = [] if negative else [1600, 3200, 4800]
    samples[truth] = .5
    raw = samples.tobytes()
    points = [{"sampleIndex": i, "time": i / 8000, "strength": 1} for i in truth]
    return {"type": "case", "spec": {"family": "negative" if negative else "isolated", "id": "test", "sampleRate": 8000},
            "instrumentationParity": True, "sampleCount": 6400, "duration": .8, "negativeStart": .1 if negative else None,
            "truthSamples": truth, "truthSha256": c2.digest(json.dumps(truth, separators=(",", ":")).encode()),
            "pcmSha256": c2.digest(raw), "pcmF32leBase64": base64.b64encode(raw).decode(),
            "candidates": {p: deepcopy(points) for p in c2.PROVIDERS[:3]},
            "stages": {"peakFrames": [], "gated": deepcopy(points), "refined": []}}


def test_same_pcm_identity_and_exact_sample_clock():
    row = case()
    samples, truth = c2.decode_case(row)
    assert samples.dtype == np.dtype("<f4")
    assert samples[1600] == .5
    assert truth.tolist() == [.2, .4, .6]
    result = c2.evaluate_case(row, reference=lambda samples, fs: ([.21, .41, .61], []))
    assert result["curves"]["plexusV1"][0]["matchedCount"] == 3
    assert result["eventTimes"]["librosa512"] == [.21, .41, .61]  # No correction to truth.
    assert result["curves"]["librosa512"][-1]["timingErrors"]["matchedOnly"] is True


@pytest.mark.parametrize("change", ["pcm-hash", "truth-hash", "clock", "candidate-time", "duplicate", "parity", "negative"])
def test_corrupt_identity_or_incomplete_coverage_is_rejected(change):
    row = case()
    if change == "pcm-hash": row["pcmSha256"] = "0" * 64
    elif change == "truth-hash": row["truthSha256"] = "0" * 64
    elif change == "clock": row["duration"] = .7
    elif change == "candidate-time": row["candidates"]["plexusV1"][0]["time"] = .21
    elif change == "duplicate": row["candidates"]["plexusV1"].append(row["candidates"]["plexusV1"][-1])
    elif change == "parity": row["instrumentationParity"] = False
    else: row["negativeStart"] = .1
    with pytest.raises(ValueError): c2.decode_case(row)


def test_dense_collision_matching_maximizes_cardinality_instead_of_nearest_greedy():
    metric = c2.event_metrics([0, .018], [.009, 0], .01)
    assert metric["matchedCount"] == 2
    assert metric["missedCount"] == metric["falsePositiveCount"] == 0
    assert c2.event_metrics([0, .018], [.009, 0], .005)["matchedCount"] == 1


def test_negative_exposure_counts_tail_and_excludes_initial_activity_without_perfect_f():
    row = case(True)
    result = c2.evaluate_case(row, reference=lambda samples, fs: ([.05, .1, .799], []))
    assert result["curves"] is None
    assert result["negative"]["providers"]["librosa512"] == {"falsePositiveCount": 2, "excludedInitialCount": 1}
    assert result["negative"]["exposureSeconds"] == pytest.approx(.7)


def test_provider_exception_never_becomes_empty_success():
    def failed(samples, fs): raise RuntimeError("reference unavailable")
    with pytest.raises(RuntimeError, match="reference unavailable"):
        c2.evaluate_case(case(), reference=failed)


def test_padded_reference_endpoint_output_is_preserved_and_penalized_in_v2():
    result = c2.evaluate_case(case(True), reference=lambda samples, fs: ([.8, .816], []))
    assert result["eventTimes"]["librosa512"] == [.8, .816]
    assert result["outOfDomainOutputs"]["librosa512"] == [.8, .816]
    assert result["negative"]["providers"]["librosa512"]["falsePositiveCount"] == 2
    positive = c2.evaluate_case(case(), reference=lambda samples, fs: ([.2, .4, .6, .8], []))
    assert all(m["matchedCount"] == 3 and m["falsePositiveCount"] == 1 for m in positive["curves"]["librosa512"])


def test_output_preexistence_rejected_before_execution(tmp_path):
    output = tmp_path / "existing.json"
    output.write_text("original", encoding="utf-8")
    with pytest.raises(FileExistsError): c2.run(output)
    assert output.read_text(encoding="utf-8") == "original"
