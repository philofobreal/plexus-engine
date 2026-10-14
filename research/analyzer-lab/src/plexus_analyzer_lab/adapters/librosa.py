import numpy as np

from ..canonical import empty_analysis
from ..contracts import validate
from ..provenance import provenance


class LibrosaAdapter:
    def analyze(self, audio, output_dir, config, run_timestamp):
        import librosa

        options = config["librosa"]
        hop = options["hopLength"]
        params = {**options, "sampleRate": audio.sample_rate, "center": True,
                  "onsetBacktrack": False, "beatTrim": True,
                  "monoProjection": audio.metadata.get("monoProjection", "undeclared"), "eventClasses": ["onset"]}
        onset_envelope = librosa.onset.onset_strength(y=audio.samples, sr=audio.sample_rate, hop_length=hop, center=True)
        tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_envelope, sr=audio.sample_rate,
                                                   hop_length=hop, start_bpm=options["startBpm"],
                                                   tightness=options["tightness"], trim=True)
        onset_frames = librosa.onset.onset_detect(onset_envelope=onset_envelope, sr=audio.sample_rate,
                                                 hop_length=hop, backtrack=False, units="frames")
        scalar = float(np.asarray(tempo).reshape(-1)[0])
        valid = lambda frames: [float(t) for t in librosa.frames_to_time(frames, sr=audio.sample_rate, hop_length=hop)
                                if t <= audio.metadata["duration"]]
        result = empty_analysis(audio.metadata, provenance("librosa", librosa.__version__, params,
                                                          "oracle_prediction", run_timestamp))
        result["timing"].update(tempo=scalar if scalar > 0 else None, beats=valid(beat_frames))
        # Neither beat_track nor onset_detect provides calibrated event probabilities.
        result["events"] = [{"time": t, "class": "onset", "confidence": None, "provider": "librosa"}
                            for t in valid(onset_frames)]
        return validate(result)
