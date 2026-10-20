"""Capture available authored cache scripts and compact historical evidence.

Snapshots are inert text. This never executes old scripts, copies a checkout,
reads fitted weights, or reclassifies historical observations as fresh evidence.
"""
import argparse
import re
from pathlib import Path
from _common import digest, fresh_directory, read_json, repository, write_json
from compare_failures import parse

ACTIVE = {
    "build_schemas.py": "schema_snapshot.py", "create_drum_schemas.py": "schema_snapshot.py",
    "create_drum_v2_schema.py": "schema_snapshot.py", "minimize-an01-schema.py": "schema_snapshot.py",
    "update-an01-schemas.py": "schema_snapshot.py", "review_files.py": "review_files.py",
    "summarize-an01.py": "summarize_an01.py", "inspect_validation.py": "model_validation.py",
    "freeze_drum_models.py": "model_validation.py", "pristine_build.py": "pristine_build.py",
    "measure_tonal_sustain.py": "measure_tonal_sustain.py", "measure_tonal_sustain.mjs": "measure_tonal_sustain.mjs",
    "check-identity.mjs": "check_identity.py", "compare-failures.mjs": "compare_failures.py",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--evidence-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="Fresh directory containing sources/ and records")
    args = parser.parse_args()
    root = repository(args.root)
    evidence = args.evidence_dir.resolve()
    candidates = sorted(p for p in evidence.iterdir() if p.is_file() and p.suffix in {".py", ".mjs", ".js", ".ps1", ".sh"})
    for relative in ("baseline-check/check-identity.mjs", "baseline-check/compare-failures.mjs", "analyzer-audit-evaluation/dsp-diagnostics.mjs"):
        if (evidence / relative).is_file():
            candidates.append(evidence / relative)
    output = fresh_directory(args.output)
    sources = output / "sources"
    sources.mkdir()
    records = []
    for path in candidates:
        relative = path.relative_to(evidence).as_posix()
        name = relative.replace("/", "__") + ".txt"
        destination = sources / name
        with destination.open("xb") as stream:
            stream.write(path.read_bytes())
        records.append({"originalRelativePath": relative, "sha256": digest(path), "bytes": path.stat().st_size,
            "retention": "exact_inert_source_snapshot", "snapshot": "sources/" + name,
            "safeRefactor": ACTIVE.get(path.name),
            "reason": "Authored research code retained. Refactor is explicit-input and fresh-output where listed; original publication paths and assertions remain historical only."})
    disposable = []
    suffixes = {".py", ".mjs", ".js", ".ts", ".ps1", ".sh"}
    for directory, reason in (("baseline-check/checkout", "Temporary copied clean-HEAD checkout; reconstruct from Git, do not duplicate production source"),
                              ("pristine-build", "Temporary tracked-source build copy; reconstruct from Git"),
                              ("build-baseline", "Generated Vite bundles; recreate with existing build tools")):
        base = evidence / directory
        if base.exists():
            paths = [p for p in base.rglob("*") if p.is_file() and p.suffix in suffixes]
            disposable.append({"originalRelativePath": directory, "programCount": len(paths), "retention": "disposable_generated_or_copied", "reason": reason})
    stubs = [p for base in evidence.glob("pytest*") if base.is_dir() for p in base.rglob("*.py")]
    disposable.append({"originalRelativePath": "pytest*/**/*.py", "programCount": len(stubs), "retention": "disposable_generated_test_stubs", "reason": "External-provider fixture code is already authored in versioned tests; runtime copies are not independent programs"})
    copied = evidence / "FeatureExtractor.algorithm5.ts"
    if copied.exists():
        disposable.append({"originalRelativePath": copied.name, "sha256": digest(copied), "retention": "do_not_duplicate_production_source", "reason": "Historical comparison substituted this saved production source; exact original comparison requires its recorded bytes or matching Git revision, not today's implementation"})
    logs = []
    for path in sorted(evidence.glob("*.log")) + sorted((evidence / "baseline-check").glob("*.log")):
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        pytest = re.findall(r"(?:^|\n)([^\n]*\b\d+ passed[^\n]*)", text)
        build = re.findall(r"[^\n]*built in[^\n]*", text)
        logs.append({"originalRelativePath": path.relative_to(evidence).as_posix(), "sha256": digest(path), "bytes": path.stat().st_size,
            "node": parse(text), "pytestFinalLines": pytest[-1:], "buildFinalLines": build[-1:],
            "interpretation": "Observed historical log extract; absence of totals is not success. No command was rerun for this capture."})
    evidence_records = {}
    for name in ("baseline-check/comparison.json", "baseline-check/identity.json", "doctor.final.json", "drum-freeze-decision.json"):
        path = evidence / name
        if path.is_file():
            evidence_records[name] = {"sha256": digest(path), "record": read_json(path)}
    existing = []
    for name in ("an01-signal-contract.summary.json", "analyzer-principles-audit.summary.json", "drum-v2-cycle.summary.json"):
        path = root / "research/analyzer-lab/fixtures" / name
        if path.is_file():
            value = read_json(path)
            existing.append({"path": path.relative_to(root).as_posix(), "sha256": digest(path),
                "schemaVersion": value.get("schemaVersion"), "status": value.get("status"),
                "sourceHash": value.get("sourceHash"), "limitations": value.get("limitations", [])})
    write_json(output / "inventory.json", {"schemaVersion": "research-code-retention-1.0", "capturedAt": "2026-10-10",
        "scope": "Direct authored cache scripts, two baseline tools, original nested DSP diagnostic; no broad disk scan",
        "authoredPrograms": records, "disposable": disposable,
        "unrecoverableInlineCode": "Shell/REPL snippets without a surviving file cannot be recovered verbatim. Versioned corpus generators, comparison modules, tests and fixture summaries preserve available implementations; no missing source has been invented."})
    write_json(output / "historical-evidence.json", {"schemaVersion": "historical-evidence-capture-1.0", "capturedAt": "2026-10-10",
        "status": "historical_extract_not_current_validation", "logs": logs, "records": evidence_records,
        "versionedSummaries": existing,
        "limitations": ["Raw logs/cache are not versioned by this capture; hashes identify the available originals.",
                        "Known failures remain failures; historical comparison is not a passing-suite claim.",
                        "No recorded-music accuracy, model retraining, fresh benchmark, or physical latency evidence was produced.",
                        "Model-freeze metadata is retained; weights, audio, corpus data, holdout reports and temporary checkouts are excluded."]})
    print(f"Retained {len(records)} authored source snapshots; captured {len(logs)} log records in {output}")


if __name__ == "__main__":
    main()
