"""Restore newline-only checkout drift and exact protected predecessor bytes.

Run from the project: python research/analyzer-lab/diagnostics/restore-imported-source-bytes.py
Requires a HEAD archive at .cache/import-head.zip; never replaces authored edits.
Current modified Git paths are excluded from HEAD restoration. Protected files
are restored only if absent or byte differences are solely CRLF/LF. No source
archive, predecessor manifest or previous result is modified.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[3]
sha = lambda data: hashlib.sha256(data).hexdigest()
canonical = lambda data: data.replace(b"\r\n", b"\n")


def main():
    output = ROOT / "research/analyzer-lab/fixtures/import-source-byte-restoration-01.json"
    if output.exists():
        raise ValueError("Refusing to overwrite import evidence")
    protected_root = ROOT / "research/analyzer-lab/tools/harness"
    manifest = json.loads((protected_root / "inventories/v0014.json").read_text(encoding="utf-8-sig"))
    predecessor = protected_root / manifest["archive"]
    if sha(predecessor.read_bytes()) != manifest["archiveHash"]:
        raise ValueError("Predecessor archive identity mismatch")
    modified = set(subprocess.check_output(["git", "-c", "core.autocrlf=true", "diff", "--name-only", "-z"], cwd=ROOT).decode().split("\0"))
    tasks = {}

    def plan(name, data, origin):
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or path.is_symlink():
            raise ValueError(f"Unsafe import path: {name}")
        old = path.read_bytes() if path.exists() else None
        if old == data:
            tasks.pop(name, None)
            return
        if old is not None and canonical(old) != canonical(data):
            raise ValueError(f"Meaningful edit cannot be replaced: {name}")
        tasks[name] = (path, data, {"path": name, "origin": origin,
            "beforeSha256": sha(old) if old is not None else None,
            "afterSha256": sha(data), "reason": "newline-only-checkout-drift" if old is not None else "retained-ignored-predecessor"})

    with zipfile.ZipFile(ROOT / "research/analyzer-lab/.cache/import-head.zip") as head:
        for name in head.namelist():
            if not name.endswith("/") and name not in modified:
                plan(name, head.read(name), "72800fe-HEAD-archive")
    with zipfile.ZipFile(predecessor) as archive:
        for name, record in manifest["files"].items():
            if name in modified:
                raise ValueError(f"Unexpected protected authored edit: {name}")
            data = archive.read(name)
            if sha(data) != record["sha256"]:
                raise ValueError(f"Protected archive entry identity mismatch: {name}")
            plan(name, data, "immutable-v0014-sources")
    # All checks complete before writing any predecessor source.
    for path, data, _ in tasks.values():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    report = {"status": "restored-exact-import-bytes", "startingCommit": "72800fe",
        "protectedPredecessors": len(manifest["files"]), "archiveSha256": manifest["archiveHash"],
        "preservedAuthoredEdits": sorted(p for p in modified if p),
        "changes": [entry for _, _, entry in tasks.values()]}
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"status": report["status"], "restored": len(tasks), "preservedEdits": len(modified) - 1}))


if __name__ == "__main__":
    main()
