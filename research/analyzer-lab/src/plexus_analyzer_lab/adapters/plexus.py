import json
import re
import subprocess
import tempfile
from pathlib import Path

from ..canonical import empty_analysis
from ..config import LAB_ROOT, REPO_ROOT
from ..contracts import validate
from ..provenance import provenance
from .base import ProviderFailure


def algorithm_version():
    text = (REPO_ROOT / "src/analyzer/constants.ts").read_text(encoding="utf-8")
    return re.search(r"ANALYSIS_ALGORITHM_VERSION\s*=\s*(\d+)", text).group(1)


def canonicalize(raw, metadata, parameters, run_timestamp):
    parameters = {**parameters, "eventClasses": ["onset"], "eventSemantics": "grid-gated visual impact"}
    result = empty_analysis(metadata, provenance("plexus", f"algorithm-{algorithm_version()}", parameters,
                                                "plexus_prediction", run_timestamp))
    timing = result["timing"]
    timing.update(tempo=raw["bpm"], tempoCandidates=[{"bpm": c["bpm"], "score": c["score"]} for c in raw["tempoCandidates"]],
                  beats=raw["beats"], downbeats=raw["barStarts"],
                  confidence={**raw["timingConfidence"], "downbeat": raw["downbeatConfidence"]})
    track = raw["trackAnalysis"]
    timing["bars"] = [{"start": b["start"], "end": min(b["end"], metadata["duration"])} for b in track["bars"]]
    # BeatEvent types express visual impact only. Intensity is NOT a calibrated probability.
    result["events"] = [{"time": e["time"], "class": "onset", "subclass": f"visualImpact:{e['type']}",
                         "confidence": None, "provider": "plexus", "attributes": {"intensity": e["intensity"]}}
                        for e in raw["events"] if e["time"] <= metadata["duration"]]
    result["sections"] = [{"start": s["start"], "end": min(s["end"], metadata["duration"]),
                           "label": s["label"], "confidence": None, "provider": "plexus"}
                          for s in track["sections"] if s["start"] <= metadata["duration"]]
    result["artifacts"] = [{"kind": "raw-analysis", "path": "plexus.raw.json"},
                           {"kind": "boundary-candidates", "data": track.get("boundaryCandidates", [])},
                           {"kind": "novelty-peaks", "data": track.get("noveltyPeaks", [])}]
    result["tags"] = ["grid-gated-visual-onset-evidence", "spectral-heuristics-not-source-truth"]
    return validate(result)


class PlexusAdapter:
    def analyze(self, audio, output_dir, config, run_timestamp):
        output_dir = Path(output_dir).resolve()
        # PCM never survives this provider invocation, including timeout/failure.
        with tempfile.TemporaryDirectory(prefix="pcm-", dir=output_dir) as temp:
            pcm = Path(temp) / "mono.f32le"
            audio.samples.astype("<f4").tofile(pcm)
            request = {"pcmPath": str(pcm), "sampleRate": audio.sample_rate, "options": config["plexus"]}
            try:
                process = subprocess.run(["node", str(LAB_ROOT / "bridge/run-plexus-analysis.mjs")],
                                         input=json.dumps(request), text=True, capture_output=True,
                                         timeout=config["timeoutSeconds"], cwd=REPO_ROOT)
            except subprocess.TimeoutExpired as exc:
                raise ProviderFailure("Plexus bridge timeout", stderr=str(exc.stderr or "")) from exc
            except FileNotFoundError as exc:
                raise ProviderFailure("Node unavailable", status="unavailable") from exc
            self.diagnostics = {"exitCode": process.returncode, "stderr": process.stderr}
            if process.returncode:
                raise ProviderFailure("Plexus bridge failed", exit_code=process.returncode, stderr=process.stderr)
            raw = json.loads(process.stdout)
            (output_dir / "plexus.raw.json").write_text(json.dumps(raw, allow_nan=False), encoding="utf-8")
            return canonicalize(raw, audio.metadata, config["plexus"], run_timestamp)
