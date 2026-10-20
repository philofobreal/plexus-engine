"""Export build inputs from an explicit Git commit into a fresh directory.

Build execution requires --run-build. Existing dependencies are reused; this
does not install, create dependency junctions, or modify the working tree.
"""
import argparse
import subprocess
from pathlib import Path
from _common import fresh_directory, repository, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--ref", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--run-build", action="store_true")
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    root = repository(args.root)
    git = lambda *arguments: subprocess.check_output(["git", *arguments], cwd=root)
    commit = git("rev-parse", "--verify", "--end-of-options", args.ref + "^{commit}").decode().strip()
    output = fresh_directory(args.output)
    count = 0
    for record in git("ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not record:
            continue
        header, raw_name = record.split(b"\t", 1)
        mode, kind, object_id = header.decode().split()
        name = raw_name.decode("utf-8")
        if kind != "blob" or not (name.startswith(("src/", "public/", "xr/", "mvp/", "scripts/"))
            or name in ("index.html", "package.json", "tsconfig.json", "vite.config.ts")):
            continue
        if mode == "120000":
            raise ValueError(f"Build export does not recreate symlinks: {name}")
        target = output / name
        if not target.resolve().is_relative_to(output):
            raise ValueError("Unsafe Git tree name")
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(git("cat-file", "blob", object_id))
        count += 1
    return_code = None
    if args.run_build:
        vite = root / "node_modules/vite/bin/vite.js"
        if not vite.is_file():
            raise ValueError("Existing root Vite dependency is unavailable; nothing is installed")
        with (output / "build.log").open("x", encoding="utf-8") as stream:
            return_code = subprocess.run([args.node, str(vite), "build"], cwd=output, stdout=stream, stderr=subprocess.STDOUT).returncode
    write_json(output / "export-provenance.json", {"commit": commit, "blobCount": count,
        "buildRequested": args.run_build, "buildReturnCode": return_code,
        "dependencyPolicy": "Existing ancestor dependency resolution only; no installation/junction. An external output location may not resolve imports."})
    print(output)
    return return_code or 0


if __name__ == "__main__":
    raise SystemExit(main())
