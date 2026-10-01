# Tesla models for Amboola, built in Blender by script (see carkit.py for the building blocks).
#
#   blender -b --factory-startup --python models/blender/teslas.py -- --car all
#   blender -b --factory-startup --python models/blender/teslas.py -- --car cyberbeast --renders DIR --sheet --samples 8
#
# Tesla look: smooth grille-less noses, slim swept headlights, glass roofs, flush handles, separate wrap-round tail
# lights and aero wheels. Bodies reuse the Porsche/Ferrari station tables remapped to each Tesla's real size; the
# Cybertruck is its own flat-panel shell (every edge fully creased).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carkit import Car, V, lerp, pl, stations, edit, both, side, main
from porsches import TTAY, TCAY, T718_SPY
from supercars import TFER, remap, SOFT

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
    """slim swept headlights and a small lower intake on a smooth nose"""
    k.headlight_quad(c, f, w, h, slant=0.05, taper=0.2, dots='row')
    hw, z0, z1 = intake
    k.decal('intake', 'Gloss', 'front', -hw, hw, z0, z1, 16, 3)

def flush_handles(k, xs, z):
    for s in (1, -1):
        for x in xs: k.decal('handle', 'Chrome', side(s), x - .15, x, z, z + .018, 4, 1, off=.003)

# ======================================================================= Model S Plaid / Model 3 Performance (Taycan sedan base)
TAY_WS = (1.00, 0.28, 0.87, 0.57, 0.66, 0.60)
TAY_RW = (-1.95, -1.10, 1.00, 0.29, 0.45, 0.54)
TAY_TOP = [(0.80, 0.93), (0.55, 1.06), (0.25, 1.25), (-0.30, 1.30), (-0.85, 1.24), (-1.25, 1.12), (-1.50, 0.99)]
TAY_BOT = [(0.80, 0.925), (-0.60, 0.935), (-1.30, 0.955), (-1.50, 0.975)]

def sedan(k, xs, ys, zf, wheels, lights, tail_z, lip=None):
    X = lambda x: pl(xs, x)
    k.loft(stations(remap(TTAY, xs, ys, zf)), **SOFT); k.arches(wheels); k.surface()
    glass(k, X, zf, TAY_WS, TAY_RW, TAY_TOP, TAY_BOT, pillars=[-0.07, -1.08])
    k.decal('roof', 'Glass', 'top', X(-1.05), X(0.25), -0.52 * ys, 0.52 * ys, 16, 12, off=.004)    # all-glass roof
    for s in (1, -1):
        for xg in (0.80, -0.08, -1.12): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, 0.25, zf(0.92), 1, 12, off=.002)
    flush_handles(k, [X(0.15), X(-0.85)], zf(0.86))
    tesla_face(k, *lights)
    k.tail_clusters(X(-1.90), tail_z[0], tail_z[1], 0.45, 0.86)
    k.fan('diffuser', 'Gloss', X(-1.90), 0.30, 0.44, -0.62, 0.62, 30, 3)
    if lip: k.spoiler(X(-2.38), lip, 0.12, 1.20, aoa=-4, thick=0.06, mat='Carbon', strut_y=0.35)
    k.mirrors(X(0.74), 1.0 * ys + .04, zf(1.0), size=(0.13, 0.18, 0.09))
    k.interior(X(-0.40), 1.38 * ys, zf(0.74), l=2.2, h=0.38, seats_x=X(-0.20), seat_z=zf(0.84))

def modelsplaid(k):   # 4.97 m, 1.96 m wide, 1.43 m tall; front axle 1.50, rear -1.46
    xs = [(-2.50, -2.485), (-1.40, -1.46), (1.50, 1.50), (2.48, 2.485)]
    zf = lambda z: z + max(0.0, z - 0.90) * 0.11
    sedan(k, xs, 0.995, zf, dict(F=dict(x=1.50, r=0.355, w=0.265, y=0.83, rim=0.267), R=dict(x=-1.46, r=0.36, w=0.295, y=0.835, rim=0.267)),
          ((2.25, 0.66, 0.70), (0.72, 0.30, 0.52)), (0.90, 0.97), lip=1.00)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

def model3p(k):       # 4.72 m, 1.85 m wide, 1.44 m tall; front axle 1.42, rear -1.46
    xs = [(-2.50, -2.36), (-1.40, -1.46), (1.50, 1.42), (2.48, 2.36)]
    zf = lambda z: z + max(0.0, z - 0.90) * 0.13
    sedan(k, xs, 0.94, zf, dict(F=dict(x=1.42, r=0.345, w=0.235, y=0.78, rim=0.254), R=dict(x=-1.46, r=0.345, w=0.235, y=0.78, rim=0.254)),
          ((2.12, 0.62, 0.70), (0.72, 0.30, 0.52), 0.24, 0.07, (0.36, 0.20, 0.30)), (0.88, 0.96), lip=0.99)
    k.join(); k.wheels(spokes=10, nut='bolts', spoke_w=(0.026, 0.018))

# ======================================================================= Model Y / Model X (Cayenne coupe base)
CAY_WS = (1.05, 0.30, 1.10, 0.64, 0.70, 0.63)
CAY_RW = (-2.12, -1.15, 1.21, 0.27, 0.50, 0.58)
CAY_TOP = [(0.85, 1.13), (0.60, 1.30), (0.30, 1.52), (-0.30, 1.57), (-0.90, 1.50), (-1.40, 1.36), (-1.75, 1.20)]
CAY_BOT = [(0.85, 1.12), (-0.60, 1.135), (-1.40, 1.16), (-1.75, 1.175)]

def crossover(k, xs, ys, zf, wheels, lights, ws_top=None):
    X = lambda x: pl(xs, x)
    rows = remap(TCAY, xs, ys, zf)
    rows = [rows[0][:1] + (rows[0][1] + .04,) + rows[0][2:]] + rows[1:]          # smoother, lower-bumper nose
    k.loft(stations(rows), **SOFT); k.arches(wheels); k.surface()
    glass(k, X, zf, CAY_WS, CAY_RW, CAY_TOP, CAY_BOT, pillars=[-0.15, -1.15], ws_top=ws_top)
    k.decal('roof', 'Glass', 'top', X(-1.10), ws_top if ws_top is not None else X(0.30), -0.55 * ys, 0.55 * ys, 16, 12, off=.004)
    for s in (1, -1):
        for xg in (0.86, -0.17, -1.22): k.decal('doorline', 'Black', side(s), X(xg) - .004, X(xg) + .004, 0.30, zf(1.13), 1, 14, off=.002)
        k.decal('sill', 'Gloss', side(s), X(-1.02), X(1.08), 0.24, 0.32, 30, 2, off=.005)
    flush_handles(k, [X(0.15), X(-0.90)], zf(1.07))
    k.arch_trim(0.04, mat='Gloss')
    tesla_face(k, *lights)
    k.tail_clusters(X(-1.90), zf(1.03), zf(1.11), 0.45, 0.86)
    k.fan('rearpanel', 'Gloss', X(-1.90), 0.42, 0.56, -0.62, 0.62, 30, 3)
    k.mirrors(X(0.80), 1.0 * ys + .06, zf(1.20), size=(0.15, 0.20, 0.11))
    k.interior(X(-0.45), 1.45 * ys, zf(0.98), l=2.4, h=0.42, seats_x=X(-0.20), seat_z=zf(1.06))
    return X

def modelyp(k):       # 4.75 m, 1.92 m wide, 1.62 m tall; front axle 1.42, rear -1.47
    xs = [(-2.48, -2.375), (-1.40, -1.47), (1.50, 1.42), (2.46, 2.375)]
    zf = lambda z: z * 0.99
    crossover(k, xs, 0.965, zf, dict(F=dict(x=1.42, r=0.37, w=0.255, y=0.81, rim=0.267), R=dict(x=-1.47, r=0.37, w=0.275, y=0.815, rim=0.267)),
              ((2.22, 0.66, 0.86), (0.75, 0.30, 0.45), 0.26, 0.07, (0.40, 0.36, 0.48)))
    k.spoiler(pl(xs, -2.28), 1.20, 0.12, 1.20, aoa=-4, thick=0.06, mat='Carbon', strut_y=0.35)
    k.join(); k.wheels(spokes=5, pairs=True, nut='bolts', spoke_w=(0.034, 0.024))

def modelxplaid(k):   # 5.05 m, 2.0 m wide, 1.68 m tall; front axle 1.50, rear -1.47; windscreen that runs over the heads
    xs = [(-2.48, -2.525), (-1.40, -1.47), (1.50, 1.50), (2.46, 2.525)]
    zf = lambda z: z * 1.02
    X = crossover(k, xs, 1.005, zf, dict(F=dict(x=1.50, r=0.39, w=0.265, y=0.85, rim=0.279), R=dict(x=-1.47, r=0.39, w=0.29, y=0.855, rim=0.279)),
                  ((2.32, 0.70, 0.88), (0.75, 0.30, 0.45), 0.28, 0.075, (0.42, 0.36, 0.50)), ws_top=-0.30)
    for s in (1, -1):   # falcon-wing door seams along the roof
        k.decal('falcon', 'Black', 'top', X(-1.10), X(-0.20), s * 0.30 - .005, s * 0.30 + .005, 12, 1, off=.006)
    k.spoiler(X(-2.28), 1.25, 0.14, 1.30, aoa=-4, thick=0.06, mat='Paint', strut_y=0.40)
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
RNX = [(-2.33, -2.15), (-1.30, -1.30), (1.36, 1.35), (2.31, 2.15)]
def roadster2(k):
    X = lambda x: pl(RNX, x); zf = lambda z: z
    k.loft(stations(remap(TFER, RNX, 1.01, zf)), **SOFT)
    k.arches(dict(F=dict(x=1.35, r=0.35, w=0.255, y=0.84, rim=0.267), R=dict(x=-1.30, r=0.36, w=0.325, y=0.845, rim=0.279))); k.surface()
    glass(k, X, zf, (0.85, 0.20, 0.86, 0.45, 0.62, 0.52), (-1.20, -0.82, 0.99, 0.30, 0.38, 0.42),
          [(0.70, 0.86), (0.45, 0.98), (0.15, 1.12), (-0.25, 1.16), (-0.65, 1.10), (-1.0, 0.98)], [(0.70, 0.855), (-0.30, 0.87), (-1.0, 0.95)])
    k.decal('roof', 'Glass', 'top', X(-0.70), X(0.20), -0.48, 0.48, 12, 10, off=.004)          # removable glass roof
    for s in (1, -1): k.decal('doorline', 'Black', side(s), X(0.70) - .004, X(0.70) + .004, 0.22, 0.84, 1, 12, off=.002)
    flush_handles(k, [X(-0.20)], 0.80)
    tesla_face(k, (2.00, 0.66, 0.62), (0.72, 0.32, 0.52), 0.28, 0.06, (0.44, 0.18, 0.28))
    k.light_bar(X(-1.70), 0.84, 0.87, 0.80, bg=0.012, frac=0.7)
    k.fan('diffuser', 'Gloss', X(-1.70), 0.28, 0.44, -0.66, 0.66, 30, 3)
    k.mirrors(X(0.62), 1.06, 0.93, size=(0.13, 0.17, 0.08))
    k.interior(X(-0.20), 1.26, 0.64, h=0.32, seats_x=X(-0.42), seat_z=0.74)
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

# ======================================================================= registry
CARS = {
    'roadster2': (roadster2, '#9c0e1b', '#1b1b1d', '#c8141b'),
    'roadster08': (roadster08, '#b0101a', '#9da1a6', '#1b1b1d'),
    'modelsplaid': (modelsplaid, '#3a3d41', '#2a2b2e', '#c8141b'),
    'model3p': (model3p, '#f0f0ec', '#2a2b2e', '#c8141b'),
    'modelxplaid': (modelxplaid, '#8e9297', '#2a2b2e', '#c8141b'),
    'modelyp': (modelyp, '#1b2d58', '#2a2b2e', '#c8141b'),
    'cyberbeast': (cyberbeast, '#b7bbbf', '#1b1b1d', '#1b1b1d'),
}

if __name__ == '__main__':
    main(CARS, 'teslas.py')
