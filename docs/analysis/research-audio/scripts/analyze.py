"""Acoustic summary of audio files (decoded with ffmpeg; files are data, never executed).
usage: python -I analyze.py [--events] [--json OUT] FILE...
Per file: duration, peak dBFS, RMS dBFS, onset (s), tail end at -40 dB re peak,
spectral centroid (Hz), spectral flatness (0 tonal .. 1 noise), low/mid/high energy share,
and with --events the separate transient events (start-end, peak)."""
import glob, json, subprocess, sys
import numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SR = 48000
def decode(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
def db(x):
    return 20 * np.log10(max(float(x), 1e-12))
def envelope(x, win=0.005):
    n = max(1, int(SR * win))
    k = len(x) // n
    if k == 0:
        return np.array([np.sqrt(np.mean(x ** 2))]), n
    e = np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1))
    return e, n
def spectral(x):
    if len(x) < 2048:
        x = np.pad(x, (0, 2048 - len(x)))
    frame, hop = 2048, 1024
    w = np.hanning(frame)
    frames = [x[i:i + frame] * w for i in range(0, len(x) - frame + 1, hop)]
    S = np.abs(np.fft.rfft(np.array(frames), axis=1)) ** 2
    f = np.fft.rfftfreq(frame, 1 / SR)
    en = S.sum(axis=1)
    keep = en > en.max() * 1e-3
    S = S[keep]
    P = S.sum(axis=0)
    cen = float((P * f).sum() / max(P.sum(), 1e-20))
    band = (f >= 100) & (f <= 12000)
    Sb = S[:, band]
    flat = np.exp(np.mean(np.log(Sb + 1e-20), axis=1)) / (np.mean(Sb, axis=1) + 1e-20)
    tot = P.sum() + 1e-20
    low = P[f < 250].sum() / tot
    mid = P[(f >= 250) & (f < 2500)].sum() / tot
    high = P[f >= 2500].sum() / tot
    return cen, float(np.median(flat)), float(low), float(mid), float(high)
def events(e, n, peak, rel_db=-30.0, gap=0.06, min_len=0.02):
    thr = peak * 10 ** (rel_db / 20)
    on = e > thr
    out, i, L = [], 0, len(e)
    hop = n / SR
    while i < L:
        if on[i]:
            j = i
            last = i
            while j < L and (on[j] or (j - last) * hop < gap):
                if on[j]:
                    last = j
                j += 1
            s, t = i * hop, (last + 1) * hop
            if t - s >= min_len:
                out.append((round(s, 3), round(t, 3), round(db(e[i:last + 1].max()), 1)))
            i = j
        else:
            i += 1
    return out
def main():
    args = sys.argv[1:]
    want_ev = "--events" in args
    out_json = None
    if "--json" in args:
        k = args.index("--json"); out_json = args[k + 1]; del args[k:k + 2]
    args = [a for a in args if a != "--events"]
    res = []
    paths = []
    for a in args:
        g = sorted(glob.glob(a))
        paths.extend(g if g else [a])
    for path in paths:
        try:
            x = decode(path)
        except Exception as ex:
            print(f"{path}: decode error {ex}"); continue
        dur = len(x) / SR
        pk = np.abs(x).max() if len(x) else 0
        e, n = envelope(x)
        epk = e.max() if len(e) else 0
        thr = epk * 10 ** (-40 / 20)
        idx = np.nonzero(e > thr)[0]
        onset = idx[0] * n / SR if len(idx) else 0
        tail = (idx[-1] + 1) * n / SR if len(idx) else 0
        cen, flat, lo, mi, hi = spectral(x[int(onset * SR):int(tail * SR)] if tail > onset else x)
        r = dict(file=path, dur=round(dur, 3), peak_db=round(db(pk), 1), rms_db=round(db(np.sqrt(np.mean(x ** 2)) if len(x) else 0), 1),
                 onset=round(onset, 3), tail=round(tail, 3), centroid=int(cen), flatness=round(flat, 3),
                 low=round(lo, 2), mid=round(mi, 2), high=round(hi, 2))
        if want_ev:
            r["events"] = events(e, n, epk)
        res.append(r)
        name = path.replace("\\", "/").split("/")[-1]
        line = f"{name[:44]:44s} dur {dur:6.2f} pk {r['peak_db']:6.1f} on {onset:5.2f} tail {tail:6.2f} cen {int(cen):5d} flat {flat:.2f} L/M/H {lo:.2f}/{mi:.2f}/{hi:.2f}"
        if want_ev:
            ev = r["events"]
            line += f" ev {len(ev)}: " + " ".join(f"[{a:.2f}-{b:.2f} {p:.0f}]" for a, b, p in ev[:8])
        print(line)
    if out_json:
        json.dump(res, open(out_json, "w", encoding="utf-8"), indent=1)
main()
