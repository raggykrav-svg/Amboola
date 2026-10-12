# Paris for AMBOOLA (see cities.py): Haussmann apartment blocks, plane trees, the Eiffel Tower, the Arc de Triomphe
# and a café square.
import math, random
from citykit import (Node, M, V, lerp, Face, storey, band, corners, window, door, outline, grow, gable, hip, mansard, flat_roof,
                     chimney, shopfront, tree_palm, tree_round, tree_cypress, tree_fir)

def build():
    M.get('Roof', '#ffffff', .45, metal=.35); M.get('Chimney', '#e7dccb', .9); M.get('Pot', '#c0643a', .8); M.get('Awning', '#b3141b', .8, double=True)
    M.get('AwningG', '#1f5a3a', .8, double=True); M.get('Sign', '#1d2f4a', .6); M.get('Frame', '#efe6d4', .75); M.get('Stone', '#e8dcc4', .85)
    for k in range(2):
        for lo in (False, True): paris_family(k, lo)
    t = Node('T_round'); M.get('Leaves', '#5a8a3a', .85); M.get('Bark', '#6a5a48', .9); tree_round(t, h=8.5, r=3.2)
    eiffel(); arc(); cafe()

def paris_family(k, lo):
    """Haussmann block: shops and a carriage door below, French windows with iron railings, long balconies on the
    second and top floors, a zinc mansard with dormers and chimney stacks. lo = the plain far-away version"""
    W = D = 23.0; GH, FH = 4.6, 3.1; x = 'l' if lo else ''; rnd = random.Random(10 + k)
    S = dict(spacing=3.5, ww=1.25, wh=2.15, v0=.45, frame='Frame', fw=.16, fo=.08, sill='Stone', rail='Metal', margin=1.6, bars='Frame', lite=lo)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH)
    g.box('Wall', (0, 0, GH / 2), (W, D, GH))
    if not lo:
        for z in (1.2, 2.4, 3.6): band(g, 'Stone', W, D, z, .1, .03)          # rusticated stone courses
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3.0
        for i, u in enumerate((-L / 3, 0, L / 3)):
            if i == 1 and side % 2 == 0:
                if lo: F.quad('Door', u - .75, 0, u + .75, 3.2, .04)
                else: door(F, u, 1.5, 3.2, dict(frame='Frame', fw=.18, door_arch=.5, step='Stone'), 'Door')
            elif lo: F.quad('Window', u - 2.3, .3, u + 2.3, 3.1, .04)
            else: shopfront(F, u, 4.6, 3.1, S, awning=['Awning', 'AwningG'][(side + k) % 2] if (side + i) % 2 == 0 else None, sign='Sign')
    band(g, 'Stone', W, D, GH - .25, .25, .12)
    u = Node(f'U{k}{x}', W=W, D=D, H=FH)
    storey(u, W, D, 0, FH, dict(S, hood='Stone' if k else None), rnd)
    if not lo: band(u, 'Stone', W, D, FH - .12, .12, .05)
    b = Node(f'B{k}{x}', W=W, D=D, H=FH)
    storey(b, W, D, 0, FH, dict(S, rail=None), rnd)
    for side in range(4):   # the long wrought-iron balcony of the second and top floors
        F = Face(b, W, D, side, 0)
        if not lo: F.block('Stone', -F.L / 2 + .4, .25, F.L / 2 - .4, .45, 0, 1.0)
        F.quad('Metal', -F.L / 2 + .4, .45, F.L / 2 - .4, 1.4, .97)
        if not lo:
            for s in (-1, 1): b.face('Metal', [F.P(s * (F.L / 2 - .4), .45, 0), F.P(s * (F.L / 2 - .4), .45, .97), F.P(s * (F.L / 2 - .4), 1.4, .97), F.P(s * (F.L / 2 - .4), 1.4, 0)], F.T * s)
    band(b, 'Stone', W, D, FH - .12, .12, .05)
    r = Node(f'R{k}{x}', W=W, D=D)
    band(r, 'Stone', W, D, 0, .45, .35)                                     # the big cornice under the roof
    mansard(r, W, D, .45, 3.4, 1.5, 1.4, dormers=None if lo else (3.6, 1.1, 1.7, S, rnd))
    for cx in (-W / 4, W / 4) if k == 0 else (-W / 3, 0, W / 3):
        chimney(r, cx, D / 2 - 3.2, 3.6, w=.9, d=2.4, h=1.6, m='Chimney', pots=0 if lo else 4)

def eiffel():
    """lattice tower: four curved legs that merge above the second platform into one tapering shaft"""
    M.get('Iron', '#6e5a46', .55, metal=.45); M.get('Deck', '#5b4a3a', .6, metal=.3)
    n = Node('L_eiffel')
    def half(y):   # distance from the centre to a leg's centre line
        pts = [(0, 25), (30, 19.5), (57, 13.5), (90, 8.0), (115, 4.6)]
        for (y0, a), (y1, b) in zip(pts, pts[1:]):
            if y <= y1: return lerp(a, b, (y - y0) / (y1 - y0))
        return 4.6
    def legw(y): return lerp(9.0, 3.6, min(1, y / 115))
    def bar(a, b, t=.42):   # a lattice member from a to b
        a, b = V(*a), V(*b); d = b - a; L = d.length
        if L < 1e-3: return
        n.box('Iron', (a + b) / 2, (t, t, L), rz=math.atan2(d.y, d.x), ry=math.acos(max(-1, min(1, d.z / L))))
    ys = [0, 9, 18, 28, 38, 48, 57, 66, 76, 86, 96, 106, 115]
    for sx in (-1, 1):
        for sy in (-1, 1):
            def corner(y, cx, cy):
                h, w = half(y), legw(y) / 2; return (sx * h + cx * w, sy * h + cy * w, y)
            cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            for y0, y1 in zip(ys, ys[1:]):
                for i, (cx, cy) in enumerate(cs):
                    bar(corner(y0, cx, cy), corner(y1, cx, cy), .55)                 # the four corner rails
                    nx, ny = cs[(i + 1) % 4]
                    bar(corner(y0, cx, cy), corner(y1, nx, ny), .3); bar(corner(y0, nx, ny), corner(y1, cx, cy), .3)   # X bracing
                    bar(corner(y1, cx, cy), corner(y1, nx, ny), .3)
    # the shaft above the second platform
    def shaft(y): return lerp(5.2, .9, min(1, (y - 115) / 100)) if y < 215 else .9
    sy_ = [115, 125, 136, 148, 161, 175, 190, 205, 215]
    cs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for y0, y1 in zip(sy_, sy_[1:]):
        for i, (cx, cy) in enumerate(cs):
            nx, ny = cs[(i + 1) % 4]
            P = lambda y, a, b: (a * shaft(y), b * shaft(y), y)
            bar(P(y0, cx, cy), P(y1, cx, cy), .5); bar(P(y0, cx, cy), P(y1, nx, ny), .25); bar(P(y0, nx, ny), P(y1, cx, cy), .25); bar(P(y1, cx, cy), P(y1, nx, ny), .25)
    # platforms with railings, the arches between the legs, the top
    for y, r, h in ((57, 21, 3.2), (115, 10, 2.4)):
        n.box('Deck', (0, 0, y), (2 * r, 2 * r, h))
        for s in (-1, 1):
            n.box('Iron', (0, s * r, y + h / 2 + .6), (2 * r, .15, 1.2)); n.box('Iron', (s * r, 0, y + h / 2 + .6), (.15, 2 * r, 1.2))
    n.box('Deck', (0, 0, 57 + 3.2), (18, 18, 3.6))                                        # first-floor pavilion
    for side in range(4):
        a = side * math.pi / 2; c = V(math.cos(a), math.sin(a), 0) * 19.5
        n.arch('Iron', (c.x, c.y, 18), 27, 14, .9, 1.4, segs=14, axis='y' if side % 2 == 0 else 'x')
    n.box('Deck', (0, 0, 215.5), (3.4, 3.4, 3))
    n.cyl('Iron', (0, 0, 217), .5, 12, segs=8, r2=.15)
    n.sphere('Glow', (0, 0, 223), 1.2, segs=8, rings=6)
    n.build()

def arc():
    """Arc de Triomphe: two piers (game x +-8..22, z +-11), a coffered vault, cornices, the attic and relief panels"""
    M.get('ArcStone', '#e6dcc6', .85); M.get('Relief', '#d8ccb2', .9); M.get('Shade', '#b9ad94', .9)
    n = Node('L_arc'); S, T, H = 'ArcStone', 'Relief', 50.0
    for s in (-1, 1):
        n.boxa(S, s * 8, -11, 0, s * 22, 11, 32)                                         # the piers
        n.boxa('Shade', s * 8.6, -11.4, 0, s * 21.4, 11.4, 1.6)                           # plinth
        for yy in (-1, 1):   # relief panels on the faces and small side arches
            n.boxa(T, s * 10, yy * 11.0, 4, s * 20, yy * 11.35, 15)
        n.boxa('Shade', s * 22.0, -4, 0, s * 22.3, 4, 15); n.arch(S, (s * 22.1, 0, 15), 8, 4, .9, 1, segs=8, axis='y')
    # the main vault (half cylinder) and its ring
    seg = 16
    for i in range(seg):
        a0, a1 = math.pi * i / seg, math.pi * (i + 1) / seg
        p0 = (math.cos(a0) * 8, 19 + math.sin(a0) * 8); p1 = (math.cos(a1) * 8, 19 + math.sin(a1) * 8)
        n.face(S, [(p0[0], -11, p0[1]), (p1[0], -11, p1[1]), (p1[0], 11, p1[1]), (p0[0], 11, p0[1])], (-(p0[0] + p1[0]), 0, -(p0[1] + p1[1] - 38)))
    for yy in (-11.2, 11.2): n.arch('Shade', (0, yy, 19), 16, 8, .6, 1.2, segs=16, axis='x')
    n.boxa(S, -8, -11, 27, 8, 11, 32)                                                   # spandrel above the vault
    n.boxa(S, -23, -12, 32, 23, 12, 35); n.boxa('Shade', -23.5, -12.5, 35, 23.5, 12.5, 37)   # entablature and cornice
    n.boxa(T, -22, -11.6, 32.6, 22, 11.6, 34.4)                                          # the frieze
    n.boxa(S, -22.5, -11.5, 37, 22.5, 11.5, H - 2); n.boxa('Shade', -23, -12, H - 2, 23, 12, H)   # attic
    for x in range(-20, 21, 4): n.boxa(T, x - 1, -11.8, 39, x + 1, 11.8, H - 4)          # attic shields
    n.build()

def cafe():
    """one café table under a red parasol with four bistro chairs (the game puts nine of them on the square)"""
    M.get('Parasol', '#c8141b', .7, double=True); M.get('Chair', '#2f3b2f', .5, metal=.4); M.get('Table', '#d9d4c8', .4)
    n = Node('P_cafe')
    n.cyl('Metal', (0, 0, 0), .05, 2.6, segs=6)
    n.lathe('Parasol', [(0, 2.95), (1.7, 2.45), (1.75, 2.3)], segs=10, smooth=False)
    n.cyl('Table', (0, 0, .72), .4, .05, segs=12); n.cyl('Metal', (0, 0, 0), .03, .72, segs=6)
    for k in range(4):
        a = k * math.pi / 2 + .4; x, y = math.cos(a) * .85, math.sin(a) * .85
        n.box('Chair', (x, y, .45), (.42, .42, .05), rz=a); n.box('Chair', (x + math.cos(a) * .2, y + math.sin(a) * .2, .72), (.05, .42, .55), rz=a)
        for dx, dy in ((-.18, -.18), (.18, -.18), (.18, .18), (-.18, .18)): n.cyl('Chair', (x + dx, y + dy, 0), .02, .45, segs=4, smooth=False)
    n.build()
