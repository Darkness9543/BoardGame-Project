"""Index all saved freesound search pages: id -> user, title, duration, lq ogg url.
usage: python -I fs_index.py OUT.json PAGE..."""
import glob, html, json, re, sys
out = sys.argv[1]
idx = {}
pages = []
for a in sys.argv[2:]:
    pages.extend(glob.glob(a) or [a])
for path in pages:
    s = open(path, encoding="utf-8", errors="replace").read()
    for blk in s.split('<div class="bw-search__result"')[1:]:
        g = lambda k: (re.search(k + r'="([^"]*)"', blk) or [None, ''])[1]
        sid = g('data-sound-id')
        if sid and sid not in idx:
            idx[sid] = dict(id=sid, user=g('data-username'), user_id=g('data-user-id'), title=html.unescape(g('data-title')),
                            duration=float(g('data-duration') or 0), ogg_lq=g('data-ogg'), mp3_lq=g('data-mp3'))
json.dump(idx, open(out, "w", encoding="utf-8"), indent=1)
print(len(idx), "sounds indexed")
