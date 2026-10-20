"""Independent procedural drum fixtures, not a model of real drum recognition.

Ground truth describes which generator was scheduled at each sample-clock
onset. It establishes synthetic identities only, including overlapped hits and
bass confounds; it cannot establish accuracy on recordings of real instruments.
"""

from pathlib import Path
import struct

import numpy as np
import soundfile as sf

from ..audio import load_audio
from ..canonical import empty_analysis
from ..contracts import validate
from ..provenance import provenance, timestamp
from ..reports.json_report import write_json


VERSION = "1.0.0"
CLASSES = ("kick", "snare", "hihat")
_SPECS = (
    {"id": "train-kick-isolated", "split": "train", "duration": 6.2, "mode": "kick", "period": 0.67, "pitch": 48.0, "amplitude": 0.56},
    {"id": "train-snare-isolated", "split": "train", "duration": 6.4, "mode": "snare", "period": 0.61, "pitch": 175.0, "amplitude": 0.44},
    {"id": "train-hihat-isolated", "split": "train", "duration": 6.6, "mode": "hihat", "period": 0.31, "pitch": 0.0, "amplitude": 0.28},
    {"id": "train-overlap-mix", "split": "train", "duration": 8.0, "mode": "mix", "period": 0.52, "pitch": 54.0, "amplitude": 0.52},
    {"id": "validation-alternating", "split": "validation", "duration": 7.1, "mode": "alternating", "period": 0.58, "pitch": 61.0, "amplitude": 0.46},
    {"id": "validation-bass-mix", "split": "validation", "duration": 8.1, "mode": "mix", "period": 0.47, "pitch": 58.0, "amplitude": 0.48, "bassHz": 43.0},
    {"id": "test-alternating", "split": "test", "duration": 7.4, "mode": "alternating", "period": 0.71, "pitch": 67.0, "amplitude": 0.38},
    {"id": "test-bass-overlap", "split": "test", "duration": 9.0, "mode": "mix", "period": 0.43, "pitch": 63.0, "amplitude": 0.43, "bassHz": 51.0},
    {"id": "test-silence", "split": "test", "duration": 6.7, "mode": "silence", "period": 0.0, "pitch": 0.0, "amplitude": 0.0},
)


def _schedule(spec):
    if spec["mode"] == "silence":
        return []
    times = np.arange(0.35, spec["duration"] - 0.65, spec["period"])
    if spec["mode"] in CLASSES:
        return [(float(time), spec["mode"]) for time in times]
    if spec["mode"] == "alternating":
        return [(float(time), CLASSES[index % len(CLASSES)]) for index, time in enumerate(times)]
    events = []
    for index, time in enumerate(times):
        # Every kick overlaps a hat; alternate snare/kick overlaps exercise the
        # multi-label annotation contract without relabelling either generator.
        events.extend(((float(time), "kick"), (float(time), "hihat")))
        if index % 2:
            events.append((float(time), "snare"))
        if time + spec["period"] / 2 < spec["duration"] - 0.2:
            events.append((float(time + spec["period"] / 2), "hihat"))
    return events


def _hit(kind, sample_rate, rng, pitch):
    duration = {"kick": 0.42, "snare": 0.24, "hihat": 0.11}[kind]
    time = np.arange(round(duration * sample_rate), dtype=np.float64) / sample_rate
    if kind == "kick":
        fundamental = pitch * rng.uniform(0.91, 1.09)
        frequency = fundamental + rng.uniform(65, 110) * np.exp(-time / rng.uniform(0.025, 0.045))
        phase = 2 * np.pi * np.cumsum(frequency) / sample_rate
        phase -= phase[0]
        wave = np.cos(phase) * np.exp(-time / rng.uniform(0.07, 0.12))
        wave += 0.07 * np.cos(2 * np.pi * 1300 * time) * np.exp(-time / 0.004)
    elif kind == "snare":
        noise = rng.normal(size=len(time))
        highpass = np.diff(noise, prepend=0)
        tone_hz = rng.uniform(165, 225) if pitch < 100 else pitch * rng.uniform(0.93, 1.07)
        wave = 0.76 * highpass * np.exp(-time / rng.uniform(0.032, 0.052))
        wave += 0.38 * np.cos(2 * np.pi * tone_hz * time) * np.exp(-time / 0.042)
    else:
        noise = rng.normal(size=len(time))
        # Two independent first-difference FIR passes suppress low-frequency
        # noise. This is an original procedural timbre, not a sampled hi-hat.
        highpass = np.diff(np.diff(noise, prepend=0), prepend=0)
        wave = highpass * np.exp(-time / rng.uniform(0.013, 0.023))
    peak = np.max(np.abs(wave))
    return wave / peak if peak else wave


def _write_float_wave(path, samples, sample_rate):
    """Write standard IEEE_FLOAT WAV without a timestamp-bearing PEAK chunk."""
    pcm = np.asarray(samples, dtype="<f4").tobytes()
    # RIFF/WAVE, fmt (IEEE float, mono, 32-bit), fact sample count, data.
    # FLOAT writes through libsndfile add a PEAK chunk with generation time,
    # which would make content identities differ for identical seeded PCM.
    header = struct.pack("<4sI4s4sIHHIIHH4sII4sI", b"RIFF", 48 + len(pcm), b"WAVE", b"fmt ",
                         16, 3, 1, sample_rate, sample_rate * 4, 4, 32,
                         b"fact", 4, len(samples), b"data", len(pcm))
    path.write_bytes(header + pcm)


def generate_corpus(output_dir, seed=1729, sample_rate=22050):
    """Create nine WAV/annotation pairs and return the absolute dataset path.

    A pre-existing directory is an error, including an empty one. Same seed,
    generator version and NumPy version produce identical
    WAV content and event tables; provenance records the actual generation time.
    """
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise ValueError("Synthetic seed must be a nonnegative integer")
    if isinstance(sample_rate, bool) or not isinstance(sample_rate, int) or not 16000 <= sample_rate <= 192000:
        raise ValueError("Synthetic sample rate must be an integer between 16000 and 192000 Hz")
    requested_output = Path(output_dir)
    if requested_output.exists() or requested_output.is_symlink():
        raise FileExistsError(f"Synthetic output already exists: {requested_output}")
    output_dir = requested_output.resolve()
    output_dir.mkdir(parents=True, exist_ok=False)
    generated_at = timestamp()
    tracks = []
    for index, spec in enumerate(_SPECS):
        track_seed = seed + 1009 * (index + 1)
        rng = np.random.default_rng(track_seed)
        samples = np.zeros(round(spec["duration"] * sample_rate), dtype=np.float64)
        if spec.get("bassHz"):
            time = np.arange(len(samples), dtype=np.float64) / sample_rate
            # Sustained, smoothly faded low-frequency energy is an unlabelled
            # confound. It is never declared a kick because it is bass-heavy.
            fade = np.minimum(1, time / 0.16) * np.minimum(1, (spec["duration"] - time) / 0.2)
            samples += 0.16 * np.sin(2 * np.pi * spec["bassHz"] * time + 0.2) * fade
        events = []
        for requested_time, kind in _schedule(spec):
            sample = round(requested_time * sample_rate)
            pitch = spec["pitch"] if kind == "kick" or spec["mode"] == "snare" else 0
            wave = _hit(kind, sample_rate, rng, pitch)
            amplitude = spec["amplitude"] * rng.uniform(0.8, 1.12) * {"kick": 1, "snare": 0.8, "hihat": 0.48}[kind]
            count = min(len(wave), len(samples) - sample)
            samples[sample:sample + count] += amplitude * wave[:count]
            events.append({"time": sample / sample_rate, "class": kind, "confidence": 1.0,
                           "provider": "plexus-procedural-drums", "attributes": {"sampleIndex": sample, "generatorIdentity": kind}})
        peak = float(np.max(np.abs(samples)))
        scale = min(1.0, 0.92 / peak) if peak else 1.0
        samples *= scale
        audio_path = output_dir / f"{spec['id']}.wav"
        annotation_path = output_dir / f"{spec['id']}.annotation.json"
        _write_float_wave(audio_path, samples, sample_rate)
        audio = load_audio(audio_path, spec["id"])
        generator = {"version": VERSION, "seed": seed, "trackSeed": track_seed, "sampleRate": sample_rate,
                     "numpyVersion": np.__version__, "soundfileVersion": sf.__version__, "libsndfileVersion": sf.__libsndfile_version__,
                     "specification": dict(spec), "peakNormalizationScale": scale,
                     "truthScope": "Scheduled procedural generator identities; not real instrument recognition"}
        parameters = {"eventClasses": list(CLASSES), "completeEventClasses": list(CLASSES),
                      "generator": generator, "groundTruthReviewed": True,
                      "source": "Plexus independent procedural generator", "license": "Project-generated research fixtures"}
        annotation = empty_analysis(audio.metadata, provenance("plexus-procedural-drums", VERSION, parameters, "ground_truth", generated_at))
        annotation["events"] = sorted(events, key=lambda event: (event["time"], event["class"]))
        annotation["tags"] = ["synthetic-generator-defined-identities", "no-external-recordings-or-weights", "not-real-drum-recognition-ground-truth"]
        write_json(annotation_path, validate(annotation))
        tracks.append({"trackId": spec["id"], "groupId": f"independent-procedural-{spec['id']}", "split": spec["split"],
                       "audioPath": audio_path.name, "annotationPath": annotation_path.name, "contentHash": audio.metadata["contentHash"]})
    dataset = {"schemaVersion": "1.0.0", "datasetId": "synthetic-drums-v1",
               "rights": {"reviewed": True, "trainingAllowed": True, "evaluationAllowed": True,
                          "source": "Plexus independent procedural generator", "license": "Project-generated research fixtures",
                          "reviewNote": "No external recordings or weights; generator-defined event identities only"},
               "tracks": tracks}
    path = output_dir / "dataset.json"
    write_json(path, validate(dataset, "drum-dataset"))
    return path
