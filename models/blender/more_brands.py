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
from profile import build


# ---- Ford Mustang Dark Horse (S650): 4.82 m long, 1.92 m wide, 1.41 m tall, 2.72 m wheelbase. The long bonnet with
# two heat vents and a power dome, the windscreen far back, a fastback roof running into a short ducktail; a big dark
# trapezoid grille with the Dark Horse badge, wide tri-bar LED headlights, three upright bars in each tail light on
# a black panel, a rear spoiler with a gurney flap and four round pipes.
MUSTANG = dict(L=4.823, W=1.916, H=1.413, WB=2.719, fo=0.93, clear=0.13, nose_zb=0.28, tail_zb=0.40,
               top=[(2.29, 0.64), (2.22, 0.73), (1.95, 0.80), (1.3, 0.865), (0.7, 0.915), (0.25, 0.955), (-0.15, 1.18),
                    (-0.50, 1.36), (-0.85, 1.413), (-1.15, 1.385), (-1.50, 1.24), (-1.82, 1.06), (-2.20, 1.03), (-2.45, 1.02), (-2.53, 0.93)],
               belt=[(2.29, 0.64), (1.95, 0.81), (1.36, 0.865), (0.30, 0.93), (-0.90, 0.97), (-1.70, 1.00), (-2.40, 0.99), (-2.53, 0.90)],
               plan=[(2.29, 0.60), (2.20, 0.80), (1.90, 0.905), (1.36, 0.945), (0.5, 0.925), (-0.5, 0.935), (-1.36, 0.958),
                     (-2.0, 0.935), (-2.40, 0.87), (-2.53, 0.78)],
               roof=[(0.30, 0.72), (-0.5, 0.63), (-1.0, 0.61), (-1.5, 0.56), (-1.85, 0.52)],
               cab=(0.25, -0.50, -1.15, -1.82), bulge=0.025, hip=0.03, side=(0.18, -1.42), pillars=(-1.02,), doors=(0.14, -1.02),
               mirror_x=0.12, rw_w=0.80)
def mustang(k):
    S = build(k, MUSTANG, dict(r=0.343, w=0.255, rim=0.241), dict(r=0.351, w=0.275, rim=0.241), crease=SHARP)
    # face: wide tri-bar LED headlights over the corners, the big dark trapezoid grille, fog-light nostrils, splitter
    k.headlight_quad((2.16, 0.70, 0.70), (0.80, 0.30, 0.30), 0.36, 0.07, slant=0.02, taper=0.15, dots='row')
    for s in (1, -1):
        for i in range(3): k.rect('tribar', 'Headlight', V(2.16, s * (0.60 + i * .07), 0.62), V(0.8, s * 0.35, 0.2), 0.016, 0.07, .010, 1, 3)
    k.project('grille', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.50, 0.62, v), lerp(0.24, 0.58, v)), 16, 6, off=.007)
    k.oval('horse', 'Chrome', V(3.0, 0, 0.44), V(1, 0, 0), .07, .045, .011, n=8)
    both(lambda s: k.decal('nostril', 'Gloss', 'front', s * 0.64, s * 0.80, 0.30, 0.42, 6, 4))
    k.decal('splitter', 'Gloss', 'front', -0.86, 0.86, 0.15, 0.20, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.30, 1.62, s * 0.22, s * 0.38, 6, 4))
    k.decal('powerdome', 'Paint', 'top', 0.4, 1.7, -0.16, 0.16, 12, 4, off=.012)
    # tail: three upright bars each side on a gloss-black panel, black diffuser, quad pipes, gurney spoiler
    k.fan('tailpanel', 'Gloss', -1.9, 0.80, 0.94, -0.80, 0.80, 40, 3)
    for s in (1, -1):
        for i in range(3): k.fan('tailbar', 'Taillight', -1.9, 0.81, 0.93, s * (0.48 + i * .085), s * (0.52 + i * .085), 2, 4, off=.007)
    k.fan('diffuser', 'Gloss', -1.9, 0.30, 0.46, -0.66, 0.66, 30, 3)
    quad_pipes(k, 0.46, 0.38, r=0.05)
    k.spoiler(-2.36, 1.06, 0.18, 1.50, aoa=-6, mat='Gloss', strut_y=0.45, thick=0.08)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.03, 0.022))


# ---- Nissan GT-R NISMO (R35): 4.69 m long, 1.90 m wide, 1.37 m tall, 2.78 m wheelbase. A tall, square-shouldered
# coupe with the roof's famous kink at the C-pillar, the big V-motion grille, boomerang LED headlights, a carbon bonnet
# with two vents, vents behind the front wheels, four round tail lights, a huge carbon wing and four titanium pipes.
GTR = dict(L=4.69, W=1.895, H=1.37, WB=2.78, fo=0.95, clear=0.12, nose_zb=0.26, tail_zb=0.40,
           top=[(2.34, 0.60), (2.25, 0.70), (2.0, 0.775), (1.4, 0.845), (0.8, 0.90), (0.45, 0.935), (0.0, 1.17), (-0.35, 1.335),
                (-0.65, 1.37), (-0.95, 1.345), (-1.20, 1.25), (-1.55, 1.10), (-2.10, 1.07), (-2.30, 1.05), (-2.35, 0.96)],
           belt=[(2.34, 0.60), (2.0, 0.80), (1.4, 0.875), (0.45, 0.94), (-0.5, 0.965), (-1.2, 1.0), (-2.0, 1.02), (-2.35, 0.94)],
           plan=[(2.34, 0.58), (2.25, 0.79), (2.0, 0.90), (1.39, 0.947), (0.5, 0.93), (-0.5, 0.935), (-1.39, 0.947),
                 (-2.0, 0.93), (-2.30, 0.85), (-2.35, 0.76)],
           roof=[(0.45, 0.72), (-0.3, 0.64), (-0.9, 0.60), (-1.3, 0.57), (-1.55, 0.55)],
           cab=(0.45, -0.35, -0.95, -1.55), bulge=0.03, hip=0.025, side=(0.38, -1.22), pillars=(-0.78,), pillar_w=0.07,
           doors=(0.40, -0.76), mirror_x=0.33, rw_w=0.82, roof_crown=0.05)
def gtr(k):
    S = build(k, GTR, dict(r=0.356, w=0.255, rim=0.254), dict(r=0.354, w=0.285, rim=0.254), crease=SHARP)
    k.headlight_quad((2.12, 0.66, 0.68), (0.72, 0.32, 0.45), 0.32, 0.08, slant=0.07, taper=0.35, dots='row')
    for s in (1, -1): k.rect('boomerang', 'Headlight', V(2.12, s * 0.66, 0.62), V(0.72, s * 0.32, 0.45), 0.24, 0.012, .010, 6, 1, slant=s * -0.05)
    k.project('grille', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(0.36, 0.44, v), lerp(0.24, 0.56, v)), 14, 6, off=.007)
    for s in (1, -1): k.rect('vbar', 'Chrome', V(2.40, s * 0.20, 0.42), V(1, 0, 0), .025, .30, .011, 2, 6, slant=s * .16)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.56, s * 0.84, 0.22, 0.40, 8, 4))
    k.decal('splitter', 'Carbon', 'front', -0.88, 0.88, 0.13, 0.18, 30, 2)
    k.decal('hood', 'Carbon', 'top', 0.55, 2.1, -0.44, 0.44, 16, 10, off=.003)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.40, 1.75, s * 0.14, s * 0.32, 6, 4, off=.006))
    for s in (1, -1):
        k.slanted('fendervent', 'Gloss', s, 0.82, 0.62, 0.46, 0.74, lean=0.06, nu=4, nv=6, off=.006)
        k.decal('skirt', 'Carbon', side(s), -1.0, 1.0, 0.12, 0.20, 30, 2)
        for y in (0.52, 0.72): k.oval('tailring', 'Taillight', V(-2.30, s * y, 0.88), V(-1, s * 0.2 * y, 0.05), 0.075, 0.075, .006, ring=0.55)
    k.fan('diffuser', 'Carbon', -1.9, 0.28, 0.44, -0.62, 0.62, 30, 3)
    quad_pipes(k, 0.50, 0.38, r=0.05)
    k.post_wing(-1.90, 1.24, 0.32, 1.70, -2.0, 0.42, aoa=-8, endplate=[(-1.84, 1.20), (-1.86, 1.32), (-2.24, 1.34), (-2.28, 1.22), (-2.12, 1.18)])
    k.join(); k.wheels(spokes=6, pairs=True, nut='bolts', spoke_w=(0.03, 0.022))


# ---- Chevrolet Corvette Z06 (C8): 4.69 m long, 2.03 m wide, 1.24 m tall, 2.72 m wheelbase. Mid-engine and cab-forward
# with a long glass engine cover, sharp lights, the Z06's big centre intake, huge intakes in the doors and rear fenders,
# angular tail lights, four pipes in the middle of the tail and the Z07 wing.
VETTE = dict(L=4.688, W=2.025, H=1.235, WB=2.722, fo=1.00, clear=0.11, nose_zb=0.24, tail_zb=0.40,
             top=[(2.36, 0.50), (2.25, 0.60), (2.0, 0.665), (1.5, 0.74), (1.2, 0.79), (0.90, 0.84), (0.45, 1.03), (0.0, 1.20),
                  (-0.28, 1.235), (-0.60, 1.19), (-1.0, 1.10), (-1.55, 1.03), (-2.0, 1.00), (-2.25, 0.985), (-2.33, 0.89)],
             belt=[(2.36, 0.48), (2.1, 0.64), (1.6, 0.76), (1.0, 0.84), (0.4, 0.86), (-0.4, 0.885), (-1.0, 0.95), (-1.6, 0.99),
                   (-2.2, 0.955), (-2.33, 0.86)],
             plan=[(2.36, 0.45), (2.25, 0.72), (2.0, 0.89), (1.36, 0.975), (0.8, 0.955), (0.0, 0.955), (-0.8, 1.0), (-1.36, 1.012),
                   (-2.0, 0.975), (-2.25, 0.88), (-2.33, 0.78)],
             roof=[(0.9, 0.68), (0.3, 0.62), (-0.3, 0.57), (-0.6, 0.53), (-1.0, 0.48), (-1.55, 0.42)],
             cab=(0.90, 0.0, -0.60, -1.55), bulge=[(0.0, 0.02), (1.0, 0.05), (2.0, 0.04)], hip=0.035, side=(0.82, -0.56),
             doors=(0.78, -0.30), mirror_x=0.74, rw_w=0.85, rw_bulge=0.0)
def corvette(k):
    S = build(k, VETTE, dict(r=0.337, w=0.275, rim=0.254), dict(r=0.353, w=0.345, rim=0.267), crease=SHARP)
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, -0.25, -0.95, 0.38, 0.86, lean=0.26, nu=10, nv=8, off=.006)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.0, 0.11, 0.19, 30, 2)
    k.headlight_quad((2.06, 0.72, 0.60), (0.62, 0.38, 0.50), 0.34, 0.055, slant=0.08, taper=0.5, dots='row')
    k.decal('intakeC', 'Gloss', 'front', -0.34, 0.34, 0.18, 0.40, 12, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.44, s * 0.82, 0.18, 0.42, 10, 5))
    k.decal('splitter', 'Carbon', 'front', -0.92, 0.92, 0.12, 0.17, 30, 2)
    k.decal('frunkvent', 'Gloss', 'top', 1.55, 1.85, -0.30, 0.30, 8, 4)
    for s in (1, -1):
        k.fan('tail', 'Taillight', -1.75, 0.86, 0.92, s * 0.48, s * 0.84, 12, 2, off=.007)
        k.fan('tail', 'Taillight', -1.75, 0.78, 0.86, s * 0.48, s * 0.58, 4, 3, off=.007)
    k.fan('rearpanel', 'Gloss', -1.75, 0.46, 0.66, -0.66, 0.66, 30, 4)
    k.fan('diffuser', 'Carbon', -1.75, 0.26, 0.46, -0.66, 0.66, 30, 3)
    for y in (-0.17, -0.06, 0.06, 0.17): k.exhaust(y, 0.56, r=0.045, mirror=False)
    k.post_wing(-2.0, 1.20, 0.30, 1.76, -2.08, 0.50, aoa=-9, endplate=[(-1.94, 1.16), (-1.96, 1.28), (-2.32, 1.30), (-2.34, 1.18), (-2.2, 1.14)])
    k.join(); k.wheels(spokes=10, spoke_w=(0.024, 0.016))


# ---- Honda NSX Type S (NC1): 4.53 m long, 1.94 m wide, 1.21 m tall, 2.63 m wheelbase. A low wedge nose with thin
# "Jewel Eye" lights swept up the fenders, a black grille, a cab-forward glass bubble, the big intake scooped out of the
# door into the rear fender, "floating" flying-buttress C-pillars round a small upright rear window, thin C-shaped tail
# lights at the corners over a full-width black mesh, and four exhausts in the middle.
NSX = dict(L=4.535, W=1.94, H=1.215, WB=2.63, fo=1.00, clear=0.11, nose_zb=0.26, tail_zb=0.36,
           top=[(2.315, 0.50), (2.22, 0.58), (2.0, 0.655), (1.6, 0.735), (1.2, 0.80), (0.95, 0.845), (0.55, 1.02), (0.12, 1.18),
                (-0.25, 1.215), (-0.62, 1.19), (-0.80, 1.11), (-1.05, 1.05), (-1.6, 1.00), (-2.0, 0.985), (-2.22, 0.93)],
           belt=[(2.315, 0.47), (2.15, 0.60), (1.75, 0.72), (1.25, 0.81), (0.90, 0.855), (0.40, 0.875), (-0.30, 0.90), (-0.75, 0.97),
                 (-1.25, 1.0), (-1.9, 0.97), (-2.22, 0.88)],
           plan=[(2.315, 0.42), (2.22, 0.66), (2.0, 0.84), (1.65, 0.935), (1.30, 0.965), (0.70, 0.935), (0.0, 0.93), (-0.70, 0.955),
                 (-1.30, 0.97), (-1.85, 0.945), (-2.12, 0.86), (-2.22, 0.74)],
           roof=[(1.0, 0.70), (0.5, 0.64), (0.0, 0.60), (-0.5, 0.56), (-0.85, 0.50)],
           cab=(0.95, 0.12, -0.60, -0.80), bulge=[(0.0, 0.02), (1.0, 0.06), (2.0, 0.05)], hip=0.03,
           side=(0.86, -0.72), doors=(0.80, -0.30), mirror_x=0.78, rw_w=0.62, rw_bulge=0.0)
def nsx(k):
    S = build(k, NSX, dict(r=0.327, w=0.245, rim=0.241), dict(r=0.345, w=0.305, rim=0.254), crease=SOFT)
    xf, xr = S.xf, S.xr
    # door scoop: a deep black intake ahead of the rear wheel with a body-colour blade over it
    for s in (1, -1):
        k.slanted('sideintake', 'Gloss', s, -0.40, -0.98, 0.36, 0.82, lean=0.22, nu=10, nv=8, off=.006)
        k.slanted('intakeblade', 'Paint', s, -0.40, -0.98, 0.66, 0.70, lean=0.22, nu=10, nv=2, off=.010)
        k.decal('skirt', 'Carbon', side(s), -0.95, 1.00, 0.12, 0.19, 30, 2)
        k.decal('buttress', 'Gloss', side(s), -0.62, -0.80, 0.98, 1.08, 6, 3, off=.004)     # the air channel under the floating pillar
    # front: swept LED eyes, the black face bar between them, a big mesh mouth and corner intakes, carbon splitter
    k.headlight_quad((2.10, 0.70, 0.62), (0.62, 0.38, 0.55), 0.30, 0.055, slant=0.06, taper=0.45, dots='row')
    k.decal('facebar', 'Gloss', 'front', -0.52, 0.52, 0.53, 0.575, 16, 1, off=.008)
    k.decal('grille', 'Gloss', 'front', -0.46, 0.46, 0.22, 0.44, 16, 5)
    both(lambda s: k.decal('intakeS', 'Gloss', 'front', s * 0.56, s * 0.82, 0.20, 0.42, 8, 5))
    k.decal('splitter', 'Carbon', 'front', -0.86, 0.86, 0.13, 0.18, 30, 2)
    both(lambda s: k.decal('hoodvent', 'Gloss', 'top', 1.55, 1.85, s * 0.10, s * 0.32, 6, 4))
    # rear: C-shaped tail lights at the corners, full-width black mesh, carbon diffuser, four pipes
    for s in (1, -1):
        k.fan('tailC', 'Taillight', -1.7, 0.855, 0.885, s * 0.42, s * 0.92, 14, 2, off=.007)
        k.fan('tailC', 'Taillight', -1.7, 0.70, 0.885, s * 0.86, s * 0.92, 3, 5, off=.007)
    k.fan('tailband', 'Gloss', -1.7, 0.84, 0.90, -0.42, 0.42, 20, 2)
    k.fan('rearmesh', 'Gloss', -1.7, 0.46, 0.78, -0.72, 0.72, 40, 6)
    k.fan('diffuser', 'Carbon', -1.7, 0.24, 0.44, -0.66, 0.66, 30, 3)
    for y in (-0.07, 0.07):
        for z in (0.50, 0.60): k.exhaust(y, z, r=0.042, mirror=False)
    k.join(); k.wheels(spokes=10, spoke_w=(0.022, 0.015))


# ---- Pagani Utopia: 4.60 m long, 2.04 m wide, 1.17 m tall, 2.79 m wheelbase. A smooth, round body with high
# fenders round a narrow teardrop canopy (a spine down the roof to the engine cover), two round lamps in each oval
# headlight pod, round tail lights, a tall integrated ducktail and the famous four-pipe cluster in the middle.
UTOPIA = dict(L=4.60, W=2.037, H=1.169, WB=2.794, fo=0.95, clear=0.11, nose_zb=0.24, tail_zb=0.42,
              top=[(2.347, 0.50), (2.25, 0.58), (2.0, 0.645), (1.5, 0.715), (1.0, 0.80), (0.55, 0.98), (0.15, 1.13), (-0.2, 1.169),
                   (-0.75, 1.12), (-1.2, 1.05), (-1.6, 1.00), (-1.95, 1.025), (-2.15, 1.045), (-2.253, 0.94)],
              belt=[(2.347, 0.48), (2.1, 0.645), (1.4, 0.80), (1.0, 0.835), (0.4, 0.84), (-0.4, 0.86), (-1.0, 0.95), (-1.4, 0.995),
                    (-2.0, 1.0), (-2.253, 0.90)],
              plan=[(2.347, 0.45), (2.25, 0.70), (2.0, 0.865), (1.4, 0.99), (0.8, 0.955), (0.0, 0.94), (-0.8, 0.99), (-1.4, 1.018),
                    (-2.0, 0.97), (-2.20, 0.86), (-2.253, 0.76)],
              roof=[(1.0, 0.64), (0.3, 0.56), (-0.3, 0.52), (-0.75, 0.45), (-1.2, 0.37), (-1.6, 0.30)],
              cab=(1.0, 0.15, -0.75, -1.50), bulge=[(0.0, 0.03), (1.0, 0.08), (2.0, 0.06)], hip=0.05, side=(0.92, -0.70),
              doors=(0.86, -0.40), mirror_x=0.80, rw_w=0.85, rw_bulge=0.0, roof_crown=0.05)
def utopia(k):
    S = build(k, UTOPIA, dict(r=0.346, w=0.265, rim=0.267), dict(r=0.36, w=0.325, rim=0.279), crease=SOFT)
    for s in (1, -1):
        k.oval('lamppod', 'Gloss', V(2.04, s * 0.68, 0.62), V(0.70, s * 0.34, 0.45), 0.17, 0.085, .005, n=10)
        for dy in (-0.06, 0.06):
            k.oval('lamp', 'Chrome', V(2.04, s * (0.68 + dy), 0.62), V(0.70, s * 0.34, 0.45), 0.055, 0.055, .008, n=8)
            k.oval('lampled', 'Headlight', V(2.04, s * (0.68 + dy), 0.62), V(0.70, s * 0.34, 0.45), 0.032, 0.032, .011, n=6)
        k.slanted('sideintake', 'Gloss', s, -0.40, -0.90, 0.58, 0.84, lean=0.08, nu=6, nv=6, off=.006)
        for y in (0.58, 0.76): k.oval('tailround', 'Taillight', V(-2.10, s * y, 0.86), V(-1, s * 0.25 * y, 0.1), 0.06, 0.06, .006, n=6)
    k.decal('mouth', 'Gloss', 'front', -0.42, 0.42, 0.18, 0.34, 14, 4)
    k.decal('spine', 'Carbon', 'top', -1.55, 0.10, -0.035, 0.035, 20, 1, off=.006)
    k.fan('diffuser', 'Carbon', -1.7, 0.28, 0.48, -0.66, 0.66, 30, 3)
    k.oval('pipering', 'Carbon', V(-2.2, 0, 0.72), V(-1, 0, 0), 0.17, 0.16, .004, n=10)
    for y in (-0.07, 0.07):
        for z in (0.66, 0.79): k.exhaust(y, z, r=0.045, mirror=False)             # the four-pipe cluster
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
