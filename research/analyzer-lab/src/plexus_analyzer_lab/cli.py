import argparse
import importlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from .config import LAB_ROOT, REPO_ROOT, load_config
from .provenance import version
from .registry import load_registry


def doctor():
    checks = {"python": {"status": "ok" if sys.version_info >= (3, 11) else "failed", "version": sys.version.split()[0],
                         "preferred": "3.11", "note": "Use the same interpreter and frozen dependencies for repeat runs"}}
    for package in ("numpy", "scipy", "soundfile", "librosa", "mir_eval", "jsonschema"):
        try:
            module = importlib.import_module(package)
            checks[package] = {"status": "ok", "version": version(package)}
            if package == "soundfile":
                checks["libsndfile"] = {"status": "ok", "version": module.__libsndfile_version__}
        except Exception as exc:
            checks[package] = {"status": "failed", "reason": str(exc)}
    checks["node"] = {"status": "ok" if shutil.which("node") else "failed", "path": shutil.which("node")}
    checks["typescript"] = {"status": "ok" if (REPO_ROOT / "node_modules/typescript/lib/typescript.js").is_file() else "failed"}
    try:
        result = subprocess.run(["node", str(LAB_ROOT / "bridge/run-plexus-analysis.mjs"), "--doctor"],
                                cwd=REPO_ROOT, capture_output=True, text=True, timeout=30)
        checks["bridge"] = {"status": "ok" if result.returncode == 0 else "failed", "exitCode": result.returncode,
                            "stderr": result.stderr, "details": json.loads(result.stdout) if result.returncode == 0 else None}
    except (OSError, subprocess.TimeoutExpired) as exc:
        checks["bridge"] = {"status": "failed", "reason": str(exc)}
    for provider, entry in load_registry().items():
        if entry["executionMode"] == "external-process" and provider not in ("plexus", "librosa"):
            env = LAB_ROOT / "providers" / provider / ".venv"
            interpreter = env / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
            checks[f"optional.{provider}"] = {"status": "present" if interpreter.is_file() else "unavailable", "fatal": False}
    # WAV decoding uses libsndfile directly; ffmpeg is not a requirement.
    print(json.dumps(checks, indent=2))
    return int(any(c["status"] == "failed" for c in checks.values()))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Isolated Plexus MIR measurement lab")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor")
    oracle = commands.add_parser("oracle")
    oracle.add_argument("action", choices=["list"])
    for name in ("analyze", "benchmark"):
        command = commands.add_parser(name)
        command.add_argument("--audio" if name == "analyze" else "--manifest", required=True)
        command.add_argument("--oracle", action="append", help="Repeat for multiple oracle IDs; default librosa")
        command.add_argument("--plexus", action="store_true", help="Include production headless analyzer (always included by benchmark)")
        command.add_argument("--config")
        command.add_argument("--runs-dir")
        command.add_argument("--enable-provider", action="append", default=[], help="Explicit optional-provider policy opt-in")
    report = commands.add_parser("report")
    report.add_argument("--run", required=True)
    export = commands.add_parser("export-training")
    export.add_argument("--run", required=True)
    export.add_argument("--output", required=True)
    fixture = commands.add_parser("fixture")
    fixture.add_argument("--output", default=str(LAB_ROOT / "tmp/click.wav"))
    fixture.add_argument("--kind", choices=["click", "pulse", "tone-click", "sparse", "silence", "ambiguity"], default="click")
    fixture.add_argument("--bpm", type=float, default=120)
    fixture.add_argument("--duration", type=float, default=16)
    fixture.add_argument("--sample-rate", type=int, default=22050)
    drum_fixture = commands.add_parser("drum-fixture", help="Generate independent procedural drum corpus")
    drum_fixture.add_argument("--output-dir", required=True)
    drum_fixture.add_argument("--seed", type=int, default=1729)
    drum_fixture.add_argument("--sample-rate", type=int, default=22050)
    drum_fixture.add_argument("--corpus", choices=["v1", "v2"], default="v1")
    drum_train = commands.add_parser("drum-train", help="Fit research classifier on train, tune thresholds on validation")
    drum_train.add_argument("--manifest", required=True)
    drum_train.add_argument("--output", required=True)
    drum_train.add_argument("--ridge", type=float, default=1.0)
    drum_train.add_argument("--algorithm", choices=["v1", "v2"], default="v1")
    drum_benchmark = commands.add_parser("drum-benchmark", help="Evaluate frozen research model on test tracks")
    drum_benchmark.add_argument("--manifest", required=True)
    drum_benchmark.add_argument("--model", required=True)
    drum_benchmark.add_argument("--output-dir", required=True)
    drum_midi = commands.add_parser("drum-import-midi", help="Import explicitly reviewed local drum MIDI annotations")
    drum_midi.add_argument("--audio", required=True)
    drum_midi.add_argument("--midi", required=True)
    drum_midi.add_argument("--review", required=True)
    drum_midi.add_argument("--track-id", required=True)
    drum_midi.add_argument("--output", required=True)
    drum_compare = commands.add_parser("drum-compare", help="Paired frozen baseline/candidate test measurements")
    drum_compare.add_argument("--manifest", required=True)
    drum_compare.add_argument("--baseline-model", required=True)
    drum_compare.add_argument("--candidate-model", required=True)
    drum_compare.add_argument("--output-dir", required=True)
    music_reference = commands.add_parser("music-reference", help="Validate relevant library/production onset evidence on v2 generator truth")
    music_reference.add_argument("--manifest", required=True)
    music_reference.add_argument("--output-dir", required=True)
    music_reference.add_argument("--split", choices=["train", "validation", "test"], default="test")
    args = parser.parse_args(argv)
    try:
        if args.command == "doctor":
            return doctor()
        if args.command == "oracle":
            print(json.dumps(list(load_registry().values()), indent=2))
        elif args.command == "fixture":
            from .audio import synthetic
            from .reports.json_report import write_json
            metadata = synthetic(args.output, args.kind, args.bpm, args.duration, args.sample_rate)
            write_json(Path(args.output).with_suffix(".metadata.json"), metadata)
            print(str(Path(args.output).resolve()))
        elif args.command in ("analyze", "benchmark"):
            from .runner import analyze, benchmark
            config = load_config(args.config)
            providers = (["plexus"] if args.plexus or args.command == "benchmark" else []) + (args.oracle or ["librosa"])
            options = {"providers": providers, "config": config, "runs_dir": args.runs_dir, "enabled": args.enable_provider}
            if args.command == "analyze":
                path = analyze(args.audio, **options)
                print(str(path.resolve()))
                manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
                return int(any(p["status"] != "success" for p in manifest["providers"].values()))
            path, summary = benchmark(args.manifest, **options)
            print(str(path.resolve()))
            return int(any(t["status"] != "success" for t in summary["tracks"]))
        elif args.command == "report":
            from .reports.json_report import generate_report
            generate_report(args.run)
            print(str(Path(args.run).resolve() / "report.md"))
        elif args.command == "export-training":
            from .training.export import export_training
            print(json.dumps(export_training(args.run, args.output), indent=2))
        elif args.command == "drum-fixture":
            if args.corpus == "v2":
                from .drums.synthetic_v2 import generate_corpus_v2 as generate_corpus
            else:
                from .drums.synthetic import generate_corpus
            print(str(generate_corpus(args.output_dir, args.seed, args.sample_rate)))
        elif args.command == "drum-train":
            from .drums.experiment import train
            print(str(train(args.manifest, args.output, args.ridge, args.algorithm)))
        elif args.command == "drum-benchmark":
            from .drums.experiment import benchmark as drum_benchmark
            path, _ = drum_benchmark(args.manifest, args.model, args.output_dir)
            print(str(path))
        elif args.command == "drum-import-midi":
            from .drums.midi import import_midi
            print(str(import_midi(args.audio, args.midi, args.review, args.output, args.track_id)))
        elif args.command == "drum-compare":
            from .drums.comparison import compare_models
            path, _ = compare_models(args.manifest, args.baseline_model, args.candidate_model, args.output_dir)
            print(str(path))
        elif args.command == "music-reference":
            from .drums.references import benchmark_references
            path, result = benchmark_references(args.manifest, args.output_dir, args.split)
            print(str(path))
            return int(result["partial"])
        return 0
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
