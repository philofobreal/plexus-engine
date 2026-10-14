"""Score the frozen 45-case AN-03 matrix without changing labels/tolerances.

--input RAW_JSON --output NEW_JSON. Missing/invalid prediction fails; negatives
have exposure/counts, never perfect F. Preserve all condition curves and strata.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB / "src"))
from plexus_analyzer_lab.metrics.events import event_metrics

PROVIDERS = ["plexusV1", "predictiveV2"]
TOLERANCES = [.01, .02, .025, .03, .05, .07]


def summarize(rows):
    groups = {}
    positives = [r for r in rows if "curves" in r]
    for bed in ["mono", "poly"]:
        for kind in ["noise", "tone"]:
            selected = [r for r in positives if r["spec"]["bed"] == bed and r["spec"]["kind"] == kind]
            groups[f"{bed}/{kind}"] = {}
            for provider in PROVIDERS:
                metrics = [r["curves"][provider][2] for r in selected]
                groups[f"{bed}/{kind}"][provider] = {k: sum(m[k] for m in metrics) for k in
                    ["referenceCount", "estimatedCount", "matchedCount", "missedCount", "falsePositiveCount"]}
    negatives = [r for r in rows if "negative" in r]
    return {"positiveStrataAt25ms": groups,
            "negativeCounts": {p: sum(r["negative"][p] for r in negatives) for p in PROVIDERS},
            "negativeExposureSeconds": sum(r["duration"] - r["negativeStart"] for r in negatives)}


def run(source, output):
    if output.exists(): raise FileExistsError("Output must be new")
    raw = source.read_bytes()
    data = json.loads(raw)
    if len(data["cases"]) != 45 or len({c["spec"]["id"] for c in data["cases"]}) != 45:
        raise ValueError("Incomplete frozen robustness coverage")
    rows = []
    for c in data["cases"]:
        fs = c["spec"]["sampleRate"]
        truth = [i / fs for i in c["truthSamples"]]
        for p in PROVIDERS:
            times = c["eventTimes"][p]  # Missing provider is an error, not [] success.
            if any(not 0 <= t < c["duration"] for t in times): raise ValueError("Invalid physical event clock")
        row = {k: c[k] for k in ["spec", "duration", "negativeStart", "pcmSha256", "truthSha256"]}
        if c["negativeStart"] is None:
            if not truth: raise ValueError("Positive truth missing")
            row["curves"] = {p: [event_metrics(truth, c["eventTimes"][p], tolerance) for tolerance in TOLERANCES] for p in PROVIDERS}
        else:
            if truth: raise ValueError("Negative truth contradiction")
            row["negative"] = {p: sum(t >= c["negativeStart"] for t in c["eventTimes"][p]) for p in PROVIDERS}
        rows.append(row)
    result = {"inputSha256": hashlib.sha256(raw).hexdigest(), "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "toleranceCurve": TOLERANCES, "summary": summarize(rows), "cases": rows,
              "scope": "Frozen synthetic conditions; no independent recording generalization or consumer acceptance"}
    with output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps(result["summary"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run(args.input, args.output)
