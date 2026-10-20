"""Band-local attack evidence with prior-maximum suppression of tonal cycling.

Original research DSP, fixed before the v2 holdout. No provider code/weights.
"""
import numpy as np
from scipy.signal import find_peaks

from .features import BANDS, _power

FEATURE_VERSION = "drum-acoustic-v2"
# Frozen v2 names are serialized model identifiers, not physical-unit promises:
# zero_crossings_per_second = crossings/second divided by 22050;
# centroid_hz = spectral centroid in Hz divided by 11025.
# Fixed reference scaling is independent of the decoded sample rate.
FEATURE_NAMES = (
    "log_rms", "crest", "zero_crossings_per_second", "centroid_hz", "flatness", "tonal_concentration",
    *[f"log_power_{lo}_{hi}" for lo, hi in BANDS],
    *[f"power_share_{lo}_{hi}" for lo, hi in BANDS],
    *[f"attack_{lo}_{hi}" for lo, hi in BANDS],
    *[f"decay_{lo}_{hi}" for lo, hi in BANDS],
    *[f"novelty_{lo}_{hi}" for lo, hi in BANDS],
    *[f"proposal_contrast_{lo}_{hi}" for lo, hi in BANDS],
)


def extract(samples, sample_rate):
    wave = np.asarray(samples, dtype=np.float64)
    if (wave.ndim != 1 or not len(wave) or not np.isfinite(wave).all()
            or type(sample_rate) is not int or sample_rate < 16000):
        raise ValueError("Drum v2 features require finite nonempty mono audio at integer rate >=16000 Hz")
    hop, window = max(1, round(sample_rate * 0.005)), round(sample_rate * 0.02)
    starts = np.arange(0, len(wave), hop)
    body = np.sqrt(np.array([_power(wave[s:min(s + window, len(wave))], sample_rate)[2] for s in starts]))
    previous = np.zeros_like(body)
    # A prior maximum, rather than previous phase sample, cannot repeatedly
    # trigger on a stationary bass oscillator's ordinary energy ripples.
    for i in range(1, len(body)):
        previous[i] = np.max(body[max(0, i - 8):i], axis=0)
    increase = np.maximum(0, body - previous)
    contrast = increase / (body + previous + 1e-8)
    strength = increase * (contrast >= 0.08)
    proposals = set()
    for channel in strength.T:
        median = np.median(channel)
        floor = max(0.0003, median + 4 * np.median(abs(channel - median)))
        peaks, _ = find_peaks(np.r_[0, channel, 0], height=floor, distance=8)
        proposals.update((peaks - 1).tolist())
    # Bounded-diameter clustering: representative changes cannot extend a group.
    clusters = []
    for index in sorted(proposals):
        if not clusters or starts[index] - starts[clusters[-1][0]] > sample_rate * 0.025:
            clusters.append([index])
        else:
            clusters[-1].append(index)
    indices = [max(c, key=lambda i: (strength[i].sum(), -i)) for c in clusters]
    times, rows = [], []
    span = round(sample_rate * 0.06)
    for index in indices:
        start = min(len(wave) - 1, int(starts[index] + window // 2))
        pre = wave[max(0, start - span):start]
        post = wave[start:min(len(wave), start + span)]
        tail = wave[min(len(wave), start + span):min(len(wave), start + 2 * span)]
        spectrum, frequencies, bands = _power(post, sample_rate)
        prior, later = _power(pre, sample_rate)[2], _power(tail, sample_rate)[2]
        audible = (frequencies >= 20) & (frequencies < 11025)
        powers, hz = spectrum[audible], frequencies[audible]
        total = powers.sum() + 1e-12
        rms = np.sqrt(np.mean(post ** 2))
        rows.append([
            np.log1p(100 * rms), np.max(abs(post)) / (rms + 1e-8),
            (np.mean(post[1:] * post[:-1] < 0) * sample_rate / 22050 if len(post) > 1 else 0),
            np.sum(hz * powers) / total / 11025,
            (np.exp(np.mean(np.log(powers + 1e-12))) / (np.mean(powers) + 1e-12) if len(powers) else 0),
            (np.max(powers) / total if len(powers) else 0),
            *np.log1p(10000 * bands), *(bands / (bands.sum() + 1e-12)),
            *np.log((bands + 1e-9) / (prior + 1e-9)),
            *np.log((later + 1e-9) / (bands + 1e-9)),
            *(np.maximum(0, bands - prior) / (bands + prior + 1e-9)),
            *contrast[index],
        ])
        times.append(start / sample_rate)
    return np.array(times), np.array(rows, dtype=np.float64).reshape(-1, len(FEATURE_NAMES))
