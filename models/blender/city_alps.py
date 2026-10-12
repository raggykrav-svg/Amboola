# The Swiss Alps for AMBOOLA (see cities.py): wooden chalets on white stone bases with flower boxes, carved balconies
# and big snowy roofs, snowy firs, the village church and the fondue hut.
import math, random
from citykit import (Node, M, V, lerp, Face, Frame3, storey, band, window, door, outline, gable, hip, chimney, tree_fir)

def build():
    M.get('Roof', '#ffffff', .8); M.get('Plaster', '#f2efe8', .9); M.get('Frame', '#f4f0e6', .8); M.get('Wood', '#5a3a22', .8); M.get('Flowers', '#d42a2a', .8)
    M.get('ShutterR', '#b8322a', .7); M.get('ShutterGr', '#2f5a3a', .7); M.get('Door', '#4a2e1c', .6); M.get('Snow', '#f7fafc', .7); M.get('Stone', '#b8b2a8', .9)
    for k in range(2):
        for lo in (False, True): family(k, lo)
    t = Node('T_fir'); M.get('Fir', '#23472f', .9); M.get('Bark', '#4a3828', .9); tree_fir(t, h=10, snow=True)
    church(); fondue()

def flower_box(F, u, v0, ww):
    F.block('Wood', u - ww / 2 - .1, v0 - .35, u + ww / 2 + .1, v0 - .05, 0, .35)
    for j in range(5): F.n.ico('Flowers', F.P(u - ww / 2 + j * ww / 4, v0 - .02, .2), .17, sub=1)

def family(k, lo):
    """chalet: a white plaster ground floor, wooden upper floors with shutters and red geraniums, a carved balcony right
    round the first floor and a deep-eaved gable roof heavy with snow"""
    W = D = 16.0; GH, FH = 3.0, 2.8; x = 'l' if lo else ''; rnd = random.Random(60 + k)
    sh = ['ShutterR', 'ShutterGr'][k]
    S = dict(spacing=3.0, ww=.95, wh=1.2, v0=.8, frame='Frame', fw=.1, shutters=sh, margin=1.4, lite=lo)
    g = Node(f'G{k}{x}', W=W, D=D, H=GH); g.box('Plaster', (0, 0, GH / 2), (W, D, GH))
    for side in range(4):
        F = Face(g, W, D, side, 0); L = F.L - 3
        for i, u in enumerate((-L / 3, 0, L / 3)):
            if i == 1 and side % 2 == 0:
                if lo: F.quad('Door', u - .6, 0, u + .6, 2.2, .04)
                else: door(F, u, 1.2, 2.2, dict(frame='Wood', fw=.15, step='Stone'), 'Door')
            else: window(F, u, .8, .95, 1.2, dict(S, shutters=None), rnd)
    if not lo: band(g, 'Stone', W, D, 0, .5, .05)
    for name, bal in ((f'U{k}{x}', False), (f'B{k}{x}', True)):
        u = Node(name, W=W, D=D, H=FH); storey(u, W, D, 0, FH, S, rnd)
        if not lo:
            for side in range(4):
                F = Face(u, W, D, side, 0); L = F.L - 2.8; kk = max(1, int(L / 3.0 + .5))
                for i in range(kk): flower_box(F, -L / 2 + (i + .5) * L / kk, .8, .95)
                for j in range(int(F.L / .9)): F.quad('Wood', -F.L / 2 + j * .9, 0, -F.L / 2 + j * .9 + .06, FH, .01)   # board joints
        if bal:   # the carved balcony right round
            for side in range(4):
                F = Face(u, W, D, side, 0)
                F.block('Wood', -F.L / 2 - 1.3, -.1, F.L / 2 + 1.3, .1, 0, 1.3)
                F.quad('Wood', -F.L / 2 - 1.3, .1, F.L / 2 + 1.3, 1.05, 1.28)
                if not lo:
                    for j in range(int(F.L) + 2): F.quad('Plaster', -F.L / 2 - .8 + j, .35, -F.L / 2 - .55 + j, .8, 1.3)   # cut-out pattern
    r = Node(f'R{k}{x}', W=W, D=D)
    gable(r, W, D, 0, 4.2 if k == 0 else 3.6, o=1.6, t=.3, ends='Wall')
    if not lo:
        r.box('Snow', (0, 0, (4.2 if k == 0 else 3.6) + .35), (W + 3.0, .9, .25))           # snow on the ridge
        chimney(r, W / 4, D / 6, 1.8, w=.8, d=.8, h=2.6, m='Stone', pots=0); r.box('Snow', (W / 4, D / 6, 4.55), (1.0, 1.0, .25))

# ---------------------------------------------------------------- the church: game anchor (ox-85, oz+35); tower at the anchor, nave to game +z
def church():
    M.get('ChurchW', '#f2f2ee', .8); M.get('Slate', '#3a4a5a', .6); M.get('ClockF', '#f4ecd2', .5); M.get('Gold', '#d8b04a', .3, metal=.9)
    n = Node('L_church')
    n.box('ChurchW', (0, 0, 13), (8, 8, 26)); band(n, 'Stone', 8, 8, 0, 1.0, .1)
    for side in range(4):
        F = Face(n, 8, 8, side, 0)
        F.poly('ClockF', [(math.cos(2 * math.pi * i / 16) * 1.6, 21 + math.sin(2 * math.pi * i / 16) * 1.6) for i in range(16)], .05)
        F.quad('Dark', -.08, 21, .08, 22.3, .07); F.quad('Dark', 0, 20.95, .95, 21.08, .07)   # the hands
        F.poly('Dark', outline(-.6, 15, .6, 18, .6, 4), .03); F.poly('Dark', outline(-.4, 6, .4, 8, .4, 4), .03)
    n.cyl('Slate', (0, 0, 26), 5.6, 16, segs=4, r2=.2, rz=math.pi / 4, smooth=False)       # the pointed spire
    n.cyl('Gold', (0, 0, 42), .1, 2.5, segs=4); n.box('Gold', (0, 0, 43.7), (1.2, .1, .1))
    # the nave runs to game +z (Blender -y)
    n.box('ChurchW', (0, -17, 6), (14, 26, 12)); gable(n, 14, 26, 12, 5.5, o=.6, m='Slate', ends='ChurchW', ridge='y', at=(0, -17))
    n.box('Snow', (0, -17, 17.8), (.8, 27, .25))
    for side in (1, 3):
        F = Face(n, 14, 26, side, 0); F.O = F.O + V(0, -17, 0)
        for u in (-8, -3, 2, 7): F.poly('Window', outline(u - .7, 4, u + .7, 9, .7, 5), .03)
    n.cyl('ChurchW', (0, -30, 0), 5.5, 10, segs=12, smooth=True); n.sphere('Slate', (0, -30, 10), 5.6, segs=12, rings=6, hemi=True)   # apse
    F = Face(n, 8, 8, 0, 0); door(F, 0, 1.6, 2.8, dict(frame='Stone', fw=.25, door_arch=.5), 'Door')

# ---------------------------------------------------------------- the fondue hut: game anchor (ox+255, oz-115), 18 x 12
def fondue():
    M.get('Log', '#7a4e2c', .9); M.get('Window', '#1c2a38', .12); M.get('Smoke', '#d8d8d8', 1); M.get('Lantern', '#ffd27a', .4, emit='#ffb040', strength=3)
    n = Node('L_fondue'); rnd = random.Random(3)
    n.box('Stone', (0, 0, .6), (18, 12, 1.2))
    for j in range(10): n.box('Log', (0, 0, 1.2 + j * .58 + .29), (18 + (.6 if j % 2 else 0), 12 + (0 if j % 2 else .6), .56))   # stacked logs
    for side in range(4):
        F = Face(n, 18, 12, side, 1.2); L = F.L
        for u in ([-5, 0, 5] if side % 2 == 0 else [-3, 3]):
            if side == 2 and u == 0: F.quad('Door', -.8, 0, .8, 2.4, .32); continue
            F.quad('Window', u - .7, 1.0, u + .7, 2.3, .32); F.ring('Wood', outline(u - .7, 1.0, u + .7, 2.3), outline(u - .85, .85, u + .85, 2.45), .35)
            F.block('Wood', u - .9, .65, u + .9, .9, 0, .5)
            for j in range(4): n.ico('Flowers', F.P(u - .6 + j * .4, .95, .45), .16, sub=1)
    gable(n, 18, 12, 7.0, 4.0, o=1.8, t=.35, m='Roof', ends='Log')
    n.box('Snow', (0, 0, 11.4), (21.6, .9, .3))
    n.box('Stone', (6, 3, 10), (1.2, 1.2, 4)); n.ico('Smoke', (6.3, 3, 13.4), .8, sub=1); n.ico('Smoke', (6.9, 3.2, 14.6), 1.1, sub=1)
    for s in (-1, 1):   # benches and lanterns by the door (game +z side = Blender -y)
        n.box('Log', (s * 4.5, -8.2, .45), (3.4, .7, .12)); n.box('Log', (s * 4.5, -8.2, .2), (.3, .6, .4))
        n.cyl('Wood', (s * 2, -6.6, 0), .08, 2.2, segs=6); n.box('Lantern', (s * 2, -6.6, 2.35), (.35, .35, .45))
    n.box('Wood', (0, -7.0, 3.6), (4.5, .15, .8)); n.box('Gold', (0, -7.09, 3.6), (3.8, .05, .5))   # the sign
