"""Find sustained segments (smoothed envelope above peak-REL dB).
usage: python -I segments.py FILE [REL_DB] [SMOOTH_S] [START END]"""
import subprocess, sys
import numpy as np
SR = 48000
p = sys.argv[1]
rel = float(sys.argv[2]) if len(sys.argv) > 2 else 10
sm = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05
cmd = ["ffmpeg", "-v", "error"]
s0 = 0.0
if len(sys.argv) > 5:
    s0 = float(sys.argv[4]); cmd += ["-ss", sys.argv[4], "-t", str(float(sys.argv[5]) - s0)]
cmd += ["-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
x = np.frombuffer(subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout, dtype=np.float32).astype(np.float64)
n = int(0.005 * SR)
k = len(x) // n
e = np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1))
w = max(1, int(sm / 0.005))
es = np.convolve(e, np.ones(w) / w, mode="same")
d = 20 * np.log10(es + 1e-9)
pk = d.max()
on = d > pk - rel
i = 0
while i < k:
    if on[i]:
        j = i
        while j < k and on[j]:
            j += 1
        if (j - i) * 0.005 >= 0.05:
            m = i + int(np.argmax(d[i:j]))
            print(f"seg {s0 + i * 0.005:7.3f}-{s0 + j * 0.005:7.3f}  len {(j - i) * 0.005:.3f}  max {d[m]:6.1f} dB at {s0 + m * 0.005:7.3f}")
        i = j
    else:
        i += 1
print(f"peak {pk:.1f} dB, noise floor (10th pct) {np.percentile(d, 10):.1f} dB")
