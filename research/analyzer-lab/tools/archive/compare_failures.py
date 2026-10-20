"""Compare explicit Node test logs; this does not bless known failures."""
import argparse
import re
from pathlib import Path
from _common import digest, write_json


def parse(text):
    return {
        "summary": {k: float(v) if k == "duration_ms" else int(v)
                    for k, v in re.findall(r"^[ℹ#]\s*(tests|pass|fail|duration_ms)\s+([\d.]+)", text, re.M)},
        "failureNames": sorted(set(re.findall(r"^✖ (.+) \([\d.]+ms\)$", text, re.M))),
        "assertionMessages": sorted(re.findall(r"^\s*AssertionError \[ERR_ASSERTION\]: (.+)$", text, re.M)),
        "renameEPERM": "EPERM: operation not permitted, rename" in text,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-log", required=True, type=Path)
    parser.add_argument("--current-log", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--expected-failures", type=int, help="Explicit historical protocol expectation")
    args = parser.parse_args()
    baseline = parse(args.baseline_log.read_text(encoding="utf-8-sig"))
    current = parse(args.current_log.read_text(encoding="utf-8-sig"))
    if not all({"tests", "pass", "fail"} <= item["summary"].keys() for item in (baseline, current)):
        raise ValueError("Both logs must contain final test totals")
    identical = all(baseline[k] == current[k] for k in ("failureNames", "assertionMessages"))
    counts_match = baseline["summary"]["fail"] == current["summary"]["fail"]
    expected = args.expected_failures is None or all(item["summary"]["fail"] == args.expected_failures for item in (baseline, current))
    write_json(args.output, {"baseline": baseline, "current": current,
        "inputHashes": {"baseline": digest(args.baseline_log), "current": digest(args.current_log)},
        "identicalFailures": identical, "countsMatch": counts_match, "expectedCountsMatch": expected,
        "interpretation": "Failure equivalence is historical evidence, not a passing suite or a generalization result."})
    return not (identical and counts_match and expected)


if __name__ == "__main__":
    raise SystemExit(main())
