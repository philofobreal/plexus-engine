"""Manifest references and track-level split safeguards."""

from .manifest import load_manifest, resolve_reference, validate_manifest
from .splits import split_track

__all__ = ["load_manifest", "resolve_reference", "validate_manifest", "split_track"]
