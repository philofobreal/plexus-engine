# AN-04B: raw pitch extraction, actual provider comparison, safe source abstention

Date: 2026-10-14, Europe/Budapest. Integration owner: Codex / root.
[Frozen protocol](AN-04B-EXPERIMENT.md), [API contract](../../../documents/features/analyzer-pitch-candidates.md).

## What changed

The analyzer has actual original-clock PCM periodicity extraction, a retained
integer-lag baseline and parabolic refinement. A pure semantic gate compares
original frequency votes on identical frame support. The adapter to AN-04A
preserves unresolved mixtures: no unproven source, singer or musical-motif IDs.
This is an upstream pitch stage, not a source separator or polyphonic transcription
model. Unlike AN-04A, this detector receives no authored F0 or note inputs.

## Authored results

Each split contains 20 conditions: 12 ordinary monophonic conditions and eight
controls. Missing-fundamental control is separately known monophonic input;
non-tonal and multi-source controls do not contribute to monophonic pitch accuracy.
Development and transfer use disjoint rates/frequencies/phase/gain tuples but
share a generator and stationary waveform families. They are not independent
recorded compositions or artist-level holdouts. No threshold was selected from
transfer; it requires identical source/protocol hashes from development.

The fixture's `sourceCount` is toy bookkeeping for authored eligible tonal parts,
not an annotation of all physical sound sources. Noise and below-floor zeros
must not become negative instrument/source labels. No source classifier trains
on that field; the detector and external providers never receive it.

| Authored monophonic frames | Proposed / eligible frames | Integer-lag mean absolute error | Refined mean absolute error | Within 25 cents |
| --- | --- | --- | --- | --- |
| Development | 130 / 130 | 5.9226 cents | 0.1274 cents | 130 / 130 |
| Frozen parameter transfer | 156 / 156 | 5.5494 cents | 0.1000 cents | 156 / 156 |

These compare two numerical estimates from the same period evidence, not
accuracy gains over a previous production instrument recognizer. Tiny errors
on stationary synthesized tones do not establish singing, vibrato, transient
note boundaries, source isolation or arbitrary polyphonic pitch accuracy.
Raw frequencies, authored truth, signed/absolute-error reconstruction and
integer/refined absolute errors are retained in the results.

Reconstructing signed refined error gives +0.1274 cents on development and
+0.1000 cents on transfer: the small positive bias is retained, not offset-fitted.

## Actual external references and negative exposure

Both providers actually executed afresh: librosa 0.11.0 YIN and audioFlux 0.1.9
PitchNCF with RECT window. Same mono f32le PCM, original rate, full unpadded
support, declared hop, frequency range and 25-cent agreement. Native frame
counts must match exactly; no trimming, timestamp correction or substitute
detector. The NCF API returns a frequency array directly; an exploratory smoke
printer initially assumed a tuple, before the measurement adapter was written.
No benchmark failure or parameter retuning resulted from that printer mistake.

The existing isolated audioFlux runtime and retained wheel lock were reused.
Reports include actual Python/Node versions, provider source SHA256, native DLL
SHA256, both raw frequency arrays, all paired/rejected frames, PCM identity and
the exact subprocess invocation. An absent or out-of-range vote gives no pair;
raw votes remain visible. Agreement is a pseudo-label, not a probability.

Development: 177 agreed pairs across 200 frames, 160 qualified Plexus proposals.
Transfer: 211 agreed pairs across 240 frames, 192 qualified proposals. These
aggregate counts include ambiguous multi-source controls, so they are not
monophonic accuracy or source-identification scores.

- Silence/DC: no own proposals. Below-floor PCM: the providers agree on all
  10 development / 12 transfer frames, but own RMS gate withholds every proposal.
- Deterministic noise: actual providers agree in some frames (7 in development),
  but own periodicity gate returns no pitch proposals or qualified frames.
  The shared guesses are retained as counterexamples to consensus-as-truth.
- Incommensurate, octave and unison two-source mixtures can produce strong
  shared periodicity hypotheses. This is not proof of either component F0,
  a single instrument, or two separated instruments. Source/motif counts from
  the safe adapter remain zero for every case, including positive monophony.

Thus provider agreement is necessary for an eligible external pitch comparison,
but insufficient for annotation truth, isolation or supervised source labels.
Onset consensus was not reused as pitch truth. No model was installed/trained.

## Actual recordings

All three authorized Prodigy MP3s were read afresh with SoundFile/libsndfile.
Two-second excerpts at 10–12 seconds, original 44100 Hz, channel 0: six seconds
total, 96 complete windows per clip. Original file hash, sample/channel metadata,
decoder versions, excerpt PCM hash and timeline offset are retained. There is
no resampling/normalization or persistent audio in source control. The original
directory was read with sandbox escalation; source audio was unchanged.

| Recording excerpt | Own proposals | External agreed pairs | Qualified against both votes |
| --- | --- | --- | --- |
| Goa / The Heat / The Energy Part 2 | 0 | 15 | 0 |
| No Good / Bad For You Mix | 0 | 16 | 0 |
| Scienide | 40 | 76 | 38 |
| Total, 288 windows | 40 | 107 | 38 |

The two zero-proposal excerpts remain explicit missing coverage. Do not lower
thresholds after inspecting unannotated music just to match provider guesses.
No recorded pitch accuracy, source identities or note-boundary accuracy is
claimed. Each two-second DSP call took approximately 197–249 ms on this host;
provider calls, decoding and actual memory peak are excluded. No browser/Quest
hardware guarantee follows.

## Programs, commands and retention

- [Development measurement](../fixtures/an04b-development-01.json),
  [frozen transfer](../fixtures/an04b-transfer-frozen.json),
  [recorded measurement](../fixtures/an04b-recorded-01.json).
- `diagnostics/measure-an04b.mjs`: authors/replays PCM, runs own DSP and the actual
  native Python subprocess, validates identity/support, records all results and
  source snapshots. No supplied labels enter extraction or provider inference.
- `diagnostics/compare_an04b_pitch.py`: reads explicit hash-bound f32le requests,
  calls both actual libraries, records native/source identities; no installation.
- `diagnostics/prepare_an04b_recorded.py`: creates fresh original-clock channel-0
  excerpt artifacts in ignored local cache; exclusive manifest destination.
- `adapters/pitch_pair.py`: actual library methods and fixed frequency pairing.
  Its pure pair helper has two new Python regression tests.

From `plexus-engine/`, use NEW result names (existing artifacts are never overwritten):

```powershell
node --test tests/pitch-candidates.test.mjs tests/pitch-evidence.test.mjs tests/pitch-reference-evaluation.test.mjs
node node_modules/typescript/bin/tsc --noEmit
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_pitch_pair.py -q
node research/analyzer-lab/diagnostics/measure-an04b.mjs --split development --output research/analyzer-lab/.cache/an04b-development-new.json
node research/analyzer-lab/diagnostics/measure-an04b.mjs --split transfer --frozen-reference research/analyzer-lab/.cache/an04b-development-new.json --output research/analyzer-lab/.cache/an04b-transfer-new.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare_an04b_recorded.py --audio-root 'C:\novy\Plexus Engine (VJ System)\plexus-engine\tests\audio\prodigy' --output research/analyzer-lab/.cache/an04b-recorded-new/manifest.json
node research/analyzer-lab/diagnostics/measure-an04b.mjs --split recorded --manifest research/analyzer-lab/.cache/an04b-recorded-new/manifest.json --output research/analyzer-lab/.cache/an04b-recorded-new.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an04b-inventory.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an04b-full-validation.json
```

Three measurements retain 51 exact source snapshots. Original 1172 protected
files remain unchanged; v0013 adds 63 files (1235 total), zero replacements or
deletions. Active coverage is 151 Node files and 28 Python files. Six additional
historical test-source snapshots make 58 historical unexecuted copies; they do
not count as executed tests. Targeted checks pass all 10 new Node tests, both
new Python tests and TypeScript checking.

## Cumulative validation

Run ID `20261014T190546-68e879b92184` has an
[immutable retained result](../tools/harness/history/20261014T190546-68e879b92184.json)
with exact commands, executable paths, full source identities, logs and hashes.

- `npm run build`: passed (TypeScript + Vite); existing bundle-size warnings
  remain warnings, not failures.
- `npm test -- --test-reporter=<harness reporter URI>`: 1475 tests, 1466 passed,
  9 failed; 151/151 active files executed; zero skipped/cancelled/todo.
- Full lab: `python -m pytest tests -q -p no:cacheprovider -o junit_family=xunit1`
  with harness-owned `--basetemp` and `--junitxml`: 316 passed, 28/28 files.
- All nine failures match the retained baseline's file/name/assertion signatures:
  Wormhole clip-profile (4), geometry-LFO (1), preset-differentiation (2),
  projected-motion (2). Unknown failures: 0. Overall harness status **failed**,
  exit code 1: known failures do not mask the failing test suite.
- v0013 inventory passes before and after execution. Original 1172 protected
  files remain unchanged; zero replacements/deletions. Sources did not change
  during execution. Import boundaries, documentation links and diff whitespace pass.
- v0013 source ZIP SHA256:
  `75b55a62db59e2493d4e4d8ac5fa283cad2377e0f235d1036f941da9d97faafe`.
- Full evidence SHA256:
  `8041952348b1dbe02b4ec11a4839c7d0de4ea67a1796a1e4e9e6b94a25d997ac`.

Node v25.2.1, npm 11.6.2, Python 3.12.14; no runtime/dependency fallback required.
Core lab dependencies: NumPy 2.2.6, SciPy 1.15.3 and SoundFile 0.13.1.
Browser/render/headset smoke is inapplicable to this separate offline API;
physical XR timing is unvalidated. Diff export skipped: no PR/export requested.

## Next evidence task

Measure harmonic/residual evidence and temporal stability on annotated mixtures
to distinguish single-source-compatible pitch from ambiguous combined periodicity.
Expand uncertain pitch and note-boundary handling before adapting any candidate
as an isolated part. Actual separation and independently labeled source instances
remain separate requirements; preserve this baseline and its consensus/noise
counterexamples instead of optimizing solely for library agreement counts.
