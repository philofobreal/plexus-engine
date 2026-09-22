# Sub and bass response

Task 5, analysis algorithm version 4. Integration owner: audio/DSP and rendering engineer.
The MVP reacts separately to sub (20-60 Hz) and bass (60-180 Hz), retaining both sustained
body and positive spectral change. These are project band conventions matching the existing
default analyzer bands, not instrument recognition or isolated kick/bass stems.

## Offline extraction

`LowFrequencyExtractor` consumes the same mono samples as the existing analyzer. It adds an
independent long-window pass without changing tempo, beat events, sections, the adaptive
classification bands or the 24-band display spectrum. The previous display spectrum uses
independent per-band normalization and a short FFT, so its low bars are not a reliable measure
of relative sub/bass strength. Existing raw low flux remains owned by the tempo/percussion path.

- Hann FFT size is the next power of two at or above 120 ms of samples: 120-240 ms windows,
  evaluated every 40 ms (25 Hz), independent of total duration and playback frame rate.
- Windows are centered at their timestamp, zero-padded at file boundaries, and DC-removed.
  Non-finite samples are treated as zero; extreme values are safety-limited to +/-8.
  Supported clocks are 1-384 kHz with a positive integer output hop. Empty/sub-hop input
  produces no output frames. The same samples always produce the same arrays.
- Frequency-bin overlap weights split power at 20/60/180 Hz. Sum of squared magnitudes,
  corrected for FFT length/Hann power, yields band RMS. The bands are fixed rather than
  moving with adaptive spectral calibration; behavior therefore remains interpretable.
- Flux is the RMS of positive per-bin magnitude differences, allowing pitch/timbre changes
  at similar total energy to respond too. A 0.5% bin-relative tolerance and normalized 0.005
  deadband suppress stationary-window ripple. Flux is not asserted to be percussive evidence.
- Both bands share one track reference: the maximum of 0.005 RMS, active-window low-band
  combined RMS P95, and one quarter of active-window broadband RMS P95. An absolute 0.0001
  RMS floor (-80 dBFS) prevents silence/very quiet leakage normalizing to full strength.
  Active-window percentiles ignore silence. The shared reference preserves band balance and
  relative level changes; broadband support prevents a high-only track amplifying low leakage.
- Body attack/release constants are 30/100 ms. Flux has immediate attack and 60 ms release.
  Values below 0.0001 are zeroed, all outputs are bounded to [0,1], and offline interpolation
  aligns them to the existing `i * hopSize / sampleRate` frame clock.

The longer window trades transient timing precision for low-frequency resolution. Changes
may spread over roughly half a window plus smoothing; sharp beat timing still belongs to the
existing percussive path. Boundary tones blend between adjacent bands rather than making a
hard classification claim. No pitch tracker, source separation or stereo downmix was added;
the existing first-channel analysis policy remains a limitation for asymmetric stereo mixes.

Technical basis: AudioLabs' [STFT reference](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C2/C2_STFT-Basic.html)
describes window/hop timing and frequency-bin interpretation; its
[spectral novelty reference](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S1_NoveltySpectral.html)
describes positive spectral differences. The band choices, RMS reference, tolerance, smoothing
and visual weights above are project design decisions validated with deterministic fixtures.

## Publication and visual ownership

Current worker frames always contain `subEnergy`, `bassEnergy`, `subFlux`, `bassFlux`.
`AudioFrame` permits absent legacy fields; `normalizeAudioFrame` supplies zero, clamps malformed
values and leaves its source unchanged. Accepted worker publication, load/reset, renderer
frame copy and idle decay cover all four. No new worker request or independent timing grid exists.

`writeModulationBus` publishes the four signals and applies Audio sensitivity exactly once.
It adds modest bass-change support to kinetic tension and body support to macro momentum;
the existing director still owns its ordinary dramaturgy dampening. Rhythmic impulse remains
event-driven: a sustained note or spectral change cannot fabricate beat events or shockwaves.

Cosmic Wormhole consumes the modulation signals for low-frequency support and local grain
warp/trail character. Positive change can strengthen that local warp. Kick jitter still needs
the existing independent transient envelope. The current release-time grain policy remains:
new cohorts inherit the response, in-flight grains are not globally re-pumped, and the camera
and lens do not bounce with every bass frame. Existing artistic controls may restrain or hide
the effect. No new UI controls or expensive render passes were introduced.

All FFTs, percentiles and smoothing run during offline analysis. Runtime projection uses a
fixed number of scalar reads/arithmetic operations through the same frame clock for preview,
seek and export. The pure signal/motion projection is deterministic; this does not claim that
all unrelated stateful visual effects are pixel-identical after arbitrary navigation.

The analysis version increases from 3 to 4. Existing descriptor-based panel-save keys and
history byte-identity rules remain unchanged. No audio is persisted, and no saved artistic
settings are overwritten. Reload/reselect a track to obtain the new analysis.

Validation and manual handoff: [sequential development audit](../audits/sequential-development-plan.md#task-5-sub-and-bass-response).
