"""Stable future pitch/voicing metric interface."""


def evaluate(reference, estimated, config=None):
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing or unsupported pitch/voicing tracks"}
    return {"status": "unsupported", "reason": "Pitch/voicing evaluation requires declared frame alignment and source correspondence"}
