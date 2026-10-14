"""Original, restricted SMF parser for explicitly reviewed local drum annotations."""
from bisect import bisect_right
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import struct

from ..audio import load_audio
from ..canonical import empty_analysis
from ..contracts import validate
from ..provenance import provenance, timestamp
from . import CLASSES

MAPPING_VERSION = "gm-kick-snare-hihat-v1"
PROVIDER = "reviewed-midi"
MAPPING = {
    35: ("kick", "acousticBassDrum"), 36: ("kick", "bassDrum1"),
    38: ("snare", "acousticSnare"), 40: ("snare", "electricSnare"),
    42: ("hihat", "closedHiHat"), 44: ("hihat", "pedalHiHat"),
    46: ("hihat", "openHiHat"),
}
REVIEW_FIELDS = {
    "reviewed", "source", "version", "license", "reviewNote", "alignmentReview",
    "drumChannels", "completeEventClasses", "onsetOffsetSeconds", "groundTruthReviewed",
}


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate review key: {key}")
        result[key] = value
    return result


def _review(raw):
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    if not isinstance(value, dict) or set(value) != REVIEW_FIELDS:
        raise ValueError("Review must contain exactly the documented review fields")
    if value["reviewed"] is not True:
        raise ValueError("Explicit reviewed:true is required")
    for key in ("source", "version", "license", "reviewNote", "alignmentReview"):
        if not isinstance(value[key], str) or not value[key].strip():
            raise ValueError(f"Nonempty review {key} is required")
    channels = value["drumChannels"]
    if (not isinstance(channels, list) or not channels
            or any(type(channel) is not int or not 0 <= channel <= 15 for channel in channels)
            or len(set(channels)) != len(channels)):
        raise ValueError("drumChannels must be unique, nonempty, zero-based integers 0..15")
    classes = value["completeEventClasses"]
    if (not isinstance(classes, list) or any(not isinstance(item, str) for item in classes)
            or len(classes) != len(CLASSES) or set(classes) != set(CLASSES)):
        raise ValueError("completeEventClasses must contain exactly kick, snare, hihat")
    offset = value["onsetOffsetSeconds"]
    try:
        finite_offset = type(offset) in (int, float) and math.isfinite(offset)
    except OverflowError:
        finite_offset = False
    if not finite_offset:
        raise ValueError("An explicit finite onsetOffsetSeconds is required")
    if type(value["groundTruthReviewed"]) is not bool:
        raise ValueError("groundTruthReviewed must be an explicit boolean")
    return value


class _Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def take(self, count):
        if count < 0 or self.pos + count > len(self.data):
            raise ValueError("Truncated MIDI data or chunk")
        result = self.data[self.pos:self.pos + count]
        self.pos += count
        return result

    def byte(self):
        return self.take(1)[0]

    def vlq(self):
        value = 0
        for _ in range(4):
            byte = self.byte()
            value = (value << 7) | (byte & 127)
            if not byte & 128:
                return value
        raise ValueError("MIDI VLQ exceeds four bytes")


def _track(raw, track_index):
    reader = _Reader(raw)
    tick, running, order = 0, None, 0
    notes, tempos = [], []
    while reader.pos < len(raw):
        tick += reader.vlq()
        status = reader.byte()
        first = None
        if status < 128:
            if running is None:
                raise ValueError("Running status without a preceding channel status")
            first, status = status, running
        if 128 <= status <= 239:
            running = status
            size = 1 if status >> 4 in (12, 13) else 2
            payload = ([first] if first is not None else [])
            payload.extend(reader.take(size - len(payload)))
            if any(byte >= 128 for byte in payload):
                raise ValueError("Invalid channel message data byte")
            if status >> 4 == 9 and payload[1] > 0:
                notes.append((tick, track_index, order, status & 15, payload[0], payload[1]))
        elif status == 255:
            running = None  # SMF meta events cancel channel running status.
            kind = reader.byte()
            if kind >= 128:
                raise ValueError("Invalid meta-event type")
            payload = reader.take(reader.vlq())
            if kind == 47:
                if payload or reader.pos != len(raw):
                    raise ValueError("End-of-track must have zero length and terminate the chunk")
                return notes, tempos
            if kind == 81:
                if len(payload) != 3 or int.from_bytes(payload, "big") == 0:
                    raise ValueError("Invalid MIDI tempo")
                tempos.append((tick, int.from_bytes(payload, "big")))
        elif status in (240, 247):
            running = None
            reader.take(reader.vlq())
        else:
            raise ValueError(f"Unsupported MIDI system status: {status:#x}")
        order += 1
    raise ValueError("MIDI track is missing end-of-track")


def _parse(raw):
    reader = _Reader(raw)
    if reader.take(4) != b"MThd" or int.from_bytes(reader.take(4), "big") != 6:
        raise ValueError("Expected a six-byte SMF header")
    format_id, count, division = struct.unpack(">HHH", reader.take(6))
    if format_id not in (0, 1) or count == 0 or (format_id == 0 and count != 1):
        raise ValueError("Only SMF format 0 (one track) or format 1 is supported")
    if division & 32768 or division == 0:
        raise ValueError("Only positive PPQN timing is supported; SMPTE is unavailable")
    notes, tempos = [], []
    for index in range(count):
        if reader.take(4) != b"MTrk":
            raise ValueError("Expected MTrk chunk")
        track_notes, track_tempos = _track(reader.take(int.from_bytes(reader.take(4), "big")), index)
        notes.extend(track_notes)
        tempos.extend(track_tempos)
    if reader.pos != len(raw):
        raise ValueError("Unexpected data after MIDI track chunks")
    tempo_by_tick = {}
    for tick, tempo in tempos:
        if tick in tempo_by_tick and tempo_by_tick[tick] != tempo:
            raise ValueError("Conflicting simultaneous MIDI tempos")
        tempo_by_tick[tick] = tempo
    return division, sorted(notes), sorted(tempo_by_tick.items()), format_id, count


def _time_axis(ppqn, tempos):
    ticks, seconds, rates = [0], [0.0], [500000 / (ppqn * 1000000)]
    for tick, tempo in tempos:
        elapsed = seconds[-1] + (tick - ticks[-1]) * rates[-1]
        if tick == ticks[-1]:
            rates[-1] = tempo / (ppqn * 1000000)
        else:
            ticks.append(tick)
            seconds.append(elapsed)
            rates.append(tempo / (ppqn * 1000000))
    def at(tick):
        index = bisect_right(ticks, tick) - 1
        return seconds[index] + (tick - ticks[index]) * rates[index]
    return at


def import_midi(audio_path, midi_path, review_path, output_path, track_id):
    """Import local SMF onsets only after an explicit license/channel/alignment review.

    Output is exclusively created; existing paths are never replaced. The review
    certifies complete kick/snare/hihat annotations for the supplied audio.
    """
    output = Path(output_path).resolve()
    if output.suffix != ".json":
        raise ValueError("MIDI annotations require a .json output path")
    if output.exists():
        raise FileExistsError(output)
    if not isinstance(track_id, str) or not track_id.strip():
        raise ValueError("A nonempty track_id is required")
    raw_review = Path(review_path).read_bytes()
    review = _review(raw_review)
    raw_midi = Path(midi_path).read_bytes()
    ppqn, notes, tempos, format_id, track_count = _parse(raw_midi)
    audio = load_audio(audio_path, track_id)
    at = _time_axis(ppqn, tempos)
    events, seen = [], set()
    unmapped, other_channels = Counter(), Counter()
    duplicate_count = 0
    for tick, _, _, channel, note, velocity in notes:
        if channel not in review["drumChannels"]:
            other_channels[str(channel)] += 1
            continue
        if note not in MAPPING:
            unmapped[str(note)] += 1
            continue
        event_time = at(tick) + review["onsetOffsetSeconds"]
        if not math.isfinite(event_time) or event_time < 0 or event_time > audio.metadata["duration"]:
            raise ValueError("Reviewed MIDI onset lies outside the supplied audio")
        event_class, subclass = MAPPING[note]
        key = (event_class, event_time)
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)
        events.append({"time": event_time, "class": event_class, "subclass": subclass,
                       "confidence": None, "provider": PROVIDER,
                       "attributes": {"midiNote": note, "velocity": velocity, "channel": channel}})
    events.sort(key=lambda item: (item["time"], item["class"]))
    parameters = {
        "completeEventClasses": list(CLASSES), "eventClasses": list(CLASSES),
        "groundTruthReviewed": review["groundTruthReviewed"],
        "sourceMidiHash": sha256(raw_midi).hexdigest(), "reviewHash": sha256(raw_review).hexdigest(),
        "mappingVersion": MAPPING_VERSION, "review": review,
        "onsetOffsetSeconds": review["onsetOffsetSeconds"], "midiFormat": format_id,
        "midiTrackCount": track_count, "ppqn": ppqn, "tempoEventCount": len(tempos),
        "ignoredNotes": {"unmappedDrumNotes": dict(sorted(unmapped.items())),
                         "nonDrumChannels": dict(sorted(other_channels.items()))},
        "deduplicatedEvents": duplicate_count,
    }
    evidence = "ground_truth" if review["groundTruthReviewed"] else "human_annotation"
    result = empty_analysis(audio.metadata, provenance(PROVIDER, "smf-drum-import-v1", parameters, evidence, timestamp()))
    result["events"] = events
    validate(result)
    text = json.dumps(result, indent=2, allow_nan=False) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        stream.write(text)
    return output
