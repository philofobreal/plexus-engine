# Reviewed local MIDI drum annotations

This research importer converts locally supplied MIDI into canonical kick, snare,
and hi-hat onset annotations. It adds no MIDI dependency, downloads nothing, and
does not alter production audio analysis. It cannot establish ownership, audible
alignment, drum-channel identity, or annotation completeness automatically.

## Review before import

Review the exact audio/MIDI pair and retain dataset release, attribution, original
track identity, source URL, permitted use, and any transformations in the review
strings and dataset manifest. Confirm that every selected MIDI channel actually
contains drums using the source metadata and the audible stem. A melodic note 36
is not a kick merely because its pitch matches a drum mapping. Channels here are
zero-based: MIDI channel 10 is `9`; another channel requires explicit review.

Compare onsets with the supplied audio throughout the track, including after
tempo changes. `onsetOffsetSeconds` is an explicitly reviewed constant added to
MIDI-derived seconds. Even zero must be stated. Rendering/sample attack can move
the audible onset relative to the MIDI command. If alignment drifts or different
drum voices need different offsets, this importer cannot repair it: curate the
annotations separately before training.

`completeEventClasses` asserts full coverage of all three classes for the supplied
audio, including absent classes. A MIDI file for one drum stem does not justify
this assertion for a mixture containing additional drum stems. Missing labels
would teach false negatives. Confirm the selected channels collectively cover
all kick/snare/hi-hat events, and that unsupported voices do not represent one of
those classes under the actual drum kit. Keep the original source files for audit.

Create a UTF-8 JSON review containing exactly these fields. This template is
intentionally unapproved; finish the review and change `reviewed` to `true` before
importing. Replace the descriptive strings with the actual findings.

```json
{
  "reviewed": false,
  "source": "Dataset source URL, attribution, track/stem identity and provenance",
  "version": "Exact dataset release and preprocessing version",
  "license": "Exact license source URL and reviewed permitted use",
  "reviewNote": "Drum metadata/channel checks and complete class coverage findings",
  "alignmentReview": "Audible comparisons, locations checked and timing findings",
  "drumChannels": [9],
  "completeEventClasses": ["kick", "snare", "hihat"],
  "onsetOffsetSeconds": 0.0,
  "groundTruthReviewed": false
}
```

The importer rejects missing, extra, or duplicate JSON keys, blank review strings,
non-boolean review flags, duplicate/out-of-range/non-integer channels, incomplete
class coverage declarations, and non-finite offsets. A nonempty list of reviewed
channels is required. `groundTruthReviewed: false` produces `human_annotation`;
only an explicit `true` produces `ground_truth`. A license string or a successful
import does not establish training/evaluation rights. The drum dataset manifest
must separately record reviewed rights and explicitly allow the intended use.

## API and output

From an installed lab environment:

```powershell
python -m plexus_analyzer_lab drum-import-midi --audio data/local/Track00001/mix.flac --midi data/local/Track00001/MIDI/S01.mid --review data/local/Track00001/review.json --track-id Track00001 --output data/local/annotations/Track00001.json
```

Paths resolve against the shell's current directory. Use the actual reviewed drum MIDI/audio pair.

```python
from plexus_analyzer_lab.drums.midi import import_midi

path = import_midi(
    audio_path="data/local/Track00001/mix.flac",
    midi_path="data/local/Track00001/MIDI/S01.mid",
    review_path="data/local/Track00001/review.json",
    output_path="data/local/annotations/Track00001.json",
    track_id="Track00001",
)
```

These paths are illustrative; select the actual drum stem identified by metadata.
The function returns an absolute `Path`, requires a new `.json` output, and fails
on collision. It validates the canonical contract before exclusive creation.
The audio file determines the content hash, duration, source sample rate, channel
count, and mono projection. The explicitly supplied track ID must match the
subsequent dataset manifest. No audio is copied or resampled by the importer.

Events are sorted by time and class; identical class/exact-time pairs are collapsed
deterministically, retaining the first event in MIDI tick/track/event order.
Simultaneous different classes remain distinct. MIDI velocity is retained as its
original integer in `attributes.velocity`, alongside `midiNote` and zero-based
`channel`; it is not a probability. Every event has `confidence: null`; duration
is omitted because only note-on onsets are annotated.

Provenance includes `sourceMidiHash`, `reviewHash` (SHA-256 of the exact imported
bytes), the complete review, mapping version, class coverage, reviewed truth flag,
timing offset, PPQN, format/track/tempo counts, duplicate count, and ignored-note
counts. `ignoredNotes.unmappedDrumNotes` counts excluded positive-velocity note-ons
by pitch on reviewed channels. `ignoredNotes.nonDrumChannels` counts ignored
positive-velocity note-ons by unselected channel. Note-offs and zero-velocity
note-ons provide no onset and are ignored. An empty `events: []` means reviewed
supported coverage with no mapped onsets, not unavailable evidence.

## Restricted SMF support

The original minimal parser supports format 0 with one track and format 1 with
multiple tracks, using positive PPQN division. Default tempo is 500,000
microseconds per quarter note until a tempo event changes it. Tempo events from
all tracks are merged and integrated piecewise; conflicting tempos at the same
tick fail. MIDI ticks are converted before applying the reviewed offset.

Channel running status is supported; meta and SysEx events cancel it. Non-tempo
meta and length-delimited SysEx payloads are skipped. Valid note-offs and other
channel messages are read without becoming annotations. The parser deliberately
rejects format 2, SMPTE timing, non-six-byte headers, other system messages,
invalid/truncated data, excessive VLQs, invalid tempo payloads, missing or
nonterminal end-of-track events, inconsistent track counts, and trailing bytes.
It is a restricted importer rather than a general MIDI editor. Mapped onsets
before zero or after audio duration fail; they are never clipped or shifted into
range. The official specification entry is [MIDI Association: Standard MIDI
Files](https://midi.org/standard-midi-files).

The fixed mapping `gm-kick-snare-hihat-v1` follows the General MIDI drum names
listed in the primary [pretty_midi drum constants](https://github.com/craffel/pretty-midi/blob/main/pretty_midi/constants.py).
No parser code was imported from that project.

| MIDI note | Class | Canonical subclass |
| --- | --- | --- |
| 35 | kick | acousticBassDrum |
| 36 | kick | bassDrum1 |
| 38 | snare | acousticSnare |
| 40 | snare | electricSnare |
| 42 | hihat | closedHiHat |
| 44 | hihat | pedalHiHat |
| 46 | hihat | openHiHat |

Side-stick (37), hand-clap (39), toms, cymbals, and other notes are deliberately
unmodeled and counted. A custom kit can use different assignments; do not import
it with this mapping without validating the actual sound assignments.

## Slakh provenance and split gates

Sources checked on 2026-10-10. The [Slakh project](https://github.com/ethman/Slakh)
publishes the dataset under CC BY 4.0. Cite Ethan Manilow, Gordon Wichern, Prem
Seetharaman, and Jonathan Le Roux, “Cutting Music Source Separation Some Slakh:
A Dataset to Study the Impact of Training Data Quality and Quantity,” WASPAA 2019.
Retain the release record, such as [Slakh2100 on
Zenodo](https://zenodo.org/records/4599666), and its exact archive identity.
The [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/) require appropriate
credit, a license link, and indication of changes. These records do not provide a
legal guarantee for every local asset or intended use.

Use `metadata.yaml` to identify a stem with `is_drum`, `audio_rendered`, and
`midi_saved`. Source ordering is unspecified. Pair `MIDI/Sxx.mid` with
`stems/Sxx.flac`: the per-stem MIDI drove synthesis. `all_src.mid` preserves the
Lakh source and can differ after instrument-specific heuristics; it is not an
automatic substitute. The metadata `UUID` identifies the original Lakh MIDI.
[Slakh utility documentation](https://github.com/ethman/slakh-utils#at-a-glance)
describes these relationships.

Slakh2100-orig has duplicate MIDI across splits despite different rendered audio.
Slakh2100-split2 groups duplicates within splits (1500/375/225); redux removes
duplicates (1289/270/151). Record the chosen published split. Group related
renderings by source UUID, and use upstream duplicate groups where necessary;
audio hashes alone cannot prevent composition leakage. Retain published test
membership; do not choose timing/mapping/model thresholds using test outcomes.
See the [split definitions](https://github.com/ethman/slakh-utils/tree/master/splits)
and [upstream split explanation](https://github.com/ethman/slakh-utils#make-splits).

The [Lakh author](https://colinraffel.com/projects/lmd/) publishes CC BY 4.0,
but notes inconsistent per-file copyright attribution, potentially corrupt MIDI,
and possible incorrect matches among harmonically similar recordings. Preserve
that limitation in rights/provenance review rather than inferring universal
clearance or trusting Lakh alignment as audible truth.

No real Slakh MIDI/stem assets were found in the targeted local research/data
locations during this implementation. Synthetic parser tests establish timing,
schema, identity, and failure behavior; they do not measure drum classifier
accuracy, real-audio alignment, or the license status of subsequently supplied
data. Real held-out evaluation remains required before a quality claim.
