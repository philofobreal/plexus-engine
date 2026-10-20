# AN-04C — harmonic model, numerical validation and continuity limits

Date: 2026-10-14, Europe/Budapest. Integration owner: Codex / root.
[Protocol](AN-04C-EXPERIMENT.md), [API and limitations](../../../documents/features/analyzer-harmonic-evidence.md).

## Implementation and evidence scope

Own analyzer code now measures the residual of a stationary harmonic model,
prefix versus suffix compatibility, and three-frame observed pitch continuity.
Two-pass QR avoids assuming finite-window sine/cosine columns are orthogonal.
The independent-column model is a declared numerical baseline, not a previous
production source separator. Existing raw pitch and library votes are unchanged.

The suffix is withheld from linear coefficient fitting only. Upstream AN-04B
frequency uses the full frame. These are **conditional** coefficient holdout
scores, not blind future prediction or independent pitch validation. No frequency
offset is tuned using truth/suffix. This distinction matters before training any
temporal model or interpreting small residual as generalized forecast accuracy.

`steady-harmonic-compatible` is an engineering compatibility criterion, not a
single-source certificate. Lack of history is classified `unstable`; missing
pitch and near-floor/rank failures remain unavailable. Every result preserves
null confidence, unverified isolation and diagnostic-only/XR-ineligible use.

## Authored measurements

The [development](../fixtures/an04c-development-01.json) and
[frozen transfer](../fixtures/an04c-transfer-frozen.json) each replay 20 AN-04B
conditions and add eight new conditions (28 total). Original PCM hashes and raw
AN-04B pitch JSON are verified exactly. New controls include stationary tone,
incommensurate/octave/unison mixtures, one-source gain change, vibrato, note
transition and tone-with-noise. New frequencies/rates/phases differ between
splits; both share generators and waveform families. This is controlled parameter
transfer, not independently annotated recorded music.

| Stationary monophonic model frames | Prefix residual / independent baseline | Suffix residual / independent baseline |
| --- | --- | --- |
| Development, 148 | 0.00003996 / 0.00097040 | 0.00027978 / 0.00118983 |
| Frozen transfer, 176 | 0.00002033 / 0.00070229 | 0.00014195 / 0.00077084 |

Fractions are error energy / centered signal energy. On these cases the QR model
has smaller mean prefix and suffix error; no real-song precision gain is inferred.
All individual frame values and counterexamples are retained; averages do not
establish correctness outside the model's stationary assumption.

Frozen new controls, 20 frames each:

- Incommensurate two-source mixture: all 20 have large residual.
- Octave and unison two-source mixtures: each has 18 compatible frames and two
  warmup frames. These are explicit counterexamples to compatibility => isolation.
- One-source vibrato: all 20 have large residual, despite one authored source.
- One-source gain step: three large-residual frames, one missing-pitch frame,
  fourteen compatible frames and two warmup frames.
- One-source note transition: four large-residual, four warmup and twelve
  compatible frames. No source-count or note-boundary prediction follows.
- Tone-with-noise: no primary pitch proposal, so harmonic evidence is unavailable.

The authored source-count fields are arrangement bookkeeping for controls only;
they never enter DSP or numerical-provider input and are not training labels
for arbitrary real-world physical sources.

## Two actual arithmetic providers, separate from MIR evidence

Actual NumPy 2.2.6 `lstsq` and SciPy 1.15.3 `lstsq` (gelsd), cutoff 1e-10,
solve the same fixed-frequency prefix matrix. Both raw residual/rank outputs,
source hashes, native DLL hashes and exact subprocess invocation are retained.
The deterministic sample is first/last **available model** frame per case;
unavailable models do not have defined residual denominators to compare.

- Development: 46/46 sampled models agree; maximum own-versus-provider residual
  difference 8.66e-15.
- Transfer: 46/46 agree; maximum own difference 8.44e-15.
- Recorded: 2/2 agree; maximum own difference 1.89e-15.

Agreement criterion is <=1e-10 absolute residual difference and equal provider
rank. These numerical samples cover 94 models in total; they do not independently
validate all 1032 evaluated musical frames. NumPy/SciPy may share LAPACK ancestry.
Global singular-value rank cutoff is not claimed identical to the own local QR
rank heuristic outside these sampled, well-defined cases. Frequency is a model
input, not a provider pitch prediction. No source-isolation reference exists.
Primary APIs: [NumPy](https://numpy.org/doc/2.2/reference/generated/numpy.linalg.lstsq.html),
[SciPy](https://docs.scipy.org/doc/scipy-1.15.3/reference/generated/scipy.linalg.lstsq.html).

The actual librosa/audioFlux MIR pitch results are reused from immutable AN-04B
records, not rerun or substituted. Those references still concern pitch only;
arithmetic agreement cannot replace two compatible MIR providers or musical
annotation for source identity, phrase labels or note timing.

## Recorded replay and unresolved limitations

The [recorded replay](../fixtures/an04c-recorded-01.json) verifies the same three
cached original-rate channel-0 PCM excerpts (10–12 seconds, 44100 Hz) against
AN-04B identity/output. Audio was not decoded again and MIR libraries were not
rerun. There are 288 complete frames: Goa and No Good have no primary pitch,
Scienide has the original 40 proposals / 38 both-vote-qualified frames.

None of the 288 frames meets the new stationary harmonic/stability criterion.
This does NOT retract the prior pitch proposals and does NOT classify the music
as lacking melody or as polyphonic. It records a restrictive-model limitation:
envelope/phase changes, imperfect pitch and mixed content can all cause residual.
Recorded source/pitch accuracy is null. The layer is additional diagnostic
evidence, not an enabled production whitelist. No threshold was lowered after
seeing these recordings. Next work needs nonstationary models and independently
annotated multitracks, including pitch/frequency estimation restricted to the
prefix/past for a genuinely blind temporal prediction experiment.

## Reproduction, programs and retention

Run from `plexus-engine/`, with new result paths (exclusive outputs):

```powershell
node --test tests/harmonic-evidence.test.mjs tests/harmonic-evidence-evaluation.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node research/analyzer-lab/diagnostics/measure-an04c.mjs --split development --output research/analyzer-lab/.cache/an04c-development-new.json
node research/analyzer-lab/diagnostics/measure-an04c.mjs --split transfer --frozen-reference research/analyzer-lab/.cache/an04c-development-new.json --output research/analyzer-lab/.cache/an04c-transfer-new.json
node research/analyzer-lab/diagnostics/measure-an04c.mjs --split recorded --output research/analyzer-lab/.cache/an04c-recorded-new.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an04c-inventory.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an04c-full-validation.json
```

Recorded replay requires retained `.cache/an04b-recorded-01/manifest.json` and
its f32 files. If absent, regenerate that original cache with the preserved
AN-04B `prepare_an04b_recorded.py` and authorized original MP3 directory before
replay; outputs must reproduce the retained PCM hashes. Mathematics check code
is `diagnostics/check_an04c_projection.py`: explicit PCM/support/frequency inputs,
actual NumPy/SciPy solves, exclusive JSON result. No fake providers or installs.

Three measurement artifacts retain 36 exact source snapshots. Inventory v0014
adds 44 protected files: 1279 total, all 1235 predecessors unchanged, zero
replacement/deletion. Active files: 153 Node, 28 Python. Three extra historical
test-source snapshots bring historical unexecuted copies to 61, not coverage.
Targeted checks: all 10 new Node tests passed; TypeScript check passed.

## Cumulative validation

Run ID `20261014T195250-aac02573fd5d` has an
[immutable full result](../tools/harness/history/20261014T195250-aac02573fd5d.json)
with exact commands, executable paths, logs, file coverage and source/outcome hashes.

- `npm run build`: TypeScript + Vite passed; bundle-size warnings remain warnings.
- `npm test -- --test-reporter=<harness reporter URI>`: 1485 tests, 1476 passed,
  nine failed; 153/153 active Node files ran, zero skipped/cancelled/todo.
- Full lab `python -m pytest tests -q -p no:cacheprovider -o junit_family=xunit1`
  plus harness-owned `--basetemp`/`--junitxml`: 316 passed, 28/28 active files.
- All nine failures match retained baseline file/name/assertion signatures:
  clip-profile (4), geometry-LFO (1), preset-differentiation (2), projected-motion
  (2), all Wormhole. Unknown failures: zero. Overall status **failed**, exit 1;
  known failures never mask the suite exit code.
- v0014 inventory passed before and after execution; zero replacements/deletions
  of all 1235 predecessors. Sources did not change during the run. Scoped import,
  documentation-link and diff-whitespace checks passed.
- Source ZIP SHA256:
  `7c5321b277e7eea2e51a44d17cc397523fc5329390bd630d07033f519c4bc2de`.
- Full evidence SHA256:
  `daf1235a675b0b99e429a9602483449acec791332b15599a096473f4e759b3bc`.

Node v25.2.1 / npm 11.6.2 / Python 3.12.14. Existing NumPy/SciPy environment
reused; no dependency/runtime fallback, model training or product publication.
Render/browser/Quest smoke is inapplicable to this separate offline API; actual
headset timing is unvalidated. No PR/diff export requested; export skipped.

The recorded model pass took about 7–8 ms for each no-pitch excerpt and 370 ms
for Scienide's 40 fitted frames on this host; raw pitch extraction, arithmetic
subprocess and decoding are excluded. Actual memory peak and hardware/Quest
performance are not measured. Per-frame basis allocations remain an optimization
opportunity; the explicit work budget is not a real-time guarantee.
