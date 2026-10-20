"""Retain the incomplete first placement validation; never relabel it successful."""
import importlib.util
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("placement_harness", root / "research/analyzer-lab/tools/harness/regression.py")
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
run = root / "research/analyzer-lab/.cache/regression-harness/20261014T204226-c6feaa67b25f"
node = harness.parse_node((run / "node.log").read_text(encoding="utf-8"), root)
known = json.loads((root / "research/analyzer-lab/tools/harness/known-failures.json").read_text(encoding="utf-8"))
signatures = {(f["file"], f["name"], f["signature"]) for f in known["failures"]}
old, new = [], []
for f in node["failures"]:
    (old if (f["file"], f["name"], f["signature"]) in signatures else new).append(f)
report = {"status": "failed-incomplete", "runId": run.name,
    "reason": "Native Librosa initialization stalled at first silence inference; interrupted after Node completion, before Python summary.",
    "nodeCounts": node["globalCounts"], "executedNodeFiles": node["executedFiles"],
    "knownFailures": old, "unknownFailures": new,
    "pythonStatus": "incomplete-no-final-test-summary", "pythonProgressDots": 37,
    "sourceIdentityAtTermination": harness.source_identity(root),
    "logs": {name: {"path": str(run / name), "sha256": hashlib.sha256((run / name).read_bytes()).hexdigest()}
             for name in ("build.log", "node.log", "lab.log")},
    "skippedTests": "No exclusions; incomplete run does not claim full Python coverage."}
target = root / "research/analyzer-lab/fixtures/onset-placement-first-validation-failed-01.json"
with target.open("x", encoding="utf-8") as stream:
    json.dump(report, stream, indent=2)
    stream.write("\n")
print(json.dumps({"status": report["status"], "known": len(old), "new": len(new), "nodeCounts": node["globalCounts"]}))
