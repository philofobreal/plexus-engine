# Local percussive tempo estimation

Task 4 of the [sequential development plan](../audits/sequential-development-plan.md),
2026-09-22. Owner: analyzer; integration and verification: the implementing audio/DSP
engineer. Analysis algorithm version is **3**. The worker payload schema is unchanged.

## Behavior and ownership

The displayed BPM comes from recurring positive spectral-flux patterns in fixed **12-second
windows**, advanced by **6 seconds** (rounded to analysis frames). Window size never scales
with song duration. A shorter recording uses one available-data window. A final partial
window is included once. There is still one estimated track tempo, not a variable tempo map.

`FeatureExtractor` continues to supply raw positive low/mid/high spectral flux. `GridAligner`
normalizes each band by its local 98th percentile, combines them with the existing
1 / 0.7 / 0.4 weights, and crossfades overlapping normalization windows. This prevents a
loud section from setting the band balance for the entire track. Existing visual percussive
and sustained-bass features are untouched; sub/bass enhancements belong to task 5.

`TempoEstimator` owns local mean removal, normalized autocorrelation and the four-lag comb
score. Defaults remain 70–185 BPM, one-BPM bins, five alternatives and the 120-BPM perceptual
prior. Each window needs at least four distinct attacks (120 ms minimum separation).
The fourth-largest attack sets a four-times amplitude ceiling, preserving recurring accents
while limiting isolated outliers. Silent, constant and insufficient-evidence windows do not
vote. Tempogram contrast and correlation strength determine each window's bounded weight;
absolute loudness does not. Agreement between local tempo candidates reduces confidence
when different sections support conflicting tempos. Confidence is evidence, not probability.

`GridAligner` reuses accepted windows to resolve metric ambiguity. It evaluates phase
concentration and beat coverage in local active spans, splitting onset-free gaps over three
seconds. Leading/trailing silence is excluded from coverage. Poorly populated grids receive
an additional penalty below 60% coverage; a fast-tempo preference still requires at least
80% coverage. Thus a true fast pulse can beat its half-time alternative, while a double-rate
grid with alternate empty beats is penalized. Public candidate zero always matches BPM.

The existing DP beat tracker, bar alignment and unified confidence remain the only timing
authority. Beat events still require the existing percussive gate: extrapolated silent beats
do not imply visual flashes. UI, renderer, playback and persistence contain no new DSP.

## Cost and limits

Autocorrelation scratch space is bounded by one window and its lag range. Windows are
processed incrementally; no full tempogram matrix is retained. Work is linear in input length
for fixed analysis rate, BPM range and harmonic count. Local metric spans store at most the
overlapping onset lists and use binary search for beat coverage. The full envelope and its
normalization weights remain linear-size offline buffers. No new per-frame work or dependency.

Silence, fewer than four attacks and invalid estimator clocks/options fail closed to no
candidates; the established application fallback is low-confidence 120 BPM. Non-finite or
negative envelope samples are sanitized without modifying input. Sustained audio, noisy
material, syncopation, tempo changes and musically ambiguous half-time can still be uncertain.
The existing kick-transient confidence cap is not a universal confidence model for bass-light
music. This task does not claim stem separation or perfect tempo recognition on real tracks.

The existing saved-track key includes rounded analysis descriptors (BPM, section positions,
bar count and duration). A legitimately changed analysis can therefore change that key:
older panel saves may not be automatically associated, and history restore correctly refuses
a mismatching analysis fingerprint. Old records are not deleted or migrated in this task.
Audio bytes are still never stored. Re-selecting a track runs the updated analysis.

## Evidence and acceptance

`tests/analyzer-local-tempo.test.mjs` adds ground-truth cases for competing section loudness,
70–185 BPM, long silence/phase changes, sparse attacks, extreme outliers, mixed tempos,
invalid input, deterministic immutable input across analysis rates, half/double resolution,
noise/constant envelopes and the final partial window. Raw-audio integration covers house,
strict drum and bass and slow four-on-floor with quiet passages and long gaps.

The existing golden, musical-verification, baseline/schema, confidence, beat-event and
worker/headless-parity suites remain independent checks. Golden fixtures are deliberately
shorter than one full window; unchanged outputs protect the local algorithm's established
behavior, while the new longer fixtures exercise pooling. No snapshot was regenerated.
Exact validation results and manual acceptance steps are in the sequential audit.

## Technical references

Short-time autocorrelation measures repeating onset patterns at fixed local lags, with
overlap normalization. See [AudioLabs FMP: Autocorrelation Tempogram](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S2_TempogramAutocorrelation.html).
The pre-existing prior/DP architecture follows [Ellis: Beat Tracking by Dynamic Programming](https://www.ee.columbia.edu/~dpwe/pubs/Ellis06-beattrack.pdf).
The 12/6-second windows, robust cap, consensus weighting and metric safeguards above are
project engineering choices validated by our fixtures, not thresholds prescribed by those references.
