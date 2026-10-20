"""Cumulative regression inventory and execution. Standard library only; never installs tools.

Run from any directory: python regression.py inventory|check|full --report PATH.
Inventory changes are append-only. A changed protected file needs a per-path migration
document naming both hashes, reviewer and reason; predecessor bytes remain in immutable ZIPs.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
import xml.etree.ElementTree as ET

SCHEMA = "regression-harness-1.0"
IGNORED_DIRS = {".git", "node_modules", ".venv", ".cache", "__pycache__", ".pytest_cache",
                "dist", "dist-ssr", "graphify-out", "models", "checkpoints", "runs"}
SCRIPT = Path(__file__).resolve()


def digest(data):
    return sha256(data).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write_new(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write("\n")


def is_test(path):
    return bool(re.search(r"\.test\.(?:mjs|cjs|js|ts)$", path.name)
                or (path.suffix == ".py" and (path.name.startswith("test_") or path.name.endswith("_test.py"))))


def discover(root):
    """Preserve all test trees, including detached historical mirrors and their helpers."""
    root = Path(root).resolve()
    records = {}
    for directory, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
        for name in sorted(files):
            path = Path(directory) / name
            rel = path.relative_to(root).as_posix()
            parts = Path(rel).parts
            protected = ("tests" in parts or "fixtures" in parts or is_test(path)
                         or rel.startswith("research/analyzer-lab/src/")
                         or rel.startswith("research/analyzer-lab/bridge/")
                         or rel.startswith("research/analyzer-lab/tools/archive/")
                         or rel.startswith("research/analyzer-lab/fixtures/")
                         or rel.startswith("research/analyzer-lab/diagnostics/")
                         or rel.startswith("scripts/")
                         or rel in ("package.json", "research/analyzer-lab/pyproject.toml", "pytest.ini", "conftest.py")
                         or (rel.startswith("research/analyzer-lab/tools/harness/") and path.suffix in (".py", ".mjs"))
                         or rel == "research/analyzer-lab/tools/harness/known-failures.json")
            if not protected or path.suffix in (".pyc", ".log"):
                continue
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                raise ValueError(f"Protected file must be local regular source: {rel}")
            data = path.read_bytes()
            text = data.decode("utf-8-sig", errors="replace")
            category = "support"
            if is_test(path):
                category = ("node-test" if rel.startswith("tests/") and path.suffix in (".mjs", ".cjs", ".js", ".ts")
                            else "lab-test" if rel.startswith("research/analyzer-lab/tests/") and path.suffix == ".py"
                            else "historical-test")
            records[rel] = {"sha256": digest(data), "bytes": len(data), "category": category,
                            "testDeclarations": len(re.findall(r"\btest\s*\(|\bdef\s+test_", text)),
                            "assertionMarkers": len(re.findall(r"\bassert(?:\.|\s)|pytest\.raises", text))}
    return dict(sorted(records.items()))


def declarations(root):
    package = read_json(Path(root) / "package.json")
    scripts = {name: package.get("scripts", {}).get(name) for name in ("build", "test")}
    if not all(isinstance(value, str) and value.strip() for value in scripts.values()):
        raise ValueError("Declared npm build and test scripts are required")
    return scripts


def coverage(root, records, scripts):
    script = scripts["test"]
    tokens = shlex.split(script.replace("\\", "/"))
    authoritative = tokens == ["node", "scripts/run-tests.mjs"]
    if authoritative:
        node = discover_runtime(root)["node"]
        result = subprocess.run([node, "scripts/run-tests.mjs", "--list"], cwd=root,
                                capture_output=True, text=True, check=False,
                                env={key: value for key, value in os.environ.items() if key not in ("NODE_OPTIONS", "NODE_TEST_CONTEXT")})
        if result.returncode:
            raise ValueError("Authoritative recursive test inventory failed: " + result.stderr)
        paths = json.loads(result.stdout)
        if not isinstance(paths, list) or any(not isinstance(path, str) for path in paths):
            raise ValueError("Authoritative --list must return path array")
        covered = [path.replace("\\", "/") for path in paths]
        if len(covered) != len(set(covered)):
            raise ValueError("Duplicate authoritative test paths")
        active = {path for path, record in records.items() if record["category"] == "node-test"}
        if set(covered) != active:
            raise ValueError("Authoritative recursive runner excludes or invents active test files")
        return {"declaredNodeFiles": sorted(active), "supplementalNodeFiles": [],
                "labFiles": sorted(path for path, record in records.items() if record["category"] == "lab-test"),
                "historicalUnexecuted": sorted(path for path, record in records.items() if record["category"] == "historical-test")}
    if tokens[:2] != ["node", "--test"] or any(token in script for token in ("&&", ";", "|")):
        raise ValueError("Cannot prove npm test file coverage; use a direct node --test script")
    if any(token.startswith(("--test-name-pattern", "--test-skip-pattern", "--test-only")) for token in tokens):
        raise ValueError("npm test must not exclude test cases")
    covered = set()
    for token in tokens[2:]:
        if token.startswith("-"):
            if token.startswith(("--test-reporter=", "--test-concurrency=", "--test-timeout=")):
                continue
            raise ValueError(f"Unproven Node test option: {token}")
        if Path(token).is_absolute() or ".." in Path(token).parts:
            raise ValueError("npm test paths must stay inside the repository")
        covered.update(p.relative_to(root).as_posix() for p in Path(root).glob(token) if p.is_file())
    active = {path for path, record in records.items() if record["category"] == "node-test"}
    return {"declaredNodeFiles": sorted(active & covered), "supplementalNodeFiles": sorted(active - covered),
            "labFiles": sorted(path for path, record in records.items() if record["category"] == "lab-test"),
            "historicalUnexecuted": sorted(path for path, record in records.items() if record["category"] == "historical-test")}


def load_manifests(store):
    paths = sorted((Path(store) / "inventories").glob("v*.json"))
    manifests = []
    previous_hash = None
    for index, path in enumerate(paths, 1):
        value = read_json(path)
        if value.get("schemaVersion") != SCHEMA or value.get("version") != index or value.get("previousManifestHash") != previous_hash:
            raise ValueError(f"Broken immutable inventory chain: {path.name}")
        if manifests:
            old = manifests[-1]["files"]
            if set(old) - set(value["files"]):
                raise ValueError("Inventory chain deleted a predecessor file")
            changed = {name for name in old if old[name]["sha256"] != value["files"][name]["sha256"]}
            entries = {entry["path"]: entry for entry in value["migrations"]}
            if set(entries) != changed or len(entries) != len(value["migrations"]):
                raise ValueError("Inventory chain contains an unreviewed source replacement")
            for name, entry in entries.items():
                if (entry.get("predecessorSha256") != old[name]["sha256"]
                        or entry.get("replacementSha256") != value["files"][name]["sha256"]
                        or not str(entry.get("reviewedBy", "")).strip() or not str(entry.get("reviewedReason", "")).strip()):
                    raise ValueError("Inventory chain contains invalid migration evidence")
        archive = Path(store) / value["archive"]
        if not archive.resolve().is_relative_to(Path(store).resolve()):
            raise ValueError("Inventory archive escapes retention store")
        if not archive.is_file() or digest(archive.read_bytes()) != value["archiveHash"]:
            raise ValueError(f"Changed/missing predecessor source archive: {path.name}")
        with zipfile.ZipFile(archive) as bundle:
            if set(bundle.namelist()) != set(value["files"]):
                raise ValueError("Inventory archive file set differs from manifest")
            for name, record in value["files"].items():
                if digest(bundle.read(name)) != record["sha256"]:
                    raise ValueError(f"Inventory source hash mismatch: {name}")
        manifests.append(value)
        previous_hash = digest(path.read_bytes())
    return manifests


def inventory(root, store, migrations=None):
    root, store = Path(root).resolve(), Path(store).resolve()
    current, scripts = discover(root), declarations(root)
    planned = coverage(root, current, scripts)
    history = load_manifests(store)
    old = history[-1]["files"] if history else {}
    if set(old) - set(current):
        raise ValueError("Protected files cannot be deleted: " + ", ".join(sorted(set(old) - set(current))))
    changed = {name for name in old if old[name]["sha256"] != current[name]["sha256"]}
    migration_entries = migrations or []
    if len({entry.get("path") for entry in migration_entries}) != len(migration_entries):
        raise ValueError("Duplicate migration path")
    provided = {entry["path"]: entry for entry in migration_entries}
    if set(provided) != changed:
        raise ValueError("Changed files require exact per-path reviewed migrations: " + ", ".join(sorted(changed)))
    for name in changed:
        entry = provided[name]
        if (entry.get("predecessorSha256") != old[name]["sha256"]
                or entry.get("replacementSha256") != current[name]["sha256"]
                or not str(entry.get("reviewedBy", "")).strip()
                or not str(entry.get("reviewedReason", "")).strip()):
            raise ValueError(f"Incomplete reviewed migration: {name}")
    if history and current == old and scripts == history[-1]["scripts"]:
        return {"status": "unchanged", "version": history[-1]["version"], "coverage": planned}
    version = len(history) + 1
    archive_name = f"inventories/v{version:04d}.sources.zip"
    archive = store / archive_name
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as bundle:
        for name in current:
            data = (root / name).read_bytes()
            if digest(data) != current[name]["sha256"]:
                raise ValueError("Protected file changed while inventorying: " + name)
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            bundle.writestr(info, data)
    manifest = {"schemaVersion": SCHEMA, "version": version,
                "previousManifestHash": digest((store / "inventories" / f"v{version-1:04d}.json").read_bytes()) if history else None,
                "archive": archive_name, "archiveHash": digest(archive.read_bytes()), "scripts": scripts,
                "files": current, "migrations": migration_entries,
                "semanticPreservation": "Exact hashes are the gate; any replacement requires explicit reviewer/integration-owner review, not counts as proof."}
    write_new(store / "inventories" / f"v{version:04d}.json", manifest)
    return {"status": "created", "version": version, "files": len(current), "coverage": planned}


def check(root, store):
    records, scripts = discover(root), declarations(root)
    history = load_manifests(store)
    if not history:
        raise ValueError("Missing cumulative inventory; explicitly create it with inventory")
    old = history[-1]
    issues = []
    for name, record in old["files"].items():
        if name not in records:
            issues.append({"path": name, "reason": "deleted"})
        elif record["sha256"] != records[name]["sha256"]:
            issues.append({"path": name, "reason": "changed_without_reviewed_migration"})
    for name in sorted(set(records) - set(old["files"])):
        issues.append({"path": name, "reason": "new_file_requires_inventory_append"})
    if scripts != old["scripts"]:
        issues.append({"path": "package.json", "reason": "declared_scripts_changed"})
    planned = coverage(root, records, scripts)
    historical = []
    for path in planned["historicalUnexecuted"]:
        aliases = [name for name, record in records.items() if record["category"] in ("node-test", "lab-test")
                   and Path(name).name == Path(path).name and record["sha256"] == records[path]["sha256"]]
        historical.append({"path": path, "sha256": records[path]["sha256"], "exactActiveAliases": aliases,
                           "status": "historical-unexecuted", "reason": "Archived source; original execution context is not restored."})
    return {"schemaVersion": SCHEMA, "status": "passed" if not issues else "failed", "inventoryVersion": old["version"],
            "issues": issues, "files": records, "scripts": scripts, "coverage": planned, "historical": historical}


def signature(failure):
    value = dict(failure)
    message = str(value.get("message", ""))
    if value.get("code") == "EPERM" and value.get("syscall") == "rename":
        message = re.sub(r"'[^']*'", "'<PATH>'", message)
    value["message"] = " ".join(message.split())
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode())


def parse_node(log, root):
    failures, files, skipped, summaries, global_summaries = [], set(), [], [], []
    for line in log.splitlines():
        try:
            event = json.loads(line)
        except (ValueError, TypeError):
            continue
        if not isinstance(event, dict) or event.get("type") not in ("test:pass", "test:fail", "test:summary"):
            continue
        relative = None
        if event.get("file"):
            path = Path(event["file"])
            path = path.resolve() if path.is_absolute() else (Path(root) / path).resolve()
            relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
            files.add(relative)
        if event.get("skip") or event.get("todo"):
            skipped.append({"name": event.get("name"), "file": event.get("file"), "skip": event.get("skip"), "todo": event.get("todo")})
        if event["type"] == "test:fail":
            failure = event.get("failure") or {"message": "Missing structured error"}
            failures.append({"name": event.get("name"), "file": relative, "failure": failure, "signature": signature(failure)})
        if event["type"] == "test:summary" and event.get("counts"):
            summaries.append(event["counts"])
            if not event.get("file"):
                global_summaries.append(event["counts"])
    return {"failures": failures, "executedFiles": sorted(files), "skippedOrTodo": skipped, "summaries": summaries,
            "globalCounts": global_summaries[0] if len(global_summaries) == 1 else None}


def discover_runtime(root):
    root = Path(root)
    node = os.environ.get("PLEXUS_NODE") or shutil.which("node")
    if not node:
        candidate = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
        node = str(candidate) if candidate.is_file() else None
    if not node:
        raise ValueError("Node runtime unavailable; install nothing automatically")
    node = str(Path(node).resolve())
    npm_candidates = [Path(node).parent / "node_modules/npm/bin/npm-cli.js",
                      Path(node).parent.parent / "lib/node_modules/npm/bin/npm-cli.js"]
    npm_path = shutil.which("npm")
    if npm_path:
        npm_candidates.append(Path(npm_path).parent / "node_modules/npm/bin/npm-cli.js")
    npm = next((str(p.resolve()) for p in npm_candidates if p.is_file()), None)
    if not npm:
        raise ValueError("npm CLI unavailable beside discovered Node/npm; no dependency installation attempted")
    python = root / "research/analyzer-lab/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return {"node": node, "npm": npm, "python": str(python.resolve()) if python.is_file() else sys.executable}


def execute(command, cwd, env, log_path):
    start = time.monotonic()
    with Path(log_path).open("w", encoding="utf-8") as log:
        try:
            result = subprocess.run(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, check=False)
            code, error = result.returncode, None
        except OSError as exc:
            code, error = 127, str(exc)
    return {"command": command, "cwd": str(cwd), "exitCode": code, "error": error,
            "durationSeconds": time.monotonic() - start, "log": str(log_path),
            "logHash": digest(Path(log_path).read_bytes())}


EVIDENCE_EXCLUSIONS = ("history", "fullEvidenceHash", "fullEvidenceHashConvention")


def evidence_digest(report):
    value = {key: value for key, value in report.items() if key not in EVIDENCE_EXCLUSIONS}
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def retain_run(store, report, run_id):
    # Full file inventories and per-test output remain in the explicit report/cache.
    report["fullEvidenceHash"] = evidence_digest(report)
    report["fullEvidenceHashConvention"] = ("SHA256 of UTF-8 JSON, sorted keys, separators (',', ':'), ensure_ascii=false; "
                                             "excluded root keys: " + ", ".join(EVIDENCE_EXCLUSIONS))
    summary = json.loads(json.dumps({key: value for key, value in report.items()
                                   if key not in ("inventory", "historical")}))
    for command in summary["commands"]:
        command.pop("nodeResults", None)
    if "sourceIdentity" in summary:
        summary["sourceIdentity"].pop("files", None)
    gate = report["inventory"]
    summary["inventoryVersion"] = gate["inventoryVersion"]
    summary["inventoryFilesHash"] = digest(json.dumps(gate["files"], sort_keys=True).encode())
    summary["historicalUnexecutedCount"] = len(gate["historical"])
    path = Path(store) / "history" / f"{run_id}.json"
    write_new(path, summary)
    report["history"] = str(path)
    return report


def fresh_temporary_locations(root):
    """Short, unique workspace-local paths; pytest owns its still-absent p directory."""
    base = Path(root) / "research/analyzer-lab/.cache"
    base.mkdir(parents=True, exist_ok=True)
    temporary_root = base / ("t" + uuid.uuid4().hex[:12])
    temporary_root.mkdir(exist_ok=False)
    native = temporary_root / "n"
    native.mkdir()
    pytest_temp = temporary_root / "p"
    if pytest_temp.exists():
        raise ValueError("Fresh pytest base unexpectedly exists; refusing destructive reuse")
    return {"root": str(temporary_root), "native": str(native), "pytest": str(pytest_temp),
            "pytestInitiallyAbsent": True}


def node_coverage(parsed, expected):
    expected = sorted(set(expected))
    executed = parsed["executedFiles"]
    missing = sorted(set(expected) - set(executed))
    counts = parsed["globalCounts"]
    complete = (not missing and counts is not None and not parsed["skippedOrTodo"]
                and not any(counts.get(key, 0) for key in ("cancelled", "skipped", "todo")))
    return {"counts": counts, "expectedFileCount": len(expected), "executedFileCount": len(executed),
            "executedFiles": executed, "expectedFilesHash": digest(json.dumps(expected, separators=(",", ":")).encode()),
            "executedFilesHash": digest(json.dumps(executed, separators=(",", ":")).encode()),
            "fileHashConvention": "SHA256 of sorted unique relative paths, UTF-8 compact JSON array, ensure_ascii=true",
            "missingFiles": missing, "unexpectedFiles": sorted(set(executed) - set(expected)),
            "coverageStatus": "complete" if complete else "incomplete"}


def parse_lab(path):
    root = ET.parse(path).getroot()
    cases = root.findall(".//testcase")
    return {"tests": len(cases), "executedFiles": sorted({case.get("file", "").replace("\\", "/") for case in cases}),
            "failures": [{"name": case.get("name"), "file": case.get("file"), "message": child.get("message"),
                          "kind": child.tag} for case in cases for child in case if child.tag in ("failure", "error", "skipped")]}


def source_identity(root):
    records = {}
    for base in (Path(root) / "src", Path(root) / "research/analyzer-lab/src"):
        if not base.exists():
            continue
        for directory, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
            for name in sorted(files):
                path = Path(directory) / name
                if path.suffix in (".ts", ".tsx", ".js", ".mjs", ".py", ".json"):
                    records[path.relative_to(root).as_posix()] = digest(path.read_bytes())
    for name in ("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
                 "research/analyzer-lab/pyproject.toml"):
        path = Path(root) / name
        if path.is_file():
            records[name] = digest(path.read_bytes())
    return {"hash": digest(json.dumps(records, sort_keys=True).encode()), "fileCount": len(records), "files": records}


def full(root, store, *, run=execute, runtime=None):
    root, store = Path(root).resolve(), Path(store).resolve()
    gate = check(root, store)
    report = {"schemaVersion": SCHEMA, "kind": "full", "startedAt": datetime.now(timezone.utc).isoformat(),
              "inventory": gate, "commands": [], "status": "failed", "knownFailures": [], "unknownFailures": []}
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:12]
    if gate["status"] != "passed":
        return retain_run(store, report, run_id)
    runtime = runtime or discover_runtime(root)
    report["runtime"] = runtime
    report["sourceIdentity"] = source_identity(root)
    cache = root / "research/analyzer-lab/.cache/regression-harness" / run_id
    cache.mkdir(parents=True, exist_ok=False)
    reporter = (root / "research/analyzer-lab/tools/harness/node-reporter.mjs").as_uri()
    env = dict(os.environ)
    for name in ("PYTEST_ADDOPTS", "NODE_OPTIONS", "NODE_TEST_CONTEXT"):
        env.pop(name, None)
    env.update({"FORCE_COLOR": "0", "NO_COLOR": "1", "PYTHONDONTWRITEBYTECODE": "1"})
    temporary = fresh_temporary_locations(root)
    report["temporaryLocations"] = temporary
    env.update({name: temporary["native"] for name in ("TEMP", "TMP", "TMPDIR")})
    env["PATH"] = str(Path(runtime["node"]).parent) + os.pathsep + env.get("PATH", "")
    commands = [("build", [runtime["node"], runtime["npm"], "run", "build"], root),
                ("node", [runtime["node"], runtime["npm"], "test", "--", "--test-reporter=" + reporter], root)]
    extras = gate["coverage"]["supplementalNodeFiles"]
    if extras:
        commands.append(("node-supplement", [runtime["node"], "--test", "--test-reporter=" + reporter, *extras], root))
    commands.append(("lab", [runtime["python"], "-m", "pytest", "tests", "-q", "-p", "no:cacheprovider",
                             "-o", "junit_family=xunit1",
                             "--basetemp=" + temporary["pytest"], "--junitxml=" + str(cache / "pytest.xml")],
                     root / "research/analyzer-lab"))
    known = read_json(store / "known-failures.json")
    if known.get("sourceSummary"):
        summary_path = root / known["sourceSummary"]
        if digest(summary_path.read_bytes()) != known["sourceSummaryHash"]:
            raise ValueError("Known baseline source summary identity changed")
    if any(signature(item["failure"]) != item["signature"] for item in known["failures"]):
        raise ValueError("Known baseline assertion signature corrupted")
    available = Counter((item["file"], item["name"], item["signature"]) for item in known["failures"])
    for label, command, cwd in commands:
        result = run(command, cwd, env, cache / f"{label}.log")
        result["stage"] = label
        report["commands"].append(result)
        if label.startswith("node"):
            parsed = parse_node(Path(result["log"]).read_text(encoding="utf-8", errors="replace"), root)
            result["nodeResults"] = parsed
            for failure in parsed["failures"]:
                key = (failure["file"], failure["name"], failure["signature"])
                target = report["knownFailures"] if available[key] > 0 else report["unknownFailures"]
                target.append({"stage": label, **failure})
                available[key] -= 1
            expected = gate["coverage"]["declaredNodeFiles"] if label == "node" else extras
            compact = node_coverage(parsed, expected)
            result["nodeCoverage"] = compact
            if compact["coverageStatus"] != "complete":
                report["unknownFailures"].append({"stage": label, "reason": "Incomplete executable coverage",
                                                  "missingFiles": compact["missingFiles"], "skippedOrTodo": parsed["skippedOrTodo"]})
            if result["exitCode"] != 0 and not parsed["failures"]:
                report["unknownFailures"].append({"stage": label, "reason": "Nonzero exit without structured failures"})
            if any(summary.get("cancelled", 0) or summary.get("skipped", 0) or summary.get("todo", 0) for summary in parsed["summaries"]):
                report["unknownFailures"].append({"stage": label, "reason": "Summary contains unexecuted cases"})
            if any(summary.get("failed", 0) for summary in parsed["summaries"]) and not parsed["failures"]:
                report["unknownFailures"].append({"stage": label, "reason": "Summary failures lack assertion evidence"})
        elif label == "lab":
            xml_path = cache / "pytest.xml"
            result["pytestXmlHash"] = digest(xml_path.read_bytes()) if xml_path.is_file() else None
            try:
                lab = parse_lab(xml_path)
                result["labResults"] = lab
                expected = {path.removeprefix("research/analyzer-lab/") for path in gate["coverage"]["labFiles"]}
                missing = sorted(expected - set(lab["executedFiles"]))
                if missing or not lab["tests"] or lab["failures"]:
                    report["unknownFailures"].append({"stage": label, "reason": "Incomplete or failing lab coverage",
                                                      "missingFiles": missing, "failures": lab["failures"]})
            except (OSError, ET.ParseError) as exc:
                report["unknownFailures"].append({"stage": label, "reason": "Missing/invalid pytest XML evidence", "error": str(exc)})
            if result["exitCode"] != 0:
                report["unknownFailures"].append({"stage": label, "reason": "Nonzero lab suite exit", "exitCode": result["exitCode"]})
        elif result["exitCode"] != 0:
            report["unknownFailures"].append({"stage": label, "reason": "Nonzero build exit", "exitCode": result["exitCode"]})
    # Detect mutation during execution, including golden overwrite and newly introduced tests.
    after = check(root, store)
    report["afterInventory"] = {"status": after["status"], "issues": after["issues"]}
    source_after = source_identity(root)
    report["sourceChangedDuringRun"] = source_after["hash"] != report["sourceIdentity"]["hash"]
    report["status"] = "passed" if (after["status"] == "passed" and not report["unknownFailures"] and not report["knownFailures"]
                                        and not report["sourceChangedDuringRun"]
                                        and all(command["exitCode"] == 0 for command in report["commands"])) else "failed"
    report["knownFailuresNeverMaskExit"] = True
    return retain_run(store, report, run_id)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("inventory", "check", "full"))
    parser.add_argument("--root", type=Path, default=SCRIPT.parents[4])
    parser.add_argument("--store", type=Path)
    parser.add_argument("--migrations", type=Path, help="Explicit reviewed per-path replacement records")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    store = args.store or root / "research/analyzer-lab/tools/harness"
    # A pre-existing result is never overwritten, and no expensive command runs first.
    if args.report and args.report.exists():
        print(json.dumps({"schemaVersion": SCHEMA, "status": "failed",
                          "error": "Report already exists; choose a new path: " + str(args.report)}))
        return 1
    try:
        if args.mode == "inventory":
            report = inventory(root, store, read_json(args.migrations) if args.migrations else None)
        elif args.mode == "check":
            report = check(root, store)
        else:
            report = full(root, store)
        code = 1 if report.get("status") == "failed" else 0
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as exc:
        report, code = {"schemaVersion": SCHEMA, "status": "failed", "error": str(exc)}, 1
    if args.report:
        try:
            write_new(args.report, report)
        except OSError as exc:
            print(json.dumps({"schemaVersion": SCHEMA, "status": "failed", "error": str(exc)}))
            return 1
    visible = {key: value for key, value in report.items() if key not in ("files", "inventory", "sourceIdentity")}
    if "commands" in visible:
        visible["commands"] = [{key: value for key, value in command.items() if key not in ("nodeResults", "labResults")}
                               for command in visible["commands"]]
    print(json.dumps(visible, indent=2, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
