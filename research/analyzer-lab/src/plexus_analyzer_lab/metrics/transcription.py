"""Stable future note transcription metric interface."""


def evaluate(reference, estimated, config=None):
    if reference is None or estimated is None:
        return {"status": "not_available", "reason": "Missing or unsupported note transcription"}
    return {"status": "unsupported", "reason": "Note onset/pitch/offset matching is not implemented in this vertical slice"}
