# Tesla models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/teslas.py -- --car all
#   blender -b --factory-startup --python models/blender/teslas.py -- --car cyberbeast --renders DIR --sheet --samples 8
#
# Tesla look: smooth grille-less noses, slim swept headlights, glass roofs, flush handles, separate wrap-round tail
# lights and aero wheels. The Model S, 3, Y, X and the new Roadster come from carshape (each car's real measurements and
# outline); the 2008 Roadster remaps the 718 Spyder table; the Cybertruck and Cybercab are their own flat-panel shells.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from porsches import TTAY, TCAY, T718_SPY
from supercars import TFER, remap, SOFT, PSF90
from carshape import build, scaled

def glass(k, X, Z, ws, rw, top, bot, pillars=(), ws_top=None, frame='Gloss'):
    """a glasshouse defined on another car, moved through x/z maps. ws=(base_x, top_x, base_z, slope, hw_base, hw_top),
    rw=(x_bot, x_top, z_bot, slope, hw_bot, hw_top); ws_top overrides where the windscreen ends (Model X)"""
    bx, tx, bz, sl, hb, ht = ws; tz = bz + (bx - tx) * sl
    ntx = ws_top if ws_top is not None else X(tx)
    k.windscreen(X(bx), ntx, Z(bz), (Z(tz) - Z(bz)) / (X(bx) - X(tx)), hb, ht, sweep=0.24)
    if rw:
        xb, xt, zb, sl, hb, ht = rw; zt = zb + (xt - xb) * sl
        k.rear_window(X(xb), X(xt), Z(zb), (Z(zt) - Z(zb)) / (X(xt) - X(xb)), hb, ht)
    k.side_glass([(X(x), Z(z)) for x, z in top], [(X(x), Z(z)) for x, z in bot], pillars=[X(p) for p in pillars], pillar_w=0.05, frame=frame)

def tesla_face(k, c, f, w=0.26, h=0.07, intake=(0.40, 0.20, 0.30)):
    """smooth grille-less nose: sleek tapered lamps (LED eyebrow + twin projectors), a lower intake with a body bar,
    slim corner air curtains and a gloss lip"""
    k.lamp(c, f, w * 1.3, h * 1.7, 'tesla', slant=0.05, taper=0.35)
    hw, z0, z1 = intake
    k.project('intake', 'Gloss', lambda u, v: k.VIEW['front'](lerp(-1, 1, u) * lerp(hw, hw * .88, v), lerp(z0, z1 + .02, v)), 16, 3)
    k.decal('intakebar', 'Paint', 'front', -hw * .55, hw * .55, (z0 + z1) / 2, (z0 + z1) / 2 + .012, 10, 1, off=.010)
    k.curtain((c[0] + 0.12, c[1] + 0.10, z1 + 0.06), (0.85, 0.50, 0.05), 0.05, 0.16, slant=0.02)
    k.decal('lip', 'Gloss', 'front', -hw * 1.6, hw * 1.6, z0 - .05, z0 - .02, 20, 1)

def flush_handles(k, xs, z):
    for s in (1, -1):
        for x in xs: k.decal('handle', 'Chrome', side(s), x - .15, x, z, z + .018, 4, 1, off=.003)

# ======================================================================= Model S Plaid / Model 3 Performance (Taycan sedan base)
TAY_WS = (1.00, 0.28, 0.87, 0.57, 0.66, 0.60)
TAY_RW = (-1.95, -1.10, 1.00, 0.29, 0.45, 0.54)
TAY_TOP = [(0.80, 0.93), (0.55, 1.06), (0.25, 1.25), (-0.30, 1.30), (-0.85, 1.24), (-1.25, 1.12), (-1.50, 0.99)]
TAY_BOT = [(0.80, 0.925), (-0.60, 0.935), (-1.30, 0.955), (-1.50, 0.975)]

def tesla_body(k, P, F, R, lights, tail_z, ox, lip=None):
    """a Tesla from carshape: the shell from the car's real outline, an all-glass roof, flush handles, the smooth face"""
    S = build(k, P, F, R, crease=SOFT)
    ws0, ws1, rw1, rw0 = P['cab']
    k.decal('roof', 'Glass', 'top', rw1 + 0.05, ws1 - 0.02, -S.roofw(ws1) * 0.8, S.roofw(ws1) * 0.8, 16, 12, off=.004)   # all-glass roof
    flush_handles(k, [0.15, -0.85], S.belt(0.0) - 0.08)
    tesla_face(k, *lights)
    k.tail_clusters(ox, tail_z[0], tail_z[1], 0.45, 0.86)
    k.fan('diffuser', 'Gloss', ox, S.zb(S.tail) + 0.06, S.zb(S.tail) + 0.20, -0.62, 0.62, 30, 3)
    if lip: k.spoiler(S.tail + 0.10, lip, 0.12, 1.20, aoa=-4, thick=0.06, mat='Carbon', strut_y=0.35)
    return S

# Model S Plaid: 5.02 x 1.96 x 1.43 m, 2.96 m wheelbase - the smooth liftback saloon: a low grille-less nose, a long
# glass roof sweeping into a short tail with a carbon lip
PMS = dict(L=5.021, W=1.963, H=1.431, WB=2.96, fo=0.95, clear=0.13, nose_zb=0.30, tail_zb=0.40,
           top=[(2.43, 0.66), (2.34, 0.74), (2.0, 0.82), (1.48, 0.89), (1.0, 0.95), (0.85, 0.98), (0.45, 1.20), (0.0, 1.40),
                (-0.45, 1.431), (-1.05, 1.40), (-1.5, 1.30), (-1.9, 1.15), (-2.3, 1.03), (-2.5, 1.02), (-2.591, 0.96)],
           belt=[(2.43, 0.64), (2.0, 0.84), (1.48, 0.92), (0.85, 0.98), (-0.5, 1.0), (-1.48, 1.02), (-2.3, 1.02), (-2.591, 0.94)],
           plan=[(2.43, 0.60), (2.34, 0.80), (2.0, 0.92), (1.48, 0.97), (0.5, 0.95), (-0.5, 0.955), (-1.48, 0.9815), (-2.2, 0.95),
                 (-2.5, 0.87), (-2.591, 0.78)],
           roof=[(0.85, 0.70), (0.0, 0.65), (-0.9, 0.62), (-1.5, 0.56), (-1.9, 0.50)],
           cab=(0.85, 0.0, -1.05, -1.95), bulge=0.03, hip=0.03, side=(0.78, -1.70), pillars=(-0.35,), pillar_w=0.07,
           doors=(0.78, -0.35), mirror_x=0.72, rw_w=0.85)
def modelsplaid(k):
    tesla_body(k, PMS, dict(r=0.355, w=0.265, rim=0.267), dict(r=0.36, w=0.295, rim=0.267),
               ((2.22, 0.66, 0.72), (0.72, 0.30, 0.52)), (0.92, 0.99), -2.2, lip=1.03)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# Model 3 Performance: 4.72 x 1.85 x 1.44 m, 2.88 m wheelbase - the Model S outline at the smaller car's real size
PM3 = scaled(PMS, L=4.72, W=1.85, H=1.441, WB=2.875, fo=0.86)
def model3p(k):
    tesla_body(k, PM3, dict(r=0.345, w=0.235, rim=0.254), dict(r=0.345, w=0.235, rim=0.254),
               ((2.08, 0.62, 0.72), (0.72, 0.30, 0.52), 0.24, 0.07, (0.36, 0.20, 0.30)), (0.92, 1.0), -2.1, lip=1.03)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# ======================================================================= Model Y / Model X (Cayenne coupe base)
CAY_WS = (1.05, 0.30, 1.10, 0.64, 0.70, 0.63)
CAY_RW = (-2.12, -1.15, 1.21, 0.27, 0.50, 0.58)
CAY_TOP = [(0.85, 1.13), (0.60, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.40, 1.36), (-1.75, 1.20)]
CAY_BOT = [(0.85, 1.12), (-0.60, 1.135), (-1.40, 1.16), (-1.75, 1.175)]

# Model Y Performance: 4.79 x 1.92 x 1.61 m, 2.89 m wheelbase - the crossover: a tall smooth nose, a glass roof
# sloping down to a short tail with a lip spoiler, black arch trims
PMY = dict(L=4.79, W=1.92, H=1.61, WB=2.89, fo=0.90, clear=0.17, nose_zb=0.36, tail_zb=0.44,
           top=[(2.345, 0.80), (2.27, 0.88), (1.95, 0.95), (1.445, 1.02), (1.0, 1.07), (0.85, 1.10), (0.4, 1.38), (0.0, 1.58),
                (-0.45, 1.61), (-1.1, 1.58), (-1.55, 1.48), (-1.95, 1.32), (-2.25, 1.18), (-2.38, 1.16), (-2.445, 1.10)],
           belt=[(2.345, 0.78), (1.95, 0.97), (1.445, 1.04), (0.85, 1.10), (-0.5, 1.12), (-1.445, 1.14), (-2.2, 1.15), (-2.445, 1.08)],
           plan=[(2.345, 0.66), (2.27, 0.82), (1.95, 0.92), (1.445, 0.955), (0.5, 0.94), (-0.5, 0.945), (-1.445, 0.96), (-2.1, 0.94),
                 (-2.38, 0.86), (-2.445, 0.80)],
           roof=[(0.85, 0.72), (0.0, 0.68), (-0.9, 0.65), (-1.55, 0.58), (-1.95, 0.52)],
           cab=(0.85, 0.0, -1.10, -2.0), bulge=0.03, hip=0.03, side=(0.78, -1.75), pillars=(-0.35,), pillar_w=0.07,
           doors=(0.78, -0.35), mirror_x=0.72, rw_w=0.85, mirror_size=(0.15, 0.20, 0.11))
def crossover(k, P, F, R, lights, ox):
    S = tesla_body(k, P, F, R, lights, (P['belt'][-2][1] - 0.04, P['belt'][-2][1] + 0.04), ox)
    k.arch_trim(0.04, mat='Gloss')
    for s in (1, -1): k.decal('sill', 'Gloss', side(s), -1.10, 1.10, 0.26, 0.34, 30, 2, off=.005)
    return S

def modelyp(k):
    S = crossover(k, PMY, dict(r=0.37, w=0.255, rim=0.267), dict(r=0.37, w=0.275, rim=0.267),
                  ((2.20, 0.66, 0.88), (0.75, 0.30, 0.45), 0.26, 0.07, (0.40, 0.38, 0.50)), -2.2)
    k.spoiler(S.tail + 0.12, 1.18, 0.12, 1.20, aoa=-4, thick=0.06, mat='Carbon', strut_y=0.35)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# Model X Plaid: 5.06 x 2.00 x 1.68 m, 2.97 m wheelbase - the big crossover with the panoramic windscreen running back
# over the heads and the falcon-wing doors hinged along the roof
PMX = scaled(PMY, L=5.057, W=1.999, H=1.68, WB=2.965, fo=0.95)
PMX['cab'] = (PMX['cab'][0], -0.45, -1.25, PMX['cab'][3])
def modelxplaid(k):
    S = crossover(k, PMX, dict(r=0.39, w=0.265, rim=0.279), dict(r=0.39, w=0.29, rim=0.279),
                  ((2.30, 0.70, 0.90), (0.75, 0.30, 0.45), 0.28, 0.075, (0.42, 0.38, 0.52)), -2.3)
    for s in (1, -1):   # falcon-wing door seams along the roof
        k.decal('falcon', 'Black', 'top', -1.20, -0.45, s * 0.30 - .005, s * 0.30 + .005, 12, 1, off=.006)
    k.spoiler(S.tail + 0.14, 1.24, 0.14, 1.30, aoa=-4, thick=0.06, mat='Paint', strut_y=0.40)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

# ======================================================================= Roadster (2008) - open two-seater (718 Spyder base)
R8X = [(-2.23, -1.97), (-1.14, -1.24), (1.34, 1.12), (2.22, 1.97)]
def roadster08(k):
    X = lambda x: pl(R8X, x); zf = lambda z: z * 0.97
    k.loft(stations(remap(T718_SPY, R8X, 1.016, zf)), **SOFT)
    k.arches(dict(F=dict(x=1.12, r=0.31, w=0.18, y=0.77, rim=0.216), R=dict(x=-1.24, r=0.32, w=0.22, y=0.78, rim=0.229)))
    k.cut_box((X(-0.12), 0, 1.15), (1.20, 1.18, 0.80), round_=0.12)                     # cockpit
    k.surface()
    def ws(u, v):
        y = lerp(-1, 1, u) * lerp(0.60, 0.53, v); x = lerp(X(0.84), X(0.44), v) - 0.10 * (y / 0.6) ** 2
        return V(x, y, lerp(0.86, 1.10, v) - 0.03 * (y / 0.6) ** 2)
    k.panel('windscreen', 'Glass', ws, 16, 6)
    k.panel('ws_frame', 'Gloss', lambda u, v: ws(u, 1.0) + V(-v * .02, 0, v * .03), 16, 1, thick=0.02)
    for s in (1, -1):
        k.panel('apillar', 'Gloss', lambda u, v, s=s: ws(0 if s < 0 else 1, u) + V(0, s * v * .025, 0), 6, 1, thick=0.02)
        k.decal('doorline', 'Black', side(s), X(0.62) - .004, X(0.62) + .004, 0.25, 0.86, 1, 12, off=.002)
        k.slanted('sideintake', 'Gloss', s, X(-0.55), X(-0.86), 0.45, 0.68, lean=0.08, nu=6, nv=6)
    k.box('hoop', 'Black', (X(-0.62), 0, 1.02), (0.06, 1.0, 0.10), bevel=.02)            # roll hoop behind the seats
    for s in (1, -1):    # round-ish Lotus-era headlights
        k.oval('headlight', 'Chrome', V(1.80, s * 0.58, 0.64), V(0.75, s * 0.25, 0.55), 0.10, 0.075, .006, n=8)
        k.oval('headlight_core', 'Headlight', V(1.80, s * 0.58, 0.64), V(0.75, s * 0.25, 0.55), 0.045, 0.04, .009, n=5)
    k.decal('intake', 'Gloss', 'front', -0.42, 0.42, 0.20, 0.32, 16, 3)
    k.tail_clusters(X(-1.40), 0.78, 0.86, 0.40, 0.80)
    k.fan('diffuser', 'Gloss', X(-1.40), 0.28, 0.42, -0.60, 0.60, 30, 3)
    k.mirrors(X(0.55), 0.98, 0.95, size=(0.12, 0.16, 0.08))
    k.interior(X(-0.10), 1.18, 0.64, h=0.24, seats_x=X(-0.40), seat_z=0.78, open_top=True, wheel_x=X(0.30))
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', caliper=(0.18, 0.06, 0.08))

# ======================================================================= Roadster (next-gen) - glass-roof targa hypercar (Ferrari mid base)
# The next Roadster: about 4.3 x 1.98 x 1.16 m - a smooth mid-engine-looking targa with a removable glass roof (the
# SF90's outline at the Roadster's size, which Tesla showed at the 2017 reveal)
PRN = scaled(PSF90, L=4.30, W=1.98, H=1.16, WB=2.65, fo=0.95)
def roadster2(k):
    S = build(k, PRN, dict(r=0.35, w=0.255, rim=0.267), dict(r=0.36, w=0.325, rim=0.279), crease=SOFT)
    k.decal('roof', 'Glass', 'top', -0.60, 0.10, -0.46, 0.46, 12, 10, off=.004)          # the removable glass roof
    flush_handles(k, [-0.20], 0.80)
    tesla_face(k, (S.nose - 0.30, 0.66, 0.60), (0.66, 0.34, 0.52), 0.28, 0.06, (0.44, 0.16, 0.28))
    k.light_bar(-1.7, 0.88, 0.91, 0.80, bg=0.012, frac=0.7)
    k.fan('diffuser', 'Gloss', -1.7, 0.26, 0.44, -0.66, 0.66, 30, 3)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.03, 0.02))

# ======================================================================= Cybertruck Cyberbeast - flat stainless panels
# front axle x=1.82, rear axle x=-1.78, 5.68 m long, 2.2 m wide, 1.93 m tall (roof apex at x=0.15)
TCYB = [
    ( 2.84, .50, .95, .80, .95, 1.04, .90, 1.055, .55, 1.06, 1.06),
    ( 2.60, .42, 1.02, .85, 1.0, 1.10, .94, 1.12, .60, 1.16, 1.16),
    ( 1.82, .42, 1.04, .90, 1.0, 1.12, .92, 1.17, .62, 1.38, 1.38),
    ( 1.00, .42, 1.04, .90, 1.0, 1.13, .90, 1.22, .62, 1.64, 1.64),
    ( 0.15, .42, 1.04, .90, 1.0, 1.13, .88, 1.30, .62, 1.93, 1.93),
    (-0.80, .42, 1.04, .90, 1.0, 1.13, .90, 1.24, .64, 1.70, 1.70),
    (-1.78, .42, 1.04, .90, 1.0, 1.13, .92, 1.17, .64, 1.43, 1.43),
    (-2.60, .45, 1.03, .88, .99, 1.13, .94, 1.14, .64, 1.20, 1.20),
    (-2.84, .52, .98, .86, .96, 1.12, .92, 1.13, .62, 1.14, 1.14),
]
def cyberbeast(k):
    k.loft(stations(TCYB), crease_all=1.0, levels=1)
    k.arches(dict(F=dict(x=1.82, r=0.43, w=0.30, y=0.88, rim=0.254, gap=0.08), R=dict(x=-1.78, r=0.43, w=0.30, y=0.88, rim=0.254, gap=0.08)))
    k.surface()
    # faceted black wheel-arch cladding and lower sills
    k.arch_trim(0.09, mat='Black', a0=-0.1, a1=math.pi + 0.1)
    both(lambda s: k.decal('sill', 'Black', side(s), -1.30, 1.35, 0.40, 0.58, 20, 3, off=.006))
    # huge flat windscreen, trapezoid side glass, light bars front and rear
    k.windscreen(1.80, 0.25, 1.385, (1.90 - 1.385) / (1.80 - 0.25), 0.60, 0.50, sweep=0.0)
    k.side_glass([(1.60, 1.22), (1.00, 1.47), (0.15, 1.72), (-0.70, 1.55), (-1.20, 1.42)],
                 [(1.60, 1.20), (0.0, 1.20), (-1.20, 1.21)], pillars=[0.10], pillar_w=0.07)
    k.fan('headbar', 'Headlight', 0.0, 1.035, 1.050, -0.42, 0.42, 40, 1, off=.006, rear=False)
    k.fan('headbar_bg', 'Gloss', 0.0, 1.02, 1.065, -0.44, 0.44, 40, 2, off=.003, rear=False)
    k.light_bar(-1.0, 1.10, 1.125, 0.42, bg=0.012, frac=1.0)
    k.fan('tailgate', 'Black', -1.0, 0.55, 0.75, -0.38, 0.38, 30, 3)
    for s in (1, -1):
        for xg in (1.62, 0.10, -1.25): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.60, 1.20, 1, 10, off=.002)
    for y in (-0.62, 0.62):   # bed rails (vault) seams
        k.decal('vault', 'Black', 'top', -2.80, -0.80, y - .005, y + .005, 20, 1, off=.005)
    k.box('mirror', 'Black', (1.40, 1.08, 1.30), (0.12, 0.14, 0.10))
    k.box('mirror', 'Black', (1.40, -1.08, 1.30), (0.12, 0.14, 0.10))
    k.interior(0.20, 1.60, 1.10, l=2.6, h=0.40, seats_x=0.0, seat_y=0.40, seat_z=1.15)
    k.join(); k.wheels(spokes=5, nut='bolts', spoke_w=(0.06, 0.05), offroad=True, caliper=(0.26, 0.09, 0.10))

# ======================================================================= Cybercab - two-seat robotaxi, no steering wheel
# 4.30 m long, 1.95 m wide, 1.42 m tall; axles at +-1.40; one big butterfly door each side, light bars front and rear
TCAB = [
    ( 2.15, .28, .64, .44, .62, .52, .52, .56, .32, .58, .58),
    ( 2.08, .18, .86, .47, .84, .61, .70, .67, .44, .66, .66),
    ( 1.92, .16, .94, .52, .92, .69, .76, .76, .52, .72, .72),
    ( 1.65, .15, .965, .57, .95, .77, .78, .83, .54, .79, .79),
    ( 1.40, .15, .975, .61, .96, .82, .79, .87, .54, .845, .84),
    ( 1.10, .14, .965, .63, .95, .86, .79, .91, .55, .90, .895),
    ( 0.85, .14, .955, .63, .94, .89, .80, .97, .62, 1.08, 1.10),
    ( 0.45, .14, .95, .62, .935, .91, .77, 1.14, .65, 1.33, 1.36),
    ( 0.00, .14, .95, .62, .935, .92, .76, 1.18, .66, 1.39, 1.415),
    (-0.50, .14, .955, .63, .94, .93, .755, 1.17, .65, 1.37, 1.395),
    (-1.00, .15, .975, .65, .955, .95, .74, 1.13, .62, 1.29, 1.31),
    (-1.40, .16, .99, .67, .965, .965, .72, 1.09, .58, 1.20, 1.22),
    (-1.75, .19, .98, .69, .955, .98, .68, 1.05, .52, 1.10, 1.115),
    (-2.00, .25, .935, .70, .91, .98, .60, 1.03, .44, 1.05, 1.06),
    (-2.12, .32, .84, .69, .81, .96, .52, 1.00, .36, 1.01, 1.015),
    (-2.15, .40, .66, .66, .62, .91, .42, .94, .26, .95, .95),
]
def cybercab(k):
    k.loft(stations(TCAB), **SOFT)
    k.arches(dict(F=dict(x=1.40, r=0.36, w=0.245, y=0.80, rim=0.254), R=dict(x=-1.40, r=0.36, w=0.245, y=0.81, rim=0.254)))
    k.surface()
    k.arch_trim(0.035, mat='Gloss')
    # one sweep of glass: raked windscreen into a glass roof, a long hatch window, small side windows
    k.windscreen(0.86, 0.10, 0.95, 0.60, 0.70, 0.60, sweep=0.22)
    k.decal('roof', 'Glass', 'top', -0.95, 0.15, -0.52, 0.52, 16, 12, off=.004)
    k.rear_window(-1.95, -1.00, 1.03, 0.29, 0.50, 0.56)
    k.side_glass([(0.78, 0.96), (0.50, 1.12), (0.20, 1.30), (-0.30, 1.35), (-0.85, 1.27), (-1.30, 1.16), (-1.62, 1.06)],
                 [(0.78, 0.955), (-0.60, 0.965), (-1.30, 0.99), (-1.62, 1.01)], pillars=[-0.95], pillar_w=0.09)
    # butterfly doors: the seam runs up the side and over into the roof, the door hinges at the windscreen
    for s in (1, -1):
        for xg in (0.80, -0.95): k.decal('doorline', 'Black', side(s), xg - .004, xg + .004, 0.26, 0.95, 1, 12, off=.002)
        k.decal('butterfly', 'Black', 'top', -0.95, 0.15, s * 0.55 - .005, s * 0.55 + .005, 12, 1, off=.006)
        k.decal('sill', 'Gloss', side(s), -1.00, 1.00, 0.22, 0.30, 24, 2, off=.005)
        k.decal('camera', 'Gloss', side(s), 1.02, 1.10, 0.66, 0.71, 3, 2, off=.006)          # self-driving cameras on the fenders
    flush_handles(k, [-0.55], 0.88)
    # light bars: one thin strip right across the nose, one across the tail
    k.fan('headbar_bg', 'Gloss', 0.6, 0.705, 0.745, -0.62, 0.62, 50, 2, off=.003, rear=False)
    k.fan('headbar', 'Headlight', 0.6, 0.716, 0.734, -0.60, 0.60, 50, 1, off=.006, rear=False)
    k.decal('intake', 'Gloss', 'front', -0.50, 0.50, 0.20, 0.30, 16, 3)
    k.light_bar(-1.0, 0.905, 0.93, 0.55, bg=0.012, frac=0.8)
    k.fan('diffuser', 'Gloss', -1.0, 0.30, 0.44, -0.60, 0.60, 30, 3)
    k.interior(-0.30, 1.40, 0.76, l=2.0, h=0.38, seats_x=-0.30, seat_z=0.86)    # two seats, a screen, no wheel
    k.no_wheel = k.two_seats = True    # the real Cybercab: two seats, no steering wheel, no pedals, one big screen
    k.box('screen', 'Gloss', (0.55, 0, 1.00), (0.06, 0.70, 0.22), rot=(0, math.radians(-25), 0), bevel=.01)
    a = math.radians(25); k.slab('screenface', 'Screen', (0.55 - 0.032 * math.cos(a), 0, 1.00 - 0.032 * math.sin(a)), (0, 1, 0), (-math.cos(a), 0, -math.sin(a)), 0.33, 0.1, 0.002)
    k.join(); k.wheels(spokes=16, nut='bolts', spoke_w=(0.016, 0.06))    # near-closed aero covers

# ======================================================================= registry
CARS = {
    'roadster2': (roadster2, '#9c0e1b', '#1b1b1d', '#c8141b'),
    'roadster08': (roadster08, '#b0101a', '#9da1a6', '#1b1b1d'),
    'modelsplaid': (modelsplaid, '#3a3d41', '#2a2b2e', '#c8141b'),
    'model3p': (model3p, '#f0f0ec', '#2a2b2e', '#c8141b'),
    'modelxplaid': (modelxplaid, '#8e9297', '#2a2b2e', '#c8141b'),
    'modelyp': (modelyp, '#1b2d58', '#2a2b2e', '#c8141b'),
    'cyberbeast': (cyberbeast, '#b7bbbf', '#1b1b1d', '#1b1b1d'),
    'cybercab': (cybercab, '#c9b27a', '#c8c9cc', '#1b1b1d'),
}

if __name__ == '__main__':
    main(CARS, 'teslas.py')
