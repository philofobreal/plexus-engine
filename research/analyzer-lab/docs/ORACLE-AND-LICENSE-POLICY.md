# Oracle and license policy

This research subsystem follows [AGENTS.md](../../../AGENTS.md). It consumes production analyzer output; production code must never import this lab. The registry is an inventory and dated evidence record, not a legal guarantee. Evidence was checked against upstream primary sources on **2026-10-10**. Local package/model execution and redistribution rights are separate checks.

The permitted research flow is:

```text
third-party oracle
    -> numerical / structured output
    -> benchmark and measurement evidence
    -> independent Plexus algorithm design
    -> original implementation
```

Do not mechanically port third-party source, translate functions line by line, copy weights into the runtime without reviewing their license, ignore training dataset rights, or call oracle predictions ground truth. Comparisons between two predictions measure agreement and disagreement. They establish accuracy only when a separately identified, reviewed ground-truth annotation is available.

Keep five evidence kinds distinct: `ground_truth`, `oracle_prediction`, `pseudo_label`, `plexus_prediction`, and `human_annotation`. A human annotation is not automatically promoted to ground truth without its declared provenance and review status. Consensus must retain contributors, tolerance, confidence, agreement and ground-truth status. Neither consensus nor confidence clears intellectual-property restrictions.

## Code, model and dataset evidence

| Provider | Selected / checked version | Code license | Model evidence and policy |
| --- | --- | --- | --- |
| librosa | Selected 0.11.0; latest checked 1.0.0 | ISC | No weights used in the initial tempo/beat/onset pipeline. Python 3.11 compatibility requires the explicit 0.11.0 selection. |
| mir_eval | 0.8.2 | MIT | Metrics library; no trained model in the selected evaluation functions. |
| Basic Pitch | 0.4.0 | Apache-2.0 | ICASSP 2022 weights are shipped, but a distinct grant naming those weights was not verified. `unknown` / `requires-review`. |
| Spleeter | 2.4.2 | MIT | Upstream paper explicitly states code and pretrained models are MIT. Record the actual model release, source and checksum independently of the package version. |
| Omnizart | 0.6.3 | MIT | Code license verified; downloaded task checkpoints have no separate verified grant in this audit. `unknown` / `requires-review`. |
| Essentia | Latest checked 2.1b6.dev1438, a development prerelease | AGPL-3.0-only in PyPI metadata | Official sources conflict on MTG model terms: CC-BY-NC-SA-4.0 versus CC-BY-NC-ND-4.0. `unknown`, `reference-only`, explicit opt-in; model-specific review remains required. |
| MSAF | 0.1.80 | MIT | Packaging includes OLDA trained `.npy` assets. Separate weight grant unverified; `unknown` / `requires-review`, or select a reviewed model-free algorithm. |

Unknown means missing verified evidence, not a conclusion that permission does or does not exist. A repository license or a permissive loader library does not automatically license weights, audio, MIDI, annotations, derived labels or every dependency.

Essentia remains a reference-only process provider by default. Process separation protects architecture and dependencies; it does not establish an exemption from license obligations. Official licensing prose also discusses third-party dependencies and proprietary licensing. Review the exact code build, linked libraries and model artifact before any use that exceeds reviewed reference research.

No optional provider is installed or launched automatically. Its checked-in manifest has `enabledByDefault: false` and `command: null`. A user-owned command configuration and explicit `--enable-provider` are required. A manually installed package is still unavailable to the pipeline until a canonical wrapper is supplied. Model downloads require an explicit decision; keep environments, weights and audio out of Git.

## Primary evidence

- librosa selected package, Python requirement and license: [0.11.0 PyPI](https://pypi.org/project/librosa/0.11.0/), [tagged ISC license](https://github.com/librosa/librosa/blob/0.11.0/LICENSE.md). Latest checked [1.0.0 PyPI](https://pypi.org/project/librosa/1.0.0/) requires Python >=3.12.
- mir_eval selected [0.8.2 package](https://pypi.org/project/mir-eval/0.8.2/), [tagged MIT license](https://github.com/mir-evaluation/mir_eval/blob/0.8.2/LICENSE.txt), [tagged setup.cfg](https://github.com/mir-evaluation/mir_eval/blob/0.8.2/setup.cfg). The selected tag says Python >=3.7; current main may differ, and the lab core still targets Python 3.11.
- Basic Pitch [0.4.0 package](https://pypi.org/project/basic-pitch/0.4.0/), [tagged Apache license](https://github.com/spotify/basic-pitch/blob/v0.4.0/LICENSE), [tagged README](https://github.com/spotify/basic-pitch/blob/v0.4.0/README.md), [model directory](https://github.com/spotify/basic-pitch/tree/v0.4.0/basic_pitch/saved_models/icassp_2022), [tagged packaging](https://github.com/spotify/basic-pitch/blob/v0.4.0/pyproject.toml).
- Spleeter [2.4.2 package](https://pypi.org/project/spleeter/2.4.2/), [MIT license](https://github.com/deezer/spleeter/blob/master/LICENSE), [upstream paper](https://github.com/deezer/spleeter/blob/master/paper.md), [published JOSS paper](https://joss.theoj.org/papers/10.21105/joss.02154). The paper explicitly covers pretrained models and distinguishes its training data from MUSDB18 evaluation.
- Omnizart [0.6.3 package](https://pypi.org/project/omnizart/0.6.3/), [MIT license](https://github.com/Music-and-Culture-Technology-Lab/omnizart/blob/master/LICENSE), [README and supported applications](https://github.com/Music-and-Culture-Technology-Lab/omnizart), [dataset constants](https://github.com/Music-and-Culture-Technology-Lab/omnizart/blob/master/omnizart/constants/datasets.py). Current master packaging may still say 0.6.0; the recorded release evidence comes from PyPI.
- Essentia [checked prerelease package](https://pypi.org/project/essentia/2.1b6.dev1438/), [AGPL text](https://github.com/MTG/essentia/blob/master/COPYING.txt), [official model listing: NC-SA](https://essentia.upf.edu/models.html), [official licensing page: NC-ND](https://essentia.upf.edu/licensing_information.html), [platform downloads](https://essentia.upf.edu/download.html). The checked release has CPython 3.14 Linux/macOS wheels; it is not a Python 3.11 or Windows installation recommendation.
- MSAF [0.1.80 package](https://pypi.org/project/msaf/0.1.80/), [MIT license](https://github.com/urinieto/msaf/blob/main/LICENSE.md), [packaging and OLDA asset inclusion](https://github.com/urinieto/msaf/blob/main/setup.py), [OLDA model directory](https://github.com/urinieto/msaf/tree/main/msaf/algorithms/olda/models), [dataset installation notes](https://msaf.readthedocs.io/en/latest/install.html).

Release-pinned URLs are used where verified. Moving master/main URLs are explicitly audit evidence snapshots rather than immutable model provenance. Before promotion, save an exact commit/model source and hash in the local run manifest, review per-artifact LICENSE/metadata, record dataset permissions and preserve attribution notices. Policy changes must identify which evidence resolves each existing `unknown` or conflict.

## T13f extension - checked 2026-10-28

The separately authorized [full-song study](FULL-SONG-STRUCTURE-STUDY.md) executes two external
families explicitly through standalone local research commands, not an automatically enabled
registry provider. All-In-One harmonix-all (eight folds = one vote) uses the fixed official model
revision and the MIT-tagged [checkpoint repository](https://huggingface.co/taejunkim/allinone), via
[all-in-one-infer](https://github.com/openmirlab/all-in-one-infer) 3.1.0. Actual code/dependency/model
hashes and HTDemucs preprocessing are retained per run. This does not qualify the inference port
or model for production embedding or establish independent musical accuracy.

SongFormer uses the fixed official [integrated checkpoint](https://huggingface.co/ASLP-lab/SongFormer)
and reviewed local source. Its repository CC-BY-4.0 notice is not a separate grant for every
embedded model; its MuQ component's [official model card](https://huggingface.co/OpenMuQ/MuQ-large-msd-iter)
states CC-BY-NC-4.0. Keep the combined artifact reference-only/requires-review; no production
commercial-use permission, derived training target eligibility or redistribution grant is inferred.
MSAF is imported by the upstream SongFormer code and is not counted as another structural model.
This structural prediction study does not replace the existing two-library onset-reference policy.
