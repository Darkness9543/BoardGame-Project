"""Draw stacked envelope+spectrogram strips for audio files (PIL only).
usage: python -I plot.py OUT.png [--width W] FILE[@start:end] ...
Each strip: label, dB envelope (-60..0 dBFS, grid every 12 dB) over a log-frequency
spectrogram (60 Hz..16 kHz); vertical grid every 0.1 s (thin) / 0.5 s (thick) with labels."""
import subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
SR = 44100
def decode(path, start=None, end=None):
    cmd = ["ffmpeg", "-v", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)] if start is None else ["-t", str(end - start)]
    cmd += ["-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
def main():
    args = sys.argv[1:]
    out = args.pop(0)
    W = 1400
    if args and args[0] == "--width":
        W = int(args[1]); args = args[2:]
    H_ENV, H_SPEC, H_LAB = 70, 90, 16
    rows = []
    for a in args:
        path, rng = (a.rsplit("@", 1) + [None])[:2] if "@" in a and a.rsplit("@", 1)[1].replace(":", "").replace(".", "").isdigit() else (a, None)
        s0 = e0 = None
        if rng:
            s0, e0 = [float(v) for v in rng.split(":")]
        x = decode(path, s0, e0)
        rows.append((path, s0 or 0.0, x))
    img = Image.new("RGB", (W, len(rows) * (H_ENV + H_SPEC + H_LAB + 6)), (16, 18, 22))
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    y = 0
    for path, t0, x in rows:
        dur = max(len(x) / SR, 1e-3)
        name = path.replace("\\", "/").split("/")[-1]
        d.text((4, y + 2), f"{name}  t0={t0:.2f}s  dur={dur:.2f}s", fill=(230, 230, 230), font=font)
        y += H_LAB
        # envelope
        n = max(1, int(len(x) / W))
        cols = min(W, max(1, len(x) // n))
        env = np.sqrt(np.mean(x[:cols * n].reshape(cols, n) ** 2, axis=1)) if len(x) >= n else np.array([0.0])
        pk = np.max(np.abs(x[:cols * n].reshape(cols, n)), axis=1) if len(x) >= n else np.array([0.0])
        ex = W / cols
        for k in range(0, 61, 12):
            yy = y + int(k / 60 * H_ENV)
            d.line([(0, yy), (W, yy)], fill=(40, 44, 52))
        for i in range(cols):
            for v, col in ((pk[i], (90, 140, 200)), (env[i], (240, 200, 90))):
                dbv = 20 * np.log10(max(v, 1e-6))
                hh = int(np.clip((dbv + 60) / 60, 0, 1) * H_ENV)
                d.line([(int(i * ex), y + H_ENV), (int(i * ex), y + H_ENV - hh)], fill=col)
        # spectrogram
        ys = y + H_ENV
        frame = 1024
        hop = max(1, int(len(x) / W))
        F = np.fft.rfftfreq(frame, 1 / SR)
        fmin, fmax = 60, 16000
        bins = np.geomspace(fmin, fmax, H_SPEC + 1)
        spec = np.zeros((H_SPEC, W))
        win = np.hanning(frame)
        for i in range(W):
            c = int(i * len(x) / W)
            seg = x[c:c + frame]
            if len(seg) < frame:
                seg = np.pad(seg, (0, frame - len(seg)))
            P = np.abs(np.fft.rfft(seg * win)) ** 2
            for b in range(H_SPEC):
                m = (F >= bins[b]) & (F < bins[b + 1])
                spec[H_SPEC - 1 - b, i] = P[m].mean() if m.any() else 0
        sd = 10 * np.log10(spec + 1e-12)
        top = sd.max()
        norm = np.clip((sd - (top - 70)) / 70, 0, 1)
        rgb = np.stack([norm ** 0.8 * 255, norm ** 1.6 * 220, (1 - norm) * norm * 4 * 160], axis=-1).astype(np.uint8)
        img.paste(Image.fromarray(rgb, "RGB"), (0, ys))
        # time grid
        step = 0.1 if dur <= 4 else (0.5 if dur <= 20 else 1.0)
        t = 0.0
        while t <= dur + 1e-9:
            xx = int(t / dur * W)
            thick = abs((t / (step * 5)) - round(t / (step * 5))) < 1e-6
            d.line([(xx, y), (xx, ys + H_SPEC)], fill=(200, 200, 200) if thick else (70, 70, 80))
            if thick:
                d.text((xx + 2, ys + H_SPEC - 12), f"{t0 + t:.1f}", fill=(255, 255, 255), font=font)
            t = round(t + step, 6)
        y = ys + H_SPEC + 6
    img.save(out)
    print("wrote", out, img.size)
main()
