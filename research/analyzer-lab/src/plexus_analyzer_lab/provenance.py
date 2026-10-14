import importlib.metadata
import platform
import subprocess
from datetime import datetime, timezone

from .config import REPO_ROOT
from .contracts import SCHEMA_VERSION


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def version(package):
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return None


def git_commit():
    try:
        result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, timeout=10)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def provenance(provider, tool_version, parameters, evidence_type, run_timestamp):
    return {"provider": provider, "toolVersion": tool_version, "parameters": parameters,
            "evidenceType": evidence_type, "timestamp": run_timestamp, "schemaVersion": SCHEMA_VERSION,
            "modelIdentifier": None, "modelVersion": None, "modelChecksum": None}


def environment():
    return {"python": platform.python_version(), "platform": platform.platform(),
            "dependencies": dict(sorted((distribution.metadata["Name"], distribution.version)
                                        for distribution in importlib.metadata.distributions()))}
