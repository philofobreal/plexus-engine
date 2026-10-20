"""Read-only hygiene review; never decodes known binary artifacts as UTF-8."""
import argparse
import re
import subprocess
from pathlib import Path
from _common import read_json, repository

BINARY = {".wav", ".flac", ".mp3", ".npz", ".npy", ".f32le", ".onnx", ".pth", ".pt", ".h5", ".tar", ".zip"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--path", action="append", help="Explicit repository-relative file, repeatable")
    parser.add_argument("--mode", choices=("untracked", "tracked", "all"), default="untracked")
    args = parser.parse_args()
    root = repository(args.root)
    names = args.path
    if names is None:
        flags = ["--others", "--exclude-standard"] if args.mode == "untracked" else ["--cached"]
        if args.mode == "all":
            flags += ["--others", "--exclude-standard"]
        names = subprocess.check_output(["git", "ls-files", "-z", *flags], cwd=root).decode("utf-8").split("\0")
    issues = []
    reviewed = 0
    for name in sorted(set(names) - {""}):
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise ValueError(f"Path outside repository: {name}")
        if not path.is_file():
            issues.append(f"{name}: missing file")
            continue
        reviewed += 1
        if path.suffix.lower() in BINARY:
            issues.append(f"{name}: binary artifact requires separate retention review")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            issues.append(f"{name}: not UTF-8 text; review separately")
            continue
        for number, line in enumerate(text.splitlines(), 1):
            if line.rstrip() != line:
                issues.append(f"{name}:{number}: trailing whitespace")
        if not text.endswith("\n"):
            issues.append(f"{name}: no final newline")
        if path.suffix == ".json":
            try:
                read_json(path)
            except ValueError as error:
                issues.append(f"{name}: invalid JSON: {error}")
        if path.suffix == ".md":
            for link in re.findall(r"\]\(([^)]+)\)", text):
                link = link.strip("<>")
                if "://" in link or link.startswith("#") or link.startswith("mailto:"):
                    continue
                destination = link.split("#", 1)[0]
                destination = re.sub(r":\d+$", "", destination)
                if destination and not (path.parent / destination).exists():
                    issues.append(f"{name}: missing link {link}")
    print(f"Reviewed {reviewed} files; issues: {len(issues)}")
    print("\n".join(issues))
    return bool(issues)


if __name__ == "__main__":
    raise SystemExit(main())
