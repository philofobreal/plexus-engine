"""Stable future source activity frame metric interface."""


def evaluate(reference, estimated, config=None):
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing or unsupported source activity"}
    return {"status": "unsupported", "reason": "Source-activity metrics require declared source identities and frame alignment"}
