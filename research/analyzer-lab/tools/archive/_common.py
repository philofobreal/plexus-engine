"""Small standard-library helpers for explicit-input historical tools."""
import hashlib
import json
from pathlib import Path


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def fresh_directory(path):
    path = Path(path).resolve()
    path.mkdir(parents=True, exist_ok=False)
    return path


def write_json(path, data):
    path = Path(path)
    text = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(text)
    return path


def repository(value):
    root = Path(value).resolve()
    if not (root / "AGENTS.md").is_file() or not (root / "package.json").is_file():
        raise ValueError("--root must identify the plexus-engine repository")
    return root
