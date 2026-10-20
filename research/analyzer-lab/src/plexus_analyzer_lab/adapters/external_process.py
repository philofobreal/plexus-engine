"""One JSON request on stdin; one JSON response on stdout, no shell expansion."""
import json
import subprocess
from pathlib import Path

import soundfile as sf

from ..contracts import validate
from .base import ProviderFailure


class ExternalProcessAdapter:
    def __init__(self, provider_id, options):
        self.provider_id = provider_id
        self.options = options
        self.diagnostics = {}

    def analyze(self, audio, output_dir, config, run_timestamp):
        command = self.options.get("command")
        if not isinstance(command, list) or not command or not all(isinstance(s, str) and s for s in command):
            raise ProviderFailure("No provider command configured", status="unavailable")
        output_dir = Path(output_dir).resolve()
        destination = output_dir / f"{self.provider_id}.canonical.json"
        # A normalized mono WAV gives external providers exactly the same PCM/clock.
        normalized_audio = output_dir / f"{self.provider_id}.input.wav"
        sf.write(normalized_audio, audio.samples, audio.sample_rate, subtype="FLOAT")
        request = {"protocolVersion": "1.0.0", "audioPath": str(normalized_audio),
                   "outputPath": str(destination), "metadata": audio.metadata,
                   "timestamp": run_timestamp, "options": self.options.get("options", {})}
        try:
            try:
                process = subprocess.run(command, input=json.dumps(request), capture_output=True, text=True,
                                         timeout=config["timeoutSeconds"], cwd=output_dir)
            except FileNotFoundError as exc:
                raise ProviderFailure("Provider executable unavailable", status="unavailable") from exc
            except subprocess.TimeoutExpired as exc:
                raise ProviderFailure("Provider timeout", stderr=str(exc.stderr or "")) from exc
            self.diagnostics = {"exitCode": process.returncode, "stderr": process.stderr}
            if process.returncode:
                raise ProviderFailure("Provider process failed", exit_code=process.returncode, stderr=process.stderr)
            response = json.loads(process.stdout)
            path = Path(response["resultPath"]).resolve()
            if path != destination:
                raise ProviderFailure("Provider resultPath must equal requested outputPath", exit_code=0, stderr=process.stderr)
            result = validate(json.loads(path.read_text(encoding="utf-8")))
            if result["metadata"] != audio.metadata or result["provenance"]["provider"] != self.provider_id:
                raise ProviderFailure("Provider returned a different audio identity or provider")
            if result["provenance"]["evidenceType"] != "oracle_prediction":
                raise ProviderFailure("External oracle must return oracle_prediction evidence")
            self.diagnostics["providerDiagnostics"] = response.get("diagnostics", {})
            return result
        finally:
            normalized_audio.unlink(missing_ok=True)
