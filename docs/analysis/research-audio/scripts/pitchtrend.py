"""Rough pitch contour: dominant spectral peak (80-2000 Hz) per note-ish segment.
usage: python -I pitchtrend.py FILE..."""
import glob, subprocess, sys
import numpy as np
SR = 22050
def decode(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], stdout=subprocess.PIPE, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
paths = []
for a in sys.argv[1:]:
    paths.extend(sorted(glob.glob(a)) or [a])
for p in paths:
    x = decode(p)
    frame, hop = 2048, 512
    f = np.fft.rfftfreq(frame, 1 / SR)
    band = (f > 80) & (f < 2000)
    pk = []
    for i in range(0, len(x) - frame, hop):
        seg = x[i:i + frame] * np.hanning(frame)
        e = np.sqrt(np.mean(seg ** 2))
        if e < 0.01:
            continue
        S = np.abs(np.fft.rfft(seg))[band]
        pk.append(f[band][np.argmax(S)])
    if len(pk) < 4:
        print(p.split('/')[-1], 'n/a'); continue
    pk = np.array(pk)
    n = len(pk)
    a, b = np.median(pk[: max(1, n // 3)]), np.median(pk[-max(1, n // 3):])
    semis = 12 * np.log2(b / a)
    print(f"{p.split('/')[-1]:24s} start {a:7.1f} Hz end {b:7.1f} Hz  trend {semis:+5.1f} st  path {' '.join(str(int(v)) for v in pk[::max(1, n // 8)])}")
