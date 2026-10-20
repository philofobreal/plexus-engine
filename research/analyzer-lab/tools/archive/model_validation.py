"""Inspect validation metadata or reproduce a declared validation-only freeze.

Reads no test report. Does not fit, edit, or emit model weights. The command cannot
prove that a human never previously inspected test results.
"""
import argparse
import json
from pathlib import Path
from _common import digest, read_json, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, action="append", type=Path, help="Baseline model trial, repeatable")
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--mode", choices=("inspect", "freeze"), default="inspect")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.mode == "freeze" and args.candidate is None:
        raise ValueError("freeze requires --candidate")
    trials = []
    for path in args.model:
        value = read_json(path)
        selection = value["validationSelection"]
        metrics = [selection["byClass"][name] for name in ("kick", "snare", "hihat")]
        key = [sum(m["fMeasure"] for m in metrics) / 3, min(m["fMeasure"] for m in metrics),
               sum(m["precision"] for m in metrics) / 3, value["ridge"]]
        trials.append({"model": path.name, "fileHash": digest(path), "modelChecksum": value["modelChecksum"],
            "ridge": value["ridge"], "selectionKey": key, "validationSelection": selection,
            "hyperparameterSelection": value.get("hyperparameterSelection")})
    result = {"mode": args.mode, "rule": "validation macro F, worst-class F, macro precision, higher ridge",
              "baselineTrials": trials, "testReportsReadByThisCommand": False,
              "interpretation": "Validation metadata only; training/test isolation needs separate protocol and model-contract checks."}
    if args.mode == "freeze":
        candidate = read_json(args.candidate)
        result.update(chosenBaseline=max(trials, key=lambda value: value["selectionKey"]),
            candidateModel=args.candidate.name, candidateFileHash=digest(args.candidate),
            candidateModelChecksum=candidate["modelChecksum"], candidateValidationSelection=candidate.get("hyperparameterSelection"))
    write_json(args.output, result)
    print(json.dumps({"mode": args.mode, "trials": len(trials), "output": str(args.output)}))


if __name__ == "__main__":
    main()
