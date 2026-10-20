"""Measure known generated tone plateaus with explicit optional baseline source.

An optional saved FeatureExtractor is a partial source substitution, not a full
old-version replay. No comparison requires an ignored .cache file.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path
from _common import digest, fresh_directory, repository, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True, type=Path, help="Fresh output directory")
    parser.add_argument("--baseline-feature-extractor", type=Path)
    parser.add_argument("--sample-rate", type=int, action="append")
    parser.add_argument("--frequency", type=float, action="append")
    parser.add_argument("--duration", type=float, default=6)
    parser.add_argument("--with-librosa", action="store_true", help="Use existing optional research dependency; no install")
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    root = repository(args.root)
    if args.duration < 2 or not args.duration < float("inf"):
        raise ValueError("Duration must be finite and at least two seconds")
    rates, frequencies = args.sample_rate or [44100, 48000], args.frequency or [55, 110, 220, 440, 1000]
    if any(rate < 1000 or rate > 384000 for rate in rates) or any(not 0 < hz < min(rates) / 2 for hz in frequencies):
        raise ValueError("Invalid sample rate/frequency")
    if len(set(rates)) != len(rates) or len(set(frequencies)) != len(frequencies):
        raise ValueError("Duplicate rate/frequency would reuse output paths")
    if args.baseline_feature_extractor is not None and not args.baseline_feature_extractor.is_file():
        raise ValueError("Explicit baseline FeatureExtractor does not exist")
    sys.path.insert(0, str(root / "research/analyzer-lab/src"))
    import numpy as np
    from plexus_analyzer_lab.drums.synthetic import _write_float_wave
    from plexus_analyzer_lab.runner import source_fingerprint
    output = fresh_directory(args.output)
    loader = Path(__file__).with_suffix(".mjs").resolve()
    records = []
    for rate in rates:
        for hz in frequencies:
            time = np.arange(round(rate * args.duration)) / rate
            audio = (.3 * np.sin(2 * np.pi * hz * time) * np.minimum(1, time / .1)).astype(np.float32)
            name = f"tone-{hz!r}-{rate}"
            wave, pcm = output / f"{name}.wav", output / f"{name}.f32le"
            _write_float_wave(wave, audio, rate)
            with pcm.open("xb") as stream:
                stream.write(audio.astype("<f4").tobytes())
            responses = {}
            for label, baseline in [("current", None)] + ([("baseline-substitution", args.baseline_feature_extractor)] if args.baseline_feature_extractor else []):
                request = {"root": str(root), "pcmPath": str(pcm), "sampleRate": rate}
                if baseline:
                    request["baselineFeatureExtractor"] = str(baseline.resolve())
                result = subprocess.run([args.node, str(loader)], cwd=root, input=json.dumps(request),
                    text=True, capture_output=True, check=True)
                response = json.loads(result.stdout)
                write_json(output / f"{name}.{label}.json", response)
                responses[label] = response
            record = {"sampleRate": rate, "frequencyHz": hz, "truthPlateauOnsetsAfterOneSecond": 0,
                      "falsePlateauHits": {name: sum(event["time"] >= 1 for event in response["events"]) for name, response in responses.items()},
                      "pcmHash": digest(pcm)}
            if "baseline-substitution" in responses:
                record["timingUnchanged"] = all(responses["current"][key] == responses["baseline-substitution"][key]
                    for key in ("beats", "bpm", "barStarts", "timingConfidence"))
            if args.with_librosa:
                from plexus_analyzer_lab.adapters.librosa import LibrosaAdapter
                from plexus_analyzer_lab.audio import load_audio
                from plexus_analyzer_lab.config import load_config
                from plexus_analyzer_lab.provenance import timestamp
                oracle = LibrosaAdapter().analyze(load_audio(wave), output, load_config(), timestamp())
                write_json(output / f"{name}.librosa.canonical.json", oracle)
                record["librosaPlateauOnsets"] = sum(event["time"] >= 1 for event in oracle["events"])
            records.append(record)
    write_json(output / "report.json", {"records": records, "sourceHash": source_fingerprint(), "loaderHash": digest(loader),
        "baselineFeatureExtractorHash": digest(args.baseline_feature_extractor) if args.baseline_feature_extractor else None,
        "interpretation": "Own generated plateau absence is known; library/analyzer outputs remain predictions. Partial source substitution is not full historical algorithm parity."})
    print(output)


if __name__ == "__main__":
    main()
