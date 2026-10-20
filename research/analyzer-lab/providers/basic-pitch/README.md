# Spotify Basic Pitch

Status: **planned**, disabled by default. There is no provider-specific wrapper bundled with this lab. Upstream version checked on 2026-10-10: `0.4.0`. Python evidence: 3.8-3.11 advertised classifiers; README also mentions 3.7; no Requires-Python field verified.

From this provider directory, after reviewing its model policy, create an isolated Python 3.11 environment and manually install the pinned package:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This command is documentation only; the lab never runs it. The environment and its caches/weights must remain ignored. Package installation may fetch dependencies; model downloads need a separate explicit decision.

An external wrapper must implement the lab JSON process protocol described in [the lab README](../../README.md), transform its actual outputs into canonical analysis, and preserve tool/model provenance. Supply an absolute interpreter/executable path as a command argument list in a user-owned registry/config, then pass `--enable-provider basic-pitch`. The checked-in `command: null` deliberately cannot launch a process. Installing the package alone does not implement this wrapper.

Code license: **Apache-2.0**. Model license: **unknown**. Usage policy: **requires-review**. Code grant is explicit Apache-2.0. A distinct grant specifically naming model weights was not verified; unknown is an evidence gap, not a claim that use is forbidden. Polyphonic pitch output does not identify instruments or guarantee predominant melody. Best on one instrument at a time.

training-corpora: Inference uses shipped ICASSP 2022 model. Training/data extras and every source corpus need separate provenance and rights review.

Review [the license policy](../../docs/ORACLE-AND-LICENSE-POLICY.md) and [provider.json](provider.json) for dated primary source links. Record exact model identifier, version, source URL and SHA-256 in run provenance. Predictions remain `oracle_prediction`; no provider is treated as ground truth.

Planned canonical capability targets: predominantPitch, noteTranscription. These remain planned until the isolated wrapper and task-specific validation are implemented.
