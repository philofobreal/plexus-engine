"""Keep oracle output, human annotation, and verified truth distinct."""

from enum import StrEnum


class EvidenceType(StrEnum):
    GROUND_TRUTH = "ground_truth"
    ORACLE_PREDICTION = "oracle_prediction"
    PSEUDO_LABEL = "pseudo_label"
    PLEXUS_PREDICTION = "plexus_prediction"
    HUMAN_ANNOTATION = "human_annotation"


def classify_evidence(value):
    """Validate a declared taxonomy value; do not infer truth from a provider."""
    return EvidenceType(value).value
