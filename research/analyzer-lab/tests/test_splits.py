import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from plexus_analyzer_lab.datasets.manifest import resolve_reference, validate_manifest
from plexus_analyzer_lab.datasets.splits import split_track


HAS_JSONSCHEMA = bool(importlib.util.find_spec("jsonschema"))


def track(track_id, split="train", content_hash="a" * 64):
    return {"trackId": track_id, "split": split, "audio": "audio.wav", "contentHash": content_hash,
            "license": "fixture", "licenseSource": "local", "allowedResearchUsage": "synthetic test",
            "stems": [], "midi": None, "annotations": [], "tags": []}


class SplitTests(unittest.TestCase):
    def test_track_assignment_is_deterministic_and_shared_by_all_frames(self):
        expected = split_track("example", 17)
        self.assertIn(expected, ("train", "validation", "test"))
        self.assertEqual({split_track("example", 17) for _ in range(100)}, {expected})
        self.assertGreater(len({split_track(f"track-{i}", 17) for i in range(200)}), 1)
        self.assertNotEqual([split_track(f"track-{i}", 17) for i in range(100)],
                            [split_track(f"track-{i}", 18) for i in range(100)])

    def test_ratios_reject_invalid_values(self):
        for ratios in ((1, 1, 1), (-1, 1, 1), (1,), (float("nan"), 0, 1)):
            with self.assertRaises(ValueError):
                split_track("example", ratios=ratios)
        self.assertEqual(split_track("example", ratios=(0, 0, 1)), "test")

    def test_references_are_manifest_relative_and_urls_are_preserved(self):
        directory = Path(__file__).resolve().parent
        manifest = directory / "metadata" / "dataset.json"
        self.assertEqual(resolve_reference("../audio.wav", manifest), str((directory / "audio.wav").resolve()))
        self.assertEqual(resolve_reference("https://example.org/a.wav", manifest), "https://example.org/a.wav")

    @unittest.skipUnless(HAS_JSONSCHEMA, "jsonschema is not installed")
    def test_duplicate_track_and_content_across_splits_are_rejected(self):
        base = {"schemaVersion": "1.0.0", "datasetId": "fixture", "datasetVersion": "1", "tracks": []}
        for tracks in ([track("a"), track("a", "test", "b" * 64)], [track("a"), track("b", "test")]):
            with self.assertRaises(ValueError):
                validate_manifest({**base, "tracks": tracks})
        self.assertEqual(validate_manifest({**base, "tracks": [track("a"), track("b", "test", "b" * 64)]})["datasetId"], "fixture")

    @unittest.skipUnless(HAS_JSONSCHEMA, "jsonschema is not installed")
    def test_training_export_is_deterministic_and_preserves_production_features(self):
        from plexus_analyzer_lab.canonical import empty_analysis
        from plexus_analyzer_lab.provenance import provenance
        from plexus_analyzer_lab.training.export import export_training

        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            run = Path(directory)
            metadata = {"trackId": "fixture", "contentHash": "a" * 64, "duration": 1, "sampleRate": 1000}
            oracle = empty_analysis(metadata, provenance("oracle", "test", {}, "oracle_prediction", "2026-10-10T00:00:00Z"))
            oracle["events"] = [{"time": 0.15, "class": "onset", "confidence": None, "provider": "oracle"}]
            frames = [{"e": 0.2, "perceptualSpectrum": [0.1] * 24}, {"e": 0.9, "perceptualSpectrum": [0.3] * 24}]
            raw = {"frames": frames, "hopSize": 100}
            manifest = {"track": metadata, "config": {"seed": 17}, "providers": {
                "plexus": {"status": "success", "raw": "plexus.raw.json"},
                "oracle": {"status": "success", "canonical": "oracle.canonical.json"}}}
            for name, value in (("manifest.json", manifest), ("plexus.raw.json", raw), ("oracle.canonical.json", oracle)):
                (run / name).write_text(json.dumps(value), encoding="utf-8")
            output = run / "examples.jsonl"
            result = export_training(run, output)
            first = output.read_bytes()
            self.assertEqual(result["count"], 1)
            example = json.loads(first)
            self.assertEqual(example["features"], frames[1])
            self.assertEqual(example["start"], 0.1)
            self.assertEqual(example["end"], 0.2)
            self.assertIsNone(example["confidence"])
            self.assertFalse(example["groundTruthStatus"])
            self.assertEqual(example["split"], split_track("fixture", 17))
            export_training(run, output)
            self.assertEqual(output.read_bytes(), first)
            drum = empty_analysis(metadata, provenance("drum", "test", {}, "oracle_prediction", "2026-10-10T00:00:00Z"))
            drum["events"] = [{"time": 0.15, "class": "kick", "confidence": 0.9, "provider": "drum"}]
            (run / "drum.canonical.json").write_text(json.dumps(drum), encoding="utf-8")
            manifest["providers"]["drum"] = {"status": "success", "canonical": "drum.canonical.json"}
            (run / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            export_training(run, output)
            # A drum-only provider has no declared onset capability and cannot
            # count as negative onset evidence in the consensus denominator.
            self.assertEqual(json.loads(output.read_text())["oracleAgreement"], 1)
            drum["provenance"]["parameters"]["eventClasses"] = ["onset", "kick"]
            (run / "drum.canonical.json").write_text(json.dumps(drum), encoding="utf-8")
            export_training(run, output)
            self.assertEqual(json.loads(output.read_text())["oracleAgreement"], 0.5)
            # Respect the dataset's declared held-out partition rather than
            # recomputing a split that could put its examples into training.
            manifest["dataset"] = {"split": "test"}
            (run / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            export_training(run, output)
            self.assertEqual(json.loads(output.read_text())["split"], "test")
            oracle["events"] = []
            (run / "oracle.canonical.json").write_text(json.dumps(oracle), encoding="utf-8")
            result = export_training(run, output)
            self.assertEqual(result["count"], 0)
            self.assertTrue(result["diagnostics"])
            self.assertEqual(output.read_text(), "")
            # Missing features still produce an explicit empty export, even
            # when an oracle successfully detected supported events.
            oracle["events"] = [{"time": 0.15, "class": "onset", "confidence": None, "provider": "oracle"}]
            (run / "oracle.canonical.json").write_text(json.dumps(oracle), encoding="utf-8")
            (run / "plexus.raw.json").write_text(json.dumps({"frames": []}), encoding="utf-8")
            result = export_training(run, output)
            self.assertEqual(result["count"], 0)
            self.assertIn("Plexus raw output has no feature frames", result["diagnostics"])
