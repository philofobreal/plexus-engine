import unittest

from plexus_analyzer_lab.labels.consensus import consensus
from plexus_analyzer_lab.labels.evidence import classify_evidence


def event(time, confidence=None, kind="onset"):
    return {"time": time, "class": kind, "confidence": confidence}


class ConsensusTests(unittest.TestCase):
    def test_votes_are_unique_and_unknown_confidence_is_preserved(self):
        labels = consensus({"a": [event(1), event(1.01, 1)], "b": [event(1.02, 0.8)], "c": []}, 0.05, 0.5)
        self.assertEqual(len(labels), 1)
        label = labels[0]
        self.assertEqual(len(label["votes"]), 2)
        self.assertAlmostEqual(label["agreement"], 2 / 3)
        self.assertAlmostEqual(label["time"], 1.01)
        self.assertIsNone(label["confidence"])
        self.assertEqual(label["evidenceType"], "pseudo_label")
        self.assertFalse(label["groundTruthStatus"])
        self.assertEqual(label["targetProvenance"]["eligibleProviders"], ["a", "b", "c"])

    def test_bounded_clusters_do_not_chain(self):
        labels = consensus({"a": [event(0)], "b": [event(0.04)], "c": [event(0.08)]}, 0.05, 1)
        self.assertEqual(labels, [])

    def test_provider_order_and_event_order_are_irrelevant(self):
        a, b = [event(2, 0.6), event(1, 0.9)], [event(1.03, 0.8), event(2.01, 0.7)]
        self.assertEqual(consensus({"a": a, "b": b}), consensus({"b": list(reversed(b)), "a": list(reversed(a))}))

    def test_empty_provider_votes_against_but_unsupported_provider_does_not(self):
        self.assertEqual(consensus({"a": [event(1)], "b": []}, minimum_agreement=1), [])
        self.assertEqual(consensus({"a": [event(1)], "b": None}, minimum_agreement=1)[0]["agreement"], 1)

    def test_single_oracle_is_still_only_a_pseudo_label(self):
        label = consensus({"oracle": [event(1)]})[0]
        self.assertEqual(label["agreement"], 1)
        self.assertEqual(label["evidenceType"], "pseudo_label")
        self.assertFalse(label["groundTruthStatus"])
        self.assertIsNone(label["confidence"])

    def test_event_classes_remain_separate(self):
        labels = consensus({"a": [event(1, kind="kick")], "b": [event(1, kind="onset")]}, minimum_agreement=1)
        self.assertEqual(labels, [])

    def test_invalid_inputs_are_rejected(self):
        for tolerance, agreement in ((-1, 0.5), (float("inf"), 0.5), (0.05, 0), (0.05, 1.1)):
            with self.assertRaises(ValueError):
                consensus({}, tolerance, agreement)
        with self.assertRaises(ValueError):
            consensus({"a": [event(1, 2)]})
        with self.assertRaises(ValueError):
            classify_evidence("teacher_ground_truth")

    def test_taxonomy_does_not_merge_annotation_and_truth(self):
        self.assertEqual(classify_evidence("human_annotation"), "human_annotation")
        self.assertEqual(classify_evidence("oracle_prediction"), "oracle_prediction")
