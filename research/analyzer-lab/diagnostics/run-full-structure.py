"""Explicit local oracle run; no production import, upload, training or promotion.

From the repository root, using the isolated lab environment:
  python research/analyzer-lab/diagnostics/run-full-structure.py --provider allinone \
    --audio TRACK1 TRACK2 TRACK3 --output NEW_DIRECTORY
  python research/analyzer-lab/diagnostics/run-full-structure.py --provider songformer \
    --model-dir REVIEWED_LOCAL_SNAPSHOT --audio TRACK1 TRACK2 TRACK3 --output NEW_DIRECTORY

The caller prepares/reviews external model artifacts. Outputs are predictions, never truth.
Decode channel 0 to 44.1-kHz float32 once; both providers consume that exact lossless WAV.
Model-required resampling is internal and does not reset the song clock. No crop/chunk voting.
"""
import argparse
from dataclasses import asdict
from hashlib import sha256
from importlib.metadata import distributions
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import time
import traceback

SONG_REVISION = "a75880ed1b7375ac71860ec6c4fc9c899cf99515"
SONG_WEIGHTS = "8dcabf4ea19973edd51b9e5794004775fa7e8de3ecfa07eb1dbce00f516ce7f7"


def digest(path):
    h = sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write(path, value):
    with Path(path).open("x", encoding="utf8") as stream:
        json.dump(value, stream, ensure_ascii=True, indent=2, allow_nan=False)
        stream.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["allinone", "songformer"], required=True)
    parser.add_argument("--audio", nargs="+", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--cache", type=Path, default=Path("research/analyzer-lab/.cache/structure"))
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--allinone-model", default="harmonix-all")
    args = parser.parse_args()
    if not 1 <= args.threads <= 16 or any(not p.is_file() for p in args.audio):
        parser.error("Need existing local audio and 1..16 CPU threads")
    if args.provider == "songformer" and not args.model_dir:
        parser.error("SongFormer needs an explicitly reviewed local snapshot")
    args.output.mkdir(parents=True, exist_ok=False)
    args.cache.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str((args.cache / "huggingface").resolve())
    os.environ["TORCH_HOME"] = str((args.cache / "torch").resolve())
    os.environ["HF_HUB_DISABLE_XET"] = "1"
    os.environ["OMP_NUM_THREADS"] = str(args.threads)
    os.environ["MKL_NUM_THREADS"] = str(args.threads)
    import numpy as np
    import soundfile as sf
    import torch
    random.seed(0)
    np.random.seed(0)
    torch.manual_seed(0)
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    report = {
        "version": 1, "provider": args.provider, "family": args.provider,
        "runnerSha256": digest(__file__), "command": sys.argv,
        "evidenceType": "oracle_prediction", "groundTruthStatus": False,
        "device": "cpu", "seed": 0, "threads": args.threads,
        "projection": "ffmpeg-channel0-f32le-44100", "clock": "original-song-seconds",
        "python": sys.version, "packages": sorted(
            [{"name": d.metadata["Name"], "version": d.version} for d in distributions()],
            key=lambda d: d["name"].lower()),
        "model": {}, "tracks": [],
        "limitations": ["oracle agreement is not accuracy", "taxonomies are not interchangeable",
                        "research-only external weights; no product redistribution"],
    }
    try:
        paths = []
        for i, audio in enumerate(args.audio):
            print(f"Decode {i}: {audio.name}", flush=True)
            pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-af",
                                  "pan=mono|c0=c0", "-ar", "44100", "-f", "f32le", "pipe:1"],
                                 stdout=subprocess.PIPE, check=True).stdout
            samples = np.frombuffer(pcm, dtype="<f4")
            duration = len(samples) / 44100
            if not len(samples) or not np.isfinite(samples).all():
                raise ValueError("Need nonempty finite decoded PCM")
            if args.provider == "songformer" and not 1 <= duration <= 420:
                raise ValueError("SongFormer wrapper is validated for complete 1..420-second recordings; never crop longer input")
            wav = args.output / f"track-{i}.wav"
            sf.write(wav, samples, 44100, subtype="FLOAT")
            paths.append(wav)
            report["tracks"].append({"path": str(audio.resolve()), "inputSha256": digest(audio),
                                     "pcmSha256": sha256(pcm).hexdigest(), "sampleRate": 44100,
                                     "samples": len(samples), "durationSec": duration})
        write(args.output / "request.json", report)
        started = time.perf_counter()
        if args.provider == "allinone":
            import allin1_infer
            from allin1_infer.models.loaders import NAME_TO_FILE, ENSEMBLE_MODELS
            from huggingface_hub import hf_hub_download
            names = ENSEMBLE_MODELS.get(args.allinone_model, [args.allinone_model])
            artifacts = [Path(hf_hub_download("taejunkim/allinone", NAME_TO_FILE[n],
                                             revision="379e5fd010b3fdd0ee8381ff8cbcfa51d70b5c19")) for n in names]
            import allin1_infer.models.loaders as loaders
            pinned = dict(zip(names, artifacts))
            loaders._download_checkpoint = lambda name, cache_dir=None: str(pinned[name])
            report["model"] = {"name": args.allinone_model, "familyVotes": 1,
                                "revision": "379e5fd010b3fdd0ee8381ff8cbcfa51d70b5c19",
                                "checkpoints": [{"path": str(p), "sha256": digest(p)} for p in artifacts]}
            # Pinned upstream tensor/config checkpoint uses legacy torch serialization.
            # Allow only its embedded plain containers; never enable arbitrary pickle loading.
            results = allin1_infer.analyze(paths, out_dir=args.output / "raw", device="cpu",
                model=args.allinone_model, multiprocess=False, keep_byproducts=True,
                demix_dir=args.output / "demix", spec_dir=args.output / "spec",
                include_activations=True, overwrite=False)
            if not isinstance(results, list):
                results = [results]
            by_path = {str(r.path.resolve()): r for r in results}
            for wav, track in zip(paths, report["tracks"]):
                r = by_path[str(wav.resolve())]
                track.update({"segments": [asdict(s) for s in r.segments], "beats": r.beats,
                              "downbeats": r.downbeats, "bpm": r.bpm, "status": "complete"})
        else:
            root = args.model_dir.resolve()
            weights = root / "model.safetensors"
            if digest(weights) != SONG_WEIGHTS:
                raise ValueError("SongFormer checkpoint does not match the pinned upstream LFS SHA256")
            source_files = [p for p in root.rglob("*") if p.is_file()
                            and ".cache" not in p.parts and "__pycache__" not in p.parts
                            and (p.suffix in [".py", ".json"] or p.name == "LICENSE")]
            report["model"] = {"revision": SONG_REVISION, "weightsSha256": SONG_WEIGHTS,
                "source": [{"path": str(p.relative_to(root)), "sha256": digest(p)} for p in sorted(source_files)]}
            os.environ["SONGFORMER_LOCAL_DIR"] = str(root)
            sys.path.insert(0, str(root))
            from modeling_songformer import SongFormerModel
            model, loading = SongFormerModel.from_pretrained(root, local_files_only=True,
                low_cpu_mem_usage=False, output_loading_info=True)
            report["model"]["loading"] = loading
            if any(loading[k] for k in ["missing_keys", "unexpected_keys", "mismatched_keys", "error_msgs"]):
                raise ValueError("SongFormer weights have missing, unexpected or mismatched parameters")
            model = model.to("cpu").eval()
            for i, (wav, track) in enumerate(zip(paths, report["tracks"])):
                print(f"SongFormer full track {i}", flush=True)
                with torch.inference_mode():
                    track["segments"] = model(str(wav))
                track["status"] = "complete"
                write(args.output / f"track-{i}.prediction.json", track)
        report["elapsedSec"] = time.perf_counter() - started
        report["status"] = "complete"
    except Exception as error:
        report.update({"status": "failed", "error": f"{type(error).__name__}: {error}"})
        traceback.print_exc()
    finally:
        report["artifacts"] = [{"path": str(p.relative_to(args.cache)), "bytes": p.stat().st_size,
                                "sha256": digest(p)} for p in sorted(args.cache.rglob("*"))
                               if p.is_file() and p.suffix in [".pth", ".pt", ".th", ".yaml", ".json"]]
        write(args.output / "predictions.json", report)
    if report["status"] != "complete":
        raise SystemExit(1)
    print(json.dumps({"status": report["status"], "tracks": len(report["tracks"]),
                      "elapsedSec": report["elapsedSec"]}), flush=True)


if __name__ == "__main__":
    main()
