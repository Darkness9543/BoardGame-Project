"""Parse BigSoundBank search/category result pages.
usage: python -I bsb_parse.py FILE...   -> id | title | description | length"""
import html, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
seen = set()
for path in sys.argv[1:]:
    s = open(path, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r"<div class='resultat_\d+'>(.*?)(?=<div class='resultat_\d+'>|</div></div></main>|$)", s, re.S):
        blk = m.group(1)
        t = re.search(r"<h2[^>]*><a href='/([^']+)-s(\d+)\.html'>(.*?)<span class=\"numero\">(.*?)</span>", blk, re.S)
        if not t:
            continue
        sid = t.group(2)
        if sid in seen:
            continue
        seen.add(sid)
        title = html.unescape(re.sub(r'<[^>]+>', '', t.group(3) + t.group(4))).strip()
        d = re.search(r"</div></div><div>(.*?)<a href='/categories.html'>", blk, re.S)
        desc = html.unescape(re.sub(r'<[^>]+>', '', d.group(1))).strip() if d else ''
        ln = re.search(r'Length: ([0-9:]+)', blk)
        cat = re.search(r"CatID=([A-Za-z]+)'", blk)
        print(f"{sid} | {title} | {cat.group(1) if cat else ''} | {ln.group(1) if ln else ''} | {desc[:160]}")
