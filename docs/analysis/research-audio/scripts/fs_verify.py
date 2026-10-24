"""Verify the licence stated on saved freesound sound pages.
usage: python -I fs_verify.py OUT.json PAGE...  (PAGE = <id>.html)"""
import glob, html, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
out = sys.argv[1]
res = {}
pages = []
for a in sys.argv[2:]:
    pages.extend(glob.glob(a) or [a])
for p in pages:
    sid = os.path.basename(p).split('.')[0]
    s = open(p, encoding="utf-8", errors="replace").read()
    t = re.search(r'<title>Freesound - (.*?) by (.*?)</title>', s, re.S)
    lic = re.search(r'title="Go to the full license text" href="([^"]+)"[^>]*>([^<]+)</a>', s)
    desc = re.search(r'<div id="soundDescriptionSection"[^>]*>(.*?)</div>', s, re.S) or re.search(r'class="sound-description[^"]*"[^>]*>(.*?)</div>', s, re.S)
    d = html.unescape(re.sub(r'<[^>]+>|\s+', ' ', desc.group(1))).strip() if desc else ''
    tags = re.findall(r'href="/browse/tags/([^/"]+)/"', s)
    typ = re.search(r'<dt[^>]*>Type</dt>\s*<dd[^>]*>(.*?)</dd>', s, re.S)
    res[sid] = dict(id=sid, title=html.unescape(t.group(1)) if t else '', author=html.unescape(t.group(2)) if t else '',
                    license_url=lic.group(1) if lic else '', license=lic.group(2).strip() if lic else 'NOT FOUND',
                    page=f"https://freesound.org/people/{t.group(2) if t else '?'}/sounds/{sid}/", tags=sorted(set(tags))[:12], description=d[:300])
    ok = 'publicdomain/zero/1.0' in (lic.group(1) if lic else '')
    print(f"{sid:7s} {'CC0 OK ' if ok else 'CHECK!!'} {res[sid]['author'][:22]:22s} {res[sid]['title'][:48]:48s} | {d[:90]}")
json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
