# Deezer Spleeter

Status: **planned**, disabled by default. There is no provider-specific wrapper bundled with this lab. Upstream version checked on 2026-10-10: `2.4.2`. Python evidence: >=3.8,<3.12.

From this provider directory, after reviewing its model policy, create an isolated Python 3.11 environment and manually install the pinned package:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

This command is documentation only; the lab never runs it. The environment and its caches/weights must remain ignored. Package installation may fetch dependencies; model downloads need a separate explicit decision.

An external wrapper must implement the lab JSON process protocol described in [the lab README](../../README.md), transform its actual outputs into canonical analysis, and preserve tool/model provenance. Supply an absolute interpreter/executable path as a command argument list in a user-owned registry/config, then pass `--enable-provider spleeter`. The checked-in `command: null` deliberately cannot launch a process. Installing the package alone does not implement this wrapper.

Code license: **MIT**. Model license: **MIT**. Usage policy: **permissive**. Upstream JOSS paper explicitly licenses source code and pretrained models MIT. Pin the exact 2/4/5-stem weight artifact checksum and retain notices before use. Code version and model release identity differ. Stem separation alone is not validated frame activity or instrument presence.

training-corpus: Provided weights support inference without training data. Upstream paper says models were not trained, validated or optimized on MUSDB18; benchmark dataset rights remain separate.

Review [the license policy](../../docs/ORACLE-AND-LICENSE-POLICY.md) and [provider.json](provider.json) for dated primary source links. Record exact model identifier, version, source URL and SHA-256 in run provenance. Predictions remain `oracle_prediction`; no provider is treated as ground truth.

Planned canonical capability targets: sourceSeparation. These remain planned until the isolated wrapper and task-specific validation are implemented.
