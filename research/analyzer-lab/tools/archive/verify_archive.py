"""Targeted retention checks; no full suite, training, installation, or build."""
import argparse
import ast
import subprocess
import sys
from pathlib import Path
from _common import digest, fresh_directory, read_json, repository, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True, type=Path, help="Fresh diagnostics directory")
    parser.add_argument("--node", default="node")
    parser.add_argument("--tonal-smoke", action="store_true", help="2-second 440 Hz current-analyzer replay; requires existing lab dependencies")
    parser.add_argument("--historical-evidence-dir", type=Path, help="Optional explicit original log/paired evidence directory")
    parser.add_argument("--record-output", type=Path, help="Optional fresh compact record separate from generated diagnostics")
    args = parser.parse_args()
    root, archive = repository(args.root), Path(__file__).parent.resolve()
    if args.record_output and (args.record_output.exists() or args.record_output.is_symlink()):
        raise FileExistsError("--record-output must be a fresh file")
    output = fresh_directory(args.output)
    checks = []
    schemas = root / "research/analyzer-lab/schemas"
    before = {path.name: digest(path) for path in schemas.glob("*.json")}

    def run(name, arguments, expected=0):
        result = subprocess.run(arguments, cwd=root, text=True, capture_output=True)
        if result.returncode != expected:
            raise RuntimeError(f"{name}: exit {result.returncode}, expected {expected}\n{result.stderr}")
        checks.append({"name": name, "command": arguments, "exitCode": result.returncode})

    def tool(name, *arguments, expected=0):
        run(name + " " + " ".join(map(str, arguments[:2])), [sys.executable, str(archive / name), *map(str, arguments)], expected)

    for path in archive.glob("*.py"):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        if path.name != "_common.py":
            tool(path.name, "--help")
    inventory = read_json(archive / "history-20261010/inventory.json")
    for entry in inventory["authoredPrograms"]:
        source = archive / "history-20261010" / entry["snapshot"]
        if digest(source) != entry["sha256"]:
            raise ValueError(f"Source snapshot hash mismatch: {source}")
        if entry["originalRelativePath"].endswith(".py"):
            ast.parse(source.read_text(encoding="utf-8"), filename=entry["originalRelativePath"])
    checks.append({"name": "21 retained source byte identities", "count": len(inventory["authoredPrograms"]), "passed": True})
    run("Node syntax", [args.node, "--check", str(archive / "measure_tonal_sustain.mjs")])
    for mode in ("initial-contracts", "initial-drums"):
        tool("schema_snapshot.py", "--root", root, "--mode", mode, "--output", output / mode)
    if not (output / "initial-contracts/canonical-analysis.schema.json").is_file():
        raise ValueError("Initial schema generator omitted canonical schema")
    tool("schema_snapshot.py", "--root", root, "--mode", "initial-v2", "--input",
         output / "initial-drums/drum-model.schema.json", "--output", output / "initial-v2")
    base = subprocess.check_output(["git", "show", "HEAD:tests/fixtures/analyzer/analysis-result.schema.json"], cwd=root)
    with (output / "base-analysis.schema.json").open("xb") as stream:
        stream.write(base)
    tool("schema_snapshot.py", "--root", root, "--mode", "minimize-an01", "--input", output / "base-analysis.schema.json", "--output", output / "minimize")
    patched = read_json(output / "minimize/analysis-result.schema.json")
    if "featureClock" not in patched["$defs"]["trackAnalysis"]["properties"] or "rmsAmplitude" not in patched["$defs"]["trackSection"]["properties"]:
        raise ValueError("Minimal stage omitted requested contract fields")
    tool("schema_snapshot.py", "--root", root, "--mode", "update-an01", "--input", output / "base-analysis.schema.json",
         "--schema-dir", schemas, "--output", output / "update")
    # Repeating the same output must fail before mutating it.
    prior = digest(output / "initial-contracts/canonical-analysis.schema.json")
    tool("schema_snapshot.py", "--root", root, "--mode", "initial-contracts", "--output", output / "initial-contracts", expected=1)
    if digest(output / "initial-contracts/canonical-analysis.schema.json") != prior:
        raise ValueError("Output collision altered an existing artifact")
    existing_record = output / "existing.json"
    write_json(existing_record, {"preserve": True})
    prior = digest(existing_record)
    tool("model_validation.py", "--model", root / "research/analyzer-lab/models/drums-v2-development.json", "--output", existing_record, expected=1)
    if digest(existing_record) != prior:
        raise ValueError("Exclusive JSON writer overwrote an existing artifact")
    tool("model_validation.py", "--model", root / "research/analyzer-lab/models/drums-v2-development.json", "--output", output / "validation-metadata.json")
    metadata = read_json(output / "validation-metadata.json")
    if any("weights" in trial for trial in metadata["baselineTrials"]):
        raise ValueError("Metadata inspector leaked fitted parameters")
    if args.tonal_smoke:
        tool("measure_tonal_sustain.py", "--root", root, "--output", output / "tonal", "--duration", 2,
             "--sample-rate", 44100, "--frequency", 440, "--node", args.node)
        tone = read_json(output / "tonal/report.json")
        if len(tone["records"]) != 1 or tone["baselineFeatureExtractorHash"] is not None:
            raise ValueError("Current-only tonal replay contract mismatch")
    if args.historical_evidence_dir:
        evidence = args.historical_evidence_dir.resolve()
        tool("compare_failures.py", "--baseline-log", evidence / "baseline-check/baseline-test.log", "--current-log", evidence / "an01-node-accepted.log",
             "--expected-failures", 10, "--output", output / "failures.json")
        tool("summarize_an01.py", "--node-log", evidence / "an01-node-accepted.log", "--baseline-log", evidence / "baseline-check/baseline-test.log",
            "--python-log", evidence / "an01-python-final.log", "--integration-log", evidence / "an01-integration-final.log",
            "--build-log", evidence / "an01-build-accepted.log", "--paired-review", evidence / "an01-paired/regression-review.json",
            "--initial-paired", evidence / "an01-paired-initial.json", "--summary-input", root / "research/analyzer-lab/fixtures/an01-signal-contract.summary.json",
            "--output", output / "an01-replay.json")
        tool("check_identity.py", "--root", root, "--checkout", evidence / "baseline-check/checkout", "--ref",
             read_json(evidence / "baseline-check/identity.json")["commit"], "--output", output / "identity.json")
    if before != {path.name: digest(path) for path in schemas.glob("*.json")}:
        raise ValueError("Live schemas changed during isolated replay")
    result = {"status": "targeted_retention_checks", "interpreter": sys.executable,
        "checks": checks, "liveSchemaHashesUnchanged": True,
        "limitations": ["No full suite/build/training or physical timing measurement; historical replay checks are not new analyzer generalization evidence."]}
    write_json(output / "verification.json", result)
    if args.record_output:
        write_json(args.record_output, {"schemaVersion": "retention-validation-1.0", "checkedAt": "2026-10-10",
            "status": result["status"], "pythonVersion": sys.version.split()[0],
            "nodeVersion": subprocess.check_output([args.node, "--version"], text=True).strip(),
            "checkCount": len(checks), "checks": [{key: value.replace(str(root), "<repo>").replace(str(output), "<diagnostics>") if key == "name" else value
                for key, value in check.items() if key != "command"} for check in checks],
            "programHashes": {path.name: digest(path) for path in archive.glob("*.py")},
            "tonalLoaderHash": digest(archive / "measure_tonal_sustain.mjs"),
            "inventoryHash": digest(archive / "history-20261010/inventory.json"),
            "liveSchemaHashesUnchanged": True, "dependenciesInstalled": False,
            "command": "<existing lab Python> tools/archive/verify_archive.py --root <repo> --output <fresh diagnostics> --historical-evidence-dir <supplied originals> --tonal-smoke --record-output <fresh record>",
            "limitations": result["limitations"]})
    print(f"Completed {len(checks)} targeted checks in {output}")


if __name__ == "__main__":
    main()
