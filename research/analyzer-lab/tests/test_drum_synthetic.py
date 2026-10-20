import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import soundfile as sf

from plexus_analyzer_lab.audio import load_audio
from plexus_analyzer_lab.contracts import validate
from plexus_analyzer_lab.drums.synthetic import CLASSES, generate_corpus


class SyntheticDrumTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        cls.root = Path(cls.temporary.name)
        cls.manifest_path = generate_corpus(cls.root / "first")
        cls.manifest = json.loads(cls.manifest_path.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_manifest_rights_unique_identities_and_held_out_positive_classes(self):
        self.assertTrue(self.manifest_path.is_absolute())
        self.assertEqual(self.manifest["datasetId"], "synthetic-drums-v1")
        validate(self.manifest, "drum-dataset")
        self.assertEqual(self.manifest["rights"]["source"], "Plexus independent procedural generator")
        for field in ("reviewed", "trainingAllowed", "evaluationAllowed"):
            self.assertTrue(self.manifest["rights"][field])
        tracks = self.manifest["tracks"]
        for identity in ("trackId", "groupId", "contentHash"):
            self.assertEqual(len({track[identity] for track in tracks}), len(tracks))
        for split, minimum in (("train", 4), ("validation", 2), ("test", 3)):
            split_tracks = [track for track in tracks if track["split"] == split]
            self.assertGreaterEqual(len(split_tracks), minimum)
            classes = set()
            for track in split_tracks:
                annotation = json.loads((self.manifest_path.parent / track["annotationPath"]).read_text(encoding="utf-8"))
                classes.update(event["class"] for event in annotation["events"])
            self.assertEqual(classes, set(CLASSES))

    def test_canonical_ground_truth_is_finite_clock_exact_and_generator_scoped(self):
        overlap_found, silence_found, bass_found = False, False, False
        for track in self.manifest["tracks"]:
            annotation = validate(json.loads((self.manifest_path.parent / track["annotationPath"]).read_text(encoding="utf-8")))
            audio_path = self.manifest_path.parent / track["audioPath"]
            audio = load_audio(audio_path, track["trackId"])
            self.assertEqual(audio.metadata["contentHash"], track["contentHash"])
            self.assertEqual(audio.metadata, annotation["metadata"])
            self.assertEqual(sf.info(audio_path).subtype, "FLOAT")
            self.assertEqual(sf.info(audio_path).channels, 1)
            self.assertTrue(np.isfinite(audio.samples).all())
            self.assertLessEqual(float(np.max(np.abs(audio.samples))), 0.920001)
            self.assertTrue(6 <= audio.metadata["duration"] <= 10)
            provenance = annotation["provenance"]
            self.assertEqual(provenance["evidenceType"], "ground_truth")
            parameters = provenance["parameters"]
            self.assertTrue(parameters["groundTruthReviewed"])
            self.assertEqual(parameters["completeEventClasses"], list(CLASSES))
            self.assertIn("not real instrument recognition", parameters["generator"]["truthScope"])
            self.assertIn("not-real-drum-recognition-ground-truth", annotation["tags"])
            events = annotation["events"]
            self.assertEqual(events, sorted(events, key=lambda event: (event["time"], event["class"])))
            for event in events:
                sample = event["attributes"]["sampleIndex"]
                self.assertEqual(event["time"], sample / audio.sample_rate)
                self.assertLess(sample, len(audio.samples))
                self.assertEqual(event["confidence"], 1)
                self.assertEqual(event["class"], event["attributes"]["generatorIdentity"])
            overlap_found |= len({event["time"] for event in events}) < len(events)
            if "silence" in track["trackId"]:
                silence_found = True
                self.assertEqual(events, [])
                self.assertEqual(float(np.max(np.abs(audio.samples))), 0)
            if parameters["generator"]["specification"].get("bassHz"):
                bass_found = True
                self.assertTrue(np.any(audio.samples[:round(0.3 * audio.sample_rate)] != 0))
                self.assertTrue(all(event["time"] >= 0.35 - 1 / audio.sample_rate for event in events))
        self.assertTrue(overlap_found and silence_found and bass_found)

    def test_identical_seed_produces_identical_wav_bytes_and_events(self):
        other_path = generate_corpus(self.root / "repeat")
        other = json.loads(other_path.read_text(encoding="utf-8"))
        self.assertEqual(other, self.manifest)
        for track in other["tracks"]:
            first_audio = self.manifest_path.parent / track["audioPath"]
            second_audio = other_path.parent / track["audioPath"]
            self.assertEqual(first_audio.read_bytes(), second_audio.read_bytes())
            first = json.loads((self.manifest_path.parent / track["annotationPath"]).read_text(encoding="utf-8"))
            second = json.loads((other_path.parent / track["annotationPath"]).read_text(encoding="utf-8"))
            self.assertEqual(first["events"], second["events"])
            self.assertEqual(first["provenance"]["parameters"], second["provenance"]["parameters"])

    def test_changed_seed_changes_positive_audio_and_requested_sample_clock_is_preserved(self):
        seed_path = generate_corpus(self.root / "alternate-seed", seed=1730)
        changed_seed = json.loads(seed_path.read_text(encoding="utf-8"))
        for first, second in zip(self.manifest["tracks"], changed_seed["tracks"]):
            if "silence" in first["trackId"]:
                self.assertEqual(first["contentHash"], second["contentHash"])
            else:
                self.assertNotEqual(first["contentHash"], second["contentHash"])
        other_path = generate_corpus(self.root / "alternate-clock", seed=1730, sample_rate=16000)
        other = json.loads(other_path.read_text(encoding="utf-8"))
        for first, second in zip(self.manifest["tracks"], other["tracks"]):
            self.assertNotEqual(first["contentHash"], second["contentHash"])
            annotation = validate(json.loads((other_path.parent / second["annotationPath"]).read_text(encoding="utf-8")))
            self.assertEqual(annotation["metadata"]["sampleRate"], 16000)
            for event in annotation["events"]:
                self.assertEqual(event["time"], event["attributes"]["sampleIndex"] / 16000)

    def test_existing_directory_and_invalid_clock_fail_without_overwrite(self):
        before = self.manifest_path.read_bytes()
        with self.assertRaises(FileExistsError):
            generate_corpus(self.manifest_path.parent)
        self.assertEqual(self.manifest_path.read_bytes(), before)
        empty_directory = self.root / "empty-but-existing"
        empty_directory.mkdir()
        with self.assertRaises(FileExistsError):
            generate_corpus(empty_directory)
        self.assertEqual(list(empty_directory.iterdir()), [])
        for seed, sample_rate in ((-1, 22050), (True, 22050), (1.5, 22050), (1729, 0), (1729, True), (1729, 22050.5), (1729, 8000)):
            invalid_path = self.root / f"invalid-{seed}-{sample_rate}"
            with self.assertRaises(ValueError):
                generate_corpus(invalid_path, seed=seed, sample_rate=sample_rate)
            self.assertFalse(invalid_path.exists())
