"""Validate metadata manifests and reject track/content leakage across splits."""

import json
from pathlib import Path
from urllib.parse import urlsplit


def resolve_reference(reference, manifest_path):
    """Resolve local refs relative to the manifest, preserving external URIs."""
    parsed = urlsplit(reference)
    if parsed.scheme and not (len(parsed.scheme) == 1 and len(reference) > 2 and reference[1] == ":"):
        return reference
    path = Path(reference)
    if not path.is_absolute():
        path = Path(manifest_path).resolve().parent / path
    return str(path.resolve())


def validate_manifest(manifest):
    from ..contracts import validate

    validate(manifest, "dataset-manifest")
    identities, hashes = {}, {}
    for track in manifest["tracks"]:
        track_id, split = track["trackId"], track["split"]
        if track_id in identities:
            raise ValueError(f"Duplicate track id {track_id!r}: {identities[track_id]} and {split}")
        identities[track_id] = split
        content_hash = track.get("contentHash")
        if content_hash:
            key = content_hash.lower()
            if key in hashes and hashes[key][1] != split:
                other_id, other_split = hashes[key]
                raise ValueError(f"Content leakage across splits: {other_id!r} ({other_split}) and {track_id!r} ({split})")
            hashes[key] = (track_id, split)
    return manifest


def load_manifest(path):
    with Path(path).open(encoding="utf-8") as stream:
        return validate_manifest(json.load(stream))
