# Experimental attack timing and automation placement

The dashboard, MVP and XR hosts can opt into accepted-event timing with
`?eventTiming=local-band-v2`. Append with `&` when a URL already has a query.
Reload/reselect the track so analysis and generated plans/charts use the same
publication. Without this option, algorithm-7 events and legacy anchor ranking
remain unchanged. No runtime or model dependency was added.

Examples for the Vite default port:

- `http://localhost:5173/plexus-engine/?eventTiming=local-band-v2`
- `http://localhost:5173/plexus-engine/mvp/?eventTiming=local-band-v2`
- `http://localhost:5173/plexus-engine/xr/?eventTiming=local-band-v2`

`local-band-v1` is also retained for reproducible comparison. V2 adds a sharpness
gate: first-1-ms mean power must reach 0.25 times next-12-ms mean power. The current
`accepted-frame-band-timing-v2-dc1` revision subtracts the observed 60 ms pre-frame
mean before measuring that power, so constant DC does not impersonate an attack.
Its provenance includes the baseline; its separate identity isolates saved journeys
from the historical raw-power v2. Historical measurements remain unchanged. This
rejects the known gradual-ramp refinements but can also leave sharp, very short
impulses uncorrected. Neither variant is a default or universal accuracy claim.

The integration's 336 additional ramp/tonal-mixture stress cases retain eight
false refinements in both old and corrected v2. The DC repair does not isolate
attacks from AC backgrounds. See the [integration review](../audits/xr-oracle-onset-integration-2026-10-20.md)
for the usefulness decision, regression evidence and remaining promotion gates.

## Behavior and provenance

The unchanged physical-band research detector runs on bounded local PCM around
each already accepted percussive frame, not on every raw candidate in a song.
One retained local attack cluster gives an experimental timestamp; absent,
multiple, quiet or unsupported candidates preserve the original timestamp.
V2 also preserves the original timestamp on `gradual-attack` abstentions.
The correction stays inside its accepted frame (at most 30 ms after its start).
Count, type and intensity are unchanged. Beats, bars, structural boundaries and
audio playback stay on their original clock. The timestamp of an explicitly
onset-backed impact cue follows the same correction.

`TrackAnalysis.eventTiming` carries algorithm identity, original event indexes
and times, proposed times, observed sample support, candidate count and status.
`refined` means localized by this detector, not independently validated accuracy.
The worker/AudioEngine request-id and copy/transfer protocols are retained.
The XR chart consumes the resulting accepted event times, so hit and spawn move
together. Existing density, hand travel, pair and initial approach-horizon
filters still apply. It does not recover opening targets discarded for lacking
an approach horizon, add pre-roll or calibrate physical headset latency.

The opt-in automation gate retains the roles of accepted evidence at shared
times. A scene birth first seeks its compatible section boundary, then other
structural evidence. Internal accents prefer attacks; release points prefer
release evidence. With no compatible role it uses the previous distance ranking,
within the same bounded search and omission gate. Selected confidence and source
kind come from the role's own evidence, not a stronger unrelated same-time cue.
This does not add source separation, note transcription or inferred motif starts.

Experimental MVP journeys have a separate fingerprint using the timing algorithm
identity. Existing saved legacy journeys keep their old keys. Turn the option
off and reload to return to the legacy path; manual/locked points are user-owned.

## Real music review

Human-reviewed audible attacks on exact decoded PCM are needed before default
promotion. Prepare a review artifact from channel-0 little-endian float32 PCM:

```powershell
node research/analyzer-lab/diagnostics/prepare-event-timing-review.mjs --pcm INPUT.f32le --sample-rate 44100 --output NEW_REVIEW.json
```

It runs both actual analyzer paths, hashes input bytes, retains proposed timing,
and marks the annotation `awaiting-human-review`. It cannot pass the evaluator
until an actual reviewer fills the onset times, complete annotation intervals,
reviewer/provenance fields and `human-reviewed` status. Annotation seconds are
relative to this exact PCM start, not automatically the original file's start.
No annotation or truth is inferred from external-library agreement.

The standard Oracle lab adapter also accepts `plexus.eventTiming` in an explicit
config override (`local-band-v1` or `local-band-v2`). Both Python config and the
Node bridge validate this string enum separately from numeric options. The raw
analysis artifact preserves the report; the canonical lab projection retains its
existing format and records the requested mode in provenance parameters.

Then evaluate without overwriting either input or prior results:

```powershell
node research/analyzer-lab/diagnostics/evaluate-event-timing.mjs --input REVIEWED.json --output NEW_RESULT.json
```

The [annotation format](event-timing-annotation-format.md) specifies partial
coverage, frozen tolerance matching and the declared-only PCM identity limit.
The evaluator reports misses and extras next to conditional timing statistics;
silence is never assigned an invented perfect F1 score.

For reproducible generated controls and optional exact cached-recording replay:

```powershell
node research/analyzer-lab/diagnostics/measure-accepted-timing.mjs --output NEW_MEASUREMENT.json
node research/analyzer-lab/diagnostics/measure-accepted-timing.mjs --output NEW_REPLAY.json --pcm-cache EXACT_AN03F_CACHE
node research/analyzer-lab/diagnostics/measure-accepted-timing-v2.mjs --output NEW_V2_REPLAY.json --pcm-cache EXACT_AN03F_CACHE
```

Generated controls establish bounded software behavior, not independent musical
generalization. Unannotated recordings establish count/shift/abstention and cost
only. Short local windows can alter a recursive detector's context, suppressed
candidate attacks can remain ambiguous in reality, and weak/slow attacks may
stay unrefined. Scores and uniqueness are engineering evidence, not probabilities.

See [frozen experiment](../research/onset-placement-experiment.md) and
[v2 experiment](../research/onset-placement-v2-experiment.md), plus
[validation record](../research/onset-placement-validation.md) for evidence and
remaining promotion work.
