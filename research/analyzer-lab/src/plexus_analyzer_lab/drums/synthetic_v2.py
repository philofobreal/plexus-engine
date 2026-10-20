"""Frozen original v2 procedural corpus; identities are synthesis labels only."""
from pathlib import Path

import numpy as np
import soundfile as sf

from ..audio import load_audio
from ..canonical import empty_analysis
from ..contracts import validate
from ..hashing import object_hash
from ..provenance import provenance, timestamp
from ..reports.json_report import write_json
from . import CLASSES
from .synthetic import _hit, _write_float_wave

VERSION = "2.0.0"
PROVIDER = "plexus-procedural-drums-v2"
TRUTH_SCOPE = "sharedProceduralFamily: exact scheduled synthesis identities; not real instrument recognition"
# Fixed before classifier experiments. Do not tune these test specifications from
# holdout scores: a new test design requires a new generator/corpus version.
# id, split, seconds, positive pattern, confound, period, pitch, drum gain, confound gain
_SPECS = (
    ("train-kick", "train", 8.0, "kick", "none", .61, 43., .46, 0.),
    ("train-snare", "train", 8.2, "snare", "none", .53, 180., .38, 0.),
    ("train-hat", "train", 8.4, "hihat", "none", .27, 0., .26, 0.),
    ("train-weak-overlap", "train", 9.2, "mix", "none", .39, 58., .095, 0.),
    ("train-strong-bass-mix", "train", 9.6, "mix", "bass", .57, 47., .29, .56),
    ("train-bass-negative", "train", 8.0, "none", "bass", 0., 39., 0., .62),
    ("train-ramp-negative", "train", 8.2, "none", "ramp", 0., 52., 0., .72),
    ("train-tone-negative", "train", 8.4, "none", "tone", 0., 347., 0., .31),
    ("train-dc-negative", "train", 8.0, "none", "dc", 0., 0., 0., .13),
    ("train-quiet-negative", "train", 8.2, "none", "quiet", 0., 0., 0., .000018),
    ("train-swell-negative", "train", 8.4, "none", "swell", 0., 0., 0., .36),
    ("train-clap-negative", "train", 8.6, "none", "clap", 0., 0., 0., .43),
    ("validation-irregular", "validation", 8.3, "mix", "none", .48, 66., .32, 0.),
    ("validation-bass-overlap", "validation", 9.1, "mix", "bass", .44, 56., .22, .64),
    ("validation-weak-voices", "validation", 8.5, "alternating", "none", .32, 51., .071, 0.),
    ("validation-ramp-tone", "validation", 8.1, "none", "rampTone", 0., 45., 0., .61),
    ("validation-swell-clap", "validation", 8.7, "none", "swellClap", 0., 0., 0., .34),
    ("validation-dc-quiet", "validation", 8.0, "none", "dcQuiet", 0., 0., 0., .045),
    ("test-syncopated", "test", 8.7, "mix", "none", .36, 63., .25, 0.),
    ("test-bass-weak-overlap", "test", 9.5, "mix", "bass", .63, 49., .12, .68),
    ("test-varied-voices", "test", 8.9, "alternating", "none", .41, 71., .19, 0.),
    ("test-ramp-tone", "test", 8.6, "none", "rampTone", 0., 57., 0., .69),
    ("test-swell-clap", "test", 9.0, "none", "swellClap", 0., 0., 0., .39),
    ("test-dc-quiet", "test", 8.4, "none", "dcQuiet", 0., 0., 0., .067),
)
SPEC_FIELDS = ("id", "split", "duration", "pattern", "confound", "period", "pitch", "drumGain", "confoundGain")
SCHEDULE_VERSION = "irregular-overlap-velocity-v1"


def _specifications():
    return [{**dict(zip(SPEC_FIELDS, values)), "id": "v2-" + values[0]} for values in _SPECS]


SPECIFICATION_HASH = object_hash({"version": VERSION, "schedule": SCHEDULE_VERSION, "tracks": _specifications()})


def _schedule(spec, sample_rate, rng):
    if spec["pattern"] == "none":
        return []
    result = []
    requested = .237 + rng.uniform(0, .07)
    index = 0
    while requested < spec["duration"] - .75:
        if spec["pattern"] in CLASSES:
            kinds = [spec["pattern"]]
        elif spec["pattern"] == "alternating":
            kinds = [CLASSES[index % 3]]
        else:
            kinds = ["kick", "hihat"]
            if index % 3 in (1, 2):
                kinds.append("snare")
        for kind in kinds:
            subtype = ("openLike" if index % 4 == 2 else "closedLike") if kind == "hihat" else (
                ("tonalLike" if index % 2 else "noisyLike") if kind == "snare" else "pitchedDecay")
            result.append({"sampleIndex": round(requested * sample_rate), "class": kind,
                           "subclass": subtype, "velocityScalar": float(rng.uniform(.18, 1.0))})
        if spec["pattern"] == "mix" and index % 4 != 3:
            result.append({"sampleIndex": round((requested + spec["period"] * .41) * sample_rate),
                           "class": "hihat", "subclass": "closedLike",
                           "velocityScalar": float(rng.uniform(.15, .61))})
        # Vary interval and offset independently of any quantized tempo grid.
        requested += spec["period"] * (1., .73, 1.21, .92, 1.37)[index % 5] + rng.uniform(-.019, .019)
        index += 1
    return sorted(result, key=lambda item: (item["sampleIndex"], item["class"]))


def _normalize(wave):
    peak = float(np.max(np.abs(wave)))
    return wave / peak if peak else wave


def _voice(item, sample_rate, rng, pitch):
    kind, subtype = item["class"], item["subclass"]
    if kind == "kick":
        return _hit(kind, sample_rate, rng, pitch)
    if kind == "hihat":
        duration = .52 if subtype == "openLike" else .085
        time = np.arange(round(duration * sample_rate)) / sample_rate
        noise = rng.normal(size=len(time))
        wave = np.diff(np.diff(noise, prepend=0), prepend=0)
        decay = rng.uniform(.09, .15) if subtype == "openLike" else rng.uniform(.011, .025)
        return _normalize(wave * np.exp(-time / decay))
    time = np.arange(round(.29 * sample_rate)) / sample_rate
    noise = np.diff(rng.normal(size=len(time)), prepend=0)
    noise_mix = .37 if subtype == "tonalLike" else .91
    wave = noise_mix * noise * np.exp(-time / rng.uniform(.032, .069))
    tone = np.cos(2 * np.pi * rng.uniform(155, 245) * time)
    wave += (1.05 - noise_mix) * tone * np.exp(-time / .074)
    return _normalize(wave)


def _confound(spec, sample_rate, rng, length):
    time = np.arange(length, dtype=np.float64) / sample_rate
    wave = np.zeros(length, dtype=np.float64)
    mode = spec["confound"]
    gain = spec["confoundGain"]
    confound_onsets = []
    fade = np.minimum(1, time / .31) * np.minimum(1, (spec["duration"] - time) / .38)
    if mode == "bass":
        frequency = spec["pitch"] if spec["pattern"] == "none" else spec["pitch"] * .83
        wave = (np.sin(2 * np.pi * frequency * time + .31)
                + .16 * np.sin(2 * np.pi * 2 * frequency * time)) * fade
    elif mode in ("ramp", "rampTone"):
        # A multi-second attack has low-frequency energy but no authored drums.
        envelope = np.clip(time / 3.7, 0, 1) * np.minimum(1, (spec["duration"] - time) / 1.1)
        wave = np.sin(2 * np.pi * spec["pitch"] * time + .17) * envelope
        if mode == "rampTone":
            wave += .27 * np.sin(2 * np.pi * (389 + spec["pitch"]) * time) * fade
    elif mode == "tone":
        wave = np.sin(2 * np.pi * spec["pitch"] * time + .13) * fade
    elif mode in ("dc", "dcQuiet"):
        wave[:] = 1
        if mode == "dcQuiet":
            wave += rng.normal(0, .0002, length)
    elif mode == "quiet":
        wave = rng.normal(0, .4, length)
    elif mode in ("swell", "swellClap"):
        # Smooth broad-band swells remain negative synthesis identities.
        envelope = np.sin(np.pi * np.clip(time / spec["duration"], 0, 1)) ** 4
        wave = rng.normal(0, .25, length) * envelope
    if mode in ("clap", "swellClap"):
        for requested in np.arange(.467, spec["duration"] - .4, .83):
            sample = round((requested + rng.uniform(-.038, .038)) * sample_rate)
            confound_onsets.append(sample)
            local_time = np.arange(round(.13 * sample_rate)) / sample_rate
            burst = np.zeros(len(local_time))
            for offset in (0., .013, .028):
                relative = np.maximum(0, local_time - offset)
                envelope = (local_time >= offset) * np.exp(-relative / .008)
                burst += rng.normal(size=len(local_time)) * envelope
            burst = _normalize(burst) * rng.uniform(.53, 1.)
            count = min(len(burst), length - sample)
            wave[sample:sample + count] += burst[:count]
    return gain * wave, confound_onsets


def generate_corpus_v2(output_dir, seed=20261010, sample_rate=22050):
    """Create a new 24-track develop/holdout corpus; never replace a directory.

    Same seed, version, sample rate and NumPy version reproduce WAV bytes and
    annotation events. Timestamps intentionally record actual generation time.
    """
    if type(seed) is not int or seed < 0:
        raise ValueError("Synthetic seed must be a nonnegative integer")
    if type(sample_rate) is not int or not 16000 <= sample_rate <= 192000:
        raise ValueError("Synthetic sample rate must be an integer between 16000 and 192000 Hz")
    requested_output = Path(output_dir)
    if requested_output.exists() or requested_output.is_symlink():
        raise FileExistsError(f"Synthetic output already exists: {requested_output}")
    output = requested_output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    generated_at = timestamp()
    tracks = []
    for index, spec in enumerate(_specifications()):
        track_seed = seed + 2027 * (index + 1)
        schedule_rng = np.random.default_rng(track_seed)
        timbre_rng = np.random.default_rng(track_seed + 1000003)
        confound_rng = np.random.default_rng(track_seed + 2000003)
        count = round(spec["duration"] * sample_rate)
        samples, confound_onsets = _confound(spec, sample_rate, confound_rng, count)
        scheduled = _schedule(spec, sample_rate, schedule_rng)
        events = []
        for item in scheduled:
            wave = _voice(item, sample_rate, timbre_rng, spec["pitch"])
            gain = spec["drumGain"] * item["velocityScalar"] * {"kick": 1., "snare": .83, "hihat": .55}[item["class"]]
            start = item["sampleIndex"]
            length = min(len(wave), len(samples) - start)
            samples[start:start + length] += gain * wave[:length]
            events.append({"time": start / sample_rate, "class": item["class"], "subclass": item["subclass"],
                           "confidence": 1., "provider": PROVIDER,
                           "attributes": {"sampleIndex": start, "generatorIdentity": item["class"],
                                          "velocityScalar": item["velocityScalar"], "preNormalizationGain": gain}})
        peak = float(np.max(np.abs(samples)))
        scale = min(1., .92 / peak) if peak else 1.
        samples *= scale
        audio_path = output / (spec["id"] + ".wav")
        annotation_path = output / (spec["id"] + ".annotation.json")
        _write_float_wave(audio_path, samples, sample_rate)
        audio = load_audio(audio_path, spec["id"])
        generator = {"version": VERSION, "seed": seed, "trackSeed": track_seed,
                     "timbreSeed": track_seed + 1000003, "confoundSeed": track_seed + 2000003,
                     "sampleRate": sample_rate, "numpyVersion": np.__version__,
                     "soundfileVersion": sf.__version__, "libsndfileVersion": sf.__libsndfile_version__,
                     "specification": spec, "specificationHash": SPECIFICATION_HASH,
                     "scheduleVersion": SCHEDULE_VERSION, "scheduledEvents": scheduled,
                     "confoundOnsetSampleIndices": confound_onsets,
                     "peakNormalizationScale": scale, "truthScope": TRUTH_SCOPE}
        parameters = {"eventClasses": list(CLASSES), "completeEventClasses": list(CLASSES),
                      "groundTruthReviewed": True, "generator": generator,
                      "source": "Plexus independently authored procedural v2 generator",
                      "license": "Project-generated research fixtures"}
        annotation = empty_analysis(audio.metadata, provenance(PROVIDER, VERSION, parameters, "ground_truth", generated_at))
        annotation["events"] = events
        annotation["tags"] = ["synthetic-generator-defined-identities", "shared-procedural-family",
                              "no-external-recordings-or-weights", "not-real-drum-recognition-ground-truth"]
        write_json(annotation_path, validate(annotation))
        tracks.append({"trackId": spec["id"], "groupId": "independent-procedural-v2-" + spec["id"],
                       "split": spec["split"], "audioPath": audio_path.name,
                       "annotationPath": annotation_path.name, "contentHash": audio.metadata["contentHash"]})
    dataset = {"schemaVersion": "1.0.0", "datasetId": "synthetic-drums-v2",
               "rights": {"reviewed": True, "trainingAllowed": True, "evaluationAllowed": True,
                          "source": "Plexus independently authored procedural v2 generator",
                          "license": "Project-generated research fixtures",
                          "reviewNote": "No external recordings/weights; truth is shared procedural-family synthesis identity only"},
               "tracks": tracks}
    path = output / "dataset.json"
    write_json(path, validate(dataset, "drum-dataset"))
    return path
