import json

from .config import LAB_ROOT


def load_registry():
    data = json.loads((LAB_ROOT / "configs/oracle-registry.json").read_text(encoding="utf-8"))
    providers = data["providers"]
    ids = [p["id"] for p in providers]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate provider ids")
    required = {"id", "displayName", "providerVersion", "executionMode", "pythonRequirement", "capabilities",
                "codeLicense", "modelLicense", "modelLicenseSource", "datasetDependencies", "usagePolicy", "enabledByDefault"}
    for provider in providers:
        if required - provider.keys():
            raise ValueError(f"Invalid provider manifest: {provider['id']}")
        if provider["executionMode"] not in ("in-process", "external-process"):
            raise ValueError("Unknown provider execution mode")
    return {provider["id"]: provider for provider in providers}


def capabilities():
    return json.loads((LAB_ROOT / "configs/capability-matrix.json").read_text(encoding="utf-8"))
