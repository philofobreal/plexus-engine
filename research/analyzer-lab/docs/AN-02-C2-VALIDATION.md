# AN-02 C2 validation: candidate loss under mixtures and modulation

Date: 2026-10-11 local / 2026-10-10 UTC. Owner: root, offline analyzer research
and test infrastructure. Production algorithm 7, v1 candidate stream, shared
contracts and all consumers are unchanged in this cycle.

The [predeclared protocol](AN-02-C2-EXPERIMENT.md) and
[immutable measurement](../fixtures/an02-c2-challenges.summary.json) establish
**diagnostic coverage, not musical acceptance**. The matrix has 144 distinct mono
f32le PCM cases, 432 generator-start annotations and 36 negative conditions with
25.2 s exposure. Node 25.2.1, npm 11.6.2, existing Python 3.12.14 environment,
librosa 0.11.0, mir_eval 0.8.2 and numpy 2.2.6 were used without installation.

Every case checks actual-v1/instrumented output parity and no PCM mutation by the
Plexus/tracer. Python verifies the transmitted PCM/truth hashes and clock before
passing the same samples to librosa. Raw timestamps are preserved. Maximum
cardinality one-to-one matching is recomputed at 10/20/25/30/50/70 ms; each
condition retains counts and matched-only signed/p95/p99 timing diagnostics.

## Results at 25 ms

These scores refer to **authored discrete added attacks**. They do not assess all
human-perceived onsets, drum identity, salience, or recorded music. Macro and micro
curves and all conditions remain in the measurement; this table shows micro recall
with false-positive counts, rather than averaging timing errors across conditions.

| Condition | Truth | Plexus v1 matched / FP | Gated strength NMS matched / FP | Ungated strength NMS matched / FP | librosa N512 matched / FP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Isolated, four gains | 72 | 36 / 0 | 36 / 0 | 72 / 0 | 44 / 1 |
| Added attacks over 110 Hz carrier | 144 | 0 / 24 | 0 / 24 | 144 / 1156 | 142 / 62 |
| Six dense attacks, six gaps | 216 | 111 / 0 | 117 / 0 | 159 / 0 | 108 / 2 |

The librosa reference uses N=512,H=128 instead of the general lab adapter's
default N=2048, with actual fs, centering, no backtracking and installed defaults.
The reference is a prediction with a different selection rule. Its high recall
on mixtures is useful evidence about recoverable attacks; its false positives
prevent treating it as an automatic acceptance rule or ground truth.

At 70 ms, v1's matched totals stay 36/0/111. Librosa reaches 45/144/110.
The v1 mixture loss is therefore not repaired by accepting a larger timing error.

## Loss stages and protected counterexamples

Before the energy gate, unique refined proposals match all 72 isolated and 144
mixture truths at 25 ms. After the gate these fall to 36 and zero. Isolated gains
1 and 0.001 each retain all 18 events; gains 0.00001 and 0.000001 each retain none.
This diagnoses the fixed power floor on these mathematically defined signals;
it does not establish that those very quiet signals must be audible XR targets.

In mixtures, even the strongest declared ratio need not double **30 ms average
total power**: a 4 ms decaying hit occupies only part of that averaging support.
A largest positive sample-power step can also select a carrier oscillation.
Matching refined proposals only establishes an upper bound on recoverability;
their 2972 extra positions are not valid accepted attacks.

| Dense gap | Truth | Refined before gate | Gated before NMS | v1 final | Strength NMS final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 ms | 36 | 27 | 14 | 5 | 7 |
| 12 ms | 36 | 27 | 15 | 5 | 9 |
| 16 ms | 36 | 27 | 13 | 13 | 13 |
| 24 ms | 36 | 31 | 16 | 16 | 16 |
| 40 ms | 36 | 36 | 36 | 36 | 36 |
| 80 ms | 36 | 36 | 36 | 36 | 36 |

Stage columns are independent maximum-cardinality match counts, not causal
per-event assignments or additive loss probabilities. Gate rejection flags may
overlap. Peak counts alone do not distinguish FFT proposal loss from sample-step
localization loss. Very short gaps also challenge the fixed physical FFT support;
15 ms suppression deliberately removes some sub-15 ms attacks.

On the annotated negative domain [0.1,0.8), v1 produces **38** hits: 8 on smooth
rises, 13 on amplitude modulation, 17 on beating, and zero on sustain/fade/cutoff.
This is 90.48/min over only 25.2 s, with 22/36 clean conditions. It is a short
stress measurement, not a population rate estimate. These signals can legitimately
drive continuous visual energy; this task gives them no discrete authored attack.
An onset library's different interpretation of modulation is not a universal
library defect.

Strength-ordered NMS recovers six dense events but raises negative hits from
38 to **94**. Gate bypass raises negative hits to **799**; librosa produces **430**
under this controlled configuration. Thus neither simply replacing suppression
nor removing the power gate meets the consumer's selective-impact requirement.

## Development decision

Keep both ablations outside production. The measured next development slice is
a separate research proposal rule using frequency-local novelty and estimated
stable tonal/background activity, with an explicit absolute audibility policy.
Compare it to total-power gating; test weak added broadband attacks and a new
tonal attack over a carrier alongside smooth rises, beating and modulation.
Do not turn every energy rise into a discrete choreography/XR target.

Use physically declared short-window support across rates and retain a longer
body/sustain descriptor separately. Refine time against local attack evidence
after proposal selection; retain uncertainty rather than promising sample-exact
musical starts. Study suppression separately with negative-event evidence: the
stronger-first rule has an observed tradeoff, not an unconditional improvement.

Use this corpus as known development/regression material. Any claim of broader
improvement requires fresh independently annotated recordings/renderings and
new final-test material. VJ salient impacts and XR target pools need separate
acceptance labels and precision/recall requirements. Build/pytest success cannot
substitute for those musical gates or physical audio/display/input measurements.

## Preserved failed attempts

The first trace test passed 5/6 and failed strict equality because a VM array
retained its prototype. Host `Array.from` fixes diagnostic transport without
changing any assertion or kernel behavior. The
[failure and original sources](../fixtures/history/an02-c2-trace/failure.json)
remain; all six new Node tests then passed.

The protocol-v1 reference run failed its at-or-beyond-duration guard. The
[original protocol/evaluator/tests and failure](../fixtures/history/an02-c2-reference-clock/failure.json)
remain. Protocol v2 retains padded-context predictions explicitly as extra FP.
Two actual librosa outputs occur at 0.8 s on negative cases c2-042 and c2-044.
They are never clamped, dropped, shifted or promoted to observed-sample targets.
The evaluator adds explicit positive/negative endpoint assertions; 13 new Python
tests pass. No v1 musical score or successful measurement is claimed.

## Cumulative execution and reproduction

The new append-only inventory is
[v0003](../tools/harness/inventories/v0003.json), with **371 protected files**, all
133 active Node files, all 20 active Python files and 48 explicitly unexecuted
historical mirrors. It replaces no v1/v2 inventory, code, result or active test.
Its source ZIP SHA256 is
`2d87bbf9c5e4308f1d8f350d03904dae231162870d25e27c192a3176e64116b4`.
The measurement SHA256 is
`90a9c24c960c7f518f787599b7cdb09a66ca3330d5798a42ec5a9f240ccd844a`.

Full cumulative run **20261010T224709-f6167c1d1f9b** completed. Its
[immutable history](../tools/harness/history/20261010T224709-f6167c1d1f9b.json)
records the following actual outcomes:

- Build: passed, 8.5 s; existing Vite large-chunk advisory is nonfatal.
- Node: **1331 tests / 1322 passed / 9 failed**, zero skip/cancel/TODO.
  All 133/133 expected active files executed, with no missing/unexpected files.
- Python: **252 passed**, all 20/20 expected files executed; pytest 83.93 s.
- All nine failures exactly match the known Wormhole baseline assertion evidence;
  unknown failures: **zero**. Overall status is **failed / exit 1**, never masked
  green. This accepts the diagnostic infrastructure, not a production release or
  the candidate-quality scores.
- Pre/post inventory gates passed; `sourceChangedDuringRun=false`. Production/lab
  source identity equals the corrected first-cycle history's identity. Golden
  fixtures, all earlier active tests and previous results are unchanged.

Node's global duration is 596.149 s (596.75 s stage). This whole-suite wall time
is not an analyzer performance benchmark. The full-evidence digest was independently
recomputed from the report under its recorded canonical-JSON convention:
`147e3d34235554424fd88c0bb487485a0fcb6d34111a1837a3370dd2fac545b8`.
History file SHA256:
`3b73e0812156b713e837a6406e513dfa3d04d1f24b9c2e9f7872c4abd0315845`.
Full ignored report `.cache/an02-c2-full-validation-20261011.json` SHA256:
`f0566a2f38645314f98a1c69da3c7ec7febb4b7eeb853fe4c36bfc74bcca417b`.
The expected/executed Node path-list hashes agree:
`f8faba2f234fd6d40535987c1482bd6011fb1b3096bf16b7045e9c07694646a7`.

The harness preserved a fresh short temp root `.cache/t8cb2cc422a00/`; its pytest
`p` directory was verified absent before execution. No old temporary fixtures
were deleted or reused. Final focused hygiene review: 17 new/source/document
files plus the strategy document, zero issues; `git diff --check` passed.

Commands from the repository root (fresh output/temp paths required):

```powershell
node --test tests/analyzer-acoustic-challenges.test.mjs
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_acoustic_challenges.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/c2-focused-20261011-b
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/measure-an02-challenges.py --output research/analyzer-lab/fixtures/an02-c2-challenges.summary.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an02-c2-inventory-v3.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an02-c2-full-validation-20261011.json
git diff --check
```

Do not rerun the recorded measurement command onto its existing immutable result;
substitute a new `.cache/` output. The earlier Python-focused command used fresh
`.cache/c2-focused-20261011-a` and passed 12 tests before adding endpoint coverage.
The existing lab Python is used directly for its pinned MIR dependencies; Node/npm
come from PATH. No Bun, package fallback, installation or golden generator ran.

Manual review covers instrumentation anchors, v1 parity, PCM/truth identities,
stage/negative denominators, collision matching, out-of-domain timestamps and
preservation of failed evidence. Browser/playback/Quest smoke, recorded music,
decoder parity and long-track profiling were not run: this cycle changes research
fixtures and measurement code only. `diff_export.ps1` is skipped as unnecessary
for this local research change; focused source and inventory review is used.
