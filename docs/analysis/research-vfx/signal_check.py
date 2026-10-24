"""Signal-colour check for VFX (docs/analysis/research-vfx.md, section 3).

Usage:  python signal_check.py [output.json]

Checks the proposed effect ("signal") colours against the 7 grade colours of palette D (default) and
palette C (Clarity mode), and against each other, in normal vision and under simulated deuteranopia,
protanopia and tritanopia (Machado et al. 2009, severity 1.0) and greyscale, using CIEDE2000.
It reuses the maths of ../research-art/cvd_check.py, so both documents use one method.
Thresholds (same heuristic as research-art.md 5.1): dE00 >= 20 distinct at a glance; 12-20 distinct
side by side; < 10 confusable, so the pair needs a non-colour (shape) cue.
"""
import importlib.util, itertools, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cvd', os.path.join(HERE, '..', 'research-art', 'cvd_check.py'))
cvd = importlib.util.module_from_spec(spec); spec.loader.exec_module(cvd)

SIGNALS = {  # name: (hex, role)
    'EMBER':   ('#F24E1E', 'damage, hits, blasts, attack reach'),
    'MINT':    ('#96DDB4', 'heal, regeneration, revive'),
    'STEEL':   ('#86A6CF', 'damage prevented: Defend, armour, Line Formation, Forcefield, Hex Ward'),
    'GILT':    ('#F6EC93', 'buff gained: Power, extra action, AP bonus'),
    'TARNISH': ('#A27CFA', 'debuff or cost: weakness, sacrifice, toughness lost, max-toughness cost, AP debt'),
    'ASSAY':   ('#4FE3F5', 'vision and detection: reveal, Mind\'s Eye, mine revealed, LOV preview'),
    'IVORY':   ('#F3EAD2', 'system and neutral: Blocked!, banners, plaques'),
}
INK = '#1B1410'
SAND = ['#D9CBA6', '#CFBF97']
GRADES = {
    'D': {'1': '#E9ECEF', '2': '#E8B923', '5': '#2B2B2E', '10': '#A81E2B', '20': '#1B4597', '50': '#A05BB8', '100': '#4DA457'},
    'C': {'1': '#4A2C17', '2': '#2F4C7C', '5': '#8E5B2A', '10': '#5C8CC4', '20': '#D2A43C', '50': '#A3D0F2', '100': '#FFF1B5'},
}
KINDS = ['normal', 'deutan', 'protan', 'tritan', 'grey']

def d(a, b, k):
    return cvd.de2000(cvd.rgb2lab(cvd.simulate(a, k)), cvd.rgb2lab(cvd.simulate(b, k)))

def main():
    out = {'_note': 'Generated for docs/analysis/research-vfx.md section 3. Method: research-art.md Appendix B.',
           'ink': INK, 'signals': {}, 'pairs': {}}
    chromatic = {n: v for n, v in SIGNALS.items() if n != 'IVORY'}
    for name, (hexc, role) in SIGNALS.items():
        row = {'hex': hexc, 'role': role, 'Lstar': round(cvd.rgb2lab(hexc)[0], 1),
               'contrastOnInk': round(cvd.contrast(hexc, INK), 2),
               'contrastOnSand': round(min(cvd.contrast(hexc, s) for s in SAND), 2),
               'sim': {k: cvd.simulate(hexc, k) for k in KINDS[1:]}, 'nearestGrade': {}}
        for pal, grades in GRADES.items():
            row['nearestGrade'][pal] = {k: min((round(d(hexc, g, k), 1), grade) for grade, g in grades.items()) for k in KINDS}
        out['signals'][name] = row
    for k in KINDS:
        pairs = sorted((round(d(chromatic[a][0], chromatic[b][0], k), 1), a, b) for a, b in itertools.combinations(chromatic, 2))
        out['pairs'][k] = {'min': pairs[0], 'worst3': pairs[:3]}
    print('signal   hex      L*    ink   sand | nearest D grade: normal / deutan / protan / tritan | nearest C grade: normal / deutan / protan')
    for name, row in out['signals'].items():
        nd, nc = row['nearestGrade']['D'], row['nearestGrade']['C']
        print(f"{name:8} {row['hex']} {row['Lstar']:5} {row['contrastOnInk']:5} {row['contrastOnSand']:5} | "
              f"{nd['normal']} {nd['deutan']} {nd['protan']} {nd['tritan']} | {nc['normal']} {nc['deutan']} {nc['protan']}")
    for k in KINDS:
        print(f"signals vs signals, min dE00 {k:7}: {out['pairs'][k]['worst3']}")
    if len(sys.argv) > 1:
        json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), indent=1)

if __name__ == '__main__':
    main()
