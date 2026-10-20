"""Actual pinned YIN/NCF inference on original PCM; agreement is not musical truth."""
import hashlib
import inspect
import math
from pathlib import Path

import numpy as np

from .audioflux_onsets import load_audioflux


def pair_frequencies(left, right, tolerance_cents=25):
    """Both votes must exist; absence is unknown. No fallback, correction or averaging first."""
    if tolerance_cents != 25:
        raise ValueError('Frozen pitch agreement tolerance is 25 cents')
    if left is None or right is None:
        return None
    if not all(isinstance(v, (int, float)) and math.isfinite(v) and 80 <= v <= 1000 for v in (left, right)):
        raise ValueError('Invalid finite in-range pitch vote')
    disagreement = abs(1200 * math.log2(left / right))
    if disagreement > tolerance_cents:
        return None
    return {'votes': [{'provider': 'librosa-yin', 'frequencyHz': left},
                      {'provider': 'audioflux-ncf', 'frequencyHz': right}],
            'disagreementCents': disagreement, 'geometricMeanHz': math.sqrt(left * right),
            'evidenceType': 'pseudo_label', 'acceptance': 'two-library-agreement',
            'confidence': None, 'groundTruthStatus': False}


def analyze_pitch_pair(samples, sample_rate, runtime_root):
    import librosa
    if librosa.__version__ != '0.11.0':
        raise ValueError('Pinned librosa 0.11.0 required')
    if samples.dtype != np.float32 or samples.ndim != 1 or not len(samples) or not np.isfinite(samples).all():
        raise ValueError('Nonempty finite mono float32 PCM required')
    if not isinstance(sample_rate, int) or not 8000 <= sample_rate <= 96000:
        raise ValueError('Unsupported original pitch clock')
    n_fft = 2 ** math.ceil(math.log2(.08 * sample_rate))
    hop = math.floor(.02 * sample_rate + .5)
    expected = max(0, 1 + (len(samples) - n_fft) // hop)
    max_lag = sample_rate // 80
    if expected > 4096 or expected * (max_lag + 1) * (n_fft - max_lag - 1) > 350000000:
        raise ValueError('Pitch work budget exceeded')
    if not expected:
        raise ValueError('Actual provider comparison requires complete frames')
    af = load_audioflux(runtime_root)
    before = hashlib.sha256(samples.astype('<f4', copy=False).tobytes()).hexdigest()
    yin = librosa.yin(samples, sr=sample_rate, fmin=80, fmax=1000, frame_length=n_fft,
                      hop_length=hop, trough_threshold=.15, center=False)
    ncf = af.PitchNCF(samplate=sample_rate, low_fre=80, high_fre=1000,
                      radix2_exp=int(math.log2(n_fft)), slide_length=hop, window_type=af.type.WindowType.RECT)
    frequencies = ncf.pitch(np.ascontiguousarray(samples))
    if len(yin) != expected or len(frequencies) != expected:
        raise ValueError('Native provider frame/support mismatch; no trimming allowed')
    if hashlib.sha256(samples.astype('<f4', copy=False).tobytes()).hexdigest() != before:
        raise ValueError('Provider mutated input PCM')
    raw_yin = [float(v) if math.isfinite(float(v)) else None for v in yin]
    raw_ncf = [float(v) if math.isfinite(float(v)) else None for v in frequencies]
    pairs = []
    for i, (a, b) in enumerate(zip(raw_yin, raw_ncf)):
        # Unsupported/out-of-range votes remain visible in the raw arrays, not eligible references.
        pair = pair_frequencies(a if a is not None and 80 <= a <= 1000 else None,
                                b if b is not None and 80 <= b <= 1000 else None)
        if pair:
            pairs.append({'frameIndex': i, 'supportStartSample': i * hop,
                          'supportEndSample': i * hop + n_fft, **pair})
    from audioflux.fftlib import get_fft_lib_fp
    native = Path(get_fft_lib_fp())
    sources = [Path(inspect.getfile(librosa.yin)), Path(inspect.getfile(af.PitchNCF))]
    return {'providerVersions': {'librosa-yin': librosa.__version__, 'audioflux-ncf': af.__version__},
            'parameters': {'frameLength': n_fft, 'hopLength': hop, 'rangeHz': [80, 1000],
                           'centering': False, 'padding': False, 'timestampCorrection': 0,
                           'librosaTroughThreshold': .15, 'ncfWindow': 'RECT', 'toleranceCents': 25},
            'pcmSha256': before, 'raw': {'librosa-yin': raw_yin, 'audioflux-ncf': raw_ncf}, 'pairs': pairs,
            'nativeBinary': {'path': str(native), 'sha256': hashlib.sha256(native.read_bytes()).hexdigest()},
            'sources': [{'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources]}
