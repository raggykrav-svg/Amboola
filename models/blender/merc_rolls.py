# Mercedes-AMG and Rolls-Royce for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/merc_rolls.py -- --car all
#
# Mercedes-AMG: the vertical-slat "Panamericana" grille with the three-pointed star. Bodies come from carshape (each
# car's real measurements and outline) except the G 63, which keeps its own brick-shaped table.
# Rolls-Royce: a tall chrome Pantheon grille with vertical vanes and the Spirit of Ecstasy on the bonnet.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from supercars import SOFT, SHARP, PSF90
from bmw_audi import quad_pipes, PM5
from carshape import build, scaled

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
# AMG GT Black Series: 4.60 x 2.02 x 1.28 m, 2.64 m wheelbase - a very long bonnet with the cabin set far back, carbon
# bonnet vents, a huge two-tier wing, a carbon splitter and quad pipes
PAMGGT = dict(L=4.604, W=2.023, H=1.28, WB=2.635, fo=0.93, clear=0.11, nose_zb=0.25, tail_zb=0.38,
              top=[(2.2475, 0.62), (2.16, 0.70), (1.85, 0.77), (1.3175, 0.84), (0.7, 0.89), (0.0, 0.94), (-0.3, 1.12), (-0.6, 1.25),
                   (-0.85, 1.28), (-1.1, 1.25), (-1.4, 1.14), (-1.8, 1.03), (-2.2, 1.0), (-2.3565, 0.94)],
              belt=[(2.2475, 0.60), (1.85, 0.79), (1.3175, 0.88), (0.0, 0.94), (-0.8, 0.97), (-1.3175, 1.0), (-2.0, 1.0), (-2.3565, 0.92)],
              plan=[(2.2475, 0.58), (2.16, 0.80), (1.85, 0.95), (1.3175, 1.0), (0.5, 0.96), (-0.5, 0.96), (-1.3175, 1.0115), (-2.0, 0.98),
                    (-2.3, 0.88), (-2.3565, 0.78)],
              roof=[(0.0, 0.70), (-0.6, 0.64), (-1.1, 0.59), (-1.5, 0.52), (-1.8, 0.46)],
              cab=(0.0, -0.6, -1.1, -1.8), bulge=0.06, hip=0.06, side=(-0.08, -1.35), doors=(-0.05,), mirror_x=-0.10, rw_w=0.85)
def amggt(k):
    S = build(k, PAMGGT, dict(r=0.327, w=0.285, rim=0.241), dict(r=0.354, w=0.335, rim=0.254), crease=SHARP)
    amg_face(k, ((2.02, 0.70, 0.64), (0.66, 0.34, 0.52), 0.30, 0.07), (0.32, 0.24, 0.52, 14, 0.07), (0.88, 0.16, 0.34))
    k.decal('splitter', 'Carbon', 'front', -0.94, 0.94, 0.11, 0.15, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Carbon', 'top', 1.20, 1.70, s * 0.14, s * 0.38, 6, 4))
    for s in (1, -1): k.decal('skirt', 'Carbon', side(s), -1.0, 1.0, 0.11, 0.19, 30, 2)
    k.tail_clusters(-2.0, 0.86, 0.94, 0.45, 0.82)
    k.fan('diffuser', 'Carbon', -2.0, 0.26, 0.42, -0.66, 0.66, 30, 3)
    quad_pipes(k, 0.42, 0.36)
    k.swan_wing(S.tail + 0.42, 1.30, 0.40, 1.80, S.tail + 0.50, 0.40, aoa=-10, flap=(S.tail + 0.02, 1.38, 0.16, -24),
                endplate=[(S.tail + 0.48, 1.24), (S.tail + 0.46, 1.42), (S.tail - 0.06, 1.46), (S.tail - 0.10, 1.28), (S.tail + 0.08, 1.20)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))

# AMG ONE: 4.76 x 2.01 x 1.26 m, 2.72 m wheelbase - a Formula 1 engine in a road car: a mid-engine teardrop with a roof
# scoop and shark fin, louvres over the front wheels and a big active wing
PAMGONE = scaled(PSF90, L=4.756, W=2.01, H=1.261, WB=2.72, fo=1.05,
                 roof=[(x, w * 0.9) for x, w in scaled(PSF90, WB=2.72, W=2.01)['roof']])
def amgone(k):
    S = build(k, PAMGONE, dict(r=0.345, w=0.27, rim=0.254), dict(r=0.36, w=0.33, rim=0.267), crease=SHARP)
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, -0.35, -1.0, 0.42, 0.86, lean=0.20, nu=8, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
        for i in range(5): k.decal('louvre', 'Gloss', 'top', 1.05 + i * .09, 1.10 + i * .09, s * 0.22, s * 0.64, 6, 1, off=.004)
    amg_face(k, ((2.14, 0.70, 0.58), (0.66, 0.36, 0.52), 0.26, 0.06), (0.30, 0.18, 0.36, 12, 0.06), (0.88, 0.14, 0.30))
    k.decal('splitter', 'Carbon', 'front', -0.96, 0.96, 0.11, 0.15, 30, 2)
    roof = k.deck_z(-0.20, 0.0)
    k.box('scoop', 'Gloss', (-0.10, 0, roof + 0.07), (0.30, 0.30, 0.16), bevel=0.04)
    k.plate('fin', 'Carbon', [(-0.20, roof + 0.12), (-0.60, roof + 0.14), (S.tail + 0.25, 1.10), (S.tail + 0.15, 1.02), (-0.40, roof + 0.02)], 0.0, t=0.012)
    k.light_bar(-1.8, 0.90, 0.93, 0.82, bg=0.015, frac=0.6)
    k.fan('diffuser', 'Carbon', -1.8, 0.24, 0.44, -0.70, 0.70, 30, 3)
    k.exhaust(0.0, 0.66, r=0.07, mirror=False)
    k.post_wing(S.tail + 0.40, 1.22, 0.40, 1.80, S.tail + 0.28, 0.40, aoa=-10,
                endplate=[(S.tail + 0.46, 1.16), (S.tail + 0.44, 1.30), (S.tail - 0.04, 1.34), (S.tail - 0.08, 1.20), (S.tail + 0.12, 1.14)])
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

# C 63 S E PERFORMANCE: 4.84 x 1.90 x 1.46 m, 2.87 m wheelbase - the compact four-door super saloon (the BMW M5's
# saloon outline stretched to the C-Class's real size), a boot lip and quad pipes
PC63 = scaled(PM5, L=4.841, W=1.90, H=1.458, WB=2.873, fo=0.84)
def c63(k):
    S = build(k, PC63, dict(r=0.35, w=0.265, rim=0.254), dict(r=0.355, w=0.285, rim=0.254), crease=SOFT)
    amg_face(k, ((2.10, 0.64, 0.72), (0.72, 0.30, 0.52), 0.28, 0.07), (0.34, 0.34, 0.62, 14, 0.075), (0.80, 0.20, 0.36))
    for s in (1, -1): k.decal('skirt', 'Gloss', side(s), -1.05, 1.05, 0.14, 0.22, 30, 2)
    k.tail_clusters(-2.1, 0.94, 1.02, 0.45, 0.86)
    k.fan('diffuser', 'Gloss', -2.1, 0.30, 0.46, -0.62, 0.62, 30, 3)
    k.spoiler(S.tail + 0.10, 1.08, 0.10, 1.20, aoa=-4, thick=0.05, mat='Gloss', strut_y=0.35)
    quad_pipes(k, 0.44, 0.38)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# ----------------------------------------------------------------------------------------------- Rolls-Royce
# Phantom: 5.76 x 2.02 x 1.65 m, 3.55 m wheelbase - tall and stately: a long flat bonnet, the upright Pantheon grille,
# rear-hinged back doors, a thick C-pillar and chrome everywhere
PPHANTOM = dict(L=5.762, W=2.018, H=1.646, WB=3.552, fo=0.95, clear=0.15, nose_zb=0.32, tail_zb=0.40, nose_run=0.10,
                top=[(2.726, 0.95), (2.68, 1.05), (2.4, 1.10), (1.776, 1.14), (1.2, 1.17), (0.85, 1.19), (0.45, 1.42), (0.05, 1.62),
                     (-0.4, 1.646), (-1.4, 1.64), (-1.85, 1.58), (-2.15, 1.42), (-2.45, 1.24), (-2.9, 1.22), (-3.036, 1.15)],
                belt=[(2.726, 0.92), (2.4, 1.11), (1.776, 1.15), (0.85, 1.19), (-0.5, 1.21), (-1.776, 1.23), (-2.6, 1.23), (-3.036, 1.14)],
                plan=[(2.726, 0.86), (2.68, 0.94), (2.4, 0.99), (1.776, 1.005), (0.5, 0.995), (-0.5, 0.995), (-1.776, 1.009), (-2.6, 0.99),
                      (-2.95, 0.93), (-3.036, 0.87)],
                roof=[(0.85, 0.78), (0.0, 0.74), (-1.0, 0.73), (-1.85, 0.70), (-2.15, 0.66)],
                cab=(0.85, 0.05, -1.85, -2.45), bulge=0.02, hip=0.02, side=(0.78, -2.0), pillars=(-0.45,), pillar_w=0.10,
                doors=(0.78, -0.45, -1.75), mirror_x=0.70, rw_w=0.85, roof_crown=0.04, mirror_size=(0.16, 0.22, 0.12))
def phantom(k):
    S = build(k, PPHANTOM, dict(r=0.394, w=0.255, rim=0.267), dict(r=0.395, w=0.285, rim=0.267), crease=SOFT)
    rr_face(k, ((2.62, 0.70, 0.98), (0.85, 0.25, 0.30), 0.34, 0.06), (0.36, 0.58, 1.02), 2.55)
    for s in (1, -1):
        k.decal('chromeline', 'Chrome', side(s), -2.80, 2.50, 1.20, 1.22, 40, 1, off=.005)
        k.fan('tail', 'Taillight', -2.4, 0.92, 1.18, s * 0.62, s * 0.84, 6, 6, off=.006)
    k.decal('rearchrome', 'Chrome', 'rear', -0.60, 0.60, 0.70, 0.73, 12, 1, off=.008)
    k.join(); k.wheels(spokes=12, spoke_w=(0.018, 0.012), nut='bolts')

# Cullinan: 5.34 x 2.00 x 1.84 m, 3.30 m wheelbase - the Rolls-Royce SUV: upright and grand, a high bonnet, the
# Pantheon grille and a near-vertical tail
PCULL = dict(L=5.341, W=2.0, H=1.835, WB=3.295, fo=0.95, clear=0.20, nose_zb=0.44, tail_zb=0.48, nose_run=0.10, tail_run=0.12,
             top=[(2.5975, 1.10), (2.55, 1.20), (2.25, 1.25), (1.6475, 1.29), (1.1, 1.32), (0.8, 1.34), (0.4, 1.60), (0.0, 1.80),
                  (-0.4, 1.835), (-1.8, 1.83), (-2.35, 1.80), (-2.55, 1.55), (-2.65, 1.36), (-2.7435, 1.28)],
             belt=[(2.5975, 1.06), (2.25, 1.26), (1.6475, 1.30), (0.8, 1.34), (-0.5, 1.36), (-1.6475, 1.38), (-2.5, 1.38), (-2.7435, 1.28)],
             plan=[(2.5975, 0.86), (2.55, 0.94), (2.25, 0.985), (1.6475, 1.0), (0.5, 0.99), (-0.5, 0.99), (-1.6475, 1.0), (-2.5, 0.99),
                   (-2.7, 0.95), (-2.7435, 0.90)],
             roof=[(0.8, 0.80), (0.0, 0.78), (-1.0, 0.78), (-2.0, 0.77), (-2.35, 0.74)],
             cab=(0.8, 0.0, -2.35, -2.55), bulge=0.02, hip=0.02, side=(0.72, -2.40), pillars=(-0.45, -1.65), pillar_w=0.09,
             doors=(0.72, -0.45, -1.65), mirror_x=0.64, rw_w=0.85, roof_crown=0.04, mirror_size=(0.18, 0.24, 0.14))
def cullinan(k):
    S = build(k, PCULL, dict(r=0.394, w=0.255, rim=0.279, gap=0.07), dict(r=0.393, w=0.285, rim=0.279, gap=0.07), crease=SHARP)
    rr_face(k, ((2.52, 0.72, 1.16), (0.85, 0.25, 0.30), 0.32, 0.06), (0.38, 0.72, 1.18), 2.35)
    both(lambda s: k.decal('chromeline', 'Chrome', side(s), -2.20, 2.20, 0.44, 0.46, 40, 1, off=.005))
    k.tail_clusters(-2.3, 1.12, 1.40, 0.66, 0.86)
    k.decal('rearchrome', 'Chrome', 'rear', -0.60, 0.60, 0.72, 0.75, 12, 1, off=.008)
    k.join(); k.wheels(spokes=12, spoke_w=(0.02, 0.014), nut='bolts')

# Spectre: 5.45 x 2.08 x 1.56 m, 3.21 m wheelbase - the electric Rolls-Royce: a huge fastback coupe with the widest
# grille ever, split lights and 23-inch wheels
PSPECTRE = dict(L=5.453, W=2.08, H=1.559, WB=3.21, fo=1.0, clear=0.15, nose_zb=0.34, tail_zb=0.40,
                top=[(2.605, 0.86), (2.56, 0.96), (2.25, 1.02), (1.605, 1.07), (1.0, 1.11), (0.6, 1.14), (0.15, 1.38), (-0.3, 1.54),
                     (-0.7, 1.559), (-1.3, 1.53), (-1.8, 1.40), (-2.2, 1.24), (-2.6, 1.15), (-2.78, 1.14), (-2.848, 1.06)],
                belt=[(2.605, 0.84), (2.25, 1.03), (1.605, 1.08), (0.6, 1.14), (-0.7, 1.16), (-1.605, 1.18), (-2.5, 1.17), (-2.848, 1.06)],
                plan=[(2.605, 0.82), (2.56, 0.94), (2.25, 1.01), (1.605, 1.035), (0.5, 1.02), (-0.5, 1.02), (-1.605, 1.04), (-2.5, 1.0),
                      (-2.78, 0.92), (-2.848, 0.84)],
                roof=[(0.6, 0.76), (-0.3, 0.70), (-1.0, 0.66), (-1.8, 0.58), (-2.2, 0.52)],
                cab=(0.6, -0.3, -1.3, -2.2), bulge=0.03, hip=0.04, side=(0.52, -1.95), pillars=(-1.35,), pillar_w=0.08,
                doors=(0.55,), mirror_x=0.46, rw_w=0.85, mirror_size=(0.16, 0.22, 0.12))
def spectre(k):
    S = build(k, PSPECTRE, dict(r=0.394, w=0.255, rim=0.292), dict(r=0.395, w=0.295, rim=0.292), crease=SOFT)
    rr_face(k, ((2.48, 0.72, 0.96), (0.80, 0.30, 0.40), 0.30, 0.04), (0.46, 0.48, 0.84), 2.35)
    k.headlight_quad((2.50, 0.74, 0.70), (0.85, 0.25, 0.20), 0.20, 0.06, dots='row')          # the lower half of the split lights
    both(lambda s: k.decal('chromeline', 'Chrome', side(s), -2.20, 2.30, 0.40, 0.42, 40, 1, off=.005))
    k.tail_clusters(-2.3, 1.02, 1.12, 0.50, 0.84)
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
