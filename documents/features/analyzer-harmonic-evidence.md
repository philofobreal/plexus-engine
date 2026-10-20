# Harmonic residual and observed periodicity continuity — AN-04C

Status: separate offline research API. Owner: pure analyzer/types; integration
owner Codex / root. Existing AN-04B pitch extraction and actual reference records
remain unchanged. No worker, state, render or gameplay schema changed.

`fitHarmonicResidual(samples, sampleRate, frequencyHz)` fits a stationary constant
plus up to eight sine/cosine harmonic pairs. Harmonics must lie strictly below
0.4*sampleRate. On the first floor(2*N/3) samples, two-pass modified Gram–Schmidt
QR handles the nonorthogonal finite-window columns. The learned linear
coefficients predict the remaining suffix. Independent-column coefficients
are retained as a deliberate mathematical comparison baseline.

Residual fractions are squared prediction errors divided by signal energy around
the prefix mean. The same mean is used on the suffix. Training and suffix scores
remain separate; near-floor denominators and rank loss give unavailable results.
Suffix error may exceed one and is not clipped. Scores are not probabilities or
instrument-count estimates. Input Float32 PCM remains unchanged; workspaces are
bounded (max 16384 samples per model, 17 basis columns).

**Coefficient holdout, not an independent pitch holdout:** this function does not
estimate frequency. In `assessHarmonicEvidence`, frequency is the existing
AN-04B hypothesis estimated from the entire frame, including the suffix. Only
the amplitude/DC coefficients are withheld from suffix data. Accordingly the
suffix metric measures conditional model compatibility and is not an independent
temporal forecast or validation of F0. Truly blind future prediction would need
frequency estimation restricted to the prefix/past, with separate measurement.

`assessHarmonicEvidence(samples, pitchAnalysis)` preserves original frame support
and raw pitch. `steady-harmonic-compatible` requires prefix and suffix residual
fractions <=0.1 plus three consecutive adjacent pitch frames changing <=25 cents.
Early insufficient history also has status `unstable`; this does not assert
musically unstable sound. Missing primary pitch resets the run. Continuity is
observed, not predicted. The decision support includes the prior two frames;
`fitSupportStartSample` separately identifies the current model's PCM support.
Neither these windows nor a 20 ms hop establish note-onset timing.

`large-residual` means this stationary model fails to explain the signal. It can
reflect another component, noise, envelope change, vibrato, inaccurate F0 or a
note transition. A single authored source can produce it. Conversely, unison
and octave two-source mixtures can pass the harmonic model: small residual does
not prove source isolation. No source IDs, singer IDs or musical-motif identities
are created. `confidence=null`, `groundTruthStatus=false`,
`sourceIsolation='unverified-mixture'`, diagnostic-only and XR scoring ineligible.

The implementation checks original PCM/clock/frame geometry and declares a
350-million basis-work estimate budget. Overflow fails explicitly. Rank refusal
uses a relative Gram–Schmidt column-norm threshold 1e-10; it is a conservative
local check, not identical to a global singular-value cutoff on arbitrary
ill-conditioned matrices. Arithmetic comparison with NumPy/SciPy covers only
the sampled well-defined models, not every possible conditioning regime.

The three recorded excerpts produce zero steady-harmonic-compatible frames.
Their previous raw pitch proposals and reference qualification remain available;
the new evidence is additive, not a production exclusion/promotion gate. The
stationary model is too restrictive to establish compatibility on these examples.
There are no independent source labels to assign a recorded precision/recall.

Measured results and exact reproduction: [AN-04C validation](../../research/analyzer-lab/docs/AN-04C-VALIDATION.md).
