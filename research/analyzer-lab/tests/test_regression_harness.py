"""Harness failures must stay failures; no real npm suite is launched here."""
from __future__ import annotations

import importlib.util
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import zipfile

import pytest

MODULE = Path(__file__).parents[1] / "tools/harness/regression.py"
spec = importlib.util.spec_from_file_location("regression_harness", MODULE)
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)


def put(root, path, text):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target


@pytest.fixture
def repo(tmp_path):
    root = tmp_path / "repo"
    # Nested fake workspaces exercise the entire runner without MAX_PATH failures.
    if os.name == "nt":
        root = Path("\\\\?\\" + str(root))
    put(root, "package.json", json.dumps({"scripts": {"build": "fake-build", "test": "node --test tests/*.test.mjs"}}))
    put(root, "tests/base.test.mjs", "test('prior', () => { assert.ok(true); });\n")
    put(root, "tests/nested/new.test.mjs", "test('nested', () => { assert.ok(true); });\n")
    put(root, "tests/helpers/loader.mjs", "export const helper = 1;\n")
    put(root, "documents/tests/base.test.mjs", (root / "tests/base.test.mjs").read_text())
    put(root, "documents/tests/old.test.mjs", "test('old context', () => {});\n")
    put(root, "research/analyzer-lab/tests/test_prior.py", "def test_prior():\n    assert True\n")
    put(root, "research/analyzer-lab/pyproject.toml", "[tool.pytest.ini_options]\ntestpaths = ['tests']\n")
    put(root, "research/analyzer-lab/src/plexus_analyzer_lab/workflow.py", "def reusable():\n    return 1\n")
    put(root, "research/analyzer-lab/bridge/analyze.mjs", "export const bridge = 1;\n")
    put(root, "research/analyzer-lab/tools/archive/freeze.py", "def archive():\n    return 1\n")
    put(root, "research/analyzer-lab/fixtures/history/original.snapshot.json", '{"original": true}')
    put(root, "DEVELOPMENT.md", "Editable development notes.\n")
    put(root, "research/analyzer-lab/tools/harness/node-reporter.mjs", "export default async function* reporter() {}\n")
    store = root / "research/analyzer-lab/tools/harness"
    put(root, "research/analyzer-lab/tools/harness/known-failures.json", json.dumps({"failures": []}))
    return root, store


def freeze(repo):
    root, store = repo
    h.inventory(root, store)
    return h.check(root, store)


def test_recursive_inventory_aliases_and_no_duplicate_execution(repo):
    gate = freeze(repo)
    assert gate["status"] == "passed"
    assert gate["coverage"]["declaredNodeFiles"] == ["tests/base.test.mjs"]
    assert gate["coverage"]["supplementalNodeFiles"] == ["tests/nested/new.test.mjs"]
    assert "tests/helpers/loader.mjs" in gate["files"]
    assert gate["historical"][0]["exactActiveAliases"] == ["tests/base.test.mjs"]
    assert all(item["status"] == "historical-unexecuted" for item in gate["historical"])
    assert len(gate["coverage"]["historicalUnexecuted"]) == 2
    assert "DEVELOPMENT.md" not in gate["files"]


@pytest.mark.parametrize("path", ["tests/base.test.mjs", "tests/helpers/loader.mjs", "documents/tests/old.test.mjs",
                                 "research/analyzer-lab/src/plexus_analyzer_lab/workflow.py",
                                 "research/analyzer-lab/bridge/analyze.mjs",
                                 "research/analyzer-lab/tools/archive/freeze.py",
                                 "research/analyzer-lab/fixtures/history/original.snapshot.json"])
def test_deletion_and_shrink_blocked(repo, path):
    root, store = repo
    freeze(repo)
    target = root / path
    target.write_text("", encoding="utf-8")
    assert h.check(root, store)["status"] == "failed"
    with pytest.raises(ValueError, match="migrations"):
        h.inventory(root, store)
    target.unlink()
    with pytest.raises(ValueError, match="deleted"):
        h.inventory(root, store)


def test_reviewed_migration_retains_predecessor_bytes(repo):
    root, store = repo
    gate = freeze(repo)
    path = "tests/base.test.mjs"
    original = (root / path).read_bytes()
    put(root, path, "test('prior', helper);\n")
    entry = {"path": path, "predecessorSha256": gate["files"][path]["sha256"],
             "replacementSha256": h.digest((root / path).read_bytes()), "reviewedBy": "fixture-reviewer",
             "reviewedReason": "Same assertion moved into retained helper; semantic review recorded separately."}
    with pytest.raises(ValueError, match="Incomplete"):
        h.inventory(root, store, [{**entry, "reviewedReason": ""}])
    assert h.inventory(root, store, [entry])["version"] == 2
    assert h.check(root, store)["status"] == "passed"
    with zipfile.ZipFile(store / "inventories/v0001.sources.zip") as archive:
        assert archive.read(path) == original
    assert h.load_manifests(store)[1]["migrations"] == [entry]


def test_additions_append_and_old_manifests_remain_immutable(repo):
    root, store = repo
    freeze(repo)
    original = (store / "inventories/v0001.json").read_bytes()
    put(root, "tests/deeper/next.test.mjs", "test('next', () => {});\n")
    assert h.check(root, store)["issues"][-1]["reason"] == "new_file_requires_inventory_append"
    assert h.inventory(root, store)["version"] == 2
    assert (store / "inventories/v0001.json").read_bytes() == original
    assert h.inventory(root, store)["status"] == "unchanged"
    (store / "inventories/v0001.sources.zip").write_bytes(b"tampered")
    with pytest.raises(ValueError, match="predecessor"):
        h.check(root, store)


def test_exclusion_flags_rejected(repo):
    root, store = repo
    put(root, "package.json", json.dumps({"scripts": {"build": "fake", "test": "node --test --test-name-pattern=only tests/*.test.mjs"}}))
    with pytest.raises(ValueError, match="exclude"):
        h.inventory(root, store)


def test_authoritative_discovery_validates_all_paths(repo, monkeypatch):
    root, store = repo
    put(root, "package.json", json.dumps({"scripts": {"build": "fake", "test": "node scripts/run-tests.mjs"}}))
    put(root, "scripts/run-tests.mjs", "// authoritative fixture\n")
    monkeypatch.setattr(h, "discover_runtime", lambda root: {"node": "fake-node"})
    calls = []
    def listing(command, **kwargs):
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, json.dumps(["tests/base.test.mjs", "tests/nested/new.test.mjs"]), "")
    monkeypatch.setattr(h.subprocess, "run", listing)
    assert freeze(repo)["coverage"]["supplementalNodeFiles"] == []
    assert calls[0] == ["fake-node", "scripts/run-tests.mjs", "--list"]
    monkeypatch.setattr(h.subprocess, "run", lambda *args, **kwargs: subprocess.CompletedProcess(args[0], 0, '["tests/base.test.mjs"]', ""))
    with pytest.raises(ValueError, match="excludes"):
        h.check(root, store)


def fake_runner(root, *, failure=None, exit_code=0, missing=False, mutate=False):
    calls = []
    def run(command, cwd, env, log_path):
        calls.append((command, env, log_path))
        stage = log_path.stem
        lines = []
        if stage.startswith("node"):
            file = "tests/base.test.mjs" if stage == "node" else "tests/nested/new.test.mjs"
            if not missing:
                event = {"type": "test:fail" if failure and stage == "node" else "test:pass",
                         "name": "prior", "file": str(root / file)}
                if failure and stage == "node":
                    event["failure"] = failure
                lines.append(json.dumps(event))
                lines.append(json.dumps({"type": "test:summary", "counts": {"tests": 1}}))
        if stage == "lab":
            xml = next(arg.removeprefix("--junitxml=") for arg in command if arg.startswith("--junitxml="))
            Path(xml).write_text('<testsuites><testsuite><testcase name="test_prior" file="tests/test_prior.py" /></testsuite></testsuites>')
            if mutate:
                put(root, "tests/base.test.mjs", "// erased\n")
        log_path.write_text("\n".join(lines), encoding="utf-8")
        return {"command": command, "cwd": str(cwd), "exitCode": exit_code if stage == "node" else 0,
                "durationSeconds": 0, "log": str(log_path), "logHash": h.digest(log_path.read_bytes())}
    return run, calls


def setup_known(repo, failure):
    root, store = repo
    record = {"file": "tests/base.test.mjs", "name": "prior", "failure": failure, "signature": h.signature(failure)}
    put(root, "research/analyzer-lab/tools/harness/known-failures.json", json.dumps({"failures": [record]}))
    freeze(repo)


RUNTIME = {"node": "fake-node", "npm": "fake-npm", "python": "fake-python"}


def test_known_failure_never_masks_nonzero_and_logs_are_outside_inventory(repo):
    root, store = repo
    failure = {"message": "authored value mismatch 2 !== 4", "code": "ERR_ASSERTION", "actual": 2, "expected": 4, "operator": "strictEqual"}
    setup_known(repo, failure)
    run, calls = fake_runner(root, failure=failure, exit_code=1)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    assert report["status"] == "failed"
    assert len(report["knownFailures"]) == 1
    assert report["unknownFailures"] == []
    assert report["commands"][1]["nodeResults"]["failures"]
    assert [call[2].stem for call in calls] == ["build", "node", "node-supplement", "lab"]
    assert calls[1][0][:4] == ["fake-node", "fake-npm", "test", "--"]
    assert all(Path(call[1]["TEMP"]).is_relative_to(root) for call in calls)
    assert any(arg.startswith("--basetemp=") for arg in calls[-1][0])
    assert h.read_json(report["history"])["knownFailuresNeverMaskExit"] is True
    retained_first = Path(report["history"]).read_bytes()
    assert h.check(root, store)["status"] == "passed"
    second = h.full(root, store, run=run, runtime=RUNTIME)
    assert second["history"] != report["history"]
    assert calls[0][1]["TEMP"] != calls[4][1]["TEMP"]
    assert Path(report["history"]).read_bytes() == retained_first


def test_same_name_changed_assertion_is_unknown(repo):
    root, store = repo
    setup_known(repo, {"message": "old details", "code": "ERR_ASSERTION", "actual": 2, "expected": 4})
    run, _ = fake_runner(root, failure={"message": "new details", "code": "ERR_ASSERTION", "actual": 3, "expected": 4}, exit_code=1)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    assert report["knownFailures"] == []
    assert len(report["unknownFailures"]) == 1


def test_known_assertion_failure_with_masked_exit_still_fails(repo):
    root, store = repo
    failure = {"message": "known assertion", "code": "ERR_ASSERTION"}
    setup_known(repo, failure)
    run, _ = fake_runner(root, failure=failure, exit_code=0)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    assert len(report["knownFailures"]) == 1
    assert report["status"] == "failed"


@pytest.mark.parametrize("missing,mutate", [(True, False), (False, True)])
def test_zero_exit_incomplete_execution_or_mutation_is_failed(repo, missing, mutate):
    root, store = repo
    freeze(repo)
    run, _ = fake_runner(root, missing=missing, mutate=mutate)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    assert report["status"] == "failed"
    assert report["unknownFailures"] or report["afterInventory"]["status"] == "failed"


def test_all_stages_complete_and_passing(repo):
    root, store = repo
    freeze(repo)
    run, _ = fake_runner(root)
    assert h.full(root, store, run=run, runtime=RUNTIME)["status"] == "passed"


def test_preflight_failure_retained_without_executing(repo):
    root, store = repo
    freeze(repo)
    put(root, "tests/base.test.mjs", "// changed\n")
    run, calls = fake_runner(root)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    assert calls == []
    assert report["status"] == "failed"
    assert Path(report["history"]).is_file()


def test_cli_in_real_subprocess_inventory_and_guard(repo):
    root, store = repo
    report = root / "report.json"
    command = [sys.executable, str(MODULE), "inventory", "--root", str(root), "--report", str(report)]
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert h.read_json(report)["status"] == "created"
    (root / "tests/base.test.mjs").unlink()
    result = subprocess.run([sys.executable, str(MODULE), "check", "--root", str(root)], capture_output=True, text=True)
    assert result.returncode == 1
    assert '"reason": "deleted"' in result.stdout


def test_existing_report_rejected_before_full_or_inventory(repo, monkeypatch):
    root, store = repo
    report = put(root, "retained-report.json", '{"retained": true}\n')
    original = report.read_bytes()
    def forbidden(*args, **kwargs):
        pytest.fail("Existing report must be rejected before work")
    monkeypatch.setattr(h, "full", forbidden)
    monkeypatch.setattr(h, "inventory", forbidden)
    for mode in ("full", "inventory"):
        assert h.main([mode, "--root", str(root), "--report", str(report)]) == 1
        assert report.read_bytes() == original
    assert not (store / "inventories").exists()


def test_eperm_path_normalization_does_not_hide_changed_assertions():
    a = {"code": "EPERM", "syscall": "rename", "message": "EPERM rename 'temp-a' -> 'dest-a'", "errno": -4048}
    b = {**a, "message": "EPERM rename 'temp-b' -> 'dest-b'"}
    assert h.signature(a) == h.signature(b)
    assert h.signature({**a, "errno": -1}) != h.signature(a)
    assert h.signature({"message": "value 1"}) != h.signature({"message": "value 2"})


def test_real_subprocess_fake_commands_produce_complete_evidence(repo):
    root, store = repo
    freeze(repo)
    def child(command, cwd, env, log_path):
        stage = log_path.stem
        file = "tests/base.test.mjs" if stage == "node" else "tests/nested/new.test.mjs"
        payload = []
        if stage.startswith("node"):
            payload = [{"type": "test:pass", "name": "prior", "file": str(root / file)},
                       {"type": "test:summary", "counts": {"tests": 1}}]
        script = "import json,sys; print('\\n'.join(json.dumps(v) for v in json.loads(sys.argv[1])))"
        argv = [sys.executable, "-c", script, json.dumps(payload)]
        if stage == "lab":
            xml = next(arg.removeprefix("--junitxml=") for arg in command if arg.startswith("--junitxml="))
            argv = [sys.executable, "-c", "import pathlib,sys; pathlib.Path(sys.argv[1]).write_text(sys.argv[2])", xml,
                    '<testsuites><testsuite><testcase name="test_prior" file="tests/test_prior.py" /></testsuite></testsuites>']
        result = h.execute(argv, cwd, env, log_path)
        assert result["exitCode"] == 0
        return result
    assert h.full(root, store, run=child, runtime=RUNTIME)["status"] == "passed"


def test_lab_skips_or_missing_xml_cannot_pass(repo):
    root, store = repo
    freeze(repo)
    run, _ = fake_runner(root)
    def skipped(command, cwd, env, log_path):
        result = run(command, cwd, env, log_path)
        if log_path.stem == "lab":
            xml = log_path.parent / "pytest.xml"
            xml.write_text('<testsuites><testsuite><testcase name="test_prior" file="tests/test_prior.py"><skipped message="excluded" /></testcase></testsuite></testsuites>')
        return result
    report = h.full(root, store, run=skipped, runtime=RUNTIME)
    assert report["status"] == "failed"
    assert report["unknownFailures"][0]["failures"][0]["kind"] == "skipped"


def test_short_fresh_temporary_root_and_no_destructive_pytest_reuse(repo, monkeypatch):
    root, store = repo
    first = h.fresh_temporary_locations(root)
    second = h.fresh_temporary_locations(root)
    assert first["root"] != second["root"]
    assert first["pytestInitiallyAbsent"] is True
    assert Path(first["native"]).is_dir()
    assert not Path(first["pytest"]).exists()
    relative = Path(first["pytest"]).relative_to(root).as_posix()
    assert re.fullmatch(r"research/analyzer-lab/\.cache/t[0-9a-f]{12}/p", relative)
    # Bounded allocator overhead leaves at least 40 more characters for fixture paths.
    legacy = "research/analyzer-lab/.cache/regression-harness/20261010T211125-3e0984f08408/pytest-temp"
    assert len(legacy) - len(relative) >= 40
    class FixedUuid:
        hex = Path(first["root"]).name[1:] + "0" * 20
    monkeypatch.setattr(h.uuid, "uuid4", lambda: FixedUuid())
    existing = Path(first["pytest"])
    existing.mkdir()
    marker = existing / "retained.txt"
    marker.write_text("keep this source", encoding="utf-8")
    with pytest.raises(FileExistsError):
        h.fresh_temporary_locations(root)
    assert marker.read_text(encoding="utf-8") == "keep this source"


def test_full_uses_short_temp_and_preserves_log_location(repo):
    root, store = repo
    freeze(repo)
    run, calls = fake_runner(root)
    def observe(command, cwd, env, log_path):
        if log_path.stem == "lab":
            path = Path(next(arg.removeprefix("--basetemp=") for arg in command if arg.startswith("--basetemp=")))
            assert not path.exists()
            assert path.name == "p"
            assert path.parent.name.startswith("t")
        return run(command, cwd, env, log_path)
    report = h.full(root, store, run=observe, runtime=RUNTIME)
    assert report["status"] == "passed"
    assert report["temporaryLocations"]["native"] == calls[0][1]["TEMP"]
    assert "regression-harness" in report["commands"][0]["log"]
    assert "regression-harness" not in report["temporaryLocations"]["root"]
    assert h.read_json(report["history"])["temporaryLocations"] == report["temporaryLocations"]


def test_retained_counts_files_xml_hash_and_full_evidence_digest(repo):
    root, store = repo
    freeze(repo)
    run, _ = fake_runner(root)
    report = h.full(root, store, run=run, runtime=RUNTIME)
    history = h.read_json(report["history"])
    node = next(command for command in history["commands"] if command["stage"] == "node")
    compact = node["nodeCoverage"]
    assert "nodeResults" not in node
    assert compact["counts"] == {"tests": 1}
    assert compact["executedFiles"] == ["tests/base.test.mjs"]
    assert compact["executedFileCount"] == compact["expectedFileCount"] == 1
    assert compact["executedFilesHash"] == compact["expectedFilesHash"]
    assert compact["missingFiles"] == []
    assert compact["coverageStatus"] == "complete"
    lab = next(command for command in history["commands"] if command["stage"] == "lab")
    assert lab["pytestXmlHash"] == h.digest((Path(lab["log"]).parent / "pytest.xml").read_bytes())
    assert history["fullEvidenceHash"] == report["fullEvidenceHash"] == h.evidence_digest(report)
    changed = json.loads(json.dumps(report))
    changed["commands"][1]["nodeCoverage"]["counts"]["tests"] = 999
    assert h.evidence_digest(changed) != report["fullEvidenceHash"]
    changed = json.loads(json.dumps(report))
    changed["history"] = "another relocation"
    assert h.evidence_digest(changed) == report["fullEvidenceHash"]


def test_global_summary_is_not_sum_of_file_summaries_and_missing_global_fails(repo):
    root, store = repo
    events = [{"type": "test:pass", "name": "a", "file": str(root / "tests/base.test.mjs")},
              {"type": "test:summary", "file": str(root / "tests/base.test.mjs"), "counts": {"tests": 4, "passed": 4}},
              {"type": "test:summary", "counts": {"tests": 4, "passed": 4}}]
    parsed = h.parse_node("\n".join(json.dumps(event) for event in events), root)
    compact = h.node_coverage(parsed, ["tests/base.test.mjs"])
    assert compact["counts"] == {"tests": 4, "passed": 4}
    assert compact["coverageStatus"] == "complete"
    parsed = h.parse_node("\n".join(json.dumps(event) for event in events[:-1]), root)
    assert h.node_coverage(parsed, ["tests/base.test.mjs"])["coverageStatus"] == "incomplete"
