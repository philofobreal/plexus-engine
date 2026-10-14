import json

from plexus_analyzer_lab.config import LAB_ROOT
from plexus_analyzer_lab.registry import load_registry, capabilities


def test_optional_providers_are_isolated_and_disabled():
    registry = load_registry()
    assert set(registry) == {"plexus", "librosa", "basic-pitch", "spleeter", "omnizart", "essentia", "msaf"}
    for key in set(registry) - {"plexus", "librosa"}:
        provider = registry[key]
        assert not provider["enabledByDefault"]
        assert provider["executionMode"] == "external-process"
        assert provider == json.loads((LAB_ROOT / "providers" / key / "provider.json").read_text(encoding="utf-8"))
        assert provider["licenseEvidence"]["checkedAt"] == "2026-10-10"
    assert registry["essentia"]["usagePolicy"] == "reference-only"
    assert registry["basic-pitch"]["modelLicense"] == "unknown"


def test_matrix_and_registry_are_distinct_contracts():
    matrix = capabilities()
    assert len(matrix["capabilities"]) == 16
    for capability in matrix["capabilities"]:
        assert all(p["id"] in load_registry() for p in capability["providers"])
