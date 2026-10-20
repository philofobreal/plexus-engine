import pytest

from plexus_analyzer_lab.metrics.events import event_metrics


def test_signed_bias_and_linear_tail_quantiles():
    result = event_metrics([1, 2, 3, 4], [.99, 2.02, 3.03, 4.04], .05)
    timing = result["timingErrors"]
    assert result["matchedCount"] == 4 and result["falsePositiveCount"] == result["missedCount"] == 0
    assert timing["meanSignedError"] == pytest.approx(.02)
    assert timing["medianSignedError"] == pytest.approx(.025)
    assert timing["medianAbsoluteError"] == pytest.approx(.025)
    assert timing["p95AbsoluteError"] == pytest.approx(.0385)
    assert timing["p99AbsoluteError"] == pytest.approx(.0397)
    assert timing["maximumAbsoluteError"] == pytest.approx(.04)
    assert timing["units"] == "seconds" and timing["matchedOnly"] is True


def test_perfect_matched_subset_does_not_hide_misses_or_false_positives():
    result = event_metrics([1, 2, 3], [1, 2.2, 8], .05)
    assert result["timingErrors"]["p99AbsoluteError"] == 0
    assert result["timingErrors"]["sampleCount"] == 1
    assert result["missedCount"] == result["falsePositiveCount"] == 2
    assert result["recall"] == pytest.approx(1 / 3)


@pytest.mark.parametrize("reference,estimated", [([1], [1.2]), ([], [1]), ([1], [])])
def test_no_matches_has_no_zero_error_success(reference, estimated):
    result = event_metrics(reference, estimated, .05)
    assert result["timingErrors"]["sampleCount"] == 0
    assert all(result["timingErrors"][key] is None for key in (
        "meanSignedError", "medianSignedError", "medianAbsoluteError", "p95AbsoluteError",
        "p99AbsoluteError", "maximumAbsoluteError"))
    assert result["fMeasure"] == 0


def test_empty_and_unsupported_are_still_unavailable():
    for reference, estimated in (([], []), (None, []), ([], None)):
        result = event_metrics(reference, estimated)
        assert result["status"] == "not_available"
        assert "timingErrors" not in result and "fMeasure" not in result


def test_sign_reverses_when_estimate_and_reference_reverse():
    before = event_metrics([1, 2], [1.02, 2.02])["timingErrors"]
    after = event_metrics([1.02, 2.02], [1, 2])["timingErrors"]
    assert before["meanSignedError"] == pytest.approx(-after["meanSignedError"])
    assert before["p95AbsoluteError"] == pytest.approx(after["p95AbsoluteError"])


def test_unsorted_inputs_are_not_mutated_and_duplicates_stay_one_to_one():
    reference, estimated = [2, 1], [1.01, 1.01, 2.01]
    result = event_metrics(reference, estimated)
    assert reference == [2, 1] and estimated == [1.01, 1.01, 2.01]
    assert result["matchedCount"] == 2 and result["falsePositiveCount"] == 1
    assert result["timingErrors"]["sampleCount"] == 2
