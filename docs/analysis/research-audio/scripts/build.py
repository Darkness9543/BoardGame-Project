"""Render the game's sound cues from downloaded CC0 sources.

usage: python -I build.py RECIPE.txt DOWNLOAD_ROOT PAGES_ROOT OUT_DIR

RECIPE.txt is a Python literal (read with ast.literal_eval, never executed).
DOWNLOAD_ROOT holds the extracted packs (treated as data: decoded with ffmpeg only).
Writes OUT_DIR/game/<cue>[-n].ogg|.mp3, OUT_DIR/alt/<cue>__altK.mp3 and OUT_DIR/report.json.
"""
import ast
import json
import os
import subprocess
import sys
from fractions import Fraction

import numpy as np
from scipy.signal import butter, lfilter, resample_poly, sosfilt

SR = 44100
PEAK_DBFS = -3.0

ARGS = sys.argv[1:]
RECIPE, DL, PAGES, OUT = ARGS[0], ARGS[1], ARGS[2], ARGS[3]

KZIP = "https://kenney.nl/media/pages/assets/"
PACKS = {
    "KIMP": ("Kenney - Impact Sounds 1.0", "https://kenney.nl/assets/impact-sounds", KZIP + "impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
             "kenney-impact-sounds/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "KUI": ("Kenney - UI Audio 1.0", "https://kenney.nl/assets/ui-audio", KZIP + "ui-audio/490d233f68-1677590494/kenney_ui-audio.zip",
            "kenney-ui-audio/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "KIF": ("Kenney - Interface Sounds 1.0", "https://kenney.nl/assets/interface-sounds", KZIP + "interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
            "kenney-interface-sounds/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "KRPG": ("Kenney - RPG Audio 1.0", "https://kenney.nl/assets/rpg-audio", KZIP + "rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
             "kenney-rpg-audio/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "KCAS": ("Kenney - Casino Audio 1.1", "https://kenney.nl/assets/casino-audio", KZIP + "casino-audio/2472606a04-1721639069/kenney_casino-audio.zip",
             "kenney-casino-audio/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "KJIN": ("Kenney - Music Jingles 1.0", "https://kenney.nl/assets/music-jingles", KZIP + "music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip",
             "kenney-music-jingles/x/Audio/{n}.ogg", "Audio/{n}.ogg", "Kenney (www.kenney.nl)"),
    "RDMW": ("rubberduck - 100 CC0 metal and wood SFX", "https://opengameart.org/content/100-cc0-metal-and-wood-sfx", "https://opengameart.org/sites/default/files/100-CC0-wood-metal-SFX.zip",
             "oga-rubberduck-metal-wood/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "RDBF": ("rubberduck - 75 CC0 breaking / falling / hit sfx", "https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx", "https://opengameart.org/sites/default/files/sfx_breaking_and_falling.zip",
             "oga-rubberduck-breaking-falling/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "RDRPG": ("rubberduck - 80 CC0 RPG SFX", "https://opengameart.org/content/80-cc0-rpg-sfx", "https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip",
              "oga-rubberduck-rpg/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "RD100": ("rubberduck - 100 CC0 SFX", "https://opengameart.org/content/100-cc0-sfx", "https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip",
              "oga-rubberduck-100/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "RDW": ("rubberduck - 40 CC0 water / splash / slime SFX", "https://opengameart.org/content/40-cc0-water-splash-slime-sfx", "https://opengameart.org/sites/default/files/water-splash-slime-sfx.zip",
            "oga-rubberduck-water/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "RDBANG": ("rubberduck - 25 CC0 bang / firework SFX", "https://opengameart.org/content/25-cc0-bang-firework-sfx", "https://opengameart.org/sites/default/files/25-CC0-bang-sfx.zip",
               "oga-rubberduck-bang/x/{n}.ogg", "{n}.ogg", "rubberduck (OpenGameArt)"),
    "ADRPG": ("artisticdude - RPG Sound Pack", "https://opengameart.org/content/rpg-sound-pack", "https://opengameart.org/sites/default/files/rpg_sound_pack.zip",
              "oga-artisticdude-rpg/x/RPG Sound Pack/{n}.wav", "RPG Sound Pack/{n}.wav", "artisticdude (OpenGameArt)"),
    "ADSW": ("artisticdude - Swishes Sound Pack", "https://opengameart.org/content/swishes-sound-pack", "https://opengameart.org/sites/default/files/swishes.zip",
             "oga-artisticdude-swishes/x/swishes/{n}.wav", "swishes/{n}.wav", "artisticdude (OpenGameArt)"),
}
FS_META = json.load(open(os.path.join(PAGES, "fs", "verified.json"), encoding="utf-8"))
BSB_META = json.load(open(os.path.join(PAGES, "bsb", "verified.json"), encoding="utf-8"))
FS_INDEX = json.load(open(os.path.join(PAGES, "fs", "index.json"), encoding="utf-8"))


def source_info(key):
    kind, name = key.split(":", 1)
    if kind == "FS":
        m = FS_META[name]
        lq = FS_INDEX[name]["ogg_lq"]
        return dict(key=key, path=os.path.join(DL, "freesound", f"fs_{name}.ogg"), pack="Freesound",
                    title=m["title"], author=m["author"], page=m["page"], url=lq.replace("-lq.ogg", "-hq.ogg"),
                    member=None, license="CC0-1.0", license_url=m["license_url"], note="Freesound HQ OGG preview (the original needs a login)")
    if kind == "BSB":
        m = BSB_META[name]
        return dict(key=key, path=os.path.join(DL, "bigsoundbank", f"bsb_{name}.ogg"), pack="BigSoundBank",
                    title=f"{m['title']} (#{name})", author=m["author"], page=m["page"], url=m["ogg"], member=None,
                    license="CC0-1.0", license_url="https://bigsoundbank.com/licenses.html", note="BigSoundBank OGG download")
    pack, page, zipurl, local, member, author = PACKS[kind]
    return dict(key=key, path=os.path.join(DL, local.format(n=name)), pack=pack, title=name.split("/")[-1], author=author,
                page=page, url=zipurl, member=member.format(n=name), license="CC0-1.0",
                license_url="https://creativecommons.org/publicdomain/zero/1.0/", note="from the pack zip")


_cache = {}


def decode(path, stereo):
    k = (path, stereo)
    if k not in _cache:
        ch = 2 if stereo else 1
        p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        x = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
        _cache[k] = x.reshape(-1, ch)
    return _cache[k]


def channels(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels", "-of", "csv=p=0", path],
                         stdout=subprocess.PIPE, text=True).stdout.strip()
    try:
        return int(out.split(",")[0])
    except ValueError:
        return 1


def fade(x, fi, fo):
    n = len(x)
    a = min(n, int(fi * SR))
    b = min(n, int(fo * SR))
    if a > 0:
        x[:a] *= (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a)))[:, None]
    if b > 0:
        x[n - b:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b)))[:, None]
    return x


def render_layer(L, stereo):
    info = source_info(L["src"])
    x = decode(info["path"], stereo)
    s = int(L.get("start", 0.0) * SR)
    e = len(x) if "dur" not in L else min(len(x), s + int(L["dur"] * SR))
    y = x[s:e].copy()
    if L.get("rev"):
        y = y[::-1].copy()
    st = L.get("pitch", 0)
    if st:
        r = Fraction(2 ** (-st / 12.0)).limit_denominator(400)
        y = resample_poly(y, r.numerator, r.denominator, axis=0)
    if "hp" in L:
        y = sosfilt(butter(2, L["hp"], "highpass", fs=SR, output="sos"), y, axis=0)
    if "lp" in L:
        y = sosfilt(butter(2, L["lp"], "lowpass", fs=SR, output="sos"), y, axis=0)
    pk = np.abs(y).max() if len(y) else 0
    if pk > 0:
        y = y / pk
    if L.get("drive"):
        g = 10 ** (L["drive"] / 20.0)
        y = np.tanh(y * g) / np.tanh(g)
    y = fade(y, L.get("fi", 0.003), L.get("fo", 0.01))
    y *= 10 ** (L.get("gain", 0.0) / 20.0)
    d = int(L.get("delay", 0.0) * SR)
    if d:
        y = np.vstack([np.zeros((d, y.shape[1])), y])
    return y, info


def gate(y, rel_db, ratio=2.0):
    mono = np.sqrt(np.mean(y ** 2, axis=1))
    n = int(0.005 * SR)
    k = max(1, len(mono) // n)
    env = np.sqrt(np.mean(mono[:k * n].reshape(k, n) ** 2, axis=1)) + 1e-12
    env = np.convolve(env, np.ones(4) / 4, mode="same")
    edb = 20 * np.log10(env)
    thr = edb.max() + rel_db
    gdb = np.where(edb < thr, (edb - thr) * (ratio - 1.0), 0.0)
    g = 10 ** (gdb / 20.0)
    gs = np.repeat(g, n)
    gs = np.concatenate([gs, np.full(len(y) - len(gs), gs[-1] if len(gs) else 1.0)])
    gs, _ = lfilter([0.02], [1, -0.98], gs, zi=[0.98 * gs[0]])  # one-pole smoothing (~1 ms), starts settled
    return y * gs[:, None]


def limit(y, amount_db, release=0.04):
    """Peak limiter: pull the loudest transients down by amount_db (lookahead 2.5 ms, release ~40 ms)."""
    from scipy.ndimage import maximum_filter1d
    a = np.abs(y).max(axis=1)
    env = maximum_filter1d(a, size=int(0.005 * SR), mode="nearest")
    thr = a.max() * 10 ** (-amount_db / 20.0)
    g = np.minimum(1.0, thr / np.maximum(env, 1e-12))
    r = np.exp(-1.0 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):  # instant attack, exponential release
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * r
        out[i] = cur
    return y * out[:, None]


def loopify(y, length, xf):
    L, X = int(length * SR), int(xf * SR)
    if len(y) < L + X:
        raise ValueError("loop source too short")
    t = np.linspace(0, np.pi / 2, X)[:, None]
    out = y[:L].copy()
    out[:X] = y[:X] * np.sin(t) + y[L:L + X] * np.cos(t)
    return out


def render(cue, layers, loop=None):
    stereo = bool(cue.get("stereo"))
    if stereo:
        stereo = any(channels(source_info(L["src"])["path"]) >= 2 for L in layers)
    parts, infos = [], []
    for L in layers:
        y, info = render_layer(L, stereo)
        parts.append(y)
        infos.append(info)
    n = max(len(p) for p in parts)
    mix = np.zeros((n, parts[0].shape[1]))
    for p in parts:
        mix[:len(p)] += p
    if cue.get("gate") is not None:
        mix = gate(mix, cue["gate"])
    if cue.get("limit"):
        mix = limit(mix, cue["limit"])
    if loop:
        mix = loopify(mix, loop["len"], loop["xfade"])
    else:
        pk = np.abs(mix).max()
        thr = pk * 10 ** (-55 / 20.0)
        idx = np.nonzero(np.abs(mix).max(axis=1) > thr)[0]
        end = min(len(mix), idx[-1] + int(0.03 * SR)) if len(idx) else len(mix)
        mix = fade(mix[:end].copy(), 0.0, 0.02)
    pk = np.abs(mix).max()
    mix *= 10 ** (PEAK_DBFS / 20.0) / pk
    return mix.astype(np.float32), infos, stereo


def encode(mix, path, fmt, title, comment, q=None):
    ch = mix.shape[1]
    if fmt == "ogg":
        codec = ["-c:a", "libvorbis", "-q:a", str(q if q is not None else 4)]
    else:
        codec = ["-c:a", "libmp3lame", "-q:a", str(q if q is not None else 2), "-cutoff", "19000"]
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "pipe:0",
           "-metadata", f"title={title}", "-metadata", f"comment={comment}"] + codec + [path]
    subprocess.run(cmd, input=mix.tobytes(), check=True)


# K-weighting (ITU-R BS.1770) at 48 kHz
KB1, KA1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
KB2, KA2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def measure(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ar", "48000", "-"], stdout=subprocess.PIPE, check=True)
    ch = channels(path)
    x = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64).reshape(-1, ch)
    peak = 20 * np.log10(np.abs(x).max() + 1e-12)
    y = lfilter(KB2, KA2, lfilter(KB1, KA1, x, axis=0), axis=0)
    w, hop = 19200, 4800
    if len(y) < w:
        y = np.vstack([y, np.zeros((w - len(y), ch))])
    ms = [np.sum(np.mean(y[i:i + w] ** 2, axis=0)) for i in range(0, len(y) - w + 1, hop)]
    mmax = -0.691 + 10 * np.log10(max(ms) + 1e-12)
    w2, hop2 = 4800, 1200  # 100 ms 'punch' loudness, closer to how short SFX are heard
    ps = [np.sum(np.mean(y[i:i + w2] ** 2, axis=0)) for i in range(0, len(y) - w2 + 1, hop2)]
    pmax = -0.691 + 10 * np.log10(max(ps) + 1e-12)
    # integrated (ungated) for loops
    integ = -0.691 + 10 * np.log10(np.sum(np.mean(y ** 2, axis=0)) + 1e-12)
    return dict(duration=round(len(x) / 48000.0, 3), peak_dbfs=round(float(peak), 2), mmax_lufs=round(float(mmax), 1), pmax_lufs=round(float(pmax), 1),
                integrated_lufs=round(float(integ), 1), bytes=os.path.getsize(path), channels=ch)


def main():
    recipe = ast.literal_eval(open(RECIPE, encoding="utf-8").read())
    os.makedirs(os.path.join(OUT, "game"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "alt"), exist_ok=True)
    report = []
    for cue in recipe["cues"]:
        cid = cue["id"]
        variants = cue["variants"]
        entry = dict(id=cid, cat=cue["cat"], target=cue["target"], why=cue["why"], extra=bool(cue.get("extra")),
                     loop=cue.get("loop"), files=[], contenders=[])
        for i, v in enumerate(variants):
            base = cid if len(variants) == 1 else f"{cid}-{i + 1}"
            mix, infos, st = render(cue, v["layers"], cue.get("loop"))
            comment = "CC0-1.0. Sources: " + "; ".join(f"{s['title']} by {s['author']} ({s['page']})" for s in infos)
            fo = os.path.join(OUT, "game", base + ".ogg")
            fm = os.path.join(OUT, "game", base + ".mp3")
            encode(mix, fo, "ogg", cid, comment)
            mo = measure(fo)
            if abs(mo["peak_dbfs"] - PEAK_DBFS) > 0.3:  # codec moved the peak: correct once and re-encode
                mix = (mix * 10 ** ((PEAK_DBFS - mo["peak_dbfs"]) / 20.0)).astype(np.float32)
                encode(mix, fo, "ogg", cid, comment)
                mo = measure(fo)
            encode(mix, fm, "mp3", cid, comment, q=cue.get("mp3q"))
            mm = measure(fm)
            entry["files"].append(dict(base=base, ogg=mo, mp3=mm, stereo=st, layers=v["layers"],
                                       sources=[{k: s[k] for k in ("key", "pack", "title", "author", "page", "url", "member", "license", "license_url", "note")} for s in infos]))
            print(f"{base:28s} {mo['duration']:6.2f}s pk {mo['peak_dbfs']:6.2f} mp3pk {mm['peak_dbfs']:6.2f} M {mo['mmax_lufs']:6.1f} P {mo['pmax_lufs']:6.1f} ogg {mo['bytes']:7d} mp3 {mm['bytes']:7d}")
        for k, c in enumerate(cue.get("contenders", [])):
            mix, infos, st = render(cue, c["layers"], c.get("loop"))
            fm = os.path.join(OUT, "alt", f"{cid}__alt{k + 1}.mp3")
            encode(mix, fm, "mp3", f"{cid} contender {k + 1}", "CC0-1.0 contender", q=5)
            mm = measure(fm)
            entry["contenders"].append(dict(label=c["label"], why=c["why"], file=os.path.basename(fm), mp3=mm, layers=c["layers"],
                                            sources=[{k2: s[k2] for k2 in ("key", "pack", "title", "author", "page", "url", "member", "license")} for s in infos]))
        # gain from loudness (louder files get lower gain), averaged across variations
        mm_avg = float(np.mean([f["ogg"]["pmax_lufs"] if not cue.get("loop") else f["ogg"]["integrated_lufs"] for f in entry["files"]]))
        gain = 10 ** ((cue["target"] - mm_avg) / 20.0)
        entry["gain"] = round(float(min(1.0, max(0.05, gain))), 2)
        entry["measured_lufs"] = round(mm_avg, 1)
        report.append(entry)
    json.dump(report, open(os.path.join(OUT, "report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("cues", len(report))


main()
