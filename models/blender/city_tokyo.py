# Tokyo for AMBOOLA (see cities.py): the city's block buildings rebuilt from storey modules, Japanese houses,
# harbour warehouses, street trees, vending machines, Tokyo Tower and the temple.
#
# Building families follow the game's five facade styles (FACADES in index.html):
#   0 blue glass curtain wall   1 beige "mansion" apartments with balconies   2 dark glass with fins
#   3 grey concrete office with ribbon windows and sun shades   4 white modern with strip windows
# Each comes in two sizes (n: 18 m and w: 36 m square) as G<f><s> (5 m shop floor), U<f><s> (one 3.6 m floor),
# S<f><s> (four floors, 14.4 m) and R<f><s> (roof). Q<s> is the plain roof of a tower's podium. The game stacks them
# to each building's exact height (stretching the upper floors a little), tints Wall per building and puts the plain
# twins (name + 'l') on buildings away from the camera.
#   H<k>/HR<k>  a two-storey Japanese house (6 m) and its tiled gable roof (2 m rise), 8.5 m square
#   W<k>/WR<k>  a harbour warehouse (26 m square, 11 m) and its roof
#   T_trunk/T_crown  a street tree (the game recolours the crown with the seasons), V_body/V_glow  a vending machine
#   L_tower, L_temple
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, band, window, door, outline, grow, gable, hip, flat_roof, tree_round)

GH, FH = 5.0, 3.6
SIZES = {'n': 18.0, 'w': 36.0}

def build():
    M.get('Glass', '#2c4a64', .06, metal=.6); M.get('Frame', '#e9e9e6', .5); M.get('Slab', '#cfcac0', .8); M.get('Rail', '#dfe6ea', .3, metal=.2)
    M.get('AC', '#eef0ef', .6); M.get('Shade', '#9a9c9e', .6, metal=.3); M.get('Hedge', '#3f6f2f', .9); M.get('Tank', '#c9ced3', .5, metal=.4)
    for c, h in (('SignB', '#1f5fc4'), ('SignG', '#1f8a4a'), ('SignO', '#ff7a1f'), ('SignR', '#d42a2a')): M.get(c, h, .5)
    M.get('Awning', '#2f6f4f', .7, double=True); M.get('Door', '#3a3f46', .5)
    for f in range(5):
        for s in SIZES:
            for lo in (False, True): family(f, s, lo)
    for s in SIZES:
        for lo in (False, True):
            q = Node(f'Q{s}{"l" if lo else ""}', W=SIZES[s], D=SIZES[s]); roof_edge(q, SIZES[s], SIZES[s], lo, par=1.0)
    for k in range(3):
        for lo in (False, True): house(k, lo)
    for k in range(2):
        for lo in (False, True): warehouse(k, lo)
    tree(); vending(); tower(); temple()

# ---------------------------------------------------------------------------------------------------- storeys
def panels(F, u0, u1, v0, v1, n, rnd, lit=.45, glass='Glass', w=.02):
    for i in range(n):
        a, b = lerp(u0, u1, i / n), lerp(u0, u1, (i + 1) / n)
        F.quad('Window' if rnd.random() < lit else glass, a, v0, b, v1, w)

def floor(n, f, W, D, z, rnd, lo):
    """the outside of one 3.6 m floor of family f (the wall box is made by the caller). lo: one window band a side"""
    for side in range(4):
        F = Face(n, W, D, side, z); L = F.L; bays = max(2, round(L / 3.0))
        if lo:
            glass = 'Glass' if f in (0, 2) else 'WindowOff'
            if f == 1 and side % 2 == 0: F.block('Slab', -L / 2, -.05, L / 2, .18, 0, 1.4); F.quad('Rail', -L / 2, .18, L / 2, 1.2, 1.38)
            panels(F, -L / 2 + .3, L / 2 - .3, .9 if f != 1 else .2, 2.9 if f != 0 else FH, 3, rnd, lit=.33, glass=glass, w=.03 if f != 1 else .02)
            continue
        if f in (0, 2):   # curtain wall: a spandrel band, glass panels, mullions (blue) or deep fins (dark)
            F.quad('Wall', -L / 2, 0, L / 2, .9, .03)
            panels(F, -L / 2, L / 2, .9, FH, bays, rnd, lit=.33 if f == 0 else .28)
            for i in range(0, bays + 1, 2):
                u = -L / 2 + i * L / bays
                if f == 0: F.quad('Metal', u - .05, .9, u + .05, FH, .06)
                elif i % 4 == 0: F.block('Wall', u - .18, 0, u + .18, FH, 0, .7)
        elif f == 1:      # mansion: long balconies on the front and back, small windows on the ends
            if side % 2 == 0:
                F.quad('Window' if rnd.random() < .5 else 'WindowOff', -L / 2 + .6, .2, L / 2 - .6, 2.4, .02)
                F.block('Slab', -L / 2, -.05, L / 2, .18, 0, 1.4)
                F.quad('Rail', -L / 2, .18, L / 2, 1.2, 1.38)
                for i in range(3, bays, 3): F.block('Slab', -L / 2 + i * L / bays - .08, .18, -L / 2 + i * L / bays + .08, FH, 0, 1.4)   # dividers
                for i in range(bays):
                    if rnd.random() < .3: F.block('AC', -L / 2 + (i + .2) * L / bays, .18, -L / 2 + (i + .2) * L / bays + .8, .8, .3, .6)
            else:
                for i in range(max(1, bays // 3)):
                    u = -L / 2 + (i + .5) * L / max(1, bays // 3)
                    window(F, u, 1.0, 1.2, 1.4, dict(frame='Frame', fw=.08, fo=.05), rnd)
        elif f == 3:      # concrete office: ribbon windows under a sun shade
            panels(F, -L / 2 + .4, L / 2 - .4, 1.0, 2.7, bays, rnd, lit=.35, glass='WindowOff')
            F.block('Shade', -L / 2 + .3, 2.75, L / 2 - .3, 2.9, 0, .8)
            for i in range(0, bays + 1, 2): F.quad('Frame', -L / 2 + .4 + i * (L - .8) / bays - .05, 1.0, -L / 2 + .4 + i * (L - .8) / bays + .05, 2.7, .04)
        else:             # white modern: framed strip windows and a dark corner slot
            k = max(2, round(L / 4.5))
            for i in range(k):
                a, b = -L / 2 + 1 + i * (L - 2) / k + .25, -L / 2 + 1 + (i + 1) * (L - 2) / k - .25
                F.quad('Window' if rnd.random() < .35 else 'WindowOff', a, .9, b, 2.9, .02)
                F.ring('Frame', outline(a, .9, b, 2.9), outline(a - .12, .78, b + .12, 3.02), .06)
            F.quad('Dark', L / 2 - .7, 0, L / 2 - .2, FH, .02)

def roof_edge(n, W, D, lo, m='Wall', par=1.1):
    """a light flat roof: the parapet (four thin boxes, or just its outside for the far version) and the roof slab"""
    if lo:
        for side in range(4): Face(n, W, D, side, 0).quad(m, -(W if side % 2 == 0 else D) / 2, 0, (W if side % 2 == 0 else D) / 2, par, 0)
        return
    for sgn in (-1, 1):
        n.box(m, (0, sgn * (D / 2 - .15), par / 2), (W, .3, par)); n.box(m, (sgn * (W / 2 - .15), 0, par / 2), (.3, D - .6, par))
    n.face('RoofFlat', [(-W / 2 + .3, -D / 2 + .3, .06), (W / 2 - .3, -D / 2 + .3, .06), (W / 2 - .3, D / 2 - .3, .06), (-W / 2 + .3, D / 2 - .3, .06)], (0, 0, 1))

def family(f, s, lo):
    W = D = SIZES[s]; x = 'l' if lo else ''; rnd = random.Random(f * 10 + (s == 'w') * 5 + lo)
    # ground floor: shops with sign bands on two sides, an entrance and glass on the others
    g = Node(f'G{f}{s}{x}', W=W, D=D, H=GH)
    g.box('Wall', (0, 0, GH / 2), (W, D, GH))
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L; nshop = max(1, round(L / 9))
        if lo: F.quad('Window', -L / 2 + 1, .2, L / 2 - 1, 3.3, .03); continue
        for i in range(nshop):
            c, sw = -L / 2 + (i + .5) * L / nshop, L / nshop - 1.6
            F.quad('Window', c - sw / 2, .2, c + sw / 2, 3.3, .03)
            if not lo:
                F.ring('Door', outline(c - sw / 2, .2, c + sw / 2, 3.3), outline(c - sw / 2 - .15, 0, c + sw / 2 + .15, 3.45), .08)
                F.block(['SignB', 'SignG', 'SignO', 'SignR'][(side + i + f) % 4], c - sw / 2 - .15, 3.55, c + sw / 2 + .15, 4.3, 0, .2)
                if (side + i) % 3 == 0: F.n.face('Awning', [F.P(c - sw / 2, 3.45, .1), F.P(c + sw / 2, 3.45, .1), F.P(c + sw / 2, 2.9, 1.4), F.P(c - sw / 2, 2.9, 1.4)], F.N + V(0, 0, 1))
    if not lo: band(g, 'Wall', W, D, GH - .35, .35, .12)
    # one floor and a four-floor section
    u = Node(f'U{f}{s}{x}', W=W, D=D, H=FH)
    u.box('Glass' if f in (0, 2) else 'Wall', (0, 0, FH / 2), (W - .1, D - .1, FH)); floor(u, f, W, D, 0, rnd, lo)
    st = Node(f'S{f}{s}{x}', W=W, D=D, H=FH * 4)
    st.box('Glass' if f in (0, 2) else 'Wall', (0, 0, FH * 2), (W - .1, D - .1, FH * 4))
    for k in range(4): floor(st, f, W, D, k * FH, rnd, lo)
    # roof
    r = Node(f'R{f}{s}{x}', W=W, D=D)
    roof_edge(r, W, D, lo)
    # rooftop plant stays in the corners: the helicopter's rescue jobs put people in the middle of the roof
    if f in (0, 2):   # a mechanical penthouse with louvres; the dark towers get a glowing line round the top
        pw, pd, px, py = W * .24, D * .22, W * .32, D * .33
        r.box('Wall', (px, py, 2.3), (pw, pd, 4.6))
        if not lo:
            for side in range(4):
                F = Face(r, pw, pd, side, .6); F.O = F.O + V(px, py, 0)
                for j in range(5): F.quad('Dark', -F.L / 2 + .3, .3 + j * .65, F.L / 2 - .3, .6 + j * .65, .02)
        if f == 2:
            for side in range(4): Face(r, W, D, side, .75).quad('Glow', -(W if side % 2 == 0 else D) / 2, 0, (W if side % 2 == 0 else D) / 2, .25, .02)
    elif f == 1:      # the lift housing and a water tank
        r.box('Wall', (W * .34, D * .3, 1.8), (4, 4, 3.6)); r.cyl('Tank', (-W * .34, -D * .3, .1), 1.6, 2.4, segs=6 if lo else 10)
    elif f == 3:      # cooling tower and plant
        r.cyl('Shade', (W * .32, D * .32, .1), 2.2, 3.0, segs=8 if lo else 12, r2=1.8); r.box('AC', (-W * .3, -D * .33, .9), (5, 3, 1.6))
        if not lo:
            for j in range(4): r.box('AC', (-W * .38 + j * 1.4, D * .34, .6), (1.0, .8, 1.0))
    else:             # planters along the parapet and a small glass pavilion
        for sgn in (-1, 1): r.box('Hedge', (0, sgn * (D / 2 - 1.2), .4), (W * .6, 1.2, .6))
        r.box('Glass', (W * .32, -D * .3, 1.6), (W * .2, D * .18, 3.0))

# ---------------------------------------------------------------------------------------------------- houses
def house(k, lo):
    """two-storey Japanese house, 8.5 m square and 6 m tall (the game stretches it to each plot)"""
    W = D = 8.5; Hh = 6.0; x = 'l' if lo else ''; rnd = random.Random(90 + k)
    M.get('Shutter', '#b8bcc0', .5, metal=.3); M.get('Wood', '#6a4426', .8); M.get('Lattice', '#4a2e1c', .8); M.get('Pole', '#c9ced3', .4, metal=.6)
    h = Node(f'H{k}{x}', W=W, D=D, H=Hh)
    h.box('Wall', (0, 0, Hh / 2), (W, D, Hh))
    if lo:
        for side in range(4):
            F = Face(h, W, D, side, 0)
            for z0 in (1.0, 4.0): F.quad('Window' if rnd.random() < .5 else 'WindowOff', -1.6, z0, 1.6, z0 + 1.2, .03)
        return roof(k, lo)
    for side in range(4):
        F = Face(h, W, D, side, 0); L = F.L
        if side == 0:   # the front: entrance with a little canopy, a sliding window, the balcony above
            F.quad('Door', -2.8, 0, -1.6, 2.1, .03); F.block('Frame', -3.1, 2.2, -1.3, 2.32, 0, .9)
            if k == 1:   # traditional wooden lattice front (koshi) and a small tiled pent roof
                for j in range(14): F.quad('Lattice', -.8 + j * .25, .2, -.8 + j * .25 + .08, 2.6, .06)
                F.quad('Window', -.8, .2, 2.7, 2.6, .02)
                F.n.face('Roof', [F.P(-L / 2, 3.1, 0), F.P(L / 2, 3.1, 0), F.P(L / 2, 2.8, .8), F.P(-L / 2, 2.8, .8)], F.N + V(0, 0, 1.5))
            else:
                F.quad('Window' if rnd.random() < .5 else 'WindowOff', -.6, .8, 2.6, 2.4, .03); F.ring('Frame', outline(-.6, .8, 2.6, 2.4), outline(-.72, .68, 2.72, 2.52), .05)
            F.block('Wall', -L / 2 + .6, 3.3, L / 2 - .6, 3.45, 0, 1.1); F.quad('Rail', -L / 2 + .6, 3.45, L / 2 - .6, 4.4, 1.08)   # balcony
            F.quad('Window' if rnd.random() < .5 else 'WindowOff', -2.6, 3.45, 1.4, 5.5, .03); F.ring('Frame', outline(-2.6, 3.45, 1.4, 5.5), outline(-2.72, 3.33, 1.52, 5.62), .05)
            for s_ in (-1, 1): F.n.cyl('Pole', F.P(s_ * 2.8, 4.4, .8), .03, 1.1, segs=4, smooth=False)
            F.n.cyl('Pole', F.P(-2.8, 5.45, .8), .025, 5.6, segs=4, smooth=False, ry=math.pi / 2, rz=math.atan2(F.T.y, F.T.x))   # the laundry pole
        else:
            for z0 in (1.0, 4.0):
                u = (-1 if side % 2 else 1) * 1.2
                F.quad('Window' if rnd.random() < .5 else 'WindowOff', u - 1.0, z0, u + 1.0, z0 + 1.2, .03)
                F.ring('Frame', outline(u - 1.0, z0, u + 1.0, z0 + 1.2), outline(u - 1.1, z0 - .1, u + 1.1, z0 + 1.3), .05)
                if side == 2: F.block('Shutter', u - 1.05, z0 + 1.2, u + 1.05, z0 + 1.45, 0, .25)   # shutter box
        if side == 3: F.block('AC', 1.5, 0, 2.4, .65, 0, .35); F.n.cyl('Pole', F.P(L / 2 - .3, 0, .12), .05, Hh, segs=6)   # outdoor unit and downpipe
    band(h, 'Frame', W, D, 2.95, .12, .04)
    roof(k, lo)

def roof(k, lo):
    W = D = 8.5; r = Node(f'HR{k}{"l" if lo else ""}', W=W, D=D, rise=2.0)
    gable(r, W, D, 0, 2.0, o=.6, t=.18, ends='Wall')
    if not lo:
        r.box('Roof', (0, 0, 2.18), (W + .8, .35, .25))                                  # ridge tiles
        for s_ in (-1, 1): r.cyl('Roof', (s_ * (W / 2 + .5), 0, 2.05), .22, .3, segs=6)   # ridge-end tiles

# ---------------------------------------------------------------------------------------------------- warehouses
def warehouse(k, lo):
    """a harbour warehouse: ribbed metal walls, roller doors, a company band; 26 m square, 11 m"""
    W = D = 26.0; Hw = 11.0; x = 'l' if lo else ''; rnd = random.Random(95 + k)
    M.get('Roller', '#9aa0a6', .5, metal=.4); M.get('Rib', '#7c8288', .6, metal=.3); M.get('Band', ['#1f5fc4', '#d42a2a'][k], .5)
    w = Node(f'W{k}{x}', W=W, D=D, H=Hw)
    w.box('Wall', (0, 0, Hw / 2), (W, D, Hw))
    for side in range(4):
        F = Face(w, W, D, side, 0); L = F.L
        F.block('Band', -L / 2, Hw - 1.6, L / 2, Hw - .6, 0, .1)
        if side % 2 == 0:
            for u in (-L / 4, L / 4):
                F.quad('Roller', u - 2.5, 0, u + 2.5, 5.0, .03)
                if not lo:
                    for j in range(10): F.quad('Rib', u - 2.5, .4 + j * .5, u + 2.5, .46 + j * .5, .05)
                    F.block('Shade', u - 3, 5.0, u + 3, 5.3, 0, 1.6)                      # canopy over the door
        else: F.quad('Window' if rnd.random() < .5 else 'WindowOff', -3, 6.5, 3, 8, .03)
        if not lo:
            for j in range(int(L / 1.2)): F.quad('Rib', -L / 2 + j * 1.2, 0, -L / 2 + j * 1.2 + .2, Hw - 1.6, .02)
    r = Node(f'WR{k}{x}', W=W, D=D)
    gable(r, W, D, 0, 1.6 if k == 0 else 2.6, o=.4, t=.15, ends='Wall', m='Rib' if k == 0 else 'Roller')
    if not lo:
        for j in range(4): r.box('Glass', (-W / 2 + 3 + j * 6.5, D / 4, .95), (3, 2, .1), rx=-.12)   # skylights

# ---------------------------------------------------------------------------------------------------- street furniture
def tree():
    """a street tree split in two so the game can recolour the crown with the seasons (sakura pink, autumn red...)"""
    M.get('Bark', '#4a3627', .95); M.get('Leaves', '#ffffff', .85); rnd = random.Random(12)
    t = Node('T_trunk')
    t.tube('Bark', [(0, 0, 0), (.1, 0, 1.6), (0, .1, 3.0)], .22, segs=6, r_end=.13)
    for a in (0, 2.1, 4.2): t.tube('Bark', [(0, .1, 2.6), (math.cos(a) * 1.3, math.sin(a) * 1.3, 3.7)], .09, segs=4, r_end=.05)
    c = Node('T_crown')
    c.ico('Leaves', (0, 0, 4.4), 2.0, sub=1, scale=(1, 1, .85), jitter=.14, rnd=rnd)
    for x, y, z, r_ in [(1.2, .4, 3.8, 1.2), (-1.1, .6, 3.9, 1.2), (.2, -1.2, 3.9, 1.2), (0, 0, 5.4, 1.0)]:
        c.ico('Leaves', (x, y, z), r_, sub=0, scale=(1, 1, .85), jitter=.12, rnd=rnd)

def vending():
    """a Japanese vending machine: the body (tinted per machine) with dark details, and the glowing display front"""
    M.get('Wall', '#ffffff', .4); M.get('Slot', '#1a1b1e', .5); M.get('Btn', '#c9ced3', .4)
    b = Node('V_body')
    b.box('Wall', (0, 0, .925), (1.0, .75, 1.85)); b.box('Slot', (0, .38, .3), (.8, .02, .25)); b.box('Btn', (0, .38, .62), (.8, .02, .12))
    b.box('Slot', (.32, .38, .9), (.14, .02, .3)); b.box('Wall', (0, 0, 1.9), (1.04, .8, .1))
    gl = Node('V_glow'); gl.box('Glow', (0, .385, 1.2), (.8, .01, 1.1))
    for j in range(3): gl.box('Glow', (0, .39, .82 + j * .36), (.78, .02, .04))

# ---------------------------------------------------------------------------------------------------- Tokyo Tower: block (5, 5), legs at +-26
def tower():
    M.get('TOrange', '#e0421c', .45, metal=.3); M.get('TWhite', '#f2f2f0', .45, metal=.3); M.get('Deck', '#9fb8c8', .1, metal=.7)
    M.get('FootTown', '#d9d6cf', .7)
    n = Node('L_tower'); H = 240.0
    legw = lambda t: lerp(26, 2.2, t ** .65)
    def bar(a, b, t, m):
        a, b = V(*a), V(*b); d = b - a; L = d.length
        n.box(m, (a + b) / 2, (t, t, L), rz=math.atan2(d.y, d.x), ry=math.acos(max(-1, min(1, d.z / L))))
    segs = 24
    for sgm in range(segs):
        t0, t1 = sgm / segs, (sgm + 1) / segs; y0, y1, w0, w1 = t0 * H, t1 * H, legw(t0), legw(t1)
        m = 'TWhite' if (sgm // 2) % 2 else 'TOrange'
        cs = [(1, 1), (1, -1), (-1, -1), (-1, 1)]
        for i, (sx, sy) in enumerate(cs):
            lw0, lw1 = lerp(4.0, .8, t0), lerp(4.0, .8, t1)   # each corner leg is itself a small lattice of 4 rails
            for ox, oy in ((0, 0), (-sx, 0), (0, -sy), (-sx, -sy)):
                bar((sx * w0 + ox * lw0, sy * w0 + oy * lw0, y0), (sx * w1 + ox * lw1, sy * w1 + oy * lw1, y1), .45 - t0 * .25, m)
            nx, ny = cs[(i + 1) % 4]
            bar((sx * w0, sy * w0, y0), (nx * w1, ny * w1, y1), .3, m); bar((nx * w0, ny * w0, y0), (sx * w1, sy * w1, y1), .3, m)
            bar((sx * w1, sy * w1, y1), (nx * w1, ny * w1, y1), .35, m)
    # the two observation decks (glass all round), the antenna mast and the "Foot Town" building under the legs
    for y, s, hh in ((H * .38, 16, 8), (H * .62, 8.5, 5)):
        n.cyl('TWhite', (0, 0, y - hh / 2 - .6), s + 1.2, .6, segs=8, rz=math.pi / 8)
        n.cyl('Deck', (0, 0, y - hh / 2), s, hh, segs=8, rz=math.pi / 8, smooth=False)
        n.cyl('Window', (0, 0, y - hh / 2 + .6), s + .05, hh * .45, segs=8, rz=math.pi / 8, smooth=False)
        n.cyl('TWhite', (0, 0, y + hh / 2), s + .8, .7, segs=8, rz=math.pi / 8)
    n.cyl('TWhite', (0, 0, H), 2.4, 6, segs=8, r2=1.6); n.cyl('TOrange', (0, 0, H + 6), 1.5, 22, segs=8, r2=.8)
    n.cyl('TWhite', (0, 0, H + 28), .8, 22, segs=8, r2=.35); n.sphere('Glow', (0, 0, H + 50.5), .9, segs=8, rings=6)
    n.box('FootTown', (0, 0, 7), (34, 30, 14)); band(n, 'TWhite', 34, 30, 13.4, .6, .3)
    for side in range(4):
        F = Face(n, 34, 30, side, 0)
        for j in range(4): F.quad('Window' if j % 2 else 'WindowOff', -F.L / 2 + 2, 2 + j * 3, F.L / 2 - 2, 3.6 + j * 3, .03)
    for k in range(10):   # aircraft warning lights up the legs (the game lights them at night)
        t = k / 10
        for sx, sy in ((1, 1), (-1, -1)): n.sphere('Glow', (sx * (legw(t) + 1), sy * (legw(t) + 1), t * H), .8, segs=6, rings=4)

# ---------------------------------------------------------------------------------------------------- the temple: block (13, 6)
def temple():
    """five-storey pagoda (game +12, 0), the main hall (game -8, -8) with a hip-and-gable roof, three torii gates on
    the path from the west road (game x -29..-15, z +10) and stone lanterns"""
    M.get('Vermilion', '#c8321e', .55); M.get('TileD', '#2a2d33', .5, metal=.2); M.get('Plaster', '#efe9dc', .8); M.get('StoneG', '#a7a59f', .9)
    M.get('Gold', '#d8b04a', .3, metal=.9); M.get('Kasagi', '#1e1f23', .5)
    n = Node('L_temple')
    # the pagoda: a vermilion body per storey, white walls, and wide dark roofs with upturned corners
    px, y = 12.0, 0.0
    n.box('StoneG', (px, 0, .5), (12, 12, 1.0)); y = 1.0
    for s in range(5):
        w = 10 - s * 1.3; h = 3.4
        n.box('Vermilion', (px, 0, y + h / 2), (w, w, h))
        for side in range(4):
            F = Face(n, w, w, side, y); F.O = F.O + V(px, 0, 0)
            F.quad('Plaster', -w / 2 + .6, .5, -w / 6, h - .5, .03); F.quad('Plaster', w / 6, .5, w / 2 - .6, h - .5, .03)
            F.quad('Door', -w / 6 + .2, .3, w / 6 - .2, h - .8, .03)
        y += h
        rw = w + 4.2; k0 = n.mark()
        hip(n, rw, rw, y - .2, 1.6 if s < 4 else 3.0, o=0, m='TileD', t=.35)
        n.shift(k0, (px, 0, 0))
        for sx in (-1, 1):
            for sy in (-1, 1): n.box('TileD', (px + sx * rw / 2, sy * rw / 2, y - .1), (.9, .9, .35), rz=math.pi / 4, rx=sx * sy * .3)   # the upturned corners
        y += .5
    n.cyl('Gold', (px, 0, y + 1.0), .25, 9, segs=8)                                       # the sorin spire
    for j in range(9): n.cyl('Gold', (px, 0, y + 2.5 + j * .7), .8 - j * .05, .15, segs=10)
    # the main hall: vermilion posts, white walls, a big two-step roof, steps
    hx, hy = -8.0, 8.0
    n.box('StoneG', (hx, hy, .5), (20, 14, 1.0))
    n.box('Plaster', (hx, hy, 4.0), (16, 10, 6.0))
    for i in range(7):
        for sy in (-1, 1): n.cyl('Vermilion', (hx - 8.5 + i * 17 / 6, hy + sy * 5.4, 1.0), .35, 6.2, segs=8)
    for sx in (-1, 1): n.cyl('Vermilion', (hx + sx * 8.5, hy, 1.0), .35, 6.2, segs=8)
    n.box('Vermilion', (hx, hy, 7.2), (18.4, 11.4, .6))
    hip(n, 21, 15, 7.5, 2.4, o=0, m='TileD', t=.4, at=(hx, hy))
    gable(n, 12, 8, 9.6, 3.2, o=.3, t=.35, m='TileD', ends='Vermilion', at=(hx, hy))
    n.box('Gold', (hx, hy, 12.9), (12.6, .4, .3))
    for j in range(4): n.box('StoneG', (hx, hy - 7.2 - j * .45, .25 + j * .25), (6, .45, .5 + j * .5))   # steps to the path (game +z)
    # three torii gates over the path from the west road
    for k in range(3):
        tx, ty = -29 + k * 7, -10.0
        for s in (-1, 1): n.cyl('Vermilion', (tx, ty + s * 3, 0), .32, 6.2, segs=10); n.cyl('Kasagi', (tx, ty + s * 3, 0), .38, .6, segs=10)
        n.box('Vermilion', (tx, ty, 4.9), (.45, 8.0, .5))                                 # nuki
        n.box('Vermilion', (tx, ty, 6.2), (.6, 9.2, .5))
        n.box('Kasagi', (tx, ty, 6.65), (.8, 10.4, .45))                                  # kasagi
        for s in (-1, 1): n.box('Kasagi', (tx, ty + s * 5.3, 6.8), (.8, 1.0, .35), rx=-s * .25)   # upswept ends
        n.box('Kasagi', (tx, ty, 5.55), (.25, .9, 1.0))                                   # the name plaque
    # stone lanterns along the path
    for k in range(4):
        lx = -26 + k * 6
        for s in (-1, 1):
            ly = -10 + s * 4.6
            n.cyl('StoneG', (lx, ly, 0), .45, .3, segs=6); n.cyl('StoneG', (lx, ly, .3), .18, 1.0, segs=6)
            n.box('StoneG', (lx, ly, 1.45), (.75, .75, .5)); n.box('Glow', (lx, ly, 1.45), (.5, .78, .25))
            n.cyl('StoneG', (lx, ly, 1.7), .6, .45, segs=6, r2=.08, smooth=False)

def demo(out):
    """test street: every family stacked in both sizes, houses, warehouses, trees, a vending machine, the landmarks"""
    import bpy, os
    from citykit import render
    objs = {o.name: o for o in bpy.context.scene.objects}; made = []
    def put(name, x, y, z=0, sz=1.0):
        o = objs[name].copy(); bpy.context.scene.collection.objects.link(o); o.location = (x, y, z); o.scale = (1, 1, sz); made.append(o)
    for f in range(5):
        for j, s in enumerate(SIZES):
            x = -120 + f * 50; y = j * 50; z = 0
            put(f'G{f}{s}', x, y); z = GH; put(f'U{f}{s}', x, y, z); z += FH; put(f'S{f}{s}', x, y, z); z += FH * 4; put(f'R{f}{s}', x, y, z)
    for k in range(3): put(f'H{k}', -120 + k * 14, -40); put(f'HR{k}', -120 + k * 14, -40, 6.0)
    for k in range(2): put(f'W{k}', -60 + k * 32, -45); put(f'WR{k}', -60 + k * 32, -45, 11.0)
    put('T_trunk', 10, -40); put('T_crown', 10, -40); put('V_body', 16, -40); put('V_glow', 16, -40)
    put('L_temple', 80, -60); put('L_tower', 200, 150)
    for o in objs.values(): o.hide_render = True
    render(os.path.join(out, 'tokyo-street.png'), {}, cam=(-40, -150, 60), look=(-30, 20, 15), lens=30)
    render(os.path.join(out, 'tokyo-landmarks.png'), {}, cam=(60, -200, 90), look=(150, 60, 60), lens=30)
    for o in made: bpy.data.objects.remove(o)
    for o in objs.values(): o.hide_render = False
