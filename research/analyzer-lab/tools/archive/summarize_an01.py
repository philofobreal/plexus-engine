"""Recheck the frozen AN-01 historical protocol from explicit evidence inputs.

The exact original summary authoring script is preserved as inert source. This
tool emits a replay record, not a replacement for the original experiment record.
"""
import argparse
from pathlib import Path
from _common import digest, read_json, write_json
from compare_failures import parse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("node-log", "baseline-log", "python-log", "integration-log", "build-log", "paired-review", "initial-paired", "summary-input"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    text = lambda path: path.read_text(encoding="utf-8-sig")
    current, baseline = parse(text(args.node_log)), parse(text(args.baseline_log))
    checks = {
        "completedNodeTotals": {"tests", "pass", "fail", "duration_ms"} <= current["summary"].keys(),
        "historicalTenFailures": current["summary"].get("fail") == baseline["summary"].get("fail") == 10,
        "sameFailureNames": current["failureNames"] == baseline["failureNames"],
        "sameAssertionMessages": current["assertionMessages"] == baseline["assertionMessages"],
        "renameEPERMRecorded": current["renameEPERM"] and baseline["renameEPERM"],
        "historicalLab205Passed": "205 passed" in text(args.python_log),
        "historicalIntegration64Passed": parse(text(args.integration_log))["summary"].get("pass") == 64
            and parse(text(args.integration_log))["summary"].get("fail") == 0,
        "buildCompleted": "built in" in text(args.build_log),
    }
    initial, paired = read_json(args.initial_paired), read_json(args.paired_review)
    checks["originalBaselineNoDrift"] = all(not item["baselineCommittedDrift"] for item in initial["observations"])
    checks["nineKnownFixtures"] = len(paired["observations"]) == 9
    checks["acceptedCountOnlyChanges"] = all(not item["committedDrift"] and
        {change["path"] for change in item["changes"]} == ({"counts.frames", "counts.bars"} if item["id"] == "techno-140" else {"counts.frames"})
        for item in paired["observations"])
    summary = read_json(args.summary_input)
    write_json(args.output, {"schemaVersion": "historical-an01-replay-1.0", "status": "historical_evidence_rechecked_not_new_validation",
        "checks": checks, "allChecksSatisfied": all(checks.values()),
        "inputHashes": {name: digest(value) for name, value in vars(args).items() if name != "output"},
        "originalSourceHash": summary.get("sourceHash"), "originalStatus": summary.get("status"),
        "limitations": summary.get("limitations", []),
        "interpretation": "Exact known historical expectations; never use these hardcoded counts as acceptance for a new experiment. No test/build/analyzer command was run."})
    return not all(checks.values())


if __name__ == "__main__":
    raise SystemExit(main())
