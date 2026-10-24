"""Parse saved freesound.org search pages.
usage: python -I fs_parse.py FILE...  -> id | user | title | dur | downloads | rating | desc"""
import html, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
seen = set()
for path in sys.argv[1:]:
    s = open(path, encoding="utf-8", errors="replace").read()
    parts = s.split('<div class="bw-search__result"')
    for blk in parts[1:]:
        g = lambda k: (re.search(k + r'="([^"]*)"', blk) or [None, ''])[1]
        sid = g('data-sound-id')
        if not sid or sid in seen:
            continue
        seen.add(sid)
        rating = (re.search(r'aria-label="Average rating of ([0-9.]+)"', blk) or [None, '-'])[1]
        desc = re.search(r'<p class="text-grey[^"]*"[^>]*>(.*?)</p>', blk, re.S)
        d = html.unescape(re.sub(r'<[^>]+>|\s+', ' ', desc.group(1))).strip() if desc else ''
        lic = re.findall(r'(Creative Commons 0|Attribution NonCommercial|Attribution|Sampling\+)', blk)
        print(f"{sid} | {g('data-username')} | {html.unescape(g('data-title'))} | {float(g('data-duration') or 0):.1f}s | dl {g('data-num-downloads')} | r {rating} | {lic[0] if lic else '?'} | {d[:110]}")
