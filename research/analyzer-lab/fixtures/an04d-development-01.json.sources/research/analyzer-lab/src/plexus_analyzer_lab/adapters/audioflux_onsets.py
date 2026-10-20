"""Optional audioFlux package adapter on original float32 PCM; no implicit install."""
import hashlib
import os
from pathlib import Path
import sys

import numpy as np


def load_audioflux(runtime_root):
    runtime_root = Path(runtime_root).resolve()
    if not (runtime_root / 'audioflux').is_dir():
        raise FileNotFoundError('Explicit audioFlux runtime required')
    os.environ.setdefault('MPLCONFIGDIR', str(runtime_root / '.mpl-config'))
    os.environ.setdefault('MPLBACKEND', 'Agg')
    if str(runtime_root) not in sys.path:
        sys.path.insert(0, str(runtime_root))
    import audioflux as af
    if af.__version__ != '0.1.9' or not Path(af.__file__).resolve().is_relative_to(runtime_root):
        raise ValueError('Expected isolated audioFlux 0.1.9')
    return af


def analyze_onsets(samples, sample_rate, runtime_root, *, n_fft=2048, hop=512):
    if samples.dtype != np.float32 or samples.ndim != 1 or not len(samples) or not np.isfinite(samples).all():
        raise ValueError('Nonempty finite mono float32 PCM required')
    if not isinstance(sample_rate, int) or not 1000 <= sample_rate <= 384000:
        raise ValueError('Invalid original sample clock')
    if not isinstance(n_fft, int) or not 16 <= n_fft <= 65536 or n_fft & (n_fft - 1):
        raise ValueError('FFT length must be a supported power of two')
    if not isinstance(hop, int) or not 1 <= hop <= n_fft:
        raise ValueError('Invalid declared hop')
    af = load_audioflux(runtime_root)
    stft = af.STFT(radix2_exp=int(np.log2(n_fft)), window_type=af.type.WindowType.HANN, slide_length=hop)
    stft.enable_padding(True)
    stft.set_padding(position_type=af.type.PaddingPositionType.CENTER,
                     mode_type=af.type.PaddingModeType.CONSTANT, value1=0, value2=0)
    spectrum = stft.stft(np.ascontiguousarray(samples))
    detector = af.Onset(spectrum.shape[1], spectrum.shape[0], hop, samplate=sample_rate,
                        filter_order=1, novelty_type=af.type.NoveltyType.FLUX)
    params = af.NoveltyParam(1, 1, 1, 0, 1, 0, 1, 1)
    points, envelope, times, values = detector.onset(np.abs(spectrum), novelty_param=params)
    duration = len(samples) / sample_rate
    valid = [float(t) for t in times if 0 <= t < duration]
    from audioflux.fftlib import get_fft_lib_fp
    binary = Path(get_fft_lib_fp())
    return {'events': [{'time': t, 'class': 'onset', 'confidence': None} for t in valid],
            'provider': 'audioflux', 'version': af.__version__,
            'pcmSha256': hashlib.sha256(samples.astype('<f4', copy=False).tobytes()).hexdigest(),
            'nativeBinarySha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
            'parameters': {'sampleRate': sample_rate, 'nFft': n_fft, 'hopLength': hop,
                           'window': 'HANN', 'padding': 'center-constant-zero',
                           'spectrum': 'linear-magnitude', 'novelty': 'FLUX', 'filterOrder': 1,
                           'noveltyParam': [1, 1, 1, 0, 1, 0, 1, 1],
                           'timestamp': 'library frame index times hop/sampleRate', 'timestampCorrection': 0}}
