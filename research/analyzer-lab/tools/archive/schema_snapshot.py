"""Replay initial schema construction into a fresh directory, never live contracts.

These are historical stages. Later contract hardening is not reconstructed by
initial generators; the versioned schemas remain authoritative.
"""
import argparse
import ast
import shutil
import sys
from pathlib import Path
from _common import digest, fresh_directory, read_json, repository, write_json

HISTORY = Path(__file__).parent / "history-20261010"
MODES = {"initial-contracts": "build_schemas.py", "initial-drums": "create_drum_schemas.py",
         "initial-v2": "create_drum_v2_schema.py", "minimize-an01": "minimize-an01-schema.py",
         "update-an01": "update-an01-schemas.py"}


class ExplicitPaths(ast.NodeTransformer):
    def __init__(self, replacements):
        self.replacements = replacements

    def visit_Assign(self, node):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in self.replacements:
                node.value = ast.parse(self.replacements.pop(name), mode="eval").body
        return self.generic_visit(node)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--mode", required=True, choices=MODES)
    parser.add_argument("--input", type=Path, help="Required base analysis schema or v1 drum schema")
    parser.add_argument("--schema-dir", type=Path, help="Required lab schema inputs for update-an01")
    parser.add_argument("--output", required=True, type=Path, help="Fresh output directory")
    args = parser.parse_args()
    repo = repository(args.root)
    original = MODES[args.mode]
    inventory = read_json(HISTORY / "inventory.json")
    entry = next(item for item in inventory["authoredPrograms"] if item["originalRelativePath"] == original)
    snapshot = HISTORY / entry["snapshot"]
    if digest(snapshot) != entry["sha256"]:
        raise ValueError("Archived source hash differs from retention inventory")
    if args.mode in {"initial-v2", "minimize-an01", "update-an01"} and (args.input is None or not args.input.is_file()):
        raise ValueError("This mode requires an explicit existing --input schema")
    if args.mode == "update-an01" and (args.schema_dir is None or not args.schema_dir.is_dir()):
        raise ValueError("update-an01 requires --schema-dir")
    # Validate inputs before creating an output directory.
    if args.input:
        input_schema = read_json(args.input)
        if args.mode == "minimize-an01" and ("featureClock" in input_schema.get("$defs", {}) or
                any("rmsAmplitude" in value.get("properties", {}) for value in input_schema.get("$defs", {}).values())):
            raise ValueError("minimize-an01 requires the original pre-AN-01 base schema, not an already patched contract")
    if args.mode == "update-an01":
        for name in ("canonical-analysis", "run-manifest", "benchmark-report"):
            read_json(args.schema_dir / f"{name}.schema.json")
    output = fresh_directory(args.output)
    replacement = {"out": "output", "root": "output"}
    if args.mode == "initial-v2":
        shutil.copyfile(args.input, output / "drum-model.schema.json")
        sys.path.insert(0, str(repo / "research/analyzer-lab/src"))
    elif args.mode == "minimize-an01":
        replacement = {"root": "repo", "path": "output / 'analysis-result.schema.json'",
                       "text": "input_path.read_text(encoding='utf-8-sig')"}
    elif args.mode == "update-an01":
        schemas = output / "research/analyzer-lab/schemas"
        schemas.mkdir(parents=True)
        for name in ("canonical-analysis", "run-manifest", "benchmark-report"):
            shutil.copyfile(args.schema_dir / f"{name}.schema.json", schemas / f"{name}.schema.json")
        analysis = output / "tests/fixtures/analyzer/analysis-result.schema.json"
        analysis.parent.mkdir(parents=True)
        shutil.copyfile(args.input, analysis)
    tree = ExplicitPaths(replacement).visit(ast.parse(snapshot.read_text(encoding="utf-8"), filename=original))
    ast.fix_missing_locations(tree)
    namespace = {"__file__": str(snapshot), "__name__": "historical_schema_stage",
                 "output": output, "repo": repo, "input_path": args.input}
    exec(compile(tree, original, "exec"), namespace)
    outputs = {path.relative_to(output).as_posix(): digest(path) for path in output.rglob("*.json")}
    for path in output.rglob("*.json"):
        read_json(path)
    write_json(output / "stage-provenance.json", {"mode": args.mode, "archivedSourceHash": entry["sha256"],
        "inputHash": digest(args.input) if args.input else None, "outputHashes": outputs,
        "interpretation": "Historical initial/patch stage, not current schema authority. Generated into a fresh directory only."})
    print(output)


if __name__ == "__main__":
    main()
