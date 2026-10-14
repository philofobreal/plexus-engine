"""Verify a supplied baseline checkout against Git blobs without restoring files."""
import argparse
import hashlib
import os
import subprocess
from pathlib import Path
from _common import repository, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--checkout", required=True, type=Path)
    parser.add_argument("--ref", required=True, help="Explicit baseline Git revision")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = repository(args.root)
    checkout = args.checkout.resolve()
    if not checkout.is_dir():
        raise ValueError("--checkout must exist")
    def git(*arguments):
        return subprocess.check_output(["git", *arguments], cwd=root)
    commit = git("rev-parse", "--verify", "--end-of-options", args.ref + "^{commit}").decode().strip()
    algorithm = git("rev-parse", "--show-object-format").decode().strip()
    mismatches = []
    checked = 0
    for record in git("ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not record:
            continue
        header, raw_name = record.split(b"\t", 1)
        mode, kind, expected = header.decode().split()
        if kind != "blob":
            continue
        name = raw_name.decode("utf-8")
        path = checkout / name
        checked += 1
        if mode == "120000" and path.is_symlink():
            data = os.readlink(path).encode("utf-8")
        elif not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(checkout):
            mismatches.append({"name": name, "reason": "missing or unsafe path; verifier never repairs checkout"})
            continue
        else:
            data = path.read_bytes()
        actual = hashlib.new(algorithm, f"blob {len(data)}\0".encode() + data).hexdigest()
        if actual != expected:
            mismatches.append({"name": name, "expected": expected, "actual": actual})
    write_json(args.output, {"commit": commit, "objectFormat": algorithm, "checked": checked,
                            "mismatches": mismatches, "restorationPerformed": False})
    print(f"Checked {checked} blobs; mismatches: {len(mismatches)}")
    return bool(mismatches)


if __name__ == "__main__":
    raise SystemExit(main())
