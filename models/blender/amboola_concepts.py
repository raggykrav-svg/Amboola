# AMBOOLA sports-car concepts: 20 design ideas for the game's own car company, rendered in Blender.
#
#   blender -b --factory-startup --python models/blender/amboola_concepts.py -- --car all --renders DIR --views front34 --no-export
#
# They share the AMBOOLA design language from the Mega Taxi: tiger stripes, an "A"-shaped front grille, slanted fang
# headlights, and (on the wilder ones) a red spike crest and two little horns. Each concept mixes:
#   base  'mid' (mid-engine, supercars.TFER) | 'wedge' (sharp wedge, supercars.TLAM) | 'gt' (front-engine, supercars.TFGT)
#   size  the x map (overhangs, wheelbase), width and height
#   aero  swan wing, post wing, blade, ducktail, twin fins or a clean low-drag tail
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main, srgb
from supercars import TFER, TLAM, TFGT, remap, SOFT, SHARP, hex_exhaust

BASES = {   # station table, base axle x (front, rear), base end x (front, rear), glass
    'mid': (TFER, (1.36, -1.30), (2.31, -2.33), SOFT),
    'wedge': (TLAM, (1.50, -1.28), (2.47, -2.50), SHARP),
    'gt': (TFGT, (1.62, -1.10), (2.36, -2.38), SOFT),
}

def glass_mid(k, X, Z, hw):
    bx, bz, tx = 0.85, 0.86, 0.20; tz = bz + (bx - tx) * 0.45
    k.windscreen(X(bx), X(tx), Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), 0.62 * hw, 0.50 * hw, sweep=0.24)
    k.side_glass([(X(x), Z(z)) for x, z in [(0.70, 0.86), (0.45, 0.98), (0.15, 1.12), (-0.25, 1.16), (-0.65, 1.10), (-1.0, 0.98)]],
                 [(X(x), Z(z)) for x, z in [(0.70, 0.855), (-0.30, 0.87), (-1.0, 0.95)]])
def glass_wedge(k, X, Z, hw):
    bx, bz, tx = 0.95, 0.82, 0.05; tz = bz + (bx - tx) * 0.33
    k.windscreen(X(bx), X(tx), Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), 0.66 * hw, 0.52 * hw, sweep=0.26)
    k.side_glass([(X(x), Z(z)) for x, z in [(0.92, 0.84), (0.55, 0.96), (0.20, 1.075), (-0.20, 1.105), (-0.60, 1.055), (-0.95, 0.965)]],
                 [(X(x), Z(z)) for x, z in [(0.92, 0.835), (0.0, 0.85), (-0.95, 0.945)]])
def glass_gt(k, X, Z, hw):
    bx, bz, tx = 0.36, 0.93, -0.22; tz = bz + (bx - tx) * 0.55
    k.windscreen(X(bx), X(tx), Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), 0.62 * hw, 0.54 * hw, sweep=0.22)
    k.side_glass([(X(x), Z(z)) for x, z in [(0.30, 0.93), (0.10, 1.06), (-0.20, 1.215), (-0.60, 1.24), (-1.00, 1.15), (-1.35, 1.00)]],
                 [(X(x), Z(z)) for x, z in [(0.30, 0.925), (-0.60, 0.94), (-1.35, 0.975)]])
GLASS = {'mid': glass_mid, 'wedge': glass_wedge, 'gt': glass_gt}

def roadster(rows):
    """drop the roof to the beltline over the cabin (speedster)"""
    out = []
    for r in rows:
        r = list(r)
        if -1.1 < r[0] < 0.9: r[7] = r[5] + .02; r[9] = r[5] + .03; r[10] = r[5] + .04; r[6] = r[4] * .9; r[8] = r[4] * .6
        out.append(tuple(r))
    return out

def concept(d):
    def build(k):
        rows, (bf, br), (ef, er), crease = BASES[d['base']]
        L = d.get('L', 4.7); wb = d.get('wb', 2.7); fo = d.get('fo', 1.0)
        fa = wb / 2 + d.get('shift', 0.0); ra = fa - wb; fe = fa + fo; re = ra - (L - wb - fo)
        xs = [(er, re), (br, ra), (bf, fa), (ef, fe)]; X = lambda x: pl(xs, x)
        hz = d.get('h', 1.0); Z = lambda z: z if z < 0.6 else 0.6 + (z - 0.6) * hz
        base_rows = roadster(rows) if d.get('open') else rows
        if d.get('duck'): base_rows = edit(edit(base_rows, base_rows[-2][0], zt=base_rows[-2][10] + .05), base_rows[-1][0], zt=base_rows[-1][10] + .08, zr=base_rows[-1][9] + .08)
        k.loft(stations(remap(base_rows, xs, d.get('w', 1.0), Z)), **crease)
        r = d.get('r', 0.35)
        k.arches(dict(F=dict(x=fa, r=r - .01, w=0.26, y=0.85 * d.get('w', 1.0), rim=0.254), R=dict(x=ra, r=r, w=0.33, y=0.86 * d.get('w', 1.0), rim=0.267)))
        k.surface()
        k.M['Stripe'] = k.material('Stripe', srgb(d['stripe']), rough=0.3, coat=1.0)
        if d.get('open'):
            k.windscreen(X(0.80), X(0.55), Z(0.86), 0.5, 0.60, 0.50, sweep=0.2)
            for s in (1, -1): k.cylinder('hoop', 'Carbon', (X(-0.70), s * 0.32, Z(0.95)), 0.16, 0.08, axis='Y', segs=16)
            k.interior(X(-0.20), 1.25, Z(0.62), h=0.30, seats_x=X(-0.42), seat_z=Z(0.72), open_top=True)
        else:
            GLASS[d['base']](k, X, Z, d.get('w', 1.0))
            k.interior(X(-0.20), 1.25, Z(0.62), h=0.30, seats_x=X(-0.42), seat_z=Z(0.72))
        # tiger stripes: slanted bands down both flanks, and chevrons over the bonnet
        n = d.get('stripes', 5)
        for s in (1, -1):
            for i in range(n):
                x0 = lerp(fe - 0.55, re + 0.75, i / max(1, n - 1))
                k.slanted('tiger', 'Stripe', s, x0, x0 - 0.20, 0.28, 0.80, lean=0.30, nu=3, nv=6)
            k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.13, 0.20, 30, 2)
            k.slanted('intake', 'Gloss', s, X(-0.35), X(-0.95), 0.45, 0.80, lean=0.2, nu=6, nv=6)
        for i in range(3):   # tiger slashes raking back over the bonnet
            x0 = fe - 0.40 - i * 0.34
            both(lambda s: k.project('slash', 'Stripe', lambda u, v: k.VIEW['top'](x0 - u * 0.42 - v * 0.09, s * (0.08 + u * 0.50)), 6, 2))
        # the AMBOOLA face: an "A"-shaped grille and slanted fang headlights
        k.project('agrille', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.50, 0.08, v), lerp(0.14, 0.52, v)), 14, 6)
        k.decal('abar', 'Stripe', 'front', -0.27, 0.27, 0.28, 0.31, 10, 1, off=.008)
        k.lamp((fe - 0.25, 0.66 * d.get('w', 1.0), 0.62), (0.72, 0.30, 0.55), 0.30, 0.10, 'quad', slant=0.08, taper=0.45)
        k.decal('splitter', 'Carbon', 'front', -0.9, 0.9, 0.13, 0.17, 30, 2)
        # rear: full-width light bar, diffuser, pipes
        k.light_bar(X(-1.70), 0.82, 0.86, 0.80, bg=0.015, frac=0.75)
        k.fan('diffuser', 'Carbon', X(-1.70), 0.26, 0.44, -0.70, 0.70, 30, 3)
        if not d.get('ev'): hex_exhaust(k, 0.0, 0.48, r=0.07, mirror=False) if d.get('center_pipe') else k.exhaust(0.45, 0.40, r=0.05)
        k.mirrors(X(0.62), 1.07 * d.get('w', 1.0), Z(0.93), size=(0.13, 0.17, 0.08))
        # aero
        rz = lambda x: k.deck_z(x, 0.0)
        a = d.get('aero', 'none'); tail = re + 0.30
        if a == 'swan':
            k.swan_wing(tail - 0.05, rz(tail) + 0.42, 0.42, 1.9, tail + 0.20, 0.35, aoa=-9,
                        endplate=[(tail + 0.02, rz(tail) + 0.30), (tail, rz(tail) + 0.55), (tail - 0.50, rz(tail) + 0.58), (tail - 0.52, rz(tail) + 0.34)])
        elif a == 'post':
            k.post_wing(tail + 0.05, rz(tail) + 0.34, 0.38, 1.8, tail + 0.15, 0.42, aoa=-9,
                        endplate=[(tail + 0.10, rz(tail) + 0.26), (tail + 0.10, rz(tail) + 0.48), (tail - 0.40, rz(tail) + 0.52), (tail - 0.42, rz(tail) + 0.30)])
        elif a == 'blade':
            k.spoiler(tail - 0.05, rz(tail) + 0.05, 0.30, 1.75, aoa=-8, mat='Carbon', strut_y=0.40)
        elif a == 'spoiler':
            k.wing(tail + 0.05, rz(tail) + 0.04, 0.22, 1.6, aoa=-6, thick=0.08, mat='Gloss', name='lip')
        if d.get('fins'):
            for s in (1, -1): k.plate('fin', 'Carbon', [(X(-0.9), Z(1.0)), (X(-1.4), Z(1.12)), (re + 0.25, Z(1.05)), (re + 0.25, Z(0.95))], s * 0.42, t=0.012)
        if d.get('scoop'): k.box('scoop', 'Gloss', (X(-0.10), 0, rz(X(-0.10)) + 0.06), (0.55, 0.36, 0.14), bevel=0.04)
        if d.get('crest'):   # red spike crest along the roof spine
            for i in range(9):
                x = X(0.10) - i * 0.12; z = rz(x); h = 0.08 + 0.05 * math.sin(i / 8 * math.pi)
                k.cylinder('crest', 'Taillight', (x, 0, z + h / 2 - 0.01), 0.025, h, axis='Z', segs=6, r2=0.002)
        if d.get('horns'):
            for s in (1, -1):
                x = fe - 0.75; z = k.deck_z(x, s * 0.62)
                k.cylinder('horn', 'Stripe', (x, s * 0.62, z + 0.08), 0.035, 0.18, axis='Z', segs=8, r2=0.004)
        k.join(); k.wheels(spokes=d.get('spokes', 10), nut='centrelock')
    return build

C = [
    # id, name, base, look
    dict(id='tora', base='wedge', L=4.75, wb=2.75, stripe='#c8141b', aero='swan', crest=True, horns=True, paint='#7cc8e8', rim='#c8141b', cal='#c8141b'),
    dict(id='raiden', base='wedge', L=4.85, wb=2.8, h=0.92, stripe='#111113', aero='none', ev=True, paint='#f6d10f', rim='#111113', cal='#111113', stripes=6),
    dict(id='kaze', base='mid', L=5.2, wb=2.75, fo=1.05, h=0.9, stripe='#16a3cc', aero='none', fins=True, paint='#f2f2f0', rim='#9aa0a8', cal='#16a3cc'),
    dict(id='oni', base='wedge', L=4.8, wb=2.75, w=1.04, stripe='#c8141b', aero='post', crest=True, horns=True, paint='#0d0d0f', rim='#c8141b', cal='#c8141b', center_pipe=True),
    dict(id='sakura', base='gt', L=4.7, wb=2.75, fo=1.1, stripe='#f8f8f6', aero='none', duck=True, paint='#f2a5c0', rim='#f2f2f2', cal='#f8f8f6', stripes=4, spokes=5),
    dict(id='ryu', base='mid', L=4.75, wb=2.7, stripe='#d5b46a', aero='post', fins=True, paint='#1f7a3a', rim='#d5b46a', cal='#d5b46a'),
    dict(id='kitsune', base='mid', L=4.15, wb=2.45, fo=0.9, stripe='#f8f8f6', aero='spoiler', paint='#ff6a13', rim='#111113', cal='#f8f8f6', stripes=4, spokes=5),
    dict(id='shogun', base='wedge', L=4.95, wb=2.8, w=1.03, stripe='#d5b46a', aero='swan', crest=True, paint='#4a1d6c', rim='#d5b46a', cal='#d5b46a', center_pipe=True),
    dict(id='samurai', base='mid', L=4.6, wb=2.65, stripe='#111113', aero='blade', horns=True, paint='#c1111b', rim='#111113', cal='#f2c20f'),
    dict(id='yuki', base='gt', L=4.5, wb=2.6, h=1.08, r=0.37, stripe='#7cc8e8', aero='spoiler', scoop=True, paint='#f4f6f8', rim='#7cc8e8', cal='#7cc8e8', spokes=6),
    dict(id='neon', base='wedge', L=4.6, wb=2.7, stripe='#ff3fa4', aero='spoiler', ev=True, paint='#16a3cc', rim='#ff3fa4', cal='#ff3fa4', stripes=6),
    dict(id='hayabusa', base='mid', L=5.3, wb=2.8, fo=1.05, h=0.88, stripe='#1d3a70', aero='none', fins=True, paint='#c4c8cc', rim='#1d3a70', cal='#1d3a70'),
    dict(id='kaminari', base='mid', L=4.5, wb=2.65, open=True, stripe='#111113', aero='none', paint='#f2c20f', rim='#111113', cal='#111113', horns=True),
    dict(id='tsunami', base='gt', L=4.8, wb=2.8, fo=1.05, stripe='#f8f8f6', aero='blade', paint='#1f4fa8', rim='#f8f8f6', cal='#f8f8f6', stripes=6),
    dict(id='taiyo', base='wedge', L=4.7, wb=2.75, stripe='#c8141b', aero='post', ev=True, paint='#f0a020', rim='#c8141b', cal='#c8141b'),
    dict(id='kuro', base='mid', L=4.7, wb=2.7, stripe='#3a3d41', aero='swan', paint='#141416', rim='#3a3d41', cal='#c8141b', crest=True),
    dict(id='hoshi', base='gt', L=4.95, wb=2.9, fo=1.1, stripe='#c4c8cc', aero='none', duck=True, paint='#16295c', rim='#c4c8cc', cal='#c4c8cc', stripes=4, spokes=5),
    dict(id='kasai', base='wedge', L=4.8, wb=2.75, w=1.03, stripe='#f6d10f', aero='post', crest=True, horns=True, paint='#ff4b1f', rim='#111113', cal='#f6d10f', center_pipe=True),
    dict(id='minitora', base='mid', L=3.95, wb=2.35, fo=0.85, h=0.95, stripe='#c8141b', aero='spoiler', horns=True, paint='#7cc8e8', rim='#c8141b', cal='#c8141b', stripes=4, spokes=5),
    dict(id='torazero', base='wedge', L=5.0, wb=2.85, w=1.05, h=0.9, stripe='#c8141b', aero='swan', fins=True, crest=True, horns=True, paint='#f4f4f2', rim='#c8141b', cal='#c8141b', ev=True, stripes=6),
]
CARS = {d['id']: (concept(d), d['paint'], d['rim'], d['cal']) for d in C}

if __name__ == '__main__':
    main(CARS, 'amboola_concepts.py')
