"""Explicit permission, complete-annotation and track/group leakage gates."""
import json
from pathlib import Path

from ..audio import load_audio
from ..contracts import validate
from ..datasets.manifest import resolve_reference
from ..hashing import content_hash, object_hash
from . import CLASSES


def load_dataset(path, purpose):
    path = Path(path).resolve()
    manifest = validate(json.loads(path.read_text(encoding="utf-8")), "drum-dataset")
    rights = manifest["rights"]
    if not rights["reviewed"] or not rights[f"{purpose}Allowed"]:
        raise ValueError(f"Reviewed dataset rights must explicitly permit {purpose}")
    ids, groups, hashes = set(), {}, {}
    tracks = []
    for track in manifest["tracks"]:
        if track["trackId"] in ids:
            raise ValueError("Duplicate drum trackId")
        ids.add(track["trackId"])
        split = track["split"]
        for key, value in (("group", track["groupId"]),):
            if value in groups and groups[value] != split:
                raise ValueError(f"Drum {key} leakage across splits: {value}")
            groups[value] = split
        audio_path = Path(resolve_reference(track["audioPath"], path))
        annotation_path = Path(resolve_reference(track["annotationPath"], path))
        digest = content_hash(audio_path)
        if digest != track["contentHash"]:
            raise ValueError("Drum audio hash mismatch")
        if digest in hashes and hashes[digest] != split:
            raise ValueError("Drum content leakage across splits")
        hashes[digest] = split
        tracks.append({**track, "audioPath": str(audio_path), "annotationPath": str(annotation_path),
                       "annotationHash": content_hash(annotation_path),
                       "oraclePaths": [resolve_reference(p, path) for p in track.get("oraclePaths", [])]})
    return {**manifest, "tracks": tracks, "manifestHash": object_hash(manifest)}


def observation(track, *, require_complete=True):
    audio = load_audio(track["audioPath"], track["trackId"])
    if audio.metadata["contentHash"] != track["contentHash"]:
        raise ValueError("Audio changed after dataset preflight")
    if content_hash(track["annotationPath"]) != track["annotationHash"]:
        raise ValueError("Annotation changed after dataset preflight")
    annotation = validate(json.loads(Path(track["annotationPath"]).read_text(encoding="utf-8")))
    verify_identity(annotation, audio.metadata)
    prov = annotation["provenance"]
    if prov["evidenceType"] not in ("ground_truth", "human_annotation"):
        raise ValueError("Supervised drum cycle requires reviewed truth or human annotation, not oracle pseudo-label negatives")
    if prov["evidenceType"] == "ground_truth" and prov["parameters"].get("groundTruthReviewed") is not True:
        raise ValueError("Ground truth requires explicit review status")
    if require_complete and set(prov["parameters"].get("completeEventClasses", [])) != set(CLASSES):
        raise ValueError("All drum classes require complete annotations before learning negatives")
    if annotation["events"] is None or any(e["class"] not in CLASSES for e in annotation["events"]):
        raise ValueError("Drum annotation must explicitly supply kick/snare/hihat events, including supported empty")
    identities = [(e["class"], e["time"]) for e in annotation["events"]]
    if len(identities) != len(set(identities)):
        raise ValueError("Duplicate annotated class/time")
    return audio, annotation


def verify_identity(result, metadata):
    for key in ("trackId", "contentHash", "sampleRate", "duration"):
        if result["metadata"][key] != metadata[key]:
            raise ValueError(f"Annotation/provider clock or identity mismatch: {key}")
    for key in ("sampleCount", "channels", "monoProjection", "decodedPcmHash"):
        # Old human annotations may have no decoded-PCM contract. When supplied,
        # it must agree; missing optional identity is not inferred from file hash.
        mono_equivalent = (key == "monoProjection" and result["metadata"].get("channels") == metadata.get("channels") == 1
                           and result["metadata"].get(key) in ("channel-0", "arithmetic-mean")
                           and metadata.get(key) in ("channel-0", "arithmetic-mean"))
        if key in result["metadata"] and not mono_equivalent and result["metadata"][key] != metadata.get(key):
            raise ValueError(f"Annotation/provider clock or identity mismatch: {key}")


def signature(track):
    return {k: track[k] for k in ("trackId", "groupId", "split", "contentHash", "annotationHash")}
