from dataclasses import dataclass
from pathlib import Path
from hashlib import sha256

import numpy as np
import soundfile as sf

from .hashing import content_hash


@dataclass
class Audio:
    path: Path
    samples: np.ndarray
    sample_rate: int
    metadata: dict


def load_audio(path, track_id=None, *, mono_projection="channel-0"):
    if mono_projection not in ("channel-0", "arithmetic-mean"):
        raise ValueError("Unsupported mono projection")
    path = Path(path).resolve()
    channels, sample_rate = sf.read(path, dtype="float32", always_2d=True)
    if sample_rate <= 0 or not len(channels) or not np.isfinite(channels).all():
        raise ValueError("Audio must contain finite PCM samples and a positive sample rate")
    # Preserve the decoded clock; no implicit resampling. Both analyzers see identical PCM.
    projected = channels[:, 0] if mono_projection == "channel-0" else channels.mean(axis=1, dtype=np.float32)
    mono = np.ascontiguousarray(projected, dtype=np.float32)
    metadata = {"trackId": track_id or path.stem, "contentHash": content_hash(path),
                "duration": len(mono) / sample_rate, "sampleRate": sample_rate,
                "sampleCount": len(mono), "channels": channels.shape[1], "monoProjection": mono_projection,
                "decodedPcmHash": sha256(mono.astype("<f4", copy=False).tobytes()).hexdigest()}
    return Audio(path, mono, sample_rate, metadata)


def synthetic(path, kind="click", bpm=120, duration=16, sample_rate=22050):
    """Generated PCM only in ignored/user-selected artifact locations."""
    if kind not in ("click", "pulse", "tone-click", "sparse", "silence", "ambiguity"):
        raise ValueError(f"Unknown synthetic kind: {kind}")
    if bpm <= 0 or duration <= 0 or sample_rate < 1000:
        raise ValueError("Invalid synthetic clock")
    samples = np.zeros(round(duration * sample_rate), dtype=np.float32)
    times = np.arange(0.5, duration - 0.02, 60 / bpm)
    if kind == "silence":
        times = np.array([])
    if kind == "sparse":
        times = times[::4]
    if kind == "tone-click":
        samples += (0.08 * np.sin(2 * np.pi * 220 * np.arange(len(samples)) / sample_rate)).astype(np.float32)
    n = round(sample_rate * 0.015)
    wave = np.exp(-np.arange(n) / (sample_rate * 0.003)) * np.cos(2 * np.pi * 1200 * np.arange(n) / sample_rate)
    for i, time in enumerate(times):
        start = round(time * sample_rate)
        amplitude = 0.8 if kind != "ambiguity" or i % 2 == 0 else 0.2
        count = min(n, len(samples) - start)
        samples[start:start + count] += (amplitude * wave[:count]).astype(np.float32)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, samples, sample_rate, subtype="FLOAT")
    return {"kind": kind, "bpm": bpm if kind != "silence" else None, "duration": duration,
            "sampleRate": sample_rate, "onsets": times.tolist(), "evidenceType": "ground_truth"}
