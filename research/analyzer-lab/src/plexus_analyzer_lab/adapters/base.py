from typing import Protocol

from ..audio import Audio


class Adapter(Protocol):
    def analyze(self, audio: Audio, output_dir, config: dict, run_timestamp: str) -> dict:
        """Return a canonical result, or raise at this provider's failure boundary."""
        ...


class ProviderFailure(RuntimeError):
    def __init__(self, reason, *, exit_code=None, stderr="", status="failed"):
        super().__init__(reason)
        self.exit_code = exit_code
        self.stderr = stderr
        self.status = status
