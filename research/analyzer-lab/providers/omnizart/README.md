# Omnizart

Status: **planned**, disabled by default. There is no provider-specific wrapper bundled with this lab. Upstream version checked on 2026-10-10: `0.6.3`. Python evidence: >=3.8 (PyPI metadata); dependency/platform compatibility requires isolated validation.

From this provider directory, after reviewing its model policy, create an isolated Python 3.11 environment and manually install the pinned package:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This command is documentation only; the lab never runs it. The environment and its caches/weights must remain ignored. Package installation may fetch dependencies; model downloads need a separate explicit decision.

An external wrapper must implement the lab JSON process protocol described in [the lab README](../../README.md), transform its actual outputs into canonical analysis, and preserve tool/model provenance. Supply an absolute interpreter/executable path as a command argument list in a user-owned registry/config, then pass `--enable-provider omnizart`. The checked-in `command: null` deliberately cannot launch a process. Installing the package alone does not implement this wrapper.

Code license: **MIT**. Model license: **unknown**. Usage policy: **requires-review**. Latest checked PyPI is 0.6.3, released 2026-05-31; master packaging files still show 0.6.0, so do not infer release metadata from master. Code MIT does not establish a separately verified checkpoint grant. Checkpoints require explicit download. Upstream documents a drum training convergence bug; transcription is advertised with supplied checkpoints.

task-specific-training-corpora: Choose a specific task/checkpoint and record its training corpus references. Repository constants include dataset loaders; their existence does not grant dataset rights.

Review [the license policy](../../docs/ORACLE-AND-LICENSE-POLICY.md) and [provider.json](provider.json) for dated primary source links. Record exact model identifier, version, source URL and SHA-256 in run provenance. Predictions remain `oracle_prediction`; no provider is treated as ground truth.

Planned canonical capability targets: beats, drumEvents, vocalPitch, noteTranscription, instrumentTranscription, chords. These remain planned until the isolated wrapper and task-specific validation are implemented.
