"""Original, fixed-Hz transient proposals and local acoustic descriptors.

Features are research-owned, not AudioFrame aliases. No provider source or
weights are used. Windows preserve the decoded clock without resampling.
"""
import numpy as np
from scipy.signal import find_peaks

FEATURE_VERSION = "drum-acoustic-v1"
BANDS = ((20, 180), (180, 1200), (1200, 4000), (4000, 11025))
FEATURE_NAMES = (
    "log_rms", "crest", "zero_crossing", "centroid", "flatness",
    *[f"log_power_{lo}_{hi}" for lo, hi in BANDS],
    *[f"power_share_{lo}_{hi}" for lo, hi in BANDS],
    "attack_ratio", "decay_ratio", "low_attack", "high_attack",
)


def _power(samples, rate):
    wave = np.asarray(samples, dtype=np.float64)
    if len(wave) < 2:
        wave = np.pad(wave, (0, 2 - len(wave)))
    spectrum = abs(np.fft.rfft(wave * np.hanning(len(wave)))) ** 2 / len(wave) ** 2
    frequencies = np.fft.rfftfreq(len(wave), 1 / rate)
    bands = np.array([spectrum[(frequencies >= lo) & (frequencies < hi)].sum() for lo, hi in BANDS])
    return spectrum, frequencies, bands


def extract(samples, sample_rate):
    """Return ordered proposal times and N×17 feature matrix (silence -> 0×17).

    Union of band-wise energy increases catches simultaneous low/high attacks.
    The adaptive threshold and all windows are fixed before holdout evaluation.
    Supports rates >=16kHz; the high band stops at available Nyquist bins.
    """
    wave = np.asarray(samples, dtype=np.float64)
    if wave.ndim != 1 or not len(wave) or not np.isfinite(wave).all() or sample_rate < 16000:
        raise ValueError("Drum features require finite nonempty mono audio at >=16000 Hz")
    hop = max(1, round(sample_rate * 0.005))
    window = max(2, round(sample_rate * 0.02))
    starts = np.arange(0, len(wave), hop)
    energies = np.array([_power(wave[start:min(start + window, len(wave))], sample_rate)[2] for start in starts])
    strength = np.maximum(0, np.diff(np.sqrt(energies), axis=0, prepend=np.zeros((1, 4))))
    indices = set()
    for channel in strength.T:
        median = np.median(channel)
        threshold = max(0.0003, median + 4 * np.median(abs(channel - median)))
        peaks, _ = find_peaks(np.r_[0, channel, 0], height=threshold, distance=max(1, round(0.04 / 0.005)))
        indices.update((peaks - 1).tolist())
    # Band peaks from a single attack may differ by a few milliseconds.
    merged = []
    for index in sorted(indices):
        if not merged or starts[index] - starts[merged[-1]] > sample_rate * 0.025:
            merged.append(index)
        elif strength[index].sum() > strength[merged[-1]].sum():
            merged[-1] = index
    times, rows = [], []
    for index in merged:
        # Forward energy window proposal precedes attack; compensate by half window.
        start = min(len(wave) - 1, int(starts[index] + window // 2))
        pre = wave[max(0, start - round(sample_rate * 0.06)):start]
        post = wave[start:min(len(wave), start + round(sample_rate * 0.06))]
        tail = wave[min(len(wave), start + round(sample_rate * 0.06)):min(len(wave), start + round(sample_rate * 0.12))]
        spectrum, frequencies, bands = _power(post, sample_rate)
        previous = _power(pre, sample_rate)[2]
        rms = np.sqrt(np.mean(post ** 2))
        pre_rms = np.sqrt(np.mean(pre ** 2)) if len(pre) else 0.0
        tail_rms = np.sqrt(np.mean(tail ** 2)) if len(tail) else 0.0
        total = spectrum.sum() + 1e-12
        flatness = np.exp(np.mean(np.log(spectrum + 1e-12))) / (np.mean(spectrum) + 1e-12)
        row = [np.log1p(100 * rms), np.max(abs(post)) / (rms + 1e-8),
               np.mean(post[1:] * post[:-1] < 0) if len(post) > 1 else 0,
               np.sum(frequencies * spectrum) / total / (sample_rate / 2), flatness,
               *np.log1p(10000 * bands), *(bands / (bands.sum() + 1e-12)),
               np.log((rms + 1e-5) / (pre_rms + 1e-5)), np.log((tail_rms + 1e-5) / (rms + 1e-5)),
               np.log((bands[0] + 1e-9) / (previous[0] + 1e-9)),
               np.log((bands[-1] + 1e-9) / (previous[-1] + 1e-9))]
        times.append(start / sample_rate)
        rows.append(row)
    return np.asarray(times), np.asarray(rows, dtype=np.float64).reshape(-1, len(FEATURE_NAMES))
