# Essentia reference provider

Status: **planned**, disabled by default. There is no provider-specific wrapper bundled with this lab. Upstream version checked on 2026-10-10: `2.1b6.dev1438`. Python evidence: Latest checked wheel release: CPython 3.14, Linux/macOS; no Windows wheel or general Requires-Python verified.

No requirements file is supplied: first select and verify a platform-compatible isolated environment and exact package/build. The latest checked upstream release is evidence, not an automatic installation recommendation. Do not install it into the core environment.

An external wrapper must implement the lab JSON process protocol described in [the lab README](../../README.md), transform its actual outputs into canonical analysis, and preserve tool/model provenance. Supply an absolute interpreter/executable path as a command argument list in a user-owned registry/config, then pass `--enable-provider essentia`. The checked-in `command: null` deliberately cannot launch a process. Installing the package alone does not implement this wrapper.

Code license: **AGPL-3.0-only**. Model license: **unknown**. Usage policy: **reference-only**. Latest checked package is explicitly a development prerelease, not a stable recommendation or lab Python 3.11 pin. models.html says MTG models CC-BY-NC-SA-4.0, whereas licensing_information.html says CC-BY-NC-ND-4.0. Resolve the exact model license from its own metadata/LICENSE before use. AGPL code and third-party dependency obligations need review; process isolation is architectural, not a legal exemption.

selected-model-training-corpus: Model-free algorithms need no training dataset. Any selected pretrained model must record per-artifact metadata, dataset provenance and license; external third-party models may differ from MTG models.

Review [the license policy](../../docs/ORACLE-AND-LICENSE-POLICY.md) and [provider.json](provider.json) for dated primary source links. Record exact model identifier, version, source URL and SHA-256 in run provenance. Predictions remain `oracle_prediction`; no provider is treated as ground truth.

Planned canonical capability targets: tempo, beats, onsets, predominantPitch, chords, key, instrumentPresence. These remain planned until the isolated wrapper and task-specific validation are implemented.
