# Mercedes-AMG and Rolls-Royce for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/merc_rolls.py -- --car all
#
# Mercedes-AMG: the vertical-slat "Panamericana" grille with the three-pointed star. The AMG GT Black Series and the
# Rolls-Royce Spectre use the front-engine GT body, the C 63 and the Phantom the sedan body, the Cullinan the SUV
# body, the AMG ONE the mid-engine body with a roof scoop and fin, and the G 63 its own brick-shaped table.
# Rolls-Royce: a tall chrome Pantheon grille with vertical vanes and the Spirit of Ecstasy on the bonnet.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import TFER, remap, SOFT, SHARP
from porsches import TCAY_SUV
from toyota import gt_coupe, hatch, SUV_TOP, SUV_BOT, SUV_RW
from hypercars import glasshouse
from bmw_audi import bmw_sedan, quad_pipes

# ----------------------------------------------------------------------------------------------- faces
def star(k, x, z, r, y=0.0):
    """the three-pointed star in a ring"""
    k.oval('starring', 'Chrome', V(x, y, z), V(1, 0, 0), r, r, .016, ring=.80)
    k.rect('starspoke', 'Chrome', V(x, y, z + r * .45), V(1, 0, 0), .014, r * .9, .017, 2, 4)
    for s in (1, -1): k.rect('starspoke', 'Chrome', V(x, y + s * r * .39, z - r * .22), V(1, 0, 0), .014, r * .9, .017, 2, 4, slant=s * r * .78)

def panamericana(k, hw, z0, z1, n=14, star_r=0.075):
    k.decal('grilleframe', 'Chrome', 'front', -hw - .015, hw + .015, z0 - .015, z1 + .015, 12, 4, off=.006)
    k.decal('grille', 'Gloss', 'front', -hw, hw, z0, z1, 12, 4, off=.009)
    for i in range(1, n):
        y = lerp(-hw, hw, i / n)
        if abs(y) < star_r * 1.2: continue
        k.decal('slat', 'Chrome', 'front', y - .005, y + .005, z0 + .01, z1 - .01, 1, 6, off=.012)
    star(k, 3.2, (z0 + z1) / 2, star_r)

def amg_face(k, light, grille, intake):
    k.headlight_quad(light[0], light[1], light[2], light[3], slant=0.05, taper=0.3, dots='row')
    panamericana(k, *grille)
    hw, z0, z1 = intake
    both(lambda s: k.decal('intake', 'Gloss', 'front', s * (hw - .26), s * hw, z0, z1, 6, 4))

def pantheon(k, hw, z0, z1, x_hood, vanes=16):
    """Rolls-Royce: a tall upright chrome grille with vertical vanes, the RR badge and the Spirit of Ecstasy"""
    k.decal('pantheonF', 'Chrome', 'front', -hw - .03, hw + .03, z0 - .03, z1 + .03, 12, 6, off=.006)
    k.decal('pantheon', 'Gloss', 'front', -hw, hw, z0, z1, 12, 6, off=.009)
    for i in range(1, vanes):
        y = lerp(-hw, hw, i / vanes)
        k.decal('vane', 'Chrome', 'front', y - .007, y + .007, z0 + .01, z1 - .01, 1, 8, off=.012)
    k.decal('rrbadge', 'Black', 'front', -.045, .045, z1 + .035, z1 + .085, 2, 2, off=.010)
    zt = k.deck_z(x_hood, 0.0)   # the Spirit of Ecstasy, leaning into the wind
    k.box('spirit', 'Chrome', (x_hood, 0, zt + .07), (.03, .02, .12), rot=(0, -0.45, 0))
    for s in (1, -1): k.box('spiritwing', 'Chrome', (x_hood - .04, s * .03, zt + .12), (.08, .04, .012), rot=(s * .5, 0.3, 0))

def rr_face(k, light, grille, x_hood):
    k.lamp(light[0], light[1], light[2], light[3], 'strip', slant=0.0)
    pantheon(k, *grille, x_hood)
    k.decal('bumper', 'Chrome', 'front', -0.70, 0.70, grille[1] - .14, grille[1] - .11, 16, 1, off=.008)

# ----------------------------------------------------------------------------------------------- Mercedes-AMG
# AMG GT Black Series: long bonnet, huge two-tier wing, carbon splitter, quad pipes
def amggt(k):
    X = gt_coupe(k, [(-2.38, -2.37), (-1.10, -1.31), (1.62, 1.32), (2.36, 2.37)], 1.0, lambda z: z * .98,
                 dict(F=dict(x=1.32, r=0.345, w=0.28, y=0.86, rim=0.254), R=dict(x=-1.31, r=0.355, w=0.325, y=0.865, rim=0.267)), duck_lift=0.04, crease=SHARP)
    amg_face(k, ((2.12, 0.68, 0.62), (0.72, 0.32, 0.52), 0.28, 0.07), (0.32, 0.24, 0.50, 14, 0.07), (0.86, 0.16, 0.32))
    k.decal('splitter', 'Carbon', 'front', -0.92, 0.92, 0.12, 0.16, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Carbon', 'top', 1.30, 1.75, s * 0.14, s * 0.36, 6, 4))
    k.tail_clusters(X(-1.85), 0.80, 0.88, 0.45, 0.82)
    k.fan('diffuser', 'Carbon', X(-1.85), 0.26, 0.42, -0.66, 0.66, 30, 3)
    quad_pipes(k, 0.42, 0.34)
    k.swan_wing(-1.90, 1.28, 0.40, 1.80, -1.82, 0.40, aoa=-10, flap=(-2.28, 1.36, 0.16, -24),
                endplate=[(-1.84, 1.22), (-1.86, 1.40), (-2.38, 1.44), (-2.42, 1.26), (-2.24, 1.18)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# AMG ONE: a Formula 1 engine in a road car: mid-engine, roof scoop with a shark fin, louvres, a big active wing
OX = [(-2.33, -2.38), (-1.30, -1.36), (1.36, 1.36), (2.31, 2.38)]
def amgone(k):
    X = lambda x: pl(OX, x); Z = lambda z: z * .97
    rows = remap(TFER, OX, 1.02, Z)
    rows = [r[:8] + (r[8] * (0.80 if -0.75 < r[0] < 0.80 else 1.0),) + r[9:] for r in rows]
    k.loft(stations(rows), **SHARP); k.arches(dict(F=dict(x=1.36, r=0.345, w=0.27, y=0.86, rim=0.254), R=dict(x=-1.36, r=0.36, w=0.33, y=0.865, rim=0.267))); k.surface()
    glasshouse(k, X, Z, hw=0.85)
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, X(-0.35), X(-1.00), 0.42, 0.84, lean=0.20, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), X(-0.95), X(1.00), 0.12, 0.20, 30, 2)
        for i in range(5): k.decal('louvre', 'Gloss', 'top', 1.05 + i * .09, 1.10 + i * .09, s * 0.22, s * 0.62, 6, 1, off=.004)
    amg_face(k, ((2.08, 0.70, 0.58), (0.72, 0.34, 0.52), 0.26, 0.06), (0.30, 0.18, 0.36, 12, 0.06), (0.86, 0.14, 0.30))
    k.decal('splitter', 'Carbon', 'front', -0.95, 0.95, 0.12, 0.16, 30, 2)
    roof = k.deck_z(X(-0.20), 0.0)
    k.box('scoop', 'Gloss', (X(-0.10), 0, roof + 0.07), (0.30, 0.30, 0.16), bevel=0.04)
    k.plate('fin', 'Carbon', [(X(-0.20), roof + 0.14), (X(-0.60), roof + 0.30), (X(-2.10), 1.10), (X(-2.20), 0.98), (X(-0.40), roof + 0.02)], 0.0, t=0.012)
    k.light_bar(X(-1.80), 0.84, 0.87, 0.82, bg=0.015, frac=0.6)
    k.fan('diffuser', 'Carbon', X(-1.80), 0.24, 0.44, -0.70, 0.70, 30, 3)
    k.exhaust(0.0, 0.62, r=0.07, mirror=False)
    k.post_wing(-1.95, 1.18, 0.40, 1.80, -2.05, 0.40, aoa=-10,
                endplate=[(-1.88, 1.12), (-1.90, 1.26), (-2.38, 1.30), (-2.42, 1.16), (-2.22, 1.10)])
    k.mirrors(X(0.62), 1.04, Z(0.93), size=(0.13, 0.17, 0.08))
    k.interior(X(-0.20), 1.10, Z(0.64), h=0.30, seats_x=X(-0.42), seat_y=0.32, seat_z=Z(0.74))
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# G 63: the famous brick. Flat sides, upright windscreen, round lamps, indicators on the wings, side pipes, spare wheel
#        x      zb    w     zs    wb    zbl   wg    zg    wr    zr    zt
TG = [( 2.43, 0.50, 0.90, 0.64, 0.90, 0.82, 0.86, 0.96, 0.80, 1.00, 1.02),
      ( 2.36, 0.42, 0.98, 0.70, 0.98, 1.00, 0.95, 1.14, 0.88, 1.22, 1.24),
      ( 1.30, 0.40, 0.99, 0.72, 0.99, 1.02, 0.96, 1.18, 0.90, 1.24, 1.27),
      ( 0.98, 0.40, 0.99, 0.72, 0.99, 1.04, 0.97, 1.20, 0.90, 1.30, 1.33),
      ( 0.66, 0.40, 0.99, 0.72, 0.99, 1.05, 0.97, 1.22, 0.88, 1.88, 1.92),
      (-1.00, 0.40, 0.99, 0.72, 0.99, 1.05, 0.97, 1.22, 0.88, 1.92, 1.96),
      (-2.30, 0.42, 0.99, 0.72, 0.99, 1.05, 0.97, 1.22, 0.88, 1.92, 1.95),
      (-2.43, 0.50, 0.92, 0.70, 0.92, 1.00, 0.90, 1.18, 0.84, 1.84, 1.88)]
def g63(k):
    k.loft(stations(TG), crease_all=0.85, levels=2)
    k.arches(dict(F=dict(x=1.45, r=0.43, w=0.29, y=0.86, rim=0.279, gap=0.07), R=dict(x=-1.40, r=0.43, w=0.29, y=0.86, rim=0.279, gap=0.07))); k.surface()
    k.decal('windscreen', 'Glass', 'front', -0.82, 0.82, 1.40, 1.84, 16, 8, off=.006)
    for s in (1, -1):
        k.decal('sideglass', 'Glass', side(s), -2.10, 0.55, 1.30, 1.80, 30, 6, off=.006)
        for x in (-1.25, -0.30): k.decal('pillar', 'Gloss', side(s), x - .05, x + .05, 1.30, 1.80, 2, 6, off=.009)
        for x in (0.60, -0.32, -1.30): k.decal('doorline', 'Black', side(s), x - .004, x + .004, 0.45, 1.25, 1, 12, off=.002)
        for x in (0.35, -0.55): k.decal('handle', 'Chrome', side(s), x - .14, x, 1.10, 1.125, 4, 1, off=.004)
        k.decal('rubstrip', 'Gloss', side(s), -2.20, 2.20, 0.84, 0.92, 40, 1, off=.006)
        k.cylinder('sidepipe', 'Chrome', (0.10, s * 1.0, 0.44), 0.045, 0.55, axis='X')
        k.box('indicator', 'Taillight', (2.05, s * 0.80, 1.29), (0.10, 0.06, 0.05), bevel=0.01)
    for s in (1, -1):
        k.oval('lampring', 'Chrome', V(2.40, s * 0.72, 1.06), V(1, 0, 0), .115, .115, .008, ring=.78)
        k.oval('lamp', 'Headlight', V(2.40, s * 0.72, 1.06), V(1, 0, 0), .095, .095, .010, n=6)
        k.decal('taillamp', 'Taillight', 'rear', s * 0.78, s * 0.94, 0.95, 1.30, 3, 6, off=.008)
    panamericana(k, 0.46, 0.86, 1.16, 14, 0.08)
    k.decal('bumperF', 'Gloss', 'front', -0.95, 0.95, 0.46, 0.68, 20, 2, off=.008)
    k.decal('rearwin', 'Glass', 'rear', -0.72, 0.72, 1.38, 1.78, 12, 6, off=.006)
    k.cylinder('spare', 'Gloss', (-2.55, 0.0, 1.10), 0.40, 0.24, axis='X')
    k.cylinder('sparecover', 'Paint', (-2.68, 0.0, 1.10), 0.30, 0.02, axis='X')
    k.arch_trim(0.07, mat='Gloss')
    k.mirrors(0.72, 1.06, 1.42, size=(0.14, 0.22, 0.14))
    k.interior(-0.70, 1.60, 1.10, l=2.6, h=0.40, seats_x=-0.40, seat_z=1.20)
    k.join(); k.wheels(spokes=6, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# C 63 S E PERFORMANCE: compact four-door super saloon, plug-in hybrid, quad pipes
def c63(k):
    xs = [(-2.50, -2.40), (-1.40, -1.43), (1.50, 1.45), (2.48, 2.40)]
    zf = lambda z: z + max(0.0, z - 0.90) * 0.12
    X = bmw_sedan(k, xs, 0.96, zf, dict(F=dict(x=1.45, r=0.35, w=0.26, y=0.80, rim=0.254), R=dict(x=-1.43, r=0.355, w=0.285, y=0.805, rim=0.254)), None, None, None)
    amg_face(k, ((2.16, 0.64, 0.66), (0.72, 0.30, 0.52), 0.28, 0.07), (0.34, 0.30, 0.56, 14, 0.075), (0.80, 0.18, 0.32))
    k.tail_clusters(X(-1.90), 0.86, 0.95, 0.45, 0.86)
    k.fan('diffuser', 'Gloss', X(-1.90), 0.30, 0.44, -0.62, 0.62, 30, 3)
    k.spoiler(X(-2.30), 1.00, 0.10, 1.20, aoa=-4, thick=0.05, mat='Gloss', strut_y=0.35)
    quad_pipes(k, 0.44, 0.36)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# ----------------------------------------------------------------------------------------------- Rolls-Royce
# Phantom: 5.8 m, tall and stately, long bonnet, upright grille, chrome everywhere
def phantom(k):
    xs = [(-2.50, -2.88), (-1.40, -1.75), (1.50, 1.85), (2.48, 2.88)]
    zf = lambda z: z * 1.10 + 0.08 + max(0.0, z - 0.90) * 0.10
    X = bmw_sedan(k, xs, 1.03, zf, dict(F=dict(x=1.85, r=0.40, w=0.28, y=0.88, rim=0.292), R=dict(x=-1.75, r=0.40, w=0.28, y=0.88, rim=0.292)), None, None, None)
    rr_face(k, ((2.62, 0.66, zf(0.68)), (0.80, 0.25, 0.30), 0.34, 0.06), (0.36, zf(0.32), zf(0.68)), 2.55)
    for s in (1, -1): k.decal('chromeline', 'Chrome', side(s), X(-2.30), X(2.30), zf(0.92), zf(0.92) + .02, 40, 1, off=.005)
    for s in (1, -1): k.fan('tail', 'Taillight', X(-1.95), zf(0.70), zf(0.95), s * 0.62, s * 0.84, 6, 6, off=.006)
    k.decal('rearchrome', 'Chrome', 'rear', -0.60, 0.60, zf(0.52), zf(0.55), 12, 1, off=.008)
    k.join(); k.wheels(spokes=12, spoke_w=(0.018, 0.012), nut='bolts')

# Cullinan: the Rolls-Royce SUV, upright and grand
def cullinan(k):
    zf = lambda z: z * 1.10 + 0.08
    X = hatch(k, TCAY_SUV, [(-2.48, -2.67), (-1.40, -1.55), (1.50, 1.75), (2.46, 2.67)], 1.02, zf,
              dict(F=dict(x=1.75, r=0.42, w=0.28, y=0.88, rim=0.292, gap=0.07), R=dict(x=-1.55, r=0.42, w=0.28, y=0.88, rim=0.292, gap=0.07)),
              SUV_TOP, SUV_BOT, SUV_RW, [-0.15, -1.25], crease=SHARP)
    rr_face(k, ((2.42, 0.70, zf(0.86)), (0.80, 0.25, 0.30), 0.32, 0.06), (0.38, zf(0.42), zf(0.82)), 2.35)
    both(lambda s: k.decal('chromeline', 'Chrome', side(s), X(-1.95), X(2.0), zf(0.36), zf(0.36) + .02, 40, 1, off=.005))
    k.tail_clusters(X(-1.95), zf(0.80), zf(1.10), 0.66, 0.86)
    k.decal('rearchrome', 'Chrome', 'rear', -0.60, 0.60, zf(0.50), zf(0.53), 12, 1, off=.008)
    k.join(); k.wheels(spokes=12, spoke_w=(0.02, 0.014), nut='bolts')

# Spectre: the electric Rolls-Royce: a huge fastback coupe with the widest grille ever and split lights
def spectre(k):
    zf = lambda z: z * 1.06 + 0.04
    X = gt_coupe(k, [(-2.38, -2.73), (-1.10, -1.55), (1.62, 1.68), (2.36, 2.73)], 1.03, zf,
                 dict(F=dict(x=1.68, r=0.39, w=0.28, y=0.88, rim=0.292), R=dict(x=-1.55, r=0.39, w=0.28, y=0.88, rim=0.292)), crease=SOFT)
    rr_face(k, ((2.44, 0.70, zf(0.66)), (0.80, 0.30, 0.40), 0.30, 0.04), (0.44, zf(0.26), zf(0.56)), 2.35)
    both(lambda s: k.decal('chromeline', 'Chrome', side(s), X(-1.80), X(2.00), zf(0.30), zf(0.30) + .02, 40, 1, off=.005))
    k.tail_clusters(X(-1.80), zf(0.78), zf(0.88), 0.50, 0.84)
    k.join(); k.wheels(spokes=12, spoke_w=(0.02, 0.014), nut='bolts')

CARS = {
    'amggt': (amggt, '#3a3d41', '#1b1b1d', '#ffc21f'),
    'amgone': (amgone, '#b7bbbf', '#1b1b1d', '#c8141b'),
    'g63': (g63, '#0b0b0d', '#1b1b1d', '#c8141b'),
    'c63': (c63, '#eceeed', '#1b1b1d', '#c8141b'),
    'phantom': (phantom, '#16295c', '#d8d8d8', '#d8d8d8'),
    'cullinan': (cullinan, '#f0f0ec', '#d8d8d8', '#d8d8d8'),
    'spectre': (spectre, '#c0165a', '#d8d8d8', '#d8d8d8'),
}

if __name__ == '__main__':
    main(CARS, 'merc_rolls.py')
