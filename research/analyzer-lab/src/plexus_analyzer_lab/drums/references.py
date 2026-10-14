"""Task-relevant library/production onset measurements against scheduled truth."""
import json
from pathlib import Path

from ..config import load_config
from ..contracts import validate
from ..metrics.events import event_metrics
from ..reports.json_report import write_json
from ..runner import analyze
from .dataset import load_dataset, observation, signature, verify_identity
from .experiment import _micro
from .synthetic_v2 import SPECIFICATION_HASH


def benchmark_references(manifest_path, output_dir, split="test"):
    output = Path(output_dir).resolve()
    if output.exists():
        raise ValueError("Music reference benchmark output must be new")
    dataset = load_dataset(manifest_path, "evaluation")
    if dataset["datasetId"] != "synthetic-drums-v2":
        raise ValueError("Reference onset truth is defined only for synthetic-drums-v2")
    tracks = [t for t in dataset["tracks"] if t["split"] == split]
    if not tracks:
        raise ValueError("Reference benchmark split has no tracks")
    # This onset truth definition belongs specifically to the authored v2 corpus.
    # Arbitrary MIDI/human annotations do not establish complete raw-onset truth.
    for track in tracks:
        audio, annotation = observation(track)
        if (annotation["provenance"]["provider"] != "plexus-procedural-drums-v2"
                or annotation["provenance"]["evidenceType"] != "ground_truth"):
            raise ValueError("Reference onset benchmark requires reviewed procedural v2 truth")
        generator = annotation["provenance"]["parameters"].get("generator", {})
        if generator.get("specificationHash") != SPECIFICATION_HASH or generator.get("sampleRate") != audio.sample_rate:
            raise ValueError("Reference generator specification/clock differs")
        indices = generator.get("confoundOnsetSampleIndices")
        if not isinstance(indices, list) or any(type(i) is not int or not 0 <= i < len(audio.samples) for i in indices):
            raise ValueError("Reference confound onsets require bounded sample indices")
    output.mkdir(parents=True, exist_ok=False)
    report = {"schemaVersion": "1.0.0", "datasetId": dataset["datasetId"], "manifestHash": dataset["manifestHash"],
              "split": split, "tracks": [], "tolerance": 0.05,
              "evaluationDomain": "[1.0, duration-0.25): excludes initial/final file envelopes",
              "truthDefinition": "Unique scheduled drum hits and explicit confound-burst sample onsets. "
                                 "Continuous tones/slow ramps/noise swells have no authored attacks in this domain.",
              "interpretation": "Raw library estimates are validated against generator truth per task. "
                                "Librosa onsets do not identify drums. Plexus events are accepted visual impacts; "
                                "their recall is not a complete raw-onset contract. No tempo truth on irregular fixtures."}
    for track in tracks:
        audio, annotation = observation(track)
        generator = annotation["provenance"]["parameters"]["generator"]
        end = audio.metadata["duration"] - 0.25
        truth = sorted({e["time"] for e in annotation["events"]}
                       | {i / audio.sample_rate for i in generator["confoundOnsetSampleIndices"]})
        truth = [t for t in truth if 1 <= t < end]
        run = analyze(track["audioPath"], providers=["plexus", "librosa"], config=load_config(),
                      runs_dir=output / "measurements", track_id=track["trackId"])
        manifest = validate(json.loads((run / "manifest.json").read_text(encoding="utf-8")), "run-manifest")
        verify_identity({"metadata": manifest["track"]}, audio.metadata)
        # Recheck the underlying audio/annotation after the runner's separate
        # decode, so neither changed files nor stale canonical artifacts score.
        observation(track)
        protocol = {k: manifest[k] for k in ("environment", "configHash")}
        if "measurementProtocol" not in report:
            report["measurementProtocol"] = protocol
        elif report["measurementProtocol"] != protocol:
            raise ValueError("Reference measurement source/environment/config changed")
        entry = {**signature(track), "measurement": str(run.relative_to(output)), "referenceOnsets": truth,
                 "providers": {}}
        for provider in ("plexus", "librosa"):
            result = manifest["providers"][provider]
            if result["status"] != "success":
                entry["providers"][provider] = {"status": "not_available", "reason": result.get("reason", result["status"])}
                continue
            canonical = validate(json.loads((run / result["canonical"]).read_text(encoding="utf-8")))
            verify_identity(canonical, audio.metadata)
            if canonical["provenance"]["provider"] != provider:
                raise ValueError("Reference canonical provider identity differs")
            if canonical["events"] is None:
                entry["providers"][provider] = {"status": "not_available", "reason": "Provider onset events unsupported"}
                continue
            onsets = [e["time"] for e in canonical["events"] if 1 <= e["time"] < end]
            entry["providers"][provider] = {"provenance": canonical["provenance"],
                 "metrics": event_metrics(truth, onsets, 0.05),
                 "validity": "comparison_to_known_synthetic_truth", "estimatedOnsets": onsets}
        report["tracks"].append(entry)
    report["byProvider"] = {provider: _micro([t["providers"][provider]["metrics"] for t in report["tracks"]
                            if "metrics" in t["providers"][provider]]) for provider in ("plexus", "librosa")}
    report["partial"] = any("metrics" not in t["providers"][p] for t in report["tracks"] for p in ("plexus", "librosa"))
    report["coverage"] = {p: {"availableTracks": sum("metrics" in t["providers"][p] for t in report["tracks"]),
                             "requestedTracks": len(tracks)} for p in ("plexus", "librosa")}
    write_json(output / "report.json", report)
    lines = ["# Musical onset reference measurements", "", report["interpretation"], "", report["truthDefinition"], "",
             "| Provider | Reference | Estimated | Matched | Precision | Recall | F |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for provider, metric in report["byProvider"].items():
        values = [str(metric[k]) for k in ("referenceCount", "estimatedCount", "matchedCount")]
        values += [f"{metric[k]:.4f}" if k in metric else "unavailable" for k in ("precision", "recall", "fMeasure")]
        lines.append(f"| {provider} | " + " | ".join(values) + " |")
    lines += ["", "Partial provider coverage: " + str(report["partial"]),
              "Per-track raw predictions, provider versions, timings and false hits are retained. This is onset evidence; no library drum classification or irregular-track BPM correctness is asserted.", ""]
    (output / "report.md").write_text("\n".join(lines), encoding="utf-8")
    return output, report
