import importlib.util
import unittest

from plexus_analyzer_lab.metrics.events import compare_events, event_metrics
from plexus_analyzer_lab.metrics.segmentation import boundary_metrics
from plexus_analyzer_lab.metrics.timing import compare, tempo_metrics


class MetricsTests(unittest.TestCase):
    def test_missing_and_empty_do_not_claim_perfect_agreement(self):
        self.assertEqual(event_metrics(None, [1])["status"], "not_available")
        self.assertEqual(event_metrics([], [])["status"], "not_available")
        self.assertNotIn("fMeasure", event_metrics([], []))
        for reference, estimated in (([], [1]), ([1], [])):
            result = event_metrics(reference, estimated)
            self.assertEqual(result["status"], "available")
            self.assertEqual(result["fMeasure"], 0)
            self.assertIsNone(result["meanAbsoluteTimingError"])

    @unittest.skipUnless(importlib.util.find_spec("mir_eval"), "mir_eval is not installed")
    def test_standard_one_to_one_matching_and_tolerance(self):
        result = event_metrics([1, 2], [1.01, 1.02, 2.2], 0.05)
        self.assertEqual(result["matchedCount"], 1)
        self.assertAlmostEqual(result["precision"], 1 / 3)
        self.assertEqual(result["recall"], 0.5)
        self.assertAlmostEqual(result["fMeasure"], 0.4)
        self.assertEqual(event_metrics([1, 2], [1.01, 2.2], 0.25)["matchedCount"], 2)

    def test_invalid_event_times_and_tolerance(self):
        for tolerance in (-1, float("nan")):
            with self.assertRaises(ValueError):
                event_metrics([1], [1], tolerance)
        with self.assertRaises(ValueError):
            event_metrics([float("inf")], [])

    def test_tempo_ambiguity_is_reported_separately(self):
        result = tempo_metrics(120, 60)
        self.assertEqual(result["absoluteErrorBpm"], 60)
        self.assertEqual(result["relativeError"], 0.5)
        self.assertEqual(result["octaveEquivalentRelativeError"], 0)
        self.assertEqual(tempo_metrics(0, 120)["status"], "not_available")

    def test_visual_events_do_not_become_drum_predictions(self):
        result = compare_events([{"time": 1, "class": "kick"}],
                                [{"time": 1, "class": "onset", "subclass": "visualImpact:1"}])
        self.assertEqual(set(result["byClass"]), {"kick", "onset"})
        self.assertEqual(result["byClass"]["kick"]["status"], "not_available")
        self.assertEqual(result["byClass"]["onset"]["status"], "not_available")

    def test_declared_supported_empty_event_class_scores_zero(self):
        result = compare_events([{"time": 1, "class": "onset"}], [],
                                reference_classes=["onset"], estimated_classes=["onset"])
        self.assertEqual(result["byClass"]["onset"]["fMeasure"], 0)

    @unittest.skipUnless(importlib.util.find_spec("mir_eval"), "mir_eval is not installed")
    def test_nonzero_first_section_start_is_a_boundary(self):
        sections = [{"start": 0.5, "end": 4}]
        result = boundary_metrics(sections, sections)
        self.assertEqual(result["matchedCount"], 1)
        self.assertEqual(result["fMeasure"], 1)

    def test_sections_exclude_trivial_endpoints(self):
        sections = [{"start": 0, "end": 4}]
        self.assertEqual(boundary_metrics(sections, sections)["status"], "not_available")
        self.assertEqual(boundary_metrics(sections, None)["status"], "not_available")

    def test_empty_future_capabilities_never_get_scores(self):
        from plexus_analyzer_lab.metrics import pitch, transcription, source_activity
        for module in (pitch, transcription, source_activity):
            result = module.evaluate([], [])
            self.assertIn(result["status"], ("not_available", "unsupported"))
            self.assertNotIn("fMeasure", result)

    def test_canonical_comparison_reports_metadata_and_unavailable_capabilities(self):
        common = {"metadata": {"duration": 4, "sampleRate": 48000},
                  "timing": {"tempo": 120, "beats": [], "downbeats": [], "bars": []},
                  "events": []}
        plexus = {**common, "provenance": {"provider": "plexus", "evidenceType": "plexus_prediction"}}
        oracle = {**common, "provenance": {"provider": "librosa", "evidenceType": "oracle_prediction"}}
        result = compare(plexus, oracle, {})
        self.assertTrue(result["metadata"]["duration"]["matches"])
        self.assertEqual(result["tempo"]["absoluteErrorBpm"], 0)
        self.assertFalse(result["groundTruthStatus"])
        for key in ("beats", "downbeats", "bars", "events", "sections", "pitch", "transcription", "sourceActivity"):
            self.assertEqual(result[key]["status"], "not_available")
