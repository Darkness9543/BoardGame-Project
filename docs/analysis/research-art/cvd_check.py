"""Colour-vision-deficiency check for token grade palettes (research-art.md, appendix B).

Usage:  python cvd_check.py input.json [output.json]
input.json = {"PaletteName": {"1": "#RRGGBB", "2": "#RRGGBB", ..., "100": "#RRGGBB"}, ...}

For every palette it prints, per grade: hex, CIELAB L*, best icon ink (#1B1410 or #FFF8E7, WCAG contrast)
and simulated colours (deuteranopia / protanopia / tritanopia, Machado et al. 2009, severity 1.0, and
greyscale); then the minimum pairwise CIEDE2000 distance per vision type and the three worst pairs.
Rule of thumb used in the doc: min dE00 >= 12 under every simulation is "OK for small tokens";
< 10 means the pair needs a non-colour cue.
"""
import json, math, sys, itertools
sys.stdout.reconfigure(encoding='utf-8')
# --- color math -------------------------------------------------------------
def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))
def rgb2hex(c):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(v*255))) for v in c)
def s2l(v): return v/12.92 if v <= 0.04045 else ((v+0.055)/1.055)**2.4
def l2s(v):
    v = max(0.0, min(1.0, v))
    return 12.92*v if v <= 0.0031308 else 1.055*v**(1/2.4)-0.055
# Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB
M = {
 'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
 'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
 'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
def simulate(hexc, kind):
    lin = [s2l(v) for v in hex2rgb(hexc)]
    if kind == 'normal': return hexc
    if kind == 'grey':
        Y = 0.2126*lin[0] + 0.7152*lin[1] + 0.0722*lin[2]
        return rgb2hex([l2s(Y)]*3)
    m = M[kind]
    out = [sum(m[r][c]*lin[c] for c in range(3)) for r in range(3)]
    return rgb2hex([l2s(v) for v in out])
def rgb2lab(hexc):
    r, g, b = [s2l(v) for v in hex2rgb(hexc)]
    X = 0.4124564*r + 0.3575761*g + 0.1804375*b
    Y = 0.2126729*r + 0.7151522*g + 0.0721750*b
    Z = 0.0193339*r + 0.1191920*g + 0.9503041*b
    Xn, Yn, Zn = 0.95047, 1.0, 1.08883
    def f(t): return t**(1/3) if t > 216/24389 else (24389/27*t + 16)/116
    fx, fy, fz = f(X/Xn), f(Y/Yn), f(Z/Zn)
    return (116*fy - 16, 500*(fx - fy), 200*(fy - fz))
def de2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1 = math.hypot(a1, b1); C2 = math.hypot(a2, b2); Cb = (C1 + C2)/2
    G = 0.5*(1 - math.sqrt(Cb**7/(Cb**7 + 25**7)))
    a1p, a2p = (1+G)*a1, (1+G)*a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p else 0
    dLp = L2 - L1; dCp = C2p - C1p
    if C1p*C2p == 0: dhp = 0
    else:
        dhp = h2p - h1p
        if dhp > 180: dhp -= 360
        elif dhp < -180: dhp += 360
    dHp = 2*math.sqrt(C1p*C2p)*math.sin(math.radians(dhp/2))
    Lbp = (L1 + L2)/2; Cbp = (C1p + C2p)/2
    if C1p*C2p == 0: hbp = h1p + h2p
    else:
        hbp = (h1p + h2p)/2
        if abs(h1p - h2p) > 180: hbp += 180 if (h1p + h2p) < 360 else -180
    T = 1 - 0.17*math.cos(math.radians(hbp-30)) + 0.24*math.cos(math.radians(2*hbp)) + 0.32*math.cos(math.radians(3*hbp+6)) - 0.20*math.cos(math.radians(4*hbp-63))
    dth = 30*math.exp(-((hbp-275)/25)**2)
    Rc = 2*math.sqrt(Cbp**7/(Cbp**7 + 25**7))
    Sl = 1 + 0.015*(Lbp-50)**2/math.sqrt(20 + (Lbp-50)**2)
    Sc = 1 + 0.045*Cbp; Sh = 1 + 0.015*Cbp*T
    Rt = -math.sin(math.radians(2*dth))*Rc
    return math.sqrt((dLp/Sl)**2 + (dCp/Sc)**2 + (dHp/Sh)**2 + Rt*(dCp/Sc)*(dHp/Sh))
def lum(hexc):
    r, g, b = [s2l(v) for v in hex2rgb(hexc)]
    return 0.2126*r + 0.7152*g + 0.0722*b
def contrast(h1, h2):
    a, b = sorted([lum(h1), lum(h2)], reverse=True); return (a+0.05)/(b+0.05)
INK_DARK, INK_LIGHT = '#1B1410', '#FFF8E7'
# --- evaluation -------------------------------------------------------------
KINDS = ['normal', 'deutan', 'protan', 'tritan', 'grey']
def evaluate(name, pal, verbose=True):
    grades = list(pal.keys())
    res = {'name': name, 'colors': {}, 'min': {}, 'worst': {}}
    for g in grades:
        h = pal[g]; L, a, b = rgb2lab(h)
        cd, cl = contrast(h, INK_DARK), contrast(h, INK_LIGHT)
        res['colors'][g] = {'hex': h, 'L': round(L, 1), 'sim': {k: simulate(h, k) for k in KINDS[1:]},
                            'ink': INK_DARK if cd >= cl else INK_LIGHT, 'ink_contrast': round(max(cd, cl), 2)}
    for k in KINDS:
        pairs = []
        for g1, g2 in itertools.combinations(grades, 2):
            d = de2000(rgb2lab(simulate(pal[g1], k)), rgb2lab(simulate(pal[g2], k)))
            pairs.append((round(d, 1), g1, g2))
        pairs.sort()
        res['min'][k] = pairs[0][0]
        res['worst'][k] = pairs[:3]
        res.setdefault('under10', {})[k] = [p for p in pairs if p[0] < 10]
    if verbose:
        print(f'### {name}')
        print('grade | hex | L* | ink(contrast) | deutan | protan | tritan | grey')
        for g in grades:
            c = res['colors'][g]
            print(f"{g} | {c['hex']} | {c['L']} | {c['ink']} ({c['ink_contrast']}) | {c['sim']['deutan']} | {c['sim']['protan']} | {c['sim']['tritan']} | {c['sim']['grey']}")
        for k in KINDS:
            print(f"  min dE00 {k:7s}= {res['min'][k]:5.1f}   worst: {res['worst'][k]}   (<10: {len(res['under10'][k])} pairs)")
    return res
if __name__ == '__main__':
    pals = json.load(open(sys.argv[1], encoding='utf-8'))
    out = {}
    for name, pal in pals.items():
        out[name] = evaluate(name, pal)
    if len(sys.argv) > 2:
        json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
