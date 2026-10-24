"""Print visible text of an HTML file, optionally the window after a marker.
usage: python -I htmltext.py FILE [MARKER] [NCHARS]"""
import html, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = sys.argv[1]
marker = sys.argv[2] if len(sys.argv) > 2 else None
n = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
s = open(path, encoding='utf-8', errors='replace').read()
s = re.sub(r'(?is)<(script|style)\b.*?</\1>', ' ', s)
s = re.sub(r'(?s)<[^>]+>', ' ', s)
s = html.unescape(s)
s = re.sub(r'\s+', ' ', s)
if marker:
    i = s.find(marker)
    if i < 0:
        print('[marker not found]')
        sys.exit(0)
    print(s[i:i + n])
else:
    print(s[:n])
