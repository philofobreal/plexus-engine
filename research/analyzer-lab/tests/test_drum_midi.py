"""Original tiny SMF fixtures exercise the reviewed annotation boundary."""
from hashlib import sha256
import json
import struct

import numpy as np
import pytest
import soundfile as sf

from plexus_analyzer_lab.drums.midi import import_midi


def vlq(value):
    result = [value & 127]
    value >>= 7
    while value:
        result.insert(0, (value & 127) | 128)
        value >>= 7
    return bytes(result)


def event(delta, payload):
    return vlq(delta) + payload


EOT = b"\x00\xff\x2f\x00"


def smf(*tracks, format_id=None, division=480):
    if format_id is None:
        format_id = 0 if len(tracks) == 1 else 1
    return (b"MThd" + struct.pack(">IHHH", 6, format_id, len(tracks), division)
            + b"".join(b"MTrk" + struct.pack(">I", len(track)) + track for track in tracks))


@pytest.fixture
def inputs(tmp_path):
    audio = tmp_path / "audio.wav"
    sf.write(audio, np.zeros(88200, dtype=np.float32), 22050, subtype="PCM_16")
    midi = tmp_path / "drums.mid"
    midi.write_bytes(smf(event(0, b"\x99\x24\x64") + EOT))
    review = tmp_path / "review.json"
    review.write_text(json.dumps({
        "reviewed": True, "source": "locally authored synthetic test fixture",
        "version": "fixture-1", "license": "original test fixture",
        "reviewNote": "Channel 9 contains only drums; full class coverage reviewed.",
        "alignmentReview": "Audible onset comparison completed; zero offset approved.",
        "drumChannels": [9], "completeEventClasses": ["kick", "snare", "hihat"],
        "onsetOffsetSeconds": 0, "groundTruthReviewed": False,
    }), encoding="utf-8")
    return audio, midi, review, tmp_path / "output.json"


def run(inputs):
    result = import_midi(*inputs, "fixture-track")
    assert result == inputs[3].resolve()
    return json.loads(result.read_text(encoding="utf-8"))


def update_review(inputs, **changes):
    review = json.loads(inputs[2].read_text(encoding="utf-8"))
    review.update(changes)
    inputs[2].write_text(json.dumps(review), encoding="utf-8")


def test_tempo_integral_across_tracks(inputs):
    tempo_track = (event(0, b"\xff\x51\x03\x07\xa1\x20")
                   + event(480, b"\xff\x51\x03\x0f\x42\x40") + EOT)
    drum_track = (event(240, b"\x99\x23\x60") + event(240, b"\x99\x26\x50")
                  + event(480, b"\x99\x2e\x40") + EOT)
    inputs[1].write_bytes(smf(tempo_track, drum_track))
    result = run(inputs)
    assert [item["time"] for item in result["events"]] == [0.25, 0.5, 1.5]
    assert [item["class"] for item in result["events"]] == ["kick", "snare", "hihat"]
    assert result["events"][-1]["subclass"] == "openHiHat"


def test_running_status_zero_velocity_channel_filter_omissions_and_dedup(inputs):
    track = (event(0, b"\x99\x23\x64") + event(0, b"\x24\x70")
             + event(240, b"\x26\x00") + event(0, b"\x89\x24\x00")
             + event(0, b"\x90\x26\x60") + event(0, b"\x99\x25\x64")
             + event(0, b"\x27\x64") + event(0, b"\x29\x64")
             + event(0, b"\x28\x60") + event(240, b"\x2a\x30") + EOT)
    inputs[1].write_bytes(smf(track))
    result = run(inputs)
    assert [(e["time"], e["class"]) for e in result["events"]] == [(0, "kick"), (.25, "snare"), (.5, "hihat")]
    assert result["events"][0]["attributes"] == {"midiNote": 35, "velocity": 100, "channel": 9}
    assert all(e["confidence"] is None and "duration" not in e for e in result["events"])
    parameters = result["provenance"]["parameters"]
    assert parameters["deduplicatedEvents"] == 1
    assert parameters["ignoredNotes"] == {"unmappedDrumNotes": {"37": 1, "39": 1, "41": 1}, "nonDrumChannels": {"0": 1}}


def test_identity_review_hashes_and_ground_truth_are_explicit(inputs):
    update_review(inputs, onsetOffsetSeconds=0.125, groundTruthReviewed=True)
    result = run(inputs)
    assert result["metadata"]["trackId"] == "fixture-track"
    assert result["metadata"]["contentHash"] == sha256(inputs[0].read_bytes()).hexdigest()
    assert result["metadata"]["duration"] == 4
    assert result["events"][0]["time"] == .125
    assert result["provenance"]["evidenceType"] == "ground_truth"
    p = result["provenance"]["parameters"]
    assert p["sourceMidiHash"] == sha256(inputs[1].read_bytes()).hexdigest()
    assert p["reviewHash"] == sha256(inputs[2].read_bytes()).hexdigest()
    assert p["review"]["groundTruthReviewed"] is True
    assert p["completeEventClasses"] == p["eventClasses"] == ["kick", "snare", "hihat"]


def test_human_annotation_and_supported_empty_output(inputs):
    inputs[1].write_bytes(smf(event(0, b"\x90\x24\x64") + EOT))
    result = run(inputs)
    assert result["events"] == []
    assert result["provenance"]["evidenceType"] == "human_annotation"


def test_reviewed_nonstandard_channel_and_default_tempo(inputs):
    update_review(inputs, drumChannels=[2])
    inputs[1].write_bytes(smf(event(480, b"\x92\x24\x7f") + EOT))
    result = run(inputs)
    assert result["events"][0]["time"] == .5
    assert result["events"][0]["attributes"]["channel"] == 2
    assert result["events"][0]["subclass"] == "bassDrum1"
    assert result["events"][0]["confidence"] is None


@pytest.mark.parametrize("offset", [-.001, 4.001])
def test_offsets_outside_audio_fail_without_output(inputs, offset):
    update_review(inputs, onsetOffsetSeconds=offset)
    with pytest.raises(ValueError, match="outside"):
        run(inputs)
    assert not inputs[3].exists()


@pytest.mark.parametrize("changes", [
    {"reviewed": False}, {"reviewed": 1}, {"license": " "}, {"alignmentReview": ""},
    {"drumChannels": []}, {"drumChannels": [9, 9]}, {"drumChannels": [True]},
    {"drumChannels": [16]}, {"drumChannels": [-1]}, {"drumChannels": [9.0]},
    {"completeEventClasses": ["kick", "snare"]},
    {"completeEventClasses": ["kick", "snare", "hihat", "hihat"]},
    {"onsetOffsetSeconds": float("nan")}, {"onsetOffsetSeconds": float("inf")},
    {"onsetOffsetSeconds": False}, {"groundTruthReviewed": "true"}, {"unexpected": True},
    {"onsetOffsetSeconds": 10 ** 400},
])
def test_invalid_reviews_rejected(inputs, changes):
    update_review(inputs, **changes)
    with pytest.raises(ValueError):
        run(inputs)
    assert not inputs[3].exists()


def test_missing_and_duplicate_review_fields_rejected(inputs):
    inputs[2].write_text('{"reviewed":true,"reviewed":true}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate"):
        run(inputs)
    update = {"reviewed": True}
    inputs[2].write_text(json.dumps(update), encoding="utf-8")
    with pytest.raises(ValueError, match="exactly"):
        run(inputs)


@pytest.mark.parametrize("raw", [
    b"", smf(EOT, format_id=2), smf(EOT, division=0xE728), smf(EOT, division=0),
    smf(event(0, b"\x99\x24\x64")),
    smf(b"\x80\x80\x80\x80\x00\x99\x24\x64" + EOT),
    smf(b"\x00\x24\x64" + EOT), smf(b"\x00\x99\x80\x64" + EOT),
    smf(b"\x00\xff\x51\x02\x00\x01" + EOT),
    smf(b"\x00\xff\x51\x03\x00\x00\x00" + EOT),
    smf(b"\x00\xff\x2f\x01\x00"), smf(EOT + b"\x00"),
    smf(b"\x00\xf1\x00" + EOT), smf(EOT) + b"trailing", smf(EOT)[:-1],
    smf(b"\x00\xf0\x05\x01"), smf(b"\x00\xff\x01\x05\x01"),
    smf(event(0, b"\x99\x24\x64") + event(0, b"\xff\x01\x00")
        + event(0, b"\x26\x64") + EOT),
    smf(event(0, b"\x99\x24\x64") + event(0, b"\xf0\x00")
        + event(0, b"\x26\x64") + EOT),
])
def test_malformed_or_unsupported_midi_rejected(inputs, raw):
    inputs[1].write_bytes(raw)
    with pytest.raises(ValueError):
        run(inputs)
    assert not inputs[3].exists()


def test_conflicting_tempos_rejected(inputs):
    inputs[1].write_bytes(smf(event(0, b"\xff\x51\x03\x07\xa1\x20") + EOT,
                             event(0, b"\xff\x51\x03\x0f\x42\x40") + EOT))
    with pytest.raises(ValueError, match="Conflicting"):
        run(inputs)


def test_channel_data_sizes_and_sysex_meta_skipping(inputs):
    track = (event(0, b"\xc9\x00") + event(0, b"\x01") + event(0, b"\xd9\x20")
             + event(0, b"\xb9\x07\x64") + event(0, b"\xe9\x00\x40")
             + event(0, b"\xa9\x24\x10") + event(0, b"\xf0\x02\x01\xf7")
             + event(0, b"\xf7\x01\x00") + event(0, b"\xff\x01\x02ok")
             + event(0, b"\x99\x2c\x64") + EOT)
    inputs[1].write_bytes(smf(track))
    assert run(inputs)["events"][0]["subclass"] == "pedalHiHat"


def test_collision_and_extension_fail_without_replacing(inputs):
    inputs[3].write_text("preserve", encoding="utf-8")
    with pytest.raises(FileExistsError):
        run(inputs)
    assert inputs[3].read_text(encoding="utf-8") == "preserve"
    other = inputs[3].with_suffix(".txt")
    with pytest.raises(ValueError, match=".json"):
        import_midi(*inputs[:3], other, "fixture-track")
    assert not other.exists()
