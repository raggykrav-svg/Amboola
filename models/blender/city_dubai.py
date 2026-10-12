# Dubai for AMBOOLA (see cities.py): glass towers built from a lobby, stacked 16 m sections (four floors) and a crown,
# palms, the Burj Khalifa, the Burj Al Arab on its island and the Grand Mosque.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, arch_wall, band, outline, flat_roof, tree_palm)

def build():
    M.get('Glass', '#3d6688', .06, metal=.6); M.get('Frame', '#e8edf1', .5); M.get('Stone', '#e8dcc0', .8); M.get('Gold', '#d5b46a', .25, metal=1.0)
    M.get('Screen', '#c9b48a', .7); M.get('Canopy', '#f2f2f2', .4)
    for k in range(3):
        for lo in (False, True): family(k, lo)
    t = Node('T_palm'); M.get('Trunk', '#8a6a48', .9); M.get('Leaf', '#3a8a3a', .8, double=True); M.get('Coconut', '#7a5a2a', .8); tree_palm(t, h=10)
    burj(); sail(); mosque()

def glass_floor(n, W, D, z, fh, fins, lit, rnd, lo, wall='Wall'):
    """one floor of curtain wall: a glass band (lit / dark panels) with a slab edge and vertical fins"""
    for side in range(4):
        F = Face(n, W, D, side, z); L = F.L; k = 4
        for i in range(k):
            u0, u1 = -L / 2 + i * L / k, -L / 2 + (i + 1) * L / k
            F.quad('Window' if rnd.random() < lit else 'Glass', u0, .55, u1, fh, .02)
        F.quad(wall, -L / 2, 0, L / 2, .55, .03)
        if not lo and fins:
            for j in range(fins + 1): F.block(wall, -L / 2 + j * L / fins - .15, 0, -L / 2 + j * L / fins + .15, fh, 0, .45)

def family(k, lo):
    """0: blue glass tower, white fins, a glass pyramid crown with a spire. 1: banded tower with deep white floor slabs
    and a helipad. 2: sand-stone tower with arabesque screens and a pointed gold crown"""
    W = D = 31.0; GH, FH = 8.0, 16.0; x = 'l' if lo else ''; rnd = random.Random(40 + k)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH)
    g.box('Wall', (0, 0, GH - .5), (W, D, 1.0))
    g.box('Glass', (0, 0, (GH - 1) / 2), (W - 2, D - 2, GH - 1))                       # the double-height lobby, set back
    for sx in (-1, 1):
        for sy in (-1, 1): g.box('Wall', (sx * (W / 2 - .6), sy * (D / 2 - .6), GH / 2), (1.2, 1.2, GH))
    if not lo:
        for side in range(4):
            F = Face(g, W, D, side, 0); F.block('Canopy', -5, 4.6, 5, 4.9, 0, 4.0); F.quad('Gold', -2, 0, 2, 3.2, -0.95)
    u = Node(f'U{k}{x}', W=W, D=D, H=FH)
    if k == 2: u.box('Wall', (0, 0, FH / 2), (W, D, FH))
    else: u.box('Glass', (0, 0, FH / 2), (W - .4, D - .4, FH))
    for f in range(4):
        z = f * 4.0
        if k == 0: glass_floor(u, W, D, z, 4.0, 6, .45, rnd, lo)
        elif k == 1:
            glass_floor(u, W, D, z, 4.0, 0, .5, rnd, lo)
            if not lo: band(u, 'Wall', W, D, z, .35, .9)
        else:
            for side in range(4):
                F = Face(u, W, D, side, z)
                for i in range(5):
                    c = -F.L / 2 + (i + .5) * F.L / 5
                    F.quad('Window' if rnd.random() < .5 else 'Glass', c - 2.2, .6, c + 2.2, 3.4, .03)
                    if not lo:
                        for j in range(4): F.quad('Screen', c - 2.2 + j * 1.1 + .1, .6, c - 2.2 + j * 1.1 + .25, 3.4, .25)
    r = Node(f'R{k}{x}', W=W, D=D)
    if k == 0:
        r.box('Wall', (0, 0, .6), (W + .4, D + .4, 1.2))
        r.cyl('Glass', (0, 0, 1.2), (W - 2) * .7, 14, segs=4, r2=2.0, rz=math.pi / 4, smooth=False)
        r.cyl('Frame', (0, 0, 15), .5, 26, segs=6, r2=.08); r.sphere('Glow', (0, 0, 41.2), .7, segs=6, rings=4)
    elif k == 1:
        flat_roof(r, W, D, 0, par=1.2, coping='Frame')
        r.cyl('Wall', (0, 0, 1.2), 9, 3, segs=24); r.cyl('Dark', (0, 0, 4.2), 10, .3, segs=24)
        for s in (-1, 1): r.box('Frame', (s * 2.2, 0, 4.55), (.8, 7, .05))
        r.box('Frame', (0, 0, 4.55), (3.6, .8, .05))
        for j in range(12): a = 2 * math.pi * j / 12; r.sphere('Glow', (math.cos(a) * 9.6, math.sin(a) * 9.6, 4.45), .25, segs=6, rings=4)
    else:
        r.box('Wall', (0, 0, 1.5), (W + .6, D + .6, 3))
        r.cyl('Gold', (0, 0, 3), W * .62, 22, segs=4, r2=.5, rz=math.pi / 4, smooth=False)
        for s in range(4):
            a = s * math.pi / 2; r.box('Glow', (math.cos(a) * (W / 2 - 1), math.sin(a) * (W / 2 - 1), 4), (1.5 if s % 2 else 16, 16 if s % 2 else 1.5, .3))

# ---------------------------------------------------------------- Burj Khalifa: game anchor (ox-15, oz-140), base about 22 m round
def burj():
    M.get('Steel', '#b9c6d2', .3, metal=.7); M.get('Glass', '#3d6688', .06, metal=.6)
    n = Node('L_burj')
    # three wings round a hexagonal core, each stepping back at a different height so the setbacks spiral up
    core = lambda r, z0, z1: n.cyl('Steel', (0, 0, z0), r, z1 - z0, segs=6, smooth=False)
    core(9, 0, 560)
    for w in range(3):
        a = w * 2 * math.pi / 3; d = V(math.cos(a), math.sin(a), 0)
        tiers = [(22, 0, 120), (19, 120, 210), (16, 210, 290), (13, 290, 360), (10, 360, 420)]
        for j, (L, z0, z1) in enumerate(tiers):
            z1 = z1 + w * 18; z0 = z0 + (w * 18 if j else 0)
            c = d * (L / 2 + 2); wid = 12 - j * 1.4
            n.box('Glass', c + V(0, 0, (z0 + z1) / 2), (L, wid, z1 - z0), rz=a)
            for s in (-1, 1):   # the silver fins down the wing edges
                n.box('Steel', c + V(-d.y, d.x, 0) * s * (wid / 2 + .2) + V(0, 0, (z0 + z1) / 2), (L, .6, z1 - z0), rz=a)
            n.cyl('Steel', d * (L + 2) + V(0, 0, z0), wid / 2 + .3, z1 - z0, segs=10)       # rounded wing tip
    for z in range(20, 440, 40): n.cyl('Steel', (0, 0, z), 10, 1.5, segs=6, smooth=False)
    n.cyl('Steel', (0, 0, 560), 6, 40, segs=8, r2=2.5); n.cyl('Steel', (0, 0, 600), 2.5, 120, segs=8, r2=.4)   # the spire
    n.sphere('Glow', (0, 0, 721), 1.4, segs=8, rings=6)

# ---------------------------------------------------------------- Burj Al Arab: game anchor (ox+420, C.z1+150), on an island r 40-46
def sail():
    M.get('SailW', '#f6f8fa', .35); M.get('Steel', '#b9c6d2', .3, metal=.7); M.get('Sand', '#e8d9b5', .9); M.get('Glass', '#3d6688', .06, metal=.6)
    n = Node('L_sail')
    n.lathe('Sand', [(46, -3), (40, 1.0), (0, 1.0)], segs=32, smooth=False)                # the island
    n.lathe('Frame', [(41, 1.0), (40.5, 1.4)], segs=32)
    # the sail: a curved fabric face over a V-shaped glass tower, rising to 230 m
    def edge(t): return V(0, 0, 0) + V(60 * math.sin(t * math.pi * .55) * (1 - t * .6), 0, t * 230)
    rows = 16
    for i in range(rows):
        t0, t1 = i / rows, (i + 1) / rows; a, b = edge(t0), edge(t1)
        for s in (-1, 1):
            w0, w1 = 20 * (1 - t0 * .8), 20 * (1 - t1 * .8)
            n.face('SailW', [V(a.x, 0, a.z), V(b.x, 0, b.z), V(0, s * w1, b.z), V(0, s * w0, a.z)], V(1, 0, 0) + V(0, s * .5, 0))
            n.face('Glass', [V(0, s * w0, a.z), V(0, s * w1, b.z), V(-8, s * w1 * .6, b.z), V(-8, s * w0 * .6, a.z)], V(-.3, s, 0))
        n.face('Glass', [V(-8, -20 * (1 - t0 * .8) * .6, a.z), V(-8, -20 * (1 - t1 * .8) * .6, b.z), V(-8, 20 * (1 - t1 * .8) * .6, b.z), V(-8, 20 * (1 - t0 * .8) * .6, a.z)], V(-1, 0, 0))
    for s in (-1, 1):   # the steel exoskeleton legs and the cross braces
        n.tube('Steel', [V(-14, s * 22, 1), V(-10, s * 16, 80), V(-6, s * 10, 160), V(-2, s * 4, 232)], 1.6, segs=8, r_end=.8)
        for z in (40, 100, 160): n.tube('Steel', [V(-12, s * 20, z - 20), V(-8, -s * 14, z + 20)], .7, segs=6)
    n.cyl('Steel', (0, 0, 230), 1.0, 30, segs=8, r2=.3)
    n.cyl('SailW', (24, 0, 190), 9, .8, segs=20); n.cyl('Glow', (24, 0, 190.8), 7, .05, segs=20)   # the helipad
    n.box('Steel', (14, 0, 190), (18, 2.5, 1.5))

# ---------------------------------------------------------------- the Grand Mosque: game anchor (ox-525, oz+160), 40 x 40
def mosque():
    M.get('MosqueW', '#f6f2ea', .6); M.get('Gold', '#d5b46a', .25, metal=1.0); M.get('Water', '#3fa6c8', .08, metal=.2); M.get('Arch', '#e9e2d4', .6)
    n = Node('L_mosque')
    n.box('MosqueW', (0, 0, 7), (34, 34, 14))
    for side in range(4):   # an arcade of pointed arches all round
        F = Face(n, 40, 40, side, 0)
        for i in range(9):
            u = -16 + i * 4; F.block('MosqueW', u - .5, 0, u + .5, 8, -3, 0)
            F.poly('Dark', [(u + .6, 0), (u + 3.4, 0), (u + 3.4, 5.5), (u + 2, 7.2), (u + .6, 5.5)], -2.9)
        F.block('MosqueW', -20, 8, 20, 9.2, -3, 0)
        for i in range(10): F.block('MosqueW', -19.5 + i * 4.3, 9.2, -18.7 + i * 4.3, 10.2, -.6, 0)   # crenellation
    n.cyl('MosqueW', (0, 0, 14), 9, 3.5, segs=24)
    n.sphere('MosqueW', (0, 0, 17.5), 12, segs=24, rings=12, scale=(1, 1, 1.15), hemi=True); n.cyl('Gold', (0, 0, 31), .6, 4, segs=8, r2=.15)
    n.sphere('Gold', (0, 0, 31.5), .9, segs=8, rings=6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            n.cyl('MosqueW', (sx * 11, sy * 11, 14), 3, 1.5, segs=12); n.sphere('MosqueW', (sx * 11, sy * 11, 15.5), 3.4, segs=12, rings=6, hemi=True)
            n.sphere('Gold', (sx * 11, sy * 11, 19.2), .4, segs=6, rings=4)
            x, y = sx * 22, sy * 22   # the four minarets
            n.cyl('MosqueW', (x, y, 0), 2.0, 30, segs=12); n.cyl('MosqueW', (x, y, 30), 2.6, 1.0, segs=12)
            n.cyl('MosqueW', (x, y, 31), 1.6, 12, segs=12); n.cyl('MosqueW', (x, y, 43), 2.2, .8, segs=12)
            n.cyl('MosqueW', (x, y, 43.8), 1.3, 3, segs=12); n.sphere('Gold', (x, y, 46.8), 1.4, segs=10, rings=6, scale=(1, 1, 1.6), hemi=True)
            n.cyl('Gold', (x, y, 49), .12, 2.5, segs=6)
    n.box('Water', (0, -30, .15), (12, 16, .1)); n.box('MosqueW', (0, -30, .07), (13.5, 17.5, .14))   # the reflecting pool
