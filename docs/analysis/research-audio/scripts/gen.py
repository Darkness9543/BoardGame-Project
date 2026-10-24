"""Turn the build report into cues.json, manifest entries, the attribution section, the mock page and doc tables.

usage: python -I gen.py REPORT.json META.txt OUT_DIR
"""
import ast
import html
import json
import os
import sys
from urllib.parse import quote

REPORT, META, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
report = json.load(open(REPORT, encoding="utf-8"))
meta = ast.literal_eval(open(META, encoding="utf-8").read())
BD, BL, CM = meta["bus_defaults"], meta["bus_levels"], meta["cues"]
os.makedirs(OUT, exist_ok=True)
DATE = "2026-10-24"

missing = [e["id"] for e in report if e["id"] not in CM]
if missing:
    raise SystemExit("no meta for " + ", ".join(missing))


def esc(s):
    return html.escape(str(s), quote=True)


def src_label(s):
    if s["pack"] == "Freesound":
        return f"Freesound “{s['title']}” by {s['author']}"
    if s["pack"] == "BigSoundBank":
        return f"BigSoundBank “{s['title']}” by {s['author']}"
    return f"{s['pack']}: {s['member']}"


def uniq(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


def layer_edit(L):
    bits = []
    if "start" in L or "dur" in L:
        a = L.get("start", 0.0)
        bits.append(f"from {a:.3f} s" + (f" for {L['dur']:.2f} s" if "dur" in L else ""))
    if L.get("rev"):
        bits.append("reversed")
    if L.get("pitch"):
        bits.append(f"pitch {L['pitch']:+g} st")
    if L.get("hp"):
        bits.append(f"high-pass {L['hp']} Hz")
    if L.get("lp"):
        bits.append(f"low-pass {L['lp']} Hz")
    if L.get("drive"):
        bits.append(f"saturation {L['drive']} dB")
    if L.get("gain"):
        bits.append(f"{L['gain']:+g} dB")
    if L.get("delay"):
        bits.append(f"at +{int(L['delay'] * 1000)} ms")
    return ", ".join(bits) if bits else "whole file"


# ------------------------------------------------------------------ cues.json
cues = {}
for e in report:
    m = dict(BD[CM[e["id"]]["bus"]])
    m.update({k: v for k, v in CM[e["id"]].items() if k not in ("bus", "events")})
    srcs = uniq([(s["pack"], s["title"], s["author"], s["page"], s["url"], s.get("member"), s["license"]) for f in e["files"] for s in f["sources"]])
    sources = [dict(pack=p, title=t, author=a, page=pg, url=u, member=mb, license=lc) for p, t, a, pg, u, mb, lc in srcs]
    c = {
        "files": [f"assets/audio/{f['base']}.ogg" for f in e["files"]],
        "mp3": [f"assets/audio/{f['base']}.mp3" for f in e["files"]],
        "gain": e["gain"],
        "variations": len(e["files"]),
        "source": " + ".join(uniq(src_label(s) for s in sources)),
        "license": "CC0-1.0",
        "author": "; ".join(uniq(s["author"] for s in sources)),
        "bus": CM[e["id"]]["bus"],
        "events": CM[e["id"]]["events"],
        "durationMs": int(round(max(f["ogg"]["duration"] for f in e["files"]) * 1000)),
        "pitchJitterSemitones": m["pitch"],
        "gainJitterDb": m["gainj"],
        "maxVoices": m["voices"],
        "priority": m["prio"],
        "minIntervalMs": m["minInterval"],
        "why": e["why"],
        "sources": sources,
    }
    if e.get("loop"):
        c["loop"] = {"start": 0.0, "end": e["loop"]["len"]}
        c["optional"] = True
    if e.get("extra"):
        c["extra"] = True
    cues[e["id"]] = c

doc = {
    "version": 1,
    "generated": DATE,
    "basePath": "assets/audio/",
    "formats": {"preferred": "ogg", "fallback": "mp3",
                "note": "Use the .ogg list where new Audio().canPlayType('audio/ogg; codecs=\"vorbis\"') is not empty, else the parallel .mp3 list (Safari). Same order, same content."},
    "loudness": {"peakDbfs": -3.0,
                 "note": "Every file is peak-normalised to about -3 dBFS. 'gain' brings each cue to its category loudness target (max 100 ms K-weighted loudness, ITU-R BS.1770 filter); loops use integrated loudness."},
    "userVolumes": {"master": 0.8, "effects": 0.9, "ambient": 0.5,
                    "note": "Persist per player. 'effects' scales every bus except 'ambient'. Output = cue gain x bus level x effects (or ambient) x master."},
    "buses": BL,
    "ducking": [
        {"trigger": ["hit.metal.heavy", "unit.death.big", "mine.explode", "slam.impact", "smite"], "duck": {"ui": -6, "ambient": -4}, "attackMs": 10, "holdMs": 120, "releaseMs": 350},
        {"trigger": ["win", "lose", "draw"], "duck": {"ui": -10, "turn": -10, "unit": -10, "attack": -10, "hit": -10, "death": -10, "effect": -10, "big": -10, "objective": -10, "ambient": -8}, "attackMs": 50, "holdMs": "while playing", "releaseMs": 1200},
        {"trigger": ["turn.start.own", "turn.start.opponent", "boost.active", "decision.prompt"], "duck": {"ambient": -3}, "attackMs": 30, "holdMs": 400, "releaseMs": 600},
    ],
    "voices": {"max": 16, "stealing": "drop the new play if its priority is lower than every playing voice; otherwise stop the oldest voice with the lowest priority",
               "note": "Per-cue caps are maxVoices; minIntervalMs drops repeats of the same cue that arrive sooner."},
    "unlock": "Browsers start an AudioContext suspended. Create it on load, call resume() inside the first pointerdown or keydown handler, and show the speaker icon as muted until then.",
    "cues": cues,
}
json.dump(doc, open(os.path.join(OUT, "cues.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# ------------------------------------------------------------------ manifest entries
entries = []
for e in report:
    n = len(e["files"])
    for i, f in enumerate(e["files"]):
        srcs = f["sources"]
        for ext, info in (("ogg", f["ogg"]), ("mp3", f["mp3"])):
            first = srcs[0]
            url = first["url"] if not first.get("member") else first["url"] + "#" + quote(first["member"])
            use = (f"sound cue {e['id']}" + (f", variation {i + 1} of {n}" if n > 1 else "") +
                   f" ({'Ogg Vorbis' if ext == 'ogg' else 'MP3 fallback'}, {'stereo' if info['channels'] == 2 else 'mono'}, {info['duration']:.2f} s)")
            edits = "; ".join(f"{src_label(s)}: {layer_edit(L)}" for s, L in zip(srcs, f["layers"]))
            ent = {"path": f"assets/audio/{f['base']}.{ext}",
                   "source": " + ".join(uniq(s["pack"] for s in srcs)),
                   "url": url,
                   "license": "CC0-1.0",
                   "author": " + ".join(uniq(s["author"] for s in srcs)),
                   "intendedUse": f"{use} [edited: {edits}; mixed, peak about -3 dBFS]"}
            if len(srcs) > 1:
                ent["layers"] = [{"source": s["pack"], "title": s["title"], "author": s["author"], "license": s["license"],
                                  "url": s["url"] if not s.get("member") else s["url"] + "#" + quote(s["member"]), "page": s["page"]} for s in srcs]
            entries.append(ent)
json.dump(entries, open(os.path.join(OUT, "manifest-audio.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# ------------------------------------------------------------------ attribution section
fam = {}
for e in report:
    for f in e["files"]:
        for s in f["sources"]:
            key = s["pack"]
            fam.setdefault(key, {"page": s["page"], "url": s["url"], "authors": set(), "n": 0})
            fam[key]["authors"].add(s["author"])
            fam[key]["n"] += 1
LICQ = {
    "kenney": "“License: (Creative Commons Zero, CC0) … This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)” (Impact Sounds and Interface Sounds `License.txt`; UI Audio, RPG Audio, Casino Audio and Music Jingles say “Credit (Kenney or www.kenney.nl) would be nice but is not mandatory”)",
    "oga": "OpenGameArt pages list “License(s): CC0” for each pack (checked on the pack pages)",
    "bsb": "Each sound page says “CC0 (public domain): Free and royalty-free”; the site licence page: “Creative Commons CC0 1.0 Universal … Use, including for commercial purposes. Without any restrictions. Without asking permission.” (https://bigsoundbank.com/licenses.html)",
    "fs": "Each sound page links “Creative Commons 0” (http://creativecommons.org/publicdomain/zero/1.0/); checked page by page",
}
lines = []
lines.append("## 7. Sound effects (`assets/audio/`)")
lines.append("")
lines.append("- **Licence:** every source sound is Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/. All checked on " + DATE + ".")
lines.append("- **Attribution required:** no. Credit given anyway (see the credits text above).")
lines.append("- **Formats:** each cue ships as Ogg Vorbis (`.ogg`, preferred) and MP3 (`.mp3`, Safari fallback), 44.1 kHz, mono except `lose`, `draw` and the two ambience loops (stereo; the `win` source is mono). Files are edited (trimmed, layered, filtered, some pitch-shifted, one reversed), mixed and peak-normalised to about -3 dBFS; the table says what was done to each.")
lines.append("- **Freesound files** are the site's HQ OGG previews (the original download needs a login); the licence applies to the sound, so the preview is CC0 too. The table names each sound page.")
lines.append("- **`cues.json`** (same folder) maps every cue id to its files, gain, variations, sources and engine events. It is project metadata, like this file.")
lines.append("")
lines.append("| Source | Licence evidence | Page | Files using it |")
lines.append("|---|---|---|---|")
def fam_kind(p):
    return "kenney" if p.startswith("Kenney") else ("oga" if p.startswith(("rubberduck", "artisticdude")) else ("bsb" if p == "BigSoundBank" else "fs"))
for p in sorted(fam):
    k = fam_kind(p)
    page = fam[p]["page"] if k in ("kenney", "oga") else ("https://bigsoundbank.com" if k == "bsb" else "https://freesound.org")
    lines.append(f"| {p} | {LICQ[k]} | {page} | {fam[p]['n']} layer use{'s' if fam[p]['n'] != 1 else ''} |")
lines.append("")
lines.append("| Files (`.ogg` + `.mp3`) | Layers: source file, author, edit |")
lines.append("|---|---|")
for e in report:
    for f in e["files"]:
        parts = []
        for s, L in zip(f["sources"], f["layers"]):
            where = f"[{s['title']}]({s['page']})" if s["pack"] in ("Freesound", "BigSoundBank") else f"`{s['member']}` ([{s['pack']}]({s['page']}))"
            what = "Freesound" if s["pack"] == "Freesound" else ("BigSoundBank" if s["pack"] == "BigSoundBank" else "")
            parts.append(f"{what + ' ' if what else ''}{where}, {s['author']}: {layer_edit(L)}")
        lines.append(f"| `{f['base']}` | " + "<br>".join(parts) + " |")
lines.append("")
open(os.path.join(OUT, "attribution-audio.md"), "w", encoding="utf-8").write("\n".join(lines))

# credits authors for the credits block
fs_authors = sorted({s["author"] for e in report for f in e["files"] for s in f["sources"] if s["pack"] == "Freesound"}, key=str.lower)
bsb_authors = sorted({s["author"] for e in report for f in e["files"] for s in f["sources"] if s["pack"] == "BigSoundBank"}, key=str.lower)
json.dump({"freesound": fs_authors, "bigsoundbank": bsb_authors}, open(os.path.join(OUT, "credit-authors.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# ------------------------------------------------------------------ doc tables
t = []
t.append("| Cue | Plays on | Chosen file(s) | Source | Var. | Dur. | Gain | Why it fits “gritty but readable” |")
t.append("|---|---|---|---|---|---|---|---|")
for e in report:
    c = cues[e["id"]]
    files = ", ".join(f"`{os.path.basename(p)[:-4]}`" for p in c["files"])
    t.append(f"| `{e['id']}`{' (extra)' if e.get('extra') else ''}{' (optional)' if e.get('loop') else ''} | {'; '.join(c['events'])} | {files} | {c['source']} | {c['variations']} | {c['durationMs'] / 1000:.2f} s | {c['gain']:.2f} | {e['why']} |")
open(os.path.join(OUT, "table-cues.md"), "w", encoding="utf-8").write("\n".join(t))
t = []
t.append("| Cue | Contender | Why it is not the default |")
t.append("|---|---|---|")
for e in report:
    for k, a in enumerate(e["contenders"]):
        t.append(f"| `{e['id']}` | {chr(65 + k)}: {a['label']} | {a['why']} |")
open(os.path.join(OUT, "table-contenders.md"), "w", encoding="utf-8").write("\n".join(t))

# ------------------------------------------------------------------ mock page
GROUPS = [
    ("s-ui", "Interface", "Wood, stone and paper: the war table's own materials, short and dry so they never compete with the board.",
     ["ui.hover", "ui.click", "ui.confirm", "ui.cancel", "ui.toggle", "ui.error", "ui.open", "ui.close", "takeback.request", "takeback.accept"]),
    ("s-turn", "Lobby and turn flow", "Bells for you, drums for the enemy, one horn for first contact: signals a player learns in one match.",
     ["lobby.joined", "lobby.ready", "coin.flip", "battle.start", "turn.start.own", "turn.start.opponent", "turn.end", "timer.warning", "boost.active", "decision.prompt"]),
    ("s-coins", "Coins on the table", "Units are coins: a real two-euro coin and a large coin on varnished wood carry selection, movement and death.",
     ["unit.select", "unit.deselect", "unit.move.step", "unit.move.charge", "march.step", "unit.defend"]),
    ("s-combat", "Attacks and hits", "Air first, material second: swings are pure air so the hit that follows carries metal. Hit shape is the readability code.",
     ["attack.swing.light", "attack.swing.heavy", "attack.ranged.shot", "attack.miss", "hit.metal.light", "hit.metal.heavy", "hit.blocked", "hit.defended"]),
    ("s-death", "Deaths", "A coin spinning down and falling flat; tier 50 and 100 fall heavier.",
     ["unit.death", "unit.death.big"]),
    ("s-abilities", "Abilities and statuses", "Each active ability gets one physical gesture (bowl, gong, chain, winder, cauldron) rather than a synth effect.",
     ["heal", "buff", "debuff", "reveal", "stealth.on", "stealth.off", "assault", "mine.place", "mine.explode", "prototype.create", "forcefield.on", "forcefield.off",
      "pajazon.cast", "pajazon.heal", "pajazon.damage", "slam.impact", "feast", "smite", "blessing", "savagery", "shared.wounds", "julio", "command.aura",
      "mend", "hexward", "cauldron.return", "revive", "weakness"]),
    ("s-objectives", "Objectives and results", "Iron gate, coins in a pot, crossed blades and a clock bell for the buildings; trumpets, a funeral bell and a distant horn for the end.",
     ["capture.keep", "capture.market", "building.contested", "siege.tick", "win", "lose", "draw"]),
    ("s-ambient", "Ambience (optional)", "Two steady 30 s loops for the planning table; at default settings they sit roughly 20 dB under the effects.",
     ["ambient.wind", "ambient.camp"]),
]
grouped = [c for g in GROUPS for c in g[3]]
if sorted(grouped) != sorted(e["id"] for e in report):
    raise SystemExit("group list mismatch: " + str(set(grouped) ^ {e["id"] for e in report}))
R = {e["id"]: e for e in report}

pdata = {"cues": {}, "bus": BL}
for e in report:
    c = cues[e["id"]]
    pdata["cues"][e["id"]] = {"f": [os.path.basename(p) for p in c["mp3"]], "g": c["gain"], "b": c["bus"], "p": c["pitchJitterSemitones"], "j": c["gainJitterDb"],
                              "loop": bool(e.get("loop")), "alts": [{"f": a["file"], "g": c["gain"]} for a in e["contenders"]]}


def cue_card(cid):
    e, c = R[cid], cues[cid]
    n = c["variations"]
    dom = cid.replace(".", "-")
    srcs = "; ".join(esc(src_label(s)) for s in c["sources"])
    var_btns = "".join(f'<button type="button" class="pbtn" data-cue="{esc(cid)}" data-v="{i}" aria-label="Play {esc(cid)} variation {i + 1}">{i + 1}</button>' for i in range(n)) if n > 1 else ""
    alts = []
    for k, a in enumerate(e["contenders"]):
        alts.append(f'<li><button type="button" class="pbtn alt" data-cue="{esc(cid)}" data-alt="{k}" aria-label="Play contender {chr(65 + k)} for {esc(cid)}"><span class="tri" aria-hidden="true"></span>{chr(65 + k)}</button>'
                    f'<div><p class="alab">{esc(a["label"])} <span class="tag">Contender</span></p><p class="awhy">{esc(a["why"])}</p></div></li>')
    tags = []
    if e.get("extra"):
        tags.append('<span class="tag t-opt">Extra cue</span>')
    if e.get("loop"):
        tags.append('<span class="tag t-opt">Optional loop</span>')
    loopnote = ' <span class="muted small">(loops; press again to stop)</span>' if e.get("loop") else ""
    return f'''<article class="card cue" id="cue-{dom}">
<div class="card-head"><h3><code>{esc(cid)}</code></h3>{''.join(tags)}<span class="meta num">{n} file{'s' if n > 1 else ''} &middot; {c['durationMs'] / 1000:.2f} s &middot; gain {c['gain']:.2f}</span></div>
<p class="when"><span class="lbl">Plays on</span> {esc('; '.join(c['events']))}</p>
<div class="pick"><button type="button" class="pbtn main" data-cue="{esc(cid)}" aria-label="Play {esc(cid)}"><span class="tri" aria-hidden="true"></span>Play</button><span class="tag t-rec">Recommended</span>{('<span class="vars" role="group" aria-label="Variations">' + var_btns + '</span>') if var_btns else ''}{loopnote}</div>
<p class="why">{esc(e['why'])}</p>
<p class="src">{srcs} &middot; CC0</p>
<ul class="alts">{''.join(alts)}</ul>
</article>'''


sections = []
toc = []
for i, (sid, title, intro, ids) in enumerate(GROUPS):
    toc.append(f'<li><a href="#{sid}">{esc(title)}</a></li>')
    sections.append(f'<section id="{sid}" aria-labelledby="h-{sid}"><div class="sec-head"><h2 id="h-{sid}">{esc(title)}</h2><p>{esc(intro)}</p></div>'
                    f'<div class="cards">{"".join(cue_card(c) for c in ids)}</div></section>')

SCENES = [
    ("skirmish", "Melee exchange", "Select a Berserker, three steps, heavy swing, heavy hit, the Footman dies, end turn.",
     [[0, "unit.select"], [350, "unit.move.step"], [500, "unit.move.step"], [650, "unit.move.step"], [1050, "attack.swing.heavy"], [1300, "hit.metal.heavy"], [1650, "unit.death"], [2900, "turn.end"]]),
    ("shapes", "Blocked, defended, plain", "The same light swing three times: into a Paladin's armour, into a defending Soldier, into a bare Mercenary.",
     [[0, "attack.swing.light"], [200, "hit.blocked"], [1100, "attack.swing.light"], [1300, "hit.defended"], [2200, "attack.swing.light"], [2400, "hit.metal.light"]]),
    ("ranger", "Ranger into a mine", "A blind shot at a square with a hidden Trip Mine, then a second shot that kills.",
     [[0, "attack.ranged.shot"], [550, "mine.explode"], [700, "hit.metal.light"], [2100, "attack.ranged.shot"], [2600, "hit.metal.light"], [2900, "unit.death"]]),
    ("tier100", "Tier-100 turn", "Your bell, Smite on a Royal Wizard with splash on two neighbours, the Wizard falls, the Siege counter ticks.",
     [[0, "turn.start.own"], [1400, "smite"], [1550, "hit.metal.heavy"], [1700, "hit.metal.light"], [1780, "hit.metal.light"], [2200, "unit.death.big"], [4000, "siege.tick"]]),
    ("rogue", "Stealth and ambush", "A Rogue hides, the enemy steps adjacent, Assault strikes and reveals the Rogue.",
     [[0, "stealth.on"], [700, "turn.start.opponent"], [1500, "unit.move.step"], [1650, "unit.move.step"], [1900, "assault"], [2150, "hit.metal.light"], [2400, "reveal"]]),
    ("march", "Group march and capture", "Three march waves into the Market ring, the Market is captured, then contested.",
     [[0, "march.step"], [450, "march.step"], [900, "march.step"], [1600, "capture.market"], [3000, "building.contested"]]),
    ("revive", "Death and revival", "A Footman falls, Queso's prompt rings, the coin rises again.",
     [[0, "hit.metal.heavy"], [300, "unit.death"], [1400, "decision.prompt"], [2600, "ui.confirm"], [2800, "revive"]]),
]
scene_html = "".join(f'<li class="scene"><button type="button" class="pbtn scene-btn" data-scene="{k}"><span class="tri" aria-hidden="true"></span>{esc(t)}</button><p>{esc(d)}</p></li>' for k, t, d, _ in SCENES)
pdata["scenes"] = {k: s for k, _, _, s in SCENES}

src_rows = []
for p in sorted(fam):
    k = fam_kind(p)
    page = fam[p]["page"] if k in ("kenney", "oga") else ("https://bigsoundbank.com" if k == "bsb" else "https://freesound.org")
    who = ", ".join(sorted(fam[p]["authors"], key=str.lower))
    src_rows.append(f'<tr><th scope="row">{esc(p)}</th><td><a href="{esc(page)}" target="_blank" rel="noopener noreferrer">{esc(page.replace("https://", ""))}</a></td><td>CC0 1.0</td><td>{esc(who)}</td><td class="n">{fam[p]["n"]}</td></tr>')

CSS = r"""
:root {
  /* Layout: one reading column of cue cards grouped by game moment; a sticky-free mixer at the top. */
  --bg: #EDF0F3; --fg: #17202A; --muted: #536070; --card: #FFFFFF; --line: #D3DAE2;
  --accent: #7E5D17; --accent-ink: #FFFFFF; --ok: #2B7448; --warn: #8C5F00; --bad: #AE2F28;
  --display: "Cinzel", Georgia, "Times New Roman", serif;
  --body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #10151B; --fg: #E3E8ED; --muted: #98A4B1; --card: #18202A; --line: #2A3440;
    --accent: #D6B466; --accent-ink: #1B1607; --ok: #74C995; --warn: #E2B655; --bad: #F08B81; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #10151B; --fg: #E3E8ED; --muted: #98A4B1; --card: #18202A; --line: #2A3440;
  --accent: #D6B466; --accent-ink: #1B1607; --ok: #74C995; --warn: #E2B655; --bad: #F08B81; color-scheme: dark; }
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 15px/1.55 var(--body); overflow-wrap: break-word; }
a { color: var(--accent); text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code { font-family: var(--mono); font-size: .86em; background: color-mix(in srgb, var(--fg) 7%, transparent); padding: .08em .35em; border-radius: 4px; }
h1, h2, h3 { line-height: 1.2; margin: 0; text-wrap: balance; }
p { margin: 0; }
ul { margin: 0; padding-left: 1.2em; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.num { font-variant-numeric: tabular-nums; }
.wrap { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 40px 72px; display: flex; flex-direction: column; gap: 52px; }
.wrap > * { min-width: 0; }
.page-head { display: flex; flex-direction: column; gap: 18px; }
.kicker { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
h1 { font-family: var(--display); font-weight: 700; font-size: clamp(30px, 5vw, 46px); letter-spacing: .01em; }
.lede { font-size: 17px; max-width: 72ch; }
.quotes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 10px; }
.quote { margin: 0; background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--muted); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.quote p { font-style: italic; }
.quote cite { font-style: normal; font-size: 12px; color: var(--muted); }
.howto { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 10px 28px; }
.howto h2 { font-size: 16px; grid-column: 1 / -1; }
.proposal { grid-column: 1 / -1; border-top: 1px solid var(--line); padding-top: 10px; font-weight: 600; }
.mixer { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; }
.mixer h2 { font-size: 15px; width: 100%; }
.fader { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; min-width: 0; }
.fader input { width: min(160px, 40vw); accent-color: var(--accent); }
.fader output { font-variant-numeric: tabular-nums; color: var(--muted); width: 3ch; text-align: right; }
.mixer .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.status { font-size: 12.5px; color: var(--muted); width: 100%; }
.toc { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
.toc a { display: inline-flex; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--fg); text-decoration: none; font-size: 13px; font-weight: 600; }
.toc a:hover { border-color: var(--accent); }
section { display: flex; flex-direction: column; gap: 18px; scroll-margin-top: 16px; min-width: 0; }
.sec-head { display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.sec-head h2 { font-family: var(--display); font-size: clamp(22px, 3.2vw, 28px); }
.sec-head p { color: var(--muted); max-width: 80ch; }
.cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 470px), 1fr)); align-items: start; }
.cards > * { min-width: 0; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.card-head { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.card-head h3 { font-size: 16px; margin-right: auto; }
.card-head h3 code { font-size: 15px; background: none; padding: 0; font-weight: 700; }
.meta { font-size: 12.5px; color: var(--muted); }
.when { font-size: 13px; }
.lbl { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin-right: 4px; }
.pick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vars { display: inline-flex; gap: 4px; }
.why { max-width: 75ch; }
.src { font-size: 12.5px; color: var(--muted); }
.alts { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--line); padding-top: 10px; }
.alts li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
.alab { font-size: 13.5px; font-weight: 600; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.awhy { font-size: 13px; color: var(--muted); }
.tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); background: var(--card); white-space: nowrap; }
.tag.t-rec { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.tag.t-opt { border-color: color-mix(in srgb, var(--ok) 60%, var(--line)); color: var(--ok); }
.pbtn { font: 600 13px/1.2 var(--body); display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
.pbtn:hover { border-color: var(--muted); }
.pbtn.main { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.pbtn.alt { padding: 6px 10px; min-width: 46px; justify-content: center; }
.vars .pbtn { padding: 5px 9px; font-size: 12px; font-variant-numeric: tabular-nums; }
.pbtn.on { box-shadow: inset 0 0 0 2px var(--accent); }
.tri { width: 0; height: 0; border-style: solid; border-width: 5px 0 5px 8px; border-color: transparent transparent transparent currentColor; }
.scenes { list-style: none; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.scene { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.scene p { font-size: 13px; color: var(--muted); }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--card); max-width: 100%; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid var(--line); }
thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; background: color-mix(in srgb, var(--fg) 3%, var(--card)); white-space: nowrap; }
tbody tr:last-child > * { border-bottom: 0; }
td.n, th.n { text-align: right; white-space: nowrap; }
.note { font-size: 13px; color: var(--muted); border-left: 3px solid var(--line); padding-left: 10px; max-width: 85ch; }
.two { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); }
.two > * { min-width: 0; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
"""

JS = r"""
(function () {
  var D = window.SOUND_DATA;
  var vol = { master: 0.8, effects: 0.9, ambient: 0.5 };
  var playing = [];
  var duck = { ui: 1, ambient: 1 };
  var nextVar = {};
  var loops = {};
  var statusEl = document.getElementById('status');
  function db(x) { return Math.pow(10, x / 20); }
  function rnd(a) { return (Math.random() * 2 - 1) * a; }
  function busVol(bus) {
    var v = (D.bus[bus] || 1) * vol.master * (bus === 'ambient' ? vol.ambient : vol.effects);
    if (bus === 'ambient') v *= duck.ambient;
    if (bus === 'ui') v *= duck.ui;
    return v;
  }
  function refresh() {
    playing = playing.filter(function (p) { return !p.a.ended && !p.a.paused; });
    playing.forEach(function (p) { p.a.volume = Math.max(0, Math.min(1, p.g * busVol(p.bus))); });
  }
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }
  function play(id, opts) {
    opts = opts || {};
    var c = D.cues[id];
    if (!c) return;
    var file, g = c.g;
    if (opts.alt != null) { file = c.alts[opts.alt].f; }
    else {
      var i = opts.v != null ? opts.v : (nextVar[id] || 0) % c.f.length;
      nextVar[id] = i + 1;
      file = c.f[i];
    }
    if (c.loop && opts.alt == null && opts.v == null) { return toggleLoop(id, file, g); }
    var a = new Audio('audio/' + file);
    var p = { a: a, g: g * (opts.scene ? db(rnd(c.j)) : 1), bus: c.b };
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
    if (opts.scene && c.p) a.playbackRate = Math.pow(2, rnd(c.p) / 12);
    a.volume = Math.max(0, Math.min(1, p.g * busVol(c.b)));
    playing.push(p);
    a.play().then(function () { setStatus('Playing ' + id + (opts.alt != null ? ' (contender ' + 'ABC'.charAt(opts.alt) + ')' : '')); },
      function () { setStatus('This browser blocked the sound. Press the button again.'); });
    if (['hit.metal.heavy', 'unit.death.big', 'mine.explode', 'slam.impact', 'smite'].indexOf(id) >= 0) duckFor({ ui: db(-6), ambient: db(-4) }, 470);
    if (['win', 'lose', 'draw'].indexOf(id) >= 0) duckFor({ ui: db(-10), ambient: db(-8) }, 4000);
    return a;
  }
  var duckTimer = null;
  function duckFor(d, ms) {
    duck.ui = d.ui || 1; duck.ambient = d.ambient || 1; refresh();
    clearTimeout(duckTimer);
    duckTimer = setTimeout(function () { duck.ui = 1; duck.ambient = 1; refresh(); }, ms);
  }
  function toggleLoop(id, file, g) {
    if (loops[id]) { loops[id].a.pause(); delete loops[id]; mark(id, false); setStatus('Stopped ' + id); return; }
    var a = new Audio('audio/' + file);
    a.loop = true;
    var p = { a: a, g: g, bus: 'ambient' };
    a.volume = Math.max(0, Math.min(1, g * busVol('ambient')));
    loops[id] = p; playing.push(p);
    a.play().then(function () { mark(id, true); setStatus('Looping ' + id + ' (press again to stop)'); }, function () { setStatus('This browser blocked the sound. Press the button again.'); });
  }
  function mark(id, on) {
    document.querySelectorAll('.pbtn.main[data-cue="' + id + '"]').forEach(function (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  var sceneTimers = [];
  function scene(k) {
    sceneTimers.forEach(clearTimeout); sceneTimers = [];
    D.scenes[k].forEach(function (s) { sceneTimers.push(setTimeout(function () { play(s[1], { scene: true }); }, s[0])); });
    setStatus('Scene: ' + k);
  }
  function stopAll() {
    sceneTimers.forEach(clearTimeout); sceneTimers = [];
    playing.forEach(function (p) { p.a.pause(); }); playing = [];
    Object.keys(loops).forEach(function (id) { mark(id, false); }); loops = {};
    setStatus('Stopped');
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.scene) return scene(b.dataset.scene);
    if (b.id === 'stop-all') return stopAll();
    if (b.dataset.cue) {
      var o = {};
      if (b.dataset.alt != null) o.alt = +b.dataset.alt;
      if (b.dataset.v != null) o.v = +b.dataset.v;
      play(b.dataset.cue, o);
    }
  });
  ['master', 'effects', 'ambient'].forEach(function (k) {
    var el = document.getElementById('vol-' + k), out = document.getElementById('out-' + k);
    if (!el) return;
    try { var s = localStorage.getItem('coin-duel-vol-' + k); if (s != null) el.value = s; } catch (e) {}
    function upd() { vol[k] = el.value / 100; if (out) out.textContent = el.value; refresh(); try { localStorage.setItem('coin-duel-vol-' + k, el.value); } catch (e) {} }
    el.addEventListener('input', upd); upd();
  });
})();
"""

head_fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;600;700&display=swap">'
total_game = sum(f["ogg"]["bytes"] + f["mp3"]["bytes"] for e in report for f in e["files"])
n_files = sum(len(e["files"]) for e in report)
n_req = sum(1 for e in report if not e.get("extra") and not e.get("loop"))
n_alt = sum(len(e["contenders"]) for e in report)

body = f'''<div class="wrap">
<header class="page-head">
  <p class="kicker">Sound direction mock &middot; built from docs/analysis/research-audio.md &middot; {DATE}</p>
  <h1>Coin Duel Sound Direction</h1>
  <p class="lede">Every sound cue for the board game, each with the chosen sound, its contenders side by side and why. Press a button to listen; nothing plays until you do. {len(report)} cues ({n_req} required, 3 extra, 2 optional loops), {n_files} chosen files and {n_alt} contenders, all CC0.</p>
  <div class="quotes"><blockquote class="quote"><p>&ldquo;Sound effects are in scope. The feel has have a grit and viscerality to it, while staying readable and not too exagerated.&rdquo;</p><cite>Owner&rsquo;s direction, {DATE}</cite></blockquote>
  <blockquote class="quote"><p>&ldquo;Any artistic decision will show a quick mock in a page, as well as justification for the use. If there are several contenders, all should be represented and justified.&rdquo;</p><cite>Owner&rsquo;s rule for artistic decisions</cite></blockquote></div>
  <div class="howto">
    <h2>How to listen</h2>
    <ul><li>Use headphones or real speakers: several heavy hits sit below 150 Hz.</li><li><strong>Play</strong> plays the chosen sound; numbered buttons pick one variation. In the game each play also gets a small random pitch and level change, which the scenes below apply.</li><li>Letters A and B are the contenders, each with the reason it is not the default.</li></ul>
    <ul><li>The sliders copy the proposed in-game split: master, effects and ambience, each saved per player.</li><li>Levels on this page already include each cue&rsquo;s gain from <code>cues.json</code>, so cues compare as they would in the game.</li><li>The page plays the MP3 copies; the game ships the same sounds as Ogg Vorbis with MP3 as the Safari fallback.</li></ul>
    <p class="proposal">Every choice here is a proposal awaiting the owner&rsquo;s pick. Swapping a contender in is a one-line change in the recipe.</p>
  </div>
  <div class="mixer" role="group" aria-labelledby="mix-h">
    <h2 id="mix-h">Mixer</h2>
    <label class="fader" for="vol-master">Master <input type="range" id="vol-master" min="0" max="100" value="80"><output id="out-master">80</output></label>
    <label class="fader" for="vol-effects">Effects <input type="range" id="vol-effects" min="0" max="100" value="90"><output id="out-effects">90</output></label>
    <label class="fader" for="vol-ambient">Ambience <input type="range" id="vol-ambient" min="0" max="100" value="50"><output id="out-ambient">50</output></label>
    <div class="row"><button type="button" class="pbtn" data-cue="ambient.wind"><span class="tri" aria-hidden="true"></span>Wind loop</button><button type="button" class="pbtn" data-cue="ambient.camp"><span class="tri" aria-hidden="true"></span>Camp loop</button><button type="button" class="pbtn" id="stop-all">Stop all</button></div>
    <p class="status" id="status" role="status" aria-live="polite">Nothing playing yet. Sound starts only after you press a button.</p>
  </div>
  <nav aria-label="Sections"><ul class="toc"><li><a href="#s-palette">Palette</a></li><li><a href="#s-scenes">Scenes</a></li>{''.join(toc)}<li><a href="#s-mix">Mixing</a></li><li><a href="#s-sources">Sources</a></li></ul></nav>
</header>
<section id="s-palette" aria-labelledby="h-pal">
  <div class="sec-head"><h2 id="h-pal">The palette</h2><p>Gritty comes from real recordings of real objects; readable comes from giving each kind of event one material and one shape, and keeping every sound short.</p></div>
  <div class="two">
  <div class="table-wrap"><table><thead><tr><th>Game thing</th><th>Material</th><th>Shape</th></tr></thead><tbody>
  <tr><td>Units (select, move, death)</td><td>A real coin on varnished wood</td><td>Tap, slide, spin-down</td></tr>
  <tr><td>Hits</td><td>Struck metal (anvil, plates, blades)</td><td>Light = bright and short; heavy = anvil with a body punch</td></tr>
  <tr><td>Blocked by armour or Forcefield</td><td>Blade ping</td><td>High, thin, fast decay</td></tr>
  <tr><td>Hit on a defending unit</td><td>Iron plate thud</td><td>Low, dull, no ring</td></tr>
  <tr><td>Swings and shots</td><td>Air (sticks, bamboo, bow)</td><td>No metal, so the hit carries the material</td></tr>
  <tr><td>Interface</td><td>Stone piece, clay chip, card, map, book</td><td>Dry, under 0.6 s</td></tr>
  <tr><td>Turn signals</td><td>Bronze bell (you), war drum (enemy), horn (first contact)</td><td>One strike each</td></tr>
  <tr><td>Abilities</td><td>One physical gesture each: bowl, gong, chain, clockwork, cauldron, cloth</td><td>Never a synth riser or zap</td></tr>
  </tbody></table></div>
  <div class="card"><h3>Rules that keep it readable</h3><ul class="small">
    <li>No cue is longer than 2.4 s except the three result stingers and the loops.</li>
    <li>Heavy impacts duck the interface by 6 dB and the ambience by 4 dB for about half a second.</li>
    <li>At most 16 voices, with per-cue caps (move steps 3, heavy hits 2, big abilities 1).</li>
    <li>Repeated cues get &plusmn;0.3 to 0.6 semitones and &plusmn;1 to 1.5 dB per play, so they do not machine-gun.</li>
    <li>Peaks sit at about &minus;3 dBFS; the <code>gain</code> in <code>cues.json</code> sets each cue&rsquo;s place in the mix.</li>
    <li>References: <em>Into the Breach</em> for one clear sound per event; <em>Darkest Dungeon</em> and <em>Battle Brothers</em> for the dry, physical grit.</li>
  </ul></div>
  </div>
</section>
<section id="s-scenes" aria-labelledby="h-sc">
  <div class="sec-head"><h2 id="h-sc">Hear it in context</h2><p>Short scripted moments using the chosen sounds, the cue gains, the per-play jitter and the ducking rule.</p></div>
  <ul class="scenes">{scene_html}</ul>
</section>
{''.join(sections)}
<section id="s-mix" aria-labelledby="h-mix">
  <div class="sec-head"><h2 id="h-mix">Mixing defaults</h2><p>From <code>cues.json</code>. Output level = cue gain &times; bus level &times; the effects or ambience slider &times; master.</p></div>
  <div class="table-wrap"><table><thead><tr><th>Bus</th><th class="n">Level</th><th class="n">Pitch jitter</th><th class="n">Level jitter</th><th class="n">Voices</th><th class="n">Priority</th></tr></thead><tbody>
  {''.join(f'<tr><th scope="row">{b}</th><td class="n">{BL[b]:.2f}</td><td class="n">&plusmn;{BD[b]["pitch"]} st</td><td class="n">&plusmn;{BD[b]["gainj"]} dB</td><td class="n">{BD[b]["voices"]}</td><td class="n">{BD[b]["prio"]}</td></tr>' for b in BD)}
  </tbody></table></div>
  <p class="note">Ducking: heavy hits, big deaths, mine explosions, Forceful slam and Smite pull the interface down 6 dB and the ambience 4 dB (10 ms attack, 120 ms hold, 350 ms release); result stingers pull everything down 10 dB; turn signals pull the ambience down 3 dB. Browsers keep audio suspended until the first click or key press, so the game shows a muted speaker until then.</p>
</section>
<section id="s-sources" aria-labelledby="h-src">
  <div class="sec-head"><h2 id="h-src">Sources and licences</h2><p>Every file is CC0 1.0, checked on each pack or sound page on {DATE}. Full per-file credits are in <code>apps/web/public/assets/ATTRIBUTION.md</code>; total shipped audio is {total_game / 1e6:.1f} MB for {n_files} sounds in two formats.</p></div>
  <div class="table-wrap"><table><thead><tr><th>Source</th><th>Page</th><th>Licence</th><th>Authors used</th><th class="n">Layer uses</th></tr></thead><tbody>{''.join(src_rows)}</tbody></table></div>
  <p class="note">Rejected sources: the Sonniss GDC bundles (royalty-free, but the licence forbids supplying the files as sound effects to others, which a public web game does, and it bans AI training); a Freesound trumpet fanfare by bevibeldesign (labelled CC0 but made from a CC BY 4.0 recording); Kenney Sci-Fi and Digital audio (off-style).</p>
</section>
</div>'''

data_js = "window.SOUND_DATA = " + json.dumps(pdata, ensure_ascii=False, separators=(",", ":")) + ";"
artifact = (f'<title>Coin Duel Sound Direction</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{head_fonts}\n<style>{CSS}</style>\n'
            f'{body}\n<script>{data_js}</script>\n<script>{JS}</script>\n')
local = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
         f'<title>Coin Duel Sound Direction</title>\n<link rel="icon" href="data:,">\n{head_fonts}\n<style>[hidden]{{display:none !important}}{CSS}</style>\n</head>\n<body>\n'
         f'{body}\n<script>{data_js}</script>\n<script>{JS}</script>\n</body>\n</html>\n')
os.makedirs(os.path.join(OUT, "site"), exist_ok=True)
open(os.path.join(OUT, "site", "index.html"), "w", encoding="utf-8").write(artifact)
open(os.path.join(OUT, "site", "local.html"), "w", encoding="utf-8").write(local)
print("cues", len(cues), "manifest entries", len(entries), "site", len(artifact), "bytes")
