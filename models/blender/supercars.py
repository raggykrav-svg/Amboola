# Lamborghini and Ferrari models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/supercars.py -- --car all
#   blender -b --factory-startup --python models/blender/supercars.py -- --car svj --renders DIR --sheet --samples 8
#
# Car ids match index.html CARS. Lamborghinis use high creases for their sharp, faceted wedge shapes; Ferraris use
# soft creases for flowing curves.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main

SHARP = dict(crease_lines=0.85, crisp_front=-9, crisp=0.75, crease_front=0.8, crease_rear=0.9)
SOFT = dict(crease_lines=0.2, crisp_front=0.7, crisp=0.15, crease_front=0.45, crease_rear=0.6)

def remap(rows, xs, ys=1.0, zf=lambda z: z):
    """reuse a station table on another car: xs = [(old x, new x), ...] anchor pairs, ys scales widths, zf maps heights"""
    out = []
    for r in rows:
        r = list(r); r[0] = pl(xs, r[0])
        for i in (2, 4, 6, 8): r[i] *= ys
        for i in (1, 3, 5, 7, 9, 10): r[i] = zf(r[i])
        out.append(tuple(r))
    return out

def hex_exhaust(k, y, z, r=0.07, mirror=True):
    """Lamborghini hexagonal tailpipes, high in the rear grille"""
    for s in ((1, -1) if mirror and y else (1,)):
        p, _ = k.hit((-6, s * y, z), (1, 0, 0)); px = (p.x if p else -2.4) + .03
        k.cylinder('exhaust', 'Titanium', (px, s * y, z), r, 0.14, segs=6, caps=False)
        k.cylinder('exhaustin', 'Black', (px + .01, s * y, z), r * .88, 0.12, segs=6)

def y_lights(k, c, f, size=0.15):
    """Lamborghini Y-shaped LED signature inside a slim black headlight"""
    k.headlight_quad(c, f, size * 2.0, size * 0.75, slant=0.03, dots='row')
    for s in (1, -1):
        cs, fs = V(c[0], s * c[1], c[2]), V(f[0], s * f[1], f[2])
        _, e1, e2 = k.basis(fs)
        for dx, dy, w, h, sl in ((0, size * .32, size * 1.3, .012, 0.0), (-size * .55, -size * .05, size * .9, .012, size * .5), (size * .55, -size * .05, size * .9, .012, -size * .5)):
            k.rect('ydrl', 'Headlight', cs + e1 * dx * s + e2 * dy, fs, w, h, .012, nu=6, nv=1, slant=sl * s)

def y_tails(k, ox, z0, z1, a0, a1):
    """Y / hexagonal tail lights at the rear corners, over a black rear grille"""
    k.tail_clusters(ox, z0, z1, a0, a1)
    for s in (1, -1):
        k.fan('tailY', 'Taillight', ox, z0 - .06, z0, s * a0, s * (a0 + (a1 - a0) * .4), 6, 2, off=.007)

# ======================================================================= Lamborghini V12 (Revuelto / Aventador SVJ)
# front axle x=1.50, rear axle x=-1.28, 4.95 m long, 2.03 m wide, 1.14 m tall
TLAM = [
    ( 2.47, .24, .70, .34, .68, .38, .56, .40, .30, .41, .41),
    ( 2.38, .14, .88, .38, .86, .46, .72, .50, .42, .50, .49),
    ( 2.15, .13, .96, .44, .94, .58, .80, .62, .48, .58, .57),
    ( 1.85, .12, .99, .50, .975, .68, .84, .72, .50, .66, .645),
    ( 1.50, .12, 1.0, .54, .985, .75, .85, .79, .50, .73, .72),
    ( 1.15, .12, .985, .55, .97, .80, .84, .84, .52, .80, .79),
    ( 0.80, .11, .96, .55, .945, .82, .80, .86, .56, .92, .93),
    ( 0.40, .11, .945, .54, .93, .84, .74, .96, .58, 1.06, 1.08),
    (-0.10, .11, .95, .55, .935, .86, .70, 1.0, .58, 1.12, 1.14),
    (-0.55, .11, .98, .58, .96, .88, .70, .99, .56, 1.08, 1.10),
    (-0.95, .12, 1.01, .62, .99, .92, .72, .98, .50, 1.03, 1.04),
    (-1.28, .14, 1.015, .64, .995, .95, .72, .99, .45, 1.01, 1.02),
    (-1.70, .18, 1.01, .65, .99, .96, .70, .995, .45, 1.0, 1.0),
    (-2.10, .22, .98, .64, .96, .96, .66, .99, .42, .99, .99),
    (-2.38, .28, .90, .62, .88, .94, .58, .97, .36, .97, .97),
    (-2.50, .36, .72, .60, .70, .90, .46, .92, .28, .92, .92),
]
WLAM = dict(F=dict(x=1.50, r=0.345, w=0.255, y=0.86, rim=0.254), R=dict(x=-1.28, r=0.37, w=0.355, y=0.86, rim=0.279))

def lambo_v12(k, wing):
    k.loft(stations(TLAM), **SHARP); k.arches(WLAM, gap=0.05); k.surface()
    k.windscreen(0.95, 0.05, 0.82, 0.33, 0.66, 0.52, sweep=0.26)
    k.side_glass([(0.92, 0.84), (0.55, 0.96), (0.20, 1.075), (-0.20, 1.105), (-0.60, 1.055), (-0.95, 0.965)],
                 [(0.92, 0.835), (0.0, 0.85), (-0.95, 0.945)])
    k.decal('roof', 'Carbon', 'top', -0.55, 0.05, -0.50, 0.50, 12, 10, off=.003)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), 0.90 - .004, 0.90 + .004, 0.22, 0.83, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, -0.30, -0.95, 0.40, 0.80, lean=0.25, nu=8, nv=8)
        k.decal('skirt', 'Carbon', side(s), -0.90, 1.05, 0.13, 0.22, 30, 2)
        k.decal('scoop', 'Gloss', 'top', -1.05, -0.70, s * 0.72, s * 0.92, 4, 4)       # shoulder air scoops
    for i in range(6):   # louvred engine cover
        k.decal('louvre', 'Gloss', 'top', -2.15 + i * .14, -2.07 + i * .14, -0.55, 0.55, 2, 12)
    y_lights(k, (2.18, 0.70, 0.62), (0.70, 0.30, 0.55))
    k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.18, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.42, s * 0.88, 0.17, 0.40, 12, 6))
    k.decal('splitter', 'Carbon', 'front', -0.92, 0.92, 0.14, 0.18, 30, 2)
    k.fan('rearbg', 'Gloss', -1.80, 0.40, 0.92, -0.62, 0.62, 30, 8, off=.003)            # black rear grille
    y_tails(k, -1.80, 0.80, 0.90, 0.40, 0.70)
    k.fan('diffuser', 'Carbon', -1.80, 0.26, 0.40, -0.70, 0.70, 30, 3)
    k.mirrors(0.70, 1.10, 0.92, size=(0.14, 0.18, 0.08))
    k.interior(-0.20, 1.30, 0.62, h=0.30, seats_x=-0.45, seat_z=0.72)
    wing(k)

def revuelto(k):
    def wing(k):
        hex_exhaust(k, 0.10, 0.66, r=0.06)
        k.spoiler(-2.20, 1.04, 0.30, 1.50, aoa=-6, mat='Carbon', strut_y=0.40)
    lambo_v12(k, wing)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.03, 0.02))

def svj(k):
    def wing(k):
        hex_exhaust(k, 0.13, 0.68, r=0.065)
        k.post_wing(-1.90, 1.22, 0.40, 1.86, -2.05, 0.42, aoa=-8,
                    endplate=[(-1.84, 1.17), (-1.86, 1.32), (-2.36, 1.36), (-2.40, 1.22), (-2.22, 1.15)])
        k.pod('fin', 'Carbon', [(-0.95, 0.0, 1.06, 0.01, 0.01), (-1.20, 0.0, 1.07, 0.012, 0.06), (-1.90, 0.0, 1.03, 0.012, 0.05)], mirror=False, sub=1)
    lambo_v12(k, wing)
    k.join(); k.wheels(spokes=10)

# ======================================================================= Lamborghini V8/V10 (Temerario / Huracan STO / Sterrato)
# front axle x=1.38, rear axle x=-1.24, 4.55 m long, 1.93 m wide, 1.22 m tall
HX = [(-2.50, -2.30), (-1.28, -1.24), (1.50, 1.38), (2.47, 2.27)]
def hx(x): return pl(HX, x)
THUR = remap(TLAM, HX, ys=0.95, zf=lambda z: z + max(0.0, z - 0.85) * 0.32)
WHUR = dict(F=dict(x=1.38, r=0.34, w=0.245, y=0.81, rim=0.254), R=dict(x=-1.24, r=0.35, w=0.305, y=0.815, rim=0.254))

def huracan(k, wheels=WHUR, side_vents=True):
    k.loft(stations(THUR), **SHARP); k.arches(wheels, gap=0.05); k.surface()
    k.windscreen(hx(0.95), hx(0.05), 0.82, 0.38, 0.62, 0.50, sweep=0.24)
    zc = lambda z: z + max(0.0, z - 0.85) * 0.32
    k.side_glass([(hx(x), zc(z)) for x, z in [(0.92, 0.84), (0.55, 0.96), (0.20, 1.075), (-0.20, 1.105), (-0.60, 1.055), (-0.95, 0.965)]],
                 [(hx(x), zc(z)) for x, z in [(0.92, 0.835), (0.0, 0.85), (-0.95, 0.945)]])
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), hx(0.90) - .004, hx(0.90) + .004, 0.22, 0.83, 1, 12, off=.002)
        if side_vents: k.slanted('sideintake', 'Gloss', s, hx(-0.35), hx(-0.95), 0.45, 0.78, lean=0.2, nu=8, nv=8)
    k.decal('intakeC', 'Gloss', 'front', -0.30, 0.30, 0.18, 0.30, 12, 4)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.40, s * 0.82, 0.17, 0.40, 12, 6))
    k.fan('rearbg', 'Gloss', -1.70, 0.40, 0.92, -0.62, 0.62, 30, 8, off=.003)
    k.fan('diffuser', 'Carbon', -1.70, 0.26, 0.40, -0.70, 0.70, 30, 3)
    k.mirrors(hx(0.70), 1.05, 0.95, size=(0.14, 0.18, 0.08))
    k.interior(-0.20, 1.26, 0.66, h=0.30, seats_x=-0.45, seat_z=0.76)

def temerario(k):
    huracan(k)
    # hexagon-shaped LED headlights + hexagonal centre tailpipe and hexagon tail lights
    k.headlight_quad((2.00, 0.66, 0.64), (0.70, 0.30, 0.55), 0.26, 0.10, slant=0.03, dots='row')
    for s in (1, -1):
        k.oval('hexdrl', 'Headlight', V(1.98, s * 0.66, 0.66), V(0.70, s * 0.30, 0.55), 0.06, 0.05, .012, n=3)
        k.fan('hextail', 'Taillight', -1.70, 0.74, 0.86, s * 0.38, s * 0.70, 6, 3, off=.006)
    hex_exhaust(k, 0.0, 0.66, r=0.085, mirror=False)
    k.spoiler(-1.98, 1.08, 0.28, 1.40, aoa=-6, mat='Carbon', strut_y=0.36)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.016))

def sto(k):
    huracan(k)
    y_lights(k, (2.00, 0.66, 0.64), (0.70, 0.30, 0.55), size=0.13)
    y_tails(k, -1.70, 0.80, 0.90, 0.40, 0.70)
    k.naca(1.35, 1.75, 0.16, 0.03, 0.14)
    # roof snorkel, shark fin along the engine cover, big fixed wing, twin pipes
    k.pod('snorkel', 'Paint', [(0.25, 0, 1.25, 0.04, 0.02), (0.10, 0, 1.30, 0.13, 0.07), (-0.40, 0, 1.28, 0.15, 0.06), (-0.70, 0, 1.20, 0.10, 0.03)], mirror=False, flat=0.7)
    k.box('snorkelmouth', 'Gloss', (0.12, 0, 1.31), (0.02, 0.20, 0.06))
    k.pod('fin', 'Paint', [(-0.75, 0.0, 1.16, 0.01, 0.01), (-1.00, 0.0, 1.13, 0.012, 0.07), (-1.80, 0.0, 1.03, 0.012, 0.05)], mirror=False, sub=1)
    k.post_wing(-1.86, 1.20, 0.36, 1.70, -2.00, 0.40, aoa=-9,
                endplate=[(-1.80, 1.15), (-1.82, 1.30), (-2.24, 1.33), (-2.28, 1.20), (-2.14, 1.13)])
    k.exhaust(0.16, 0.80, r=0.05)
    k.join(); k.wheels(spokes=10)

STER_LIFT = 0.06
WSTER = dict(F=dict(x=1.38, r=0.355, w=0.235, y=0.81, rim=0.24, cz=0.355 - STER_LIFT + 0.01, gap=0.07),
             R=dict(x=-1.24, r=0.36, w=0.27, y=0.815, rim=0.24, cz=0.36 - STER_LIFT + 0.01, gap=0.07))
def sterrato(k):
    huracan(k, WSTER)
    y_lights(k, (2.00, 0.66, 0.64), (0.70, 0.30, 0.55), size=0.13)
    y_tails(k, -1.70, 0.80, 0.90, 0.40, 0.70)
    k.arch_trim(0.08)
    both(lambda s: k.decal('cladding', 'Black', side(s), hx(-0.95), hx(1.05), 0.12, 0.30, 30, 3, off=.006))
    k.decal('skid', 'Black', 'front', -0.60, 0.60, 0.14, 0.22, 20, 2, off=.006)
    for s in (1, -1):   # light pods on the nose, roof rails, roof scoop
        k.cylinder('lightpod', 'Black', (2.05, s * 0.32, 0.60), 0.07, 0.10)
        k.cylinder('lightpodlens', 'Headlight', (2.10, s * 0.32, 0.60), 0.058, 0.004)
        k.blade('rail', 'Black', [(0.15, 0, k.deck_z(0.15, s * .50) + .03), (-0.20, 0, k.deck_z(-0.20, s * .50) + .045), (-0.55, 0, k.deck_z(-0.55, s * .50) + .03)], s * 0.50, 0.03, 0.03, 0.025)
    k.pod('snorkel', 'Black', [(0.05, 0, 1.25, 0.04, 0.02), (-0.05, 0, 1.29, 0.12, 0.06), (-0.50, 0, 1.25, 0.13, 0.05)], mirror=False, flat=0.7)
    k.exhaust(0.16, 0.80, r=0.05)
    k.join(lift=STER_LIFT); k.wheels(spokes=10, spoke_w=(0.03, 0.02), nut='bolts', offroad=True)

# ======================================================================= Lamborghini Urus Performante
# front axle x=1.60, rear axle x=-1.40, 5.12 m long, 2.02 m wide, 1.64 m tall
TURUS = [
    ( 2.56, .38, .72, .58, .70, .70, .60, .74, .38, .76, .76),
    ( 2.48, .28, .90, .62, .88, .80, .76, .84, .50, .85, .85),
    ( 2.28, .25, .98, .68, .965, .90, .82, .95, .58, .93, .92),
    ( 1.95, .23, 1.0, .74, .99, .97, .84, 1.01, .60, .99, .98),
    ( 1.60, .22, 1.01, .78, 1.0, 1.02, .85, 1.05, .60, 1.04, 1.03),
    ( 1.20, .21, 1.0, .79, .99, 1.05, .86, 1.08, .60, 1.09, 1.08),
    ( 0.90, .21, .99, .79, .975, 1.08, .86, 1.15, .68, 1.24, 1.26),
    ( 0.45, .21, .985, .78, .97, 1.10, .83, 1.33, .70, 1.56, 1.60),
    ( 0.00, .21, .985, .78, .97, 1.11, .82, 1.37, .71, 1.62, 1.64),
    (-0.60, .21, .99, .79, .975, 1.12, .81, 1.36, .70, 1.58, 1.61),
    (-1.10, .22, 1.0, .81, .985, 1.14, .79, 1.30, .66, 1.48, 1.51),
    (-1.40, .24, 1.01, .82, .99, 1.15, .77, 1.25, .63, 1.40, 1.42),
    (-1.85, .28, 1.0, .83, .98, 1.15, .73, 1.20, .57, 1.27, 1.29),
    (-2.25, .33, .96, .82, .94, 1.14, .67, 1.17, .49, 1.19, 1.20),
    (-2.48, .38, .87, .79, .85, 1.11, .59, 1.14, .41, 1.15, 1.16),
    (-2.57, .44, .67, .75, .65, 1.05, .47, 1.08, .29, 1.09, 1.09),
]
WURUS = dict(F=dict(x=1.60, r=0.385, w=0.29, y=0.845, rim=0.292), R=dict(x=-1.40, r=0.385, w=0.32, y=0.85, rim=0.292))
def urusp(k):
    k.loft(stations(TURUS), **SHARP); k.arches(WURUS); k.surface()
    k.windscreen(1.10, 0.32, 1.10, 0.62, 0.70, 0.62, sweep=0.26)
    k.rear_window(-2.22, -1.15, 1.20, 0.27, 0.50, 0.58)
    k.side_glass([(0.90, 1.12), (0.62, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.45, 1.35), (-1.85, 1.19)],
                 [(0.90, 1.11), (-0.60, 1.125), (-1.45, 1.15), (-1.85, 1.165)], pillars=[-0.15, -1.20], pillar_w=0.06)
    k.decal('roof', 'Carbon', 'top', -1.10, 0.30, -0.58, 0.58, 16, 12, off=.003)
    for s in (1, -1):
        for xg in (0.90, -0.17, -1.25): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.30, 1.12, 1, 14, off=.002)
        k.decal('sill', 'Gloss', side(s), -1.02, 1.20, 0.22, 0.34, 30, 3, off=.005)
    k.arch_trim(0.05, mat='Gloss')
    y_lights(k, (2.38, 0.70, 0.92), (0.72, 0.30, 0.50), size=0.16)
    k.decal('grille', 'Gloss', 'front', -0.52, 0.52, 0.40, 0.70, 18, 6)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.60, s * 0.88, 0.36, 0.66, 10, 8))
    k.decal('lip', 'Carbon', 'front', -0.86, 0.86, 0.28, 0.36, 30, 2)
    k.light_bar(-1.95, 1.04, 1.07, 0.84, bg=0.03, frac=0.5)
    y_tails(k, -1.95, 1.00, 1.11, 0.60, 0.84)
    k.fan('rearpanel', 'Gloss', -1.95, 0.52, 0.66, -0.62, 0.62, 30, 3)
    k.fan('diffuser', 'Carbon', -1.95, 0.40, 0.52, -0.66, 0.66, 30, 3)
    for y in (0.48, 0.62): k.exhaust(y, 0.46, r=0.05)
    k.wing(-1.12, 1.505, 0.18, 1.10, aoa=-4, thick=0.08, mat='Carbon', camber=-0.02, name='roofspoiler')
    k.mirrors(0.84, 1.07, 1.22, size=(0.17, 0.22, 0.12))
    k.interior(-0.45, 1.5, 0.98, l=2.4, h=0.42, seats_x=-0.20, seat_z=1.06)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.27, 0.09, 0.10))

# ======================================================================= Ferrari mid-engine (SF90 / LaFerrari / 296 GTB / F8)
# front axle x=1.36, rear axle x=-1.30, 4.6 m long, 1.98 m wide, 1.19 m tall
TFER = [
    ( 2.31, .26, .64, .38, .62, .44, .50, .46, .30, .46, .455),
    ( 2.22, .15, .86, .42, .84, .52, .70, .58, .42, .54, .53),
    ( 2.00, .13, .95, .48, .93, .62, .78, .69, .48, .60, .59),
    ( 1.70, .12, .98, .54, .965, .71, .80, .77, .50, .67, .655),
    ( 1.36, .12, .99, .58, .975, .78, .80, .83, .50, .74, .725),
    ( 1.00, .11, .97, .60, .955, .82, .78, .85, .50, .80, .79),
    ( 0.70, .11, .94, .58, .925, .84, .76, .88, .56, .92, .94),
    ( 0.30, .11, .925, .57, .91, .85, .72, 1.02, .60, 1.14, 1.16),
    (-0.15, .11, .93, .58, .915, .86, .70, 1.05, .60, 1.17, 1.19),
    (-0.60, .11, .96, .61, .945, .89, .70, 1.02, .57, 1.11, 1.13),
    (-0.95, .12, .985, .64, .97, .92, .70, .99, .50, 1.03, 1.04),
    (-1.30, .15, .99, .66, .975, .95, .68, .98, .46, .99, 1.0),
    (-1.70, .19, .985, .67, .97, .96, .66, .975, .44, .975, .98),
    (-2.05, .24, .95, .66, .93, .95, .60, .965, .40, .965, .965),
    (-2.24, .29, .86, .64, .84, .93, .54, .945, .34, .945, .945),
    (-2.33, .36, .68, .61, .66, .88, .44, .895, .26, .89, .89),
]
WFER = dict(F=dict(x=1.36, r=0.34, w=0.245, y=0.835, rim=0.254), R=dict(x=-1.30, r=0.35, w=0.315, y=0.835, rim=0.254))

def ferrari_mid(k, rows=TFER, tail_round=False):
    k.loft(stations(rows), **SOFT); k.arches(WFER); k.surface()
    k.windscreen(0.85, 0.20, 0.86, 0.45, 0.62, 0.52, sweep=0.24)
    k.side_glass([(0.70, 0.86), (0.45, 0.98), (0.15, 1.12), (-0.25, 1.16), (-0.65, 1.10), (-1.0, 0.98)],
                 [(0.70, 0.855), (-0.30, 0.87), (-1.0, 0.95)])
    k.rear_window(-1.20, -0.82, 0.99, 0.30, 0.38, 0.42, bulge=0.02)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), 0.70 - .004, 0.70 + .004, 0.22, 0.84, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, -0.70, -1.00, 0.55, 0.80, lean=0.10, nu=6, nv=6)
        k.decal('skirt', 'Gloss', side(s), -0.95, 1.00, 0.13, 0.20, 30, 2)
    # slim swept headlights, horizontal grille, splitter
    k.headlight_quad((2.06, 0.68, 0.62), (0.72, 0.32, 0.52), 0.30, 0.085, slant=0.05, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.50, 0.50, 0.20, 0.34, 18, 4)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.15, 0.19, 30, 2)
    if tail_round:   # F8: twin round tail lights per side
        for s in (1, -1):
            for y in (0.56, 0.74): k.oval('tailround', 'Taillight', V(-2.10, s * y, 0.84), V(-1, s * 0.25 * y, 0.1), 0.06, 0.06, .006, n=6)
    else:
        k.light_bar(-1.70, 0.83, 0.87, 0.80, bg=0.015, frac=0.6)
        k.tail_clusters(-1.70, 0.80, 0.89, 0.50, 0.82)
    k.fan('rearpanel', 'Gloss', -1.70, 0.44, 0.62, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.70, 0.30, 0.44, -0.66, 0.66, 30, 3)
    k.mirrors(0.62, 1.07, 0.93, size=(0.14, 0.18, 0.08))
    k.interior(-0.20, 1.28, 0.64, h=0.32, seats_x=-0.42, seat_z=0.74)

def sf90(k):
    ferrari_mid(k)
    for s in (1, -1): k.exhaust(s * 0.13, 0.80, r=0.045, mirror=False)        # high-exit pipes
    k.decal('shutoff', 'Gloss', 'top', -2.20, -2.05, -0.55, 0.55, 4, 10)       # shut-off gurney slot
    k.naca(1.40, 1.75, 0.0, 0.05, 0.30)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

TLAF = [tuple(r[:9]) + (r[9] - max(0, r[9] - .9) * .25, r[10] - max(0, r[10] - .9) * .25) for r in TFER]
def laferrari(k):
    ferrari_mid(k, TLAF)
    k.exhaust(0.0, 0.62, r=0.05, mirror=False); k.exhaust(0.12, 0.62, r=0.05)   # three centre pipes
    k.spoiler(-2.05, 1.0, 0.24, 1.30, aoa=-6, mat='Paint', strut_y=0.35)
    both(lambda s: k.decal('bonnetduct', 'Gloss', 'top', 1.55, 1.85, s * 0.08, s * 0.30, 6, 5))
    k.join(); k.wheels(spokes=10, nut='bolts')

T296 = edit(edit(TFER, -2.24, zt=.985, zr=.98, zg=.97), -2.33, zt=.99, zr=.985, zg=.96, zbl=.91)   # ducktail
def gtb296(k):
    ferrari_mid(k, T296)
    k.exhaust(0.0, 0.86, r=0.06, mirror=False)                                  # single centre high pipe
    both(lambda s: k.decal('bonnetvent', 'Gloss', 'top', 1.60, 1.88, s * 0.10, s * 0.26, 6, 4))
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

def f8(k):
    ferrari_mid(k, T296, tail_round=True)
    k.naca(1.30, 1.75, 0.0, 0.10, 0.36)                                         # S-duct
    for s in (1, -1): k.exhaust(s * 0.55, 0.48, r=0.05, mirror=False)
    k.join(); k.wheels(spokes=10, nut='bolts')

# ======================================================================= Ferrari front-engine V12 (812 Competizione / 12Cilindri)
# front axle x=1.62, rear axle x=-1.10, 4.7 m long, 1.97 m wide, 1.28 m tall
TFGT = [
    ( 2.36, .26, .66, .40, .64, .46, .52, .48, .30, .49, .485),
    ( 2.28, .15, .86, .44, .84, .54, .70, .60, .44, .57, .56),
    ( 2.05, .13, .955, .50, .935, .65, .78, .72, .50, .64, .63),
    ( 1.62, .12, .985, .58, .97, .76, .80, .83, .50, .75, .74),
    ( 1.20, .12, .975, .60, .96, .82, .79, .86, .50, .81, .80),
    ( 0.70, .12, .96, .60, .945, .855, .77, .88, .50, .86, .85),
    ( 0.30, .12, .95, .60, .935, .87, .76, .92, .56, .97, 1.0),
    (-0.05, .12, .945, .59, .93, .88, .73, 1.06, .60, 1.22, 1.25),
    (-0.50, .12, .95, .60, .935, .89, .72, 1.08, .61, 1.25, 1.28),
    (-1.00, .13, .975, .63, .96, .92, .71, 1.04, .58, 1.16, 1.18),
    (-1.40, .16, .985, .65, .97, .94, .68, 1.0, .52, 1.06, 1.07),
    (-1.85, .20, .975, .66, .96, .95, .64, .98, .46, .985, .99),
    (-2.20, .25, .93, .65, .91, .94, .58, .965, .40, .96, .96),
    (-2.38, .33, .72, .62, .70, .89, .46, .91, .28, .905, .905),
]
WFGT = dict(F=dict(x=1.62, r=0.345, w=0.275, y=0.82, rim=0.254), R=dict(x=-1.10, r=0.355, w=0.315, y=0.83, rim=0.254))
def ferrari_gt(k, rows=TFGT):
    k.loft(stations(rows), **SOFT); k.arches(WFGT); k.surface()
    k.windscreen(0.36, -0.22, 0.93, 0.55, 0.62, 0.54, sweep=0.22)
    k.side_glass([(0.30, 0.93), (0.10, 1.06), (-0.20, 1.215), (-0.60, 1.24), (-1.00, 1.15), (-1.35, 1.00)],
                 [(0.30, 0.925), (-0.60, 0.94), (-1.35, 0.975)])
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), 0.32 - .004, 0.32 + .004, 0.22, 0.88, 1, 12, off=.002)
        k.slanted('fendervent', 'Gloss', s, 0.95, 0.80, 0.45, 0.72, lean=0.06, nu=4, nv=6)
        k.decal('skirt', 'Gloss', side(s), -0.90, 1.20, 0.13, 0.20, 30, 2)
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.15, 0.19, 30, 2)
    k.mirrors(0.24, 1.06, 0.98, size=(0.14, 0.18, 0.08))
    k.fan('rearpanel', 'Gloss', -1.80, 0.44, 0.60, -0.62, 0.62, 30, 4)
    k.fan('diffuser', 'Carbon', -1.80, 0.30, 0.44, -0.66, 0.66, 30, 3)
    k.interior(-0.50, 1.30, 0.68, h=0.34, seats_x=-0.75, seat_z=0.78)

T812 = edit(edit(TFGT, -2.20, zt=1.0, zr=.995, zg=.98), -2.38, zt=1.0, zr=.99, zg=.96, zbl=.92)   # ducktail
def c812(k):
    ferrari_gt(k, T812)
    k.rear_window(-1.85, -0.85, 0.99, 0.24, 0.42, 0.50, bulge=0.02)
    for i in range(7):   # louvred carbon rear "window" of the Competizione
        k.decal('blade', 'Carbon', 'top', -1.78 + i * .13, -1.72 + i * .13, -0.44, 0.44, 2, 10, off=.009)
    k.headlight_quad((2.10, 0.72, 0.64), (0.70, 0.32, 0.55), 0.30, 0.09, slant=0.04, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.62, 0.62, 0.20, 0.38, 18, 5)
    k.tail_clusters(-1.80, 0.80, 0.88, 0.45, 0.80)
    for y in (0.46, 0.60): k.exhaust(y, 0.42, r=0.045)
    k.join(); k.wheels(spokes=10, nut='bolts')

def cil12(k):
    ferrari_gt(k)
    k.rear_window(-1.85, -0.85, 0.99, 0.24, 0.42, 0.50, bulge=0.02)
    k.decal('delta', 'Gloss', 'top', -1.95, -1.70, -0.55, 0.55, 6, 12)          # black delta behind the rear glass
    # the 12Cilindri's black band across the nose with slim lights at its ends
    k.fan('band', 'Gloss', 1.20, 0.60, 0.66, -0.62, 0.62, 40, 2, rear=False)
    k.drl_strip((2.12, 0.70, 0.65), (0.75, 0.30, 0.40), 0.28, 0.035)
    k.decal('grille', 'Gloss', 'front', -0.45, 0.45, 0.22, 0.34, 18, 4)
    k.light_bar(-1.80, 0.84, 0.86, 0.80, bg=0.015, frac=1.0)
    for y in (0.48, 0.60): k.exhaust(y, 0.42, r=0.045)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts')

# ======================================================================= Ferrari Purosangue
# front axle x=1.72, rear axle x=-1.30, 4.97 m long, 2.03 m wide, 1.59 m tall
PX = [(-2.57, -2.50), (-1.40, -1.30), (1.60, 1.72), (2.56, 2.48)]
def px(x): return pl(PX, x)
TPURO = remap(TURUS, PX, ys=1.0, zf=lambda z: z * 0.97)
WPURO = dict(F=dict(x=1.72, r=0.38, w=0.275, y=0.86, rim=0.279), R=dict(x=-1.30, r=0.385, w=0.315, y=0.865, rim=0.292))
def purosangue(k):
    k.loft(stations(TPURO), **SOFT); k.arches(WPURO); k.surface()
    k.windscreen(px(1.10), px(0.32), 1.07, 0.62, 0.70, 0.62, sweep=0.26)
    k.rear_window(px(-2.22), px(-1.15), 1.16, 0.27, 0.50, 0.58)
    z = lambda v: v * 0.97
    k.side_glass([(px(x), z(v)) for x, v in [(0.90, 1.12), (0.62, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.45, 1.35), (-1.85, 1.19)]],
                 [(px(x), z(v)) for x, v in [(0.90, 1.11), (-0.60, 1.125), (-1.45, 1.15), (-1.85, 1.165)]], pillars=[px(-0.15), px(-1.20)], pillar_w=0.06)
    for s in (1, -1):
        for xg in (px(0.90), px(-0.17), px(-1.25)): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.30, 1.10, 1, 14, off=.002)
        k.decal('sill', 'Gloss', side(s), px(-1.02), px(1.20), 0.22, 0.34, 30, 3, off=.005)
    k.arch_trim(0.05, mat='Gloss')
    k.headlight_quad((2.30, 0.70, 0.88), (0.75, 0.32, 0.45), 0.30, 0.08, slant=0.04, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.50, 0.50, 0.40, 0.62, 18, 5)
    k.light_bar(-1.95, 1.02, 1.05, 0.80, bg=0.02, frac=1.0)
    k.fan('rearpanel', 'Gloss', -1.95, 0.48, 0.64, -0.62, 0.62, 30, 3)
    for y in (0.50, 0.64): k.exhaust(y, 0.44, r=0.045)
    k.mirrors(px(0.84), 1.08, 1.18, size=(0.17, 0.22, 0.12))
    k.interior(-0.45, 1.5, 0.95, l=2.4, h=0.42, seats_x=-0.20, seat_z=1.03)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.26, 0.085, 0.10))

# ======================================================================= registry
# id: (builder, preview paint, rim, caliper) - the game recolours paint/rims/calipers itself
CARS = {
    'revuelto': (revuelto, '#6fc12a', '#1b1b1d', '#e3c11b'),
    'svj': (svj, '#f0700f', '#1b1b1d', '#1f8a5a'),
    'temerario': (temerario, '#4a1d6c', '#2a2b2e', '#e3c11b'),
    'sto': (sto, '#f0700f', '#1b1b1d', '#1b1b1d'),
    'sterrato': (sterrato, '#6fc12a', '#1b1b1d', '#1b1b1d'),
    'urusp': (urusp, '#f2c20f', '#1b1b1d', '#e3c11b'),
    'sf90': (sf90, '#c1111b', '#1b1b1d', '#e3c11b'),
    'laferrari': (laferrari, '#c1111b', '#1b1b1d', '#e3c11b'),
    '812c': (c812, '#c1111b', '#2a2b2e', '#e3c11b'),
    '12cil': (cil12, '#1d3a70', '#9da1a6', '#c8141b'),
    '296gtb': (gtb296, '#f6d10f', '#1b1b1d', '#1b1b1d'),
    'f8': (f8, '#c1111b', '#2a2b2e', '#e3c11b'),
    'purosangue': (purosangue, '#1d3a70', '#1b1b1d', '#e3c11b'),
}

if __name__ == '__main__':
    main(CARS, 'supercars.py')
