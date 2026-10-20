# Music Structure Analysis Framework

Status: **planned**, disabled by default. There is no provider-specific wrapper bundled with this lab. Upstream version checked on 2026-10-10: `0.1.80`. Python evidence: No explicit Requires-Python verified; old classifiers are not a modern compatibility guarantee.

No requirements file is supplied: first select and verify a platform-compatible isolated environment and exact package/build. The latest checked upstream release is evidence, not an automatic installation recommendation. Do not install it into the core environment.

An external wrapper must implement the lab JSON process protocol described in [the lab README](../../README.md), transform its actual outputs into canonical analysis, and preserve tool/model provenance. Supply an absolute interpreter/executable path as a command argument list in a user-owned registry/config, then pass `--enable-provider msaf`. The checked-in `command: null` deliberately cannot launch a process. Installing the package alone does not implement this wrapper.

Code license: **MIT**. Model license: **unknown**. Usage policy: **requires-review**. Latest checked release 0.1.80 (2023-06-25). Packaging ships OLDA .npy trained model assets; repository MIT alone is not a distinct verified weight grant. Prefer a reviewed model-free segmentation algorithm until artifact evidence is recorded. Section labels express acoustic similarity, not automatically verse/chorus or Plexus dramaturgy semantics.

msaf-data: Optional evaluation datasets live in a separate repository. Audio, annotations and every dataset license require separate review; do not download automatically.

Review [the license policy](../../docs/ORACLE-AND-LICENSE-POLICY.md) and [provider.json](provider.json) for dated primary source links. Record exact model identifier, version, source URL and SHA-256 in run provenance. Predictions remain `oracle_prediction`; no provider is treated as ground truth.

Planned canonical capability targets: sectionBoundaries, sectionLabels. These remain planned until the isolated wrapper and task-specific validation are implemented.
