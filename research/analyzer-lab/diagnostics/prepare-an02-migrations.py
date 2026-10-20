"""Record the reviewed AN-02 v1-to-v2 changes; never approves arbitrary replacements.

Run after reviewing the v1 ZIP/current unified diff. Output is exclusive, with
exact predecessor/replacement hashes. The cumulative harness verifies it again.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


REASONS = {
    "research/analyzer-lab/tools/harness/regression.py":
        "Integration review of exact v1/current diff after full run 20261010T211125-3e0984f08408. "
        "Preserves all execution/failure/inventory gates; replaces excessively long pytest temp with fresh short workspace paths; "
        "adds retained global Node counts/executed-file evidence, pytest XML identity and full-evidence digest. "
        "Original v1 source and failed run retained unchanged. Focused harness checks pass; corrected full run remains required.",
    "research/analyzer-lab/tests/test_regression_harness.py":
        "Exact v1/current diff retains every prior test and assertion. Adds four meaningful cases for fresh short temp "
        "collision/preservation, actual subprocess temp propagation, durable counts/XML/report hashing and non-duplicated "
        "global counts. Extends earlier immutable-history assertion. All 28 focused cases pass; no coverage removed.",
    "tests/analyzer-acoustic-onsets.test.mjs":
        "Exact v1/current diff only adds four malformed optional payload assertions (null, false, zero, empty string). "
        "Every prior phase, endpoint, negative, math, parity and transport assertion remains. Normalization now rejects "
        "falsy malformed evidence rather than retaining it through spread. All 24 focused Node integration cases pass."
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--reviewed-by", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists() or args.output.is_symlink():
        raise FileExistsError("Migration output must be fresh")
    if not args.reviewed_by.strip():
        raise ValueError("Reviewer identity is required")
    root = args.root.resolve()
    store = root / "research/analyzer-lab/tools/harness"
    manifest = json.loads((store / "inventories/v0001.json").read_text(encoding="utf-8"))
    archive = store / manifest["archive"]
    if digest(archive.read_bytes()) != manifest["archiveHash"]:
        raise ValueError("Predecessor archive identity mismatch")
    entries = []
    with zipfile.ZipFile(archive) as bundle:
        for name, reason in REASONS.items():
            before, after = bundle.read(name), (root / name).read_bytes()
            if digest(before) != manifest["files"][name]["sha256"] or before == after:
                raise ValueError(f"Unexpected predecessor/replacement: {name}")
            entries.append({"path": name, "predecessorSha256": digest(before), "replacementSha256": digest(after),
                            "reviewedBy": args.reviewed_by, "reviewedReason": reason})
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(entries, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(f"Recorded {len(entries)} reviewed migrations in {args.output}")


if __name__ == "__main__":
    main()
