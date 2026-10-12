# Italy for AMBOOLA (see cities.py): ochre palazzi with green shutters and terracotta roofs, cypress trees, the
# Colosseum, the Leaning Tower and a piazza fountain.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, arch_wall, storey, band, window, door, outline, hip, chimney, tree_cypress)

def build():
    M.get('Roof', '#ffffff', .75); M.get('Stone', '#e6d6b8', .85); M.get('Frame', '#efe3c8', .75); M.get('ShutterG', '#3f6b3a', .7)
    M.get('Door', '#5a3a22', .6); M.get('Brick', '#a8543a', .9); M.get('Pot', '#b5532f', .8)
    for k in range(2):
        for lo in (False, True): family(k, lo)
    t = Node('T_cypress'); M.get('Cypress', '#1f4a2c', .9); M.get('Bark', '#5a4632', .9); tree_cypress(t, h=11)
    colosseum(); tower(); fountain()

def family(k, lo):
    """palazzo: rusticated ground floor with arched doors and shops, shuttered windows (or pedimented ones), small
    balconies on the piano nobile and top floor, a cornice and a low hipped tile roof with deep eaves"""
    W = D = 21.0; GH, FH = 4.2, 3.5; x = 'l' if lo else ''; rnd = random.Random(20 + k)
    S = dict(spacing=3.3, ww=1.1, wh=1.9, v0=.75, frame='Frame', fw=.15, sill='Stone', margin=1.5, lite=lo)
    S = dict(S, shutters='ShutterG') if k == 0 else dict(S, frame='Stone', hood='Stone', ped=True)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH)
    g.box('Wall', (0, 0, GH / 2), (W, D, GH))
    if not lo:
        for z in (.9, 1.8, 2.7): band(g, 'Stone', W, D, z, .12, .04)
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3.0
        for i, u in enumerate((-L / 3, 0, L / 3)):
            mat = 'Door' if i == 1 else 'Window'
            if lo: F.poly(mat, outline(u - 1.1, 0, u + 1.1, 3.2, 1.1), .04)
            else: door(F, u, 2.2, 3.3, dict(frame='Stone', fw=.25, door_arch=.5, step='Stone' if i == 1 else None), mat)
    band(g, 'Stone', W, D, GH - .3, .3, .1)
    u = Node(f'U{k}{x}', W=W, D=D, H=FH); storey(u, W, D, 0, FH, S, rnd)
    b = Node(f'B{k}{x}', W=W, D=D, H=FH); storey(b, W, D, 0, FH, dict(S, rail='Metal', bal=.7, slab='Stone'), rnd)
    if not lo:
        for n in (u, b): band(n, 'Stone', W, D, .45, .1, .03)
    r = Node(f'R{k}{x}', W=W, D=D)
    band(r, 'Stone', W, D, 0, .5, .25); band(r, 'Stone', W, D, .5, .2, .5)            # the cornice
    hip(r, W + .8, D + .8, .7, 3.0, o=.9, t=.25)
    if not lo: chimney(r, W / 4, D / 5, 1.5, w=.8, d=.8, h=2.2, m='Brick', pots=1)

# ---------------------------------------------------------------- the Colosseum: game anchor (ox+255, oz+35), ellipse 72 x 57
def colosseum():
    M.get('Trav', '#d8c3a0', .9); M.get('TravDark', '#bfa984', .95); M.get('Sand', '#c9a777', 1); M.get('Seats', '#c7b391', .95)
    n = Node('L_colosseum'); A, B, N = 72.0, 57.0, 60
    pt = lambda t, s=1.0: V(math.cos(t) * A * s, -math.sin(t) * B * s, 0)        # game z -> Blender -y
    for i in range(N):
        t0, t1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N; p0, p1 = pt(t0), pt(t1); mid = (p0 + p1) / 2
        T = (p1 - p0); L = T.length; T.normalize(); Nn = V(T.y, -T.x, 0)
        if Nn.dot(mid) < 0: Nn = -Nn
        F = Frame3(n, mid, T, Nn); tiers = 2 if 39 <= i <= 48 else 3
        for k in range(tiers):
            z0 = k * 11.0; F.z0 = z0; pw = 1.5
            arch_wall(F, 'Trav', -L / 2 + pw, L / 2, 5.5, 9.6, -1.1, 1.1, segs=8, soffit='TravDark')
            F.block('Trav', -L / 2, 0, -L / 2 + pw, 9.6, -1.1, 1.1)                    # pier
            F.block('TravDark', -L / 2 + .25, .4, -L / 2 + pw - .25, 8.8, 1.1, 1.45)      # half-column
            F.block('Trav', -L / 2, 9.6, L / 2, 11, -1.2, 1.5)                          # entablature
        if tiers == 3:   # the attic with its small windows, and the masts' corbels
            F.z0 = 33.0
            F.block('Trav', -L / 2, 0, L / 2, 10.5, -1.1, 1.1); F.block('TravDark', -L / 2 + .2, .3, -L / 2 + 1.0, 9.5, 1.1, 1.35)
            if i % 2 == 0: F.quad('Dark', -.6, 4.2, .6, 6.0, 1.12)
            F.block('Trav', -L / 2, 10.5, L / 2, 11.2, -1.2, 1.4)
        else:            # broken top of the ruined side
            F.z0 = 22.0; h = 2.5 + 3.0 * math.sin(i * 1.7) ** 2; F.block('Trav', -L / 2, 0, L / 2, h, -1.1, 1.1)
    # the seating bowl, high enough for cars to drive under, and the sand floor
    rings = [(.97, 30), (.92, 26), (.86, 21), (.80, 16), (.74, 11), (.70, 7)]
    for (s0, z0), (s1, z1) in zip(rings, rings[1:]):
        for i in range(N):
            t0, t1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
            a, b, c, d = pt(t0, s0), pt(t1, s0), pt(t1, s1), pt(t0, s1)
            n.face('Seats', [a + V(0, 0, z0), b + V(0, 0, z0), c + V(0, 0, z1), d + V(0, 0, z1)], V(0, 0, 1))
            n.face('TravDark', [a + V(0, 0, z0 - .8), d + V(0, 0, z1 - .8), c + V(0, 0, z1 - .8), b + V(0, 0, z0 - .8)], V(0, 0, -1))
    for i in range(N):   # the podium wall round the arena
        t0, t1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N; a, b = pt(t0, .70), pt(t1, .70)
        n.face('Trav', [a + V(0, 0, 7), b + V(0, 0, 7), b + V(0, 0, 4.2), a + V(0, 0, 4.2)], -(a + b))
    n.face('Sand', [pt(2 * math.pi * i / 40, .69) + V(0, 0, .08) for i in range(40)], V(0, 0, 1))

# ---------------------------------------------------------------- the Leaning Tower: game anchor (ox-255, oz-115), the game tilts it
def tower():
    M.get('Marble', '#f3efe6', .45); M.get('MarbleDark', '#ddd6c8', .5); M.get('BellRoof', '#9c9a94', .6)
    n = Node('L_tower'); R0 = 7.6
    n.cyl('Marble', (0, 0, 0), R0, 58, segs=30)
    n.cyl('MarbleDark', (0, 0, 0), R0 + .5, .8, segs=30)                              # plinth
    for k in range(15):   # blind arcade on the ground storey
        a = 2 * math.pi * k / 15; n.cyl('MarbleDark', (math.cos(a) * (R0 + .15), math.sin(a) * (R0 + .15), .8), .32, 9.5, segs=8)
    F0 = lambda a: Frame3(n, V(math.cos(a), math.sin(a), 0) * R0, V(-math.sin(a), math.cos(a), 0), V(math.cos(a), math.sin(a), 0))
    for k in range(15):
        a = 2 * math.pi * (k + .5) / 15; F = F0(a); F.z0 = 0; w = 2 * math.pi * R0 / 15
        arch_wall(F, 'Marble', -w / 2 + .2, w / 2 - .2, 8.2, 10.6, .02, .3, segs=6)
    for lv in range(6):   # six open galleries, each a ring of columns and arches round the core
        z = 11 + lv * 6.9
        n.cyl('MarbleDark', (0, 0, z), R0 + 1.6, .5, segs=30)                         # gallery floor
        n.cyl('MarbleDark', (0, 0, z + 6.2), R0 + 1.75, .7, segs=30)                  # cornice
        for k in range(30):
            a = 2 * math.pi * k / 30; rr_ = R0 + 1.3
            n.cyl('Marble', (math.cos(a) * rr_, math.sin(a) * rr_, z + .5), .2, 4.3, segs=6)
            F = Frame3(n, V(math.cos(a + math.pi / 30), math.sin(a + math.pi / 30), 0) * rr_, V(-math.sin(a + math.pi / 30), math.cos(a + math.pi / 30), 0), V(math.cos(a + math.pi / 30), math.sin(a + math.pi / 30), 0), z)
            w = 2 * math.pi * rr_ / 30; arch_wall(F, 'Marble', -w / 2 + .15, w / 2 - .15, 4.8, 6.2, -.25, .25, segs=5)
    zb = 11 + 6 * 6.9   # the belfry
    n.cyl('Marble', (0, 0, zb), 5.4, 6.5, segs=24); n.cyl('MarbleDark', (0, 0, zb + 6.5), 5.8, .6, segs=24)
    for k in range(12):
        a = 2 * math.pi * k / 12; F = Frame3(n, V(math.cos(a), math.sin(a), 0) * 5.4, V(-math.sin(a), math.cos(a), 0), V(math.cos(a), math.sin(a), 0), zb)
        F.poly('Dark', [(-.7, 1.5), (.7, 1.5), (.7, 4.2), (0, 5.0), (-.7, 4.2)], .02)
    n.cyl('BellRoof', (0, 0, zb + 7.1), 5.0, 1.0, segs=24, r2=4.2)

# ---------------------------------------------------------------- the piazza fountain: game anchor (ox-85, oz+185), basin r 9.5
def fountain():
    M.get('Water', '#3fa6c8', .08, metal=.2); M.get('Cobble', '#a59d90', .95); M.get('Marble', '#f3efe6', .45); M.get('Bronze', '#6f6a4a', .4, metal=.7)
    n = Node('L_fountain')
    n.lathe('Cobble', [(0, .04), (24, .04)], segs=40, smooth=False)                    # the cobbled piazza
    n.lathe('Marble', [(9.5, .04), (9.6, .5), (9.4, 1.1), (9.0, 1.2), (8.8, .9)], segs=40)   # the basin rim
    n.lathe('Water', [(0, .85), (8.85, .85)], segs=40, smooth=False)
    n.lathe('Marble', [(1.4, .85), (1.1, 2.4), (1.6, 2.6)], segs=16)                 # pedestal
    n.lathe('Marble', [(.4, 2.6), (4.2, 2.9), (4.4, 3.3), (3.9, 3.4), (.5, 3.0)], segs=24)   # lower bowl
    n.lathe('Water', [(0, 3.25), (3.95, 3.25)], segs=24, smooth=False)
    n.lathe('Marble', [(.5, 3.3), (.35, 5.2), (1.9, 5.5), (2.0, 5.8), (.4, 5.6)], segs=16)   # upper bowl
    n.lathe('Bronze', [(.5, 5.8), (.45, 7.2), (.35, 7.6), (0, 8.4)], segs=10)         # the statue on top
    n.sphere('Bronze', (0, 0, 8.6), .32, segs=10, rings=6)
    for k in range(4):   # dolphins spouting into the basin
        a = k * math.pi / 2 + math.pi / 4; c = V(math.cos(a), math.sin(a), 0)
        n.tube('Bronze', [c * 1.3 + V(0, 0, 1.0), c * 1.8 + V(0, 0, 1.6), c * 2.3 + V(0, 0, 1.4)], .3, segs=6, r_end=.12)
    for k in range(6):   # benches round the piazza
        a = k * math.pi / 3; c = V(math.cos(a), math.sin(a), 0) * 15
        n.box('Marble', c + V(0, 0, .45), (2.6, .6, .12), rz=a + math.pi / 2); n.box('Marble', c + V(0, 0, .22), (.4, .5, .44), rz=a + math.pi / 2)
