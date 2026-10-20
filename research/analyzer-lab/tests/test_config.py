import json

import pytest

from plexus_analyzer_lab.config import load_config


@pytest.mark.parametrize("override", [
    {"minimumAgreement": True}, {"seed": False}, {"beatTolerance": -0.1},
    {"librosa": {"hopLength": 0}}, {"librosa": {"tightness": float("inf")}},
    {"plexus": {"hopSize": 0}}, {"plexus": {"requestId": -1}},
    {"plexus": {"unknown": 1}}, {"unknownKey": 1},
])
def test_invalid_config_rejected_before_provider_execution(tmp_path, override):
    path = tmp_path / "config.json"
    path.write_text(json.dumps(override), encoding="utf-8")
    with pytest.raises(ValueError):
        load_config(path)
