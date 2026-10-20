# Event timing annotations and offline evaluation

The reusable [evaluator](../../research/analyzer-lab/diagnostics/evaluate-event-timing.mjs) compares baseline and candidate audible percussive event times against independently reviewed human annotations. It does not generate targets, change analysis, run libraries, decode audio or promote an algorithm. Its method follows [analyzer development method v1](../../research/analyzer-lab/docs/ANALYZER-DEVELOPMENT-METHOD.md).

## Input artifact

Use one exact decoded channel-0 PCM identity and clock for both prediction lists and annotations. Times are seconds from sample zero of that PCM, without playback/display latency offsets. Declare the SHA256 of the decoded little-endian Float32 PCM bytes, the integer sample rate (1000–384000 Hz), positive integer sample count and `channel: 0`. An original compressed-file hash is not a decoded PCM hash. If using an excerpt, all times must be local to the declared excerpt; document its original sample origin in provenance.

```json
{
  "schemaVersion": "event-timing-evaluation-input-v1",
  "identity": {
    "pcmSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sampleRate": 48000,
    "sampleCount": 480000,
    "channel": 0
  },
  "baseline": [{ "time": 1.02 }, { "time": 3.02 }],
  "candidate": [{ "time": 1.001 }, { "time": 3.001 }],
  "annotation": {
    "status": "human-reviewed",
    "annotator": "Named independent reviewer",
    "eventType": "audible-percussive-onset",
    "onsets": [1.0, 3.0],
    "completeIntervals": [[0.0, 10.0]],
    "provenance": "Example only. Replace with review method, PCM source, annotation revision and uncertainties."
  },
  "parameters": { "candidateAlgorithm": "accepted-frame-band-timing-v1", "mode": "experimental-opt-in" },
  "protocol": { "revision": "predeclared-study-1", "split": "independent-final-test" }
}
```

The example hash and labels are placeholders, not measured music. `baseline` and `candidate` contain finite nondecreasing times within `[0, sampleCount/sampleRate)`. Duplicate prediction times remain separate events for one-to-one scoring. Annotation onsets must be finite, strictly increasing and within the same duration. `annotator` and `provenance` must be nonempty. Optional `parameter`, `parameters` and `protocol` fields retain finite JSON provenance without changing evaluation tolerances.

Human review must identify audible attack starts on the exact PCM. MIDI command starts, waveform maxima and library agreement cannot replace reviewed labels. Review complete intervals without hiding misses or false events, including overlapping attacks and negative regions. Preserve annotation uncertainty and reviewer procedure in provenance; this schema does not compute calibrated uncertainty or adjudicate reviewer disagreement.

The evaluator validates the declared identity's shape and bounds. It does **not** read the PCM or prove that labels/predictions originate from the declared bytes, or verify human independence. Prepare and verify PCM/annotation identity upstream. `identityVerification: "declared-only-no-pcm-read"` records this limitation.

## Complete intervals and frozen metrics

`completeIntervals` are sorted, nonoverlapping half-open intervals `[start,end)`: the start is included; the end is excluded. Adjacent intervals are allowed and matched independently. Every audible percussive onset in a declared interval must be annotated, and reviewed silence must retain its exposure. Empty intervals are invalid; an empty interval list is permitted and reports unavailable exposure. Predictions and labels outside complete intervals are excluded, with their original indexes reported. Even if numerically close, events in different intervals cannot match across a gap or review boundary.

Each tolerance is evaluated afresh at frozen **2, 10, 25 and 50 ms**. A prediction is eligible inside the inclusive numeric interval `[annotationTime-tolerance, annotationTime+tolerance]`. Earliest feasible ordered pairing gives deterministic maximum one-to-one cardinality per complete interval; it does not minimize timing error. Every pair retains prediction index, annotation index, interval index, original times and signed error. Positive error means late.

Precision is `TP/predictions` and recall is `TP/annotations`; each is null when its denominator is zero. F1 is `2*TP/(predictions+annotations)` and is null only when both lists are empty within annotated exposure. Thus missed positives yield F1 zero and silence does not fabricate perfect F1. FP/minute uses the sum of complete interval durations, including reviewed negative time, and is null without exposure.

Signed mean bias and absolute p50/p95 use matched pairs only. Percentiles use nearest rank: sorted absolute error at `ceil(p*n)-1`. Timing values are null without a match. They are conditional on the tolerance and omit misses, so inspect TP/FP/FN, recall and sample count alongside timing. Delta fields mean candidate minus baseline and are null if either operand is undefined. Different match sets can change the timing sample population; the deltas are descriptive, not a paired significance test or general accuracy guarantee.

## Run and retain

From `plexus-engine/`, after creating an input artifact and selecting an absent output path whose parent directory exists:

```powershell
node research/analyzer-lab/diagnostics/evaluate-event-timing.mjs --input EXACT_REVIEWED_INPUT_JSON --output NEW_RESULT_JSON
node --test tests/event-timing-evaluator.test.mjs
```

The CLI exclusively creates a new output (`wx`) and refuses to overwrite any file. The result retains input SHA256, evaluator source SHA256 and Node version; it adds no timestamps, dependency or provider execution. Importing the module is safe and exposes `evaluateTimingInput(input)` for reusable diagnostics without file I/O. Pure evaluation is deterministic and does not mutate input.

Freeze the study protocol before viewing final-test results. Retain original baseline predictions, raw candidate predictions, labels and result files; do not retune tolerances or erase failed strata. This evaluator supplies per-artifact timing/count evidence. It does not yet supply independent-group bootstrap, track/group macro aggregation, uncertainty calibration, measured runtime budgets or headset/audio/input/display loopback evidence. Those remain required where applicable before ordinary automation/XR behavior promotion.
