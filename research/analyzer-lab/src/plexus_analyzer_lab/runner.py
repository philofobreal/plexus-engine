import json
import shutil
import time
from pathlib import Path

from .adapters.external_process import ExternalProcessAdapter
from .adapters.librosa import LibrosaAdapter
from .adapters.plexus import PlexusAdapter
from .audio import load_audio
from .config import LAB_ROOT, REPO_ROOT, load_config
from .contracts import SCHEMA_VERSION, validate
from .datasets.manifest import load_manifest, resolve_reference
from .hashing import content_hash, object_hash
from .provenance import environment, git_commit, timestamp
from .registry import load_registry
from .reports.json_report import generate_report, write_json


def source_fingerprint():
    # A dirty analyzer or research adapter must not share identity with its commit's baseline.
    files = list((REPO_ROOT / "src/analyzer").rglob("*.ts"))
    files += list((REPO_ROOT / "src/types").rglob("*.ts"))
    files += list((LAB_ROOT / "src").rglob("*.py")) + list((LAB_ROOT / "schemas").glob("*.json"))
    files += list((LAB_ROOT / "bridge").glob("*.mjs")) + list((LAB_ROOT / "configs").glob("*.json"))
    files += [LAB_ROOT / "pyproject.toml", LAB_ROOT / "requirements.validation.txt"]
    return object_hash({str(p.relative_to(REPO_ROOT)): content_hash(p) for p in sorted(files)})


def command_fingerprints(config):
    """Record resolvable external executables/scripts without importing them."""
    hashes = {}
    for provider, options in config["providers"].items():
        command = options.get("command", [])
        if not isinstance(command, list):
            continue
        for index, argument in enumerate(command):
            if not isinstance(argument, str):
                continue
            candidate = Path(argument)
            if index == 0 and not candidate.is_file():
                candidate = Path(shutil.which(argument) or argument)
            if candidate.is_file():
                hashes[f"{provider}:{index}"] = content_hash(candidate)
    return hashes


def analyze(audio_path, *, providers=None, config=None, runs_dir=None, enabled=None, track_id=None, dataset=None):
    config = config or load_config()
    providers = list(dict.fromkeys(providers or ["plexus", "librosa"]))
    registry = load_registry()
    unknown = set(providers) - registry.keys()
    if unknown:
        raise ValueError(f"Unknown providers: {sorted(unknown)}")
    audio = load_audio(audio_path, track_id)
    env = environment()
    commit = git_commit()
    started = timestamp()
    reproducibility = {"track": audio.metadata, "configHash": object_hash(config), "plexusCommit": commit,
                       "sourceHash": source_fingerprint(), "environment": env, "providers": providers,
                       "enabled": sorted(enabled or []), "dataset": dataset, "commandHashes": command_fingerprints(config)}
    measurement_hash = object_hash(reproducibility)
    # Each attempt is separate; reproducibilityHash groups repeated measurements.
    run_id = object_hash({"measurement": measurement_hash, "timestamp": started})
    run_dir = (Path(runs_dir or LAB_ROOT / "runs") / run_id).resolve()
    run_dir.mkdir(parents=True, exist_ok=False)
    manifest = {"schemaVersion": SCHEMA_VERSION, "runId": run_id, "reproducibilityHash": measurement_hash,
                "track": audio.metadata, "configHash": object_hash(config), "config": config,
                "plexusCommit": commit, "timestamp": started,
                "environment": {**env, "sourceHash": reproducibility["sourceHash"], "commandHashes": reproducibility["commandHashes"]},
                "schemaVersions": {kind: SCHEMA_VERSION for kind in ("canonical-analysis", "run-manifest", "benchmark-report", "training-example")},
                "randomSeeds": {"split": config["seed"]}, "dataset": dataset, "providers": {}}
    for provider in providers:
        entry = registry[provider]
        if not entry["enabledByDefault"] and provider not in (enabled or []):
            manifest["providers"][provider] = {"status": "disabled", "reason": "Explicit --enable-provider required by provider policy"}
            continue
        if provider == "plexus":
            adapter = PlexusAdapter()
        elif provider == "librosa":
            adapter = LibrosaAdapter()
        else:
            adapter = ExternalProcessAdapter(provider, config["providers"].get(provider, {}))
        clock = time.monotonic()
        try:
            result = validate(adapter.analyze(audio, run_dir, config, started))
            name = f"{provider}.canonical.json"
            write_json(run_dir / name, result)
            prov = result["provenance"]
            manifest["providers"][provider] = {"status": "success", "canonical": name,
                **{k: prov[k] for k in ("toolVersion", "modelIdentifier", "modelVersion", "modelChecksum", "parameters")},
                **getattr(adapter, "diagnostics", {}), "elapsedSeconds": time.monotonic() - clock}
            if provider == "plexus":
                manifest["providers"][provider]["raw"] = "plexus.raw.json"
        except Exception as exc:
            diagnostics = getattr(adapter, "diagnostics", {})
            manifest["providers"][provider] = {"status": getattr(exc, "status", "failed"),
                "reason": f"{type(exc).__name__}: {exc}",
                "exitCode": getattr(exc, "exit_code", None) if getattr(exc, "exit_code", None) is not None else diagnostics.get("exitCode"),
                "stderr": getattr(exc, "stderr", "") or diagnostics.get("stderr", ""), "elapsedSeconds": time.monotonic() - clock}
        # Preserve completed provider outcomes even if the next provider is interrupted.
        write_json(run_dir / "manifest.json", validate(manifest, "run-manifest"))
    # Resolve identity with actual provider version/model provenance, not command
    # paths alone: a changed external model must produce a different measurement.
    manifest["reproducibilityHash"] = object_hash({**reproducibility, "actualProviders": {
        key: {field: entry.get(field) for field in ("status", "toolVersion", "modelIdentifier", "modelVersion", "modelChecksum", "parameters")}
        for key, entry in manifest["providers"].items()}})
    write_json(run_dir / "manifest.json", validate(manifest, "run-manifest"))
    generate_report(run_dir)
    return run_dir


def benchmark(manifest_path, *, config=None, runs_dir=None, providers=None, enabled=None):
    manifest = load_manifest(manifest_path)
    # Verify actual assets, even when a reference-only manifest has unknown hashes.
    # Reject leakage before any track can produce an exportable measurement.
    actual_hashes = {}
    for track in manifest["tracks"]:
        asset = resolve_reference(track["audio"], manifest_path)
        if "://" in str(asset) or not Path(asset).is_file():
            continue  # Individual unavailable tracks are reported below.
        digest = content_hash(asset)
        if digest in actual_hashes and actual_hashes[digest][1] != track["split"]:
            raise ValueError(f"Actual audio content leakage across splits: {actual_hashes[digest][0]} and {track['trackId']}")
        actual_hashes[digest] = (track["trackId"], track["split"])
    runs_dir = Path(runs_dir or LAB_ROOT / "runs")
    runs_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for track in manifest["tracks"]:
        try:
            audio_path = resolve_reference(track["audio"], manifest_path)
            if "://" in str(audio_path):
                raise ValueError("Benchmark requires a local asset; downloading remote datasets is explicit separate work")
            if track["contentHash"] and content_hash(audio_path) != track["contentHash"]:
                raise ValueError("Dataset audio content hash mismatch")
            dataset = {"datasetId": manifest["datasetId"], "datasetVersion": manifest["datasetVersion"],
                       **{key: track[key] for key in ("split", "license", "licenseSource", "allowedResearchUsage")}}
            path = analyze(audio_path, providers=providers, config=config, runs_dir=runs_dir, enabled=enabled,
                           track_id=track["trackId"], dataset=dataset)
            provider_results = json.loads((path / "manifest.json").read_text(encoding="utf-8"))["providers"]
            ok = all(p["status"] == "success" for p in provider_results.values())
            results.append({"trackId": track["trackId"], "status": "success" if ok else "partial", "run": str(path)})
        except Exception as exc:
            results.append({"trackId": track["trackId"], "status": "failed", "reason": str(exc)})
    summary = {"datasetId": manifest["datasetId"], "datasetVersion": manifest["datasetVersion"], "tracks": results}
    output = runs_dir / f"benchmark-{object_hash({'manifest': manifest, 'timestamp': timestamp()})}.json"
    write_json(output, summary)
    return output, summary
