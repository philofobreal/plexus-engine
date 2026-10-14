"""Record only the reviewed additive predictive schema change against immutable v3.

--root REPO --output NEW_JSON. This checks structural preservation, not an
automatic musical approval. Integration owner root reviewed shared transport.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def digest(data): return hashlib.sha256(data).hexdigest()


def run(root, output):
    if output.exists(): raise FileExistsError("Migration must be new")
    store = root / "research/analyzer-lab/tools/harness"
    manifest = json.loads((store / "inventories/v0003.json").read_text())
    bundle_path = store / manifest["archive"]
    if digest(bundle_path.read_bytes()) != manifest["archiveHash"]: raise ValueError("Predecessor archive identity mismatch")
    path = "tests/fixtures/analyzer/analysis-result.schema.json"
    with zipfile.ZipFile(bundle_path) as bundle: before = bundle.read(path)
    after = (root / path).read_bytes()
    if digest(before) != manifest["files"][path]["sha256"] or before == after: raise ValueError("Unexpected predecessor/replacement")
    old, new = json.loads(before), json.loads(after)
    added = new["$defs"].pop("predictiveOnsets")
    reference = new["$defs"]["trackAnalysis"]["properties"].pop("predictiveOnsets")
    if new != old or reference != {"$ref": "#/$defs/predictiveOnsets"} or added["additionalProperties"] is not False:
        raise ValueError("Schema changed beyond the reviewed additive field")
    entry = {"path": path, "predecessorSha256": digest(before), "replacementSha256": digest(after),
             "reviewedBy": "root integration owner",
             "reviewedReason": "Adds only strict optional predictive-innovation-v2 definition/property. Every original required/optional field and v1 definition is structurally identical to v3 after removing these two additions. Original schema retained in immutable v3 ZIP; seven independent real-transport/schema tests pass, prior tests remain active. Node tests cover normalization/clock/support and legacy projection parity; full cumulative execution follows."}
    with output.open("x", encoding="utf-8") as stream:
        json.dump([entry], stream, indent=2)
        stream.write("\n")
    print(json.dumps({"path": path, "predecessorSha256": entry["predecessorSha256"], "replacementSha256": entry["replacementSha256"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    run(args.root.resolve(), args.output)
