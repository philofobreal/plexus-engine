# T17 scalar FFT feasibility (research only)

Owner: analyzer research/build/docs, one integration owner. No production imports,
backend preference, worker schema, musical algorithm or player defaults change.
User clarification: WASM acceleration is the goal; Rust/ts-rs only if justified.
Neither is needed for this bounded numeric ABI.

## Protocol fixed before measurements, 2026-10-28

Candidate: the existing radix-2 FFT transform, unchanged arithmetic and operation
order. Reference: `src/analyzer/math/FFT.ts` at source HEAD recorded in the receipt.
All intermediate arithmetic is f64, with f32 rounding at exactly the original
array stores. Original JS Hann/twiddle construction, windowing and magnitude stay
in JS. Scalar WASM only; no SIMD, threads, FMA or fast-math assumption.

Promotion gate, not a timing assertion in CI: exact finite-input FFT bytes and
complete analyzer output hashes; at least **15% median full-analysis improvement
on each of the three complete Prodigy recordings**, with three paired measured
runs after one warmup per backend; cold compile/instantiate overhead below 50 ms;
observed process maxRSS increase below 10% (fresh processes for memory comparison).
XR uses `rhythmOnsets: true`; evaluate that complete path. Initialization and bulk
copies inside each analysis are included. A fast isolated kernel alone cannot
pass. Physical Quest 3 measurements are additionally required before T18 readiness.
Missing device evidence leaves that gate open, never inferred from desktop results.
The smaller default (non-XR) path can be reported separately without replacing
the preregistered primary path. No musical accuracy claim follows from equality.

Native ESM transpilation uses the installed TypeScript compiler on both trees,
without VM contexts or mathematics rewrites. Only the candidate FFT binding is
substituted. CPU sampling on the reference identifies other costs; source paths
and function names are retained. Capture source/input hashes, compiler/runtime,
ordered raw times, cold costs, bytes/gzip size, memory and output hashes. Decode,
result hashing and compilation of TS research bundles are outside timed analysis.
Download cost is bytes only unless actually measured over a specified network.
Memory high-water observations include the process, are not exact live-object
attribution. Run jobs serially so another benchmark does not compete for CPU.

## ABI and ownership

One private, fixed `WebAssembly.Memory` per FFT instance. Little-endian f32 arrays:
real at byte 0, imaginary at `4*N`, cosine at `8*N`, sine at `10*N`, total `12*N`.
N is a power of two in [2, 65536]; memory is page-rounded, initial=maximum, no growth.
An entry guard checks N and actual capacity before writing. No pointers escape to
production or across workers. The owner keeps its memory views for the instance
lifetime; the module is shareable immutable compiled code. Resident mode uses
borrowed WASM views for re/im, bulk-copies immutable twiddles at construction and
keeps existing JS window/magnitude operations. Copy mode retains JS arrays and
copies re/im in and out on every transform, explicitly measuring that alternative.
The reference constructor's temporary arrays are included in measured startup.
No imported per-sample functions, track JSON, unbounded growth or shared memory.

## Reproduction

Node/npm are the available project runners. The isolated **development assembler**
does not change root dependencies or locks. WABT 1.0.39, npm integrity
`sha512-ba+dRL/75VQQY7RkU/CgriGbkoWAfS8TDyUlJfJhJ8KhtXgMl5dhNvoPNUcQ9IWRhW8u41glMSuZeTvsYq2rRg==`.
API: [official WABT JS documentation](https://github.com/AssemblyScript/wabt.js#api).

```powershell
npm install --prefix research/analyzer-lab/.cache/t17-toolchain --no-save --ignore-scripts --no-package-lock --no-audit --no-fund wabt@1.0.39
node research/analyzer-lab/candidates/wasm-fft/experiment.mjs build
node --test tests/wasm-fft-prototype.test.mjs
node research/analyzer-lab/candidates/wasm-fft/experiment.mjs kernel logs/t17/kernel.json
node research/analyzer-lab/candidates/wasm-fft/experiment.mjs recording AUDIO_MP3 NEW_OUTPUT_JSON
```

`ffmpeg` decodes the first channel to 44.1 kHz f32le, matching existing research;
both backends receive identical bytes. Outputs are exclusive new files. Compiled
temporary trees and PCM stay in the ignored lab cache. The small checked-in WASM
is a reproducible research fixture, never a deployed runtime backend. `build`
verifies/recreates it from the WAT with the pinned assembler. Tests need no WABT.

Results and continuation decision will be recorded after measurements below.

## Results, 2026-10-29

The protocol above was frozen before measurement; its original complete-file SHA
is `6300114ad0b74d1fc4cfcf7feb210dcc537a9b7af6e672ebc7a6ed76f35df7bf`.
This results section was appended afterward. Raw ordered observations, PCM/source/
output identities and CPU summaries are retained in [results.json](results.json).
All three recordings were complete, not excerpts; first-channel 44.1 kHz decode.

| Recording | Duration | TS median | Resident WASM median | Improvement | Process maxRSS ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| Goa | 365.77 s | 6.448 s | 3.806 s | 41.0% | 0.967 |
| No Good | 410.59 s | 6.080 s | 4.215 s | 30.7% | 1.080 |
| Scienide | 350.46 s | 5.556 s | 3.634 s | 34.6% | 1.008 |

All 18 measured analyzer outputs have identical hashes within each recording;
PCM remains unchanged. These are equalities to TS, not independent beat/section
annotations or proof of better musical accuracy. One secondary Chrome 156 desktop
No Good run gave 7.902 -> 6.113 s (22.6%) with exact output agreement. Browser heap
was only an endpoint observation, not a measured process-memory peak.

Reference CPU samples put approximately 66-70% in FFT, 13-15% in feature extraction,
6-7% in long-window LF work outside FFT, 5-6% in activity, and 1-2% in tempo/grid.
Orchestration/output-object work was about 2%; GC self samples below 1%. Sampling
is diagnostic attribution, not additive nested wall timers or allocation profiling.
The normal XR percussive pool was enabled; experimental raw-onset passes were not.
No second kernel is justified before measuring the first on the target device.

WASM is 537 bytes, 357 gzip. First observed compile + instantiate + 1024-point
constructor: 0.668 ms; subsequent same-process compile calls may use engine cache.
WAN download latency was not measured. Windowing + transform warm medians (ms):

| N | TS | Resident | Copy in/out |
| --- | ---: | ---: | ---: |
| 1024 | 0.02771 | 0.01805 | 0.01760 |
| 4096 | 0.12349 | 0.07865 | 0.13655 |
| 16384 | 0.84915 | 0.65926 | 0.73374 |

Copying can erase the benefit; kernel-only results do not replace the full-path
gate. Both native trees ran in the same V8 realm, and initialization/table copies
inside analysis were timed. Decode, result hashing and ESM file imports were
outside analysis; cold import observations are separately retained in every run.
TS reference mathematics and all 404 production build inputs remain unchanged.

**Desktop gate passed; production promotion withheld.** Physical Quest 3 complete
analysis/cold/memory observations are absent. Preliminary development receipts
also showed a Goa maxRSS ratio of 1.110 before the final frozen serial rerun;
those receipts remain in ignored logs and are not overwritten. Host memory/time
variation requires caution. SIMD/threads and transfer-to-worker cost were not
measured: neither capability nor a new transfer path exists in this prototype.
T18 stays deferred; T19 is the next independent task after manual acceptance.
This release adds no player switch and improves neither gameplay FPS nor musical
decisions yet. The potential gain concerns offline analysis only.

Ten canonical Node cases cover N=2..65536, partial windows, silence, subnormals,
signed zero, complex input, PCM +/-8 headroom, exact FFT stores, private fixed
memory/entry guards, and complete normal/XR publication equality in both modes.
WABT rebuild reproduces the checked-in binary SHA exactly. Further cumulative
validation and deployment receipts are recorded in the project tracker.

Secondary browser reproduction (a static server avoids Vite transforming research
dynamic imports; bind loopback only):

```powershell
node research/analyzer-lab/candidates/wasm-fft/experiment.mjs browser AUDIO_MP3 logs/t17/browser-new.html
research/analyzer-lab/.venv/Scripts/python.exe -m http.server 5183 --bind 127.0.0.1 --directory ..
# Open http://127.0.0.1:5183/plexus-engine/logs/t17/browser-new.html
# Click Run full recording; retain the resulting JSON, then stop the server.
```
