# Ford, Chevrolet, Nissan, Honda and Pagani for Amboola, built in Blender by script (see carkit.py for the building
# blocks).
#
#   blender -b --factory-startup --python models/blender/more_brands.py -- --car all
#
# Mustang Dark Horse and GT-R NISMO: the front-engine GT body. Corvette Z06, NSX Type S and Pagani Utopia: the
# mid-engine body (the Pagani with a narrow bubble canopy). Each gets its face: the Mustang's wide grille with the
# running horse and three-bar tail lights, the GT-R's chrome V grille and four round tail lights, the Corvette's
# split grille and big side intakes, the NSX's chrome face bar, and the Pagani's round lamps and four-pipe cluster.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap, SOFT, SHARP
from toyota import gt_coupe
from hypercars import glasshouse
from bmw_audi import quad_pipes


def mid_body(k, xs, ys, Z, wheels, canopy=1.0, crease=SHARP):
    X = lambda x: pl(xs, x)
    rows = remap(TFER, xs, ys, Z)
    if canopy != 1.0: rows = [r[:8] + (r[8] * (canopy if -0.75 < r[0] < 0.80 else 1.0),) + r[9:] for r in rows]
    k.loft(stations(rows), **crease); k.arches(wheels); k.surface()
    glasshouse(k, X, Z, hw=canopy if canopy < 1 else 1.0)
    for s in (1, -1):
        k.decal('doorline', 'Black', side(s), X(0.70) - .004, X(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
        k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.13, 0.20, 30, 2)
    k.mirrors(X(0.62), 1.07 * ys, Z(0.93), size=(0.14, 0.18, 0.08))
    k.interior(X(-0.20), 1.20 * ys, Z(0.64), h=0.32, seats_x=X(-0.42), seat_z=Z(0.74))
    return X


# ---- Ford Mustang Dark Horse: long bonnet, short deck, wide trapezoid grille, the horse, three-bar tail lights
def mustang(k):
    X = gt_coupe(k, [(-2.38, -2.39), (-1.10, -1.37), (1.62, 1.35), (2.36, 2.39)], 0.985, lambda z: z * 1.03 + max(0.0, z - 0.90) * 0.06,
                 dict(F=dict(x=1.35, r=0.35, w=0.27, y=0.84, rim=0.254), R=dict(x=-1.37, r=0.355, w=0.30, y=0.845, rim=0.254)), duck_lift=0.06, crease=SHARP)
    k.headlight_quad((2.12, 0.66, 0.66), (0.72, 0.30, 0.52), 0.26, 0.07, slant=0.04, dots='row')
    k.project('grille', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.50, 0.58, v), lerp(0.22, 0.52, v)), 16, 6, off=.007)
    k.oval('horse', 'Chrome', V(3.0, 0, 0.38), V(1, 0, 0), .07, .045, .011, n=8)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.25, 1.65, s * 0.16, s * 0.34, 6, 4))
    for s in (1, -1):
        for i in range(3): k.fan('tailbar', 'Taillight', X(-1.80), 0.76, 0.92, s * (0.52 + i * .1), s * (0.56 + i * .1), 2, 3, off=.006)
    k.fan('diffuser', 'Gloss', X(-1.80), 0.26, 0.42, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.42, 0.34, r=0.05)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.03, 0.022))


# ---- Nissan GT-R NISMO: boxy coupe, chrome V-motion grille, carbon bonnet vents, four round tail lights, big wing
def gtr(k):
    X = gt_coupe(k, [(-2.38, -2.36), (-1.10, -1.39), (1.62, 1.39), (2.36, 2.36)], 0.99, lambda z: z * 1.04 + max(0.0, z - 0.90) * 0.12,
                 dict(F=dict(x=1.39, r=0.35, w=0.27, y=0.84, rim=0.254), R=dict(x=-1.39, r=0.355, w=0.30, y=0.845, rim=0.254)), crease=SHARP)
    k.headlight_quad((2.12, 0.64, 0.66), (0.72, 0.30, 0.52), 0.30, 0.08, slant=0.06, taper=0.3, dots='row')
    k.decal('grille', 'Gloss', 'front', -0.40, 0.40, 0.22, 0.50, 14, 6, off=.007)
    for s in (1, -1): k.rect('vbar', 'Chrome', V(2.40, s * 0.20, 0.36), V(1, 0, 0), .025, .30, .011, 2, 6, slant=s * .16)
    both(lambda s: k.decal('hoodvent', 'Carbon', 'top', 1.20, 1.60, s * 0.12, s * 0.32, 6, 4))
    for s in (1, -1):
        for y in (0.52, 0.72): k.oval('tailring', 'Taillight', V(-2.30, s * y, 0.84), V(-1, s * 0.2 * y, 0.05), 0.075, 0.075, .006, ring=0.55)
    k.fan('diffuser', 'Carbon', X(-1.80), 0.26, 0.42, -0.62, 0.62, 30, 3)
    for s in (1, -1):
        for d in (0, .12): k.exhaust(s * (0.50 + d), 0.34, r=0.05, mirror=False)
    k.post_wing(-1.88, 1.16, 0.32, 1.70, -1.98, 0.42, aoa=-8, endplate=[(-1.82, 1.12), (-1.84, 1.24), (-2.22, 1.26), (-2.26, 1.14), (-2.10, 1.10)])
    k.join(); k.wheels(spokes=6, pairs=True, nut='bolts', spoke_w=(0.03, 0.022))


# ---- Chevrolet Corvette Z06: mid-engine, sharp lights, split grille, huge side intakes, quad centre pipes, wing
CX = [(-2.33, -2.34), (-1.30, -1.38), (1.36, 1.35), (2.31, 2.34)]
def corvette(k):
    Z = lambda z: z * 0.98
    X = mid_body(k, CX, 1.02, Z, dict(F=dict(x=1.35, r=0.345, w=0.27, y=0.86, rim=0.254), R=dict(x=-1.38, r=0.36, w=0.33, y=0.865, rim=0.267)))
    for s in (1, -1): k.slanted('sideintake', 'Gloss', s, X(-0.25), X(-0.95), 0.36, 0.86, lean=0.25, nu=8, nv=8, off=.006)
    k.headlight_quad((2.06, 0.70, 0.60), (0.72, 0.34, 0.52), 0.30, 0.06, slant=0.07, taper=0.4, dots='row')
    for s in (1, -1): k.decal('grille', 'Gloss', 'front', s * 0.06, s * 0.52, 0.18, 0.34, 8, 4)
    k.decal('splitter', 'Carbon', 'front', -0.90, 0.90, 0.13, 0.17, 30, 2)
    k.tail_clusters(X(-1.70), 0.78, 0.88, 0.45, 0.82)
    k.fan('rearpanel', 'Gloss', X(-1.70), 0.44, 0.62, -0.62, 0.62, 30, 4)
    for y in (-0.16, -0.05, 0.05, 0.16): k.exhaust(y, 0.42, r=0.045, mirror=False)
    k.spoiler(-2.05, 1.06, 0.26, 1.60, aoa=-8, mat='Carbon', strut_y=0.40)
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))


# ---- Honda NSX Type S: mid-engine, the chrome face bar between thin lights, big side intakes, full-width tail light
NX = [(-2.33, -2.32), (-1.30, -1.28), (1.36, 1.35), (2.31, 2.32)]
def nsx(k):
    Z = lambda z: z * 0.97
    X = mid_body(k, NX, 1.0, Z, dict(F=dict(x=1.35, r=0.34, w=0.26, y=0.85, rim=0.254), R=dict(x=-1.28, r=0.355, w=0.31, y=0.855, rim=0.267)), crease=SOFT)
    for s in (1, -1): k.slanted('sideintake', 'Gloss', s, X(-0.35), X(-0.95), 0.42, 0.80, lean=0.18, nu=8, nv=8, off=.006)
    k.headlight_quad((2.06, 0.70, 0.60), (0.72, 0.34, 0.52), 0.28, 0.06, slant=0.05, taper=0.3, dots='row')
    k.decal('facebar', 'Chrome', 'front', -0.50, 0.50, 0.52, 0.55, 14, 1, off=.008)
    k.decal('grille', 'Gloss', 'front', -0.42, 0.42, 0.20, 0.36, 14, 4)
    k.light_bar(X(-1.70), 0.82, 0.86, 0.82, bg=0.015, frac=0.7)
    k.fan('diffuser', 'Carbon', X(-1.70), 0.26, 0.44, -0.66, 0.66, 30, 3)
    for y in (-0.12, 0.0, 0.12): k.exhaust(y, 0.34, r=0.04, mirror=False)
    k.join(); k.wheels(spokes=10, spoke_w=(0.022, 0.015))


# ---- Pagani Utopia: a smooth bubble, round headlights, a tall ducktail, and the famous four-pipe cluster in the middle
PX = [(-2.33, -2.29), (-1.30, -1.35), (1.36, 1.38), (2.31, 2.29)]
def utopia(k):
    Z = lambda z: z * 0.96 + max(0.0, z - 0.90) * 0.10
    X = mid_body(k, PX, 1.02, Z, dict(F=dict(x=1.38, r=0.345, w=0.27, y=0.86, rim=0.254), R=dict(x=-1.35, r=0.365, w=0.335, y=0.865, rim=0.279)), canopy=0.82, crease=SOFT)
    for s in (1, -1):
        k.oval('lamp', 'Chrome', V(2.02, s * 0.66, 0.60), V(0.72, s * 0.34, 0.52), 0.10, 0.08, .007, n=8)
        k.oval('lampled', 'Headlight', V(2.02, s * 0.66, 0.60), V(0.72, s * 0.34, 0.52), 0.06, 0.05, .010, n=6)
        k.slanted('sideintake', 'Gloss', s, X(-0.40), X(-0.90), 0.58, 0.82, lean=0.08, nu=6, nv=6, off=.006)
        for y in (0.56, 0.74): k.oval('tailround', 'Taillight', V(-2.10, s * y, 0.82), V(-1, s * 0.25 * y, 0.1), 0.06, 0.06, .006, n=6)
    k.decal('mouth', 'Gloss', 'front', -0.40, 0.40, 0.18, 0.32, 14, 4)
    k.fan('diffuser', 'Carbon', X(-1.70), 0.26, 0.44, -0.66, 0.66, 30, 3)
    for y in (-0.07, 0.07):
        for z in (0.66, 0.80): k.exhaust(y, z, r=0.045, mirror=False)             # the four-pipe cluster
    k.spoiler(-2.15, 1.04, 0.22, 1.40, aoa=-10, mat='Paint', strut_y=0.36)
    k.join(); k.wheels(spokes=14, spoke_w=(0.014, 0.01))


CARS = {
    'mustang': (mustang, '#1b1b1d', '#2a2b2e', '#1d5fc4'),
    'gtr': (gtr, '#eceeed', '#1b1b1d', '#c8141b'),
    'corvette': (corvette, '#e8c21a', '#1b1b1d', '#1b1b1d'),
    'nsx': (nsx, '#c8141b', '#1b1b1d', '#c8141b'),
    'utopia': (utopia, '#2a5c8a', '#c0c4c8', '#d8b04a'),
}

if __name__ == '__main__':
    main(CARS, 'more_brands.py')
