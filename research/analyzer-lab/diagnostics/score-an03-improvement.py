"""Score retained AN-03 output at unchanged C2 tolerances. --input JSON --output NEW_JSON."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

LAB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAB / "src"))
from plexus_analyzer_lab.metrics.events import event_metrics

TOLERANCES = [.01, .02, .025, .03, .05, .07]


def score(source, output):
    if output.exists(): raise FileExistsError("Score must be new")
    raw = source.read_bytes()
    data = json.loads(raw)
    rows = []
    for case in data["cases"]:
        row = {k: case[k] for k in ["spec", "duration", "negativeStart", "pcmSha256", "truthSha256"]}
        if case["negativeStart"] is not None:
            row["negative"] = {p: sum(t >= case["negativeStart"] for t in times) for p, times in case["eventTimes"].items()}
        else:
            truth = [i / case["spec"]["sampleRate"] for i in case["truthSamples"]]
            row["curves"] = {p: [event_metrics(truth, times, tolerance) for tolerance in TOLERANCES]
                             for p, times in case["eventTimes"].items()}
        rows.append(row)
    totals = {}
    for family in ["isolated", "mixture", "density"]:
        totals[family] = {}
        for provider in ["plexusV1", "predictiveV2", "librosa512"]:
            metrics = [c["curves"][provider][2] for c in rows if c["spec"]["family"] == family]
            if any(m["status"] != "available" for m in metrics): raise ValueError("Missing evidence")
            totals[family][provider] = {k: sum(m[k] for m in metrics) for k in ["referenceCount", "estimatedCount", "matchedCount", "missedCount", "falsePositiveCount"]}
    negatives = [c for c in rows if c["spec"]["family"] == "negative"]
    totals["negative"] = {p: sum(c["negative"][p] for c in negatives) for p in ["plexusV1", "predictiveV2", "librosa512"]}
    with output.open("x", encoding="utf-8") as stream:
        json.dump({"inputSha256": hashlib.sha256(raw).hexdigest(), "tolerances": TOLERANCES,
                   "totalsAt25ms": totals, "negativeExposureSeconds": sum(c["duration"] - c["negativeStart"] for c in negatives), "cases": rows}, stream, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps(totals))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    score(args.input, args.output)
