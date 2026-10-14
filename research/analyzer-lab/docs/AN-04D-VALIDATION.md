# AN-04D validation

This stage fixes future-suffix frequency leakage by fitting from a separate hashed prefix, and adds a fixed linear-envelope harmonic hypothesis alongside the stationary hypothesis. It does not select/promote models or claim instrument recognition, musical truth or XR scoring readiness. See [feature/API](../../../documents/features/analyzer-harmonic-forecast.md) and [frozen protocol](AN-04D-EXPERIMENT.md).

Reproducible measurement commands, run from plexus-engine with Node25.2.1 / Python3.12.14:

```powershell
node research/analyzer-lab/diagnostics/measure-an04d.mjs --split development --output research/analyzer-lab/fixtures/an04d-development-02.json
node research/analyzer-lab/diagnostics/measure-an04d.mjs --split transfer --frozen-reference research/analyzer-lab/fixtures/an04d-development-02.json --output research/analyzer-lab/fixtures/an04d-transfer-frozen-02.json
node research/analyzer-lab/diagnostics/measure-an04d.mjs --split recorded --output research/analyzer-lab/fixtures/an04d-recorded-01.json
```

Outputs are exclusive: reproduction uses NEW paths, with transfer referencing that new development result. Each result retains its own source copies, raw arithmetic and pitch provider results plus source/native hashes. Runtime dependencies were reused locally, not installed or upgraded. The script regenerates synthetic PCM and hash-checks the retained original-clock AN-04B recordings; recorded files were not decoded again in this stage. Their2s channel0 excerpts cover10-12s of each authorized song, not whole-track accuracy.

The initial350-million-work ceiling refused recorded input before model inference. Initial development01 and transfer results plus their source copies and the recorded rejection record are preserved. The runner was refrozen02 with a500-million ceiling; model/tolerance/geometry stayed unchanged. A regression checks exact equality of all old/new synthetic forecast outputs, not just summary scores. No initial result was overwritten.

## Measurements

Final02 development:31 cases,305 forecast windows,262 with models. Frozen transfer:31 cases,398 windows,339 with models. Recorded:3 cases,282 windows,38 with models. Whole-clip AN-04B PCM identities are preserved. New windows require N+N/2 support; their count and support differ from AN-04B/AN-04C. Neighboring windows overlap: these are correlated measurements, not independent validation samples.

Frozen transfer mean future-suffix residual/energy, over18 supported windows per new control unless stated:

| Authored condition | Stationary | Linear coefficients |
|---|---:|---:|
| Steady |0.00003847|0.0000000004674|
| Linear rise |0.03187349|0.0000013661|
| Linear fall |0.05022303|0.0000019785|
| Quadratic envelope |0.04251084|0.00114758|
| Gain step (17 supported) |0.11888798|0.13593967|
| Vibrato |1.91258677|1.76166470|
| Chirp |1.94125121|1.63605977|
| Two octave sources |0.00007125|0.0000000015015|
| Two unison sources |0.00003455|0.0000000003254|
| Two incommensurate sources |1.43490853|5.15185142|
| Silence |null| null|

The smooth rise improves from3.187349% to0.00013661% residual energy, and fall from5.022303% to0.00019785%. These are synthetic predictive model errors, not pitch accuracy, musical/source recognition rates or global analyzer performance. Independent linear quadrature coefficients can absorb small F0 errors even on a steady tone; the exported pitch estimate itself is unchanged. The more flexible model gets worse on the transfer gain step and incommensurate mixture. Two sources still predict well in octave/unison cases, whereas one modulated source can predict badly. No residual threshold or best-model rule promotes any of these results.

Actual numerical check:104 development model fits,104 transfer fits and4 recorded fits, all NumPy/SciPy agreements. Largest Plexus/provider absolute score difference is2.043e-14. These208+4 numerical comparisons cover deterministic first/last *available* model frames, not every model window. Providers use the same prefix F0 as a model parameter; this checks linear-system arithmetic, not whether that F0 is musically true. Provider packages may share numerical backends and are not independent human references.

Actual isolated-prefix MIR check:62 sampled prefixes per synthetic split;55 paired votes and52 own-qualified prefixes in each. Recorded:6 sampled prefixes,2 paired/own-qualified. Samples are first/last *complete* forecast windows of every case, including silence/no-pitch. Both original votes and disagreement remain in the result. No reference accuracy is attributed to the unmeasured prefixes, nor to source/voice/motif identity. The pair accepts only<=25-cent agreement; own qualification checks both original frequencies, never their average alone.

In each synthetic split the three paired but own-withheld prefixes are the two below-floor samples and one noise sample. Actual libraries agree on periodicity proposals there, but the own floor/trough policy abstains. These inappropriate shared guesses remain visible rather than being treated as evidence of an audible musical part. Library agreement alone is insufficient for musical truth.

Recordings (10-12s excerpts, Fs44100/channel0): each has94 complete windows. Goa and No Good have no own prefix pitch/model; Scienide has38 model windows. Its mean future residual is1.19132611 stationary versus1.46656072 linear, so this model extension does not improve that excerpt. Recorded accuracy is null: no task-compatible human musical/source truth exists. Own model runtimes excluding native reference calls were~347ms,~295ms and~5087ms, respectively; one local run, not a performance guarantee. Allocation/peak memory, whole tracks, browser/UI and physical XR devices were not measured. No production promotion.

## Targeted checks

```powershell
node --test tests/harmonic-forecast.test.mjs tests/harmonic-forecast-limits.test.mjs tests/harmonic-forecast-evaluation.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

All12 new Node tests pass. They verify suffix changes cannot update fit/F0, improvement for linear ramps, gain/DC tolerance, null energy, pure deterministic repeated fitting, malformed/nonfinite inputs, retained one-source and multiple-source counterexamples, exact source snapshots, actual sampled vote qualification, first/last synthetic replay, and exact initial/refrozen output equality. TypeScript check passed. The local TypeScript entrypoint is a supplemental check, not a substitute for the standard package build. No dependency/runtime fallback was needed.

New AN-04D files and copied sources have scoped `.gitattributes` byte-preservation rules, because this Windows checkout has `core.autocrlf=true`. All87 newly staged protected files match inventory15 hashes, and both new DSP/type sources match working bytes. Snapshot whitespace rules recognize original CRLF line endings while still checking trailing blanks; originals are not normalized. This does not rewrite older stages or claim cross-platform runtime validation of the Windows native reference environment.

## Complete cumulative run

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --report research/analyzer-lab/.cache/an04d-inventory.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/an04d-full-validation.json
git diff --check
```

Inventory15 protects1366 files; all1279 predecessor file hashes are unchanged, with no replacements/migrations. It discovers156 active Node files,28 active Python files and66 retained historical test copies (historical copies are not executed as extra tests). Immutable source ZIP SHA256: `c19c0475611af30a7e4af68a87a907048d1d443b78a772f67bd34f18736f1a43`.

Immutable full evidence: [20261014T202618-dd4126a7e328.json](../tools/harness/history/20261014T202618-dd4126a7e328.json), evidence SHA256 `8b40cb88b9fc35ae72499b79d3b70cfda882d2210745b2ba92ee0e75b9ae9d2f` (canonical evidence convention recorded in the artifact).

- Standard package build passed (~5.75s).
- Standard npm test, via the harness structured reporter:1488/1497 passed, all156 active files executed, no skips/cancellations/todos (~273.44s).
- All316 Python tests passed, all28 active lab files executed (~63.61s).
- Unknown/new failures:0. Post-run inventory passed with0 issues; protected analyzer sources did not change during the run.

The whole run correctly retains FAILED/exit1 because the9 predecessor Wormhole failures remain unmasked: clip-profile4, geometry-LFO integration1, preset differentiation2, projected motion2. None concerns the new analyzer code. Full commands, individual failure signatures and file coverage are in the immutable evidence. The harness invokes declared npm build/test scripts using the installed Node/npm CLI, and lab pytest from its existing venv. No Bun, package-manager fallback, network fetch, training or dependency installation occurred.

Manual/static checks: reviewed prefix/suffix API separation, fixed model policy, analyzer/types ownership, clocks and nullability; checked all relative links and Git whitespace; verified current and copied source hashes plus exact staged new protected bytes. Browser smoke and physical XR were skipped because no UI/playback/renderer/gameplay or production-analysis integration changed. Native DLL execution is Windows-local; cross-platform and hardware performance acceptance remain unmeasured. `diff_export.ps1` was skipped as unnecessary for this local DSP/research change; no PR/push/deployment was created.
