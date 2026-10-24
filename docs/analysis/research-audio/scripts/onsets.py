"""List transient onsets (sharp rises) in a file window.
usage: python -I onsets.py FILE START END [RISE_DB]"""
import subprocess, sys
import numpy as np
SR = 48000
p, s0, s1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
rise = float(sys.argv[4]) if len(sys.argv) > 4 else 12.0
r = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(s0), "-t", str(s1 - s0), "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], stdout=subprocess.PIPE, check=True)
x = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
n = int(0.002 * SR)
k = len(x) // n
e = np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1)) + 1e-9
d = 20 * np.log10(e)
pk = d.max()
out = []
last = -1
for i in range(10, k):
    base = d[max(0, i - 10):i - 2].mean()
    if d[i] - base > rise and d[i] > pk - 30 and (last < 0 or i - last > 40):
        j = i + int(0.6 / 0.002)
        seg = d[i:j]
        # decay time to -20 dB below local peak
        lp = seg[:50].max()
        below = np.nonzero(seg < lp - 20)[0]
        dec = (below[below > 5][0] * 0.002) if len(below[below > 5]) else 0.6
        out.append((round(s0 + i * 0.002, 3), round(lp, 1), round(dec, 3)))
        last = i
for t, l, dc in out:
    print(f"onset {t:8.3f}s  peak {l:6.1f} dB  decay-20dB {dc:.3f}s")
