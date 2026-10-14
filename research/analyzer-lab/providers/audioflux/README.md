# Optional audioFlux onset measurement

Actual audioFlux 0.1.9 native STFT/Onset is called by
`src/plexus_analyzer_lab/adapters/audioflux_onsets.py` and the AN-03F diagnostics.
It is an explicit local onset helper, not a registered full canonical CLI oracle.
Missing native runtime is an error; there is no substitute detector or stub.
It adds no production/npm dependency or trained model.

The runtime is isolated in ignored `.cache/audioflux-runtime-locked-01`.
[The retained wheel lock](../../fixtures/audioflux-runtime-lock-01.json) records
all ten wheel filenames, versions and SHA256 values. Verify downloaded wheels
against it when reproducing this run. NumPy, SciPy, librosa, soundfile and
mir_eval continue to come from the existing pinned lab environment.

Explicit package downloads were needed because no second MIR onset library was
installed. The first sandbox download failed DNS; the authorized retry obtained
the official PyPI wheels. `pip install --target` then failed with Windows
temporary-directory access error 5. The retained `prepare-audioflux.py` extracts
explicit supplied wheels to a new isolated directory, checks archive paths,
rejects duplicate distributions and refuses shadowing pinned core libraries.
This is a documented provisioning fallback, not a runner or detector fallback.

From the repository root, using fresh paths for target and lock:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pip download audioflux==0.1.9 matplotlib==3.10.7 contourpy==1.4.0 cycler==0.12.1 fonttools==4.66.1 kiwisolver==1.5.1 pillow==12.3.0 pyparsing==3.3.3 python-dateutil==2.9.0.post0 six==1.17.0 --no-deps --only-binary=:all: --dest NEW_WHEEL_DIR --index-url https://pypi.org/simple
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/prepare-audioflux.py --wheel-dir NEW_WHEEL_DIR --target NEW_RUNTIME --output NEW_RUNTIME_LOCK_JSON
```

Matplotlib is required by audioFlux's import even for this non-plotting helper.
The helper sets a runtime-local matplotlib config directory and Agg backend,
checks the actual package belongs to the supplied runtime, and requires version
0.1.9. These Windows/Python 3.12 wheels are the measured configuration; other
platforms require separate binary and compatibility validation.

Measurement uses HANN/2048 FFT/512 hop, centered zero padding, linear magnitude
FLUX, filter order 1 and explicit NoveltyParam `[1,1,1,0,1,0,1,1]`. Timestamps are
native sample indices divided by the original sample rate, with zero correction.
See [validation](../../docs/AN-03F-VALIDATION.md),
[audioFlux Onset](https://audioflux.top/mir/onset.html) and
[STFT](https://audioflux.top/transforms/stft.html).
