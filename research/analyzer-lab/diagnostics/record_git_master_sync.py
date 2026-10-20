"""Record reviewed master integration without replacing historical test evidence.

Run from the project root with the lab Python:
  python research/analyzer-lab/diagnostics/record_git_master_sync.py --prefix PATH
PATH produces new .migrations.json and .evidence.json files; existing files are refused.
The fixed commit identities describe the 2026-10-14 integration, not a generic merge tool.
"""
from hashlib import sha256
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
BASE = "29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14"
CHECKPOINT = "55df400097bf7fe13e8e6ff1183d556ce03ee76b"
UPSTREAM = "398667436d15ab8af78cbdff0141e0151870241f"
MERGE = "09ca03d2ff6bf8af13e3e7c03f45c92d840b9d0b"
REASONS = {
    "tests/helpers/xr-track-bend.mjs": "Import the authored XR track-bend helper with the upstream distance-scaled default configuration; the pre-existing helper bytes remain archived.",
    "tests/raster-conversion.test.mjs": "Adapt the legacy comparison splice to the shared writeFieldRasterPixels raster conversion entrypoint.",
    "tests/xr-background-diagnostics.test.mjs": "Import CPU/GPU timing diagnostics coverage and the spatial frameDrive source double.",
    "tests/xr-background-settings.test.mjs": "Import authored XR defaults, backdrop distance, spatial field and associated presentation tests.",
    "tests/xr-controller-regeneration.test.mjs": "Import prerender and raster pipeline options while retaining presentation-versus-gameplay regeneration coverage.",
    "tests/xr-gpu-lines.test.mjs": "Import pre-eye-pass upload/compositing and staged worker frame coverage.",
    "tests/xr-gpu-material.test.mjs": "Import spatial frameDrive mocks and current raster/material integration coverage.",
    "tests/xr-menu.test.mjs": "Import spatial field settings, diagnostics copy, reset confirmation and clipboard coverage.",
    "tests/xr-settings.test.mjs": "Import the authored defaults and CPU/GPU/WebGL raster settings contract.",
    "tests/xr-track-path.test.mjs": "Import backdrop-distance projection and far-focus path coverage.",
    "tests/xr-wormhole-continuity.test.mjs": "Adapt the source double to the additive spatial frameDrive contract; continuity assertions remain active.",
    "tests/xr-wormhole-worker.test.mjs": "Import feature-support diagnostics, software raster and spatial frame transfer/lifetime coverage.",
    "tests/xr-wormhole.test.mjs": "Import revised authored XR tuning defaults and the spatial frameDrive source double.",
}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8").strip()


def tree(commit):
    entries = {}
    for row in git("ls-tree", "-r", commit).splitlines():
        meta, name = row.split("\t", 1)
        entries[name] = meta
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", required=True)
    args = parser.parse_args()
    prefix = (ROOT / args.prefix).resolve()
    outputs = [Path(str(prefix) + suffix) for suffix in (".migrations.json", ".evidence.json")]
    if any(not path.is_relative_to(ROOT) or path.exists() for path in outputs):
        raise ValueError("Outputs must be new files within this project.")
    git("merge-base", "--is-ancestor", UPSTREAM, MERGE)
    local = set(git("diff", "--name-only", BASE, CHECKPOINT).splitlines())
    overlap = {".gitignore", "documents/governance/testing-validation.md"}
    checkpoint_tree, merge_tree, upstream_tree = map(tree, (CHECKPOINT, MERGE, UPSTREAM))
    preserved = local - overlap
    if any(checkpoint_tree.get(name) != merge_tree.get(name) for name in preserved):
        raise ValueError("A local development file was unexpectedly replaced.")
    incoming = set(git("diff", "--name-only", BASE, UPSTREAM).splitlines())
    if any(merge_tree.get(name) != upstream_tree.get(name) for name in incoming - overlap):
        raise ValueError("An incoming master file differs from its upstream source.")

    harness_path = ROOT / "research/analyzer-lab/tools/harness/regression.py"
    spec = importlib.util.spec_from_file_location("retention_harness", harness_path)
    harness = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(harness)
    predecessor_path = ROOT / "research/analyzer-lab/tools/harness/inventories/v0010.json"
    predecessor = json.loads(predecessor_path.read_text(encoding="utf-8"))
    current = harness.discover(ROOT)
    old = predecessor["files"]
    if set(old) - set(current):
        raise ValueError("Protected predecessor files were deleted.")
    changed = {name for name in old if old[name]["sha256"] != current[name]["sha256"]}
    if changed != set(REASONS):
        raise ValueError("Changed protected paths differ from the reviewed upstream test list.")
    migrations = []
    for name, reason in sorted(REASONS.items()):
        if git("hash-object", name) != git("rev-parse", f"{UPSTREAM}:{name}"):
            raise ValueError("Working test differs from the reviewed master source: " + name)
        migrations.append({
            "path": name, "predecessorSha256": old[name]["sha256"],
            "replacementSha256": current[name]["sha256"], "reviewedBy": "Codex / root integration owner",
            "reviewedReason": reason + " Exact upstream master source; predecessor retained in immutable v0010.sources.zip; cumulative execution required.",
        })
    evidence = {
        "kind": "git-master-sync-preservation", "clientDate": "2026-10-14",
        "baseCommit": BASE, "checkpointCommit": CHECKPOINT, "masterCommit": UPSTREAM, "mergeCommit": MERGE,
        "masterIsAncestor": True, "localChangedPaths": len(local),
        "localPathsPreservedExactly": len(preserved), "reviewedCombinedPaths": sorted(overlap),
        "incomingChangedPaths": len(incoming), "incomingPathsImportedExactly": len(incoming - overlap),
        "protectedReplacements": sorted(changed), "protectedDeletions": [],
        "predecessorManifestSha256": sha256(predecessor_path.read_bytes()).hexdigest(),
        "predecessorArchive": predecessor["archive"], "predecessorArchiveSha256": predecessor["archiveHash"],
        "accuracyClaim": None, "testExecution": "Recorded separately by the cumulative harness.",
    }
    for path, value in zip(outputs, (migrations, evidence)):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
    print(json.dumps({"outputs": [str(path.relative_to(ROOT)) for path in outputs],
                      "preservedLocalPaths": len(preserved), "reviewedReplacements": len(migrations)}))


if __name__ == "__main__":
    main()
