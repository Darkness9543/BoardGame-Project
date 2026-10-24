"""Verify licence/author/technical data on saved BigSoundBank sound pages.
usage: python -I bsb_verify.py OUT.json PAGE..."""
import glob, html, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
out = sys.argv[1]
pages = []
for a in sys.argv[2:]:
    pages.extend(glob.glob(a) or [a])
res = {}
def text(s):
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s)))
for p in pages:
    sid = os.path.basename(p).split('.')[0]
    s = open(p, encoding="utf-8", errors="replace").read()
    t = text(s)
    title = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    canon = re.search(r'<link rel=.canonical. href=.([^\'"]+)', s)
    lic = re.search(r'(CC0 \(public domain\)[^.]{0,60})', t)
    auth = re.search(r'Author\s*:\s*(.*?)\s+Sound number', t)
    sr = re.search(r'Sampling Rate\s*:\s*([0-9 ,.]+ ?Hz)', t)
    realism = re.search(r'Realism\s*:\s*(\w+)', t)
    ch = re.search(r'Channels\s*:\s*(\w+)', t)
    dur = re.search(r'(?:Length|Duration)\s*:?\s*([0-9:]+)', t)
    desc = re.search(r'<meta name=.description. content=.([^\'"]+)', s)
    res[sid] = dict(id=sid, title=html.unescape(re.sub(r'<[^>]+>', '', title.group(1))).strip() if title else '',
                    page=canon.group(1) if canon else '', license=lic.group(1).strip() if lic else 'NOT FOUND',
                    author=auth.group(1).strip() if auth else '', sample_rate=sr.group(1).strip() if sr else '',
                    length=dur.group(1) if dur else '', realism=realism.group(1) if realism else '', channels=ch.group(1) if ch else '', description=html.unescape(desc.group(1)) if desc else '',
                    ogg=f"https://bigsoundbank.com/UPLOAD/ogg/{sid}.ogg")
    r = res[sid]
    print(f"{sid} {'OK ' if 'CC0' in r['license'] else 'CHECK'} {r['title'][:34]:34s} | {r['author'][:28]:28s} | {r['sample_rate']:10s} {r['channels']:6s} {r['realism']:10s} {r['length']}")
json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
